// Builds the "Hammy & Friends" coloring book pages.
// Usage: node build.js   (needs Playwright + Chromium)
// Output: images/page-1.png ... page-8.png and hammy-and-friends.pdf
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const W = 850, H = 1100, SW = 7; // page size and base outline width

// ---------- helpers ----------
const grp = (x, y, s, body, flip = false) =>
  `<g transform="translate(${x} ${y}) scale(${flip ? -s : s} ${s})" stroke-width="${SW / s}">${body}</g>`;
const thin = (s, f = 0.7) => `stroke-width="${(SW / s) * f}"`;
const BLK = 'fill="#000" stroke="none"';

function eye(x, y, r) {
  return `<circle cx="${x}" cy="${y}" r="${r}" ${BLK}/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#fff" stroke="none"/>`;
}

// ---------- characters ----------
function hamster(x, y, s = 1, { flip = false, hold = '', sleepy = false } = {}) {
  const t = thin(s);
  return grp(x, y, s, `
    <circle cx="-58" cy="-118" r="24"/><circle cx="-58" cy="-118" r="11" ${t}/>
    <circle cx="58" cy="-118" r="24"/><circle cx="58" cy="-118" r="11" ${t}/>
    <ellipse cx="-52" cy="112" rx="30" ry="15"/><ellipse cx="52" cy="112" rx="30" ry="15"/>
    <ellipse cx="0" cy="30" rx="98" ry="86"/>
    <ellipse cx="0" cy="48" rx="58" ry="55" ${t}/>
    <ellipse cx="0" cy="-68" rx="80" ry="64"/>
    <path d="M -22 -128 Q 0 -112 22 -128" fill="none" ${t}/>
    <ellipse cx="-50" cy="-42" rx="20" ry="15" ${t}/><ellipse cx="50" cy="-42" rx="20" ry="15" ${t}/>
    ${sleepy ? `<path d="M -40 -80 Q -28 -70 -16 -80 M 16 -80 Q 28 -70 40 -80" fill="none"/>` : eye(-28, -82, 10) + eye(28, -82, 10)}
    <ellipse cx="0" cy="-62" rx="8" ry="6" ${BLK}/>
    <path d="M -14 -50 Q -7 -40 0 -50 Q 7 -40 14 -50" fill="none" ${t}/>
    <path d="M -72 -62 L -110 -70 M -72 -52 L -110 -50 M 72 -62 L 110 -70 M 72 -52 L 110 -50" fill="none" ${thin(s, 0.5)}/>
    ${hold}
    <ellipse cx="-30" cy="5" rx="17" ry="13"/><ellipse cx="30" cy="5" rx="17" ry="13"/>
  `, flip);
}

function seedShape(cx, cy, s) {
  return `<path d="M ${cx} ${cy - 30 * s} Q ${cx + 22 * s} ${cy} ${cx} ${cy + 28 * s} Q ${cx - 22 * s} ${cy} ${cx} ${cy - 30 * s} Z"/>
    <path d="M ${cx} ${cy - 20 * s} L ${cx} ${cy + 18 * s}" fill="none"/>`;
}

function bunny(x, y, s = 1, flip = false) {
  const t = thin(s);
  return grp(x, y, s, `
    <ellipse cx="-28" cy="-175" rx="20" ry="58" transform="rotate(-10 -28 -175)"/>
    <ellipse cx="-28" cy="-172" rx="9" ry="40" transform="rotate(-10 -28 -172)" ${t}/>
    <ellipse cx="28" cy="-175" rx="20" ry="58" transform="rotate(10 28 -175)"/>
    <ellipse cx="28" cy="-172" rx="9" ry="40" transform="rotate(10 28 -172)" ${t}/>
    <circle cx="68" cy="55" r="22"/>
    <ellipse cx="-38" cy="95" rx="34" ry="15"/><ellipse cx="38" cy="95" rx="34" ry="15"/>
    <ellipse cx="0" cy="25" rx="72" ry="75"/>
    <ellipse cx="0" cy="40" rx="42" ry="46" ${t}/>
    <circle cx="0" cy="-78" r="58"/>
    ${eye(-21, -88, 8)}${eye(21, -88, 8)}
    <ellipse cx="0" cy="-68" rx="8" ry="6" ${BLK}/>
    <path d="M 0 -62 L 0 -54 M -12 -50 Q -6 -44 0 -54 Q 6 -44 12 -50" fill="none" ${t}/>
    <rect x="-7" y="-52" width="14" height="11" rx="2" ${thin(s, 0.5)}/>
    <path d="M -45 -66 L -80 -72 M -45 -58 L -80 -56 M 45 -66 L 80 -72 M 45 -58 L 80 -56" fill="none" ${thin(s, 0.5)}/>
    <ellipse cx="-36" cy="-58" rx="10" ry="7" ${thin(s, 0.5)}/><ellipse cx="36" cy="-58" rx="10" ry="7" ${thin(s, 0.5)}/>
    <ellipse cx="-30" cy="0" rx="15" ry="12"/><ellipse cx="30" cy="0" rx="15" ry="12"/>
  `, flip);
}

