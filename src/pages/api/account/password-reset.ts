import type { APIRoute } from 'astro';
import { isTrustedFormOrigin, requestSupabasePasswordReset, sanitizeAppRedirect } from '../../../lib/adminAuth';

type Attempt = { count: number; resetAt: number }; const attempts = new Map<string, Attempt>();
export const prerender = false;
export const POST: APIRoute = async ({ request }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData(); const email = String(form.get('email') || '').trim().toLowerCase(); const key = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'; const now = Date.now(); const previous = attempts.get(key);
  const next=sanitizeAppRedirect(form.get('next'))||'/account';
  const destination=(query:string)=>{const url=new URL(`/account/wachtwoord-vergeten?${query}`,request.url);url.searchParams.set('next',next);return url;};
  const recovery=new URL('/account/wachtwoord-herstellen',request.url);recovery.searchParams.set('next',next);
  if (previous && previous.resetAt > now && previous.count >= 5) return Response.redirect(destination('error=rate_limited'), 303);
  try { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('invalid'); await requestSupabasePasswordReset(email, recovery.toString()); attempts.delete(key); }
  catch { attempts.set(key, { count: (previous?.count || 0) + 1, resetAt: previous?.resetAt && previous.resetAt > now ? previous.resetAt : now + 15 * 60 * 1000 }); }
  // Do not disclose whether this address has an account.
  return Response.redirect(destination('sent=1'), 303);
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
