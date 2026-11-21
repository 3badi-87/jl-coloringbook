// Builds the "RoxoSky Books Co." publisher logo.
// Usage: node kdp/build-logo.js
// Output (kdp/brand/): logo.png (color, horizontal), logo-stacked.png,
// logo-mark.png (badge only), logo-bw.png (black & white, for the interior),
// logo.svg.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, 'brand');
fs.mkdirSync(OUT, { recursive: true });

const COLOR = { ink: '#4A3B5C', sky1: '#B79CF2', sky2: '#8E6BE0', moon: '#FFE9A8', star: '#FFF6D6', cloud: '#FFFFFF', roxo: '#8E6BE0', sky: '#7FB8F0', sub: '#4A3B5C' };
const BW = { ink: '#000', sky1: '#fff', sky2: '#fff', moon: '#fff', star: '#fff', cloud: '#fff', roxo: '#fff', sky: '#fff', sub: '#000' };

// round badge: purple night sky, crescent moon, stars, a puffy cloud, an open book
function mark(c, id) {
  const star = (x, y, r) => {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 5 * i - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
      p.push(`${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`);
    }
    return `<polygon points="${p.join(' ')}" fill="${c.star}" stroke="${c.ink}" stroke-width="5" stroke-linejoin="round"/>`;
  };
  return `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.sky2}"/><stop offset="1" stop-color="${c.sky1}"/></linearGradient>
    <clipPath id="c${id}"><circle cx="200" cy="200" r="180"/></clipPath></defs>
  <circle cx="200" cy="200" r="180" fill="url(#g${id})"/>
  <g clip-path="url(#c${id})">
    <path d="M150 70 A78 78 0 1 0 236 168 A62 62 0 1 1 150 70 Z" fill="${c.moon}" stroke="${c.ink}" stroke-width="8" stroke-linejoin="round"/>
    ${star(272, 92, 22)}${star(312, 160, 13)}${star(318, 232, 11)}
    <path d="M30 330 C40 290 80 280 106 296 C120 262 170 252 196 280 C220 256 270 262 280 296 C310 284 356 296 364 330 L364 420 L30 420 Z"
      fill="${c.cloud}" stroke="${c.ink}" stroke-width="8" stroke-linejoin="round"/>
    <path d="M130 318 C160 304 186 306 200 318 C214 306 240 304 270 318 L270 362 C240 350 214 352 200 362 C186 352 160 350 130 362 Z"
      fill="${c.star}" stroke="${c.ink}" stroke-width="7" stroke-linejoin="round"/>
    <path d="M200 318 V362" stroke="${c.ink}" stroke-width="6"/>
  </g>
  <circle cx="200" cy="200" r="180" fill="none" stroke="${c.ink}" stroke-width="12"/>`;
}

function word(c, x, y, size, anchor = 'start') {
  const s = `stroke="${c.ink}" stroke-width="${size * 0.085}" stroke-linejoin="round" paint-order="stroke fill"`;
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Chewy" font-size="${size}" letter-spacing="2" ${s}>
      <tspan fill="${c.roxo}">Roxo</tspan><tspan fill="${c.sky}">Sky</tspan></text>
    <text x="${x + (anchor === 'start' ? 6 : 0)}" y="${y + size * 0.62}" text-anchor="${anchor}" font-family="Nunito" font-weight="800"
      font-size="${size * 0.36}" letter-spacing="${size * 0.06}" fill="${c.sub}">BOOKS CO.</text>`;
}

const variants = {
  'logo': { w: 1160, h: 400, body: (c, id) => `${mark(c, id)}${word(c, 430, 225, 170)}` },
  'logo-stacked': { w: 760, h: 700, body: (c, id) => `<g transform="translate(180 0)">${mark(c, id)}</g>${word(c, 380, 540, 150, 'middle')}` },
  'logo-mark': { w: 400, h: 400, body: (c, id) => mark(c, id) },
};

const FONT = '<link href="https://fonts.googleapis.com/css2?family=Chewy&family=Nunito:wght@800&display=block" rel="stylesheet">';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 3 });
  let n = 0;
  const render = async (name, v, c) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${v.w}" height="${v.h}" viewBox="-10 -10 ${v.w + 20} ${v.h + 20}">${v.body(c, n++)}</svg>`;
    await page.setViewportSize({ width: v.w + 20, height: v.h + 20 });
    await page.setContent(`<html><head>${FONT}<style>body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT, name + '.png'), omitBackground: true, clip: { x: 0, y: 0, width: v.w, height: v.h } });
    return svg;
  };
  fs.writeFileSync(path.join(OUT, 'logo.svg'), await render('logo', variants.logo, COLOR));
  await render('logo-stacked', variants['logo-stacked'], COLOR);
  await render('logo-mark', variants['logo-mark'], COLOR);
  await render('logo-bw', variants.logo, BW);
  await browser.close();
  console.log('wrote', fs.readdirSync(OUT).join(', '));
})();
