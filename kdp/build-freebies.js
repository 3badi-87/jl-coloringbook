// Builds free printable coloring pages and Pinterest pins for the Hammy books.
// Usage: node kdp/build-freebies.js
// Output in kdp/freebies/:
//   hammy-free-coloring-pages.pdf  9 printable pages (8.5 x 11 in) + a "more Hammy books" page
//   pins/<book>-<page>.png         one 1000 x 1500 px Pinterest pin per page (2:3, Pinterest's size)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const K = __dirname;
const OUT = path.join(K, 'freebies');
fs.mkdirSync(path.join(OUT, 'pins'), { recursive: true });

// three pages per book, none of them used as back-cover samples
const BOOKS = [
  { dir: K, title: 'Hammy & Friends', bg: '#D9EEFB', accent: '#FFB892',
    pages: [['13-snowman.svg', 'Hammy builds a snowman'], ['09-birthday.svg', "Hammy's birthday party"], ['17-kite.svg', 'Hammy flies a kite']] },
  { dir: path.join(K, 'safari'), title: 'Hammy in Safari', bg: '#FFF1D8', accent: '#E8B04B',
    pages: [['02-baby-elephant.svg', 'Hammy meets a baby elephant'], ['03-giraffe.svg', 'Hammy and the tall giraffe'], ['06-hippo.svg', 'Hammy and the happy hippo']] },
  { dir: path.join(K, 'ocean'), title: 'Hammy Under the Sea', bg: '#D6F0F7', accent: '#7CC8E8',
    pages: [['02-sea-turtle.svg', 'Hammy swims with a sea turtle'], ['05-clownfish.svg', 'Hammy and the clownfish'], ['08-jellyfish.svg', 'Hammy and the jellyfish']] },
];

const data = f => {
  const ext = path.extname(f).slice(1).replace('svg', 'svg+xml');
  return `data:image/${ext};base64,` + fs.readFileSync(f).toString('base64');
};
const LOGO = data(path.join(K, 'brand', 'logo.png'));
const LOGO_BW = data(path.join(K, 'brand', 'logo-bw.png'));
const esc = s => s.replace(/&/g, '&amp;');
const fonts = '<link href="https://fonts.googleapis.com/css2?family=Chewy&family=Nunito:wght@700;800;900&display=block" rel="stylesheet">';
const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- printable PDF ----------
const printPages = [];
for (const b of BOOKS) for (const [f] of b.pages) {
  printPages.push(`<section class="page"><img class="pic" src="${data(path.join(b.dir, 'art', f))}">
    <div class="foot"><img src="${LOGO_BW}"><span>Free coloring page from <b>${esc(b.title)}</b>, a coloring book by RoxoSky Books Co.<br>
    Find the full book on Amazon. Free for personal and classroom use; please do not sell.</span></div></section>`);
}
printPages.push(`<section class="page more"><h1>Want more Hammy?</h1>
  <p>Each book has 20 pictures to color. Find them on Amazon:</p>
  <div class="covers">${BOOKS.map(b => `<figure><img src="${data(path.join(OUT, 'covers', slug(b.title) + '.png'))}"><figcaption>${esc(b.title)}</figcaption></figure>`).join('')}</div>
  <p class="search">Search Amazon for <b>"Hammy coloring book RoxoSky"</b></p>
  <img class="logo" src="${LOGO}"></section>`);

