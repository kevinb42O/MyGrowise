const https = require('https');

function fetchPage(urlStr) {
  return new Promise((resolve) => {
    https.get(urlStr, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve(body));
    }).on('error', () => resolve(''));
  });
}

async function run() {
  const urls = [
    'https://www.mygrowise.be/l/stress-verminderen-ademhalingsoefening/',
    'https://www.mygrowise.be/gratis-oefeningen-stress-regulatie/',
    'https://www.mygrowise.be/nl/onlinemodules/',
    'https://www.mygrowise.be/nl/persoonlijkheidsprofiel/'
  ];

  for (const u of urls) {
    console.log('====================================');
    console.log('AUDITING URL:', u);
    console.log('====================================');
    const html = await fetchPage(u);
    
    // Find all YouTube / Vimeo / video links
    const ytLinks = [...html.matchAll(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com|wistia\.com|loom\.com)\/[^\s"'<>\)]+/gi)].map(m => m[0]);
    console.log('Video links found:', ytLinks);

    // Find any embedded player code
    const iframes = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
    console.log('Iframes found:', iframes);

    // Find all media URLs
    const mediaUrls = [...html.matchAll(/https:\/\/[0-9a-z]+\.clvaw-cdnwnd\.com\/[^\s"'<>\)]+/gi)].map(m => m[0]);
    const filteredMedia = mediaUrls.filter(m => /\.(mp4|m4a|mp3|webm|pdf|zip)/i.test(m));
    console.log('CDN Media files found:', Array.from(new Set(filteredMedia)));

    const clean = html.replace(/<[^>]+>/g, '\n').replace(/\n\s*\n/g, '\n').trim();
    console.log('Text preview:\n', clean.slice(0, 600));
  }
}

run();
