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

// ---------- characters ----------
function hamster(x, y, s = 1, { flip = false, hold = true, sleepy = false } = {}) {
  const t = thin(s), t2 = thin(s, 0.5);
  const ear = (cx, cy, rot) => `<g transform="rotate(${rot} ${cx} ${cy})">
      ${P(arc(cx, cy, 27, 24, 0, 330, 11, 0.04))}
      ${L(arc(cx, cy + 3, 14, 13, 160, 380, 6), t)}</g>`;
  const outline = join(
    arc(0, 35, 112, 95, 100, 195, 6),
    fur(0, -50, 115, 58, 160, 212, 3, 11),
    arc(0, -72, 84, 62, 205, 335, 7),
    fur(0, -50, 115, 58, 328, 380, 3, 11),
    arc(0, 35, 112, 95, -15, 80, 6),
  );
  const foot = (fx, fy, m) => {
    const pts = [[-30, -2], [-20, -14], [5, -16], [25, -10], [33, 2], [28, 12, 1], [20, 14], [14, 12, 1], [6, 15], [-1, 13, 1], [-8, 15], [-24, 12]]
      .map(([px, py, sh]) => [fx + px * m, fy + py, sh]);
    return P(pts) + L([[fx + 10 * m, fy - 6], [fx + 16 * m, fy + 6]], t2) + L([[fx + 2 * m, fy - 6], [fx + 4 * m, fy + 7]], t2);
  };
  const paw = (px, py, m) => {
    const pts = [[-12, 8], [-14, -4], [-6, -12], [4, -13], [11, -7], [13, 2], [6, 10]].map(([a, b]) => [px + a * m, py + b]);
    return P(pts) + L([[px + 5 * m, py - 12], [px + 2 * m, py - 5]], t2) + L([[px + 12 * m, py - 3], [px + 5 * m, py - 1]], t2);
  };
  const seedShape = `<g transform="rotate(12 0 6)">${P([[0, -22, 1], [10, -6], [9, 14], [0, 24], [-9, 14], [-10, -6]])}
      ${L([[-3, -12], [-4, 14]], t2)}${L([[4, -12], [4, 14]], t2)}</g>`;
  const eyes = sleepy
    ? L([[-44, -80], [-32, -72], [-20, -80]]) + L([[20, -79], [33, -71], [46, -79]])
    : eye(-32, -80, 9) + eye(34, -78, 9);
  return grp(x, y, s, `
    ${ear(-62, -114, -18)}${ear(64, -112, 22)}
    ${P(outline)}
    ${L([[-72, -22], [-84, 25], [-76, 80], [-48, 118]], t)}
    ${L([[70, -24], [84, 22], [78, 78], [50, 116]], t)}
    ${L([[-10, -134], [-6, -119]], t2)}${L([[0, -136], [2, -121]], t2)}${L([[10, -134], [11, -120]], t2)}
    ${L([[-70, 40], [-62, 50]], t2)}${L([[64, 44], [56, 54]], t2)}
    ${eyes}
    ${L([[-42, -97], [-32, -102], [-22, -101]], t2)}${L([[24, -100], [34, -101], [44, -96]], t2)}
    ${P([[-8, -62], [0, -65], [8, -62], [3, -54], [0, -53], [-3, -54]], BLK)}
    ${L([[0, -54], [0, -46]], t)}
    ${L([[-13, -42], [-6, -37], [0, -46]], t)}${L([[0, -46], [6, -37], [13, -42]], t)}
    ${blush(-58, -50, s)}${blush(58, -50, s)}
    ${whiskers(-50, -50, -1, s, 80)}${whiskers(50, -50, 1, s, 80)}
    ${foot(-52, 126, -1)}${foot(52, 128, 1)}
    ${hold ? seedShape : ''}
    ${hold ? paw(-20, 4, 1) + paw(20, 4, -1) : `<g transform="rotate(-25 -44 12)">${paw(-44, 12, 1)}</g><g transform="rotate(25 44 12)">${paw(44, 12, -1)}</g>`}
  `, flip);
}

