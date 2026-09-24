import { getSupabaseAdmin } from './supabase/server';

type Row = Record<string, any>;
export type SettingsIntegrationState = 'healthy' | 'warning' | 'unknown' | 'manual' | 'failed';
export type SettingsIntegration = {
  key: string;
  label: string;
  state: SettingsIntegrationState;
  detail: string;
  checkedAt: string | null;
  source: string;
};

const validDate = (value: unknown) => value ? String(value) : null;

const getAuthEmailStatus = async (now: Date): Promise<SettingsIntegration> => {
  const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return {
    key: 'auth', label: 'Supabase Auth', state: 'unknown',
    detail: 'De publieke Supabase Auth-instellingen zijn niet bereikbaar vanuit deze omgeving.', checkedAt: null, source: 'Live Auth-controle',
  };
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store', signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error('auth_settings_unavailable');
    const settings = await response.json() as { external?: { email?: boolean }; mailer_autoconfirm?: boolean };
    const emailEnabled = settings.external?.email === true;
    const confirmationRequired = settings.mailer_autoconfirm === false;
    return {
      key: 'auth', label: 'Supabase Auth',
      state: emailEnabled && confirmationRequired ? 'healthy' : emailEnabled ? 'warning' : 'failed',
      detail: !emailEnabled ? 'E-mailaanmelding staat uit.' : confirmationRequired
        ? 'E-mailaanmelding staat aan en e-mailbevestiging is vereist.'
        : 'E-mailaanmelding staat aan, maar automatische bevestiging is actief.',
      checkedAt: now.toISOString(), source: 'Live controle via Supabase Auth API',
    };
  } catch {
    return {
      key: 'auth', label: 'Supabase Auth', state: 'unknown',
      detail: 'De live Auth-instellingen konden niet worden opgehaald.', checkedAt: null, source: 'Live Auth-controle',
    };
  }
};

export const getAdminSettingsIntegrations = async (): Promise<SettingsIntegration[]> => {
  const now = new Date();
  const client = getSupabaseAdmin();
  const [{ data, error }, auth] = await Promise.all([
    client.from('integration_status').select('key,label,state,detail,last_checked_at').order('key'),
    getAuthEmailStatus(now),
  ]);
  if (error) throw new Error(error.message || 'Integration status unavailable.');
  const rows = new Map(((data || []) as Row[]).map((row) => [String(row.key), row]));
  const emailRow = rows.get('email');
  const smtp: SettingsIntegration = {
    key: 'smtp', label: 'SMTP-bezorging', state: 'unknown',
    detail: `De Auth API bevestigt de e-mailbevestigingsfunctie, niet de bezorgprovider. De opgeslagen integratierij zegt “${String(emailRow?.state || 'geen status')}”${emailRow?.last_checked_at ? ` (laatst gecontroleerd ${String(emailRow.last_checked_at)})` : ' en heeft geen controledatum'}; controleer custom SMTP in Supabase Auth.`,
    checkedAt: validDate(emailRow?.last_checked_at), source: 'SMTP-configuratie is niet live uitleesbaar vanuit de app',
  };
  const payments: SettingsIntegration = {
    key: 'payments', label: 'Betalingen', state: 'manual',
    detail: 'Handmatige Wise-overschrijving is actief. De klant meldt de betaling; een superadmin controleert en bevestigt die. Automatische providerbevestiging is niet actief.',
    checkedAt: null, source: 'Huidige Wise-order- en verificatiestroom',
  };
  const savedStatus = (key: string, fallbackLabel: string): SettingsIntegration => {
    const row = rows.get(key);
    if (!row) return { key, label: fallbackLabel, state: 'unknown', detail: 'Er is geen statusrecord beschikbaar.', checkedAt: null, source: 'Statusregistratie in Supabase' };
    const checkedAt = validDate(row.last_checked_at);
    const ageMs = checkedAt ? now.getTime() - new Date(checkedAt).getTime() : Number.POSITIVE_INFINITY;
    const isFresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= 24 * 60 * 60 * 1000;
    const recordedState = String(row.state);
    const state: SettingsIntegrationState = !isFresh ? 'unknown'
      : recordedState === 'healthy' ? 'healthy'
        : recordedState === 'failed' ? 'failed'
          : recordedState === 'degraded' ? 'warning' : 'unknown';
    const detail = isFresh
      ? String(row.detail || 'Er is geen detail vastgelegd.')
      : `Geen recente controle. Laatst opgeslagen status: ${recordedState}${checkedAt ? ` op ${checkedAt}` : ''}.`;
    return { key, label: String(row.label || fallbackLabel), state, detail, checkedAt, source: 'Opgeslagen statusrecord; maximaal 24 uur als actueel getoond' };
  };
  const database: SettingsIntegration = {
    key: 'database', label: 'Supabase-database', state: 'healthy',
    detail: 'De instellingen en statusgegevens zijn zojuist uit de database gelezen.', checkedAt: now.toISOString(), source: 'Live server-side databasequery',
  };
  return [
    database,
    auth,
    smtp,
    payments,
    savedStatus('analytics', 'Analytics'),
    savedStatus('booking', 'Boekingen'),
    savedStatus('storage', 'Bestandsopslag'),
  ];
};
