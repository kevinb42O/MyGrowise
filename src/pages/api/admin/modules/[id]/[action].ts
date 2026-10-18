import type {APIRoute} from 'astro';
import {requireModuleAdmin,moduleError,moduleJson} from '../../../../../lib/modules/admin';
import {getModuleAdmin,signedMaterial,moduleAssets} from '../../../../../lib/modules/server';
import {getSupabaseAdmin} from '../../../../../lib/supabase/server';
import {validateCatalogForm} from '../../../../../lib/catalog/admin';
import {isUuid} from '../../../../../lib/catalog/pricing';
export const POST:APIRoute=async context=>{
 try{
  const actor=requireModuleAdmin(context);if(!isUuid(context.params.id))throw new Error('invalid_module');
  const current=await getModuleAdmin(context.params.id);if(!current)throw new Error('invalid_module');
  const body=await moduleJson(context.request);const db=getSupabaseAdmin();let result;
  if(context.params.action==='save'){
   const p=current.product;const f=new FormData();
   const defaults={id:p.id,title:p.title,slug:p.slug,type:p.type,status:p.status,summary:p.summary,price:p.priceCents===null?'':(p.priceCents/100).toFixed(2),availability:p.availability,image:p.image,sortOrder:String(p.sortOrder),category:p.category,audience:p.audience,ageLabel:p.ageLabel,version:p.version,description:p.description,includesText:p.includesText,deliveryText:p.deliveryText,reviewNote:p.reviewNote};
   const editable=['title','slug','status','summary','price','availability','image'];
   for(const [key,value] of Object.entries(defaults))f.set(key,editable.includes(key)&&body[key]!==undefined?String(body[key]):String(value??''));
   const catalog=validateCatalogForm(f);
   const data={catalog,subtitle:body.subtitle,tagline:body.tagline,introduction:String(body.introduction||'').split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean),topics:String(body.topics||'').split('\n').map(s=>s.trim()).filter(Boolean),audienceText:body.audienceText||'',accessText:body.accessText||'',supportText:body.supportText||'',imageAlt:body.imageAlt||''};
   result=await db.rpc('save_module',{p_actor:actor,p_id:p.id,p_revision:Number(body.revision),p_data:data});
  }else if(context.params.action==='recommendations'){
   if(!Array.isArray(body.targets)||body.targets.some((id:unknown)=>!isUuid(id)))throw new Error('invalid_module_content');
   result=await db.rpc('save_module_recommendations',{p_actor:actor,p_id:current.product.id,p_revision:Number(body.revision),p_targets:body.targets});
  }else if(context.params.action==='draft'){
   result=await db.rpc('begin_module_release',{p_actor:actor,p_id:current.product.id});
  }else if(context.params.action==='publish'){
   if(!current.draft||body.release!==current.draft.id)throw new Error('revision_conflict');
   result=await db.rpc('publish_module_release',{p_actor:actor,p_release:current.draft.id,p_revision:Number(body.revision),p_checked:body.checked===true});
  }else if(context.params.action==='restore'){
   if(!current.releases.some(r=>r.id===body.release&&r.status==='published'))throw new Error('invalid_module');
   result=await db.rpc('restore_module_release',{p_actor:actor,p_id:current.product.id,p_release:body.release,p_revision:Number(body.revision)});
  }else if(context.params.action==='asset'){
   if(!current.draft||!current.assets.some(a=>a.id===body.asset))throw new Error('invalid_asset');
   result=await db.rpc('edit_module_asset',{p_actor:actor,p_asset:body.asset,p_revision:Number(body.revision),p_title:String(body.title||'').trim(),p_sort:Number(body.sortOrder),p_remove:body.remove===true});
  }else return new Response('Niet gevonden.',{status:404});
  if(result.error)throw new Error(result.error.message);return Response.json({ok:true},{headers:{'cache-control':'private, no-store'}});
 }catch(error){return moduleError(error);}
};
export const GET:APIRoute=async context=>{
 try{
  requireModuleAdmin(context);if(context.params.action!=='material'||!isUuid(context.params.id))return new Response('Niet gevonden.',{status:404});
  const current=await getModuleAdmin(context.params.id);if(!current)return new Response('Niet gevonden.',{status:404});
  const release=context.url.searchParams.get('release');if(!release||!current.releases.some(r=>r.id===release))return new Response('Niet gevonden.',{status:404});
  const asset=(await moduleAssets(release)).find(a=>a.id===context.url.searchParams.get('asset')&&a.status==='verified');if(!asset)return new Response('Bestand nog niet gereed.',{status:404});
  return new Response(null,{status:303,headers:{location:await signedMaterial(asset),'cache-control':'private, no-store','referrer-policy':'no-referrer'}});
 }catch(error){return moduleError(error);}
};
