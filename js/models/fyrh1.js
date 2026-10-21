/* =========================================================================
   Fyr H1 — описание 3D-модели: первый телефон Fyr, 162,8 × 74 × 8,2 мм.
   Спинка из замороженного стекла, плоская алюминиевая рамка, остров камер
   слева сверху (три объектива и вспышка в кольце), знак fyr тон в тон,
   фонарь на верхней грани, «Рубильник» на три положения на левой.
   Пять цветов: у «Предзакатного» спинка переливается (градиент + iridescence).
   Экран CamelOS 2 рисуется на canvas. Разлёт по слоям: стекло, экран,
   двухслойная испарительная камера, плата со Snapdragon и Citadel Extreme,
   аккумулятор, спинка. Процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, roundRect, slab, boxG, cylZ, labelTexture, drawChip, makeBeam } from './oy0x0.js';
import { drawDesk } from './fyrkbook.js';

// body — спинка и остров, frame — рамка и кнопки, logo — знак (null: тон в тон, светлее спинки)
// grad — градиент «Предзакатного» снизу вверх, ui — акцент интерфейса CamelOS на экране
export const H1_COLORS = {
  sea: { body: 0x1F3F4B, frame: 0x24434E, island: 0x1F3F4B, logo: null, ui: '#4FB3C8' },
  mars: { body: 0x8E4329, frame: 0x93492F, island: 0x8E4329, logo: null, ui: '#FF8A5C' },
  sunset: { body: 0xD99BA8, frame: 0xD8A88F, island: 0xE7AE9E, logo: null, ui: '#FFB38A', grad: ['#A497C9', '#D99BA8', '#F0C3A4'], film: true },
  mountain: { body: 0x565C62, frame: 0xDADDE0, island: 0xE4E6E8, logo: 0xDADDE0, ui: '#DCE6F0' },
  kodak: { body: 0xE3A21A, frame: 0xB8141F, island: 0xB8141F, logo: 0x121212, ui: '#FFC93C' },
};
export const SCREEN_MODES = ['off', 'lock', 'hz', 'camera', 'kill', 'torch', 'desk'];
export const TORCH_COLORS = { white: 0xFFFFFF, red: 0xFF2A2A };

const RUB_STEP = 0.0035;           // м, шаг «Рубильника» между положениями
const TOP_Y = 0.0814;              // м, верхняя грань
// разлёт: смещение по Z (м) — экран смотрит в +Z, спинка в −Z
const LAYER_OFFSET = { glass: 0.084, screen: 0.05, frame: 0, vc: -0.024, board: -0.046, battery: -0.068, back: -0.1 };
const LAYER_BY_NAME = {
  Glass: 'glass', FrontCamera: 'glass', Screen: 'screen',
  Body: 'back', CameraIsland: 'back', CameraModules: 'back', Flash: 'back', Logo: 'back',
  VaporChamber: 'vc', Board: 'board', Battery: 'battery',
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---------- Картинка для камеры: маяк на закате ---------- */

