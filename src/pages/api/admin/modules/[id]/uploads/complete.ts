import type {APIRoute} from 'astro';
import {requireModuleAdmin,moduleError,moduleJson} from '../../../../../../lib/modules/admin';
import {verifyUploadedAsset} from '../../../../../../lib/modules/server';
import {isUuid} from '../../../../../../lib/catalog/pricing';
export const POST:APIRoute=async context=>{try{const actor=requireModuleAdmin(context);const body=await moduleJson(context.request);if(!isUuid(context.params.id)||!isUuid(body.asset))throw new Error('invalid_asset');await verifyUploadedAsset(actor,body.asset,context.params.id);return Response.json({ok:true},{headers:{'cache-control':'private, no-store'}});}catch(error){return moduleError(error);}};