const printHtml = `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>
  @page { size: 8.5in 11in; margin: 0; }
  * { box-sizing: border-box; } body { margin: 0; font-family: Nunito, sans-serif; color: #000; }
  .page { width: 8.5in; height: 11in; padding: 0.45in 0.45in 1.05in; position: relative; page-break-after: always;
          display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .pic { width: 100%; height: 100%; object-fit: contain; }
  .foot { position: absolute; left: 0.5in; right: 0.5in; bottom: 0.3in; display: flex; align-items: center; gap: 0.15in;
          font-size: 9.5pt; line-height: 1.35; color: #333; }
  .foot img { height: 0.5in; }
  .more { flex-direction: column; text-align: center; padding: 0.8in; color: #4A3B5C; }
  .more h1 { font-family: Chewy, sans-serif; font-weight: 400; font-size: 54pt; margin: 0; }
  .more p { font-size: 16pt; font-weight: 700; margin: 0.2in 0; }
  .covers { display: flex; gap: 0.3in; margin: 0.2in 0; }
  .covers figure { margin: 0; width: 2.1in; } .covers img { width: 100%; border-radius: 0.08in; box-shadow: 0 0.04in 0.15in rgba(0,0,0,.25); }
  .covers figcaption { font-weight: 800; font-size: 12pt; margin-top: 0.1in; }
  .more .logo { height: 0.9in; margin-top: 0.3in; }
</style></head><body>${printPages.join('\n')}</body></html>`;

// ---------- Pinterest pins ----------
const pin = (b, f, name) => `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>
  * { box-sizing: border-box; } body { margin: 0; }
  .pin { width: 1000px; height: 1500px; background: ${b.bg}; position: relative; overflow: hidden; font-family: Nunito, sans-serif; color: #4A3B5C; }
  .head { text-align: center; padding-top: 44px; }
  .free { display: inline-block; background: ${b.accent}; color: #fff; font-family: Chewy, sans-serif; font-size: 52px; padding: 4px 34px 8px;
          border-radius: 40px; -webkit-text-stroke: 5px #4A3B5C; paint-order: stroke fill; border: 5px solid #4A3B5C; }
  h1 { margin: 14px 0 0; font-family: Chewy, sans-serif; font-weight: 400; font-size: 80px; line-height: 1; color: #fff;
       -webkit-text-stroke: 10px #4A3B5C; paint-order: stroke fill; }
  .name { margin: 10px 0 0; font-weight: 900; font-size: 34px; }
  .card { position: absolute; left: 140px; top: 330px; width: 720px; height: 932px; background: #fff; padding: 26px;
          border-radius: 18px; box-shadow: 0 10px 30px rgba(74,59,92,.25); transform: rotate(-1.5deg); }
  .card img { width: 100%; height: 100%; object-fit: contain; }
  .foot { position: absolute; left: 48px; right: 48px; bottom: 36px; display: flex; align-items: center; gap: 24px; }
  .foot .cov { height: 170px; border-radius: 8px; box-shadow: 0 6px 16px rgba(0,0,0,.25); transform: rotate(3deg); }
  .foot p { margin: 0; flex: 1; font-weight: 800; font-size: 28px; line-height: 1.3; }
  .foot p b { font-weight: 900; } .foot .logo { height: 96px; }
</style></head><body><div class="pin">
  <div class="head"><div class="free">FREE PRINTABLE</div><h1>Coloring Page for Kids</h1><p class="name">${esc(name)}</p></div>
  <div class="card"><img src="${data(path.join(b.dir, 'art', f))}"></div>
  <div class="foot"><img class="cov" src="${data(path.join(OUT, 'covers', slug(b.title) + '.png'))}"><p>From the coloring book<br><b>${esc(b.title)}</b><br>on Amazon</p><img class="logo" src="${LOGO}"></div>
</div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(printHtml, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const pdf = path.join(OUT, 'hammy-free-coloring-pages.pdf');
  await page.pdf({ path: pdf, width: '8.5in', height: '11in', printBackground: true });
  console.log(`wrote ${pdf}: ${printPages.length} pages`);

  await page.setViewportSize({ width: 1000, height: 1500 });
  for (const b of BOOKS) for (const [f, name] of b.pages) {
    await page.setContent(pin(b, f, name), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(OUT, 'pins', `${slug(b.title)}-${f.replace('.svg', '')}.png`);
    await page.screenshot({ path: out });
    console.log(`wrote ${out}`);
  }
  await browser.close();
})();
