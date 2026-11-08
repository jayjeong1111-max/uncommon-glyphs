// ─────────────────────────────────────────────
//  Uncommon Glyphs — 글자 실루엣 안을 무작위 유기 형태로 채우는 생성 드로잉
// ─────────────────────────────────────────────
const BG = '#e6e6da';
const INK = '#141414';
const VERSIONS = 12;          // 마우스 위치마다 바뀌는 버전 수 (원본 사이트처럼)
const FONT = 'Archivo Black';

let txt = 'UF';
let baseSeed = 1;
let letters = [];             // {ch, x, y, w, h, mask, axis}
let cache = new Map();        // key -> p5.Graphics
let ready = false;

function setup() {
  createCanvas(windowWidth, windowHeight);
  document.fonts.load(`200px "${FONT}"`).finally(() => { ready = true; layout(); });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  layout();
}

// ── 글자 배치 + 마스크 ──────────────────────────
function layout() {
  if (!ready) return;
  clearCache();
  letters = [];
  const chars = [...txt];
  if (!chars.length) return;
  const n = chars.length;
  const pad = min(width, height) * 0.06;
  const cellW = (width - pad * 2) / n;
  const h = min(height - pad * 2, cellW * 1.25);
  for (let i = 0; i < n; i++) {
    const w = cellW;
    const x = pad + i * cellW;
    const y = (height - h) / 2;
    letters.push({ ch: chars[i], x, y, w, h, axis: i % 2, mask: makeMask(chars[i], w, h) });
  }
}

function makeMask(ch, w, h) {
  const g = createGraphics(ceil(w), ceil(h));
  g.pixelDensity(1);
  g.background(0);
  g.fill(255); g.noStroke();
  g.textFont(FONT);
  g.textAlign(CENTER, CENTER);
  // 글자가 칸을 꽉 채우도록 크기 맞추기
  let s = h;
  g.textSize(s);
  const tw = g.textWidth(ch);
  if (tw > w * 0.92) s *= (w * 0.92) / tw;
  g.textSize(s * 1.02);
  g.text(ch, w / 2, h / 2 - s * 0.06);
  g.loadPixels();
  const data = new Uint8Array(g.width * g.height);
  let count = 0;
  for (let i = 0; i < data.length; i++) { data[i] = g.pixels[i * 4] > 127 ? 1 : 0; count += data[i]; }
  const m = { w: g.width, h: g.height, data, count, size: s };
  g.remove();
  m.stroke = estimateStroke(m);
  return m;
}

function inMask(m, x, y) {
  x = x | 0; y = y | 0;
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  return m.data[y * m.w + x] === 1;
}

// 글자 획 두께 대략 추정 (안쪽 점에서 가장자리까지 거리의 중앙값 × 2)
function estimateStroke(m) {
  const ds = [];
  for (let k = 0; k < 300; k++) {
    const x = Math.random() * m.w, y = Math.random() * m.h;
    if (!inMask(m, x, y)) continue;
    let best = 1e9;
    for (let a = 0; a < TWO_PI; a += PI / 8) {
      let r = 0;
      while (r < m.size && inMask(m, x + cos(a) * r, y + sin(a) * r)) r += 2;
      best = min(best, r);
    }
    ds.push(best);
  }
  ds.sort((a, b) => a - b);
  return (ds[ds.length >> 1] || 20) * 2.6;
}

function edgeDist(m, x, y, maxR) {
  let best = maxR;
  for (let a = 0; a < TWO_PI; a += PI / 6) {
    let r = 0;
    while (r < best && inMask(m, x + cos(a) * r, y + sin(a) * r)) r += 2;
    best = min(best, r);
  }
  return best;
}

// ── 그리기 루프 ──────────────────────────────
function draw() {
  background(BG);
  if (!ready) return;
  for (let i = 0; i < letters.length; i++) {
    const L = letters[i];
    const ratio = L.axis === 0 ? mouseX / width : mouseY / height;
    const v = constrain(floor((isFinite(ratio) ? ratio : 0) * VERSIONS), 0, VERSIONS - 1);
    const key = `${i}|${L.ch}|${baseSeed}|${v}`;
    let g = cache.get(key);
    if (!g) {
      g = renderLetter(L, hashSeed(baseSeed, i, v, L.ch.codePointAt(0)));
      cache.set(key, g);
      if (cache.size > 60) { const k0 = cache.keys().next().value; cache.get(k0).remove(); cache.delete(k0); }
    }
    image(g, L.x, L.y);
  }
}

