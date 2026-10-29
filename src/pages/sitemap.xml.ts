import type {APIRoute} from 'astro';
import {getSupabaseAdmin} from '../lib/supabase/server';
const escape=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
export const GET:APIRoute=async()=>{
 try{
  const db=getSupabaseAdmin();
  const [products,practitioners,content]=await Promise.all([
   db.from('products').select('slug,type,catalog_details!inner(availability)').eq('status','published').in('type',['profile','questionnaire','module','guide']).neq('catalog_details.availability','paused'),
   db.from('practitioners').select('slug').eq('active',true),
   db.from('content_items').select('slug,kind').eq('status','published'),
  ]);
  for(const result of [products,practitioners,content])if(result.error)throw result.error;
  const paths=['/','/zelf-aan-de-slag','/profielen','/vragenlijsten','/samenstellen','/modules','/begeleiding','/over-ons','/contact','/privacy','/prijzen','/inspiratie'];
  for(const p of products.data||[])paths.push(`/${p.type==='profile'?'profielen':p.type==='questionnaire'?'vragenlijsten':p.type==='module'?'modules':'verdieping'}/${p.slug}`);
  for(const p of practitioners.data||[])paths.push(`/begeleiding/${p.slug}`);
  for(const p of content.data||[])paths.push(p.kind==='article'?`/inspiratie/${p.slug}`:`/${p.slug}`);
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(paths)].map(path=>`<url><loc>${escape(new URL(path,'https://mygrowise.be').href)}</loc></url>`).join('')}</urlset>`,{headers:{'content-type':'application/xml; charset=utf-8','cache-control':'public, max-age=300'}});
 }catch{return new Response('Sitemap tijdelijk niet beschikbaar.',{status:503,headers:{'cache-control':'no-store'}});}
};
