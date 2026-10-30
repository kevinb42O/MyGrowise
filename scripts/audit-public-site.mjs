// Read-only launch audit. Never submits forms, signs in, or follows API links.
// Usage: node scripts/audit-public-site.mjs https://www.mygrowise.be [report.json]
import { writeFileSync } from 'node:fs';

const origin = new URL(process.argv[2] || 'https://www.mygrowise.be').origin;
const canonicalOrigin = 'https://www.mygrowise.be';
const privatePath = /^\/(api|account|admin|praktijk|aankopen|bestellen|berichten|afspraak)(\/|$)/;
const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(([, key, double, single]) => [key, decode(double ?? single)]));
async function request(path, method = 'GET', agent = 'MyGrowiseLaunchAudit/1.0') {
  const started = Date.now();
  const send = () => fetch(new URL(path, origin), { method, headers: { 'user-agent': agent }, signal: AbortSignal.timeout(30000) });
  // Retry a single transport failure; an HTTP error remains a finding.
  const response = await send().catch(() => send());
  return { response, ms: Date.now() - started };
}
async function pool(items, worker) {
  const results = [];
  let index = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (index < items.length) { const item = items[index++]; results.push(await worker(item)); }
  }));
  return results;
}
const sitemap = await (await request('/sitemap.xml')).response.text();
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => decode(url));
const paths = new Set(sitemapUrls.map(url => new URL(url).pathname));
for (const path of ['/', '/startpunt', '/community']) paths.add(path);
const assets = new Set(['/manifest.webmanifest', '/favicon.svg']);
const links = new Set();
const pages = await pool([...paths], async path => {
  try {
    const { response, ms } = await request(path);
    const source = await response.text();
    const html = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, match => match.slice(0, match.indexOf('>') + 1) + '</script>');
    const meta = Object.fromEntries([...html.matchAll(/<meta\b[^>]*>/g)].map(([tag]) => { const a = attrs(tag); return [a.property || a.name, a.content]; }));
    const tags = [...html.matchAll(/<link\b[^>]*>/g)].map(([tag]) => attrs(tag));
    const canonical = tags.find(a => a.rel === 'canonical')?.href;
    for (const match of html.matchAll(/<(?:img|script|source)\b[^>]*>/g)) {
      const a = attrs(match[0]);
      if (a.src?.startsWith('/')) assets.add(a.src);
      for (const entry of a.srcset?.split(',') || []) if (entry.trim().startsWith('/')) assets.add(entry.trim().split(/\s/)[0]);
    }
    for (const a of tags) if (a.href?.startsWith('/') && ['stylesheet', 'icon', 'apple-touch-icon', 'manifest'].includes(a.rel)) assets.add(a.href);
    for (const match of html.matchAll(/<a\b[^>]*>/g)) {
      const a = attrs(match[0]);
      if (a.href?.startsWith('/') && !a.href.startsWith('//')) {
        const url = new URL(a.href, origin);
        if (!privatePath.test(url.pathname)) links.add(url.pathname);
      }
    }
    if (meta['og:image']) {
      const image = new URL(meta['og:image']);
      if (['mygrowise.be', 'www.mygrowise.be'].includes(image.hostname)) assets.add(image.pathname + image.search);
    }
    return { path, status: response.status, finalPath: new URL(response.url).pathname, ms, bytes: Buffer.byteLength(source), title: decode(html.match(/<title>(.*?)<\/title>/s)?.[1] || ''), description: meta.description, canonical, robots: meta.robots, ogImage: meta['og:image'], ogUrl: meta['og:url'], twitterImage: meta['twitter:image'], h1: [...html.matchAll(/<h1[\s>]/g)].length, missingImageAlt: [...html.matchAll(/<img\b[^>]*>/g)].filter(([tag]) => !/\salt(?:\s|=|\/?\>)/.test(tag)).length, missingImageSize: [...html.matchAll(/<img\b[^>]*>/g)].filter(([tag]) => { const a = attrs(tag); return !a.width || !a.height; }).length, structuredData: html.includes('application/ld+json') };
  } catch (error) { return { path, error: error.message }; }
});
const extraLinks = await pool([...links].filter(path => !paths.has(path)), async path => {
  try { const { response } = await request(path, 'HEAD'); return { path, status: response.status, finalPath: new URL(response.url).pathname }; }
  catch (error) { return { path, error: error.message }; }
});
const assetResults = await pool([...assets], async path => {
  try { const { response } = await request(path, 'HEAD'); return { path, status: response.status, type: response.headers.get('content-type'), bytes: Number(response.headers.get('content-length')) || null }; }
  catch (error) { return { path, error: error.message }; }
});
const crawlers = await pool(['facebookexternalhit/1.1', 'Twitterbot/1.0', 'LinkedInBot/1.0', 'WhatsApp/2.24.0'], async agent => {
  try { const { response } = await request('/', 'GET', agent); const html = await response.text(); return { agent, status: response.status, hasImage: html.includes('property="og:image"'), bytes: Buffer.byteLength(html) }; }
  catch (error) { return { agent, error: error.message }; }
});
const probes = await pool([
  ['/nl/', 301, '/'], ['/nl/onlinebegeleiding/', 301, '/begeleiding'],
  ['/nl/stress-en-emotieprofiel/', 301, '/profielen/stress-en-emotieprofiel'],
  ['/p/fraaie-fles/', 410], ['/launch-audit-page-that-does-not-exist', 404],
  ['/api/admin/users', 401], ['/api/praktijk/agenda', 401], ['/api/cron/support-mail', 401],
], async ([path, expected, target]) => {
  try {
    const response = await fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(30000) });
    const location = response.headers.get('location');
    return { path, expected, status: response.status, location, ok: response.status === expected && (!target || new URL(location, origin).pathname === target) };
  } catch (error) { return { path, error: error.message, ok: false }; }
});
const homepage = (await request('/', 'HEAD')).response;
const headers = Object.fromEntries(['content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'strict-transport-security'].map(name => [name, homepage.headers.get(name)]));
const report = { checkedAt: new Date().toISOString(), origin, sitemapUrls: sitemapUrls.length, sitemapWrongHost: sitemapUrls.filter(url => new URL(url).origin !== canonicalOrigin).length, pages: pages.sort((a,b) => a.path.localeCompare(b.path)), extraLinks, assets: assetResults, crawlers, probes, headers };
report.summary = {
  pages: pages.length, assets: assets.size, additionalLinks: extraLinks.length,
  failedPages: pages.filter(p => p.status !== 200), failedLinks: extraLinks.filter(p => p.status !== 200), failedAssets: assetResults.filter(p => p.status !== 200),
  wrongCanonical: pages.filter(p => p.canonical !== new URL(p.path, canonicalOrigin).href).map(p => p.path),
  socialIdentityIssues: pages.filter(p => p.ogUrl !== p.canonical || p.twitterImage !== p.ogImage || !p.ogImage?.startsWith(canonicalOrigin + '/')).map(p => p.path),
  missingMetadata: pages.filter(p => !p.title || !p.description || !p.ogImage || !p.ogUrl).map(p => p.path),
  unexpectedNoindex: pages.filter(p => /noindex/.test(p.robots)).map(p => p.path),
  headingIssues: pages.filter(p => p.h1 !== 1).map(p => ({ path: p.path, h1: p.h1 })),
  imageAltIssues: pages.filter(p => p.missingImageAlt).map(p => p.path),
  failedProbes: probes.filter(p => !p.ok),
  imageSizeIssues: pages.filter(p => p.missingImageSize).map(p => ({ path: p.path, count: p.missingImageSize })),
};
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary, null, 2));
if (report.sitemapWrongHost || report.summary.failedPages.length || report.summary.failedLinks.length || report.summary.failedAssets.length || report.summary.wrongCanonical.length || report.summary.socialIdentityIssues.length || report.summary.missingMetadata.length || report.summary.unexpectedNoindex.length || report.summary.headingIssues.length || report.summary.failedProbes.length || report.crawlers.some(c => c.status !== 200 || !c.hasImage)) process.exitCode = 1;
