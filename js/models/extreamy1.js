/* =========================================================================
   eXtream Y1 — описание 3D-модели игрового телефона: корпус со срезанными
   углами, прозрачная спинка в духе Nothing — под стеклом круглый модуль
   камер с кольцом «Пульса», два вентилятора «Вьюги» на меди, крышки
   ячеек аккумулятора и линия питания буквой Y; курки на правой грани,
   «Рубильник» на левой, слои испарительной камеры для разлёта и экран
   eXOS 4. Процедурная резервная модель с теми же именами нод.

   Состояние: fan 0..1 — обороты, pulse 0..1 — яркость «Пульса», alarm 0..1 —
   «Пульс» уходит в красный и мигает (мало здоровья), trigL/trigR 0..1 —
   курки (0,5 — полунажатие), sw 0..1 — «Рубильник», explode 0..1 — разлёт.
   ========================================================================= */

import * as THREE from 'three';
import { MM } from './oy0x0.js';

// body — внутренние крышки под стеклом, frame — алюминий рамки, glass — тон стекла спинки,
// accent — курки, «Рубильник», квадрат на крышке и «Пульс»
export const Y1_COLORS = {
  dryice: { body: 0x1B1F25, frame: 0x1E2228, glass: 0x0B1016, glassOpacity: 0.34, accent: '#4FF0FF', rough: 0.55 },
  frost: { body: 0xE3E8EC, frame: 0xBFC7CE, glass: 0xE8EEF2, glassOpacity: 0.22, accent: '#FF5A1F', rough: 0.6 },
  plasma: { body: 0x3A2366, frame: 0x24173F, glass: 0x140B26, glassOpacity: 0.32, accent: '#B8FF3A', rough: 0.5 },
};

// Геометрия (мм) — как в blender/build_extreamy1.py (glTF: высота — Y, экран смотрит в +Z)
const W = 76.6, H = 164.3, D = 9.4, HW = W / 2, HH = H / 2, HD = D / 2;
const CH = 4.2;
const SCR = { w: W - 2 * (0.5 + 1.25), h: H - 2 * (0.5 + 1.25) };
const CAM = { y: 58, r: 17.8, lens: 7, lx: 8.2 };
const FAN_R = 12.6;
const FANS = [[16, 21.4], [-16, 21.4]];
const FAN_WIN = { w: 66, h: 29 };
const SEAM_Y = 3;
const TRIG_Y = [62, -62];
const SWITCH_Y = 52, SWITCH_TRAVEL = 7;
const TRIG_TRAVEL = 0.35;
// Разлёт: насколько каждый слой уходит к спинке (−Z), мм
const EXPLODE = { Back: -76, FanDeck: -54, VC_2: -38, VC_1: -24, Board: -11, VC_3: 9 };
const INTERNALS = ['VC_1', 'Board', 'VC_3'];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const DISPLAY = '"Tektur", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/* ---------- Экран: eXOS 4 ---------- */

export const SCREEN_MODES = ['lock', 'arena', 'game', 'off'];

// Срезанный прямоугольник на холсте — так же, как корпус
function chamferPath(g, x, y, w, h, c) {
  g.beginPath();
  g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c);
  g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c);
  g.closePath();
}

function crosshair(g, cx, cy, r, color, lw = 6) {
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
    g.beginPath();
    g.moveTo(cx + dx * r * 0.45, cy + dy * r * 0.45);
    g.lineTo(cx + dx * r * 1.05, cy + dy * r * 1.05);
    g.stroke();
  }
  g.fillStyle = color;
  g.beginPath(); g.arc(cx, cy, lw * 0.9, 0, Math.PI * 2); g.fill();
}

