import {createHash,randomBytes} from 'node:crypto';
import type {AstroCookies} from 'astro';
import type {UserSession} from '../adminAuth';
import {isCustomerAccount} from '../adminAuth';
import {getSupabaseAdmin} from '../supabase/server';
import {isUuid} from '../catalog/pricing';
export const PURCHASE_COOKIE='mg_purchase';
export const CHECKOUT_COOKIE='mg_checkout';
export const secret=()=>randomBytes(32).toString('base64url');
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const tokenValid=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
export const privateHeaders={'cache-control':'private, no-store','referrer-policy':'no-referrer'};
export const purchaseCookieOptions=(secure:boolean)=>({httpOnly:true,secure,sameSite:'lax' as const,path:'/',maxAge:7*86400});
export function purchaseNext(value:unknown){
 if(typeof value!=='string'||value.includes('\\')||/[\x00-\x1f]/.test(value))return '/aankopen';
 try{const u=new URL(value,'https://mygrowise.invalid');return u.origin==='https://mygrowise.invalid'&&(u.pathname==='/aankopen'||u.pathname.startsWith('/aankopen/')||u.pathname==='/bestellen')&&!u.pathname.startsWith('/aankopen/toegang')?u.pathname+u.search:'/aankopen';}catch{return '/aankopen';}
}
export function parseBuyer(form:FormData){
 const get=(key:string,max:number)=>{const value=String(form.get(key)||'').trim();if(value.length>max||/[\r\n\x00]/.test(value))throw new Error('invalid_contact');return value;};
 const email=get('email',254).toLowerCase(),first_name=get('first_name',60),last_name=get('last_name',60),birth_date=get('birth_date',10),gender=get('gender',20);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!first_name||!last_name||!/^\d{4}-\d{2}-\d{2}$/.test(birth_date)||!Number.isFinite(Date.parse(birth_date))||new Date(birth_date).toISOString().slice(0,10)!==birth_date||birth_date>today||!['male','female','other','unspecified'].includes(gender))throw new Error('invalid_contact');
 const participant=get('participant',20);if(!['self','child'].includes(participant))throw new Error('invalid_contact');
 return {email,first_name,last_name,birth_date,gender,participant};
}
export type PurchaseOwner={userId?:string;email?:string};
export async function guestEmail(cookies:AstroCookies){
 const token=cookies.get(PURCHASE_COOKIE)?.value;if(!tokenValid(token))return null;
 const {data,error}=await getSupabaseAdmin().from('commerce_sessions').select('email').eq('session_hash',digest(token)).gt('expires_at',new Date().toISOString()).maybeSingle();
 if(error)throw new Error('purchase_unavailable');return data?.email||null;
}
export async function purchaseOwner(cookies:AstroCookies,user?:UserSession|null):Promise<PurchaseOwner|null>{
 const email=await guestEmail(cookies);
 if(email)return {email};
 return isCustomerAccount(user)&&user!.emailConfirmed?{userId:user!.sub}:null;
}
export async function buyerIds(owner:PurchaseOwner){
 let q=getSupabaseAdmin().from('commerce_buyers').select('id');q=owner.userId?q.eq('customer_user_id',owner.userId):q.eq('email',owner.email||'');
 const {data,error}=await q;if(error)throw new Error('purchase_unavailable');return (data||[]).map(b=>b.id as string);
}
export async function purchaseOrders(owner:PurchaseOwner){
 const db=getSupabaseAdmin(),columns='id,status,total_cents,currency,provider_reference,created_at,order_items(product_title,product_type,product_id)';
 if(owner.userId){const {data,error}=await db.from('orders').select(columns).eq('customer_user_id',owner.userId).order('created_at',{ascending:false});if(error)throw new Error('purchase_unavailable');return data||[];}
 // New order contacts are immutable snapshots. An account's current address
 // must not change which orders an independently verified email can open.
 const ids=await buyerIds(owner);
 const results=await Promise.all([db.from('orders').select(columns).eq('contact_snapshot->>email',owner.email||''),ids.length?db.from('orders').select(columns).in('buyer_id',ids).eq('contact_snapshot','{}'):Promise.resolve({data:[],error:null})]);
 if(results.some(r=>r.error))throw new Error('purchase_unavailable');
 return [...new Map(results.flatMap(r=>r.data||[]).map(o=>[o.id,o])).values()].sort((a,b)=>b.created_at.localeCompare(a.created_at));
}
export async function purchaseOrder(id:string,cookies:AstroCookies,user?:UserSession|null){
 if(!isUuid(id))return null;
 const {data,error}=await getSupabaseAdmin().from('orders').select('id,buyer_id,customer_user_id,checkout_hash,contact_snapshot,status,total_cents,currency,provider_reference,order_items(product_title,price_cents,product_type,product_id)').eq('id',id).maybeSingle();
 if(error)throw new Error('purchase_unavailable');if(!data)return null;
 if(isCustomerAccount(user)&&data.customer_user_id===user!.sub)return data;
 const checkout=cookies.get(CHECKOUT_COOKIE)?.value;
 if(tokenValid(checkout)&&data.checkout_hash===digest(checkout))return data;
 const owner=await purchaseOwner(cookies,user);if(owner&&(await purchaseOrders(owner)).some(o=>o.id===data.id))return data;
 return null;
}
export async function purchasedProducts(owner:PurchaseOwner){
 const ids=(await purchaseOrders(owner)).map(o=>o.id);if(!ids.length)return [];
 const {data,error}=await getSupabaseAdmin().from('entitlements').select('product_id,product_type,product_title,product_slug,order_items!inner(orders!inner(status))').in('order_items.order_id',ids).eq('status','active').in('order_items.orders.status',['paid','fulfilled']);
 if(error)throw new Error('purchase_unavailable');return data||[];
}
export async function hasPurchase(owner:PurchaseOwner,productId:string){return (await purchasedProducts(owner)).some(p=>p.product_id===productId);}
export async function purchaseDeliveries(owner:PurchaseOwner){
 const ids=(await purchaseOrders(owner)).map(o=>o.id);if(!ids.length)return [];
 const {data,error}=await getSupabaseAdmin().from('assessment_deliveries').select('id,title,status,instructions,external_url,report_path,order_items!inner(orders!inner(status))').in('order_items.order_id',ids).in('order_items.orders.status',['paid','fulfilled']).order('created_at',{ascending:false});
 if(error)throw new Error('purchase_unavailable');return data||[];
}
export async function makePurchaseLink(email:string,next='/aankopen'){
 const token=secret();const {error}=await getSupabaseAdmin().from('commerce_access_tokens').insert({token_hash:digest(token),email,expires_at:new Date(Date.now()+30*60000).toISOString()});if(error)throw new Error('access_unavailable');
 const configured=import.meta.env.PUBLIC_SITE_URL?.trim();if(import.meta.env.PROD&&!configured)throw new Error('origin_unavailable');
 const origin=new URL(configured||'http://localhost:4321').origin;
 return `${origin}/aankopen/toegang#token=${encodeURIComponent(token)}&next=${encodeURIComponent(purchaseNext(next))}`;
}
