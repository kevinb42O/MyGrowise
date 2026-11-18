import type { AstroCookies } from 'astro';
import { SUPABASE_SESSION_COOKIE, verifySupabaseSession, refreshSupabaseSession, revokeSupabaseSession } from './adminAuth';

export const REFRESH_SESSION_COOKIE = 'mg_refresh';
export const REMEMBER_SESSION_COOKIE = 'mg_remember';
export const REMEMBER_SECONDS = 30 * 24 * 60 * 60;
type Tokens = { accessToken: string; refreshToken: string };

const cookieOptions = (remember: boolean) => ({
  httpOnly: true, secure: import.meta.env.PROD, sameSite: 'strict' as const, path: '/',
  ...(remember ? { maxAge: REMEMBER_SECONDS } : {}),
});

export function setAuthSession(cookies: AstroCookies, tokens: Tokens, remember = false) {
  const options = cookieOptions(remember);
  cookies.set(SUPABASE_SESSION_COOKIE, tokens.accessToken, options);
  cookies.set(REFRESH_SESSION_COOKIE, tokens.refreshToken, options);
  cookies.set(REMEMBER_SESSION_COOKIE, remember ? '1' : '0', options);
}

export function clearAuthSession(cookies: AstroCookies) {
  for (const name of [SUPABASE_SESSION_COOKIE, REFRESH_SESSION_COOKIE, REMEMBER_SESSION_COOKIE]) cookies.delete(name, { path: '/' });
}

function expiresSoon(token: string) {
  try {
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return typeof exp !== 'number' || exp <= Math.floor(Date.now() / 1000) + 60;
  } catch { return true; }
}

// Refresh on the next request, including form submissions after a long pause.
// No browser timer, localStorage, keepalive or background scheduler is needed.
export async function resolveAuthSession(cookies: AstroCookies) {
  const accessToken = cookies.get(SUPABASE_SESSION_COOKIE)?.value;
  const refreshToken = cookies.get(REFRESH_SESSION_COOKIE)?.value;
  if (!accessToken && !refreshToken) {
    if (cookies.get(REMEMBER_SESSION_COOKIE)) clearAuthSession(cookies);
    return null;
  }
  if (refreshToken && (!accessToken || expiresSoon(accessToken))) {
    const refreshed = await refreshSupabaseSession(refreshToken);
    if (!refreshed) { clearAuthSession(cookies); return null; }
    setAuthSession(cookies, refreshed, cookies.get(REMEMBER_SESSION_COOKIE)?.value === '1');
    return { user: refreshed.user, accessToken: refreshed.accessToken };
  }
  const user = await verifySupabaseSession(accessToken);
  if (!user) { clearAuthSession(cookies); return null; }
  return { user, accessToken: accessToken! };
}

export async function logoutAuthSession(cookies: AstroCookies) {
  // Refresh expired access tokens before revoking the server-side session.
  const session = await resolveAuthSession(cookies);
  if (session) await revokeSupabaseSession(session.accessToken);
  clearAuthSession(cookies);
}
