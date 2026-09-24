import type { APIRoute } from 'astro';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';
import { auditActor } from '../../../../lib/securityAudit';
import { markAdminRecurringCostPaid, updateAdminRecurringCost } from '../../../../lib/adminRecurringCosts';

export const prerender = false;

const redirectToSettings = (request: Request, result: string) => {
  const url = new URL('/admin/instellingen', request.url);
  url.searchParams.set('kosten', result);
  url.hash = 'kosten';
  return Response.redirect(url, 303);
};

export const POST: APIRoute = async ({ request, params, locals }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const actor = locals.adminUser;
  if (!actor?.sub) return new Response('Niet aangemeld.', { status: 401 });
  const id = String(params.id || '');
  let form: FormData;
  try { form = await request.formData(); } catch { return redirectToSettings(request, 'invalid'); }

  try {
    const operation = String(form.get('operation') || '');
    if (operation === 'paid') {
      await markAdminRecurringCostPaid({
        id, actorId: actor.sub, requestId: locals.requestId, requestPath: `/api/admin/recurring-costs/${id}`,
        note: String(form.get('note') || '').trim(),
      });
      return redirectToSettings(request, 'paid');
    }
    if (operation === 'update') {
      const amountText = String(form.get('amount') || '').trim().replace(',', '.');
      if (!/^\d+(?:\.\d{1,2})?$/.test(amountText)) return redirectToSettings(request, 'invalid');
      const amount = Number(amountText);
      if (!Number.isFinite(amount)) return redirectToSettings(request, 'invalid');
      await updateAdminRecurringCost({
        id, label: String(form.get('label') || ''), amountCents: Math.round(amount * 100),
        intervalMonths: Number(form.get('interval_months')),
        nextDueOn: String(form.get('next_due_on') || ''),
      }, auditActor(actor, locals.requestId, `/api/admin/recurring-costs/${id}`));
      return redirectToSettings(request, 'updated');
    }
    return redirectToSettings(request, 'invalid');
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return redirectToSettings(request, code === 'not_found' ? 'not-found' : code === 'invalid_input' ? 'invalid' : 'failed');
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
