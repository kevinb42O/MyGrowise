const https = require('https');
const fs = require('fs');

const visited = new Set();
const toVisit = [
  'https://www.mygrowise.be/',
  'https://www.mygrowise.be/nl/',
  'https://www.mygrowise.be/sitemap.xml',
  'https://www.mygrowise.be/robots.txt',
  'https://www.mygrowise.be/nl/onlinebegeleiding/',
  'https://www.mygrowise.be/nl/online-psycholoog/',
  'https://www.mygrowise.be/nl-online-emdr-therapie/',
  'https://www.mygrowise.be/nl/online-seksuoloog/',
  'https://www.mygrowise.be/nl/persoonlijkheidsprofiel/',
  'https://www.mygrowise.be/nl/stress-en-emotieprofiel/',
  'https://www.mygrowise.be/nl-persoonlijkheidsprofiel/',
  'https://www.mygrowise.be/nl/onlinemodules/',
  'https://www.mygrowise.be/nl/onlinecommunity/',
  'https://www.mygrowise.be/nl/over-mygrowise/',
  'https://www.mygrowise.be/nl/psycholoog-online/',
  'https://www.mygrowise.be/nl/locaties/',
  'https://www.mygrowise.be/nl/nieuws/',
  'https://www.mygrowise.be/nl/prijzen/',
  'https://www.mygrowise.be/nl/contact/',
  'https://www.mygrowise.be/nl/cart/',
  'https://www.mygrowise.be/es/'
];

const foundAudios = new Map();
const foundEmbeds = [];

function fetchPage(urlStr) {
  return new Promise((resolve) => {
    try {
      const req = https.get(urlStr, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, urlStr).href;
          return resolve(fetchPage(redirectUrl));
        }
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ url: urlStr, status: res.statusCode, body }));
      });
      req.on('error', (e) => resolve({ url: urlStr, status: 500, body: '' }));
      req.on('timeout', () => { req.destroy(); resolve({ url: urlStr, status: 408, body: '' }); });
    } catch (e) {
      resolve({ url: urlStr, status: 500, body: '' });
    }
  });
}

async function crawl() {
  while (toVisit.length > 0) {
    const currentUrl = toVisit.shift();
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    console.log(`Scanning: ${currentUrl}`);
    const res = await fetchPage(currentUrl);
    if (!res.body) continue;

    const html = res.body;

    // Discover internal links
    const linkMatches = html.matchAll(/href=["']([^"'#]+)["']/gi);
    for (const match of linkMatches) {
      let rawLink = match[1];
      if (rawLink.startsWith('/')) {
        rawLink = 'https://www.mygrowise.be' + rawLink;
      }
      if (rawLink.startsWith('https://www.mygrowise.be') && !visited.has(rawLink)) {
        toVisit.push(rawLink);
      }
    }

    // Discover direct audio file extensions (.m4a, .mp3, .wav, .ogg, .aac)
    const audioRegex = /https:\/\/[^\s"'<>]+\.(?:m4a|mp3|wav|ogg|aac)(?:\?[^\s"'<>]*)?/gi;
    let aMatch;
    while ((aMatch = audioRegex.exec(html)) !== null) {
      const audioUrl = aMatch[0].replace(/&amp;/g, '&');
      foundAudios.set(audioUrl, { url: audioUrl, page: currentUrl, title: 'De vrouw die haar adem verloor' });
    }

    // Check for webnode file download buttons
    const btnRegex = /class=["'][^"']*b-btn-file[^"']*["'][\s\S]*?href=["']([^"']+)["'][\s\S]*?<span class=["']b-btn-t["']>([\s\S]*?)<\/span>/gi;
    let btnMatch;
    while ((btnMatch = btnRegex.exec(html)) !== null) {
      const fileUrl = btnMatch[1].replace(/&amp;/g, '&');
      const fileTitle = btnMatch[2].replace(/<[^>]+>/g, '').trim();
      foundAudios.set(fileUrl, { url: fileUrl, page: currentUrl, title: fileTitle, isButton: true });
    }

    // Discover podcast and media iframes
    const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
    let ifMatch;
    while ((ifMatch = iframeRegex.exec(html)) !== null) {
      const src = ifMatch[1];
      if (/spotify|soundcloud|apple|podbean|anchor|buzzsprout|youtube|vimeo/i.test(src)) {
        foundEmbeds.push({ embedUrl: src, page: currentUrl });
      }
    }
  }

  console.log('\n================ AUDIOS DISCOVERED ================');
  console.log(`Visited ${visited.size} total pages.`);
  console.log(`Discovered ${foundAudios.size} media files:`);
  
  for (const [url, info] of foundAudios.entries()) {
    console.log(`\n🎵 Title: "${info.title}"`);
    console.log(`   Direct CDN URL: ${url}`);
    console.log(`   Source page: ${info.page}`);
  }

  if (foundEmbeds.length > 0) {
    console.log('\n🎙️ Embeds / Players:');
    foundEmbeds.forEach((e) => console.log(`- ${e.embedUrl} on ${e.page}`));
  }

  fs.writeFileSync('/tmp/mygrowise_discovered_audios.json', JSON.stringify({
    visited: Array.from(visited),
    audios: Array.from(foundAudios.values()),
    embeds: foundEmbeds
  }, null, 2));
}

crawl();
