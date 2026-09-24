import { defineMiddleware } from 'astro:middleware';
import { SUPABASE_SESSION_COOKIE, hasPermission, hasRole, isSupabaseAuthConfigured, verifySupabaseSession } from './lib/adminAuth';
import { firstAccessibleAdminPath, requiredAdminPermission } from './lib/adminPermissions';
import { hasInternalMessagingAccess } from './lib/adminPermissions';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  context.locals.requestId = crypto.randomUUID();
  const isAdminPage = path.startsWith('/admin');
  const isAdminApi = path.startsWith('/api/admin');
  const isPracticePage = path.startsWith('/praktijk');
  const isPracticeApi = path.startsWith('/api/praktijk');
  const isAccountPage = path.startsWith('/account');
  const isAccountApi = path.startsWith('/api/account');
  const isInternalApi = path.startsWith('/api/internal');
  const isCheckoutApi = path === '/api/checkout';
  if (!isAdminPage && !isAdminApi && !isPracticePage && !isPracticeApi && !isAccountPage && !isAccountApi && !isInternalApi && !isCheckoutApi) return next();

  if (path === '/api/admin/login' || path === '/api/admin/logout' || path === '/api/account/login' || path === '/api/account/register' || path === '/api/account/logout' || path === '/api/account/password-reset' || path === '/api/account/verification-resend' || path === '/account/wachtwoord-vergeten' || path === '/account/wachtwoord-herstellen') return next();

  const session = isSupabaseAuthConfigured() ? await verifySupabaseSession(context.cookies.get(SUPABASE_SESSION_COOKIE)?.value) : null;
  if (path === '/admin/login') {
    if (session) {
      const destination = firstAccessibleAdminPath(session.roles);
      if (destination) return context.redirect(destination, 303);
      // A professional session is valid, but it does not grant access to the
      // organisation dashboard. Keep this login page available to show the
      // access error instead of silently sending the user to /praktijk.
    }
    return next();
  }
  if (path === '/praktijk/login') {
    if (session) {
      if (hasRole(session, 'practitioner') && session.practitionerId) return context.redirect('/praktijk', 303);
      // A superadmin without a practitioner profile must not be routed into
      // the practice workspace.
    }
    return next();
  }
  if (path === '/account/inloggen' || path === '/account/aanmaken') {
    if (session?.roles.includes('customer')) return context.redirect('/account', 303);
    return next();
  }

  if (!session) {
    context.cookies.delete(SUPABASE_SESSION_COOKIE, { path: '/' });
    if (isAdminApi || isPracticeApi || isAccountApi || isInternalApi || isCheckoutApi) {
      return new Response(JSON.stringify({ error: 'Niet aangemeld.' }), {
        status: 401,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    const destination = `${path}${context.url.search}`;
    const loginPath = isAccountPage ? '/account/inloggen' : isPracticePage ? '/praktijk/login' : '/admin/login';
    return context.redirect(`${loginPath}?next=${encodeURIComponent(destination)}`, 303);
  }

  const adminPermission = (isAdminPage || isAdminApi) ? requiredAdminPermission(path, context.request.method) : null;
  if ((isAdminPage || isAdminApi) && (!adminPermission || !hasPermission(session, adminPermission))) {
    if (isAdminApi) return new Response(JSON.stringify({ error: 'Geen toegang.' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
    return context.redirect('/admin/login?error=forbidden', 303);
  }
  if (isInternalApi && !hasInternalMessagingAccess(session.roles)) {
    return new Response(JSON.stringify({ error: 'Geen toegang.' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
  if ((isPracticePage || isPracticeApi) && (!hasRole(session, 'practitioner') || !session.practitionerId)) {
    if (isPracticeApi) return new Response(JSON.stringify({ error: 'Geen toegang.' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
    return context.redirect('/praktijk/login?error=forbidden', 303);
  }
  if ((isAccountPage || isAccountApi) && !hasRole(session, 'customer')) {
    if (isAccountApi) return new Response(JSON.stringify({ error: 'Geen toegang.' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
    return context.redirect('/account/inloggen', 303);
  }
  if (isCheckoutApi && !hasRole(session, 'customer')) return new Response(JSON.stringify({ error: 'Geen toegang.' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });

  context.locals.adminUser = session;
  context.locals.currentUser = session;
  return next();
});
