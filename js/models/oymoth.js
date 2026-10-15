/* =========================================================================
   OY 0X Moth — описание 3D-модели раскладушки: две половины на петле
   «Кокон», складной экран с OY OS 4, внешний экран «Крыло» на крышке,
   шесть цветов и «Пыльца» — цвет корпуса уходит в оформление системы.
   Процедурная резервная модель с теми же именами нод.

   Складывание. Верхняя половина Top поворачивается вокруг оси петли
   (поперёк корпуса, на 0,5 мм перед экраном): fold 0 — разложен, 1 — сложен.
   Корешок Hinge поворачивается на половину угла и закрывает стык.
   ========================================================================= */

import * as THREE from 'three';
import { MM, roundRect, slab, boxG, cylZ } from './oy0x0.js';

// body — стекло крышек, frame — алюминий рамки и корешка, accent — «Пыльца» в системе
export const MOTH_COLORS = {
  yellow: { body: 0xF6D44A, frame: 0xE3C243, accent: '#FFD84A', ink: '#1A1505' },
  red: { body: 0xD7263D, frame: 0xC42A3A, accent: '#FF5A6E', ink: '#FFFFFF' },
  pink: { body: 0xF4A6C0, frame: 0xE9B3C4, accent: '#FF9FC4', ink: '#2A0C17' },
  apple: { body: 0x8DC63F, frame: 0x8AB84A, accent: '#A8E05A', ink: '#0F1A04' },
  blue: { body: 0x2F6FDB, frame: 0x3A6CC8, accent: '#5B95FF', ink: '#FFFFFF' },
  cloud: { body: 0xEEF1F4, frame: 0xD9DEE3, accent: '#DDE6F0', ink: '#16191C' },
};

// Геометрия (мм) — как в blender/build_oymoth.py
const W = 75, H = 166.7, D = 6.8, HH = H / 2, HD = D / 2;
const GAP = 0.7;
export const PIVOT_Z = (HD + 0.5) * MM;           // ось петли — перед экраном (glTF: экран смотрит в +Z)
const SCR = { w: 72, h: 163.5 };                   // складной экран
const WING = { w: 68, h: 76, cy: (GAP + 4 + HH - 3.6) / 2 };
const CAMS = [[22.5, 70.5], [8.5, 70.5]];          // со спины, мм
const FLASH = [-3.2, 72.6];
export const FOLDED_CENTER_Y = -HH / 2 * MM;       // центр сложенного Moth — середина нижней половины

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const SANS = '"Onest", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/* ---------- Складной экран: OY OS 4 ---------- */

// Обои под цвет корпуса: картинка заполняет холст целиком, лишнее обрезается
const ready = (img) => img && img.complete && img.naturalWidth > 0;
function drawCover(g, img, Wc, Hc, { top = false } = {}) {
  const k = Math.max(Wc / img.naturalWidth, Hc / img.naturalHeight);
  const w = img.naturalWidth * k, h = img.naturalHeight * k;
  g.drawImage(img, (Wc - w) / 2, top ? 0 : (Hc - h) / 2, w, h);
}

