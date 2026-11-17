import { getSupabaseAdmin } from './supabase/server';
import type { AuditActor } from './securityAudit';

export const agendaUuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export function agendaInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,6})?)?(?:Z|[+-]\d\d:\d\d)$/i.test(value)) return false;
  const date = value.slice(0, 10);
  const midnight = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(Date.parse(value)) && Number.isFinite(midnight.getTime()) && midnight.toISOString().slice(0, 10) === date;
}

export function agendaRange(from: unknown, to: unknown, maxDays = 62) {
  return agendaInstant(from) && agendaInstant(to) && Date.parse(to) > Date.parse(from)
    && Date.parse(to) - Date.parse(from) <= maxDays * 86400000;
}

export const activeBookingStatuses = ['pending', 'confirmed'];
export const calendarBookingStatuses = [...activeBookingStatuses, 'completed', 'no_show', 'cancelled', 'declined'];

export async function agendaRows<T>(query: { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> }) {
  const rows: T[] = [];
  const pageSize = 250;
  for (let offset = 0;; offset += pageSize) {
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

export type AgendaValues = {
  title: string; startsAt: string; endsAt: string; kind: string; location: string; color: string; calendarScope: string;
  practitionerId?: string | null;
};
export function agendaEventValues(input: AgendaValues) {
  const title = input.title.trim();
  const location = input.location.trim();
  const color = input.color.trim();
  if ([...title].length < 2 || [...title].length > 100 || [...location].length > 120 || !/^#[0-9a-f]{6}$/i.test(color)
    || !['appointment', 'personal', 'block'].includes(input.kind) || !agendaRange(input.startsAt, input.endsAt, 367)) {
    throw new Error('invalid_event');
  }
  return { title, location, color, event_kind: input.kind, starts_at: input.startsAt, ends_at: input.endsAt,
    calendar_scope: input.calendarScope, practitioner_id: input.practitionerId };
}

export async function writeAgendaItem(
  actor: AuditActor,
  mode: 'admin' | 'practice',
  operation: 'create' | 'update' | 'move' | 'delete' | 'block' | 'unblock',
  practitionerId: string | null,
  options: { id?: string; revision?: string; values?: Record<string, unknown> } = {},
) {
  const { data, error } = await getSupabaseAdmin().rpc('mutate_agenda_item', {
    p_actor: actor.userId, p_mode: mode, p_operation: operation, p_practitioner: practitionerId,
    p_id: options.id || null, p_revision: options.revision || null, p_values: options.values || {},
    p_request: actor.requestId || null, p_path: actor.requestPath || null,
  });
  if (error) throw error;
  return data;
}

export function agendaError(error: unknown) {
  const cause = error as { code?: string; message?: string } | null;
  if (cause?.message === 'potential_patient_match') return { status: 409, message: 'Er bestaat mogelijk al een cliënt met deze naam of dit e-mailadres. Zoek en selecteer eerst het bestaande dossier.' };
  if (cause?.message === 'idempotency_conflict') return { status: 409, message: 'Deze aanvraag is al verwerkt met andere gegevens. Open de opgeslagen afspraak voordat je opnieuw plant.' };
  if (cause?.code === '23P01' || cause?.message === 'slot_unavailable') return { status: 409, message: 'Dit tijdstip overlapt met een afspraak of blokkade. Kies een ander tijdstip.' };
  if (cause?.code === '40001') return { status: 409, message: 'Dit item is intussen gewijzigd. Ververs de agenda en open het opnieuw.' };
  if (cause?.code === '42501' || cause?.message === 'not_allowed') return { status: 403, message: 'Je hebt geen toegang tot dit item.' };
  if (cause?.code === 'P0002' || cause?.message === 'not_found') return { status: 404, message: 'Dit item is niet meer beschikbaar. Ververs de agenda.' };
  if (cause?.code === '55000' || cause?.code === 'external_calendar_unavailable') return { status: 503, message: 'De externe agenda kon niet worden gecontroleerd voor dit tijdstip. Probeer later of controleer MijnDiAd.' };
  if (cause?.message === 'invalid_transition') return { status: 409, message: 'Deze statuswijziging is niet meer mogelijk. Ververs de agenda.' };
  if (cause?.message === 'invalid_reschedule') return { status: 400, message: 'Kies een ander toekomstig tijdstip.' };
  if (cause?.message === 'invalid_offer') return { status: 400, message: 'Kies een geldig afspraaktype bij de therapeut.' };
  if (cause?.message === 'invalid_input') return { status: 400, message: 'Controleer de cliënt, het afspraaktype en het tijdstip.' };
  if (cause?.message === 'invalid_event' || ['22007', '22023', '22P02', '23514'].includes(cause?.code || '')) return { status: 400, message: 'Controleer de ingevulde gegevens en het tijdstip.' };
  return { status: 502, message: 'De agenda kon de wijziging niet bevestigen. Ververs de agenda voordat je opnieuw probeert.' };
}

export async function agendaClientChoices(actor: AuditActor, parameters: URLSearchParams) {
  const search = (parameters.get('q') || '').trim().slice(0, 100);
  const requestedPage = Number(parameters.get('page') || 0);
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 0 ? Math.min(10000, requestedPage) : 0;
  const pageSize = 50;
  const { data, error } = await getSupabaseAdmin().rpc('agenda_client_choices', {
    p_actor: actor.userId, p_search: search, p_offset: page * pageSize, p_limit: pageSize + 1,
  });
  if (error) throw error;
  const choices = (data || []).slice(0, pageSize);
  const {data: identities,error: identityError}=choices.length ? await getSupabaseAdmin().from('patients').select('id,customer_user_id').in('id',choices.map((client:{id:string})=>client.id)) : {data:[],error:null};
  if(identityError) throw identityError;
  const linked=new Set((identities||[]).filter(patient=>patient.customer_user_id).map(patient=>patient.id));
  return { clients: choices.map((client:{id:string;name:string;email:string})=>({...client,accountLinked:linked.has(client.id)})), hasMore: (data || []).length > pageSize };
}
