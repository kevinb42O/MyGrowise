import type { APIRoute } from 'astro';

// Keep unmatched paths inside normal SSR routing. The Vercel adapter's implicit
// fallback forces status 404, even when middleware returns a legacy 301 or 410.
// Known pages still take precedence; middleware handles the legacy map first.
export const ALL: APIRoute = () => new Response('Deze pagina bestaat niet.', {
  status: 404,
  headers: {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex',
  },
});
