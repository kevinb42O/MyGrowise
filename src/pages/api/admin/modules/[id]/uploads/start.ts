import type {APIRoute} from 'astro';
import {requireModuleAdmin,moduleError,moduleJson} from '../../../../../../lib/modules/admin';
import {getModuleAdmin,type ModuleAsset} from '../../../../../../lib/modules/server';
import {validateUpload,MODULE_BUCKET} from '../../../../../../lib/modules/validation';
import {getSupabaseAdmin} from '../../../../../../lib/supabase/server';
export const POST:APIRoute=async context=>{
 try{
  const actor=requireModuleAdmin(context);const current=await getModuleAdmin(context.params.id||'');if(!current?.draft)throw new Error('invalid_asset');
  const body=await moduleJson(context.request);const a=validateUpload(body);const db=getSupabaseAdmin();
  const {data,error}=await db.rpc('reserve_module_asset',{p_actor:actor,p_release:current.draft.id,p_revision:Number(body.revision),p_kind:a.kind,p_key:a.key,p_title:a.title,p_size:a.size,p_sort:a.sort}).single<ModuleAsset>();if(error)throw new Error(error.message);
  const signed=await db.storage.from(MODULE_BUCKET).createSignedUploadUrl(data.object_path,{upsert:false});if(signed.error||!signed.data)throw new Error('upload_not_complete');
  const origin=new URL(import.meta.env.PUBLIC_SUPABASE_URL!);if(origin.hostname.endsWith('.supabase.co'))origin.hostname=origin.hostname.replace('.supabase.co','.storage.supabase.co');
  return Response.json({asset:data.id,token:signed.data.token,path:data.object_path,bucket:MODULE_BUCKET,endpoint:origin.origin+'/storage/v1/upload/resumable/sign',publishableKey:import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,mime:data.mime},{headers:{'cache-control':'private, no-store'}});
 }catch(error){return moduleError(error);}
};
