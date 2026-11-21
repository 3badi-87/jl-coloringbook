// Builds the "Purple Dino" author logo.
// Usage: node kdp/build-logo.js
// Output (kdp/brand/): logo.svg, logo.png (horizontal), logo-stacked.png,
// logo-mark.png (dino only), logo-bw.png (black & white, for the interior).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, 'brand');
fs.mkdirSync(OUT, { recursive: true });

const COLOR = { line: '#3B1E5C', body: '#8B5CF6', belly: '#DDD0FF', spike: '#FFB547', foot: '#6D3FD9', blush: '#FF8FB1', eye: '#2B1A4A' };
const BW = { line: '#000', body: '#fff', belly: '#fff', spike: '#fff', foot: '#fff', blush: '#fff', eye: '#000' };

// Friendly dino, drawn in a 400 x 400 box, facing right
function dino(c) {
  // rounded back spikes, sitting along the back from tail to head
  const spikes = [[92, 222, -55, 0.8], [124, 186, -40, 1], [146, 132, -25, 1.12], [180, 86, -12, 1.12], [226, 58, 4, 1]]
    .map(([x, y, r, s]) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M -22 10 C -20 -12 -8 -30 0 -32 C 8 -30 20 -12 22 10 Z" fill="${c.spike}"/>`).join('');
  return `<g stroke="${c.line}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">
    ${spikes}
    <ellipse cx="170" cy="346" rx="36" ry="18" fill="${c.foot}"/>
    <path d="M45 225 C75 237 105 226 125 205 C140 150 170 70 250 58 C312 50 348 96 340 142 C335 176 310 196 282 200 C302 226 310 282 292 318 C270 352 150 354 118 318 C100 298 80 268 45 225 Z" fill="${c.body}"/>
    <ellipse cx="262" cy="282" rx="30" ry="48" transform="rotate(-12 262 282)" fill="${c.belly}" stroke-width="6"/>
    <path d="M248 262 C256 260 262 262 266 266 M244 286 C252 284 260 286 264 290" fill="none" stroke-width="5"/>
    <path d="M280 236 C298 230 314 236 314 248 C314 260 298 260 286 254" fill="${c.body}"/>
    <ellipse cx="258" cy="348" rx="36" ry="18" fill="${c.foot}"/>
    <path d="M246 340 v10 M262 339 v12" fill="none" stroke-width="5"/>
    <circle cx="288" cy="118" r="23" fill="#fff"/>
    <circle cx="293" cy="121" r="13.5" fill="${c.eye}" stroke="none"/>
    <circle cx="288" cy="115" r="5.5" fill="#fff" stroke="none"/>
    <circle cx="297" cy="128" r="2.5" fill="#fff" stroke="none"/>
    <ellipse cx="286" cy="160" rx="15" ry="9" fill="${c.blush}" stroke="none"/>
    <path d="M306 164 C314 174 328 172 334 160" fill="none" stroke-width="7"/>
    <circle cx="330" cy="122" r="3.5" fill="${c.line}" stroke="none"/>
  </g>`;
}

const FONT = '<link href="https://fonts.googleapis.com/css2?family=Chewy&display=block" rel="stylesheet">';
function word(c, x, y, size, anchor = 'start') {
  const t = (txt, fill, dx = 0) => `<tspan fill="${fill}" dx="${dx}">${txt}</tspan>`;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Chewy" font-size="${size}" letter-spacing="2"
    stroke="${c.line}" stroke-width="${size * 0.09}" stroke-linejoin="round" paint-order="stroke fill">${t('Purple', c === BW ? '#fff' : '#8B5CF6')}${t('Dino', c === BW ? '#fff' : '#FFB547', size * 0.25)}</text>`;
}

const variants = {
  'logo': { w: 1180, h: 400, body: c => `${dino(c)}${word(c, 400, 262, 170)}` },
  'logo-stacked': { w: 860, h: 600, body: c => `<g transform="translate(230 0)">${dino(c)}</g>${word(c, 430, 540, 140, 'middle')}` },
  'logo-mark': { w: 400, h: 400, body: c => dino(c) },
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 3 });
  const render = async (name, v, c) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${v.w}" height="${v.h}" viewBox="-10 -10 ${v.w + 20} ${v.h + 20}">${v.body(c)}</svg>`;
    await page.setViewportSize({ width: v.w + 20, height: v.h + 20 });
    await page.setContent(`<html><head>${FONT}<style>body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, name + '.png'), omitBackground: true, clip: { x: 0, y: 0, width: v.w, height: v.h } });
    return svg;
  };
  const svg = await render('logo', variants.logo, COLOR);
  fs.writeFileSync(path.join(OUT, 'logo.svg'), svg.replace('<svg ', '<svg font-family="Chewy" '));
  await render('logo-stacked', variants['logo-stacked'], COLOR);
  await render('logo-mark', variants['logo-mark'], COLOR);
  await render('logo-bw', variants.logo, BW);
  await browser.close();
  console.log('wrote', fs.readdirSync(OUT).join(', '));
})();