function drawScreen(canvas, mode, accent, { udc = 0 } = {}) {
  const g = canvas.getContext('2d');
  const Wc = canvas.width, Hc = canvas.height;
  const ink = '#E8F1F5', dim = 'rgba(232,241,245,.55)';
  g.clearRect(0, 0, Wc, Hc);
  g.fillStyle = '#020304';
  g.fillRect(0, 0, Wc, Hc);
  if (mode === 'off') return;

  // фон: сетка и холодный свет из угла
  const bg = g.createLinearGradient(0, 0, Wc, Hc);
  bg.addColorStop(0, '#071016');
  bg.addColorStop(1, '#030405');
  g.fillStyle = bg;
  g.fillRect(0, 0, Wc, Hc);
  const rg = g.createRadialGradient(Wc * 0.9, Hc * 0.05, 10, Wc * 0.9, Hc * 0.05, Wc * 1.3);
  rg.addColorStop(0, accent + '55');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, Wc, Hc);
  g.strokeStyle = 'rgba(255,255,255,.04)';
  g.lineWidth = 2;
  for (let x = 0; x < Wc; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, Hc); g.stroke(); }
  for (let y = 0; y < Hc; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(Wc, y); g.stroke(); }

  // строка состояния — без выреза: фронталка под экраном
  g.textBaseline = 'middle';
  g.fillStyle = ink;
  g.font = `600 26px ${MONO}`;
  g.textAlign = 'left';
  g.fillText('21:47', 40, 46);
  g.textAlign = 'right';
  g.fillText('5G+WI-FI', Wc - 104, 46);
  chamferPath(g, Wc - 88, 34, 46, 24, 5);
  g.strokeStyle = ink; g.lineWidth = 2.4; g.stroke();
  g.fillStyle = accent;
  g.fillRect(Wc - 84, 38, 34, 16);

  if (mode === 'lock') {
    g.textAlign = 'left';
    g.fillStyle = ink;
    g.font = `800 190px ${DISPLAY}`;
    g.fillText('21', 40, 250);
    g.fillStyle = accent;
    g.fillText('47', 40, 430);
    g.font = `500 30px ${MONO}`;
    g.fillStyle = dim;
    g.fillText('ЧЕТВЕРГ · eXOS 4', 46, 540);
    crosshair(g, Wc - 130, 330, 70, accent, 7);
    const card = (y, title, sub, hot = false) => {
      chamferPath(g, 40, y, Wc - 80, 120, 18);
      g.fillStyle = 'rgba(255,255,255,.06)';
      g.fill();
      g.strokeStyle = hot ? accent : 'rgba(255,255,255,.12)';
      g.lineWidth = 2;
      g.stroke();
      g.textAlign = 'left';
      g.fillStyle = ink;
      g.font = `700 32px ${DISPLAY}`;
      g.fillText(title, 72, y + 44);
      g.fillStyle = dim;
      g.font = `400 22px ${MONO}`;
      g.fillText(sub, 72, y + 86);
    };
    card(640, '«Рубильник»: выкл', 'щёлкни — и мир затихнет', true);
    card(790, 'Трекеров eXtream — 0', 'Google — под присмотром Erbium');
    card(940, '«Вьюга» · тихо', '24 дБ · 31 °C спинка');
    g.fillStyle = dim;
    g.font = `500 24px ${MONO}`;
    g.textAlign = 'center';
    g.fillText('ПРИЛОЖИ ПАЛЕЦ', Wc / 2, Hc - 90);
    g.strokeStyle = accent; g.lineWidth = 3;
    g.beginPath(); g.arc(Wc / 2, Hc - 170, 34, 0, Math.PI * 2); g.stroke();
  } else if (mode === 'arena') {
    g.textAlign = 'left';
    g.fillStyle = accent;
    g.font = `500 24px ${MONO}`;
    g.fillText('«РУБИЛЬНИК» ВКЛ · МИР ЗАТИХ', 40, 112);
    g.fillStyle = ink;
    g.font = `800 96px ${DISPLAY}`;
    g.fillText('АРЕНА', 36, 200);
    const tile = (x, y, w, h, title, sub, c1) => {
      chamferPath(g, x, y, w, h, 22);
      const tg = g.createLinearGradient(x, y, x + w, y + h);
      tg.addColorStop(0, c1);
      tg.addColorStop(1, '#0A0D12');
      g.fillStyle = tg;
      g.fill();
      g.fillStyle = ink;
      g.font = `700 36px ${DISPLAY}`;
      g.fillText(title, x + 26, y + h - 66);
      g.fillStyle = dim;
      g.font = `400 20px ${MONO}`;
      g.fillText(sub, x + 26, y + h - 30);
    };
    tile(36, 260, Wc - 72, 300, 'Орбита', 'в «Запасе» · продолжить', accent + 'AA');
    tile(36, 584, (Wc - 90) / 2, 240, 'Сталь', '«Форсаж»', '#3A2366');
    tile(54 + (Wc - 90) / 2, 584, (Wc - 90) / 2, 240, 'Рейд', '165 fps', '#5A2210');
    // «Телеметрия»
    const stats = [['FPS', '165'], ['°C', '38'], ['ОБ/МИН', '18 400'], ['ПИНГ', '9 мс']];
    stats.forEach(([k, v], i) => {
      const x = 36 + (i % 2) * ((Wc - 72) / 2 + 9), y = 860 + Math.floor(i / 2) * 150;
      chamferPath(g, x, y, (Wc - 90) / 2, 130, 14);
      g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = dim; g.font = `500 20px ${MONO}`;
      g.fillText(k, x + 22, y + 34);
      g.fillStyle = i === 0 ? accent : ink; g.font = `700 50px ${MONO}`;
      g.fillText(v, x + 22, y + 88);
    });
  } else if (mode === 'game') {
    // условная гонка: дорога в перспективу, HUD поверх
    const hz = Hc * 0.42;
    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#05060A');
    sky.addColorStop(1, '#2A1030');
    g.fillStyle = sky; g.fillRect(0, 0, Wc, hz);
    g.fillStyle = '#FF5A1F';
    g.beginPath(); g.arc(Wc / 2, hz, 150, Math.PI, 0); g.fill();
    g.fillStyle = '#05060A';
    for (let i = 0; i < 6; i++) g.fillRect(0, hz - 120 + i * 22, Wc, 6 + i);
    g.fillStyle = '#07090D'; g.fillRect(0, hz, Wc, Hc - hz);
    g.strokeStyle = accent; g.lineWidth = 3;
    for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(Wc / 2 + i * 12, hz); g.lineTo(Wc / 2 + i * 260, Hc); g.stroke(); }
    for (let k = 0; k < 9; k++) { const y = hz + Math.pow(k / 8, 2) * (Hc - hz); g.beginPath(); g.moveTo(0, y); g.lineTo(Wc, y); g.stroke(); }
    chamferPath(g, Wc / 2 - 70, Hc * 0.72, 140, 120, 20);
    g.fillStyle = '#E8F1F5'; g.fill();
    g.fillStyle = accent; g.fillRect(Wc / 2 - 60, Hc * 0.72 + 90, 120, 12);
    // HUD «Телеметрии»
    chamferPath(g, 30, 90, 300, 170, 14);
    g.fillStyle = 'rgba(2,3,4,.72)'; g.fill();
    g.strokeStyle = accent; g.lineWidth = 2; g.stroke();
    g.textAlign = 'left';
    [['FPS', '165'], ['°C', '39'], ['ПИНГ', '9']].forEach(([k, v], i) => {
      g.fillStyle = dim; g.font = `500 20px ${MONO}`; g.fillText(k, 52, 126 + i * 46);
      g.fillStyle = i === 0 ? accent : ink; g.font = `700 32px ${MONO}`; g.fillText(v, 170, 126 + i * 46);
    });
  }

  // подэкранная фронталка: обычно её не видно, в главе «Экран» — подсвечена
  if (udc > 0) {
    const cx = Wc / 2, cy = 54;
    g.globalAlpha = udc;
    g.strokeStyle = accent; g.lineWidth = 3;
    g.setLineDash([8, 8]);
    g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(232,241,245,.05)';
    g.beginPath(); g.arc(cx, cy, 18, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  }
}

