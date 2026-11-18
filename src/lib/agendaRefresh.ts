export type AgendaRefreshStatus = { enabled: boolean; retryAfterSeconds?: number | null };

// Relative server timing avoids depending on the accuracy of the device clock.
// If a refresh is already due, allow a brief retry without a tight request loop.
export function agendaRefreshDelay(practice: boolean, hasExternal: boolean, sync?: AgendaRefreshStatus | null) {
  if (!practice) return 600_000;
  if (!hasExternal || sync?.enabled === false) return 300_000;
  const seconds = sync?.retryAfterSeconds;
  return typeof seconds === 'number' && Number.isFinite(seconds)
    ? Math.min(900_500, Math.max(5_000, seconds * 1000 + 500))
    : 60_500;
}