function drawMain(canvas, c, app = 'clock', wall = null) {
  const g = canvas.getContext('2d');
  const Wc = canvas.width, Hc = canvas.height;
  const px = Wc / SCR.w;                       // пикселей на мм
  g.clearRect(0, 0, Wc, Hc);
  if (ready(wall)) {
    g.fillStyle = '#000';
    g.fillRect(0, 0, Wc, Hc);
    drawCover(g, wall, Wc, Hc);
  } else {
    const bg = g.createLinearGradient(0, 0, 0, Hc);
    bg.addColorStop(0, '#0E0D12');
    bg.addColorStop(1, '#040405');
    g.fillStyle = bg;
    g.fillRect(0, 0, Wc, Hc);
    // «Пыльца»: свет цвета корпуса сверху и снизу — система в тон телефона
    for (const [x, y, r, a] of [[0.85, 0.08, 1.1, 'aa'], [0.1, 0.92, 0.9, '66']]) {
      const rg = g.createRadialGradient(Wc * x, Hc * y, 10, Wc * x, Hc * y, Wc * r);
      rg.addColorStop(0, c.accent + a);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, Wc, Hc);
    }
  }
  const ink = '#F4F3EF', dim = 'rgba(244,243,239,.6)';
  g.textBaseline = 'middle';
  g.fillStyle = ink;
  g.font = `600 26px ${SANS}`;
  g.textAlign = 'left';
  g.fillText('9:41', 44, 52);
  g.textAlign = 'right';
  g.font = `600 22px ${MONO}`;
  g.fillText('5G', Wc - 104, 52);
  roundRect(g, Wc - 88, 41, 44, 22, 7);
  g.strokeStyle = ink; g.lineWidth = 2.4; g.stroke();
  g.fillRect(Wc - 84, 45, 28, 14);

  g.textAlign = 'center';
  g.font = `700 172px ${SANS}`;
  g.fillText('9:41', Wc / 2, 250);
  g.font = `500 28px ${SANS}`;
  g.fillStyle = dim;
  g.fillText('OY OS 4 · «Пыльца»', Wc / 2, 352);

  // знак: два кольца и X, кольца — в цвет корпуса
  const cy = 470;
  g.lineWidth = 7;
  g.strokeStyle = c.accent;
  g.beginPath(); g.arc(Wc / 2 - 86, cy, 40, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(Wc / 2 + 86, cy, 40, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = ink;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(Wc / 2 - 18, cy - 24); g.lineTo(Wc / 2 + 18, cy + 24);
  g.moveTo(Wc / 2 + 18, cy - 24); g.lineTo(Wc / 2 - 18, cy + 24);
  g.stroke();

  // сгиб посередине: карточки обходят его, как в настоящей системе
  const card = (y, h, title, lines, tint) => {
    roundRect(g, 38, y, Wc - 76, h, 32);
    g.fillStyle = tint || (ready(wall) ? 'rgba(6,6,8,.62)' : 'rgba(255,255,255,.075)');
    g.fill();
    g.textAlign = 'left';
    g.fillStyle = ink;
    g.font = `600 28px ${SANS}`;
    g.fillText(title, 72, y + 48);
    g.font = `400 21px ${MONO}`;
    g.fillStyle = dim;
    lines.forEach((l, i) => g.fillText(l, 72, y + 92 + i * 34));
  };
  if (app === 'clock') card(560, 120, 'OY Assist', ['«Сложи — продолжу на „Крыле“»']);
  else drawContinued(g, Wc, Hc, app, c, ink, dim);
  const fold = Hc / 2;
  card(fold + 40, 150, '«Палатка»', ['Поставьте Moth полусогнутым:', 'сверху видео, снизу пульт']);
  card(fold + 214, 120, 'Трекеров', ['0 · как всегда']);
  // док
  for (let i = 0; i < 4; i++) {
    const x = 64 + i * ((Wc - 128 - 92) / 3);
    roundRect(g, x, Hc - 150, 92, 92, 28);
    g.fillStyle = i === 0 ? c.accent : 'rgba(255,255,255,.12)';
    g.fill();
  }
  // складка посередине: едва заметная, как на настоящем складном экране
  const crease = g.createLinearGradient(0, fold - 14, 0, fold + 14);
  crease.addColorStop(0, 'rgba(0,0,0,0)');
  crease.addColorStop(0.42, 'rgba(255,255,255,.035)');
  crease.addColorStop(0.5, 'rgba(0,0,0,.28)');
  crease.addColorStop(0.58, 'rgba(255,255,255,.035)');
  crease.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = crease;
  g.fillRect(0, fold - 14, Wc, 28);
  // фронталка: точка в экране
  g.fillStyle = '#000';
  g.beginPath(); g.arc(Wc / 2, 4.2 * px + 1, 1.7 * px, 0, Math.PI * 2); g.fill();
}

// Приложение с «Крыла» продолжается на большом экране — в верхней половине
function drawContinued(g, Wc, Hc, app, c, ink, dim) {
  const x = 38, y = 90, w = Wc - 76, h = Hc / 2 - 130;
  g.save();
  roundRect(g, x, y, w, h, 36);
  g.clip();
  if (app === 'assist') {
    g.fillStyle = '#16181D'; g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 14;
    for (const [a, b, cc, d] of [[0, 0.3, 1, 0.42], [0.2, 0, 0.35, 1], [0.6, 0, 0.7, 1], [0, 0.75, 1, 0.68]]) {
      g.beginPath(); g.moveTo(x + w * a, y + h * b); g.lineTo(x + w * cc, y + h * d); g.stroke();
    }
    g.strokeStyle = c.accent; g.lineWidth = 8; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + w * 0.25, y + h * 0.85); g.lineTo(x + w * 0.3, y + h * 0.36); g.lineTo(x + w * 0.66, y + h * 0.4); g.lineTo(x + w * 0.66, y + h * 0.16); g.stroke();
    g.fillStyle = c.accent; g.beginPath(); g.arc(x + w * 0.66, y + h * 0.16, 16, 0, Math.PI * 2); g.fill();
    roundRect(g, x + 24, y + h - 120, w - 48, 96, 26); g.fillStyle = 'rgba(10,10,12,.88)'; g.fill();
    g.textAlign = 'left'; g.fillStyle = ink; g.font = `600 30px ${SANS}`;
    g.fillText('Такси через 4 минуты', x + 52, y + h - 84);
    g.fillStyle = dim; g.font = `400 22px ${MONO}`;
    g.fillText('продолжено с «Крыла»', x + 52, y + h - 46);
  } else if (app === 'player') {
    const ag = g.createLinearGradient(x, y, x + w, y + h);
    ag.addColorStop(0, c.accent); ag.addColorStop(1, '#14121A');
    g.fillStyle = ag; g.fillRect(x, y, w, h);
    g.textAlign = 'left'; g.fillStyle = ink; g.font = `700 64px ${SANS}`;
    g.fillText('Лампа', x + 40, y + h - 120);
    g.font = `500 30px ${SANS}`; g.fillStyle = 'rgba(244,243,239,.75)';
    g.fillText('Ночной рейс · 1:52 / 4:20', x + 40, y + h - 66);
  } else if (app === 'camera') {
    const sky = g.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, '#27324A'); sky.addColorStop(0.6, '#C98B5E'); sky.addColorStop(1, '#3A2418');
    g.fillStyle = sky; g.fillRect(x, y, w, h);
    g.fillStyle = '#1B1412';
    g.beginPath(); g.ellipse(Wc / 2, y + h * 0.66, 90, 112, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(Wc / 2, y + h * 1.06, 200, 140, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

/* ---------- «Крыло»: внешний экран ---------- */

export const WING_MODES = ['clock', 'assist', 'player', 'camera', 'camera-wide', 'off'];

function drawWing(canvas, mode, c, wall = null) {
  const g = canvas.getContext('2d');
  const Wc = canvas.width, Hc = canvas.height;
  const px = Wc / WING.w;
  // мм в координатах «Крыла» (со спины) → пиксели холста
  const top = WING.cy + WING.h / 2;
  const at = (x, z) => [((WING.w / 2 - x) * px), ((top - z) * px)];
  g.clearRect(0, 0, Wc, Hc);
  g.fillStyle = '#030304';
  g.fillRect(0, 0, Wc, Hc);
  if (mode === 'off') return;
  const ink = '#F4F3EF', dim = 'rgba(244,243,239,.62)';
  // на «Крыле» — верх тех же обоев, чуть притушенный под текст
  if (ready(wall) && !mode.startsWith('camera')) {
    drawCover(g, wall, Wc, Hc, { top: true });
    g.fillStyle = 'rgba(0,0,0,.32)';
    g.fillRect(0, 0, Wc, Hc);
  }
  const rg = g.createRadialGradient(Wc * 0.8, Hc * 0.9, 10, Wc * 0.8, Hc * 0.9, Wc);
  rg.addColorStop(0, c.accent + (mode === 'camera' ? '00' : '70'));
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, Wc, Hc);

  g.textBaseline = 'middle';
  if (mode === 'clock') {
    g.textAlign = 'left';
    g.fillStyle = ink;
    g.font = `700 150px ${SANS}`;
    g.fillText('9:41', 52, Hc * 0.47);
    g.font = `500 32px ${SANS}`;
    g.fillStyle = dim;
    g.fillText('Четверг, 14 марта', 58, Hc * 0.6);
    roundRect(g, 52, Hc * 0.7, Wc - 104, 120, 30);
    g.fillStyle = 'rgba(255,255,255,.09)'; g.fill();
    g.fillStyle = c.accent;
    g.beginPath(); g.arc(112, Hc * 0.7 + 60, 22, 0, Math.PI * 2); g.fill();
    g.fillStyle = ink; g.font = `600 28px ${SANS}`;
    g.fillText('Мама: «Ты на свету?»', 152, Hc * 0.7 + 60);
  } else if (mode === 'assist') {
    g.textAlign = 'left';
    g.fillStyle = dim; g.font = `500 26px ${MONO}`;
    g.fillText('OY ASSIST · НА «КРЫЛЕ»', 52, Hc * 0.34);
    g.fillStyle = ink; g.font = `600 46px ${SANS}`;
    ['Такси будет', 'через 4 минуты.', 'Раскройте — карта', 'на большом экране.'].forEach((l, i) => g.fillText(l, 52, Hc * 0.45 + i * 60));
    g.fillStyle = c.accent;
    roundRect(g, 52, Hc * 0.82, 220, 72, 36); g.fill();
    g.fillStyle = c.ink; g.font = `700 28px ${SANS}`; g.textAlign = 'center';
    g.fillText('Раскрыть', 162, Hc * 0.82 + 36);
  } else if (mode === 'player') {
    roundRect(g, 52, Hc * 0.3, 200, 200, 26);
    const ag = g.createLinearGradient(52, Hc * 0.3, 252, Hc * 0.3 + 200);
    ag.addColorStop(0, c.accent); ag.addColorStop(1, '#14121A');
    g.fillStyle = ag; g.fill();
    g.textAlign = 'left'; g.fillStyle = ink; g.font = `700 40px ${SANS}`;
    g.fillText('Лампа', 282, Hc * 0.36);
    g.fillStyle = dim; g.font = `500 28px ${SANS}`;
    g.fillText('Ночной рейс', 282, Hc * 0.42);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(52, Hc * 0.68, Wc - 104, 8);
    g.fillStyle = c.accent; g.fillRect(52, Hc * 0.68, (Wc - 104) * 0.42, 8);
    g.fillStyle = ink;
    const y = Hc * 0.82;
    g.beginPath(); g.moveTo(Wc / 2 - 16, y - 30); g.lineTo(Wc / 2 + 26, y); g.lineTo(Wc / 2 - 16, y + 30); g.fill();
    for (const s of [-1, 1]) {
      g.fillRect(Wc / 2 + s * 150 - 4, y - 22, 8, 44);
    }
  } else if (mode === 'camera' || mode === 'camera-wide') {
    // видоискатель: селфи основной камерой или вся компания на сверхширокой
    const wide = mode === 'camera-wide';
    const sky = g.createLinearGradient(0, 0, 0, Hc);
    sky.addColorStop(0, '#27324A'); sky.addColorStop(0.6, '#C98B5E'); sky.addColorStop(1, '#3A2418');
    g.fillStyle = sky; g.fillRect(0, 0, Wc, Hc);
    g.fillStyle = '#1B1412';
    const people = wide ? [[0.5, 0.62], [0.2, 0.7], [0.8, 0.68]] : [[0.5, 1]];
    for (const [px, k] of people) {
      const sc = wide ? 0.55 * k : 1;
      g.beginPath(); g.ellipse(Wc * px, Hc * (wide ? 0.66 : 0.62), 120 * sc, 150 * sc, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(Wc * px, Hc * 1.02, 250 * sc, 180 * sc + (wide ? 60 : 0), 0, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
    for (const k of [1, 2]) {
      g.beginPath(); g.moveTo(Wc * k / 3, 0); g.lineTo(Wc * k / 3, Hc); g.stroke();
      g.beginPath(); g.moveTo(0, Hc * k / 3); g.lineTo(Wc, Hc * k / 3); g.stroke();
    }
    g.fillStyle = ink; g.textAlign = 'center'; g.font = `600 26px ${MONO}`;
    g.fillText(wide ? '0,6× · сверхширокая 12 МП' : '1× · основная 50 МП', Wc / 2, Hc * 0.9);
  }
  // камеры и вспышка вырезаны в «Крыле»
  g.fillStyle = '#000';
  for (const [x, z] of CAMS) { const [cx, cy] = at(x, z); g.beginPath(); g.arc(cx, cy, 6.2 * px, 0, Math.PI * 2); g.fill(); }
  const [fx, fy] = at(FLASH[0], FLASH[1]);
  g.beginPath(); g.arc(fx, fy, 2 * px, 0, Math.PI * 2); g.fill();
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const mats = {
    Body: new THREE.MeshPhysicalMaterial({ name: 'Body', color: 0xF6D44A, metalness: 0.1, roughness: 0.28, clearcoat: 1 }),
    Frame: new THREE.MeshStandardMaterial({ name: 'Frame', color: 0xE3C243, metalness: 1, roughness: 0.22 }),
    Hinge: new THREE.MeshStandardMaterial({ name: 'Hinge', color: 0xE3C243, metalness: 1, roughness: 0.16 }),
    Screen: new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x020203, roughness: 0.18 }),
    WingScreen: new THREE.MeshStandardMaterial({ name: 'WingScreen', color: 0x020203, roughness: 0.12 }),
    Glass: new THREE.MeshPhysicalMaterial({ name: 'Glass', color: 0x030304, roughness: 0.05, clearcoat: 1 }),
    Dark: new THREE.MeshStandardMaterial({ name: 'Dark', color: 0x0B0B0C, roughness: 0.6 }),
    Lens: new THREE.MeshPhysicalMaterial({ name: 'Lens', color: 0x020306, roughness: 0.02, clearcoat: 1 }),
    Flash: new THREE.MeshStandardMaterial({ name: 'Flash', color: 0xF3EAD6, emissive: 0xFFF4DD, emissiveIntensity: 0.15 }),
  };
  const root = new THREE.Group();
  root.name = 'OYMoth';
  const add = (geo, mat, x, y, z, name, parent) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };
  const halfH = HH - GAP;
  const screenPart = (sign) => {
    const h = SCR.h / 2;
    const geo = new THREE.PlaneGeometry(SCR.w, h);
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) + sign * h / 2;
      uv.setXY(i, (pos.getX(i) + SCR.w / 2) / SCR.w, (SCR.h / 2 - y) / SCR.h);
    }
    geo.scale(MM, MM, MM);
    return geo;
  };
  // нижняя половина
  const cy = -(GAP + halfH / 2);
  add(slab(W, halfH, 8, D, 0.4), 'Frame', 0, cy, 0, 'FrameBottom', root);
  add(slab(W - 1.6, halfH - 1.6, 7.2, 0.4), 'Body', 0, cy, -HD - 0.05, 'BodyBottom', root);
  add(screenPart(-1), 'Screen', 0, -(SCR.h / 4), HD + 0.12, 'ScreenBottom', root);
  // верхняя половина — на оси петли
  const top = new THREE.Group();
  top.name = 'Top';
  top.position.set(0, 0, PIVOT_Z);
  root.add(top);
  const tz = -PIVOT_Z / MM;
  add(slab(W, halfH, 8, D, 0.4), 'Frame', 0, -cy, tz, 'FrameTop', top);
  add(slab(W - 1.6, halfH - 1.6, 7.2, 0.4), 'Body', 0, -cy, tz - HD - 0.05, 'BodyTop', top);
  add(screenPart(1), 'Screen', 0, SCR.h / 4, tz + HD + 0.12, 'ScreenTop', top);
  const wingGeo = new THREE.PlaneGeometry(WING.w, WING.h);
  wingGeo.rotateY(Math.PI);
  { const uv = wingGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); }
  wingGeo.scale(MM, MM, MM);
  add(wingGeo, 'WingScreen', 0, WING.cy, tz - HD - 0.3, 'Wing', top);
  for (const [x, z] of CAMS) add(cylZ(5.2, 1.2, 40), 'Lens', x, z, tz - HD - 0.8, null, top);
  add(cylZ(1.3, 0.4, 24), 'Flash', FLASH[0], FLASH[1], tz - HD - 0.4, 'Flash', top);
  // корешок
  const hinge = new THREE.Group();
  hinge.name = 'Hinge';
  hinge.position.set(0, 0, PIVOT_Z);
  root.add(hinge);
  const r = HD + 0.5 + HD;
  const cyl = new THREE.CylinderGeometry(r, r, W - 1.8, 48, 1, true, Math.PI - 1.25, 2.5);
  cyl.rotateZ(Math.PI / 2);
  cyl.scale(MM, MM, MM);
  add(cyl, 'Hinge', 0, 0, 0, 'HingeCover', hinge);
  add(boxG(4, 1, 1), 'Dark', 0, -HH, 0, null, root);
  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOYMoth({ isRunning }) {
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const mkTex = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    t.anisotropy = 4;
    return t;
  };
  const mainCanvas = mkCanvas(600, Math.round(600 * SCR.h / SCR.w));
  const wingCanvas = mkCanvas(680, 760);
  const mainTex = mkTex(mainCanvas);
  const wingTex = mkTex(wingCanvas);
  const screenMat = new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x000000, roughness: 0.22, emissive: 0xffffff, emissiveMap: mainTex, emissiveIntensity: 1 });
  const wingMat = new THREE.MeshStandardMaterial({ name: 'WingScreen', color: 0x000000, roughness: 0.1, emissive: 0xffffff, emissiveMap: wingTex, emissiveIntensity: 1 });
  screenMat.toneMapped = false;
  wingMat.toneMapped = false;

  const bodyMat = new THREE.MeshPhysicalMaterial({
    name: 'Body', color: MOTH_COLORS.yellow.body, metalness: 0.05, roughness: 0.3,
    clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.7,
  });
  const frameMat = new THREE.MeshStandardMaterial({ name: 'Frame', color: MOTH_COLORS.yellow.frame, metalness: 1, roughness: 0.24, envMapIntensity: 1.2 });
  const hingeMat = new THREE.MeshStandardMaterial({ name: 'Hinge', color: MOTH_COLORS.yellow.frame, metalness: 1, roughness: 0.16, envMapIntensity: 1.4 });

  let colorName = 'yellow';
  let wingMode = 'clock';
  let mainApp = 'clock';
  // обои грузятся сразу все шесть, чтобы смена цвета была мгновенной
  const walls = {};
  for (const name of Object.keys(MOTH_COLORS)) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { if (name === colorName) redrawScreen(); };
    img.src = `/img/moth/wall-${name}.webp`;
    walls[name] = img;
  }
  function redrawScreen() {
    const c = MOTH_COLORS[colorName];
    drawMain(mainCanvas, c, mainApp, walls[colorName]);
    drawWing(wingCanvas, wingMode, c, walls[colorName]);
    mainTex.needsUpdate = true;
    wingTex.needsUpdate = true;
  }
  redrawScreen();

  const parts = { top: null, hinge: null, flashMat: null };
  const target = { body: new THREE.Color(), frame: new THREE.Color() };
  function setTargets(name) {
    const c = MOTH_COLORS[name];
    target.body.setHex(c.body);
    target.frame.setHex(c.frame);
  }
  setTargets('yellow');

  function setup(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const swap = (m) => ({ Body: bodyMat, Frame: frameMat, Hinge: hingeMat, Screen: screenMat, WingScreen: wingMat }[m?.name] || m);
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (m?.name === 'Flash') parts.flashMat = m;
        if (m?.name === 'Lens') { m.envMapIntensity = 0.2; m.roughness = 0.05; }
        if (m?.name === 'Glass' && 'clearcoat' in m) { m.clearcoat = 1; m.roughness = 0.04; }
      }
    });
    parts.top = root.getObjectByName('Top');
    parts.hinge = root.getObjectByName('Hinge');
    if (parts.flashMat) { parts.flashMat.emissive = new THREE.Color(0xFFF4DD); parts.flashMat.toneMapped = false; }
    stepColors(1);
  }

  function stepColors(k) {
    bodyMat.color.lerp(target.body, k);
    frameMat.color.lerp(target.frame, k);
    hingeMat.color.lerp(target.frame, k);
  }

  const red = new THREE.Color(0xFF2A2A);
  const warm = new THREE.Color(0xFFF4DD);
  function update(cur, dt, { reduced }) {
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));
    // fold: 0 — разложен, 1 — сложен. Корешок — на половину угла
    const a = clamp01(cur.fold) * Math.PI;
    if (parts.top) parts.top.rotation.x = a;
    if (parts.hinge) parts.hinge.rotation.x = a / 2;
    // складной экран гаснет к закрытию, «Крыло» живёт своей яркостью
    const f = smooth(cur.fold);
    screenMat.emissiveIntensity = 0.12 + clamp01(cur.screen) * 0.9 * (1 - f * 0.85);
    wingMat.emissiveIntensity = clamp01(cur.wing) * 1.0;
    if (parts.flashMat) {
      const v = clamp01(cur.flash);
      parts.flashMat.emissive.copy(warm).lerp(red, clamp01(cur.redFlash));
      parts.flashMat.emissiveIntensity = 0.15 + v * 6;
    }
  }

  return {
    url: '/models/oymoth.glb?v=7e4e95d775',
    state: { fold: 0, screen: 1, wing: 1, flash: 0, redFlash: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap: () => stepColors(1),
    api: {
      setBodyColor(name, instant = false) {
        colorName = MOTH_COLORS[name] ? name : 'yellow';
        setTargets(colorName);
        redrawScreen();
        if (instant || !isRunning()) stepColors(1);
      },
      setWing(mode) {
        if (!WING_MODES.includes(mode) || mode === wingMode) return;
        wingMode = mode;
        drawWing(wingCanvas, wingMode, MOTH_COLORS[colorName], walls[colorName]);
        wingTex.needsUpdate = true;
      },
      setMainApp(app) {
        if (app === mainApp) return;
        mainApp = app;
        drawMain(mainCanvas, MOTH_COLORS[colorName], mainApp, walls[colorName]);
        mainTex.needsUpdate = true;
      },
      setSignalColor() {},
      redrawScreen,
    },
  };
}
