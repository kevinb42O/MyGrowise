import type {APIRoute} from 'astro';
import {isTrustedFormOrigin} from '../../../../lib/adminAuth';
import {getSupabaseAdmin} from '../../../../lib/supabase/server';
export const POST:APIRoute=async({request,locals})=>{
 if(!isTrustedFormOrigin(request)||!locals.adminUser?.roles.includes('super_admin'))return new Response('Geen toegang.',{status:403});
 const form=await request.formData();const keys=['mediumMin','mediumPercent','largeMin','largePercent'] as const;const values=Object.fromEntries(keys.map(k=>[k,Number(form.get(k))]));const priceLabel=String(form.get('priceLabel')||'').trim();
 if(keys.some(k=>!Number.isInteger(values[k]))||values.mediumMin<2||values.largeMin<=values.mediumMin||values.largeMin>30||values.mediumPercent<0||values.largePercent<values.mediumPercent||values.largePercent>99||!priceLabel||priceLabel.length>80)return new Response('Controleer de kortingsdrempels en percentages.',{status:400});
 const {error}=await getSupabaseAdmin().rpc('save_catalog_pricing',{p_actor:locals.adminUser.sub,p_data:{...values,priceLabel}});if(error)return new Response('Opslaan mislukt.',{status:503});return Response.redirect(new URL('/admin/vragenlijsten?opgeslagen=1',request.url),303);
};
