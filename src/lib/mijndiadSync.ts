import { getSupabaseAdmin } from './supabase/server';

export type MijndiadSyncStatus = {
  enabled: boolean; lastAttemptAt?: string | null; lastSuccessAt: string | null;
  lastError: string | null; failureCount: number; eventCount: number;
  pendingMissing: number; coverageUncertain: number; intervalMinutes: number; mode: 'on_demand';
};
export const CALENDAR_UNAVAILABLE_MESSAGE = 'De externe agenda kon niet recent genoeg worden gecontroleerd. Probeer over enkele minuten opnieuw. Er is geen nieuwe afspraak opgeslagen.';
export class ExternalCalendarUnavailableError extends Error {
  readonly code = 'external_calendar_unavailable';
  constructor() { super(CALENDAR_UNAVAILABLE_MESSAGE); }
}

// Shared cache, locking and retry backoff live in Postgres, across all Vercel
// instances and visitors. This separate RPC commits failure metadata before a
// booking RPC can fail/roll back. No secrets or appointment data are returned.
export async function ensurePracticeCalendarFresh(practitionerId: string, options: { maxAgeSeconds?: number; required?: boolean } = {}) {
  const { data, error } = await getSupabaseAdmin().rpc('ensure_mijndiad_fresh', {
    p_practitioner_id: practitionerId, p_max_age_seconds: options.maxAgeSeconds ?? 300,
  });
  if (error || !data || data.usable !== true) {
    if (options.required !== false) throw new ExternalCalendarUnavailableError();
  }
  return { usable: !error && data?.usable === true, sync: error ? null : (data?.sync ?? null) as MijndiadSyncStatus | null };
}
