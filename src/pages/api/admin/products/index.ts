import type { APIRoute } from 'astro';
import { createProduct, encodeProductFormFlash, PRODUCT_FLASH_COOKIE, productFlashCookieOptions, validateProductForm } from '../../../../lib/adminProducts';
import { isTrustedFormOrigin } from '../../../../lib/adminAuth';

export const prerender = false;

const back = (requestUrl: URL) => {
  const target = new URL('/admin/producten/nieuw', requestUrl);
  return new Response(null, { status: 303, headers: { location: target.pathname + target.search } });
};

export const POST: APIRoute = async ({ request, locals, cookies, url }) => {
  if (!isTrustedFormOrigin(request)) return new Response('Ongeldige aanvraag.', { status: 403 });
  const form = await request.formData();
  const validation = validateProductForm(form);
  if (!validation.value) {
    cookies.set(PRODUCT_FLASH_COOKIE, encodeProductFormFlash(form, Object.values(validation.errors)[0] || 'Controleer de invoer.'), productFlashCookieOptions());
    return back(url);
  }

  try {
    const product = await createProduct(validation.value, locals.adminUser?.email || 'unknown');
    return new Response(null, { status: 303, headers: { location: `/admin/producten/${encodeURIComponent(product.id)}?created=1` } });
  } catch (error) {
    cookies.set(PRODUCT_FLASH_COOKIE, encodeProductFormFlash(form, error instanceof Error && error.message === 'duplicate_slug' ? 'Deze URL-slug wordt al gebruikt.' : 'Opslaan is niet gelukt. Probeer opnieuw.'), productFlashCookieOptions());
    return back(url);
  }
};

export const ALL: APIRoute = () => new Response('Methode niet toegestaan.', { status: 405 });
