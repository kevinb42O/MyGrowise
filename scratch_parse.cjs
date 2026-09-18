const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('/tmp/mygrowise_scraped.json', 'utf8'));

const pages = {};
const allImages = new Set();
const allAudios = new Set();

for (const [url, item] of Object.entries(data)) {
  const html = item.html;
  
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : '';
  
  const descMatch = html.match(/<meta\s+name="description"\s+content="(.*?)"/i);
  const desc = descMatch ? descMatch[1] : '';

  // Extract CDN assets
  const cdnRegex = /https:\/\/[0-9a-z]+\.clvaw-cdnwnd\.com\/[^\s"'<>)]+/gi;
  let match;
  while ((match = cdnRegex.exec(html)) !== null) {
    const rawUrl = match[0].replace(/&amp;/g, '&');
    if (/\.(jpeg|jpg|png|webp|ico)(\?.*)?$/i.test(rawUrl)) {
      allImages.add(rawUrl);
    }
    if (/\.(m4a|mp3|wav)(\?.*)?$/i.test(rawUrl)) {
      allAudios.add(rawUrl);
    }
  }

  // Extract structured sections
  const headings = [];
  const hRegex = /<h([1-4])[^>]*>(.*?)<\/h\1>/gi;
  while ((match = hRegex.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text) headings.push({ level: match[1], text });
  }

  // Extract paragraphs
  const paragraphs = [];
  const pRegex = /<p[^>]*>(.*?)<\/p>/gi;
  while ((match = pRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (text && text.length > 20) paragraphs.push(text);
  }

  pages[url] = {
    title,
    desc,
    headings,
    paragraphs
  };
}

fs.writeFileSync('/tmp/mygrowise_parsed.json', JSON.stringify({
  pages,
  images: Array.from(allImages),
  audios: Array.from(allAudios)
}, null, 2));

console.log(`Parsed ${Object.keys(pages).length} pages, ${allImages.size} images, ${allAudios.size} audio files.`);
