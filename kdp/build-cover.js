// Builds the Amazon KDP paperback cover (back + spine + front, one sheet).
// Usage: [BOOK=kdp/safari] PAGES=44 node kdp/build-cover.js
//
// Size follows KDP's rules: 0.125 in bleed on every side, 8.5 x 11 in trim,
// spine = page count x 0.002252 in (white paper). Books under 79 pages may not
// have spine text, so the spine is plain color.
// Front art: kdp/cover-art/front-pastel.png, full bleed with the title on the sky.
// Back samples: the black-and-white interior pages in kdp/art.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGES = +(process.env.PAGES || 46);
const AUTHOR = process.env.BOOK_AUTHOR || 'RoxoSky Books Co.';
const BLEED = 0.125, TW = 8.5, TH = 11;
const SPINE = +(PAGES * 0.002252).toFixed(4);
const W = BLEED + TW + SPINE + TW + BLEED, H = TH + 2 * BLEED;
const BOOK = path.resolve(process.env.BOOK || __dirname);
const CFG = JSON.parse(fs.readFileSync(path.join(BOOK, 'book.json'), 'utf8'));
const OUT = path.join(BOOK, `${CFG.slug}-cover.pdf`);

const dataUrl = f => {
  const ext = path.extname(f).slice(1).replace('svg', 'svg+xml');
  return `data:image/${ext};base64,` + fs.readFileSync(f).toString('base64');
};
// full-page pastel illustration from Canva (no frame, no text)
const scene = path.join(BOOK, 'cover-art', CFG.coverArt);
const samples = CFG.samples.map(f => path.join(BOOK, 'art', f)).filter(fs.existsSync);

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Chewy&family=Nunito:wght@600;800&display=block" rel="stylesheet">
<style>
  @page { size: ${W}in ${H}in; margin: 0; }
  body { margin: 0; }
  :root { --ink: #4A3B5C; --peach: #FFB892; --mint: #8FD3B0; --pink: #FFCADF; --sky: #CDE8FF; --butter: #FFF0A8; }
  .sheet { width: ${W}in; height: ${H}in; position: relative; overflow: hidden; font-family: Nunito, sans-serif; color: var(--ink);
           background: ${CFG.background}; }
  .back  { position: absolute; left: 0; top: 0; width: ${BLEED + TW}in; height: ${H}in; }
  .spine { position: absolute; left: ${BLEED + TW}in; top: 0; width: ${SPINE}in; height: ${H}in; background: ${CFG.spine}; }
  .front { position: absolute; left: ${BLEED + TW + SPINE}in; top: 0; width: ${TW + BLEED}in; height: ${H}in; overflow: hidden; }
  .front > .art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center bottom; }
  /* title sits straight on the sky, no box */
  .title { position: absolute; ${CFG.titleBox} top: ${BLEED + 0.3}in; text-align: center; }
  .title h1 { margin: 0; font-family: Chewy, sans-serif; font-weight: 400; font-size: 80pt; line-height: 0.95;
              color: #fff; -webkit-text-stroke: 7pt var(--ink); paint-order: stroke fill; letter-spacing: 1pt;
              text-shadow: 0 0.06in 0 rgba(74,59,92,.25); }
  .title h1 .amp { color: var(--peach); }
  .title p { display: inline-block; margin: 0.12in 0 0; font-weight: 800; font-size: 20pt; color: #fff;
             -webkit-text-stroke: 5pt var(--ink); paint-order: stroke fill; letter-spacing: 0.5pt; }
  .pub { position: absolute; left: 50%; bottom: 0.38in; transform: translateX(-50%); height: 0.7in; width: auto;
         filter: drop-shadow(0 0 0.06in #fff) drop-shadow(0 0 0.06in #fff); }
  /* back */
  .inner { position: absolute; left: ${BLEED + 0.5}in; right: 0.5in; top: ${BLEED + 0.5}in; bottom: ${BLEED + 0.5}in; }
  .inner h2 { margin: 0; text-align: center; font-family: Chewy, sans-serif; font-weight: 400; font-size: 54pt; color: #fff;
              -webkit-text-stroke: 5pt var(--ink); paint-order: stroke fill; }
  .blurb { margin: 0.12in auto 0; max-width: 6.6in; text-align: center; font-weight: 700; font-size: 13.5pt; line-height: 1.45; }
  .samples { display: grid; grid-template-columns: 1fr 1fr; gap: 0.3in 0.4in; width: 4.6in; margin: 0.28in auto 0; }
  .samples div { background: #fff; padding: 0.08in; }
  .samples div:nth-child(1) { transform: rotate(-3deg); } .samples div:nth-child(2) { transform: rotate(2.5deg); }
  .samples div:nth-child(3) { transform: rotate(2deg); }  .samples div:nth-child(4) { transform: rotate(-2.5deg); }
  .samples img { display: block; width: 100%; }
  .features { position: absolute; left: 0; bottom: 0; font-weight: 800; font-size: 12.5pt; line-height: 1.6; }
  .backlogo { position: absolute; right: 0.1in; bottom: 1.32in; width: 1.8in; height: auto; }
  .barcode { position: absolute; right: 0; bottom: 0; width: 2in; height: 1.2in; background: #fff; }
</style></head><body><div class="sheet">
  <div class="back"><div class="inner">
    <h2>What's inside?</h2>
    <p class="blurb">${CFG.blurb}</p>
    <div class="samples">${samples.map(f => `<div><img src="${dataUrl(f)}"></div>`).join('')}</div>
    <div class="features">✔ ${fs.readdirSync(path.join(BOOK, 'art')).filter(f => f.endsWith('.svg')).length} pictures, single-sided pages<br>✔ Bold, easy lines<br>✔ 8.5 x 11 in large print</div>
    <img class="backlogo" src="${dataUrl(path.join(__dirname, 'brand', 'logo.png'))}" alt="${AUTHOR}">
    <div class="barcode"></div>
  </div></div>
  <div class="spine"></div>
  <div class="front"><img class="art" src="${dataUrl(scene)}">
    <div class="title"><h1>${CFG.titleHtml}</h1><p style="position: relative; left: ${CFG.subtitleShift || '0in'}">${CFG.subtitle}</p></div>
    <img class="pub" src="${dataUrl(path.join(__dirname, 'brand', 'logo.png'))}" alt="${AUTHOR}">
  </div>
</div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: OUT, width: `${W}in`, height: `${H}in`, printBackground: true });
  await browser.close();
  console.log(`wrote ${OUT}: ${W.toFixed(3)} x ${H} in (spine ${SPINE} in for ${PAGES} pages), pastel layout`);
})();