function bunny(x, y, s = 1, flip = false) {
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
  const t = thin(s), t2 = thin(s, 0.5);
  const leg = (lx, m = 1) => P([[-20, -10], [20, -10], [26, 22], [22, 38], [12, 42, 1], [6, 36], [0, 43, 1], [-6, 36], [-12, 42, 1], [-20, 32]].map(([a, b]) => [lx + a * m, 34 + b]))
    + `<ellipse cx="${lx + 4}" cy="${46}" rx="6" ry="4" ${t2}/>`;
  const shell = [[-112, 22], [-108, -22], [-88, -64], [-50, -90], [0, -98], [50, -90], [88, -64], [108, -22], [112, 22]];
  const scute = (pts) => `<path d="${smooth(pts, true, 0.45)}" ${t}/>`;
  return grp(x, y, s, `
    ${P([[-112, 18], [-150, 34, 1], [-112, 36]])}
    ${leg(-78)}${leg(70)}
    ${P([[78, 22], [96, -10], [118, -38], [148, -48], [176, -38], [190, -18], [186, 2], [168, 12], [130, 14], [104, 30]])}
    ${eye(156, -26, 7.5)}${L([[147, -40], [156, -44], [165, -40]], t2)}
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
  `, flip);
}

function owl(x, y, s = 1) {
  const t = thin(s), t2 = thin(s, 0.5);
  const body = [[-60, -70], [-80, -124, 1], [-66, -104], [-56, -112, 1], [-50, -98], [-25, -96], [0, -92], [25, -96], [50, -98], [56, -112, 1], [66, -104], [80, -124, 1], [62, -70], [78, -20], [83, 30], [70, 75], [40, 100], [0, 106], [-40, 100], [-70, 75], [-83, 30], [-78, -20]];
  const disc = [[0, -70, 1], [-25, -86], [-56, -76], [-66, -46], [-52, -16], [-22, -12], [0, -22, 1], [22, -12], [52, -16], [66, -46], [56, -76], [25, -86]];
  const wing = m => P([[-66, -28], [-92, 0], [-100, 40], [-90, 80], [-82, 98, 1], [-76, 84], [-68, 98, 1], [-64, 82], [-55, 94, 1], [-54, 60], [-58, 10]].map(([a, b, c]) => [a * m, b, c]))
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
    <circle cx="-29" cy="-48" r="20"/><circle cx="29" cy="-48" r="20"/>
    ${eye(-27, -48, 10, 11)}${eye(31, -48, 10, 11)}
    ${L([[-48, -72], [-30, -76], [-12, -68]], t2)}${L([[12, -68], [30, -76], [48, -72]], t2)}
    ${P([[-9, -32], [9, -32], [5, -18], [0, -8, 1], [-5, -18]])}
    ${toes(-24)}${toes(24)}
  `);
}

function duck(x, y, s = 1, flip = false) {
  const t = thin(s), t2 = thin(s, 0.5);
  return grp(x, y, s, `
    ${P([[-80, -15], [-104, -34], [-122, -46, 1], [-112, -20], [-104, 8], [-80, 44], [-30, 66], [30, 68], [80, 54], [104, 26], [100, -4], [80, -18], [40, -14], [0, -20], [-40, -22]])}
    ${P([[-44, 2], [0, -8], [38, 4], [48, 22], [22, 42], [-12, 46], [-40, 40, 1], [-30, 32], [-60, 30, 1], [-46, 20], [-74, 14, 1]], t)}
    ${L([[-20, 16], [10, 12], [30, 22]], t2)}${L([[-26, 30], [6, 28]], t2)}
    ${P([[38, -10], [42, -50], [38, -86], [46, -116], [70, -132], [98, -122], [110, -98], [102, -72], [82, -56], [80, -26], [88, -4], [64, 4]])}
    ${L([[60, -134], [64, -146], [70, -132]], t2)}${L([[70, -133], [80, -144], [80, -130]], t2)}
    ${P([[100, -114], [126, -116], [148, -108], [150, -98], [130, -92], [104, -94]])}
    ${L([[104, -103], [130, -102], [148, -103]], t2)}<circle cx="118" cy="-110" r="2" ${BLK}/>
    ${eye(82, -106, 7)}${L([[72, -120], [82, -124], [91, -119]], t2)}
    ${blush(78, -84, s, 0.8)}
  `, flip);
}

function puppy(x, y, s = 1, flip = false) {
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
    ${P([[-7, 2], [7, 2], [10, 14], [0, 24], [-10, 14]], t)}
    ${P(head)}
    ${P(earL)}${P(mx(earL).map(([a, b, c]) => [a + J(3), b + J(3), c]))}
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

// ---------- scenery ----------
function sun(x, y, r) {
  const t = thin(1, 0.6);
  let rays = '';
  for (let i = 0; i < 9; i++) {
    const a = 360 / 9 * i + J(6);
    const b0 = ep(x, y, r + 12, r + 12, a - 9), b1 = ep(x, y, r + 12, r + 12, a + 9);
    const tip = ep(x, y, r + 44 + J(6), r + 44 + J(6), a + 4);
    rays += P([[...b0, 1], [...ep(x, y, r + 30, r + 30, a - 5)], [...tip, 1], [...ep(x, y, r + 26, r + 26, a + 8)], [...b1, 1]]);
  }
  return `${rays}${P(arc(x, y, r, r, 0, 345, 12, 0.02))}
    ${L([[x - r * 0.48, y - r * 0.12], [x - r * 0.33, y - r * 0.24], [x - r * 0.18, y - r * 0.12]])}
    ${L([[x + r * 0.18, y - r * 0.12], [x + r * 0.33, y - r * 0.24], [x + r * 0.48, y - r * 0.12]])}
    ${L([[x - r * 0.32, y + r * 0.2], [x, y + r * 0.45], [x + r * 0.32, y + r * 0.2]])}
    ${blush(x - r * 0.55, y + r * 0.15, 1, 0.8)}${blush(x + r * 0.55, y + r * 0.15, 1, 0.8)}
    ${L([[x + r * 0.6, y - r * 0.62], [x + r * 0.72, y - r * 0.45]], t)}`;
}

function cloud(x, y, s = 1) {
  return grp(x, y, s, `${P(join(bumps(0, -4, 72, 26, 180, 360, 4, 30), arc(0, 4, 86, 26, 0, 180, 4, 0.02)))}`);
}

function leaf(x, y, len, rot, s = 1) {
  return grp(x, y, 1, `${P([[0, 0, 1], [len * 0.45, -len * 0.28], [len, 0, 1], [len * 0.5, len * 0.22]])}
    ${L([[len * 0.12, 0], [len * 0.55, -len * 0.03], [len * 0.85, 0]], thin(1, 0.45))}`, false, rot);
}

function daisy(x, groundY, h, s = 1) {
  const top = groundY - h, sx = x + J(12);
  let petals = '';
  for (let i = 0; i < 9; i++) {
    const a = 360 / 9 * i + J(5);
    petals += grp(sx, top, s, P([[10, 0, 1], [20, -8], [34, -7], [40, 0], [34, 7], [20, 8]]), false, a);
  }
  return `${L([[x, groundY], [x + (sx - x) * 0.3 + 8, groundY - h * 0.5], [sx, top]])}
    ${leaf(x + 3, groundY - h * 0.35, 40 * s, -35)}${leaf(x - 2, groundY - h * 0.2, 34 * s, 210)}
    ${petals}${P(arc(sx, top, 14 * s, 14 * s, 0, 330, 10, 0.04))}
    <circle cx="${f(sx - 4 * s)}" cy="${f(top - 3 * s)}" r="${f(2.2 * s)}" ${BLK}/><circle cx="${f(sx + 5 * s)}" cy="${f(top + 1 * s)}" r="${f(2.2 * s)}" ${BLK}/><circle cx="${f(sx - 1 * s)}" cy="${f(top + 6 * s)}" r="${f(2.2 * s)}" ${BLK}/>`;
}

function tulip(x, groundY, h, s = 1) {
  const top = groundY - h;
  return `${L([[x, groundY], [x - 6, groundY - h * 0.5], [x, top]])}
    ${P([[x + 2, groundY], [x + 26 * s, groundY - h * 0.45], [x + 32 * s, groundY - h * 0.75, 1], [x + 12 * s, groundY - h * 0.45], [x + 4, groundY - 8]])}
    ${grp(x, top, s, P([[-18, 4], [-22, -20], [-16, -42, 1], [-6, -28], [0, -46, 1], [6, -28], [16, -42, 1], [22, -20], [18, 4], [0, 10]])
      + L([[-6, -28], [-4, 2]], thin(s, 0.45)) + L([[6, -28], [4, 2]], thin(s, 0.45)))}`;
}

function ground(y, amp = 14) {
  const pts = [];
  for (let gx = -150; gx <= 1000; gx += 125) pts.push([gx, y + J(amp)]);
  return P([...pts, [1000, H + 200, 1], [-150, H + 200, 1]]);
}

function grass(xs, y) {
  const t = thin(1, 0.6);
  return xs.map(gx => {
    let out = '';
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const bx = gx + (i - n / 2) * 7 + J(3), h = 18 + rnd() * 22, lean = J(16);
      out += L([[bx, y], [bx + lean * 0.3, y - h * 0.55], [bx + lean, y - h]], t);
    }
    return out;
  }).join('');
}

function tree(x, groundY, s = 1) {
  const t = thin(s, 0.55);
  return grp(x, groundY, s, `
    ${P([[-50, 6, 1], [-30, -6], [-22, -60], [-24, -160], [26, -160], [20, -60], [30, -6], [54, 6, 1], [22, 2], [6, 10, 1], [-10, 2], [-26, 8, 1]])}
    ${L([[-10, -40], [-6, -70], [-10, -96]], t)}${L([[8, -110], [10, -140]], t)}
    <ellipse cx="6" cy="-60" rx="7" ry="10" ${t}/>
    ${P(bumps(0, -262, 108, 84, 0, 360, 8, 34))}
    ${L([[-60, -270], [-46, -284], [-30, -278]], t)}${L([[20, -310], [36, -320], [52, -312]], t)}
    ${L([[40, -230], [56, -242], [70, -234]], t)}${L([[-40, -210], [-26, -220], [-12, -212]], t)}
  `);
}

function star(x, y, r, rot = 0) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = 36 * i - 90 + rot + J(3);
    const rr = i % 2 ? r * 0.5 : r * (1 + J(0.08));
    pts.push([...ep(x, y, rr, rr, a), i % 2 ? 0 : 1]);
  }
  return `<path d="${smooth(pts, true, 0.6)}"/>`;
}
function sparkle(x, y, r) {
  return L([[x - r, y], [x + r, y]], thin(1, 0.6)) + L([[x, y - r], [x, y + r]], thin(1, 0.6));
}

function heart(x, y, s = 1, rot = 0) {
  return grp(x, y, s, P([[0, -20, 1], [16, -38], [36, -34], [42, -14], [28, 10], [0, 34, 1], [-28, 10], [-42, -14], [-36, -34], [-16, -38]]), false, rot);
}

function moon(x, y, r) {
  return `<path d="M ${x} ${y - r} A ${r} ${r} 0 1 0 ${x + r * 0.9} ${y + r * 0.45} A ${r * 0.8} ${r * 0.8} 0 1 1 ${x} ${y - r} Z"/>
    ${L([[x - r * 0.62, y - r * 0.1], [x - r * 0.5, y - r * 0.02], [x - r * 0.38, y - r * 0.12]])}
    ${L([[x - r * 0.55, y + r * 0.3], [x - r * 0.38, y + r * 0.4], [x - r * 0.25, y + r * 0.35]])}`;
}

function beachBall(x, y, r) {
  return `${P(arc(x, y, r, r, 0, 340, 12, 0.01))}
    ${L([[x, y - r], [x - r * 0.5, y], [x, y + r]])}${L([[x, y - r], [x + r * 0.5, y], [x, y + r]])}
    <ellipse cx="${x}" cy="${y - r + 4}" rx="${r * 0.18}" ry="${r * 0.1}"/>
    ${L([[x - r * 0.75, y - r * 0.35], [x - r * 0.6, y - r * 0.6]], thin(1, 0.5))}`;
}

function title(text, y = 105, size = 82) {
  const font = `font-family="Chewy, 'Inter Display', sans-serif"`;
  return `<text x="${W / 2}" y="${y}" text-anchor="middle" ${font} font-size="${size}" fill="#fff" stroke="#000" stroke-width="${SW * 0.9}" paint-order="stroke" letter-spacing="3">${text}</text>
    <text x="${W / 2}" y="${y}" text-anchor="middle" ${font} font-size="${size}" fill="#fff" stroke="none" letter-spacing="3">${text}</text>`;
}

// ---------- pages ----------
const pages = [
  // 1. Cover
  () => `
    ${title('Hammy &amp; Friends', 128, 104)}
    ${title('a coloring book', 205, 48)}
    ${star(120, 300, 32, 8)}${star(735, 320, 32, -10)}${sparkle(650, 255, 14)}${sparkle(205, 375, 12)}
    ${heart(140, 560, 0.85, -12)}${heart(712, 560, 0.85, 14)}
    ${ground(880)}
    ${grass([60, 250, 300, 560, 610, 800], 990)}
    ${daisy(90, 880, 140)}${tulip(770, 880, 150)}
    ${hamster(425, 700, 1.6)}
    ${title('This book belongs to:', 1015, 36)}
    ${L([[220, 1068], [420, 1064], [630, 1068]])}`,

  // 2. Hammy and his seed
  () => `
    ${title("Hi! I'm Hammy!")}
    ${sun(690, 260, 60)}
    ${cloud(180, 250, 1.1)}${cloud(430, 330, 0.7)}
    ${ground(860)}
    ${grass([60, 120, 330, 560, 790], 990)}
    ${daisy(110, 860, 180, 1.1)}${tulip(735, 860, 140)}${daisy(640, 860, 95, 0.8)}
    ${hamster(400, 700, 1.55)}`,

  // 3. Bunny
  () => `
    ${title('Hammy meets Bunny')}
    ${cloud(160, 220, 0.9)}${cloud(690, 250, 1)}
    ${ground(850)}
    ${grass([40, 330, 560, 800], 1000)}
    ${tulip(420, 850, 120, 0.9)}
    ${bunny(610, 720, 1.35)}
    ${hamster(220, 745, 1.12)}
    ${carrot(420, 950, 0.9, 70)}`,

  // 4. Turtle
  () => `
    ${title('Slow and steady!')}
    ${sun(700, 250, 52)}
    ${cloud(420, 240, 0.9)}
    ${ground(820)}
    ${tree(165, 830, 1.05)}
    ${grass([60, 440, 800], 1040)}
    ${turtle(280, 900, 1.25)}
    ${hamster(675, 885, 0.95)}
    ${daisy(800, 820, 100, 0.8)}`,

  // 5. Owl at night
  () => `
    ${title('Goodnight, Owl!')}
    ${moon(660, 260, 80)}
    ${star(140, 230, 26, 6)}${star(430, 340, 17, -8)}${star(470, 215, 21)}${star(780, 420, 17, 10)}${star(90, 430, 17)}
    ${sparkle(300, 290, 10)}${sparkle(590, 410, 9)}
    ${P([[-20, 545, 1], [200, 548], [400, 558], [520, 568, 1], [400, 580], [200, 586], [-20, 592, 1]])}
    ${L([[80, 560], [120, 566]], thin(1, 0.5))}${L([[380, 566], [420, 570]], thin(1, 0.5))}
    ${leaf(450, 562, 60, -40)}${leaf(380, 576, 50, 25)}
    ${owl(260, 455, 1.05)}
    ${ground(920)}
    ${grass([60, 360, 780], 1030)}
    ${hamster(560, 860, 1.05, { sleepy: true })}
    ${title('z z z', 680, 46).replace(/x="425"/g, 'x="720"')}`,

  // 6. Duck
  () => `
    ${title('Splash with Duck!')}
    ${sun(700, 240, 52)}
    ${cloud(200, 240, 1)}
    ${ground(570, 20)}
    ${P(arc(560, 830, 265, 115, 0, 345, 16, 0.04))}
    ${L([[370, 830], [390, 820], [410, 830]])}${L([[650, 880], [672, 870], [694, 880]])}${L([[470, 900], [490, 892], [510, 900]])}
    ${P(join(arc(720, 900, 34, 15, 20, 340, 8), [[720, 900, 1]]))}
    ${duck(560, 780, 1.1)}
    ${L([[760, 760], [770, 640]])}${P([[762, 650], [770, 610], [780, 650], [774, 690], [766, 690]])}
    ${L([[790, 770], [796, 690]])}${leaf(780, 740, 50, -70)}
    ${daisy(90, 640, 90, 0.8)}
    ${hamster(170, 880, 1.05)}
    ${grass([60, 300, 520, 800], 1070)}`,

  // 7. Puppy
  () => `
    ${title('Play ball, Puppy!')}
    ${cloud(170, 230, 0.9)}${cloud(650, 260, 1.1)}
    ${ground(820)}
    ${grass([50, 450, 800], 1040)}
    ${puppy(590, 760, 1.3)}
    ${hamster(215, 820, 1.05)}
    ${beachBall(410, 965, 58)}
    ${L([[338, 905], [322, 884], [330, 862]], thin(1, 0.6))}${L([[482, 905], [498, 884], [490, 862]], thin(1, 0.6))}`,

  // 8. Best friends
  () => `
    ${title('Best Friends!')}
    ${heart(425, 230, 1.5)}${star(150, 220, 26, 5)}${star(705, 220, 26, -6)}${sparkle(300, 250, 12)}${sparkle(560, 250, 12)}
    ${ground(700)}
    ${grass([40, 800], 1060)}
    ${owl(150, 600, 0.76)}
    ${bunny(705, 600, 0.9)}
    ${puppy(425, 555, 0.92)}
    ${turtle(150, 940, 0.78)}
    ${duck(705, 950, 0.78, true)}
    ${hamster(425, 905, 1.0)}`,
];

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="7"/>
      <feDisplacementMap in="SourceGraphic" scale="3.5" xChannelSelector="R" yChannelSelector="G"/>
    </filter></defs>
    <rect width="${W}" height="${H}" fill="#fff"/>
    <g filter="url(#ink)" fill="#fff" stroke="#000" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round">${body}</g>
  </svg>`;
}

const FONT = '<link href="https://fonts.googleapis.com/css2?family=Chewy&display=block" rel="stylesheet">';

(async () => {
  const outDir = path.join(__dirname, 'images');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

  const svgs = pages.map((p, i) => { seed = 101 + i * 37; return svg(p()); });
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