// Одна сцена и для экрана телефона, и для демо плёнок на странице
export function drawLighthouse(g, w, h, { t = 0, beam = true } = {}) {
  const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#1B2456');
  sky.addColorStop(0.45, '#7A4A86');
  sky.addColorStop(0.78, '#F08A5D');
  sky.addColorStop(1, '#FFD39A');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h * 0.62);
  // солнце у горизонта
  const sx = w * 0.32, sy = h * 0.6;
  const sun = g.createRadialGradient(sx, sy, 0, sx, sy, w * 0.5);
  sun.addColorStop(0, 'rgba(255,244,214,1)');
  sun.addColorStop(0.08, 'rgba(255,214,150,.95)');
  sun.addColorStop(0.3, 'rgba(255,150,90,.35)');
  sun.addColorStop(1, 'rgba(255,120,80,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, w, h * 0.62);
  // море
  const sea = g.createLinearGradient(0, h * 0.62, 0, h);
  sea.addColorStop(0, '#E7906A');
  sea.addColorStop(0.12, '#6B4C7C');
  sea.addColorStop(1, '#141A3A');
  g.fillStyle = sea;
  g.fillRect(0, h * 0.62, w, h * 0.38);
  // дорожка солнца по воде
  for (let i = 0; i < 36; i++) {
    const y = h * (0.625 + i * 0.0105);
    const ww = w * (0.03 + i * 0.006) * (0.7 + 0.3 * Math.sin(t * 2 + i * 1.7));
    g.fillStyle = `rgba(255,214,160,${0.55 - i * 0.014})`;
    g.fillRect(sx - ww / 2 + Math.sin(i * 2.3 + t) * w * 0.01, y, ww, h * 0.004);
  }
  // скала и маяк справа
  g.fillStyle = '#120E1E';
  g.beginPath();
  g.moveTo(w * 0.55, h);
  g.lineTo(w * 0.62, h * 0.66);
  g.lineTo(w * 0.72, h * 0.6);
  g.lineTo(w * 0.86, h * 0.63);
  g.lineTo(w, h * 0.58);
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  const lx = w * 0.78, base = h * 0.61, top = h * 0.36, bw = w * 0.05, tw = w * 0.032;
  g.fillStyle = '#E9E2DA';
  g.beginPath();
  g.moveTo(lx - bw / 2, base); g.lineTo(lx - tw / 2, top); g.lineTo(lx + tw / 2, top); g.lineTo(lx + bw / 2, base);
  g.closePath();
  g.fill();
  g.fillStyle = '#B8141F';
  for (const k of [0.25, 0.6]) {
    const y0 = top + (base - top) * k, y1 = y0 + (base - top) * 0.14;
    const w0 = tw + (bw - tw) * k, w1 = tw + (bw - tw) * (k + 0.14);
    g.beginPath();
    g.moveTo(lx - w0 / 2, y0); g.lineTo(lx + w0 / 2, y0); g.lineTo(lx + w1 / 2, y1); g.lineTo(lx - w1 / 2, y1);
    g.closePath();
    g.fill();
  }
  g.fillStyle = '#1A1420';
  g.fillRect(lx - tw * 0.75, top - h * 0.045, tw * 1.5, h * 0.045);
  g.fillStyle = '#FFF2C8';
  g.fillRect(lx - tw * 0.45, top - h * 0.038, tw * 0.9, h * 0.03);
  if (beam) {
    const a = Math.sin(t * 0.7) * 0.5 + Math.PI;
    const r = w * 1.2;
    const grad = g.createRadialGradient(lx, top - h * 0.022, 0, lx, top - h * 0.022, r);
    grad.addColorStop(0, 'rgba(255,240,200,.55)');
    grad.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(lx, top - h * 0.022);
    g.arc(lx, top - h * 0.022, r, a - 0.08, a + 0.08);
    g.closePath();
    g.fill();
  }
}

/* ---------- Экран телефона ---------- */

const pad2 = (n) => String(n).padStart(2, '0');

