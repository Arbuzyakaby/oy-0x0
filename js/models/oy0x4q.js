/* =========================================================================
   OY 0X4Q — описание 3D-модели: четвёртое поколение линейки Q, 150,4 × 71,2 ×
   7,9 мм. Плоская рамка, матовое стекло сзади, модуль камер «Планка» во всю
   ширину спинки у верхнего края. Шесть модулей лежат в GLB отдельными нодами
   (ModClassic … ModCap), на сцене виден один. Модуль снимается от спинки
   (pull), у «Шторки» шторка сворачивается в кассету (shutter), кнопки «0» и
   «1» утапливаются (key0, key1), фонарь на верхней грани (torch). Экран
   CamelOS 2.5 рисуется на canvas. Процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, roundRect, slab, boxG, cylZ, makeBeam } from './oy0x0.js';

// body — спинка, frame — рамка, кнопки и «Планка», ui — акцент CamelOS на экране
export const Q4_COLORS = {
  tuile: { body: 0x9A4128, frame: 0x9A5A3A, ui: '#FF8A5C', label: 'Черепица' },
  seine: { body: 0x4A5C50, frame: 0x45494C, ui: '#8FD0A8', label: 'Сена' },
  calcaire: { body: 0xD3C8B2, frame: 0xBFC2C6, ui: '#E9D9B8', label: 'Известняк' },
  ardoise: { body: 0x222428, frame: 0x34373C, ui: '#9FB3C8', label: 'Сланец' },
};
export const MODULES = ['classic', 'shutter', 'night', 'thermal', 'beam', 'cap'];
const NODE = { classic: 'ModClassic', shutter: 'ModShutter', night: 'ModNight', thermal: 'ModThermal', beam: 'ModBeam', cap: 'ModCap' };
export const SCREEN_MODES = ['off', 'lock', 'camera', 'kill', 'torch', 'sign', 'boot'];
export const TORCH_COLORS = { white: 0xFFFFFF, red: 0xFF2A2A };

// Геометрия, мм — как в blender/build_oy0x4q.py
const W = 71.2, H = 150.4, HH = H / 2;
const TOP_Y = HH * MM;            // верхняя грань, м
const SCR = { w: W - 3, h: H - 3 };
const PULL = 0.024;               // м: насколько модуль отходит от спинки
const KEY_TRAVEL = 0.00045;       // м: ход кнопки «0» / «1» с фиксацией

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pad2 = (n) => String(n).padStart(2, '0');
const sans = (px, wt = 700) => `${wt} ${px}px "Onest", system-ui, sans-serif`;
const mono = (px, wt = 600) => `${wt} ${px}px "JetBrains Mono", ui-monospace, monospace`;

/* ---------- Картинка: парижские крыши в сумерках ---------- */

