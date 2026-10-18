import type {APIContext} from 'astro';
import {isTrustedFormOrigin} from '../adminAuth';
export const moduleMessages:Record<string,string>={revision_conflict:'Deze versie is intussen gewijzigd. Herlaad de pagina en probeer opnieuw.',module_incomplete:'Upload en controleer alle vereiste bestanden. Bevestig daarna de materiaalcontrole en eventuele audiolinks.',module_not_ready:'Publiceer eerst volledig gecontroleerd materiaal en vul doelgroep, toegangsduur en ondersteuning in.',invalid_asset:'Controleer bestandstype, grootte, titel, volgorde en audiocode.',invalid_file_type:'Het bestand heeft niet de verwachte PDF- of MP3-inhoud.',upload_not_complete:'De upload is niet compleet of komt niet overeen met het opgegeven bestand.',invalid_module_content:'Controleer de moduleteksten.',forbidden:'Geen toegang.'};
export function requireModuleAdmin(context:APIContext){
 if(!context.locals.adminUser?.roles.includes('super_admin')||context.request.method!=='GET'&&!isTrustedFormOrigin(context.request))throw new Error('forbidden');
 return context.locals.adminUser.sub;
}
export function moduleError(error:unknown){
 const key=error instanceof Error?error.message:'';const known=Object.keys(moduleMessages).find(k=>key.includes(k));
 return Response.json({error:known?moduleMessages[known]:'De wijziging kon niet worden uitgevoerd. Controleer je invoer en probeer opnieuw.'},{status:known==='forbidden'?403:known==='revision_conflict'?409:400,headers:{'cache-control':'private, no-store'}});
}
export async function moduleJson(request:Request){
 if(Number(request.headers.get('content-length')||0)>65536)throw new Error('invalid_module_content');
 const text=await request.text();if(text.length>65536)throw new Error('invalid_module_content');const value=JSON.parse(text);
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid_module_content');return value as Record<string,any>;
}
