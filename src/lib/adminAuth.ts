import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getUserByEmail, getUserById, recordUserLogin, type LocalUser, type UserRole } from './practiceDb';

export const ADMIN_COOKIE = 'mg_admin_session';
export const CUSTOMER_COOKIE = 'mg_customer_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export type UserSession = {
  sub: string; email: string; name: string; roles: UserRole[]; practitionerId: string | null;
  sessionVersion: number; issuedAt: number; expiresAt: number; nonce: string;
};

const sessionSecret = () => String(import.meta.env.ADMIN_SESSION_SECRET || '').trim();
export const isAdminAuthConfigured = () => sessionSecret().length >= 64;
const safeEqual = (left: Buffer, right: Buffer) => left.length === right.length && timingSafeEqual(left, right);

export const authenticateUser = (email: string, password: string): LocalUser | null => {
  if (!isAdminAuthConfigured()) return null;
  const user = getUserByEmail(email.trim().toLowerCase());
  if (!user || !user.active) {
    scryptSync(password, '00000000000000000000000000000000', 64);
    return null;
  }
  try {
    const suppliedHash = scryptSync(password, user.passwordSalt, 64);
    if (!safeEqual(suppliedHash, Buffer.from(user.passwordHash, 'hex'))) return null;
    recordUserLogin(user.id);
    return user;
  } catch {
    return null;
  }
};

export const verifyUserPassword = (user: LocalUser, password: string) => {
  if (!password || password.length > 256) return false;
  try { return safeEqual(scryptSync(password, user.passwordSalt, 64), Buffer.from(user.passwordHash, 'hex')); } catch { return false; }
};

export const createPasswordCredential = (password: string) => {
  if (password.length < 12 || password.length > 256) throw new Error('weak_password');
  const salt = randomBytes(32).toString('hex');
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
};

const sign = (payload: string) => createHmac('sha256', sessionSecret()).update(payload).digest('base64url');

export const createUserSession = (user: LocalUser): string => {
  if (!isAdminAuthConfigured()) throw new Error('Authentication is not configured.');
  const now = Math.floor(Date.now() / 1000);
  const payload: UserSession = { sub: user.id, email: user.email, name: user.name, roles: user.roles, practitionerId: user.practitionerId, sessionVersion: user.sessionVersion, issuedAt: now, expiresAt: now + SESSION_TTL_SECONDS, nonce: randomBytes(16).toString('hex') };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
};

export const verifyUserSession = (token?: string): UserSession | null => {
  if (!token || !isAdminAuthConfigured()) return null;
  const [encoded, suppliedSignature, extra] = token.split('.');
  if (!encoded || !suppliedSignature || extra || !safeEqual(Buffer.from(suppliedSignature), Buffer.from(sign(encoded)))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as UserSession;
    const user = getUserById(payload.sub);
    const now = Math.floor(Date.now() / 1000);
    if (!user || !user.active || user.sessionVersion !== payload.sessionVersion || payload.expiresAt <= now || payload.issuedAt > now + 60 || payload.expiresAt - payload.issuedAt > SESSION_TTL_SECONDS) return null;
    return { ...payload, email: user.email, name: user.name, roles: user.roles, practitionerId: user.practitionerId };
  } catch {
    return null;
  }
};

export const hasRole = (session: UserSession | null, role: UserRole) => Boolean(session?.roles.includes(role));
export const adminCookieOptions = () => ({ httpOnly: true, secure: import.meta.env.PROD, sameSite: 'strict' as const, path: '/', maxAge: SESSION_TTL_SECONDS });
export const isTrustedFormOrigin = (request: Request) => !request.headers.get('origin') || request.headers.get('origin') === new URL(request.url).origin;
export const sanitizeAppRedirect = (value: FormDataEntryValue | null) => typeof value === 'string' && (value.startsWith('/admin') || value.startsWith('/praktijk') || value.startsWith('/account')) && !value.startsWith('//') && !value.includes('/inloggen') && !value.includes('/login') ? value : '';
