// Builds the Amazon KDP paperback cover (back + spine + front, one sheet).
// Usage: PAGES=46 BOOK_AUTHOR="Your Name" node kdp/build-cover.js
//
// Size follows KDP's rules: 0.125 in bleed on every side, 8.5 x 11 in trim,
// spine = page count x 0.002252 in (white paper). Books under 79 pages may not
// have spine text, so the spine is plain color.
// Front art: kdp/cover-art/front-scene.png, softened to pastel tones in CSS.
// Back samples: the black-and-white interior pages in kdp/art.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGES = +(process.env.PAGES || 46);
const AUTHOR = process.env.BOOK_AUTHOR || 'Purple Dino';
const BLEED = 0.125, TW = 8.5, TH = 11;
const SPINE = +(PAGES * 0.002252).toFixed(4);
const W = BLEED + TW + SPINE + TW + BLEED, H = TH + 2 * BLEED;
const OUT = path.join(__dirname, 'hammy-and-friends-cover.pdf');

const dataUrl = f => {
  const ext = path.extname(f).slice(1).replace('svg', 'svg+xml');
  return `data:image/${ext};base64,` + fs.readFileSync(f).toString('base64');
};
// front-scene.png is the illustration panel cut out of front.png (without its bright border)
const scene = path.join(__dirname, 'cover-art', 'front-scene.png');
const samples = ['02-sunflower-seed.svg', '03-bunny.svg', '04-turtle-ride.svg', '05-owl-night.svg']
  .map(f => path.join(__dirname, 'art', f)).filter(fs.existsSync);

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Chewy&family=Nunito:wght@600;800&display=block" rel="stylesheet">
<style>
  @page { size: ${W}in ${H}in; margin: 0; }
  body { margin: 0; }
  :root { --ink: #4A3B5C; --bg: #F1E9FF; --dot: #E2D3FF; --peach: #FFB892; --mint: #9FDDBF;
          --pink: #FFCADF; --butter: #FFF0A8; --sky: #CDE8FF; }
  .sheet { width: ${W}in; height: ${H}in; position: relative; overflow: hidden; font-family: Nunito, sans-serif; color: var(--ink);
           background: var(--bg) radial-gradient(var(--dot) 9%, transparent 10%) 0 0 / 0.55in 0.55in; }
  .back  { position: absolute; left: 0; top: 0; width: ${BLEED + TW}in; height: ${H}in; }
  .spine { position: absolute; left: ${BLEED + TW}in; top: 0; width: ${SPINE}in; height: ${H}in; background: #D9C8FF; }
  .front { position: absolute; left: ${BLEED + TW + SPINE}in; top: 0; width: ${TW + BLEED}in; height: ${H}in; }
  .card  { background: #fff; border: 0.055in solid var(--ink); border-radius: 0.35in; box-shadow: 0.1in 0.1in 0 var(--pink); }
  /* front */
  .title { position: absolute; left: 0.55in; right: 0.675in; top: ${BLEED + 0.4}in; padding: 0.22in 0.2in 0.24in; text-align: center; }
  .title h1 { margin: 0; font-family: Chewy, sans-serif; font-weight: 400; font-size: 80pt; line-height: 1;
              color: var(--peach); -webkit-text-stroke: 2.2pt var(--ink); paint-order: stroke fill; letter-spacing: 1pt; }
  .title h1 .amp { color: var(--mint); }
  .title p { margin: 0.1in 0 0; font-weight: 800; font-size: 23pt; }
  .scene { position: absolute; left: 0.75in; right: 0.875in; top: 3.8in; padding: 0; overflow: hidden; line-height: 0; }
  .scene img { width: 100%; display: block; filter: saturate(0.72) brightness(1.06) contrast(0.96); }
  .badge { position: absolute; right: 0.55in; bottom: 1.3in; width: 1.85in; height: 1.85in; border-radius: 50%;
           background: var(--butter); border: 0.05in solid var(--ink); box-shadow: 0.07in 0.07in 0 var(--sky);
           display: flex; flex-direction: column; align-items: center; justify-content: center; transform: rotate(-8deg);
           font-family: Chewy, sans-serif; font-size: 25pt; line-height: 1.05; text-align: center; }
  .badge small { font-family: Nunito, sans-serif; font-weight: 800; font-size: 12pt; margin-top: 0.04in; }
  .author { position: absolute; left: 0.75in; bottom: 0.55in; padding: 0.1in 0.2in; border-radius: 0.25in; }
  .author img { display: block; height: 0.65in; }
  /* back */
  .inner { position: absolute; left: ${BLEED + 0.5}in; right: 0.5in; top: ${BLEED + 0.5}in; bottom: ${BLEED + 0.5}in; }
  .inner h2 { margin: 0; text-align: center; font-family: Chewy, sans-serif; font-weight: 400; font-size: 50pt; color: var(--peach);
              -webkit-text-stroke: 1.7pt var(--ink); paint-order: stroke fill; }
  .blurb { margin: 0.12in auto 0; max-width: 6.6in; text-align: center; font-weight: 700; font-size: 13.5pt; line-height: 1.45; }
  .samples { display: grid; grid-template-columns: 1fr 1fr; gap: 0.28in 0.4in; width: 4.35in; margin: 0.25in auto 0; }
  .samples div { background: #fff; padding: 0.1in; border: 0.04in solid var(--ink); border-radius: 0.14in; }
  .samples div:nth-child(1) { transform: rotate(-3deg); box-shadow: 0.08in 0.08in 0 var(--pink); }
  .samples div:nth-child(2) { transform: rotate(2.5deg); box-shadow: 0.08in 0.08in 0 var(--mint); }
  .samples div:nth-child(3) { transform: rotate(2deg); box-shadow: 0.08in 0.08in 0 var(--sky); }
  .samples div:nth-child(4) { transform: rotate(-2.5deg); box-shadow: 0.08in 0.08in 0 var(--butter); }
  .samples img { display: block; width: 100%; }
  .features { position: absolute; left: 0; bottom: 0; padding: 0.12in 0.22in; font-weight: 800; font-size: 12.5pt; line-height: 1.6; }
  .backlogo { position: absolute; right: 0.1in; bottom: 1.32in; width: 1.8in; height: auto; }
  .barcode { position: absolute; right: 0; bottom: 0; width: 2in; height: 1.2in; background: #fff; }
</style></head><body><div class="sheet">
  <div class="back"><div class="inner">
    <h2>What's inside?</h2>
    <p class="blurb">Join Hammy the hamster and his animal friends on picnics, turtle rides and starry nights!
      Big, simple pictures with bold lines, perfect for little hands.</p>
    <div class="samples">${samples.map(f => `<div><img src="${dataUrl(f)}"></div>`).join('')}</div>
    <div class="features card">✔ Single-sided pages, no bleed-through<br>✔ Bold, easy lines<br>✔ 8.5 x 11 in large print</div>
    <img class="backlogo" src="${dataUrl(path.join(__dirname, 'brand', 'logo.png'))}" alt="${AUTHOR}">
    <div class="barcode"></div>
  </div></div>
  <div class="spine"></div>
  <div class="front">
    <div class="title card"><h1>Hammy <span class="amp">&amp;</span> Friends</h1><p>A Coloring Book for Kids</p></div>
    <div class="scene card"><img src="${dataUrl(scene)}"></div>
    <div class="author card"><img src="${dataUrl(path.join(__dirname, 'brand', 'logo.png'))}" alt="${AUTHOR}"></div>
    <div class="badge">Bold Lines!<small>Easy to Color</small></div>
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
