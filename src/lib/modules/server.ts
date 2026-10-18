import {getSupabaseAdmin} from '../supabase/server';
import {listCatalog,publicCatalog, type CatalogProduct, type AdminCatalogProduct} from '../catalog/server';
import {isUuid} from '../catalog/pricing';
import {MODULE_BUCKET, validFileSignature} from './validation';
export type ModuleDetails={product_id:string;number:number;format:'module'|'pdf'|'audio';subtitle:string;tagline:string;introduction:string[];topics:string[];audience_text:string;access_text:string;support_text:string;image_alt:string;current_release_id:string|null;revision:number};
export type ModuleProduct=CatalogProduct & {module:ModuleDetails};
export type ModuleRelease={id:string;product_id:string;status:'draft'|'published';revision:number;created_at:string;published_at:string|null};
export type ModuleAsset={id:string;product_id:string;release_id:string;kind:'pdf'|'audio';track_id:string|null;title:string;sort_order:number;object_path:string;mime:string;byte_size:number;status:'reserved'|'verified';duration_seconds:number|null;module_tracks:{key:string}|null};
const checked=<T>(r:{data:T;error:any}):T=>{if(r.error)throw new Error(r.error.message||'module_unavailable');return r.data;};
export const moduleOrigin=()=>{
 const configured=import.meta.env.PUBLIC_SITE_URL?.trim();
 if(!configured&&import.meta.env.PROD)return null;
 try{const u=new URL(configured||'http://localhost:4321');return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.origin:null;}catch{return null;}
};
export async function publicModules():Promise<ModuleProduct[]> {
 const [catalog,rows]=await Promise.all([publicCatalog(),getSupabaseAdmin().from('module_details').select('*')]);
 const details=checked(rows) as ModuleDetails[];
 return catalog.filter(p=>p.type==='module').flatMap(p=>{const m=details.find(d=>d.product_id===p.id);return m?[{...p,module:m}]:[];}).sort((a,b)=>a.module.number-b.module.number);
}
export async function findModule(slug:string):Promise<{product:any;details:ModuleDetails;canonical:boolean}|null>{
 if(!/^[a-z0-9-]{1,80}$/.test(slug))return null;
 const db=getSupabaseAdmin();let p=checked(await db.from('products').select('id,slug,title,summary,type,status,price_cents').eq('slug',slug).in('type',['module','guide']).maybeSingle());let canonical=true;
 if(!p){const alias=checked(await db.from('catalog_slug_aliases').select('product_id').eq('slug',slug).maybeSingle());if(!alias)return null;p=checked(await db.from('products').select('id,slug,title,summary,type,status,price_cents').eq('id',alias.product_id).in('type',['module','guide']).maybeSingle());canonical=false;}
 if(!p)return null;const details=checked(await db.from('module_details').select('*').eq('product_id',p.id).maybeSingle()) as ModuleDetails|null;
 return details?{product:p,details,canonical}:null;
}
export async function ownedModuleIds(userId:string):Promise<string[]>{
 const rows=checked(await getSupabaseAdmin().from('entitlements').select('product_id,order_items!inner(orders!inner(status))').eq('customer_user_id',userId).in('product_type',['module','guide']).eq('status','active').in('order_items.orders.status',['paid','fulfilled']));
 return (rows||[]).map((x:any)=>x.product_id).filter(Boolean);
}
export async function hasModuleAccess(userId:string,productId:string){return (await ownedModuleIds(userId)).includes(productId);}
export async function moduleAssets(releaseId:string):Promise<ModuleAsset[]>{
 if(!isUuid(releaseId))return [];return checked(await getSupabaseAdmin().from('module_assets').select('*,module_tracks(key)').eq('release_id',releaseId).order('sort_order').order('created_at')) as unknown as ModuleAsset[];
}
export async function ownedModules(userId:string){
 const ids=await ownedModuleIds(userId);if(!ids.length)return [];
 const db=getSupabaseAdmin();const [products,details]=await Promise.all([db.from('products').select('id,slug,title').in('id',ids).eq('type','module'),db.from('module_details').select('*').in('product_id',ids)]);
 const d=checked(details) as ModuleDetails[];return (checked(products)||[]).map((p:any)=>({...p,module:d.find(x=>x.product_id===p.id)}));
}
export async function getModuleAdmin(id:string){
 if(!isUuid(id))return null;const db=getSupabaseAdmin();const [catalog,details,releases]=await Promise.all([listCatalog(true),db.from('module_details').select('*').eq('product_id',id).maybeSingle(),db.from('module_releases').select('*').eq('product_id',id).order('created_at',{ascending:false})]);
 const product=catalog.find(p=>p.id===id&&['module','guide'].includes(p.type));const m=checked(details) as ModuleDetails|null;const rs=checked(releases) as ModuleRelease[];
 if(!product||!m)return null;const draft=rs.find(r=>r.status==='draft')||null;
 const recommendations=checked(await db.from('module_recommendations').select('target_product_id,sort_order').eq('module_product_id',id).order('sort_order'));
 return {product:product as AdminCatalogProduct,module:m,releases:rs,draft,assets:draft?await moduleAssets(draft.id):[],recommendations:recommendations||[],recommendationOptions:catalog.filter(p=>['questionnaire','profile','guide'].includes(p.type)&&p.id!==id)};
}
export async function accessibleModuleAsset(userId:string,productId:string,key?:string,previewRelease?:string):Promise<ModuleAsset|null>{
 const db=getSupabaseAdmin();
 if(previewRelease){
  const role=checked(await db.from('user_roles').select('role').eq('user_id',userId).eq('role','super_admin').maybeSingle());if(!role)return null;
  const r=checked(await db.from('module_releases').select('id').eq('id',previewRelease).eq('product_id',productId).maybeSingle());if(!r)return null;
  return (await moduleAssets(r.id)).find(a=>a.status==='verified'&&(key?a.module_tracks?.key===key:a.kind==='pdf'))||null;
 }
 if(!await hasModuleAccess(userId,productId))return null;
 return publishedModuleAsset(productId,key);
}
/** Resolve published bytes only after a caller has checked its purchase owner. */
export async function publishedModuleAsset(productId:string,key?:string):Promise<ModuleAsset|null>{
 const db=getSupabaseAdmin();
 const m=checked(await db.from('module_details').select('current_release_id').eq('product_id',productId).maybeSingle());if(!m?.current_release_id)return null;
 const active=(await moduleAssets(m.current_release_id)).find(a=>a.status==='verified'&&(key?a.module_tracks?.key===key:a.kind==='pdf'));if(active||!key)return active||null;
 // Older workbooks retain their exercise link even if a newer workbook omits that exercise.
 const releases=checked(await db.from('module_releases').select('id').eq('product_id',productId).eq('status','published').order('published_at',{ascending:false}));
 for(const release of releases||[]){const a=(await moduleAssets(release.id)).find(a=>a.status==='verified'&&a.module_tracks?.key===key);if(a)return a;}
 return null;
}
export async function signedMaterial(asset:ModuleAsset,download=false){
 const seconds=asset.kind==='audio'?Math.min(14400,Math.max(3600,Math.ceil(Number(asset.duration_seconds)||7200)+1800)):300;
 const r=await getSupabaseAdmin().storage.from(MODULE_BUCKET).createSignedUrl(asset.object_path,seconds,download?{download:'MyGrowise-werkboek.pdf'}:undefined);
 if(r.error||!r.data)throw new Error('material_unavailable');return r.data.signedUrl;
}
export async function verifyUploadedAsset(actor:string,assetId:string,productId:string){
 const db=getSupabaseAdmin();const asset=checked(await db.from('module_assets').select('*,module_releases!inner(status)').eq('id',assetId).eq('product_id',productId).maybeSingle());
 if(!asset||asset.module_releases.status!=='draft')throw new Error('invalid_asset');
 const info=await db.storage.from(MODULE_BUCKET).info(asset.object_path);
 if(info.error||!info.data||Number(info.data.size)!==Number(asset.byte_size)||info.data.contentType!==asset.mime)throw new Error('upload_not_complete');
 const url=await db.storage.from(MODULE_BUCKET).createSignedUrl(asset.object_path,60);if(url.error||!url.data)throw new Error('upload_not_complete');
 const response=await fetch(url.data.signedUrl,{headers:{Range:'bytes=0-4095'},signal:AbortSignal.timeout(12000)});
 if(response.status!==206||!response.body)throw new Error('upload_not_complete');
 const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>4096||!validFileSignature(asset.kind,bytes))throw new Error('invalid_file_type');
 checked(await db.rpc('verify_module_asset',{p_actor:actor,p_asset:assetId}));
}
