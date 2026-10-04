import { getSupabaseAdmin } from '../supabase/server';
import { defaultPricing, type PricingSettings, isUuid } from './pricing';
export type CatalogComponent = { id: string | null; key?: string; title: string; sortOrder?: number };
export type CatalogProduct = {
 id: string; slug: string; title: string; type: 'questionnaire' | 'profile'; status: string; summary: string; priceCents: number | null;
 category: string; audience: string; ageLabel: string; version: string; availability: 'available' | 'upcoming' | 'paused';
 description: string; includesText: string; deliveryText: string; image: string; sortOrder: number; components: CatalogComponent[];
};
export type AdminCatalogProduct = CatalogProduct & { reviewNote: string; costCents: number | null; costNote: string };
export type CatalogQuote = { mode: 'package' | 'custom'; items: (CatalogProduct & { listPriceCents: number; priceCents: number; revision: string })[]; subtotalCents: number; discountPercent: number; discountCents: number; totalCents: number; currency: string; hash: string };
const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'catalog_unavailable'); };
const base = 'id,slug,title,type,status,summary,price_cents';
const publicDetails = 'product_id,category,audience,age_label,version,availability,description,includes_text,delivery_text,image,sort_order';
export async function listCatalog(admin = false): Promise<AdminCatalogProduct[]> {
 const db = getSupabaseAdmin();
 let query = db.from('products').select(base).in('type', ['profile', 'questionnaire']);
 if (!admin) query = query.eq('status', 'published');
 const results = await Promise.all([query, db.from('catalog_details').select(admin ? `${publicDetails},review_note` : publicDetails), db.from('catalog_components').select('id,package_id,questionnaire_id,label,sort_order').order('sort_order'), admin ? db.from('catalog_costs').select('product_id,publisher_cost_cents,cost_note') : Promise.resolve({ data: [], error: null })]);
 results.forEach(x => fail(x.error));
 const [products, details, components, costs] = results.map(x => x.data || []);
 return products.flatMap((p: any) => {
  const d: any = details.find((x: any) => x.product_id === p.id) || (admin ? {category:'',audience:'',age_label:'',version:'',availability:'paused',description:p.summary,includes_text:'',delivery_text:'',review_note:'Catalogusgegevens nog in te stellen.',image:'/images/editorial/mygrowise-50.jpg',sort_order:100} : null); if (!d) return [];
  const c: any = costs.find((x: any) => x.product_id === p.id);
  const result: AdminCatalogProduct = { id:p.id,slug:p.slug,title:p.title,type:p.type,status:p.status,summary:p.summary,priceCents:p.price_cents,category:d.category,audience:d.audience,ageLabel:d.age_label,version:d.version,availability:d.availability,description:d.description,includesText:d.includes_text,deliveryText:d.delivery_text,image:d.image,sortOrder:d.sort_order,components:components.filter((x: any)=>x.package_id===p.id).map((x: any)=>({id:x.questionnaire_id,key:x.id,title:x.label,sortOrder:x.sort_order})),reviewNote:admin ? d.review_note : '',costCents:admin ? c?.publisher_cost_cents ?? null : null,costNote:admin ? c?.cost_note || '' : '' };
  return [result];
 }).sort((a,b)=>a.sortOrder-b.sortOrder || a.title.localeCompare(b.title,'nl'));
}
/** Only this safe shape is serialized to browser islands. */
export async function publicCatalog(): Promise<CatalogProduct[]> { return (await listCatalog()).map(({ reviewNote, costCents, costNote, ...product }) => ({...product,availability: product.availability==='available' && (product.priceCents===null||product.priceCents<=0) ? 'paused' as const : product.availability})); }
export async function getPricing(): Promise<PricingSettings> { const {data,error}=await getSupabaseAdmin().from('catalog_pricing').select('medium_min,medium_percent,large_min,large_percent,price_label').eq('id',true).single(); fail(error); return data ? { mediumMin:data.medium_min,mediumPercent:data.medium_percent,largeMin:data.large_min,largePercent:data.large_percent,priceLabel:data.price_label } : defaultPricing; }
export async function quoteCatalog(ids: string[], mode: string): Promise<CatalogQuote> { if (!Array.isArray(ids) || ids.some(x=>!isUuid(x)) || !['package','custom'].includes(mode)) throw new Error('invalid_selection'); const {data,error}=await getSupabaseAdmin().rpc('catalog_quote',{p_ids:ids,p_mode:mode}); fail(error); return data as CatalogQuote; }
export type Delivery = { id:string; title:string; status:string; instructions:string; external_url:string; report_path:string|null; customer_user_id:string; order_item_id:string; created_at:string; order_items:any };
export async function listDeliveries(customerId?: string): Promise<Delivery[]> { let q=getSupabaseAdmin().from('assessment_deliveries').select('*,order_items!inner(product_title,order_id,orders!inner(status,provider_reference))').order('created_at',{ascending:false}); if(customerId) q=q.eq('customer_user_id',customerId).in('order_items.orders.status',['paid','fulfilled']); const {data,error}=await q;fail(error); return (data||[]) as Delivery[]; }
export async function getDelivery(id:string,customerId?:string): Promise<Delivery|null> { if(!isUuid(id))return null;let q=getSupabaseAdmin().from('assessment_deliveries').select('*,order_items!inner(product_title,order_id,orders!inner(status,provider_reference))').eq('id',id);if(customerId)q=q.eq('customer_user_id',customerId).in('order_items.orders.status',['paid','fulfilled']);const {data,error}=await q.maybeSingle();fail(error);return data as Delivery|null; }
export async function getCatalogOrder(id:string,customerId:string) { if(!isUuid(id))return null; const {data,error}=await getSupabaseAdmin().from('orders').select('id,status,total_cents,currency,provider_reference,catalog_quote,created_at,order_items(product_title,price_cents,list_price_cents,product_slug)').eq('id',id).eq('customer_user_id',customerId).maybeSingle(); fail(error); return data; }
export const deliveryStatusLabel: Record<string,string>={pending:'Afname wordt voorbereid',invited:'Klaar om te starten',received:'Antwoorden ontvangen',completed:'Afgerond'};
export async function resolveCatalogSlug(slug:string) { if(!/^[a-z0-9-]{1,80}$/.test(slug))return null;const {data,error}=await getSupabaseAdmin().from('catalog_slug_aliases').select('products!inner(slug,type,status)').eq('slug',slug).maybeSingle();fail(error);const product=data?.products as any;return product?.status==='published'?`/${product.type==='profile'?'profielen':'vragenlijsten'}/${product.slug}`:null; }