// Одна сцена и для обоев, и для видоискателя, и для демо на странице.
// mode: 'day' — обычная камера, 'night' — монохром с ИК, 'thermal' — тепловизор
export function drawRoofs(g, w, h, { t = 0, mode = 'day', accent = '#FF8A5C' } = {}) {
  const night = mode === 'night', heat = mode === 'thermal';
  const sky = g.createLinearGradient(0, 0, 0, h * 0.7);
  if (heat) { sky.addColorStop(0, '#0B0420'); sky.addColorStop(1, '#2A0B4A'); }
  else if (night) { sky.addColorStop(0, '#05070A'); sky.addColorStop(1, '#1E2A26'); }
  else { sky.addColorStop(0, '#1B2350'); sky.addColorStop(0.5, '#6A4A86'); sky.addColorStop(0.82, '#E8836A'); sky.addColorStop(1, '#FFC98E'); }
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  if (!heat && !night) {
    const sun = g.createRadialGradient(w * 0.7, h * 0.62, 0, w * 0.7, h * 0.62, w * 0.55);
    sun.addColorStop(0, 'rgba(255,236,200,.95)');
    sun.addColorStop(0.15, 'rgba(255,190,140,.45)');
    sun.addColorStop(1, 'rgba(255,160,120,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
  }
  // три ряда крыш: дальний, средний, ближний — с трубами и мансардами
  const rows = [
    { y: 0.58, hgt: 0.07, c: heat ? '#3A1060' : night ? '#2C3A34' : '#7A3E52', seed: 1 },
    { y: 0.68, hgt: 0.1, c: heat ? '#5A1468' : night ? '#3E5048' : '#4A2236', seed: 2 },
    { y: 0.8, hgt: 0.14, c: heat ? '#2A0A40' : night ? '#56685E' : '#2A1420', seed: 3 },
  ];
  for (const r of rows) {
    g.fillStyle = r.c;
    g.beginPath();
    g.moveTo(0, h);
    let x = 0, k = r.seed;
    while (x < w) {
      const bw = w * (0.08 + ((k * 37) % 7) * 0.012);
      const top = h * (r.y - r.hgt * (0.4 + ((k * 13) % 5) * 0.12));
      g.lineTo(x, h * r.y);
      g.lineTo(x + bw * 0.12, top);
      g.lineTo(x + bw * 0.88, top);
      g.lineTo(x + bw, h * r.y);
      // труба
      if (k % 2) { g.lineTo(x + bw, top - h * 0.02); g.lineTo(x + bw + w * 0.012, top - h * 0.02); g.lineTo(x + bw + w * 0.012, h * r.y); }
      x += bw + w * 0.012;
      k++;
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();
  }
  // окна мансард: тёплые точки (на тепловизоре — горячие)
  for (let i = 0; i < 26; i++) {
    const x = w * ((i * 0.137 + 0.05) % 1), y = h * (0.62 + ((i * 7) % 5) * 0.045);
    const on = Math.sin(t * 0.6 + i * 1.7) > -0.4;
    if (!on) continue;
    g.fillStyle = heat ? '#FFE15A' : night ? 'rgba(220,255,230,.85)' : 'rgba(255,214,140,.9)';
    g.fillRect(x, y, w * 0.012, h * 0.012);
  }
  // на тепловизоре — человек на крыше, ярче всех
  if (heat) {
    const px = w * 0.42, py = h * 0.6;
    const grd = g.createRadialGradient(px, py, 0, px, py, w * 0.08);
    grd.addColorStop(0, '#FFFFFF');
    grd.addColorStop(0.3, '#FFD23A');
    grd.addColorStop(0.7, '#FF5A1A');
    grd.addColorStop(1, 'rgba(255,40,40,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(px, py, w * 0.03, h * 0.05, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(px, py - h * 0.06, w * 0.02, 0, Math.PI * 2);
    g.fill();
  }
  if (night) {
    // ИК-подсветка: светлое пятно и зерно
    const ir = g.createRadialGradient(w * 0.5, h * 0.65, 0, w * 0.5, h * 0.65, w * 0.6);
    ir.addColorStop(0, 'rgba(210,255,220,.22)');
    ir.addColorStop(1, 'rgba(210,255,220,0)');
    g.fillStyle = ir;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < 160; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  if (!heat && !night) {
    const glow = g.createRadialGradient(w * 0.15, 0, 0, w * 0.15, 0, w * 0.8);
    glow.addColorStop(0, accent + '55');
    glow.addColorStop(1, accent + '00');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
  }
}

/* ---------- Экран телефона ---------- */

const CAM_LABEL = {
  classic: '«КЛАССИКА 4» · 1× · 24 мм',
  shutter: '«ШТОРКА» · 1× · 24 мм',
  night: '«НОЧЬ» · ИК 940 нм',
  thermal: '«ТЕПЛО 2» · 640 × 512',
  beam: '«ЛУЧ 2» · КАМЕР НЕТ',
  cap: 'ЗАГЛУШКА · КАМЕР НЕТ',
};

export function drawScreen(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const now = st.now ?? performance.now();
  const ui = st.ui || '#FF8A5C';
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  if (mode === 'off') return;
  g.textBaseline = 'middle';
  g.textAlign = 'center';

  const statusBar = () => {
    g.font = mono(22, 600);
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.textAlign = 'left';
    g.fillText('CamelOS 2.5', 44, 58);
    g.textAlign = 'right';
    const k0 = st.key0 ? ' · 0' : '', k1 = st.key1 ? ' · 1' : '';
    g.fillText(`${st.region === 'na' ? 'NC4 · 5G mmW' : 'NC4 · 5G'}${k0}${k1} · 88 %`, w - 44, 58);
    g.textAlign = 'center';
  };

  if (mode === 'lock' || mode === 'boot') {
    drawRoofs(g, w, h, { t: now / 1000, accent: ui });
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.fillRect(0, 0, w, h);
    statusBar();
    const d = new Date();
    g.fillStyle = '#FFF6EC';
    g.font = sans(190, 700);
    g.fillText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, w / 2, h * 0.2);
    g.font = sans(30, 500);
    g.fillStyle = 'rgba(255,246,236,.78)';
    g.fillText(mode === 'boot' ? 'CamelOS 2.5 · первый в мире' : 'Париж · амбар · +9°', w / 2, h * 0.28);
    if (mode === 'boot') {
      roundRect(g, 60, h * 0.36, w - 120, 200, 34);
      g.fillStyle = 'rgba(10,8,6,.55)';
      g.fill();
      g.textAlign = 'left';
      g.font = mono(24, 600);
      ['oasis 2 · ядро … ok', 'сборка OY · хеш … ok', 'подписи · 2 из 3 … ok'].forEach((s, i) => {
        g.fillStyle = i === 2 ? ui : 'rgba(255,246,236,.85)';
        g.fillText(s, 100, h * 0.36 + 52 + i * 50);
      });
      g.textAlign = 'center';
    }
    return;
  }

  if (mode === 'camera') {
    const mod = st.module || 'classic';
    if (mod === 'beam' || mod === 'cap' || (mod === 'shutter' && (st.shutter ?? 0) > 0.95)) {
      g.fillStyle = '#0B0908';
      g.fillRect(0, 0, w, h);
      statusBar();
      g.font = sans(54, 760);
      g.fillStyle = '#FFF6EC';
      g.fillText(mod === 'shutter' ? 'Шторка закрыта' : 'Задних камер нет', w / 2, h * 0.44);
      g.font = mono(26, 600);
      g.fillStyle = ui;
      g.fillText(mod === 'shutter' ? 'Tesseract 5 обесточил сенсоры' : mod === 'beam' ? 'Модуль «Луч 2»: только свет' : 'Заглушка: спинка ровная', w / 2, h * 0.5);
      return;
    }
    drawRoofs(g, w, h, { t: now / 1000, accent: ui, mode: mod === 'night' ? 'night' : mod === 'thermal' ? 'thermal' : 'day' });
    g.strokeStyle = 'rgba(255,255,255,.28)';
    g.lineWidth = 2;
    for (const k of [1 / 3, 2 / 3]) {
      g.beginPath(); g.moveTo(w * k, 0); g.lineTo(w * k, h); g.stroke();
      g.beginPath(); g.moveTo(0, h * k); g.lineTo(w, h * k); g.stroke();
    }
    statusBar();
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.fillRect(0, h * 0.84, w, h * 0.16);
    g.font = mono(24, 700);
    g.fillStyle = mod === 'thermal' ? '#FFD23A' : mod === 'night' ? '#BDFFCF' : '#FFF6EC';
    g.fillText(CAM_LABEL[mod], w / 2, h * 0.865);
    g.beginPath();
    g.arc(w / 2, h * 0.93, 44, 0, Math.PI * 2);
    g.fillStyle = '#FFF6EC';
    g.fill();
    return;
  }

  if (mode === 'kill') {
    g.fillStyle = '#0B0908';
    g.fillRect(0, 0, w, h);
    statusBar();
    g.font = sans(54, 760);
    g.fillStyle = '#FFF6EC';
    g.fillText('Кнопки «0» и «1»', w / 2, h * 0.16);
    g.font = mono(26, 600);
    g.fillStyle = ui;
    g.fillText('аппаратный режим · Tesseract 5', w / 2, h * 0.22);
    const rows = [['Камеры', st.key0], ['Микрофоны', st.key0], ['Сотовая связь', st.key1], ['Wi-Fi и Bluetooth', st.key1], ['Геолокация', st.key1]];
    rows.forEach(([name, off], i) => {
      const y = h * (0.34 + i * 0.1);
      roundRect(g, 50, y - 46, w - 100, 92, 24);
      g.fillStyle = off ? 'rgba(255,255,255,.04)' : 'rgba(255,138,92,.14)';
      g.fill();
      g.textAlign = 'left';
      g.font = sans(32, 600);
      g.fillStyle = off ? 'rgba(255,246,236,.35)' : '#FFF6EC';
      g.fillText(name, 84, y);
      g.textAlign = 'right';
      g.font = mono(26, 700);
      g.fillStyle = off ? '#FF5A4E' : ui;
      g.fillText(off ? 'обесточено' : 'вкл', w - 84, y);
    });
    g.textAlign = 'center';
    return;
  }

  if (mode === 'torch') {
    const on = st.torch ?? 0;
    g.fillStyle = '#0B0908';
    g.fillRect(0, 0, w, h);
    statusBar();
    const c = st.torchColor === 'red' ? '255,60,60' : '255,246,230';
    const grd = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.7);
    grd.addColorStop(0, `rgba(${c},${0.55 * on})`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.font = sans(54, 760);
    g.fillStyle = '#FFF6EC';
    g.fillText('Сигнальный фонарь', w / 2, h * 0.42);
    g.font = mono(28, 600);
    g.fillStyle = ui;
    g.fillText(st.torchMode || 'до 5000 м · в корпусе', w / 2, h * 0.49);
    return;
  }

  if (mode === 'sign') {
    g.fillStyle = '#0B0908';
    g.fillRect(0, 0, w, h);
    statusBar();
    g.font = sans(50, 760);
    g.fillStyle = '#FFF6EC';
    g.fillText('Обновление 2.5.1', w / 2, h * 0.18);
    g.font = mono(26, 600);
    g.fillStyle = 'rgba(255,246,236,.6)';
    g.fillText('нужно 2 подписи из 3', w / 2, h * 0.24);
    const keys = st.keys || [0, 0, 0];
    [['Париж · OY', true], ['Стокгольм · Fyr', false], ['Стокгольм · Fyr', false]].forEach(([name, oy], i) => {
      const y = h * (0.36 + i * 0.12);
      roundRect(g, 60, y - 56, w - 120, 112, 28);
      g.fillStyle = keys[i] ? (oy ? 'rgba(255,138,92,.22)' : 'rgba(79,140,255,.22)') : 'rgba(255,255,255,.05)';
      g.fill();
      g.textAlign = 'left';
      g.font = sans(32, 650);
      g.fillStyle = '#FFF6EC';
      g.fillText(name, 100, y);
      g.textAlign = 'right';
      g.font = mono(26, 700);
      g.fillStyle = keys[i] ? (oy ? ui : '#7FA4FF') : 'rgba(255,246,236,.35)';
      g.fillText(keys[i] ? 'подписано' : 'ждёт', w - 100, y);
    });
    const n = keys.filter(Boolean).length;
    g.textAlign = 'center';
    g.font = sans(40, 760);
    g.fillStyle = n >= 2 ? '#8FD0A8' : 'rgba(255,246,236,.5)';
    g.fillText(n >= 2 ? 'Tesseract 5: обновление принято' : `${n} из 2`, w / 2, h * 0.78);
  }
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const std = (name, color, o = {}) => new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.45, ...o });
  const mats = {
    Body: std('Body', Q4_COLORS.tuile.body, { roughness: 0.5 }),
    Frame: std('Frame', Q4_COLORS.tuile.frame, { metalness: 0.9, roughness: 0.38 }),
    Planka: std('Planka', Q4_COLORS.tuile.frame, { metalness: 0.9, roughness: 0.45 }),
    Lens: std('Lens', 0x020306, { roughness: 0.05, clearcoat: 1 }),
    Screen: std('Screen', 0x020203),
    Glass: std('Glass', 0x030304, { roughness: 0.05, clearcoat: 1 }),
    PowerKey: std('PowerKey', Q4_COLORS.tuile.frame, { metalness: 1, roughness: 0.22 }),
    QKey: std('QKey', 0xC9A45C, { metalness: 1, roughness: 0.24 }),
    Shutter: std('Shutter', Q4_COLORS.tuile.frame, { metalness: 1, roughness: 0.3 }),
    TorchGlow: std('TorchGlow', 0xEDEDED, { emissive: 0xFFFFFF, emissiveIntensity: 0.4 }),
  };
  const root = new THREE.Group();
  root.name = 'OY0X4Q';
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };
  // +Z — экран, −Z — спинка
  add(slab(W, H, 10, 7.9, 0.45, 10), 'Frame', 0, 0, 0, 'Frame');
  add(slab(W - 3.4, H - 26, 8, 0.4, 0.15, 10), 'Body', 0, -11.4, -3.95, 'Body');
  add(slab(W - 0.8, H - 0.8, 9.6, 0.4, 0.15, 10), 'Glass', 0, 0, 3.95, 'Glass');
  const scr = new THREE.PlaneGeometry(SCR.w * MM, SCR.h * MM);
  const uv = scr.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - uv.getY(i));
  add(scr, 'Screen', 0, 0, 4.2, 'Screen');
  const zm = HH - 1.7 - 10.5;
  for (const [id, n] of Object.entries(NODE)) {
    const grp = new THREE.Group();
    grp.name = n;
    root.add(grp);
    add(slab(W - 3.4, 21, 3, 8.2, 0.4, 10), 'Planka', 0, zm, -1.95, null, grp);
    if (id === 'cap') continue;
    for (const [x, r] of [[24, 5.2], [8, 7.6], [-8, 5.6]]) add(cylZ(r - 1.4, 0.6), 'Lens', x, zm, -6.2, null, grp);
    if (id === 'shutter') {
      const sh = new THREE.Group();
      sh.name = 'Shutter';
      sh.position.set(-24 * MM, zm * MM, -6.9 * MM);
      grp.add(sh);
      add(boxG(55, 16, 0.6), 'Shutter', 27.5, 0, 0, null, sh);
    }
  }
  for (const [n, y] of [['Key0', HH - 40], ['Key1', HH - 53]]) add(boxG(1, 9.6, 2.5), 'PowerKey', -W / 2 - 0.3, y, 0, n);
  add(boxG(0.6, 6.6, 2.5), 'QKey', W / 2 + 0.3, HH - 78, 0, 'QButton');
  add(boxG(10, 0.4, 2.4), 'TorchGlow', 0, HH + 0.1, 0, 'Torch');
  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X4Q({ phone, scale, isRunning }) {
  // сигнальный фонарь на верхней грани светит вверх
  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, TOP_Y * scale + 0.004, 0);
  glow.position.set(0, TOP_Y * scale + 0.01, 0);
  phone.add(beam, glow);

  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = 600;
  scrCanvas.height = Math.round(600 * SCR.h / SCR.w);
  const scrTex = new THREE.CanvasTexture(scrCanvas);
  scrTex.colorSpace = THREE.SRGBColorSpace;
  scrTex.flipY = false;
  scrTex.anisotropy = 8;
  const screenMat = new THREE.MeshStandardMaterial({
    name: 'Screen', color: 0x000000, roughness: 0.2, metalness: 0, emissive: 0xffffff, emissiveMap: scrTex, emissiveIntensity: 1,
  });
  screenMat.toneMapped = false;
  screenMat.polygonOffset = true;
  screenMat.polygonOffsetFactor = -2;
  screenMat.polygonOffsetUnits = -8;

  // матовое стекло спинки и анодированный алюминий рамки, кнопок и модуля
  const bodyMat = new THREE.MeshPhysicalMaterial({ name: 'Body', color: Q4_COLORS.tuile.body, metalness: 0, roughness: 0.5, clearcoat: 0.08, clearcoatRoughness: 0.32, envMapIntensity: 0.6 });
  const frameMat = new THREE.MeshStandardMaterial({ name: 'Frame', color: Q4_COLORS.tuile.frame, metalness: 0.95, roughness: 0.36, envMapIntensity: 1.1 });
  const plankaMat = new THREE.MeshStandardMaterial({ name: 'Planka', color: Q4_COLORS.tuile.frame, metalness: 0.9, roughness: 0.44, envMapIntensity: 1 });
  const polishMat = new THREE.MeshStandardMaterial({ name: 'PlankaPolish', color: Q4_COLORS.tuile.frame, metalness: 1, roughness: 0.22, envMapIntensity: 1.3 });
  const logoMat = new THREE.MeshStandardMaterial({ name: 'Logo', color: Q4_COLORS.tuile.frame, metalness: 1, roughness: 0.16, envMapIntensity: 1.4 });

  let color = 'tuile';
  const tgt = { body: new THREE.Color(), frame: new THREE.Color() };
  const cur = { body: new THREE.Color(), frame: new THREE.Color() };
  function setTargets(name) {
    tgt.body.setHex(Q4_COLORS[name].body);
    tgt.frame.setHex(Q4_COLORS[name].frame);
  }
  setTargets(color);
  for (const k in cur) cur[k].copy(tgt[k]);

  const screen = { mode: 'lock', module: 'classic', region: 'eu' };
  let lastDraw = 0;
  function redraw(now = performance.now()) {
    drawScreen(scrCanvas, screen.mode, { ...screen, now, ui: Q4_COLORS[color].ui });
    scrTex.needsUpdate = true;
    lastDraw = now;
  }
  redraw();

  const parts = { mods: {}, modBase: {}, shutter: null, key0: null, key1: null, keyBase: [0, 0], torchMat: null };
  const torchTarget = new THREE.Color(0xffffff);
  const torchCur = new THREE.Color(0xffffff);
  // смена модуля: старый отходит от спинки, новый встаёт на место
  const swap = { from: 'classic', to: 'classic', t: 1 };

  function setup(root) {
    const byName = {};
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (m?.name && !byName[m.name]) byName[m.name] = m;
      const pick = (m) => {
        switch (m?.name) {
          case 'Body': return bodyMat;
          case 'Frame': case 'PowerKey': return frameMat;
          case 'Planka': return plankaMat;
          case 'PlankaPolish': case 'Shutter': return polishMat;
          case 'Logo': return logoMat;
          case 'Screen': return screenMat;
          default: return m;
        }
      };
      o.material = Array.isArray(o.material) ? o.material.map(pick) : pick(o.material);
    });
    if (byName.Lens) { const m = byName.Lens; m.envMapIntensity = 0.5; m.roughness = 0.04; if ('clearcoat' in m) m.clearcoat = 1; }
    if (byName.LensCoat) { const m = byName.LensCoat; m.color.set(0x140F33); m.metalness = 0.5; m.roughness = 0.06; m.envMapIntensity = 0.9; }
    if (byName.LensInner) { const m = byName.LensInner; m.color.set(0x05070C); m.metalness = 0.6; m.roughness = 0.1; }
    if (byName.LensChrome) { const m = byName.LensChrome; m.metalness = 1; m.roughness = 0.12; m.envMapIntensity = 1.6; }
    if (byName.Germanium) { const m = byName.Germanium; m.metalness = 1; m.roughness = 0.08; m.envMapIntensity = 1.5; }
    if (byName.BeamGlass) { const m = byName.BeamGlass; m.transparent = true; m.opacity = 0.35; m.depthWrite = false; }
    for (const n of ['IRLed', 'Laser', 'BeamLED']) if (byName[n]) byName[n].toneMapped = false;
    parts.torchMat = byName.TorchGlow || null;
    if (parts.torchMat) { parts.torchMat.emissive = new THREE.Color(0xffffff); parts.torchMat.emissiveIntensity = 0.3; parts.torchMat.toneMapped = false; }
    for (const [id, n] of Object.entries(NODE)) {
      const o = root.getObjectByName(n);
      if (!o) continue;
      parts.mods[id] = o;
      parts.modBase[id] = o.position.z;
    }
    parts.shutter = root.getObjectByName('Shutter');
    parts.key0 = root.getObjectByName('Key0');
    parts.key1 = root.getObjectByName('Key1');
    parts.keyBase = [parts.key0?.position.x ?? 0, parts.key1?.position.x ?? 0];
    showModules();
    stepColors(1);
  }

  function showModules() {
    const on = swap.t < 0.5 ? swap.from : swap.to;
    for (const [id, o] of Object.entries(parts.mods)) o.visible = id === on;
  }

  function stepColors(k) {
    for (const key in cur) cur[key].lerp(tgt[key], k);
    torchCur.lerp(torchTarget, k);
    bodyMat.color.copy(cur.body);
    frameMat.color.copy(cur.frame);
    plankaMat.color.copy(cur.frame);
    polishMat.color.copy(cur.frame);
    logoMat.color.copy(cur.frame).lerp(new THREE.Color(0xffffff), 0.1);
  }

  function update(st, dt, { reduced }) {
    const now = performance.now();
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));

    // смена модуля: отход и возврат за 0,7 с
    if (swap.t < 1) swap.t = reduced ? 1 : Math.min(1, swap.t + dt / 0.7);
    showModules();
    const swapLift = swap.t < 1 ? Math.sin(swap.t * Math.PI) : 0;
    const pull = Math.max(clamp01(st.pull), swapLift);
    const e = pull * pull * (3 - 2 * pull);
    for (const [id, o] of Object.entries(parts.mods)) o.position.z = parts.modBase[id] - PULL * e;

    if (parts.shutter) {
      const s = clamp01(st.shutter);
      parts.shutter.scale.x = Math.max(0.001, s);
      parts.shutter.visible = s > 0.01;
    }
    if (parts.key0) parts.key0.position.x = parts.keyBase[0] + KEY_TRAVEL * clamp01(st.key0);
    if (parts.key1) parts.key1.position.x = parts.keyBase[1] + KEY_TRAVEL * clamp01(st.key1);

    const torch = clamp01(st.torch);
    if (parts.torchMat) {
      parts.torchMat.color.copy(torchCur).multiplyScalar(0.93);
      parts.torchMat.emissive.copy(torchCur);
      parts.torchMat.emissiveIntensity = 0.25 + torch * (1.2 + 7.8 * torchCur.g * torchCur.g);
    }
    beamMat.uniforms.uIntensity.value = torch;
    beamMat.uniforms.uColor.value.copy(torchCur);
    beam.visible = torch > 0.002;
    glow.material.opacity = torch;
    glow.material.color.copy(torchCur);
    glow.visible = torch > 0.002;

    screenMat.emissiveIntensity = clamp01(st.screen) * 1.02;
    screen.shutter = clamp01(st.shutter);
    const live = screen.mode === 'camera' || screen.mode === 'lock' || screen.mode === 'boot';
    if (st.screen > 0.02 && now - lastDraw > (screen.mode === 'camera' ? 66 : live ? 1000 : 250)) redraw(now);
  }

  return {
    url: '/models/oy0x4q.glb?v=7a322835ac',
    state: { pull: 0, shutter: 0, key0: 0, key1: 0, torch: 0, screen: 1 },
    parts,
    setup,
    buildFallback,
    update,
    snap() { stepColors(1); },
    api: {
      setBodyColor(name, instant = false) {
        if (!Q4_COLORS[name] || name === color) return;
        color = name;
        setTargets(name);
        redraw();
        if (instant || !isRunning()) stepColors(1);
      },
      setModule(id, instant = false) {
        if (!NODE[id]) return;
        const shown = swap.t < 0.5 ? swap.from : swap.to;
        if (id === shown && swap.t >= 1) return;
        swap.from = shown;
        swap.to = id;
        swap.t = instant || !isRunning() ? 1 : 0;
        screen.module = id;
        showModules();
        redraw();
      },
      setTorchColor(name, instant = false) {
        torchTarget.setHex(TORCH_COLORS[name] || TORCH_COLORS.white);
        if (instant || !isRunning()) torchCur.copy(torchTarget);
      },
      setScreen(mode, extra = {}) {
        screen.mode = SCREEN_MODES.includes(mode) ? mode : 'lock';
        Object.assign(screen, extra);
        redraw();
      },
      redrawScreen() { redraw(); },
    },
  };
}