export function drawScreen(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const now = st.now ?? performance.now();
  const ui = st.ui || '#4FB3C8';
  const sans = (px, wt = 700) => `${wt} ${px}px "Onest", system-ui, sans-serif`;
  const mono = (px, wt = 600) => `${wt} ${px}px "JetBrains Mono", ui-monospace, monospace`;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  if (mode === 'off') return;
  g.textBaseline = 'middle';
  g.textAlign = 'center';

  const statusBar = (ink = 'rgba(255,255,255,.85)') => {
    g.font = mono(22, 600);
    g.fillStyle = ink;
    g.textAlign = 'left';
    g.fillText('CamelOS 2', 44, 54);
    g.textAlign = 'right';
    g.fillText(st.rub === 2 ? 'эфир выкл' : st.rub === 1 ? 'без камер' : '5G · 100 %', w - 44, 54);
    g.textAlign = 'center';
  };

  if (mode === 'lock' || mode === 'desk') {
    drawDesk(canvas, { now, accent: ui });
    const d = new Date();
    statusBar();
    g.fillStyle = '#F4F7FF';
    g.font = sans(190, 700);
    g.fillText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, w / 2, h * 0.2);
    g.font = sans(30, 500);
    g.fillStyle = 'rgba(244,247,255,.7)';
    g.fillText('Караван: часы и KBook рядом', w / 2, h * 0.28);
    if (mode === 'desk') {
      const apps = ['Погонщик', 'Маяк', 'Колодец', 'Привал', 'Сторож', 'Камера', 'Фонарь', 'Плёнка'];
      apps.forEach((name, i) => {
        const cx = w * (0.2 + (i % 4) * 0.2), cy = h * (0.46 + Math.floor(i / 4) * 0.14);
        roundRect(g, cx - 52, cy - 52, 104, 104, 30);
        g.fillStyle = i === 7 ? '#E3A21A' : 'rgba(255,255,255,.12)';
        g.fill();
        g.fillStyle = i === 7 ? '#141414' : ui;
        g.font = sans(44, 700);
        g.fillText(name[0], cx, cy + 2);
        g.font = sans(20, 500);
        g.fillStyle = 'rgba(244,247,255,.8)';
        g.fillText(name, cx, cy + 82);
      });
    }
    // тритиевая точка-маяк внизу
    g.fillStyle = ui;
    g.beginPath();
    g.arc(w / 2, h * 0.93, 7, 0, Math.PI * 2);
    g.fill();
    return;
  }

  if (mode === 'hz') {
    const hz = Math.round(st.hz ?? 165);
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#04060C');
    bg.addColorStop(1, '#0B1630');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    statusBar();
    g.font = sans(260, 760);
    g.fillStyle = '#F4F7FF';
    g.fillText(String(hz), w / 2, h * 0.36);
    g.font = mono(40, 600);
    g.fillStyle = ui;
    g.fillText('Гц · LTPO', w / 2, h * 0.47);
    // полоски кадров: чем выше частота, тем гуще
    const n = Math.max(1, Math.round(hz / 6));
    for (let i = 0; i < n; i++) {
      const x = 60 + (i / n) * (w - 120);
      g.fillStyle = `rgba(127,180,255,${0.25 + 0.6 * (i / n)})`;
      g.fillRect(x, h * 0.62, Math.max(2, (w - 120) / n - 3), h * 0.12);
    }
    g.font = sans(28, 500);
    g.fillStyle = 'rgba(244,247,255,.6)';
    g.fillText(hz <= 1 ? 'Статичная картинка — 1 кадр в секунду' : hz >= 165 ? 'Игры и прокрутка — 165 кадров' : 'Частота подстраивается под картинку', w / 2, h * 0.82);
    return;
  }

  if (mode === 'camera') {
    drawLighthouse(g, w, h, { t: now / 1000 });
    g.strokeStyle = 'rgba(255,255,255,.28)';
    g.lineWidth = 2;
    for (const k of [1 / 3, 2 / 3]) {
      g.beginPath(); g.moveTo(w * k, 0); g.lineTo(w * k, h); g.stroke();
      g.beginPath(); g.moveTo(0, h * k); g.lineTo(w, h * k); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(0, h * 0.84, w, h * 0.16);
    g.font = mono(26, 700);
    g.fillStyle = '#FFC93C';
    g.fillText(`KODAK · ${st.film || 'ТЁПЛАЯ 200'}`, w / 2, h * 0.865);
    g.beginPath();
    g.arc(w / 2, h * 0.93, 46, 0, Math.PI * 2);
    g.fillStyle = '#F4F7FF';
    g.fill();
    g.beginPath();
    g.arc(w / 2, h * 0.93, 54, 0, Math.PI * 2);
    g.strokeStyle = '#F4F7FF';
    g.lineWidth = 4;
    g.stroke();
    g.font = mono(24, 600);
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.textAlign = 'left';
    g.fillText(st.lens || '1× · 24 мм', 40, h * 0.93);
    g.textAlign = 'right';
    g.fillText('f/1.8', w - 40, h * 0.93);
    return;
  }

  if (mode === 'kill') {
    const rub = st.rub ?? 0;
    g.fillStyle = '#05070A';
    g.fillRect(0, 0, w, h);
    statusBar();
    g.font = sans(54, 760);
    g.fillStyle = '#F4F7FF';
    g.fillText('Рубильник', w / 2, h * 0.16);
    g.font = mono(30, 600);
    g.fillStyle = ui;
    g.fillText(['положение 1 · всё работает', 'положение 2 · без камер', 'положение 3 · эфир выключен'][rub], w / 2, h * 0.22);
    const rows = [['Камеры', 1], ['Микрофоны', 1], ['Сотовая связь', 2], ['Wi-Fi и Bluetooth', 2], ['GNSS', 2], ['UWB и NFC', 2]];
    rows.forEach(([name, at], i) => {
      const y = h * (0.34 + i * 0.09);
      const off = rub >= at;
      roundRect(g, 50, y - 44, w - 100, 88, 24);
      g.fillStyle = off ? 'rgba(255,255,255,.04)' : 'rgba(79,179,200,.12)';
      g.fill();
      g.textAlign = 'left';
      g.font = sans(32, 600);
      g.fillStyle = off ? 'rgba(244,247,255,.35)' : '#F4F7FF';
      g.fillText(name, 84, y);
      g.textAlign = 'right';
      g.font = mono(26, 700);
      g.fillStyle = off ? '#FF5A5A' : ui;
      g.fillText(off ? 'обесточено' : 'вкл', w - 84, y);
    });
    g.textAlign = 'center';
    return;
  }

  if (mode === 'torch') {
    const on = st.torch ?? 0;
    g.fillStyle = '#05070A';
    g.fillRect(0, 0, w, h);
    statusBar();
    const c = st.torchColor === 'red' ? '255,60,60' : '255,248,230';
    const grd = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.7);
    grd.addColorStop(0, `rgba(${c},${0.55 * on})`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.font = sans(54, 760);
    g.fillStyle = '#F4F7FF';
    g.fillText('Фонарь', w / 2, h * 0.42);
    g.font = mono(30, 600);
    g.fillStyle = ui;
    g.fillText(st.torchMode || 'свет · 1200 лм', w / 2, h * 0.49);
    g.beginPath();
    g.arc(w / 2, h * 0.68, 120, 0, Math.PI * 2);
    g.fillStyle = on > 0.5 ? `rgb(${c})` : 'rgba(255,255,255,.08)';
    g.fill();
    g.font = sans(40, 700);
    g.fillStyle = on > 0.5 ? '#141414' : '#F4F7FF';
    g.fillText(on > 0.5 ? 'вкл' : 'выкл', w / 2, h * 0.68);
  }
}

