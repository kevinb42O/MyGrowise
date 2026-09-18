import type { APIRoute } from 'astro';
import { encodeProductFormFlash, PRODUCT_FLASH_COOKIE, productFlashCookieOptions, updateProduct, validateProductForm } from '../../../../lib/adminProducts';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';

export const prerender = false;

const back = (id: string, requestUrl: URL) => {
  const target = new URL(`/admin/producten/${encodeURIComponent(id)}`, requestUrl);
  return new Response(null, { status: 303, headers: { location: target.pathname + target.search } });
};

export const POST: APIRoute = async ({ request, locals, cookies, params, url }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const id = params.id || '';
  const form = await request.formData();
  const validation = validateProductForm(form);
  if (!validation.value) {
    cookies.set(PRODUCT_FLASH_COOKIE, encodeProductFormFlash(form, Object.values(validation.errors)[0] || 'Controleer de invoer.', id), productFlashCookieOptions());
    return back(id, url);
  }

  try {
    await updateProduct(id, validation.value, locals.adminUser?.email || 'unknown');
    return new Response(null, { status: 303, headers: { location: `/admin/producten/${encodeURIComponent(id)}?saved=1` } });
  } catch (error) {
    if (error instanceof Error && error.message === 'not_found') return new Response('Product niet gevonden.', { status: 404 });
    cookies.set(PRODUCT_FLASH_COOKIE, encodeProductFormFlash(form, error instanceof Error && error.message === 'duplicate_slug' ? 'Deze URL-slug wordt al gebruikt.' : 'Opslaan is niet gelukt. Probeer opnieuw.', id), productFlashCookieOptions());
    return back(id, url);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
