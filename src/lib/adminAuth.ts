import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase/server';
import { hasAdminPermission, isUserRole, type AdminPermission, type UserRole } from './adminPermissions';

export const SUPABASE_SESSION_COOKIE = 'mg_session';
export const SESSION_TTL_SECONDS = 60 * 60;
export type { UserRole } from './adminPermissions';
export type UserSession = {
  sub: string; email: string; name: string; roles: UserRole[]; practitionerId: string | null;
  emailConfirmed: boolean; issuedAt: number; expiresAt: number;
};

const configured = () => Boolean(import.meta.env.PUBLIC_SUPABASE_URL?.trim() && import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() && import.meta.env.SUPABASE_SECRET_KEY?.trim());
export const isSupabaseAuthConfigured = configured;
export const hasRole = (session: UserSession | null | undefined, role: UserRole) => Boolean(session?.roles.includes(role));
export const isCustomerAccount = (session: UserSession | null | undefined) =>
  Boolean(session && session.roles.includes('customer') && !session.roles.some((role) => ['super_admin', 'support', 'employee', 'practitioner'].includes(role)));
export const hasPermission = (session: UserSession | null | undefined, permission: AdminPermission) =>
  Boolean(session && hasAdminPermission(session.roles, permission));
export const supabaseSessionCookieOptions = () => ({ httpOnly: true, secure: import.meta.env.PROD, sameSite: 'strict' as const, path: '/', maxAge: SESSION_TTL_SECONDS });
const trustedAppOrigins = new Set(['https://mygrowise.be', 'https://www.mygrowise.be', 'https://mygrowise.vercel.app']);
export const isTrustedFormOrigin = (request: Request) => {
  const originHeader = request.headers.get('origin');
  if (!originHeader) return true;
  // Chrome may send Origin: null for a native form navigation even when its
  // browser-controlled Fetch Metadata identifies the request as same-origin.
  // Cross-site and sandboxed requests remain rejected.
  if (originHeader === 'null') return request.headers.get('sec-fetch-site') === 'same-origin';

  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    return false;
  }
  if (originHeader !== origin.origin) return false;
  if (trustedAppOrigins.has(origin.origin)) return true;
  return import.meta.env.DEV && origin.origin === new URL(request.url).origin;
};
export const sanitizeAppRedirect = (value: unknown) => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) return '';
  let target: URL;
  try { target = new URL(value, 'https://mygrowise.invalid'); } catch { return ''; }
  if (target.origin !== 'https://mygrowise.invalid') return '';
  const path = target.pathname;
  if (path === '/account/inloggen' || path === '/account/aanmaken') return '';
  if (path === '/admin' || path.startsWith('/admin/') || path === '/praktijk' || path.startsWith('/praktijk/')) return `${path}${target.search}`;
  if (path === '/account' || path.startsWith('/account/')) return `${path}${target.search}`;
  if (/^\/aanbod\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)) return `${path}${target.search}`;
  if (/^\/begeleiding\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)) return path;
  return '';
};

const toSession = async (user: { id: string; email?: string | null; email_confirmed_at?: string | null; user_metadata?: Record<string, unknown>; banned_until?: string | null }, expiresAt?: number): Promise<UserSession | null> => {
  if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) return null;
  const client = getSupabaseAdmin();
  const [{ data: roleRows, error: roleError }, { data: practitioner, error: practitionerError }] = await Promise.all([
    client.from('user_roles').select('role').eq('user_id', user.id),
    client.from('practitioners').select('id').eq('user_id', user.id).maybeSingle(),
  ]);
  if (roleError || practitionerError) return null;
  const roles = (roleRows || []).map((row: { role: string }) => row.role).filter(isUserRole);
  if (!roles.length) return null;
  const now = Math.floor(Date.now() / 1000);
  return { sub: user.id, email: user.email || '', name: String(user.user_metadata?.full_name || user.email || 'MyGrowise'), roles, practitionerId: practitioner?.id || null, emailConfirmed: Boolean(user.email_confirmed_at), issuedAt: now, expiresAt: expiresAt || now + SESSION_TTL_SECONDS };
};

const publicAuthClient = () => {
  const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim(); const publishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) throw new Error('Supabase authentication is not configured.');
  return createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
};

export const authenticateSupabaseUser = async (email: string, password: string, recordAudit = true, requestId?: string) => {
  if (!configured()) return null;
  const { data, error } = await publicAuthClient().auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) return null;
  const user = await toSession(data.user, data.session.expires_at);
  if (user && recordAudit) await getSupabaseAdmin().from('security_audit_log').insert({ actor_user_id: user.sub, action: 'account.login', object_type: 'user', object_id: user.sub, request_id: requestId || null, metadata: { surface: user.roles.some((role) => role !== 'customer') ? 'staff' : 'account' } });
  return user ? { user, accessToken: data.session.access_token } : null;
};

export const registerSupabaseCustomer = async (name: string, email: string, password: string, emailRedirectTo: string) => {
  if (!configured()) throw new Error('configuration');
  if (name.trim().length < 2 || name.trim().length > 120 || password.length < 12 || password.length > 256) throw new Error('invalid');
  const { data, error } = await publicAuthClient().auth.signUp({ email, password, options: { data: { full_name: name.trim().replace(/\s+/g, ' ') }, emailRedirectTo } });
  if (error || !data.user) {
    if (error?.message.toLowerCase().includes('already') || error?.code === 'email_exists' || error?.code === 'user_already_exists') throw new Error('email_taken');
    if (error) {
      // Keep PII and provider response text out of logs; status/code are enough to diagnose Auth failures.
      console.error('[account.register] Supabase signup failed', { status: error.status ?? null, code: error.code ?? null });
      if (error.code === 'email_address_invalid' || error.code === 'validation_failed' || error.code === 'weak_password') throw new Error('invalid');
    }
    throw new Error('signup_unavailable');
  }
  if (!data.session) return { confirmationRequired: true as const };
  const user = await toSession(data.user, data.session.expires_at);
  return user ? { confirmationRequired: false as const, user, accessToken: data.session.access_token } : { confirmationRequired: true as const };
};

export const resendSupabaseCustomerConfirmation = async (email: string, emailRedirectTo: string) => {
  if (!configured()) throw new Error('configuration');
  const { error } = await publicAuthClient().auth.resend({ type: 'signup', email, options: { emailRedirectTo } });
  if (error) throw error;
};

export const verifySupabaseSession = async (token?: string): Promise<UserSession | null> => {
  if (!token || !configured()) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return toSession(data.user);
};

export const verifyCurrentPassword = async (email: string, password: string) => Boolean(await authenticateSupabaseUser(email, password, false));
export const requestSupabasePasswordReset = async (email: string, redirectTo: string) => {
  if (!configured()) throw new Error('configuration');
  const { error } = await publicAuthClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
};
