// Only choose between our two fixed workspaces; never redirect to a submitted URL.
export const clientRecordsBaseForRequest = (request: Request) => {
  const workspace = new URL(request.url).searchParams.get('werkruimte');
  if (workspace === 'praktijk') return '/praktijk/clienten';
  if (workspace === 'admin') return '/admin/clienten';
  try {
    const source = new URL(request.headers.get('referer') || '');
    if (source.origin === new URL(request.url).origin && /^\/praktijk\/clienten(?:\/|$)/.test(source.pathname)) return '/praktijk/clienten';
  } catch { /* Requests without a referrer use the organisation workspace. */ }
  return '/admin/clienten';
};
