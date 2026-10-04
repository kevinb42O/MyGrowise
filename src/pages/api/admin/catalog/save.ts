import type {APIRoute} from 'astro';
import {isTrustedFormOrigin} from '../../../../lib/adminAuth';
import {validateCatalogForm} from '../../../../lib/catalog/admin';
import {getSupabaseAdmin} from '../../../../lib/supabase/server';
export const POST:APIRoute=async({request,locals})=>{
 if(!isTrustedFormOrigin(request)||!locals.adminUser?.roles.includes('super_admin'))return new Response('Geen toegang.',{status:403});
 try{const input=validateCatalogForm(await request.formData());const {data,error}=await getSupabaseAdmin().rpc('save_catalog_product',{p_actor:locals.adminUser.sub,p_data:input});if(error)throw new Error(error.message.includes('questionnaire_used_in_package')?'Dit instrument zit in een pakket. Verwijder het daar eerst voordat je het type verandert.':error.code==='23505'||error.message.includes('reserved_catalog_slug')?'Deze URL-slug bestaat al of hoort bij een oude cataloguslink.':error.message.includes('empty_package')?'Kies pakketonderdelen.':'Opslaan mislukt. Controleer de velden en probeer opnieuw.');return Response.redirect(new URL(`/admin/vragenlijsten/${data}?opgeslagen=1`,request.url),303);}catch(e){return new Response(`${e instanceof Error?e.message:'Opslaan mislukt.'}\nGebruik Terug in je browser om je ingevulde gegevens te corrigeren.`,{status:400,headers:{'content-type':'text/plain; charset=utf-8'}});}
};
