// Builds the Amazon KDP interior PDF for "Hammy & Friends".
// Usage: node kdp/build-interior.js   (needs Playwright + Chromium)
//
// Trim 8.5 x 11 in, no bleed (all art sits inside the margins), black & white.
// Every coloring page is printed on its own sheet with a blank back, so
// markers cannot bleed through onto the next picture.
// Art lives in kdp/art/*.svg (vector line art traced from the Canva images),
// so it prints sharp at any resolution.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ART = path.join(__dirname, 'art');
const OUT = path.join(__dirname, 'hammy-and-friends-interior.pdf');
const AUTHOR = process.env.BOOK_AUTHOR || 'RoxoSky Books Co.';
const LOGO_BW = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'brand', 'logo-bw.png')).toString('base64');
// small publisher footer at the bottom of every content page (blank backs stay blank)
const footer = `<img class="footer" src="${LOGO_BW}" alt="${AUTHOR}">`;
const YEAR = new Date().getFullYear();

const svgData = f => 'data:image/svg+xml;base64,' + fs.readFileSync(path.join(ART, f)).toString('base64');
const art = fs.readdirSync(ART).filter(f => f.endsWith('.svg')).sort();

const blank = '<section class="page"></section>';
const pages = [];

// 1. This book belongs to (the cover already carries the title)
pages.push(`<section class="page center">
  <h2>This book belongs to</h2>
  <div class="name-line"></div>
  <img class="belongs-art" src="${svgData('04-turtle-ride.svg')}">
  ${footer}
</section>`);

// 2. Copyright page (back of page 1)
pages.push(`<section class="page copyright">
  <p>Hammy &amp; Friends: A Coloring Book for Kids</p>
  <p>Published by ${AUTHOR}</p>
  <p>Copyright &copy; ${YEAR} ${AUTHOR}. All rights reserved.</p>
  <p>No part of this book may be reproduced in any form without written permission from the author, except for personal use by the purchaser.</p>
  <p>Coloring tip: each picture is printed on its own page. Slip a sheet of paper behind the page when using markers.</p>
  ${footer}
</section>`);

// 3. Color test page (+ blank back)
pages.push(`<section class="page center">
  <h2>Test Your Colors</h2>
  <div class="swatches">${'<div></div>'.repeat(30)}</div>
  ${footer}
</section>`, blank);

// 4. Coloring pages, single-sided
for (const f of art) pages.push(`<section class="page art"><img class="pic" src="${svgData(f)}">${footer}</section>`, blank);

// KDP needs an even page count of at least 24
const count = pages.length;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Chewy&family=Nunito:wght@400;700&display=block" rel="stylesheet">
<style>
  @page { size: 8.5in 11in; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Nunito, sans-serif; color: #000; }
  .page { width: 8.5in; height: 11in; padding: 0.6in; page-break-after: always; position: relative; overflow: hidden; }
  .center { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  h1 { font-family: Chewy, sans-serif; font-weight: 400; font-size: 58pt; margin: 0; letter-spacing: 2pt; white-space: nowrap;
       color: #fff; -webkit-text-stroke: 3pt #000; paint-order: stroke fill; }
  h1 span { font-size: 46pt; }
  .sub { font-size: 24pt; font-weight: 700; margin: 0.1in 0 0.3in; }
  .title-art { width: 4.8in; }
  .footer { position: absolute; left: 50%; bottom: 0.27in; transform: translateX(-50%); height: 0.34in; }
  h2 { font-family: Chewy, sans-serif; font-weight: 400; font-size: 44pt; margin: 0 0 0.3in; }
  .name-line { width: 5in; border-bottom: 3pt solid #000; height: 0.7in; margin-bottom: 0.4in; }
  .belongs-art { width: 5in; }
  .swatches { display: grid; grid-template-columns: repeat(5, 1.1in); gap: 0.2in; }
  .swatches div { height: 1.1in; border: 2.5pt solid #000; border-radius: 0.2in; }
  .copyright { display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 1.1in; font-size: 10.5pt; line-height: 1.5; }
  .copyright p { margin: 0 0 0.12in; max-width: 5.5in; }
  .art { display: flex; align-items: center; justify-content: center; padding: 0.45in 0.45in 0.72in; }
  .art .pic { width: 100%; height: 100%; object-fit: contain; }
</style></head><body>${pages.join('\n')}</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: OUT, width: '8.5in', height: '11in', printBackground: true });
  await browser.close();
  console.log(`wrote ${OUT}: ${count} pages${count < 24 ? ` (KDP minimum is 24: add ${Math.ceil((24 - count) / 2)} more pictures)` : ''}`);
})();