/* ---------- Внутренности: испарительная камера, плата, аккумулятор ---------- */

function buildInternals(glowMat) {
  const vcTex = labelTexture(640, 1160, (g, w, h) => {
    const cu = g.createLinearGradient(0, 0, w, h);
    cu.addColorStop(0, '#B8734A');
    cu.addColorStop(0.5, '#E3A57A');
    cu.addColorStop(1, '#9C5A36');
    g.fillStyle = cu;
    g.fillRect(0, 0, w, h);
    // каналы пара: два слоя — синий нижний, тёплый верхний
    g.lineWidth = 6;
    for (let i = 0; i < 16; i++) {
      g.strokeStyle = i % 2 ? 'rgba(60,120,255,.35)' : 'rgba(255,240,220,.35)';
      g.beginPath();
      const x = 40 + i * 36;
      g.moveTo(x, 60);
      for (let y = 60; y < h - 60; y += 40) g.lineTo(x + Math.sin(y / 60 + i) * 10, y);
      g.stroke();
    }
    roundRect(g, 120, h / 2 - 90, w - 240, 180, 24);
    g.fillStyle = 'rgba(10,12,18,.72)';
    g.fill();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#F4F7FF';
    g.font = '800 54px "Onest", system-ui, sans-serif';
    g.fillText('2 слоя', w / 2, h / 2 - 26);
    g.font = '500 28px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(244,247,255,.7)';
    g.fillText('испарительная камера', w / 2, h / 2 + 36);
  });
  const boardTex = labelTexture(660, 560, (g, w, h) => {
    g.fillStyle = '#0D1016'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(127,164,255,.16)'; g.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const y = 18 + i * 22;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w * (0.18 + (i % 5) * 0.13), y); g.lineTo(w * (0.24 + (i % 5) * 0.13), y + 16); g.lineTo(w, y + 16); g.stroke();
    }
    drawChip(g, 150, 70, 300, 230, 'SNAPDRAGON', '8 Elite Extreme Gen 6');
    drawChip(g, 480, 90, 150, 150, 'CITADEL', 'Extreme');
    drawChip(g, 40, 380, 260, 140, 'LPDDR5X');
    drawChip(g, 360, 380, 260, 140, 'UFS 4.1');
  });
  const battTex = labelTexture(640, 820, (g, w, h) => {
    g.fillStyle = '#14161A'; g.fillRect(0, 0, w, h);
    roundRect(g, 24, 24, w - 48, h - 48, 22);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F4F7FF';
    g.font = '800 136px "Onest", system-ui, sans-serif';
    g.fillText('6100', w / 2, h / 2 - 70);
    g.font = '600 58px "Onest", system-ui, sans-serif';
    g.fillText('мАч · Si-C', w / 2, h / 2 + 34);
    g.font = '500 32px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(244,247,255,.55)';
    g.fillText('100 Вт · 0x64', w / 2, h / 2 + 118);
  });

  const side = new THREE.MeshStandardMaterial({ color: 0x1A1B1E, metalness: 0.5, roughness: 0.5 });
  const make = (name, w, h, d, y, tex, metal = 0.2) => {
    const grp = new THREE.Group();
    grp.name = name;
    grp.add(new THREE.Mesh(boxG(w, h, d), side));
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: metal });
    for (const sz of [1, -1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w * MM, h * MM), face);
      pl.position.z = sz * (d / 2 + 0.02) * MM;
      if (sz < 0) pl.rotation.y = Math.PI;
      grp.add(pl);
    }
    grp.position.y = y * MM;
    grp.visible = false;
    return grp;
  };
  const board = make('Board', 66, 56, 1.0, 50, boardTex);
  // светящийся контур вокруг Citadel Extreme — правый верхний чип на плате
  for (const [w, h, x, y] of [[23.6, 0.6, 15.7, 12.8], [23.6, 0.6, 15.7, -1.2], [0.6, 14.6, 27.2, 5.8], [0.6, 14.6, 4.2, 5.8]]) {
    const m = new THREE.Mesh(boxG(w, h, 1.6), glowMat);
    m.position.set(x * MM, y * MM, 0);
    board.add(m);
  }
  return [make('VaporChamber', 66, 120, 0.8, 8, vcTex, 0.6), board, make('Battery', 66, 86, 4.2, -30, battTex)];
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const std = (name, color, o = {}) => new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.4, ...o });
  const mats = {
    Body: std('Body', H1_COLORS.sea.body, { roughness: 0.5 }),
    Island: std('Island', H1_COLORS.sea.island, { roughness: 0.5 }),
    Frame: std('Frame', H1_COLORS.sea.frame, { metalness: 0.9, roughness: 0.35 }),
    LensBezel: std('LensBezel', 0x060607, { roughness: 0.3 }),
    Lens: std('Lens', 0x020306, { roughness: 0.05, clearcoat: 1 }),
    KodakRing: std('KodakRing', 0xF5B70F, { metalness: 0.6, roughness: 0.3 }),
    Flash: std('Flash', 0xF3EAD6, { emissive: 0xFFF4DD, emissiveIntensity: 0.15 }),
    Screen: std('Screen', 0x020203),
    Glass: std('Glass', 0x030304, { roughness: 0.05, clearcoat: 1 }),
    Rubilnik: std('Rubilnik', 0x2F6BFF, { metalness: 0.5, roughness: 0.3 }),
    TorchGlow: std('TorchGlow', 0xEDEDED, { emissive: 0xFFFFFF, emissiveIntensity: 0.4 }),
  };
  const root = new THREE.Group();
  root.name = 'FyrH1';
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };
  // +Z — экран, −Z — спинка
  add(slab(74, 162.8, 10.5, 8.2, 0.55, 10), 'Frame', 0, 0, 0, 'Frame');
  add(slab(73, 161.8, 10, 0.5, 0.2, 10), 'Body', 0, 0, -4.05, 'Body');
  add(slab(73.2, 162, 10.1, 0.4, 0.15, 10), 'Glass', 0, 0, 4.05, 'Glass');
  const scr = new THREE.ShapeGeometry(new THREE.Shape([
    new THREE.Vector2(-36, -80.4), new THREE.Vector2(36, -80.4), new THREE.Vector2(36, 80.4), new THREE.Vector2(-36, 80.4),
  ]));
  scr.scale(MM, MM, MM);
  const uv = scr.attributes.uv, pos = scr.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (72 * MM) + 0.5, 0.5 - pos.getY(i) / (160.8 * MM));
  add(scr, 'Screen', 0, 0, 4.3, 'Screen');
  // остров и объективы: со спины +X смотрит влево
  const isl = add(slab(40, 42, 13, 2.2, 0.9, 12), 'Island', 10.6, 54, -5.2, 'CameraIsland');
  isl.rotation.y = Math.PI;
  const lensGrp = new THREE.Group();
  lensGrp.name = 'CameraModules';
  root.add(lensGrp);
  for (const [x, y, r] of [[19.6, 64, 8.6], [1.6, 64, 8.6], [19.6, 44, 8.6]]) {
    add(cylZ(r, 1.0), 'LensBezel', x, y, -6.6, null, lensGrp);
    add(cylZ(r - 2.6, 1.1), 'Lens', x, y, -6.7, null, lensGrp);
  }
  add(cylZ(6.2, 0.6), 'KodakRing', 19.6, 64, -6.55, null, lensGrp);
  add(cylZ(6.8, 0.9), 'LensBezel', 1.6, 44, -6.5, null, lensGrp);
  add(cylZ(2.1, 1.0), 'Flash', 1.6, 44, -6.6, 'Flash');
  add(boxG(11, 0.4, 2.6), 'TorchGlow', 0, 81.5, 0, 'Torch');
  const rub = new THREE.Group();
  rub.name = 'Rubilnik';
  rub.position.set(-37 * MM, 46 * MM, 0);
  root.add(rub);
  add(boxG(1.2, 5.4, 2.6), 'Rubilnik', -0.5, 0, 0, null, rub);
  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createFyrH1({ phone, scale, isRunning }) {
  // фонарь на верхней грани светит вверх, как у OY
  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, TOP_Y * scale + 0.004, 0);
  glow.position.set(0, TOP_Y * scale + 0.01, 0);
  phone.add(beam, glow);

  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = 600;
  scrCanvas.height = 1340;
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

  // замороженное стекло: матовое, тонкий лак; у «Предзакатного» — градиент и перелив
  const gradCanvas = document.createElement('canvas');
  gradCanvas.width = 8;
  gradCanvas.height = 256;
  const gradTex = new THREE.CanvasTexture(gradCanvas);
  gradTex.colorSpace = THREE.SRGBColorSpace;
  gradTex.flipY = false;
  const bodyMat = new THREE.MeshPhysicalMaterial({
    name: 'Body', color: H1_COLORS.sea.body, metalness: 0, roughness: 0.52,
    clearcoat: 0.1, clearcoatRoughness: 0.36, envMapIntensity: 0.55,
    iridescence: 0, iridescenceIOR: 1.5, iridescenceThicknessRange: [260, 620],
  });
  const islandMat = bodyMat.clone();
  islandMat.name = 'Island';
  const frameMat = new THREE.MeshStandardMaterial({ name: 'Frame', color: H1_COLORS.sea.frame, metalness: 1, roughness: 0.34, envMapIntensity: 1.1 });
  const keyMat = new THREE.MeshStandardMaterial({ name: 'PowerKey', color: H1_COLORS.sea.frame, metalness: 1, roughness: 0.22, envMapIntensity: 1.2 });
  const logoMat = new THREE.MeshStandardMaterial({ name: 'Logo', color: 0x9BB0B8, metalness: 1, roughness: 0.14, envMapIntensity: 1.4 });
  const tritMat = new THREE.MeshStandardMaterial({ name: 'Tritium', color: 0x9FB8FF, emissive: 0x3D7BFF, emissiveIntensity: 1.4, roughness: 0.3 });
  tritMat.toneMapped = false;
  const chipGlow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color('#2F6BFF'), emissiveIntensity: 0.3 });

  let color = 'sea';
  const tgt = { body: new THREE.Color(), frame: new THREE.Color(), island: new THREE.Color(), logo: new THREE.Color() };
  const cur = { body: new THREE.Color(), frame: new THREE.Color(), island: new THREE.Color(), logo: new THREE.Color() };
  let irid = 0, iridTgt = 0;
  function setTargets(name) {
    const c = H1_COLORS[name];
    tgt.body.setHex(c.body);
    tgt.frame.setHex(c.frame);
    tgt.island.setHex(c.island);
    // тон в тон: полированный металл чуть светлее спинки
    if (c.logo == null) tgt.logo.setHex(c.body).lerp(new THREE.Color(0xffffff), 0.28);
    else tgt.logo.setHex(c.logo);
    iridTgt = c.film ? 1 : 0;
    if (c.grad) {
      const g = gradCanvas.getContext('2d');
      const lg = g.createLinearGradient(0, 0, 0, gradCanvas.height);
      // экспорт glTF переворачивает v, а текстура без flipY: верх canvas — верх спинки
      lg.addColorStop(0, c.grad[2]);
      lg.addColorStop(0.45, c.grad[1]);
      lg.addColorStop(1, c.grad[0]);
      g.fillStyle = lg;
      g.fillRect(0, 0, gradCanvas.width, gradCanvas.height);
      gradTex.needsUpdate = true;
      bodyMat.map = gradTex;
      tgt.body.setHex(0xffffff);
    } else {
      bodyMat.map = null;
    }
    bodyMat.needsUpdate = true;
  }
  setTargets(color);
  for (const k in cur) cur[k].copy(tgt[k]);

  const screen = { mode: 'lock', ui: H1_COLORS.sea.ui };
  let lastDraw = 0;
  function redrawScreen(now = performance.now()) {
    drawScreen(scrCanvas, screen.mode, { ...screen, now, ui: H1_COLORS[color].ui });
    scrTex.needsUpdate = true;
    lastDraw = now;
  }
  redrawScreen();

  const parts = { rub: null, rubBase: 0, torchMat: null, layers: [], internals: [] };
  const torchTarget = new THREE.Color(0xffffff);
  const torchCur = new THREE.Color(0xffffff);

  function setupLayers(root) {
    const anchor = root.getObjectByName('Frame');
    const holder = anchor?.parent || root;
    const internals = buildInternals(chipGlow);
    holder.add(...internals);
    parts.internals = internals;
    for (const o of holder.children) {
      const off = LAYER_OFFSET[LAYER_BY_NAME[o.name] || 'frame'];
      if (off) parts.layers.push({ o, base: o.position.z, off });
    }
  }

  function setup(root) {
    setupLayers(root);
    const byName = {};
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (m?.name && !byName[m.name]) byName[m.name] = m;
      const swap = (m) => {
        switch (m?.name) {
          case 'Body': return bodyMat;
          case 'Island': case 'IslandEdge': return islandMat;
          case 'Frame': return frameMat;
          case 'PowerKey': return keyMat;
          case 'Logo': return logoMat;
          case 'Tritium': return tritMat;
          case 'Screen': return screenMat;
          default: return m;
        }
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
    // объективы: тёмное стекло с узким бликом, обод почти чёрный, просветление с отливом
    if (byName.Lens) { const m = byName.Lens; m.envMapIntensity = 0.5; m.roughness = 0.04; if ('clearcoat' in m) m.clearcoat = 1; }
    if (byName.LensCoat) { const m = byName.LensCoat; m.color.set(0x140F33); m.metalness = 0.5; m.roughness = 0.06; m.envMapIntensity = 0.9; }
    if (byName.LensInner) { const m = byName.LensInner; m.color.set(0x05070C); m.metalness = 0.6; m.roughness = 0.1; }
    if (byName.LensBezel) { const m = byName.LensBezel; m.roughness = 0.32; m.envMapIntensity = 0.7; }
    if (byName.LensChrome) { const m = byName.LensChrome; m.metalness = 1; m.roughness = 0.12; m.envMapIntensity = 1.6; }
    parts.torchMat = byName.TorchGlow || null;
    if (parts.torchMat) { parts.torchMat.emissive = new THREE.Color(0xffffff); parts.torchMat.emissiveIntensity = 0.3; parts.torchMat.toneMapped = false; }
    parts.rub = root.getObjectByName('Rubilnik');
    parts.rubBase = parts.rub ? parts.rub.position.y : 0;
    stepColors(1);
  }

  function stepColors(k) {
    for (const key in cur) cur[key].lerp(tgt[key], k);
    torchCur.lerp(torchTarget, k);
    irid += (iridTgt - irid) * k;
    bodyMat.color.copy(cur.body);
    islandMat.color.copy(cur.island);
    frameMat.color.copy(cur.frame);
    keyMat.color.copy(cur.frame);
    logoMat.color.copy(cur.logo);
    bodyMat.iridescence = irid;
    islandMat.iridescence = irid * 0.7;
  }

  function update(st, dt, { reduced }) {
    const now = performance.now();
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));

    const ex = clamp01(st.explode);
    const e = ex * ex * (3 - 2 * ex);
    for (const l of parts.layers) l.o.position.z = l.base + l.off * e;
    for (const m of parts.internals) m.visible = e > 0.01;
    chipGlow.emissiveIntensity = 0.3 + clamp01(st.citadel) * 6;

    // «Рубильник»: 0 — вверху, 1 — середина, 2 — внизу
    if (parts.rub) parts.rub.position.y = parts.rubBase - Math.max(0, Math.min(2, st.rub)) * RUB_STEP;

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

    const breath = reduced ? 1 : 0.85 + 0.15 * Math.sin(now / 1100);
    tritMat.emissiveIntensity = (0.9 + clamp01(st.dark) * 3) * breath;
    screenMat.emissiveIntensity = clamp01(st.screen) * 1.02;

    const live = screen.mode === 'camera' || screen.mode === 'lock' || screen.mode === 'desk';
    if (live && st.screen > 0.02 && now - lastDraw > (screen.mode === 'camera' ? 60 : 1000)) redrawScreen(now);
  }

  return {
    url: '/models/fyrh1.glb?v=d59cc45dea',
    state: { explode: 0, citadel: 0, rub: 0, torch: 0, screen: 1, dark: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap() { stepColors(1); },
    api: {
      setBodyColor(name, instant = false) {
        if (!H1_COLORS[name] || name === color) return;
        color = name;
        setTargets(name);
        redrawScreen();
        if (instant || !isRunning()) stepColors(1);
      },
      setTorchColor(name, instant = false) {
        torchTarget.setHex(TORCH_COLORS[name] || TORCH_COLORS.white);
        if (instant || !isRunning()) torchCur.copy(torchTarget);
      },
      setScreen(mode, extra = {}) {
        screen.mode = SCREEN_MODES.includes(mode) ? mode : 'lock';
        Object.assign(screen, extra);
        redrawScreen();
      },
      redrawScreen() { redrawScreen(); },
    },
  };
}
