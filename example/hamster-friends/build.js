// Builds the "Hammy & Friends" coloring book pages.
// Usage: node build.js   (needs Playwright + Chromium)
// Output: images/page-1.png ... page-8.png and hammy-and-friends.pdf
//
// Shapes are drawn from hand-placed points joined by smooth curves, with fur
// tufts, toes and feathers, then given a slight ink wobble so the pages look
// hand-drawn rather than geometric.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const W = 850, H = 1100, SW = 6.5; // page size and base outline width

// ---------- drawing helpers ----------
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const J = a => (rnd() * 2 - 1) * a;
const f = n => (+n).toFixed(1);

// Catmull-Rom curve through points. A point [x, y, 1] is a sharp corner.
function smooth(pts, closed = true, t = 1) {
  const n = pts.length;
  const get = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  const k = t / 6;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const c1 = p1[2] ? p1 : [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = p2[2] ? p2 : [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? ' Z' : '');
}
const P = (pts, a = '') => `<path d="${smooth(pts, true)}" ${a}/>`;
const L = (pts, a = '') => `<path d="${smooth(pts, false)}" fill="none" ${a}/>`;
const mx = pts => pts.map(([x, y, s]) => [-x, y, s]);

function ep(cx, cy, rx, ry, deg, j = 0) {
  const a = deg * Math.PI / 180, k = 1 + J(j);
  return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
}
// points along an ellipse (angles in degrees, clockwise on screen)
function arc(cx, cy, rx, ry, a0, a1, n, j = 0.015) {
  const p = [];
  for (let i = 0; i <= n; i++) p.push(ep(cx, cy, rx, ry, a0 + (a1 - a0) * i / n, j));
  return p;
}
// furry edge: smooth base points with sharp tufts poking out
function fur(cx, cy, rx, ry, a0, a1, n, d = 12, lean = 0.6) {
  const p = [];
  for (let i = 0; i < n; i++) {
    p.push(ep(cx, cy, rx, ry, a0 + (a1 - a0) * i / n, 0.02));
    const dd = d * (0.7 + rnd() * 0.6);
    p.push([...ep(cx, cy, rx + dd, ry + dd, a0 + (a1 - a0) * (i + lean) / n), 1]);
  }
  p.push(ep(cx, cy, rx, ry, a1, 0.02));
  return p;
}
// puffy scalloped edge (clouds, tree tops)
function bumps(cx, cy, rx, ry, a0, a1, n, d = 18) {
  const p = [];
  for (let i = 0; i < n; i++) {
    p.push([...ep(cx, cy, rx, ry, a0 + (a1 - a0) * i / n, 0.03), 1]);
    const dd = d * (0.75 + rnd() * 0.5);
    for (const [u, k] of [[0.12, 0.7], [0.32, 0.97], [0.5, 1.05], [0.68, 0.97], [0.88, 0.7]])
      p.push(ep(cx, cy, rx + dd * k, ry + dd * k, a0 + (a1 - a0) * (i + u) / n));
  }
  p.push([...ep(cx, cy, rx, ry, a1, 0.03), 1]);
  return p;
}
function join(...parts) {
  const out = [];
  for (const part of parts) for (const q of part) {
    const last = out[out.length - 1];
    if (last && Math.hypot(last[0] - q[0], last[1] - q[1]) < 4) continue;
    out.push(q);
  }
  return out;
}

const grp = (x, y, s, body, flip = false, rot = 0) =>
  `<g transform="translate(${f(x)} ${f(y)}) rotate(${rot}) scale(${flip ? -s : s} ${s})" stroke-width="${f(SW / s)}">${body}</g>`;
const thin = (s, k = 0.7) => `stroke-width="${f((SW / s) * k)}"`;
const BLK = 'fill="#000" stroke="none"';

function eye(x, y, rx, ry = rx * 1.15) {
  return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}" ${BLK}/>
    <circle cx="${f(x - rx * 0.3)}" cy="${f(y - ry * 0.35)}" r="${f(rx * 0.38)}" fill="#fff" stroke="none"/>
    <circle cx="${f(x + rx * 0.35)}" cy="${f(y + ry * 0.35)}" r="${f(rx * 0.15)}" fill="#fff" stroke="none"/>`;
}
// three little blush strokes
function blush(x, y, s, k = 1) {
  const t = thin(s, 0.45);
  return [0, 1, 2].map(i => L([[x - 9 * k + i * 8 * k, y + 5 * k], [x - 4 * k + i * 8 * k, y - 5 * k]], t)).join('');
}
function whiskers(x, y, dir, s, len = 55) {
  const t = thin(s, 0.4);
  return [-8, 0, 9].map((dy, i) =>
    L([[x, y + dy], [x + dir * len * 0.5, y + dy * 1.6 - 3], [x + dir * len * (0.9 + i * 0.08), y + dy * 2.6 + J(3)]], t)).join('');
}

// ---------- occupancy (keeps the background filler off the characters) ----------
const OCC = [];
function block(x, y, rx, ry) { OCC.push([x, y, rx, ry]); return ''; }
function free(x, y, r, gap = 7) {
  for (const [ox, oy, rx, ry] of OCC) {
    const dx = (x - ox) / (rx + r + gap), dy = (y - oy) / (ry + r + gap);
    if (dx * dx + dy * dy < 1) return false;
  }
  return true;
}

// ---------- little decorative motifs used inside shapes ----------
function mFlower(x, y, r, t) {
  let o = '';
  for (let i = 0; i < 5; i++) { const [px, py] = ep(x, y, r * 0.58, r * 0.58, i * 72 - 90); o += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(r * 0.42)}" ${t}/>`; }
  return o + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.3)}" ${t}/>`;
}
function mHeart(x, y, r, t) {
  const k = r / 40;
  return `<path d="${smooth([[0, -20, 1], [16, -38], [36, -34], [42, -14], [28, 10], [0, 34, 1], [-28, 10], [-42, -14], [-36, -34], [-16, -38]].map(([a, b, c]) => [x + a * k, y + b * k, c]))}" ${t}/>`;
}
function mDots(x, y, r, t) { return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.45)}" ${t}/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.15)}" ${t}/>`; }
function mScale(x, y, r, t) { return L([[x - r, y - r * 0.2], [x - r * 0.5, y + r * 0.5], [x, y + r * 0.7], [x + r * 0.5, y + r * 0.5], [x + r, y - r * 0.2]], t); }
function grid(kinds, x0, y0, x1, y1, step, t) {
  let o = '', row = 0;
  for (let y = y0; y <= y1 + step; y += step * 0.86, row++)
    for (let x = x0 + (row % 2 ? step / 2 : 0); x <= x1 + step; x += step) {
      const n = kinds.length, k = kinds[(((row + Math.round(x / step)) % n) + n) % n];
      o += k(x, y, step * 0.36, t);
    }
  return o;
}
let clipN = 0;
function patterned(pts, kinds, box, step, t) {
  const id = 'clip' + (clipN++);
  return `<clipPath id="${id}"><path d="${smooth(pts)}"/></clipPath><g clip-path="url(#${id})">${grid(kinds, ...box, step, t)}</g>`;
}

// ---------- characters ----------
function hamster(x, y, s = 1, { flip = false, hold = true, sleepy = false } = {}) {
  block(x, y - 12 * s, 140 * s, 138 * s);
  const t = thin(s, 0.6), t2 = thin(s, 0.45);
  const ear = (cx, cy, rot) => `<g transform="rotate(${rot} ${cx} ${cy})">
      ${P([[cx - 26, cy + 10], [cx - 26, cy - 10], [cx - 12, cy - 26], [cx + 8, cy - 27], [cx + 24, cy - 14], [cx + 26, cy + 8]])}
      ${L([[cx - 14, cy + 8], [cx - 13, cy - 6], [cx - 3, cy - 15], [cx + 9, cy - 14], [cx + 15, cy - 2], [cx + 14, cy + 8]], t)}</g>`;
  // one soft silhouette: round head with full cheeks melting into a chubby body
  const side = [[0, -128], [-48, -124], [-86, -104], [-110, -72], [-122, -40], [-114, -10], [-122, 24], [-126, 58], [-110, 92], [-64, 112]];
  const outline = [...side, [0, 116], ...mx(side).reverse().slice(0, -1)];
  const foot = (fx, fy, m) => P([[-26, 4], [-20, -10], [0, -14], [20, -10], [28, 2], [24, 12, 1], [16, 14], [10, 11, 1], [3, 14], [-4, 11, 1], [-12, 14], [-22, 12]]
      .map(([px, py, sh]) => [fx + px * m, fy + py, sh]));
  const paw = (px, py, m) => P([[-11, 9], [-13, -3], [-6, -12], [4, -13], [11, -7], [12, 2], [5, 10]].map(([a, b]) => [px + a * m, py + b]))
      + L([[px + 4 * m, py - 12], [px + 2 * m, py - 6]], t2) + L([[px + 11 * m, py - 4], [px + 5 * m, py - 2]], t2);
  const seedShape = `<g transform="rotate(10 0 -4)">${P([[0, -30, 1], [11, -12], [10, 10], [0, 20], [-10, 10], [-11, -12]])}
      ${L([[-3, -20], [-4, 10]], t2)}${L([[4, -20], [4, 10]], t2)}</g>`;
  const eyes = sleepy
    ? L([[-52, -70], [-38, -62], [-24, -70]], thin(s, 0.8)) + L([[24, -70], [38, -62], [52, -70]], thin(s, 0.8))
    : eye(-38, -70, 13, 15) + eye(38, -70, 13, 15);
  return grp(x, y, s, `
    ${ear(-72, -118, -24)}${ear(72, -118, 24)}
    ${P(outline)}
    ${L([[-78, 12], [-84, 50], [-72, 86], [-48, 106]], t)}${L([[78, 12], [84, 50], [72, 86], [48, 106]], t)}
    ${L([[-8, -122], [-6, -108]], t2)}${L([[0, -124], [0, -109]], t2)}${L([[8, -122], [6, -108]], t2)}
    ${eyes}
    <ellipse cx="-72" cy="-36" rx="15" ry="9" ${t2}/><ellipse cx="72" cy="-36" rx="15" ry="9" ${t2}/>
    ${P([[-8, -58], [0, -61], [8, -58], [3, -51], [0, -50], [-3, -51]], BLK)}
    ${L([[0, -50], [0, -43]], t)}
    ${L([[-11, -40], [-5, -36], [0, -43]], t)}${L([[0, -43], [5, -36], [11, -40]], t)}
    ${L([[-20, -48], [-38, -52], [-56, -56]], t2)}${L([[-20, -42], [-38, -42], [-56, -40]], t2)}
    ${L([[20, -48], [38, -52], [56, -56]], t2)}${L([[20, -42], [38, -42], [56, -40]], t2)}
    ${foot(-52, 110, -1)}${foot(52, 110, 1)}
    ${hold ? `<g transform="translate(0 -2) scale(0.85)">${seedShape}${paw(-17, 4, 1)}${paw(17, 4, -1)}</g>` : ''}
  `, flip);
}

function bunny(x, y, s = 1, flip = false) {
  const dir = flip ? -1 : 1;
  block(x, y + 25 * s, 108 * s, 96 * s); block(x + 25 * s * dir, y - 185 * s, 85 * s, 92 * s); block(x, y - 75 * s, 82 * s, 72 * s);
  const t = thin(s), t2 = thin(s, 0.5);
  const earL = [[-30, -110], [-46, -170], [-52, -228], [-42, -264], [-26, -262], [-15, -226], [-12, -166], [-14, -112]];
  const earR = [[14, -112], [14, -170], [22, -212], [40, -234], [68, -234], [92, -216], [102, -194, 1], [84, -198], [62, -210], [46, -202], [36, -168], [34, -112]];
  const head = join(
    arc(0, -75, 62, 55, 200, 340, 7),
    fur(0, -75, 62, 55, 340, 410, 3, 12),
    arc(0, -75, 60, 55, 50, 130, 4),
    fur(0, -75, 62, 55, 130, 200, 3, 12),
  );
  const body = [[-40, -30], [-62, 0], [-76, 45], [-70, 86], [-40, 104], [40, 104], [70, 86], [77, 45], [63, 0], [40, -30]];
  const hind = m => P([[-96, 100], [-74, 86], [-40, 90], [-26, 104], [-42, 116], [-92, 115]].map(([a, b]) => [a * m, b]))
    + L([[-38 * m, 104], [-44 * m, 114]], t2) + L([[-30 * m, 99], [-34 * m, 112]], t2);
  const paw = m => P([[-34, 54], [-18, 50], [-12, 64], [-14, 78], [-32, 80], [-38, 68]].map(([a, b]) => [a * m, b]))
    + L([[-20 * m, 78], [-20 * m, 70]], t2) + L([[-27 * m, 80], [-27 * m, 71]], t2);
  return grp(x, y, s, `
    ${P(earL)}${L([[-28, -125], [-36, -180], [-37, -232], [-31, -250]], t)}
    ${P(earR)}${L([[24, -126], [24, -176], [34, -212], [58, -222]], t)}
    ${P(fur(72, 70, 22, 20, 0, 360, 7, 8))}
    ${P(body)}
    ${L([[-26, -20], [-16, -4, 1], [-8, -16], [0, 2, 1], [8, -16], [16, -4, 1], [26, -20]], t)}
    ${L([[-52, 30], [-40, 50], [-46, 86]], t2)}${L([[52, 30], [40, 50], [46, 86]], t2)}
    ${hind(1)}${hind(-1)}
    ${P(head)}
    ${eye(-22, -86, 8)}${eye(24, -85, 8)}
    ${L([[-30, -101], [-20, -104], [-12, -100]], t2)}${L([[14, -100], [23, -104], [32, -100]], t2)}
    ${P([[-7, -66], [7, -66], [0, -58, 1]], BLK)}
    ${L([[0, -58], [0, -51]], t)}
    ${L([[-11, -47], [-5, -43], [0, -51]], t)}${L([[0, -51], [5, -43], [11, -47]], t)}
    ${P([[-6, -47, 1], [6, -47, 1], [6, -38], [0, -36], [-6, -38]], t2)}${L([[0, -46], [0, -37]], thin(s, 0.4))}
    ${blush(-40, -60, s, 0.9)}${blush(42, -60, s, 0.9)}
    ${whiskers(-30, -58, -1, s, 50)}${whiskers(30, -58, 1, s, 50)}
    ${paw(1)}${paw(-1)}
  `, flip);
}

function carrot(x, y, s = 1, rot = 0) {
  block(x, y, 80 * s, 80 * s);
  const t = thin(s, 0.55);
  return grp(x, y, s, `
    ${P([[-4, -40], [-26, -70], [-30, -88, 1], [-14, -72], [-2, -50]])}
    ${P([[0, -42], [2, -82], [8, -98, 1], [12, -78], [6, -44]])}
    ${P([[4, -40], [26, -66], [38, -78, 1], [30, -56], [10, -38]])}
    ${P([[-18, -42], [0, -48], [18, -42], [14, 0], [6, 40], [0, 66, 1], [-6, 40], [-14, 0]])}
    ${L([[-14, -24], [-4, -22]], t)}${L([[4, -8], [13, -10]], t)}${L([[-10, 12], [-2, 14]], t)}${L([[2, 32], [8, 30]], t)}
  `, false, rot);
}

function turtle(x, y, s = 1, flip = false) {
  block(x + 22 * s * (flip ? -1 : 1), y - 5 * s, 182 * s, 85 * s);
  const t = thin(s), t2 = thin(s, 0.5);
  const leg = (lx, m = 1) => P([[-20, -10], [20, -10], [26, 22], [22, 38], [12, 42, 1], [6, 36], [0, 43, 1], [-6, 36], [-12, 42, 1], [-20, 32]].map(([a, b]) => [lx + a * m, 34 + b]))
    + `<ellipse cx="${lx + 4}" cy="${46}" rx="6" ry="4" ${t2}/>`;
  const shell = [[-112, 22], [-108, -22], [-88, -64], [-50, -90], [0, -98], [50, -90], [88, -64], [108, -22], [112, 22]];
  const scute = (pts) => `<path d="${smooth(pts, true, 0.45)}" ${t}/>`;
  return grp(x, y, s, `
    ${P([[-112, 18], [-150, 34, 1], [-112, 36]])}
    ${leg(-78)}${leg(70)}
    ${P([[78, 22], [96, -10], [118, -38], [148, -48], [176, -38], [190, -18], [186, 2], [168, 12], [130, 14], [104, 30]])}
    ${eye(156, -26, 7.5)}
    ${L([[188, -6], [176, 2], [158, 2]], t)}
    <circle cx="182" cy="-26" r="2.5" ${BLK}/>
    ${L([[104, -6], [110, 10]], t2)}${L([[114, -14], [120, 4]], t2)}
    <ellipse cx="136" cy="-6" rx="7" ry="5" ${t2}/>${blush(150, -6, s, 0.7)}
    ${P(shell)}
    ${scute([[-34, -70], [34, -70], [48, -36], [0, -20], [-48, -36]])}
    ${L([[-34, -70], [-50, -88]], t)}${L([[34, -70], [50, -88]], t)}
    ${L([[-48, -36], [-104, -36]], t)}${L([[48, -36], [104, -36]], t)}
    ${L([[0, -20], [0, 18]], t)}${L([[-48, -36], [-56, 18]], t)}${L([[48, -36], [56, 18]], t)}
    ${P([[-122, 16], [0, 12], [122, 16], [128, 28], [112, 40], [0, 38], [-112, 40], [-128, 28]])}
    ${[-84, -42, 0, 42, 84].map(sx => L([[sx, 15], [sx + 2, 38]], t2)).join('')}
    ${mFlower(0, -45, 15, t2)}${mHeart(-72, -58, 12, t2)}${mHeart(72, -58, 12, t2)}
    ${mDots(-80, -6, 16, t2)}${mDots(80, -6, 16, t2)}${mScale(-27, -2, 11, t2)}${mScale(-27, 6, 11, t2)}${mScale(27, -2, 11, t2)}${mScale(27, 6, 11, t2)}
    ${[-104, -63, -21, 21, 63, 104].map(cx => `<circle cx="${cx}" cy="27" r="4" ${t2}/>`).join('')}
  `, flip);
}

function owl(x, y, s = 1) {
  block(x, y, 110 * s, 134 * s);
  const t = thin(s), t2 = thin(s, 0.5);
  const body = [[-60, -70], [-80, -124, 1], [-66, -104], [-56, -112, 1], [-50, -98], [-25, -96], [0, -92], [25, -96], [50, -98], [56, -112, 1], [66, -104], [80, -124, 1], [62, -70], [78, -20], [83, 30], [70, 75], [40, 100], [0, 106], [-40, 100], [-70, 75], [-83, 30], [-78, -20]];
  const disc = [[0, -70, 1], [-25, -86], [-56, -76], [-66, -46], [-52, -16], [-22, -12], [0, -22, 1], [22, -12], [52, -16], [66, -46], [56, -76], [25, -86]];
  const wingPts = m => [[-66, -28], [-92, 0], [-100, 40], [-90, 80], [-82, 98, 1], [-76, 84], [-68, 98, 1], [-64, 82], [-55, 94, 1], [-54, 60], [-58, 10]].map(([a, b, c]) => [a * m, b, c]);
  const wing = m => patterned(wingPts(m), [mScale], [-110, -30, 110, 100], 20, thin(s, 0.4)) + P([[-66, -28], [-92, 0], [-100, 40], [-90, 80], [-82, 98, 1], [-76, 84], [-68, 98, 1], [-64, 82], [-55, 94, 1], [-54, 60], [-58, 10]].map(([a, b, c]) => [a * m, b, c]))
    + L([[-70 * m, 20], [-84 * m, 50], [-82 * m, 80]], t2) + L([[-64 * m, 40], [-70 * m, 82]], t2);
  let chest = '';
  [[4, [-20, 0, 20]], [26, [-30, -10, 10, 30]], [48, [-20, 0, 20]], [70, [-10, 10]]].forEach(([cy, xs]) =>
    xs.forEach(cx => { chest += L([[cx - 9, cy], [cx, cy + 9], [cx + 9, cy]], t2); }));
  const toes = fx => [-8, 0, 8].map(dx => P([[fx + dx - 4, 96], [fx + dx + 4, 96], [fx + dx + 4, 108], [fx + dx, 116, 1], [fx + dx - 4, 108]], thin(s, 0.6))).join('');
  return grp(x, y, s, `
    ${P(body)}
    ${chest}
    ${P(disc, t)}
    ${wing(1)}${wing(-1)}
    ${[-29, 29].map(ex => [...Array(12)].map((_, i) => grp(ex, -48, 1, P([[18, 0, 1], [24, -5], [30, 0, 1], [24, 5]], t2), false, i * 30)).join('')).join('')}
    <circle cx="-29" cy="-48" r="20"/><circle cx="29" cy="-48" r="20"/>
    ${eye(-27, -48, 10, 11)}${eye(31, -48, 10, 11)}
    ${L([[-48, -72], [-30, -76], [-12, -68]], t2)}${L([[12, -68], [30, -76], [48, -72]], t2)}
    ${P([[-9, -32], [9, -32], [5, -18], [0, -8, 1], [-5, -18]])}
    ${toes(-24)}${toes(24)}
  `);
}

function duck(x, y, s = 1, flip = false) {
  const dir = flip ? -1 : 1;
  block(x - 5 * s * dir, y + 15 * s, 134 * s, 64 * s); block(x + 85 * s * dir, y - 95 * s, 72 * s, 58 * s);
  const t = thin(s), t2 = thin(s, 0.5);
  return grp(x, y, s, `
    ${P([[-80, -15], [-104, -34], [-122, -46, 1], [-112, -20], [-104, 8], [-80, 44], [-30, 66], [30, 68], [80, 54], [104, 26], [100, -4], [80, -18], [40, -14], [0, -20], [-40, -22]])}
    ${P([[-44, 2], [0, -8], [38, 4], [48, 22], [22, 42], [-12, 46], [-40, 40, 1], [-30, 32], [-60, 30, 1], [-46, 20], [-74, 14, 1]], t)}
    ${patterned([[-44, 2], [0, -8], [38, 4], [48, 22], [22, 42], [-12, 46], [-40, 40]], [mScale], [-50, -10, 50, 50], 18, thin(s, 0.4))}
    ${P([[38, -10], [42, -50], [38, -86], [46, -116], [70, -132], [98, -122], [110, -98], [102, -72], [82, -56], [80, -26], [88, -4], [64, 4]])}
    ${L([[60, -134], [64, -146], [70, -132]], t2)}${L([[70, -133], [80, -144], [80, -130]], t2)}
    ${P([[100, -114], [126, -116], [148, -108], [150, -98], [130, -92], [104, -94]])}
    ${L([[104, -103], [130, -102], [148, -103]], t2)}<circle cx="118" cy="-110" r="2" ${BLK}/>
    ${eye(82, -106, 7)}${L([[72, -120], [82, -124], [91, -119]], t2)}
    ${blush(78, -84, s, 0.8)}
  `, flip);
}

function puppy(x, y, s = 1, flip = false) {
  const dir = flip ? -1 : 1;
  block(x, y - 5 * s, 114 * s, 162 * s); block(x + 118 * s * dir, y + 35 * s, 42 * s, 72 * s);
  const t = thin(s), t2 = thin(s, 0.5);
  const head = [[-60, -70], [-56, -110], [-32, -134], [-10, -140], [-4, -152, 1], [4, -140], [10, -148, 1], [14, -138], [32, -136], [56, -112], [64, -72], [56, -40], [30, -20], [0, -15], [-30, -20], [-56, -40]];
  const earL = [[-50, -120], [-80, -118], [-98, -88], [-102, -46], [-92, -26], [-84, -34, 1], [-78, -22], [-70, -32, 1], [-62, -50], [-58, -84]];
  const leg = m => P([[-36, 56], [-14, 54], [-12, 108], [-14, 126], [-38, 128], [-38, 108]].map(([a, b]) => [a * m, b]))
    + L([[-20 * m, 116], [-21 * m, 127]], t2) + L([[-28 * m, 116], [-29 * m, 127]], t2);
  const hind = m => P([[-102, 128], [-96, 112], [-70, 110], [-60, 126]].map(([a, b]) => [a * m, b]))
    + L([[-78 * m, 118], [-79 * m, 128]], t2) + L([[-88 * m, 117], [-89 * m, 128]], t2);
  return grp(x, y, s, `
    ${P([[66, 80], [104, 52], [124, 14], [116, -10, 1], [130, 0], [134, 20], [118, 64], [72, 98]])}
    ${L([[136, -20], [146, -4]], t2)}${L([[142, -34], [156, -16]], t2)}
    ${hind(1)}${hind(-1)}
    ${P([[-50, -30], [-70, 10], [-82, 60], [-82, 110], [-58, 128], [58, 128], [82, 110], [84, 60], [72, 10], [50, -30]])}
    ${P([[-64, 18], [-46, 12], [-38, 28], [-48, 44], [-66, 40]], t)}
    ${L([[-80, 70], [-58, 58], [-44, 90], [-52, 124]], t2)}${L([[80, 70], [58, 58], [44, 90], [52, 124]], t2)}
    ${leg(1)}${leg(-1)}
    ${P([[-50, -28], [0, -12], [50, -28], [48, -12], [0, 4], [-48, -12]], t)}
    ${patterned([[-50, -26], [0, -10], [50, -26], [48, -12], [0, 4], [-48, -12]], [mHeart], [-52, -30, 52, 6], 14, thin(s, 0.4))}
    ${P([[-7, 2], [7, 2], [10, 14], [0, 24], [-10, 14]], t)}
    ${P(head)}
    ${P(earL)}${patterned(earL, [mDots], [-105, -125, -55, -20], 18, thin(s, 0.4))}
    ${P(mx(earL))}${patterned(mx(earL), [mDots], [55, -125, 105, -20], 18, thin(s, 0.4))}
    ${P([[10, -112], [38, -116], [50, -96], [42, -76], [18, -76], [8, -92]], t2)}
    ${eye(-26, -92, 8.5)}${eye(28, -92, 8.5)}
    ${L([[-38, -110], [-26, -116], [-14, -114]], t)}${L([[16, -114], [28, -117], [40, -111]], t)}
    ${P([[-34, -46], [-30, -66], [-12, -74], [12, -74], [30, -66], [34, -46], [16, -34], [-16, -34]], t2)}
    ${P([[-11, -66], [11, -66], [8, -58], [0, -55], [-8, -58]], BLK)}
    ${L([[0, -55], [0, -48]], t)}
    ${L([[-16, -46], [-8, -41], [0, -48]], t)}${L([[0, -48], [8, -41], [16, -46]], t)}
    ${P([[-7, -43, 1], [7, -43, 1], [8, -32], [0, -26], [-8, -32]], t)}${L([[0, -42], [0, -32]], t2)}
    ${blush(-44, -58, s)}${blush(44, -58, s)}
  `, flip);
}


// ---------- page frame, ground and title ribbon ----------
const M = 30; // frame inset
const sw = k => `stroke-width="${f(SW * k)}"`;
let gyFn = () => H;

function setGround(base, ph = 0) {
  gyFn = x => base + 14 * Math.sin(x / 95 + ph) + 7 * Math.sin(x / 41 + ph * 2);
  const pts = [];
  for (let x = M; x <= W - M; x += 20) pts.push([x, gyFn(x)]);
  return L(pts);
}

function frame() {
  return `<rect x="${M - 12}" y="${M - 12}" width="${W - 2 * M + 24}" height="${H - 2 * M + 24}" rx="28" fill="none" ${sw(1)}/>`;
}

function ribbon(text, y = 1028, w = 520) {
  block(W / 2, y, w / 2 + 60, 46);
  const x0 = W / 2 - w / 2, x1 = W / 2 + w / 2, h = 64;
  const tail = m => {
    const xe = m < 0 ? x0 : x1;
    return P([[xe, y - h / 2 + 14, 1], [xe + m * 70, y - h / 2 + 14, 1], [xe + m * 50, y + 6, 1], [xe + m * 70, y + h / 2 + 14, 1], [xe, y + h / 2 + 14, 1]]);
  };
  return `${tail(-1)}${tail(1)}
    ${P([[x0, y - h / 2, 1], [W / 2, y - h / 2 - 10], [x1, y - h / 2, 1], [x1, y + h / 2, 1], [W / 2, y + h / 2 - 10], [x0, y + h / 2, 1]])}
    ${title(text, y + 16, 44)}`;
}

function title(text, y, size) {
  const font = `font-family="Chewy, 'Inter Display', sans-serif"`;
  return `<text x="${W / 2}" y="${y}" text-anchor="middle" ${font} font-size="${size}" fill="#fff" stroke="#000" stroke-width="${SW * 0.9}" paint-order="stroke" letter-spacing="3">${text}</text>
    <text x="${W / 2}" y="${y}" text-anchor="middle" ${font} font-size="${size}" fill="#fff" stroke="none" letter-spacing="3">${text}</text>`;
}

// ---------- background items, each fits in a circle of radius r ----------
const T = k => sw(k);

function cloudI(x, y, r) {
  const k = r / 50;
  return grp(x, y, k, P(join(bumps(0, -4, 40, 14, 180, 360, 3, 24), arc(0, 4, 47, 14, 0, 180, 4, 0.02)))
);
}
function butterflyI(x, y, r) {
  const k = r / 40, t = thin(k, 0.45);
  const side = m => {
    const up = [[2, -2], [18, -30], [38, -33], [41, -12], [22, 2]].map(([a, b]) => [a * m, b]);
    const lo = [[2, 2], [24, 6], [33, 24], [16, 33], [4, 16]].map(([a, b]) => [a * m, b]);
    return P(up) + P(lo) + `<circle cx="${25 * m}" cy="-17" r="7" ${t}/><circle cx="${33 * m}" cy="-26" r="3" ${t}/><circle cx="${17 * m}" cy="19" r="5" ${t}/>`;
  };
  return grp(x, y, k, `${side(1)}${side(-1)}<ellipse cx="0" cy="2" rx="4.5" ry="19"/>
    ${L([[-2, -16], [-8, -30], [-15, -35]], t)}${L([[2, -16], [8, -30], [15, -35]], t)}
    <circle cx="-15" cy="-35" r="2.5" ${BLK}/><circle cx="15" cy="-35" r="2.5" ${BLK}/>`, false, J(25));
}
function heartI(x, y, r) { return grp(x, y, 1, mHeart(0, 0, r, T(1)) + (r > 14 ? mHeart(0, 0, r * 0.45, T(0.45)) : ''), false, J(20)); }
function starI(x, y, r, rot = J(20)) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = 36 * i - 90 + rot, rr = i % 2 ? r * 0.5 : r;
    pts.push([...ep(x, y, rr, rr, a), i % 2 ? 0 : 1]);
  }
  return `<path d="${smooth(pts, true, 0.6)}" ${T(r > 14 ? 1 : 0.7)}/>` + (r > 16 ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.18)}" ${T(0.45)}/>` : '');
}
function swirlI(x, y, r) {
  const pts = [], turns = 2.2, dir = rnd() < 0.5 ? 1 : -1, a0 = rnd() * 360;
  for (let i = 0; i <= 28; i++) { const u = i / 28; pts.push(ep(x, y, r * (1 - u * 0.9), r * (1 - u * 0.9), a0 + dir * u * 360 * turns)); }
  return L(pts, T(r > 14 ? 0.8 : 0.6));
}
function sparkleI(x, y, r) {
  const q = r * 0.18;
  return P([[x, y - r, 1], [x + q, y - q], [x + r, y, 1], [x + q, y + q], [x, y + r, 1], [x - q, y + q], [x - r, y, 1], [x - q, y - q]], T(0.7));
}
function dotI(x, y, r) { return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.6)}" ${T(0.6)}/>`; }
function moonI(x, y, r) {
  return `<path d="M ${f(x)} ${f(y - r)} A ${f(r)} ${f(r)} 0 1 0 ${f(x + r * 0.9)} ${f(y + r * 0.45)} A ${f(r * 0.8)} ${f(r * 0.8)} 0 1 1 ${f(x)} ${f(y - r)} Z" ${T(0.8)}/>`;
}
function flowerHead(x, y, r) {
  const kind = Math.floor(rnd() * 3);
  let o = '';
  if (kind === 0) { // daisy
    for (let i = 0; i < 10; i++) o += grp(x, y, r / 40, P([[12, 0, 1], [22, -8], [36, -7], [41, 0], [36, 7], [22, 8]]), false, i * 36);
    o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.32)}"/>` + mDots(x, y, r * 0.4, T(0.4));
  } else if (kind === 1) { // round petals, double ring
    for (let i = 0; i < 6; i++) { const [px, py] = ep(x, y, r * 0.6, r * 0.6, i * 60); o += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(r * 0.4)}"/>`; }
    for (let i = 0; i < 6; i++) { const [px, py] = ep(x, y, r * 0.62, r * 0.62, i * 60); o += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(r * 0.14)}" ${T(0.4)}/>`; }
    o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.32)}"/>` + mFlower(x, y, r * 0.22, T(0.35));
  } else { // pointed petals in two layers
    for (let i = 0; i < 8; i++) o += grp(x, y, r / 40, P([[0, 0, 1], [20, -12], [40, 0, 1], [20, 12]]), false, i * 45 + 22);
    for (let i = 0; i < 8; i++) o += grp(x, y, r / 40, P([[0, 0, 1], [14, -9], [28, 0, 1], [14, 9]], T(0.6)), false, i * 45);
    o += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.25)}"/>`;
  }
  return o;
}
function tulipHead(x, y, r) {
  const k = r / 40;
  return grp(x, y, k, P([[-22, 14], [-27, -14], [-20, -40, 1], [-8, -24], [0, -44, 1], [8, -24], [20, -40, 1], [27, -14], [22, 14], [0, 22]])
    + L([[-8, -24], [-5, 14]], thin(k, 0.45)) + L([[8, -24], [5, 14]], thin(k, 0.45)) + L([[-14, 0], [0, 6], [14, 0]], thin(k, 0.45)));
}
function mushroomI(x, y, r) {
  const k = r / 40, t = thin(k, 0.45);
  return grp(x, y, k, `${P([[-12, 2], [-14, 30], [-10, 38], [10, 38], [14, 30], [12, 2]])}
    ${L([[-6, 14], [-5, 30]], t)}
    ${P([[-40, 4], [-36, -16], [-20, -34], [0, -38], [20, -34], [36, -16], [40, 4], [0, 10]])}
    <circle cx="-16" cy="-18" r="7" ${t}/><circle cx="10" cy="-26" r="5" ${t}/><circle cx="22" cy="-8" r="6" ${t}/><circle cx="-26" cy="-2" r="4" ${t}/>`, false, J(8));
}
function snailI(x, y, r) {
  const k = r / 40, t = thin(k, 0.45);
  const sp = [];
  for (let i = 0; i <= 24; i++) { const u = i / 24; sp.push(ep(-4, 2, 22 * (1 - u * 0.85), 22 * (1 - u * 0.85), 200 + u * 600)); }
  return grp(x, y, k, `${P([[-40, 24], [24, 24], [36, 14], [40, -4], [32, -10], [24, 8], [-30, 16]])}
    ${L([[30, -6], [30, -28]], t)}${L([[36, -6], [42, -26]], t)}<circle cx="30" cy="-30" r="3" ${BLK}/><circle cx="42" cy="-28" r="3" ${BLK}/>
    ${P(arc(-4, 2, 25, 24, 0, 340, 10, 0.02))}${L(sp, t)}`, rnd() < 0.5);
}
function ladybugI(x, y, r) {
  const k = r / 40, t = thin(k, 0.45);
  return grp(x, y, k, `${[-1, 1].map(m => L([[18 * m, -8], [34 * m, -16]], t) + L([[22 * m, 6], [38 * m, 6]], t) + L([[18 * m, 18], [32 * m, 28]], t)).join('')}
    ${P(arc(0, -24, 14, 12, 180, 360, 5, 0).concat([[14, -20], [-14, -20]]))}
    ${L([[-5, -34], [-12, -44]], t)}${L([[5, -34], [12, -44]], t)}
    ${P(arc(0, 4, 28, 30, 0, 345, 12, 0.01))}${L([[0, -24], [0, 34]], t)}
    <circle cx="-13" cy="-6" r="6" ${t}/><circle cx="12" cy="-4" r="5" ${t}/><circle cx="-12" cy="16" r="5" ${t}/><circle cx="14" cy="18" r="6" ${t}/>`, false, J(40));
}
function pebbleI(x, y, r) {
  return P(arc(x, y, r, r * 0.65, 0, 330, 9, 0.1), T(0.8)) + L([[x - r * 0.4, y - r * 0.1], [x - r * 0.1, y - r * 0.25]], T(0.4));
}
function berriesI(x, y, r) {
  const k = r / 40, t = thin(k, 0.45);
  return grp(x, y, k, `${P([[0, -20, 1], [20, -36], [40, -30, 1], [22, -18]])}${L([[4, -20], [30, -30]], t)}
    ${[[-12, 4], [12, 6], [0, 24], [-20, 24], [18, 26]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="12"/><circle cx="${a - 4}" cy="${b - 4}" r="3" ${t}/>`).join('')}`, false, J(30));
}
function sprigI(x, y, r) {
  const k = r / 40, t = thin(k, 0.45);
  let o = L([[0, 38], [4, 0], [0, -38]]);
  [[-24, 210], [-4, -30], [16, 200]].forEach(([yy, a], i) => {
    o += grp(i % 2 ? 2 : 3, yy, 1, P([[0, 0, 1], [12, -8], [26, 0, 1], [12, 7]]) + L([[3, 0], [22, 0]], t), false, a);
  });
  o += grp(0, -38, 1, P([[0, 0, 1], [10, -8], [22, 0, 1], [10, 7]]), false, -90);
  return grp(x, y, k, o, false, J(25));
}
function cloverI(x, y, r) {
  let o = '';
  for (let i = 0; i < 3; i++) { const [px, py] = ep(x, y, r * 0.42, r * 0.42, i * 120 - 90); o += grp(px, py, 1, mHeart(0, 0, r * 0.5, T(0.7)), false, i * 120 + 180); }
  return o + L([[x, y], [x + r * 0.3, y + r]], T(0.7));
}
function lilyI(x, y, r) {
  const pts = join(arc(x, y, r, r * 0.6, 20, 340, 10, 0.02), [[x, y, 1]]);
  return P(pts) + L([[x, y], [x - r * 0.7, y - r * 0.2]], T(0.45)) + L([[x, y], [x - r * 0.5, y + r * 0.4]], T(0.45)) + (r > 26 ? flowerHead(x - r * 0.1, y - r * 0.15, r * 0.45) : '');
}
function fishI(x, y, r) {
  const k = r / 40, t = thin(k, 0.45);
  return grp(x, y, k, `${P([[22, 0, 1], [36, -16], [36, 16]])}${P([[-38, 0], [-20, -18], [8, -20], [26, 0], [8, 20], [-20, 18]])}
    ${eye(-22, -4, 4)}${L([[-10, -14], [-6, 0], [-10, 14]], t)}${mScale(4, -4, 7, t)}${mScale(4, 8, 7, t)}${mScale(14, 2, 6, t)}`, rnd() < 0.5);
}
function rippleI(x, y, r) {
  return L(arc(x, y, r, r * 0.35, 200, 340, 6, 0), T(0.7)) + L(arc(x, y + r * 0.1, r * 0.55, r * 0.18, 200, 340, 5, 0), T(0.5));
}
function grassI(x, y, h = 30) {
  let o = '';
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const bx = x + (i - n / 2) * 7 + J(3), hh = h * (0.6 + rnd() * 0.6), lean = J(14);
    o += L([[bx, y], [bx + lean * 0.3, y - hh * 0.55], [bx + lean, y - hh]], T(0.6));
  }
  return o;
}

const LIB = {
  sky: { big: [cloudI, cloudI, butterflyI], mid: [butterflyI, cloudI, heartI], small: [sparkleI, heartI, starI] },
  night: { big: [cloudI, starI], mid: [starI, swirlI, sparkleI, starI], small: [starI, sparkleI] },
  ground: { big: [mushroomI, flowerHead, snailI, ladybugI, berriesI], mid: [flowerHead, mushroomI, ladybugI, berriesI, sprigI, cloverI, tulipHead], small: [pebbleI, cloverI] },
  water: { big: [lilyI, fishI, lilyI], mid: [lilyI, fishI, rippleI], small: [rippleI] },
};
const pick = a => a[Math.floor(rnd() * a.length)];

function plants(from = M + 30, to = W - M - 30) {
  let o = '';
  for (let x = from; x <= to; x += 60 + rnd() * 60) {
    const gy = gyFn(x), h = 70 + rnd() * 110, rH = 22 + rnd() * 12, top = gy - h;
    if (!free(x, top, rH) || !free(x, gy - h * 0.45, 16)) { if (free(x, gy - 14, 12)) { o += grassI(x, gy); block(x, gy - 14, 10, 12); } continue; }
    const lean = J(12);
    o += L([[x, gy], [x + lean * 0.5, gy - h * 0.5], [x + lean, top]]);
    o += grp(x + lean * 0.3, gy - h * 0.35, 1, P([[0, 0, 1], [16, -10], [34, -2, 1], [16, 6]]) + L([[4, -1], [28, -3]], T(0.4)), false, -30);
    o += grp(x + lean * 0.4, gy - h * 0.55, 1, P([[0, 0, 1], [14, -9], [30, -2, 1], [14, 6]]) + L([[4, -1], [24, -3]], T(0.4)), false, 200);
    o += rnd() < 0.7 ? flowerHead(x + lean, top, rH) : tulipHead(x + lean, top, rH);
    block(x + lean, top, rH, rH); block(x, gy - h * 0.45, 22, h * 0.4);
    x += rH;
  }
  return o;
}

function fill(zoneFn, passes = [[34, 46, 400, 5], [20, 30, 800, 8], [12, 17, 800, 10]]) {
  let o = '';
  for (const [rmin, rmax, tries, cap] of passes) {
    let placed = 0;
    for (let i = 0; i < tries && placed < cap; i++) {
      const r = rmin + rnd() * (rmax - rmin);
      const x = M + 6 + r + rnd() * (W - 2 * M - 12 - 2 * r), y = M + 6 + r + rnd() * (H - 2 * M - 12 - 2 * r);
      if (!free(x, y, r, 34)) continue;
      const z = zoneFn(x, y, r);
      if (!z) continue;
      const lib = LIB[z], size = r >= 36 ? 'big' : r >= 20 ? 'mid' : 'small';
      o += pick(lib[size])(x, y, r);
      block(x, y, r, r);
      placed++;
    }
  }
  return o;
}
const skyGround = (sky = 'sky') => (x, y, r) => {
  const g = gyFn(x);
  if (y + r < g - 6) return sky;
  if (y - r > g + 6) return 'ground';
  return null;
};

// ---------- scenery pieces ----------
function sun(x, y, r) {
  block(x, y, r + 46, r + 46);
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = 30 * i;
    const b0 = ep(x, y, r + 10, r + 10, a - 9), b1 = ep(x, y, r + 10, r + 10, a + 9);
    const tip = ep(x, y, r + (i % 2 ? 30 : 44), r + (i % 2 ? 30 : 44), a);
    rays += P([[...b0, 1], [...tip, 1], [...b1, 1]]);
  }
  return `${rays}<circle cx="${x}" cy="${y}" r="${r}"/>
    ${L([[x - r * 0.48, y - r * 0.1], [x - r * 0.33, y - r * 0.24], [x - r * 0.18, y - r * 0.1]])}
    ${L([[x + r * 0.18, y - r * 0.1], [x + r * 0.33, y - r * 0.24], [x + r * 0.48, y - r * 0.1]])}
    ${L([[x - r * 0.3, y + r * 0.2], [x, y + r * 0.42], [x + r * 0.3, y + r * 0.2]])}
    ${blush(x - r * 0.55, y + r * 0.15, 1, 0.8)}${blush(x + r * 0.55, y + r * 0.15, 1, 0.8)}`;
}
function bigMoon(x, y, r) {
  block(x, y, r, r);
  return `<path d="M ${x} ${y - r} A ${r} ${r} 0 1 0 ${x + r * 0.9} ${y + r * 0.45} A ${r * 0.8} ${r * 0.8} 0 1 1 ${x} ${y - r} Z"/>
    ${L([[x - r * 0.62, y - r * 0.1], [x - r * 0.5, y - r * 0.02], [x - r * 0.38, y - r * 0.12]])}
    ${L([[x - r * 0.55, y + r * 0.3], [x - r * 0.38, y + r * 0.4], [x - r * 0.25, y + r * 0.35]])}
    ${starI(x - r * 0.55, y + r * 0.72, 9, 10)}${starI(x - r * 0.75, y - r * 0.45, 7, 0)}`;
}
function tree(x, gy, s = 1) {
  block(x, gy - 250 * s, 135 * s, 120 * s); block(x, gy - 80 * s, 50 * s, 85 * s);
  const t = thin(s, 0.45);
  let apples = '';
  [[-50, -280], [30, -320], [60, -240], [-20, -220], [-70, -220], [10, -270], [70, -300]].forEach(([a, b]) => { apples += `<circle cx="${a}" cy="${b}" r="11"/>` + L([[a, b - 11], [a + 3, b - 18]], t); });
  return grp(x, gy, s, `
    ${P([[-50, 6, 1], [-30, -6], [-22, -60], [-24, -170], [26, -170], [20, -60], [30, -6], [54, 6, 1], [22, 2], [6, 10, 1], [-10, 2], [-26, 8, 1]])}
    ${L([[-10, -40], [-6, -70], [-10, -96]], t)}${L([[8, -110], [10, -140]], t)}${L([[-6, -130], [-4, -150]], t)}
    <ellipse cx="6" cy="-60" rx="9" ry="12" ${t}/><ellipse cx="6" cy="-60" rx="4" ry="6" ${t}/>
    ${P(bumps(0, -262, 112, 88, 0, 360, 9, 34))}
    ${apples}`);
}
function beachBall(x, y, r) {
  block(x, y, r, r);
  return `<circle cx="${x}" cy="${y}" r="${r}"/>
    ${L([[x, y - r], [x - r * 0.55, y], [x, y + r]])}${L([[x, y - r], [x + r * 0.55, y], [x, y + r]])}
    ${L([[x, y - r], [x - r * 0.1, y], [x, y + r]], T(0.6))}
    ${patterned([[x - r * 0.55, y - r * 0.7], [x - r * 0.75, y], [x - r * 0.55, y + r * 0.7], [x - r * 0.95, y + r * 0.3], [x - r * 0.95, y - r * 0.3]], [mDots], [x - r, y - r, x - r * 0.5, y + r], 14, T(0.35))}
    ${patterned([[x + r * 0.55, y - r * 0.7], [x + r * 0.75, y], [x + r * 0.55, y + r * 0.7], [x + r * 0.95, y + r * 0.3], [x + r * 0.95, y - r * 0.3]], [mHeart], [x + r * 0.5, y - r, x + r, y + r], 14, T(0.35))}
    <ellipse cx="${x}" cy="${y - r + 5}" rx="${r * 0.2}" ry="${r * 0.1}"/>`;
}
function seedsPile(x, y) {
  block(x, y - 8, 55, 30);
  return [[-30, 0, -30], [-8, -8, 10], [16, 0, 40], [36, -4, 70], [4, 10, -60]].map(([a, b, rot]) =>
    grp(x + a, y + b, 0.8, P([[0, -22, 1], [10, -6], [9, 14], [0, 24], [-9, 14], [-10, -6]]) + L([[-3, -12], [-4, 14]], thin(0.8, 0.45)) + L([[4, -12], [4, 14]], thin(0.8, 0.45)), false, rot)).join('');
}

// ---------- pages ----------
const pages = [
  // 1. Cover
  () => {
    let o = title('Hammy &amp; Friends', 128, 100);
    block(W / 2, 98, 360, 58);
    o += setGround(830, 0.5);
    o += hamster(425, 640, 1.75);
    o += bunny(140, 760, 0.62) + puppy(715, 765, 0.55);
    o += ribbon('This book belongs to: __________', 1030, 640);
    o += plants() + fill(skyGround());
    return o;
  },
  // 2. Hammy and his seeds
  () => {
    let o = setGround(840, 1.4);
    o += sun(700, 175, 62);
    o += hamster(400, 600, 1.95);
    o += seedsPile(560, 905);
    o += ribbon("Hi! I'm Hammy!");
    o += plants() + fill(skyGround());
    return o;
  },
  // 3. Bunny
  () => {
    let o = setGround(840, 2.2);
    o += bunny(600, 650, 1.55);
    o += hamster(220, 700, 1.3);
    o += carrot(405, 905, 1, 70);
    o += ribbon('Hammy meets Bunny');
    o += plants() + fill(skyGround());
    return o;
  },
  // 4. Turtle ride
  () => {
    let o = setGround(850, 0.2);
    o += tree(690, 860, 0.95);
    o += turtle(330, 830, 1.45);
    o += hamster(318, 568, 1.0);
    o += ribbon('Slow and steady!');
    o += plants() + fill(skyGround());
    return o;
  },
  // 5. Owl at night
  () => {
    let o = setGround(900, 3.1);
    o += bigMoon(670, 170, 80);
    block(240, 545, 260, 30);
    o += P([[M - 10, 530, 1], [200, 534], [400, 546], [520, 558, 1], [400, 570], [200, 576], [M - 10, 584, 1]]);
    o += L([[90, 550], [130, 556]], T(0.5)) + L([[330, 556], [370, 560]], T(0.5));
    o += grp(470, 553, 1, P([[0, 0, 1], [26, -18], [58, 0, 1], [26, 14]]) + L([[6, 0], [48, -2]], T(0.4)), false, -40);
    o += owl(260, 440, 1.2);
    o += hamster(520, 830, 1.15, { sleepy: true });
    o += title('z z z', 640, 46).replace(/x="425"/g, 'x="690"'); block(690, 625, 70, 30);
    o += ribbon('Goodnight, Owl!');
    o += plants() + fill(skyGround('night'));
    return o;
  },
  // 6. Duck pond
  () => {
    let o = setGround(560, 0.9);
    o += sun(150, 170, 55);
    const pond = [560, 790, 250, 140];
    o += P(arc(pond[0], pond[1], pond[2], pond[3], 0, 345, 18, 0.03));
    o += duck(560, 760, 1.25);
    o += hamster(170, 800, 1.2);
    o += ribbon('Splash with Duck!');
    const zone = (x, y, r) => {
      const dx = (x - pond[0]) / pond[2], dy = (y - pond[1]) / pond[3];
      const d = Math.hypot(dx, dy);
      if (d < 1 - r / pond[3] - 0.05) return 'water';
      if (d < 1 + r / pond[3] + 0.05) return null;
      return skyGround()(x, y, r);
    };
    block(pond[0], pond[1], pond[2] + 4, pond[3] + 4);
    // water items need the pond free again: drop that block for the water pass
    const pondBlock = OCC.pop();
    o += plants();
    OCC.push(pondBlock);
    o += fill((x, y, r) => { const z = zone(x, y, r); return z === 'water' ? null : z; });
    OCC.splice(OCC.indexOf(pondBlock), 1);
    // pond interior: keep away from everything else already placed
    o += fill((x, y, r) => zone(x, y, r) === 'water' ? 'water' : null, [[26, 40, 600], [12, 22, 1500], [5, 10, 1500]]);
    return o;
  },
  // 7. Puppy
  () => {
    let o = setGround(830, 1.8);
    o += puppy(605, 650, 1.55);
    o += hamster(215, 700, 1.25);
    o += beachBall(400, 900, 62);
    o += L([[318, 850], [304, 828], [312, 806]], T(0.6)) + L([[482, 850], [496, 828], [488, 806]], T(0.6));
    o += ribbon('Play ball, Puppy!');
    o += plants() + fill(skyGround());
    return o;
  },
  // 8. Best friends
  () => {
    let o = setGround(640, 2.7);
    o += owl(150, 490, 0.85);
    o += puppy(425, 450, 1.0);
    o += bunny(705, 500, 1.0);
    o += turtle(150, 860, 0.8);
    o += duck(700, 870, 0.85, true);
    o += hamster(425, 810, 1.1);
    o += ribbon('Best Friends!');
    o += plants() + fill(skyGround());
    return o;
  },
];

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#fff"/>
    <g fill="#fff" stroke="#000" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">${body}${frame()}</g>
  </svg>`;
}

const FONT = '<link href="https://fonts.googleapis.com/css2?family=Chewy&display=block" rel="stylesheet">';

(async () => {
  const outDir = path.join(__dirname, 'images');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

  const svgs = pages.map((p, i) => { seed = 101 + i * 37; OCC.length = 0; return svg(p()); });
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
