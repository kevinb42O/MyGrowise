import type { APIRoute } from 'astro';
import { hasPermission, hasRole, isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { deliverSupportMail } from '../../../../lib/supportMail';
import { getSupabaseAdmin } from '../../../../lib/supabase/server';
export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  if (!isTrustedFormOrigin(request) || !hasPermission(locals.adminUser,'support.write')) return new Response('Geen toegang.',{status:403});
  const form = await request.formData();
  const basePath = form.get('return_to') === 'practice' && hasRole(locals.currentUser, 'practitioner') && locals.currentUser?.practitionerId ? '/praktijk/berichten' : '/admin/berichten';
  await getSupabaseAdmin().from('support_mail_jobs').update({status:'pending',next_attempt_at:new Date().toISOString(),attempts:0}).eq('status','failed');
  try { await deliverSupportMail(20); } catch { /* Queue remains visible. */ }
  return Response.redirect(new URL(`${basePath}?mail_retry=1`,request.url),303);
};
export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