function carrot(x, y, s = 1, rot = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" stroke-width="${SW / s}">
    <path d="M -10 -45 Q -25 -75 -5 -80 Q 0 -60 0 -48 Q 5 -70 22 -72 Q 20 -52 8 -45 Z"/>
    <path d="M -20 -45 Q 0 -52 20 -45 Q 10 20 0 60 Q -10 20 -20 -45 Z"/>
    <path d="M -12 -20 L -2 -18 M 4 0 L 12 -2 M -8 20 L 0 22" fill="none" ${thin(s, 0.6)}/>
  </g>`;
}

function turtle(x, y, s = 1, flip = false) {
  const t = thin(s);
  // hexagon on shell
  const hex = [...Array(6)].map((_, i) => {
    const a = Math.PI / 3 * i;
    return [Math.cos(a) * 30, -35 + Math.sin(a) * 26];
  });
  const hexPath = 'M ' + hex.map(p => p.map(v => v.toFixed(1)).join(' ')).join(' L ') + ' Z';
  return grp(x, y, s, `
    <path d="M -100 15 L -135 25 L -100 35 Z"/>
    <ellipse cx="-60" cy="45" rx="24" ry="30"/><ellipse cx="60" cy="45" rx="24" ry="30"/>
    <ellipse cx="88" cy="5" rx="34" ry="22"/>
    <circle cx="125" cy="-12" r="36"/>
    ${eye(133, -22, 7)}
    <path d="M 120 2 Q 135 12 150 0" fill="none" ${t}/>
    <ellipse cx="108" cy="-2" rx="8" ry="5" ${thin(s, 0.5)}/>
    <path d="M -100 20 Q -100 -95 0 -95 Q 100 -95 100 20 Z"/>
    <path d="M -112 20 L 112 20 Q 116 42 92 42 L -92 42 Q -116 42 -112 20 Z"/>
    <path d="${hexPath}" ${t}/>
    <path d="M 30 -35 L 92 -35 M -30 -35 L -92 -35 M 15 -12 L 40 20 M -15 -12 L -40 20 M 15 -58 L 35 -88 M -15 -58 L -35 -88" fill="none" ${t}/>
  `, flip);
}

function owl(x, y, s = 1) {
  const t = thin(s);
  const v = (cx, cy) => `<path d="M ${cx - 9} ${cy} Q ${cx} ${cy + 10} ${cx + 9} ${cy}" fill="none" ${thin(s, 0.6)}/>`;
  return grp(x, y, s, `
    <path d="M -62 -60 L -62 -118 L -22 -88 Z"/><path d="M 62 -60 L 62 -118 L 22 -88 Z"/>
    <ellipse cx="-24" cy="96" rx="16" ry="10"/><ellipse cx="24" cy="96" rx="16" ry="10"/>
    <ellipse cx="0" cy="0" rx="78" ry="98"/>
    <ellipse cx="0" cy="35" rx="48" ry="55" ${t}/>
    ${v(-18, 15)}${v(18, 15)}${v(0, 38)}${v(-20, 60)}${v(20, 60)}
    <ellipse cx="-72" cy="15" rx="24" ry="55" transform="rotate(15 -72 15)"/>
    <ellipse cx="72" cy="15" rx="24" ry="55" transform="rotate(-15 72 15)"/>
    <circle cx="-30" cy="-45" r="29"/><circle cx="30" cy="-45" r="29"/>
    ${eye(-30, -45, 13)}${eye(30, -45, 13)}
    <path d="M -11 -22 L 11 -22 L 0 -2 Z"/>
  `);
}

function duck(x, y, s = 1, flip = false) {
  const t = thin(s);
  return grp(x, y, s, `
    <path d="M -70 0 L -125 -30 L -100 35 Z"/>
    <ellipse cx="0" cy="20" rx="95" ry="55"/>
    <path d="M -45 10 Q 5 -15 45 15 Q 0 55 -45 10 Z" ${t}/>
    <path d="M -10 15 Q 5 25 20 18" fill="none" ${thin(s, 0.5)}/>
    <circle cx="62" cy="-60" r="44"/>
    <path d="M 95 -62 Q 140 -70 142 -52 Q 138 -38 98 -42 Z"/>
    <path d="M 100 -52 L 135 -53" fill="none" ${thin(s, 0.5)}/>
    ${eye(72, -72, 7)}
    <ellipse cx="55" cy="-45" rx="10" ry="6" ${thin(s, 0.5)}/>
  `, flip);
}

function puppy(x, y, s = 1, flip = false) {
  const t = thin(s);
  return grp(x, y, s, `
    <path d="M 60 70 Q 120 60 110 0 Q 108 -12 100 -5 Q 100 40 55 50" />
    <ellipse cx="-48" cy="118" rx="32" ry="15"/><ellipse cx="48" cy="118" rx="32" ry="15"/>
    <ellipse cx="0" cy="45" rx="72" ry="80"/>
    <ellipse cx="32" cy="35" rx="20" ry="16" ${t}/>
    <rect x="-42" y="40" width="28" height="80" rx="14"/><rect x="14" y="40" width="28" height="80" rx="14"/>
    <path d="M -50 -22 Q 0 -5 50 -22 L 48 -8 Q 0 10 -48 -8 Z" ${t}/>
    <circle cx="0" cy="12" r="11" ${t}/>
    <circle cx="0" cy="-75" r="66"/>
    <ellipse cx="-66" cy="-62" rx="22" ry="48" transform="rotate(18 -66 -62)"/>
    <ellipse cx="66" cy="-62" rx="22" ry="48" transform="rotate(-18 66 -62)"/>
    <ellipse cx="28" cy="-92" rx="17" ry="14" ${thin(s, 0.5)}/>
    ${eye(-25, -90, 9)}${eye(28, -90, 9)}
    <ellipse cx="0" cy="-48" rx="32" ry="24" ${t}/>
    <ellipse cx="0" cy="-58" rx="11" ry="8" ${BLK}/>
    <path d="M 0 -50 L 0 -40 M -14 -34 Q -7 -28 0 -40 Q 7 -28 14 -34" fill="none" ${t}/>
    <path d="M -6 -32 Q 0 -14 8 -32" ${thin(s, 0.6)}/>
  `, flip);
}

// ---------- scenery ----------
function sun(x, y, r) {
  const rays = [...Array(10)].map((_, i) => {
    const a = (Math.PI * 2 / 10) * i;
    const c = Math.cos(a), sn = Math.sin(a);
    return `M ${(x + c * (r + 14)).toFixed(1)} ${(y + sn * (r + 14)).toFixed(1)} L ${(x + c * (r + 42)).toFixed(1)} ${(y + sn * (r + 42)).toFixed(1)}`;
  }).join(' ');
  return `<path d="${rays}" fill="none"/><circle cx="${x}" cy="${y}" r="${r}"/>
    ${eye(x - r * 0.33, y - r * 0.15, r * 0.1)}${eye(x + r * 0.33, y - r * 0.15, r * 0.1)}
    <path d="M ${x - r * 0.35} ${y + r * 0.25} Q ${x} ${y + r * 0.6} ${x + r * 0.35} ${y + r * 0.25}" fill="none"/>`;
}

function cloud(x, y, s = 1) {
  return grp(x, y, s, `<path d="M -70 25 Q -95 25 -90 2 Q -85 -20 -58 -15 Q -55 -50 -15 -48 Q 10 -70 40 -45 Q 75 -50 75 -15 Q 100 -10 92 12 Q 88 28 65 25 Z"/>`);
}

function flower(x, ground, h, s = 1) {
  const top = ground - h;
  const petals = [...Array(5)].map((_, i) => {
    const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
    return `<circle cx="${(x + Math.cos(a) * 22 * s).toFixed(1)}" cy="${(top + Math.sin(a) * 22 * s).toFixed(1)}" r="${15 * s}"/>`;
  }).join('');
  return `<path d="M ${x} ${ground} L ${x} ${top}" fill="none"/>
    <path d="M ${x} ${ground - h * 0.4} Q ${x + 30 * s} ${ground - h * 0.6} ${x + 40 * s} ${ground - h * 0.4} Q ${x + 20 * s} ${ground - h * 0.25} ${x} ${ground - h * 0.4} Z"/>
    ${petals}<circle cx="${x}" cy="${top}" r="${14 * s}"/>`;
}

function ground(y) {
  return `<path d="M -10 ${y} Q 110 ${y - 30} 230 ${y} T 470 ${y} T 710 ${y} T 950 ${y} L 950 ${H + 20} L -10 ${H + 20} Z"/>`;
}

function grassTufts(y, xs) {
  return xs.map(x => `<path d="M ${x - 6} ${y} Q ${x - 10} ${y - 18} ${x - 24} ${y - 26} M ${x} ${y} Q ${x} ${y - 22} ${x + 2} ${y - 36} M ${x + 6} ${y} Q ${x + 10} ${y - 18} ${x + 24} ${y - 26}" fill="none" stroke-width="${SW * 0.7}"/>`).join('');
}

function tree(x, groundY, s = 1) {
  return grp(x, groundY, s, `
    <path d="M -25 0 L -18 -150 L 18 -150 L 25 0 Z"/>
    <path d="M -10 -60 Q 0 -70 8 -58" fill="none" ${thin(s, 0.5)}/>
    <path d="M -95 -170 Q -125 -220 -80 -250 Q -80 -310 -20 -310 Q 20 -345 65 -300 Q 120 -295 110 -240 Q 140 -190 95 -160 Q 60 -130 0 -150 Q -60 -125 -95 -170 Z"/>
    <circle cx="-40" cy="-220" r="12" ${thin(s, 0.7)}/><circle cx="45" cy="-250" r="12" ${thin(s, 0.7)}/><circle cx="30" cy="-190" r="12" ${thin(s, 0.7)}/>
  `);
}

function star(x, y, r) {
  const pts = [...Array(10)].map((_, i) => {
    const a = Math.PI / 5 * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  });
  return `<path d="M ${pts.join(' L ')} Z"/>`;
}

function heart(x, y, s = 1) {
  return grp(x, y, s, `<path d="M 0 30 Q -50 -5 -40 -28 Q -28 -50 0 -28 Q 28 -50 40 -28 Q 50 -5 0 30 Z"/>`);
}

function moon(x, y, r) {
  return `<path d="M ${x} ${y - r} A ${r} ${r} 0 1 0 ${x + r * 0.9} ${y + r * 0.45} A ${r * 0.8} ${r * 0.8} 0 1 1 ${x} ${y - r} Z"/>`;
}

function ball(x, y, r) {
  return `<circle cx="${x}" cy="${y}" r="${r}"/>
    <path d="M ${x - r} ${y} Q ${x} ${y - r * 0.5} ${x + r} ${y} M ${x - r * 0.85} ${y + r * 0.5} Q ${x} ${y + r * 0.1} ${x + r * 0.85} ${y + r * 0.5}" fill="none"/>
    <circle cx="${x}" cy="${y - r * 0.6}" r="${r * 0.15}"/>`;
}

function title(text, y = 110, size = 76) {
  return `<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="Fredoka, 'Inter Display', sans-serif" font-weight="700"
    font-size="${size}" fill="#fff" stroke="#000" stroke-width="${SW * 0.8}" paint-order="stroke" letter-spacing="2">${text}</text>
    <text x="${W / 2}" y="${y}" text-anchor="middle" font-family="Fredoka, 'Inter Display', sans-serif" font-weight="700"
    font-size="${size}" fill="#fff" stroke="none" letter-spacing="2">${text}</text>`;
}

// ---------- pages ----------
const pages = [
  // 1. Cover
  () => `
    ${title('Hammy &amp; Friends', 130, 96)}
    ${title('A Coloring Book', 215, 46)}
    ${star(120, 300, 34)}${star(730, 320, 34)}${star(650, 250, 20)}${star(200, 380, 20)}
    ${heart(140, 560, 0.9)}${heart(710, 560, 0.9)}
    ${ground(880)}
    ${grassTufts(960, [90, 300, 560, 770])}
    ${flower(90, 880, 120)}${flower(760, 880, 140)}
    ${hamster(425, 690, 1.65)}
    ${title('This book belongs to:', 1010, 34)}
    <path d="M 220 1065 L 630 1065" fill="none"/>`,

  // 2. Hammy and his seed
  () => `
    ${title("Hi! I'm Hammy!")}
    ${sun(690, 260, 62)}
    ${cloud(180, 250, 1.1)}${cloud(420, 330, 0.7)}
    ${ground(860)}
    ${grassTufts(950, [120, 380, 640])}
    ${flower(110, 860, 170, 1.1)}${flower(740, 860, 130)}${flower(640, 860, 90, 0.8)}
    ${hamster(400, 690, 1.55, { hold: seedShape(0, -2, 0.9) })}`,

  // 3. Bunny
  () => `
    ${title('Hammy meets Bunny')}
    ${cloud(160, 220, 0.9)}${cloud(690, 260, 1)}
    ${ground(850)}
    ${grassTufts(960, [80, 330, 600, 790])}
    ${flower(420, 850, 110, 0.9)}
    ${bunny(610, 700, 1.4)}
    ${hamster(220, 740, 1.15)}
    ${carrot(420, 930, 0.9, 70)}`,

  // 4. Turtle
  () => `
    ${title('Slow and steady!')}
    ${sun(700, 250, 55)}
    ${cloud(420, 240, 0.9)}
    ${ground(820)}
    ${tree(140, 830, 1.1)}
    ${grassTufts(1020, [120, 450, 780])}
    ${turtle(310, 890, 1.35)}
    ${hamster(670, 880, 0.95)}
    ${flower(790, 820, 100, 0.8)}`,

  // 5. Owl at night
  () => `
    ${title('Goodnight, Owl!')}
    ${moon(660, 260, 80)}
    ${star(140, 230, 28)}${star(430, 340, 18)}${star(470, 220, 22)}${star(780, 420, 18)}${star(90, 430, 18)}
    <path d="M -10 555 Q 250 540 520 560 L 470 600 Q 250 585 -10 595 Z"/>
    <path d="M 430 548 Q 450 515 485 505 Q 470 535 430 548 Z"/>
    <path d="M 380 548 Q 380 515 405 500 Q 410 530 380 548 Z"/>
    ${owl(300, 455, 1.05)}
    ${ground(920)}
    ${grassTufts(1010, [100, 360, 700])}
    ${hamster(560, 860, 1.05, { sleepy: true })}
    ${title('z z z', 680, 44).replace(/x="425"/g, 'x="720"')}`,

  // 6. Duck
  () => `
    ${title('Splash with Duck!')}
    ${sun(700, 240, 55)}
    ${cloud(200, 240, 1)}
    <path d="M -10 560 Q 200 520 425 560 T 860 560 L 860 1110 L -10 1110 Z"/>
    <ellipse cx="560" cy="820" rx="260" ry="110"/>
    <path d="M 380 820 Q 400 805 420 820 Q 440 835 460 820 M 640 860 Q 660 845 680 860 Q 700 875 720 860 M 480 890 Q 500 875 520 890" fill="none"/>
    ${duck(560, 760, 1.1)}
    ${flower(90, 640, 90, 0.8)}
    ${hamster(170, 880, 1.05)}
    ${grassTufts(1060, [80, 300, 520, 760])}`,

  // 7. Puppy
  () => `
    ${title('Play ball, Puppy!')}
    ${cloud(170, 230, 0.9)}${cloud(650, 270, 1.1)}
    ${ground(820)}
    ${grassTufts(1010, [90, 450, 780])}
    ${puppy(590, 760, 1.35)}
    ${hamster(220, 820, 1.05)}
    ${ball(410, 960, 58)}
    <path d="M 340 900 Q 320 880 330 860 M 480 900 Q 500 880 490 860" fill="none"/>`,

  // 8. Best friends
  () => `
    ${title('Best Friends!')}
    ${heart(425, 230, 1.6)}${star(140, 220, 26)}${star(710, 220, 26)}
    ${ground(700)}
    ${grassTufts(1050, [60, 790])}
    ${owl(150, 600, 0.78)}
    ${bunny(700, 580, 0.95)}
    ${puppy(425, 555, 0.95)}
    ${turtle(165, 935, 0.85)}
    ${duck(690, 940, 0.8, true)}
    ${hamster(425, 905, 1.0)}`,
];

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#fff"/>
    <g fill="#fff" stroke="#000" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">${body}</g>
  </svg>`;
}

const FONT = '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@700&display=block" rel="stylesheet">';

(async () => {
  const outDir = path.join(__dirname, 'images');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

  const svgs = pages.map(p => svg(p()));
  for (let i = 0; i < svgs.length; i++) {
    await page.setContent(`<html><head>${FONT}<style>body{margin:0}svg{display:block}</style></head><body>${svgs[i]}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(outDir, `page-${i + 1}.png`), clip: { x: 0, y: 0, width: W, height: H } });
    console.log('wrote page', i + 1);
  }

  const book = svgs.map(s => `<div class="pg">${s}</div>`).join('');
  await page.setContent(`<html><head>${FONT}<style>
    @page{size:letter;margin:0} body{margin:0}
    .pg{width:8.5in;height:11in;page-break-after:always;display:flex;align-items:center;justify-content:center}
    .pg svg{width:8.1in;height:auto}
  </style></head><body>${book}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(__dirname, 'hammy-and-friends.pdf'), format: 'Letter', printBackground: true });
  console.log('wrote pdf');
  await browser.close();
})();
