import { validateProductForm } from '../adminProducts';
import { isUuid } from './pricing';
export function validateCatalogForm(form:FormData) {
 const base=validateProductForm(form);if(!base.value)throw new Error(Object.values(base.errors).join(' '));
 const get=(key:string,max=5000)=>{const s=String(form.get(key)||'').trim();if(s.length>max)throw new Error(`${key}: te veel tekens.`);return s;};
 const v=base.value;const id=get('id',36);if(id&&!isUuid(id))throw new Error('Ongeldig product.');
 const availability=get('availability');if(!['available','upcoming','paused'].includes(availability)||!['profile','questionnaire'].includes(v.type))throw new Error('Kies een geldige status en type.');
 if(v.status==='published'&&availability==='available'&&(!v.priceCents||v.priceCents<1))throw new Error('Beschikbaar aanbod heeft een verkoopprijs groter dan nul nodig.');
 const cost=get('cost',10).replace(',','.');let costCents=null;if(cost){if(!/^\d{1,6}(\.\d{1,2})?$/.test(cost)||Number(cost)>100000)throw new Error('Controleer de uitgeverskost.');costCents=Math.round(Number(cost)*100);}
 const order=get('sortOrder',6);if(!/^\d{1,5}$/.test(order))throw new Error('Gebruik een geldige sorteervolgorde.');
 const image=get('image',500)||'/images/editorial/mygrowise-50.jpg';if(!/^\/images\/[a-zA-Z0-9_./-]+\.(jpg|jpeg|png|webp|avif)$/.test(image)||image.includes('..'))throw new Error('Gebruik een lokaal afbeeldingspad onder /images/.');
 const ids=form.getAll('component').map(String);if(ids.some(x=>!isUuid(x))||new Set(ids).size!==ids.length||ids.length>30)throw new Error('Controleer de pakketonderdelen.');
 const components=ids.map((id,i)=>({id,title:get(`label-${id}`,160),sortOrder:Number(get(`order-${id}`,5)||i)}));
 const own=get('ownComponents',1600).split('\n').map(x=>x.trim()).filter(Boolean);if(own.length>10||own.some(x=>x.length>160))throw new Error('Maximaal tien eigen onderdelen van 160 tekens.');
 components.push(...own.map((title,i)=>({id:null as unknown as string,title,sortOrder:100+i})));
 if(components.some(c=>!c.title||!Number.isInteger(c.sortOrder)||c.sortOrder<0||c.sortOrder>99999))throw new Error('Controleer namen en volgorde van de onderdelen.');
 if(v.type==='profile'&&v.status==='published'&&availability==='available'&&!components.length)throw new Error('Selecteer minstens één pakketonderdeel.');
 return { ...v,id,availability,costCents,costNote:get('costNote'),category:get('category',120),audience:get('audience',120),ageLabel:get('ageLabel',120),version:get('version',120),description:get('description'),includesText:get('includesText'),deliveryText:get('deliveryText'),reviewNote:get('reviewNote'),image,sortOrder:Number(order),components:v.type==='profile'?components:[] };
}
