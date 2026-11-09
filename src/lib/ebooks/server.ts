import type {AstroCookies} from 'astro';
import {createHmac} from 'node:crypto';
import {getSupabaseAdmin} from '../supabase/server';
import {digest,tokenValid,hasPurchase,purchaseOrders,type PurchaseOwner} from '../commerce/purchases';
import {BOOK_SLUG,BOOK_LIBRARY_PATH} from './book';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function normalizeBookCode(value:unknown):string|null {
 if(typeof value!=='string'||value.length>100)return null;
 const code=value.toUpperCase().replace(/[\s-]/g,'');
 return /^FIEN[A-HJ-NP-Z2-9]{20}$/.test(code)?code:null;
}
/** Stable per purchase, so a mail retry never creates another usable code. */
export function bookCode(orderItemId:string,key=import.meta.env.EBOOK_ACCESS_SECRET):string {
 if(!key||key.length<43)throw new Error('ebook_access_not_configured');
 const bytes=createHmac('sha256',key).update(`ebook-activation-v1:${orderItemId}`).digest();
 const value=Array.from(bytes.subarray(0,20),byte=>alphabet[byte&31]).join('');
 return 'FIEN-'+value.match(/.{4}/g)!.join('-');
}
export async function issueBookCode(orderItemId:string){
 const code=bookCode(orderItemId);const hash=digest(normalizeBookCode(code)!);
 const {error}=await getSupabaseAdmin().rpc('ensure_ebook_license',{p_item:orderItemId,p_hash:hash});
 if(error)throw new Error('ebook_access_unavailable');return code;
}
export async function ebookProduct(){
 const {data,error}=await getSupabaseAdmin().from('products').select('id,slug,title').eq('slug',BOOK_SLUG).eq('type','guide').maybeSingle();
 if(error)throw new Error('ebook_unavailable');return data;
}
export async function ebookActivated(owner:PurchaseOwner,productId:string){
 if(!await hasPurchase(owner,productId))return false;
 const orders=(await purchaseOrders(owner)).filter(o=>['paid','fulfilled'].includes(o.status)).map(o=>o.id);
 if(!orders.length)return false;
 const {data,error}=await getSupabaseAdmin().from('ebook_licenses').select('order_item_id,order_items!inner(order_id,product_id)').in('order_items.order_id',orders).eq('order_items.product_id',productId).not('activated_at','is',null).limit(1);
 if(error)throw new Error('ebook_unavailable');return Boolean(data?.length);
}
export async function ebookDownload(productId:string,format:'pdf'|'epub',download=true){
 const db=getSupabaseAdmin();const {data:file,error}=await db.from('ebook_files').select('bucket,object_path,filename').eq('product_id',productId).eq('format',format).maybeSingle();
 if(error||!file)throw new Error('ebook_file_unavailable');
 const {data,error:signError}=await db.storage.from(file.bucket).createSignedUrl(file.object_path,60,download?{download:file.filename}:undefined);
 if(signError||!data)throw new Error('ebook_file_unavailable');return data.signedUrl;
}
export const ebookDestination=(slug:string)=>slug===BOOK_SLUG?BOOK_LIBRARY_PATH:'/aankopen';

export const BOOK_SESSION_COOKIE = 'mg_ebook';
export async function hasBookSession(cookies:AstroCookies,productId:string){
 const session=cookies.get(BOOK_SESSION_COOKIE)?.value;
 if(!tokenValid(session))return false;
 const db=getSupabaseAdmin();
 const {data,error}=await db.from('ebook_sessions').select('order_item_id')
  .eq('session_hash',digest(session)).gt('expires_at',new Date().toISOString()).maybeSingle();
 if(error)throw new Error('ebook_unavailable');
 if(!data)return false;
 const {data:right,error:accessError}=await db.from('entitlements')
  .select('id,order_items!inner(orders!inner(status))')
  .eq('order_item_id',data.order_item_id).eq('product_id',productId).eq('status','active')
  .in('order_items.orders.status',['paid','fulfilled']).limit(1);
 if(accessError)throw new Error('ebook_unavailable');
 return Boolean(right?.length);
}
