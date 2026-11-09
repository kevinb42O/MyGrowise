import { createHmac } from 'node:crypto';

export function signR2BookUrl(objectPath: string, download: boolean) {
  const origin = import.meta.env.EBOOK_R2_DOWNLOAD_ORIGIN;
  const secret = import.meta.env.EBOOK_R2_SIGNING_SECRET;
  if (!origin || !secret || !/^(?:[a-z0-9-]+\.(pdf|epub)|fien-reader-r1\/(?:0[1-9]|1[0-9]|2[0-9])\.webp)$/.test(objectPath)) {
    throw new Error('ebook_r2_unavailable');
  }
  const url = new URL('/' + objectPath, origin);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('ebook_r2_unavailable');
  const mode = download ? 'download' : 'open';
  const expiry = String(Math.floor(Date.now() / 1000) + (download ? 60 : 300));
  const signature = createHmac('sha256', secret).update(`${url.pathname}\n${mode}\n${expiry}`).digest('hex');
  url.search = new URLSearchParams({exp:expiry,mode,sig:signature}).toString();
  return url.href;
}