function hashSeed(...xs) {
  let h = 2166136261;
  for (const x of xs) { h ^= x; h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function clearCache() { for (const g of cache.values()) g.remove(); cache.clear(); }

// ── 한 글자 렌더 ─────────────────────────────
function renderLetter(L, seed) {
  randomSeed(seed); noiseSeed(seed);
  const m = L.mask;
  const g = createGraphics(m.w, m.h);
  g.noStroke();
  g.fill(INK);

  const style = random() < 0.5 ? 'cells' : 'botanical';
  if (style === 'cells') drawCells(g, m);
  else drawBotanical(g, m);

  if (random() < (style === 'botanical' ? 0.85 : 0.35)) glitch(g, m);
  return g;
}

// 마스크 안에 포아송 디스크 샘플
function sampleInside(m, d, tries) {
  const pts = [];
  for (let k = 0; k < tries; k++) {
    const x = random(m.w), y = random(m.h);
    if (!inMask(m, x, y)) continue;
    let ok = true;
    for (const p of pts) if ((p.x - x) ** 2 + (p.y - y) ** 2 < d * d) { ok = false; break; }
    if (ok) pts.push({ x, y });
  }
  return pts;
}

// ── 스타일 1: 세포/링 + 덩어리 ─────────────────
function drawCells(g, m) {
  const s = m.stroke;
  const d = s * random(0.45, 0.75);
  const pts = sampleInside(m, d, 4000);
  const rings = [];
  for (const p of pts) {
    const r = d * random(0.6, 0.9);
    const th = s * random(0.04, 0.08);
    rings.push({ ...p, r, th });
    wobblyRing(g, p.x, p.y, r, th);
  }
  // 링 경계에 검은 덩어리
  const lumpChance = random(0.5, 0.95);
  for (const c of rings) {
    const n = floor(random(1, 4));
    for (let k = 0; k < n; k++) {
      if (random() > lumpChance) continue;
      const a = random(TWO_PI);
      const out = random() < 0.5 ? 1 : -1;
      const bx = c.x + cos(a) * c.r, by = c.y + sin(a) * c.r;
      blob(g, bx + cos(a) * out * c.r * 0.15, by + sin(a) * out * c.r * 0.15, c.r * random(0.3, 0.65), a);
    }
  }
  // 가끔 꽉 찬 덩어리 영역
  if (random() < 0.5) {
    const k = floor(random(1, 4));
    for (let i = 0; i < k; i++) {
      const p = random(pts); if (!p) break;
      blob(g, p.x, p.y, d * random(0.7, 1.3), random(TWO_PI));
    }
  }
}

function wobblyRing(g, cx, cy, r, th) {
  const steps = 64;
  const off = random(1000);
  const outer = [], inner = [];
  for (let i = 0; i < steps; i++) {
    const a = i / steps * TWO_PI;
    const nx = cos(a), ny = sin(a);
    const rr = r * (1 + 0.18 * (noise(off + nx * 0.9 + 1, off + ny * 0.9 + 1) - 0.5) * 2);
    const t = th * (0.4 + 1.4 * noise(off + 50 + nx * 1.3, off + ny * 1.3));
    outer.push([cx + nx * (rr + t), cy + ny * (rr + t)]);
    inner.push([cx + nx * (rr - t), cy + ny * (rr - t)]);
  }
  g.beginShape();
  for (const p of outer) g.vertex(p[0], p[1]);
  g.beginContour();
  for (let i = inner.length - 1; i >= 0; i--) g.vertex(inner[i][0], inner[i][1]);
  g.endContour();
  g.endShape(CLOSE);
}

// 오목한 변을 가진 불규칙 덩어리 (3~5개 꼭짓점)
function blob(g, cx, cy, r, rot) {
  const n = floor(random(3, 6));
  const corners = [];
  for (let i = 0; i < n; i++) {
    const a = rot + i / n * TWO_PI + random(-0.4, 0.4);
    const rr = r * random(0.7, 1.25);
    corners.push([cx + cos(a) * rr, cy + sin(a) * rr]);
  }
  g.beginShape();
  for (let i = 0; i < n; i++) {
    const p = corners[i], q = corners[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    // 중심 쪽으로 당겨 오목하게
    const pull = random(0.15, 0.45);
    const cxm = lerp(mx, cx, pull), cym = lerp(my, cy, pull);
    g.vertex(p[0], p[1]);
    g.quadraticVertex(cxm, cym, q[0], q[1]);
  }
  g.endShape(CLOSE);
}

// ── 스타일 2: 가지, 잎, 덩굴 ──────────────────
function drawBotanical(g, m) {
  const s = m.stroke;
  // 가지
  const nb = floor(random(7, 14));
  for (let i = 0; i < nb; i++) {
    const p = sampleInside(m, 0, 60)[0]; if (!p) continue;
    branch(g, m, p.x, p.y, random(TWO_PI), s * random(0.08, 0.16), s * random(0.05, 0.1), 0);
  }
  // 잎
  const leafPts = sampleInside(m, s * 0.55, 1500);
  for (const p of leafPts) {
    if (random() < 0.25) continue;
    const room = edgeDist(m, p.x, p.y, s);
    if (room < s * 0.12) continue;
    leaf(g, p.x, p.y, random(TWO_PI), room * random(1.2, 2.0), room * random(0.45, 0.8));
  }
  // 덩굴손
  const nt = floor(random(4, 12));
  for (let i = 0; i < nt; i++) {
    const p = sampleInside(m, 0, 60)[0]; if (!p) continue;
    tendril(g, p.x, p.y, random(TWO_PI), s * random(0.2, 0.5), s * random(0.02, 0.04));
  }
  // 가끔 세포 몇 개 섞기
  if (random() < 0.4) {
    for (const p of sampleInside(m, s * 0.5, 300).slice(0, 6)) wobblyRing(g, p.x, p.y, s * random(0.1, 0.2), s * 0.02);
  }
}

// 굵기가 줄어드는 선 (폴리곤)
function taperedPath(g, pts, w0, w1) {
  if (pts.length < 2) return;
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[max(0, i - 1)], b = pts[min(pts.length - 1, i + 1)];
    const ang = atan2(b[1] - a[1], b[0] - a[0]) + HALF_PI;
    const w = lerp(w0, w1, i / (pts.length - 1)) * (0.75 + 0.5 * noise(pts[i][0] * 0.05, pts[i][1] * 0.05));
    L.push([pts[i][0] + cos(ang) * w, pts[i][1] + sin(ang) * w]);
    R.push([pts[i][0] - cos(ang) * w, pts[i][1] - sin(ang) * w]);
  }
  g.beginShape();
  for (const p of L) g.vertex(p[0], p[1]);
  for (let i = R.length - 1; i >= 0; i--) g.vertex(R[i][0], R[i][1]);
  g.endShape(CLOSE);
}

function branch(g, m, x, y, ang, seg, w, depth) {
  const pts = [[x, y]];
  const n = floor(random(6, 16));
  for (let i = 0; i < n; i++) {
    ang += random(-0.35, 0.35);
    let nx = x + cos(ang) * seg, ny = y + sin(ang) * seg;
    // 글자 밖으로 나가면 방향을 틀어 안쪽으로
    let turns = 0;
    while (!inMask(m, nx, ny) && turns < 10) {
      ang += random(0.5, 1.2) * (random() < 0.5 ? -1 : 1);
      nx = x + cos(ang) * seg; ny = y + sin(ang) * seg; turns++;
    }
    if (turns >= 10) break;
    x = nx; y = ny; pts.push([x, y]);
    // 가시
    if (random() < 0.35) {
      const side = random() < 0.5 ? 1 : -1;
      const ta = ang + side * random(0.6, 1.2);
      const tl = w * random(1.5, 3.5);
      g.triangle(x + cos(ang + HALF_PI) * w * 0.6, y + sin(ang + HALF_PI) * w * 0.6,
                 x - cos(ang + HALF_PI) * w * 0.6, y - sin(ang + HALF_PI) * w * 0.6,
                 x + cos(ta) * tl, y + sin(ta) * tl);
    }
    // 곁가지
    if (depth < 3 && random() < 0.18) {
      branch(g, m, x, y, ang + random([-1, 1]) * random(0.5, 1.1), seg * 0.8, w * 0.65, depth + 1);
    }
  }
  taperedPath(g, pts, w, w * 0.15);
}

function leaf(g, cx, cy, ang, len, wid) {
  const steps = 26;
  const serr = random() < 0.5 ? random(0.04, 0.12) : 0;
  const curve = random(-0.25, 0.25);
  const L = [], R = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let w = pow(sin(PI * t), 0.75) * wid * 0.5;
    if (serr) w *= 1 - serr * (i % 2);
    const bx = (t - 0.5) * len, by = curve * len * sin(PI * t) * 0.5;
    L.push([bx, by - w]); R.push([bx, by + w]);
  }
  g.push();
  g.translate(cx, cy); g.rotate(ang);
  g.fill(INK);
  g.beginShape();
  for (const p of L) g.vertex(p[0], p[1]);
  for (let i = R.length - 1; i >= 0; i--) g.vertex(R[i][0], R[i][1]);
  g.endShape(CLOSE);
  // 잎맥 (배경색으로 파내기)
  g.stroke(BG); g.noFill();
  g.strokeWeight(max(1, wid * 0.03));
  g.beginShape();
  for (let i = 1; i < steps; i++) { const t = i / steps; g.vertex((t - 0.5) * len, curve * len * sin(PI * t) * 0.5); }
  g.endShape();
  const nv = floor(random(4, 9));
  g.strokeWeight(max(0.7, wid * 0.018));
  for (let k = 1; k < nv; k++) {
    const t = k / nv;
    const bx = (t - 0.5) * len, by = curve * len * sin(PI * t) * 0.5;
    const w = pow(sin(PI * t), 0.75) * wid * 0.42;
    g.line(bx, by, bx + len * 0.12, by - w);
    g.line(bx, by, bx + len * 0.12, by + w);
  }
  g.pop();
  g.noStroke(); g.fill(INK);
}

function tendril(g, x, y, ang, len, w) {
  const pts = [[x, y]];
  const n = 40;
  const curl = random(0.04, 0.14) * (random() < 0.5 ? 1 : -1);
  let k = 0;
  const seg = len / n;
  for (let i = 0; i < n; i++) {
    k += curl * (i / n) * 1.6;
    ang += k * 0.4;
    x += cos(ang) * seg; y += sin(ang) * seg;
    pts.push([x, y]);
  }
  taperedPath(g, pts, w, w * 0.1);
}

// ── 디지털 글리치: 가로 띠를 밀고, 계단 블록 만들기 ──
function glitch(g, m) {
  const snap = g.get();
  const nSlices = floor(random(3, 12));
  for (let i = 0; i < nSlices; i++) {
    const y = random(m.h);
    const h = random(2, m.stroke * 0.12);
    const dx = random(-1, 1) * m.stroke * random(0.05, 0.3);
    const x0 = random(m.w * 0.5), w = random(m.w * 0.2, m.w * 0.8);
    g.erase(); g.rect(x0, y, w, h); g.noErase();
    g.image(snap, x0 + dx, y, w, h, x0, y, w, h);
  }
  // 픽셀 계단 블록
  if (random() < 0.6) {
    const bx = random(m.w * 0.2, m.w * 0.7), by = random(m.h * 0.2, m.h * 0.8);
    const cell = m.stroke * random(0.03, 0.06);
    const cols = floor(random(4, 10)), rows = floor(random(4, 12));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const xx = bx + c * cell, yy = by + r * cell;
      if (!inMask(m, xx, yy)) continue;
      if (noise(c * 0.6, r * 0.6) > 0.5) { g.fill(INK); g.rect(xx, yy, cell, cell); }
      else { g.erase(); g.rect(xx, yy, cell * 0.9, cell * 0.25); g.noErase(); }
    }
  }
}

// ── 입력 ───────────────────────────────────
function mousePressed() { baseSeed = floor(Math.random() * 1e9); clearCache(); }

function keyPressed() {
  if (keyCode === BACKSPACE) { txt = [...txt].slice(0, -1).join(''); layout(); return false; }
  if (keyCode === ENTER) { saveCanvas('uncommon-glyphs', 'png'); return false; }
}

function keyTyped() {
  if (key.length === 1 && key !== ' ' && [...txt].length < 8) {
    txt = ([...txt].length >= 8 ? txt : txt + key.toUpperCase());
    layout();
  }
  return false;
}
