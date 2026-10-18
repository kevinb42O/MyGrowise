export const MODULE_BUCKET = 'module-materials';
export const assetLimit = (kind: string) => kind === 'pdf' ? 25 * 1024 * 1024 : kind === 'audio' ? 150 * 1024 * 1024 : 0;
export const trackKeyValid = (key: unknown): key is string => typeof key === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key) && key.length <= 80;
export function validateUpload(input: Record<string, unknown>) {
 const kind=String(input.kind||'');const title=String(input.title||'').trim();const key=String(input.key||'');const size=Number(input.size);const sort=Number(input.sortOrder||0);
 if(!assetLimit(kind)||!title||title.length>160||!Number.isSafeInteger(size)||size<1||size>assetLimit(kind)||!Number.isInteger(sort)||sort<0||sort>999||kind==='audio'&&!trackKeyValid(key))throw new Error('invalid_asset');
 return {kind,title,key,size,sort};
}
export function validFileSignature(kind: string, bytes: Uint8Array) {
 if(kind==='pdf')return bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
 if(kind!=='audio')return false;
 if(bytes.length>=3&&String.fromCharCode(...bytes.slice(0,3))==='ID3')return true;
 // MPEG audio frame sync, non-reserved version/layer/bitrate/sample rate.
 for(let i=0;i<bytes.length-3;i++)if(bytes[i]===255&&(bytes[i+1]&224)===224&&(bytes[i+1]&24)!==8&&(bytes[i+1]&6)!==0&&(bytes[i+2]&240)!==0&&(bytes[i+2]&240)!==240&&(bytes[i+2]&12)!==12)return true;
 return false;
}
export function parseSelection(params: URLSearchParams) {
 const keys=['pakket','vragenlijsten','producten'].filter(k=>params.has(k));
 if(keys.length!==1)throw new Error('invalid_selection');
 return {ids:(params.get(keys[0])||'').split(','),mode:keys[0]==='pakket'?'package' as const:'custom' as const};
}
export function cleanSelection(value: unknown, availableIds: string[]) {
 return Array.isArray(value)?[...new Set(value.filter((id): id is string=>typeof id==='string'&&availableIds.includes(id)))].slice(0,30):[];
}
