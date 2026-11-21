// Builds the Amazon KDP paperback cover (back + spine + front, one sheet).
// Usage: PAGES=46 BOOK_AUTHOR="Your Name" node kdp/build-cover.js
//
// Size follows KDP's rules: 0.125 in bleed on every side, 8.5 x 11 in trim,
// spine = page count x 0.002252 in (white paper). Books under 79 pages may not
// have spine text, so the spine is plain color.
// Front art: kdp/cover-art/front.png (full-size), else front-preview.png.
// Back samples: the black-and-white interior pages in kdp/art.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGES = +(process.env.PAGES || 46);
const AUTHOR = process.env.BOOK_AUTHOR || 'Your Name';
const BLEED = 0.125, TW = 8.5, TH = 11;
const SPINE = +(PAGES * 0.002252).toFixed(4);
const W = BLEED + TW + SPINE + TW + BLEED, H = TH + 2 * BLEED;
const OUT = path.join(__dirname, 'hammy-and-friends-cover.pdf');

const dataUrl = f => {
  const ext = path.extname(f).slice(1).replace('svg', 'svg+xml');
  return `data:image/${ext};base64,` + fs.readFileSync(f).toString('base64');
};
const front = ['front.png', 'front-preview.png'].map(f => path.join(__dirname, 'cover-art', f)).find(fs.existsSync);
const samples = ['02-sunflower-seed.svg', '03-bunny.svg', '04-turtle-ride.svg', '05-owl-night.svg']
  .map(f => path.join(__dirname, 'art', f)).filter(fs.existsSync);

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Chewy&family=Nunito:wght@600;800&display=block" rel="stylesheet">
<style>
  @page { size: ${W}in ${H}in; margin: 0; }
  body { margin: 0; }
  .sheet { width: ${W}in; height: ${H}in; position: relative; overflow: hidden; font-family: Nunito, sans-serif; }
  .back  { position: absolute; left: 0; top: 0; width: ${BLEED + TW}in; height: ${H}in;
           background: #FFF3D6 radial-gradient(#FFD98A 9%, transparent 10%) 0 0 / 0.55in 0.55in; }
  .spine { position: absolute; left: ${BLEED + TW}in; top: 0; width: ${SPINE}in; height: ${H}in; background: #FF9F43; }
  .front { position: absolute; left: ${BLEED + TW + SPINE}in; top: 0; width: ${TW + BLEED}in; height: ${H}in; overflow: hidden; background: #BDE3F7; }
  .front > img { width: 100%; height: 100%; object-fit: cover; }
  /* title band sits over the top of the art */
  .title { position: absolute; left: -0.1in; right: -0.1in; top: -0.1in; padding: 0.45in 0.6in 0.2in 0.55in; height: 3.45in; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center;
           background: #fff; border-bottom: 0.07in solid #2B2B2B; border-radius: 0 0 0.6in 0.6in; text-align: center;
           box-shadow: 0 0.08in 0 #FF9F43; }
  .title h1 { margin: 0; font-family: Chewy, sans-serif; font-weight: 400; font-size: 84pt; line-height: 1;
              color: #FF8A3D; -webkit-text-stroke: 2.2pt #2B2B2B; paint-order: stroke fill; letter-spacing: 1pt; }
  .title h1 .amp { color: #6CC25B; }
  .title p { margin: 0.14in 0 0; font-weight: 800; font-size: 24pt; color: #2B2B2B; }
  .author { position: absolute; left: 0.5in; bottom: 0.5in; background: #fff; border: 0.04in solid #2B2B2B;
            border-radius: 0.2in; padding: 0.06in 0.2in; font-weight: 800; font-size: 14pt; color: #2B2B2B; }
  /* back */
  .inner { position: absolute; left: ${BLEED + 0.5}in; right: 0.5in; top: ${BLEED + 0.5}in; bottom: ${BLEED + 0.5}in; }
  .inner h2 { margin: 0; text-align: center; font-family: Chewy, sans-serif; font-weight: 400; font-size: 46pt; color: #FF8A3D;
              -webkit-text-stroke: 1.6pt #2B2B2B; paint-order: stroke fill; }
  .blurb { margin: 0.12in auto 0; max-width: 6.6in; text-align: center; font-weight: 600; font-size: 13.5pt; line-height: 1.45; color: #2B2B2B; }
  .samples { display: grid; grid-template-columns: 1fr 1fr; gap: 0.32in 0.4in; width: 5.7in; margin: 0.3in auto 0; }
  .samples div { background: #fff; padding: 0.1in; border: 0.035in solid #2B2B2B; border-radius: 0.12in; box-shadow: 0.07in 0.07in 0 rgba(0,0,0,.18); }
  .samples div:nth-child(1) { transform: rotate(-3deg); } .samples div:nth-child(2) { transform: rotate(2.5deg); }
  .samples div:nth-child(3) { transform: rotate(2deg); }  .samples div:nth-child(4) { transform: rotate(-2.5deg); }
  .samples img { display: block; width: 100%; }
  .features { position: absolute; left: 0; bottom: 0; font-weight: 800; font-size: 12.5pt; line-height: 1.6; color: #2B2B2B; }
  .barcode { position: absolute; right: 0; bottom: 0; width: 2in; height: 1.2in; background: #fff; }
</style></head><body><div class="sheet">
  <div class="back"><div class="inner">
    <h2>What's inside?</h2>
    <p class="blurb">Join Hammy the hamster and his animal friends on picnics, turtle rides and starry nights!
      Big, simple pictures with bold lines, perfect for little hands.</p>
    <div class="samples">${samples.map(f => `<div><img src="${dataUrl(f)}"></div>`).join('')}</div>
    <div class="features">✔ Single-sided pages, no bleed-through<br>✔ Bold, easy lines<br>✔ 8.5 x 11 in large print</div>
    <div class="barcode"></div>
  </div></div>
  <div class="spine"></div>
  <div class="front"><img src="${dataUrl(front)}">
    <div class="title"><h1>Hammy <span class="amp">&amp;</span> Friends</h1><p>A Coloring Book for Kids</p></div>
    <div class="author">${AUTHOR}</div>
  </div>
</div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: OUT, width: `${W}in`, height: `${H}in`, printBackground: true });
  await browser.close();
  console.log(`wrote ${OUT}: ${W.toFixed(3)} x ${H} in (spine ${SPINE} in for ${PAGES} pages), front art: ${path.basename(front)}`);
})();
