import { defineMiddleware } from 'astro:middleware';
import { ADMIN_COOKIE, CUSTOMER_COOKIE, SUPABASE_ADMIN_COOKIE, hasRole, isSupabaseAdminAuthEnabled, verifySupabaseAdminSession, verifyUserSession } from './lib/adminAuth';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const isAdminPage = path.startsWith('/admin');
  const isAdminApi = path.startsWith('/api/admin');
  const isPracticePage = path.startsWith('/praktijk');
  const isPracticeApi = path.startsWith('/api/praktijk');
  const isAccountPage = path.startsWith('/account');
  const isAccountApi = path.startsWith('/api/account');
  if (!isAdminPage && !isAdminApi && !isPracticePage && !isPracticeApi && !isAccountPage && !isAccountApi) return next();

  if (path === '/api/admin/login' || path === '/api/admin/logout' || path === '/api/account/login' || path === '/api/account/register' || path === '/api/account/logout') return next();

  // Staff and customers deliberately use separate cookies. A customer login must never
  // replace a professional's active session on the same browser.
  const localStaffSession = verifyUserSession(context.cookies.get(ADMIN_COOKIE)?.value);
  // The Supabase session protects only the organisation dashboard. Practice routes
  // intentionally keep their existing local session until their own account migration.
  const supabaseAdminSession = (isAdminPage || isAdminApi || path === '/admin/login') && isSupabaseAdminAuthEnabled()
    ? await verifySupabaseAdminSession(context.cookies.get(SUPABASE_ADMIN_COOKIE)?.value)
    : null;
  const isSupabaseProtectedAdminRoute = (isAdminPage || isAdminApi || path === '/admin/login') && isSupabaseAdminAuthEnabled();
  const staffSession = isSupabaseProtectedAdminRoute ? supabaseAdminSession : localStaffSession;
  const customerSession = verifyUserSession(context.cookies.get(CUSTOMER_COOKIE)?.value);
  const staffHome = () => {
    if (hasRole(staffSession, 'super_admin')) return '/admin';
    if (hasRole(staffSession, 'practitioner') && staffSession?.practitionerId) return '/praktijk';
    return '';
  };
  if (path === '/admin/login') {
    if (staffSession) {
      if (hasRole(staffSession, 'super_admin')) return context.redirect('/admin', 303);
      // A professional session is valid, but it does not grant access to the
      // organisation dashboard. Keep this login page available to show the
      // access error instead of silently sending the user to /praktijk.
    }
    return next();
  }
  if (path === '/praktijk/login') {
    if (staffSession) {
      if (hasRole(staffSession, 'practitioner') && staffSession.practitionerId) return context.redirect('/praktijk', 303);
      // A superadmin without a practitioner profile must not be routed into
      // the practice workspace.
    }
    return next();
  }
  if (path === '/account/inloggen' || path === '/account/aanmaken') {
    if (customerSession?.roles.includes('customer')) return context.redirect('/account', 303);
    return next();
  }

  const isCustomerRoute = isAccountPage || isAccountApi;
  const session = isCustomerRoute ? customerSession : staffSession;
  const activeCookie = isCustomerRoute ? CUSTOMER_COOKIE : (isAdminPage || isAdminApi) && isSupabaseAdminAuthEnabled() ? SUPABASE_ADMIN_COOKIE : ADMIN_COOKIE;
  if (!session) {
    context.cookies.delete(activeCookie, { path: '/' });
    if (isAdminApi || isPracticeApi || isAccountApi) {
      return new Response(JSON.stringify({ error: 'Niet aangemeld.' }), {
        status: 401,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    const destination = `${path}${context.url.search}`;
    const loginPath = isAccountPage ? '/account/inloggen' : isPracticePage ? '/praktijk/login' : '/admin/login';
    return context.redirect(`${loginPath}?next=${encodeURIComponent(destination)}`, 303);
  }

  if ((isAdminPage || isAdminApi) && !hasRole(session, 'super_admin')) {
    if (isAdminApi) return new Response(JSON.stringify({ error: 'Geen toegang.' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
    return context.redirect('/admin/login?error=forbidden', 303);
  }
  if ((isPracticePage || isPracticeApi) && (!hasRole(session, 'practitioner') || !session.practitionerId)) {
    if (isPracticeApi) return new Response(JSON.stringify({ error: 'Geen toegang.' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
    return context.redirect('/praktijk/login?error=forbidden', 303);
  }
  if ((isAccountPage || isAccountApi) && !hasRole(session, 'customer')) {
    if (isAccountApi) return new Response(JSON.stringify({ error: 'Geen toegang.' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
    return context.redirect('/account/inloggen', 303);
  }

  context.locals.adminUser = session;
  context.locals.currentUser = session;
  return next();
});
