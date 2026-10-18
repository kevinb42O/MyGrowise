import type {APIRoute} from 'astro';
export const prerender=false;
// The typed planner owns validation and preserves submitted fields on errors.
// Legacy forms must choose an appointment type rather than bypassing that flow.
export const POST:APIRoute=async({redirect})=>redirect('/afspraak',303);
export const ALL:APIRoute=()=>new Response('Methode niet toegestaan.',{status:405});
