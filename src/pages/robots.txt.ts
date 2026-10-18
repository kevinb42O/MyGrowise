import type {APIRoute} from 'astro';
export const GET:APIRoute=()=>new Response(import.meta.env.VERCEL_ENV==='preview'?'User-agent: *\nDisallow: /\n':`User-agent: *
Allow: /
Disallow: /admin
Disallow: /praktijk
Disallow: /account
Disallow: /api/
Disallow: /aankopen
Disallow: /bestellen
Disallow: /berichten
Sitemap: https://mygrowise.be/sitemap.xml
`,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=3600'}});