/* ---------- Резервная процедурная модель ---------- */

function chamferShape(w, h, c, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = w / 2, y = h / 2;
  s.moveTo(cx + x - c, cy - y); s.lineTo(cx + x, cy - y + c); s.lineTo(cx + x, cy + y - c); s.lineTo(cx + x - c, cy + y);
  s.lineTo(cx - x + c, cy + y); s.lineTo(cx - x, cy + y - c); s.lineTo(cx - x, cy - y + c); s.lineTo(cx - x + c, cy - y);
  s.closePath();
  return s;
}
const extrude = (shape, depth) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  g.scale(MM, MM, MM);
  return g;
};

function buildFallback() {
  const mats = {
    Body: new THREE.MeshStandardMaterial({ name: 'Body', color: Y1_COLORS.dryice.body, metalness: 0.35, roughness: 0.55 }),
    Frame: new THREE.MeshStandardMaterial({ name: 'Frame', color: Y1_COLORS.dryice.frame, metalness: 1, roughness: 0.38 }),
    Accent: new THREE.MeshStandardMaterial({ name: 'Accent', color: 0x4FF0FF, emissive: 0x4FF0FF, emissiveIntensity: 0.6 }),
    Trigger: new THREE.MeshStandardMaterial({ name: 'Trigger', color: 0x4FF0FF, emissive: 0x4FF0FF, emissiveIntensity: 0.3 }),
    PulseGlow: new THREE.MeshStandardMaterial({ name: 'PulseGlow', color: 0x4FF0FF, emissive: 0x4FF0FF, emissiveIntensity: 2 }),
    Screen: new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x020203 }),
    DeckGlass: new THREE.MeshPhysicalMaterial({ name: 'DeckGlass', color: 0x0B1016, roughness: 0.1 }),
    CamRing: new THREE.MeshStandardMaterial({ name: 'CamRing', color: 0xC9CED4, metalness: 1, roughness: 0.12 }),
    CamPlate: new THREE.MeshPhysicalMaterial({ name: 'CamPlate', color: 0x050608, roughness: 0.05, clearcoat: 1 }),
    LensRing: new THREE.MeshStandardMaterial({ name: 'LensRing', color: 0x8C939C, metalness: 1, roughness: 0.16 }),
    Lens: new THREE.MeshPhysicalMaterial({ name: 'Lens', color: 0x0A1430, roughness: 0.04, clearcoat: 1 }),
    Copper: new THREE.MeshStandardMaterial({ name: 'Copper', color: 0xC8743A, metalness: 1, roughness: 0.28 }),
    FanBlade: new THREE.MeshStandardMaterial({ name: 'FanBlade', color: 0x20252D, metalness: 0.4, roughness: 0.32 }),
    Chassis: new THREE.MeshStandardMaterial({ name: 'Chassis', color: 0x0D1014, metalness: 0.6, roughness: 0.5 }),
    Battery: new THREE.MeshStandardMaterial({ name: 'Battery', color: 0x1C1F24, roughness: 0.5 }),
  };
  const root = new THREE.Group();
  root.name = 'eXtreamY1';
  const grp = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); return g; };
  const add = (geo, mat, x, y, z, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };
  const disc = (r, depth, seg = 64) => new THREE.CylinderGeometry(r * MM, r * MM, depth * MM, seg).rotateX(Math.PI / 2);
  const ring = (r0, r1) => new THREE.RingGeometry(r0 * MM, r1 * MM, 96).rotateY(Math.PI);

  add(extrude(chamferShape(W, H, CH), D - 1.0), 'Frame', 0, 0, 0, 'Frame');
  const scr = new THREE.ShapeGeometry(chamferShape(SCR.w, SCR.h, CH - 1.2));
  { const uv = scr.attributes.uv, p = scr.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + SCR.w / 2) / SCR.w, (SCR.h / 2 - p.getY(i)) / SCR.h); }
  scr.scale(MM, MM, MM);
  add(scr, 'Screen', 0, 0, HD + 0.05, 'Screen');

  const back = grp('Back');
  add(extrude(chamferShape(W - 1, H - 1, CH - 0.4), 0.5), 'DeckGlass', 0, 0, -HD + 0.25, 'BackGlass', back);
  const top = chamferShape(W - 5.2, HH - 2.6 - SEAM_Y - 0.5, 1, 0, (HH - 2.6 + SEAM_Y + 0.5) / 2);
  top.holes.push(chamferShape(FAN_WIN.w, FAN_WIN.h, 4, 0, FANS[0][1]));
  add(extrude(top, 0.7), 'Body', 0, 0, -HD + 1.4, 'CoverTop', back);
  add(extrude(chamferShape(W - 5.2, HH - 2.6 + SEAM_Y - 0.5, 1, 0, (-HH + 2.6 + SEAM_Y - 0.5) / 2), 0.7), 'Body', 0, 0, -HD + 1.4, 'CoverBottom', back);
  add(disc(CAM.r, 2.4), 'CamRing', 0, CAM.y, -HD - 0.2, null, back);
  add(disc(CAM.r - 1.6, 0.4), 'CamPlate', 0, CAM.y, -HD - 1.3, null, back);
  for (const x of [CAM.lx, -CAM.lx]) {
    add(disc(CAM.lens, 0.9), 'LensRing', x, CAM.y, -HD - 1.6, null, back);
    add(disc(CAM.lens - 1.4, 1), 'Lens', x, CAM.y, -HD - 1.7, null, back);
  }
  add(ring(19, 19.7), 'PulseGlow', 0, CAM.y, -HD + 0.6, 'GlyphRing', back);
  add(new THREE.BoxGeometry(0.9 * MM, 67 * MM, 0.1 * MM), 'PulseGlow', 0, -37.5, -HD + 0.6, 'PowerLine', back);

  const deck = grp('FanDeck');
  FANS.forEach(([x, y], i) => {
    const fan = new THREE.Group();
    fan.name = `Fan_${i + 1}`;
    fan.position.set(x * MM, y * MM, -1.6 * MM);
    deck.add(fan);
    for (let k = 0; k < 17; k++) {
      const a = (k / 17) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(7.4 * MM, 0.38 * MM, 2.4 * MM), mats.FanBlade);
      blade.position.set(Math.cos(a) * 8.3 * MM, Math.sin(a) * 8.3 * MM, 0);
      blade.rotation.z = a - 0.5;
      fan.add(blade);
    }
    add(ring(FAN_R + 0.85, FAN_R + 1.4), 'PulseGlow', x, y, -HD + 0.85, null, deck);
  });
  add(extrude(chamferShape(FAN_WIN.w + 1, FAN_WIN.h + 1, 4.2, 0, FANS[0][1]), 0.3), 'Copper', 0, 0, -0.5, 'VC_2');
  add(extrude(chamferShape(22, 22, 3, 0, FANS[0][1]), 0.3), 'Copper', 0, 0, 0.35, 'VC_1');
  const board = grp('Board');
  add(extrude(chamferShape(68, 70, 5, 0, 40), 0.6), 'Chassis', 0, 0, 2.2, null, board);
  for (const x of [-17, 17]) add(extrude(chamferShape(32, 72, 3, x, -42), 2.9), 'Battery', 0, 0, 1.15, null, board);
  add(extrude(chamferShape(70, 150, 5, 0, -2), 0.35), 'Copper', 0, 0, 3.4, 'VC_3');
  TRIG_Y.forEach((y, i) => {
    add(new THREE.BoxGeometry(0.4 * MM, 13.4 * MM, 2.9 * MM), 'Trigger', HW + 0.1, y, 0, i ? 'Trigger_R' : 'Trigger_L');
  });
  add(new THREE.BoxGeometry(0.75 * MM, 5.8 * MM, 2.1 * MM), 'Accent', -HW - 0.3, SWITCH_Y - SWITCH_TRAVEL / 2, 0, 'Switch');
  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createExtreamY1({ isRunning }) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = Math.round(600 * SCR.h / SCR.w);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 4;
  const screenMat = new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x000000, roughness: 0.2, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1 });
  screenMat.toneMapped = false;

  // внутренние крышки под стеклом: анодированный металл
  const bodyMat = new THREE.MeshStandardMaterial({ name: 'Body', color: Y1_COLORS.dryice.body, metalness: 0.35, roughness: 0.55, envMapIntensity: 0.9 });
  const frameMat = new THREE.MeshStandardMaterial({ name: 'Frame', color: Y1_COLORS.dryice.frame, metalness: 1, roughness: 0.38, envMapIntensity: 1.1 });
  const accentMat = new THREE.MeshStandardMaterial({ name: 'Accent', color: 0x4FF0FF, metalness: 0.2, roughness: 0.3, emissive: 0x4FF0FF, emissiveIntensity: 0.6 });
  const pulseMat = new THREE.MeshStandardMaterial({ name: 'PulseGlow', color: 0x4FF0FF, roughness: 0.2, emissive: 0x4FF0FF, emissiveIntensity: 2 });
  pulseMat.toneMapped = false;
  const glassMat = new THREE.MeshPhysicalMaterial({
    name: 'DeckGlass', color: Y1_COLORS.dryice.glass, metalness: 0, roughness: 0.05, transparent: true, opacity: Y1_COLORS.dryice.glassOpacity,
    clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, depthWrite: false,
  });
  const trigMats = [0, 1].map(() => new THREE.MeshStandardMaterial({ name: 'Trigger', color: 0x4FF0FF, metalness: 0.6, roughness: 0.25, emissive: 0x4FF0FF, emissiveIntensity: 0.3 }));
  trigMats.forEach((m) => { m.toneMapped = false; });
  // Размытие крыльчатки на больших оборотах: лопатки сливаются в диск
  const blurMat = new THREE.MeshBasicMaterial({ color: 0x2A3038, transparent: true, opacity: 0, depthWrite: false });

  let colorName = 'dryice';
  let screenMode = 'lock';
  let udc = 0;
  const accent = new THREE.Color(0x4FF0FF);
  const red = new THREE.Color(0xFF2433);
  const target = { body: new THREE.Color(), frame: new THREE.Color(), glass: new THREE.Color(), accent: new THREE.Color(), rough: 0.55, opacity: 0.34 };
  function setTargets(name) {
    const c = Y1_COLORS[name];
    target.body.setHex(c.body);
    target.frame.setHex(c.frame);
    target.glass.setHex(c.glass);
    target.accent.set(c.accent);
    target.rough = c.rough;
    target.opacity = c.glassOpacity;
  }
  setTargets('dryice');

  function redrawScreen() {
    drawScreen(canvas, screenMode, Y1_COLORS[colorName].accent, { udc });
    tex.needsUpdate = true;
  }
  redrawScreen();

  const parts = { fans: [], triggers: [], trigBase: [], sw: null, swBase: 0, layers: [], internals: [] };

  function setup(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const swap = (m) => ({ Body: bodyMat, Frame: frameMat, Accent: accentMat, PulseGlow: pulseMat, DeckGlass: glassMat, Screen: screenMat }[m?.name] || m);
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (m?.name === 'Lens') { m.envMapIntensity = 0.2; m.roughness = 0.05; }
        if (m?.name === 'Copper') { m.metalness = 1; m.roughness = 0.3; m.envMapIntensity = 1.3; }
        if (m?.name === 'CamPlate' && 'clearcoat' in m) { m.clearcoat = 1; m.roughness = 0.05; }
        if (m?.name === 'CamRing') { m.metalness = 1; m.roughness = 0.12; m.envMapIntensity = 1.6; }
        if (m?.name === 'LensRing') { m.metalness = 1; m.roughness = 0.16; m.envMapIntensity = 1.4; }
      }
      if (o.material === glassMat) o.renderOrder = 2;
    });
    for (let i = 1; i <= 2; i++) {
      const fan = root.getObjectByName(`Fan_${i}`);
      if (!fan) continue;
      const disc = new THREE.Mesh(new THREE.CircleGeometry((FAN_R - 0.6) * MM, 48), blurMat);
      disc.rotation.y = Math.PI;
      disc.position.z = -1.6 * MM;
      disc.renderOrder = 1;
      fan.add(disc);
      parts.fans.push(fan);
    }
    ['Trigger_L', 'Trigger_R'].forEach((n, i) => {
      const t = root.getObjectByName(n);
      if (!t) return;
      t.traverse((o) => { if (o.isMesh) o.material = trigMats[i]; });
      parts.triggers[i] = t;
      parts.trigBase[i] = t.position.x;
    });
    parts.sw = root.getObjectByName('Switch');
    if (parts.sw) parts.swBase = parts.sw.position.y;
    for (const [name, off] of Object.entries(EXPLODE)) {
      const o = root.getObjectByName(name);
      if (o) parts.layers.push({ o, base: o.position.z, off: off * MM });
    }
    for (const name of INTERNALS) {
      const o = root.getObjectByName(name);
      if (o) parts.internals.push(o);
    }
    stepColors(1);
  }

  function stepColors(k) {
    bodyMat.color.lerp(target.body, k);
    bodyMat.roughness += (target.rough - bodyMat.roughness) * k;
    frameMat.color.lerp(target.frame, k);
    glassMat.color.lerp(target.glass, k);
    glassMat.opacity += (target.opacity - glassMat.opacity) * k;
    accent.lerp(target.accent, k);
    accentMat.color.copy(accent);
    accentMat.emissive.copy(accent);
  }

  let fanAngle = 0;
  const tmp = new THREE.Color();
  function update(cur, dt, { reduced }) {
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));
    const now = performance.now();

    // Вентиляторы: угол копится, на больших оборотах лопатки размываются в диск.
    // Скорость ограничена, чтобы на 60 кадрах крыльчатка не «крутилась назад»
    const fan = clamp01(cur.fan);
    // fanDir: 1 — обычное вращение, −1 — «Продувка» назад; при смене проходит через ноль
    if (!reduced) fanAngle += dt * (1.2 + fan * 11) * (fan > 0.01 ? 1 : 0) * (cur.fanDir ?? 1);
    parts.fans.forEach((f, i) => { f.rotation.z = (i ? -1 : 1) * fanAngle; });
    blurMat.opacity = smooth((fan - 0.35) / 0.65) * 0.72;

    // «Пульс»: цвет акцента, при тревоге — красный и мигает
    const alarm = clamp01(cur.alarm);
    const blink = reduced ? 1 : 0.55 + 0.45 * Math.sin(now / 110);
    tmp.copy(accent).lerp(red, alarm);
    pulseMat.color.copy(tmp);
    pulseMat.emissive.copy(tmp);
    pulseMat.emissiveIntensity = (0.15 + clamp01(cur.pulse) * 2.6) * (alarm > 0.5 ? blink : 1);

    // Курки: 0,5 — полунажатие, 1 — до упора; свечение растёт с нажатием
    for (let i = 0; i < 2; i++) {
      const v = clamp01(i ? cur.trigR : cur.trigL);
      const t = parts.triggers[i];
      if (t) t.position.x = parts.trigBase[i] - v * TRIG_TRAVEL * MM;
      trigMats[i].color.copy(accent);
      trigMats[i].emissive.copy(accent);
      trigMats[i].emissiveIntensity = 0.25 + v * 3.5;
    }

    // «Рубильник»
    if (parts.sw) parts.sw.position.y = parts.swBase + smooth(cur.sw) * SWITCH_TRAVEL * MM;

    // Разлёт слоёв «Вьюги»
    const e = smooth(cur.explode);
    for (const l of parts.layers) l.o.position.z = l.base + l.off * e;
    for (const o of parts.internals) o.visible = e > 0.01;

    screenMat.emissiveIntensity = 0.1 + clamp01(cur.screen) * 0.95;
  }

  return {
    url: '/models/extreamy1.glb?v=c164963a5a',
    state: { fan: 0.5, fanDir: 1, pulse: 1, alarm: 0, trigL: 0, trigR: 0, sw: 0, explode: 0, screen: 1 },
    parts,
    setup,
    buildFallback,
    update,
    snap: () => stepColors(1),
    api: {
      setBodyColor(name, instant = false) {
        colorName = Y1_COLORS[name] ? name : 'dryice';
        setTargets(colorName);
        redrawScreen();
        if (instant || !isRunning()) stepColors(1);
      },
      setScreen(mode, opts = {}) {
        const nextUdc = opts.udc ?? udc;
        if (!SCREEN_MODES.includes(mode) || (mode === screenMode && nextUdc === udc)) return;
        screenMode = mode;
        udc = nextUdc;
        redrawScreen();
      },
      redrawScreen,
    },
  };
}

// Для 2D-рисунков страницы: тот же экран, что на модели
export { drawScreen, chamferPath, crosshair };
export const Y1_MM = { W, H, D };
