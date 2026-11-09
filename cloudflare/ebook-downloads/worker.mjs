const headers = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};
const encoder = new TextEncoder();

async function authorized(url, secret) {
  const expiry = url.searchParams.get('exp') || '';
  const mode = url.searchParams.get('mode') || '';
  const signature = url.searchParams.get('sig') || '';
  const now = Math.floor(Date.now() / 1000);
  if (!secret || !/^\d{10}$/.test(expiry) || Number(expiry) <= now || Number(expiry) > now + 300) return false;
  if (!['download','open'].includes(mode) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['verify']);
  const bytes = Uint8Array.from(signature.match(/../g), part => Number.parseInt(part,16));
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(`${url.pathname}\n${mode}\n${expiry}`));
}

function rangeFor(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const first = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const last = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first > last || first >= size) return null;
  return {offset:first,length:last - first + 1};
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const file = /^\/(jij-fien-en-een-toverkist-vol-superkrachten\.(pdf|epub))$/.exec(url.pathname);
    if (!file || !['GET','HEAD'].includes(request.method) || !await authorized(url, env.EBOOK_R2_SIGNING_SECRET)) {
      return new Response('Niet beschikbaar.', {status:404, headers});
    }
    const [, filename, format] = file;
    const metadata = await env.BOOKS.head(filename);
    if (!metadata) return new Response('Niet beschikbaar.', {status:404, headers});
    const requestedRange = request.headers.get('Range');
    const range = requestedRange ? rangeFor(requestedRange, metadata.size) : undefined;
    if (range === null) return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${metadata.size}`}});
    const inline = format === 'pdf' && url.searchParams.get('mode') === 'open';
    const responseHeaders = new Headers({
      ...headers,
      'Accept-Ranges': 'bytes',
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/epub+zip',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'Content-Length': String(range?.length ?? metadata.size),
      'ETag': metadata.httpEtag,
    });
    if (range) responseHeaders.set('Content-Range',`bytes ${range.offset}-${range.offset + range.length - 1}/${metadata.size}`);
    const status = range ? 206 : 200;
    if (request.method === 'HEAD') return new Response(null,{status,headers:responseHeaders});
    const object = await env.BOOKS.get(filename, {range, onlyIf:{etagMatches:metadata.etag}});
    if (!object || !('body' in object)) return new Response('Probeer opnieuw.',{status:503,headers});
    return new Response(object.body,{status,headers:responseHeaders});
  },
};
