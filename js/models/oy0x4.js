/* =========================================================================
   OY 0X4 — описание 3D-модели: самый тонкий OY, 151,2 × 71,6 × 5,75 мм.
   Титановая рамка-лента, матовое стекло сзади, островок камер «○X○» —
   глянцевое стекло на тон темнее спинки, плавно вырастает из неё.
   «Рубильник» на левой грани ходит на три положения (sw: −1, 0, 1),
   фонарь на верхней грани (torch). Экран CamelOS рисуется на canvas:
   стокгольмские шхеры, видоискатель с зумом 0,5× / 1× / 2× / 4× и макро,
   аккумулятор, «Водяной знак» Citadel 6 Slim. Процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, roundRect, slab, boxG, cylZ, makeBeam } from './oy0x0.js';

// body — спинка, frame — рамка и кнопки; островок — body на 32 % темнее; ui — акцент CamelOS на экране
export const X4_COLORS = {
  grifel: { body: 0x1F2124, frame: 0x55585D, ui: '#9DB0FF', label: 'Грифель' },
  list: { body: 0xE7E3DA, frame: 0xC9CACC, ui: '#B8C6FF', label: 'Лист' },
  folga: { body: 0xD2BC92, frame: 0xC4A872, ui: '#F2D48A', label: 'Фольга' },
  nast: { body: 0xBCCFDC, frame: 0xA6B5C1, ui: '#A8E0FF', label: 'Наст' },
};
export const SCREEN_MODES = ['off', 'lock', 'boot', 'camera', 'battery', 'citadel', 'torch', 'switch'];
export const TORCH_COLORS = { white: 0xFFFFFF, red: 0xFF2A2A };
export const ZOOMS = { '0.5': 0.5, 1: 1, 2: 2, 4: 4, macro: 0 };

// Геометрия, мм — как в blender/build_oy0x4.py
const W = 71.6, H = 151.2, D = 5.75, HH = H / 2, HD = D / 2;
const TOP_Y = HH * MM;
const SCR = { w: W - 3.2, h: H - 3.2 };
const SWITCH_STEP = 0.0032;       // м: ход «Рубильника» между положениями
const ISLAND_DARK = 0.68;         // островок = спинка × 0,68

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pad2 = (n) => String(n).padStart(2, '0');
const sans = (px, wt = 700) => `${wt} ${px}px "Onest", system-ui, sans-serif`;
const mono = (px, wt = 600) => `${wt} ${px}px "JetBrains Mono", ui-monospace, monospace`;

/* ---------- Картинка: шхеры под Стокгольмом в сумерках ---------- */

// Мир нарисован шире кадра: зум 0,5× показывает больше, 4× — маяк на шхере крупно.
// zoom: 0.5 · 1 · 2 · 4 или 0 — макро (иней на хвоинке)
export function drawHarbor(g, w, h, { t = 0, zoom = 1, accent = '#9DB0FF' } = {}) {
  if (zoom === 0) { drawMacro(g, w, h, { t }); return; }
  g.save();
  // центр зума — маяк: при 4× он занимает кадр
  const fx = w * 0.64, fy = h * 0.6;
  g.translate(fx, fy);
  g.scale(zoom, zoom);
  g.translate(-fx, -fy);
  const X0 = -w * 1.2, X1 = w * 2.2;
  const sky = g.createLinearGradient(0, -h * 0.6, 0, h * 0.62);
  sky.addColorStop(0, '#0A1030');
  sky.addColorStop(0.45, '#2B3E86');
  sky.addColorStop(0.78, '#C88AA0');
  sky.addColorStop(1, '#FFC48E');
  g.fillStyle = sky;
  g.fillRect(X0, -h, X1 - X0, h * 1.62);
  // звёзды
  g.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < 40; i++) g.fillRect(X0 + ((i * 197) % 1000) / 1000 * (X1 - X0), -h * 0.6 + ((i * 89) % 100) / 100 * h * 0.6, 2, 2);
  // солнце садится за дальние острова
  const sun = g.createRadialGradient(w * 0.3, h * 0.6, 0, w * 0.3, h * 0.6, w * 0.6);
  sun.addColorStop(0, 'rgba(255,226,180,.9)');
  sun.addColorStop(0.2, 'rgba(255,180,130,.35)');
  sun.addColorStop(1, 'rgba(255,160,120,0)');
  g.fillStyle = sun;
  g.fillRect(X0, -h, X1 - X0, h * 2);
  // вода
  const sea = g.createLinearGradient(0, h * 0.62, 0, h * 1.8);
  sea.addColorStop(0, '#5C5A86');
  sea.addColorStop(0.3, '#1C2350');
  sea.addColorStop(1, '#070A1C');
  g.fillStyle = sea;
  g.fillRect(X0, h * 0.62, X1 - X0, h * 1.4);
  // блики на воде
  g.fillStyle = 'rgba(255,214,170,.35)';
  for (let i = 0; i < 26; i++) {
    const y = h * (0.64 + i * 0.012);
    const ww = w * (0.18 - i * 0.005) * (1 + 0.2 * Math.sin(t * 1.3 + i));
    g.fillRect(w * 0.3 - ww / 2, y, ww, 1.5);
  }
  // острова: дальние (сиреневые) и ближние (тёмные, с соснами)
  const isle = (cx, cy, rw, rh, c, pines = 0) => {
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(cx, cy, rw, rh, 0, Math.PI, 0);
    g.fill();
    for (let k = 0; k < pines; k++) {
      const px = cx - rw * 0.7 + (k / Math.max(1, pines - 1)) * rw * 1.4;
      const ph = rh * (1.1 + ((k * 7) % 3) * 0.35);
      const top = cy - rh * Math.sqrt(Math.max(0, 1 - ((px - cx) / rw) ** 2));
      g.beginPath();
      g.moveTo(px - rh * 0.28, top + 2);
      g.lineTo(px, top - ph);
      g.lineTo(px + rh * 0.28, top + 2);
      g.fill();
    }
  };
  isle(-w * 0.3, h * 0.625, w * 0.5, h * 0.03, '#6C5A8A');
  isle(w * 0.55, h * 0.625, w * 0.4, h * 0.022, '#77649A');
  isle(w * 1.4, h * 0.625, w * 0.6, h * 0.035, '#6C5A8A');
  isle(-w * 0.1, h * 0.7, w * 0.42, h * 0.06, '#1A1C36', 9);
  isle(w * 1.25, h * 0.69, w * 0.35, h * 0.05, '#1A1C36', 7);
  // шхера с маяком — центр зума
  isle(fx, fy + h * 0.035, w * 0.07, h * 0.022, '#232540');
  const lw = w * 0.012, lh = h * 0.07;
  g.fillStyle = '#EDEAF2';
  g.beginPath();
  g.moveTo(fx - lw, fy + h * 0.02);
  g.lineTo(fx - lw * 0.7, fy - lh);
  g.lineTo(fx + lw * 0.7, fy - lh);
  g.lineTo(fx + lw, fy + h * 0.02);
  g.fill();
  g.fillStyle = '#C8352A';                   // красная полоса — маяк Fyr
  g.fillRect(fx - lw * 0.88, fy - lh * 0.45, lw * 1.76, lh * 0.18);
  g.fillStyle = '#2A2C40';
  g.fillRect(fx - lw * 0.9, fy - lh - h * 0.012, lw * 1.8, h * 0.012);
  // фонарь маяка мигает раз в 3 секунды, луч вращается
  const on = (t % 3) < 1.6;
  const lamp = g.createRadialGradient(fx, fy - lh - h * 0.006, 0, fx, fy - lh - h * 0.006, w * 0.05);
  lamp.addColorStop(0, on ? 'rgba(255,246,214,1)' : 'rgba(255,246,214,.25)');
  lamp.addColorStop(1, 'rgba(255,246,214,0)');
  g.fillStyle = lamp;
  g.fillRect(fx - w * 0.06, fy - lh - h * 0.06, w * 0.12, h * 0.1);
  if (on) {
    const a = Math.sin(t * 0.9) * 0.5;
    g.fillStyle = 'rgba(255,240,200,.16)';
    g.beginPath();
    g.moveTo(fx, fy - lh - h * 0.006);
    g.lineTo(fx - w * 1.2, fy - lh - h * (0.06 + a * 0.2));
    g.lineTo(fx - w * 1.2, fy - lh + h * (0.04 - a * 0.2));
    g.fill();
  }
  // на 4× видно чайку на перилах и надпись на маяке
  g.fillStyle = '#2A2C40';
  g.font = mono(Math.max(4, w * 0.006), 700);
  g.textAlign = 'center';
  g.fillText('FYR', fx, fy - lh * 0.12);
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  g.ellipse(fx + lw * 1.25, fy - lh - h * 0.004, w * 0.003, h * 0.0016, 0, 0, Math.PI * 2);
  g.fill();
  // лодка с огоньком
  const bx = w * (0.05 + ((t * 0.01) % 0.5)), by = h * 0.78;
  g.fillStyle = '#0E1028';
  g.beginPath();
  g.moveTo(bx - w * 0.04, by); g.lineTo(bx + w * 0.04, by); g.lineTo(bx + w * 0.03, by + h * 0.012); g.lineTo(bx - w * 0.03, by + h * 0.012);
  g.fill();
  g.fillRect(bx - 1, by - h * 0.05, 2, h * 0.05);
  g.fillStyle = accent;
  g.fillRect(bx - 2, by - h * 0.052, 4, 4);
  g.restore();
}

// Макро: кристалл инея на хвоинке, сзади огни гавани в боке
function drawMacro(g, w, h, { t = 0 } = {}) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0E1636');
  bg.addColorStop(1, '#1A2048');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) {
    const x = ((i * 0.37 + 0.11) % 1) * w, y = ((i * 0.53 + 0.2) % 1) * h * 0.9;
    const r = w * (0.04 + ((i * 7) % 5) * 0.015);
    const c = i % 3 === 0 ? '255,196,140' : i % 3 === 1 ? '157,176,255' : '255,240,220';
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${c},.28)`);
    grd.addColorStop(0.8, `rgba(${c},.18)`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // хвоинка по диагонали
  g.strokeStyle = '#2F4A2C';
  g.lineWidth = w * 0.035;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(-w * 0.1, h * 0.86); g.lineTo(w * 1.1, h * 0.5); g.stroke();
  g.strokeStyle = 'rgba(160,200,150,.35)';
  g.lineWidth = w * 0.008;
  g.beginPath(); g.moveTo(-w * 0.1, h * 0.85); g.lineTo(w * 1.1, h * 0.49); g.stroke();
  // кристалл: шестилучевая звезда с веточками
  const cx = w * 0.5, cy = h * 0.6, R = w * 0.3;
  g.save();
  g.translate(cx, cy);
  g.rotate(0.12 + Math.sin(t * 0.3) * 0.01);
  g.strokeStyle = 'rgba(235,246,255,.95)';
  g.shadowColor = 'rgba(190,220,255,.8)';
  g.shadowBlur = w * 0.02;
  for (let k = 0; k < 6; k++) {
    g.rotate(Math.PI / 3);
    g.lineWidth = w * 0.012;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -R); g.stroke();
    g.lineWidth = w * 0.007;
    for (const f of [0.35, 0.55, 0.75]) {
      const len = R * (0.32 - f * 0.22);
      g.beginPath(); g.moveTo(0, -R * f); g.lineTo(len, -R * f - len * 0.8); g.stroke();
      g.beginPath(); g.moveTo(0, -R * f); g.lineTo(-len, -R * f - len * 0.8); g.stroke();
    }
  }
  g.lineWidth = w * 0.006;
  g.beginPath();
  for (let k = 0; k <= 6; k++) { const a = k * Math.PI / 3; g.lineTo(Math.sin(a) * R * 0.18, -Math.cos(a) * R * 0.18); }
  g.stroke();
  g.restore();
}

/* ---------- Экран телефона ---------- */

const ZOOM_LABEL = { '0.5': '0,5× · сверхширокая 50 Мп', 1: '1× · 200 Мп · 24 мм', 2: '2× · 50 Мп из центра', 4: '4× · 12,5 Мп · оптическое качество', macro: 'МАКРО · 2,5 см · сверхширокая' };

export function drawScreen(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const now = st.now ?? performance.now();
  const ui = st.ui || '#9DB0FF';
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  if (mode === 'off') return;
  g.textBaseline = 'middle';
  g.textAlign = 'center';

  const statusBar = (pct = st.pct ?? 81) => {
    g.font = mono(22, 600);
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.textAlign = 'left';
    g.fillText('CamelOS 2.5', 44, 58);
    g.textAlign = 'right';
    const sw = st.sw === 1 ? ' · эфир выкл' : st.sw === -1 ? ' · всё выкл' : '';
    g.fillText(`FM2 · 5G${sw} · ${Math.round(pct)} %`, w - 44, 58);
    g.textAlign = 'center';
  };
  const dark = () => { g.fillStyle = '#07080C'; g.fillRect(0, 0, w, h); statusBar(); };
  // текст по центру; если не влезает в экран с полями по 50 px — шрифт уменьшается
  const fit = (text, y, font, px, color) => {
    let size = px;
    g.font = font(size);
    while (size > 12 && g.measureText(text).width > w - 100) { size -= 1; g.font = font(size); }
    g.fillStyle = color;
    g.fillText(text, w / 2, y);
  };
  const title = (a, b, y = 0.16) => {
    fit(a, h * y, (px) => sans(px, 760), 54, '#F4F6FF');
    if (b) fit(b, h * (y + 0.06), (px) => mono(px, 600), 26, ui);
  };

  if (mode === 'lock' || mode === 'boot') {
    drawHarbor(g, w, h, { t: now / 1000, accent: ui });
    g.fillStyle = 'rgba(0,0,0,.15)';
    g.fillRect(0, 0, w, h);
    statusBar();
    const d = new Date();
    g.fillStyle = '#F4F6FF';
    g.font = sans(190, 700);
    g.fillText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, w / 2, h * 0.2);
    g.font = sans(30, 500);
    g.fillStyle = 'rgba(244,246,255,.78)';
    g.fillText(mode === 'boot' ? 'CamelOS 2.5 · без аккаунта' : 'Стокгольм · шхеры · −2°', w / 2, h * 0.28);
    if (mode === 'boot') {
      roundRect(g, 60, h * 0.36, w - 120, 200, 34);
      g.fillStyle = 'rgba(6,8,20,.6)';
      g.fill();
      g.textAlign = 'left';
      g.font = mono(24, 600);
      ['oasis 2 · ядро … ok', 'GP20 · 20 ядер … ok', 'Citadel 6 Slim … ok'].forEach((s, i) => {
        g.fillStyle = i === 2 ? ui : 'rgba(244,246,255,.85)';
        g.fillText(s, 100, h * 0.36 + 52 + i * 50);
      });
      g.textAlign = 'center';
    }
    return;
  }

  if (mode === 'camera') {
    const zk = String(st.zoom ?? 1);
    drawHarbor(g, w, h, { t: now / 1000, accent: ui, zoom: ZOOMS[zk] ?? 1 });
    g.strokeStyle = 'rgba(255,255,255,.28)';
    g.lineWidth = 2;
    for (const k of [1 / 3, 2 / 3]) {
      g.beginPath(); g.moveTo(w * k, 0); g.lineTo(w * k, h); g.stroke();
      g.beginPath(); g.moveTo(0, h * k); g.lineTo(w, h * k); g.stroke();
    }
    statusBar();
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.fillRect(0, h * 0.8, w, h * 0.2);
    // кнопки зума
    const keys = ['0.5', '1', '2', '4', 'macro'];
    keys.forEach((k, i) => {
      const x = w * (0.18 + i * 0.16), y = h * 0.835;
      g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2);
      g.fillStyle = k === zk ? ui : 'rgba(255,255,255,.14)';
      g.fill();
      g.font = mono(k === 'macro' ? 20 : 24, 700);
      g.fillStyle = k === zk ? '#07080C' : '#F4F6FF';
      g.fillText(k === 'macro' ? '✿' : k === '0.5' ? ',5' : `${k}×`, x, y);
    });
    g.font = mono(22, 700);
    g.fillStyle = '#F4F6FF';
    g.fillText(ZOOM_LABEL[zk] || '', w / 2, h * 0.89);
    g.beginPath(); g.arc(w / 2, h * 0.945, 38, 0, Math.PI * 2);
    g.fillStyle = '#F4F6FF';
    g.fill();
    return;
  }

  if (mode === 'battery') {
    const pct = st.pct ?? 100;
    dark();
    statusBar(pct);
    title(`${Math.round(pct)} %`, st.clock ? `${st.clock} · ${st.profile || 'обычный день'}` : '4000 мАч', 0.2);
    // ячейка
    const bx = w * 0.3, by = h * 0.36, bw = w * 0.4, bh = h * 0.34;
    roundRect(g, bx, by, bw, bh, 40);
    g.strokeStyle = 'rgba(244,246,255,.5)';
    g.lineWidth = 6;
    g.stroke();
    roundRect(g, bx + w * 0.15, by - 22, w * 0.1, 22, 8);
    g.fillStyle = 'rgba(244,246,255,.5)';
    g.fill();
    const fh = (bh - 28) * clamp01(pct / 100);
    roundRect(g, bx + 14, by + bh - 14 - fh, bw - 28, Math.max(fh, 1), 28);
    g.fillStyle = pct < 15 ? '#FF5A4E' : ui;
    g.fill();
    g.font = mono(24, 600);
    g.fillStyle = 'rgba(244,246,255,.7)';
    g.fillText('ячейка 2,9 мм · кремний-углерод', w / 2, h * 0.76);
    return;
  }

  if (mode === 'citadel') {
    dark();
    title('Citadel 6 Slim', '«Водяной знак» · подпись кадра', 0.14);
    const px = 60, py = h * 0.27, pw = w - 120, ph = pw * 1.1;
    g.save();
    roundRect(g, px, py, pw, ph, 30);
    g.clip();
    g.translate(px, py);
    drawHarbor(g, pw, ph, { t: now / 1000, accent: ui });
    if (st.edited) { g.fillStyle = 'rgba(255,90,78,.25)'; g.fillRect(pw * 0.55, ph * 0.3, pw * 0.25, ph * 0.3); }
    if (st.reveal) {
      g.strokeStyle = st.edited ? 'rgba(255,90,78,.6)' : 'rgba(157,176,255,.5)';
      g.lineWidth = 1.5;
      for (let i = -ph; i < pw; i += 18) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + ph, ph); g.stroke(); }
    }
    g.restore();
    // вердикт в две строки: коротко и крупно, пояснение мельче
    const okColor = st.edited ? '#FF5A4E' : '#8FE0B0';
    fit(st.edited ? 'Подпись не сходится' : 'Подпись сходится', py + ph + 64, (px) => sans(px, 720), 42, okColor);
    fit(st.edited ? 'кадр изменён после съёмки' : 'снято этой камерой, кадр не тронут', py + ph + 116, (px) => mono(px, 600), 24, 'rgba(244,246,255,.7)');
    return;
  }

  if (mode === 'torch') {
    const on = st.torch ?? 0;
    dark();
    const c = st.torchColor === 'red' ? '255,60,60' : '255,246,230';
    const grd = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.7);
    grd.addColorStop(0, `rgba(${c},${0.55 * on})`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    title('Сигнальный фонарь', st.torchMode || 'окно 1,6 мм · до 4000 м', 0.42);
    return;
  }

  if (mode === 'switch') {
    dark();
    title('«Рубильник»', 'три положения · Citadel 6 Slim', 0.16);
    const sw = st.sw ?? 0;
    const rows = [['Камеры и микрофоны', sw === -1], ['Сотовая связь', sw !== 0], ['Wi-Fi и Bluetooth', sw !== 0], ['Геолокация', sw !== 0], ['Экран и звонки', false]];
    rows.forEach(([name, off], i) => {
      const y = h * (0.34 + i * 0.1);
      roundRect(g, 50, y - 46, w - 100, 92, 24);
      g.fillStyle = off ? 'rgba(255,255,255,.04)' : 'rgba(157,176,255,.14)';
      g.fill();
      g.textAlign = 'left';
      g.font = sans(32, 600);
      g.fillStyle = off ? 'rgba(244,246,255,.35)' : '#F4F6FF';
      g.fillText(name, 84, y);
      g.textAlign = 'right';
      g.font = mono(26, 700);
      g.fillStyle = off ? '#FF5A4E' : ui;
      g.fillText(off ? 'обесточено' : 'вкл', w - 84, y);
    });
    g.textAlign = 'center';
  }
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const std = (name, color, o = {}) => new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.45, ...o });
  const mats = {
    Body: std('Body', X4_COLORS.grifel.body, { roughness: 0.5 }),
    Island: std('Island', X4_COLORS.grifel.body, { roughness: 0.12, clearcoat: 1 }),
    Frame: std('Frame', X4_COLORS.grifel.frame, { metalness: 1, roughness: 0.28 }),
    Lens: std('Lens', 0x020306, { roughness: 0.05, clearcoat: 1 }),
    LensChrome: std('LensChrome', 0x8D9197, { metalness: 1, roughness: 0.2 }),
    Screen: std('Screen', 0x020203),
    Glass: std('Glass', 0x030304, { roughness: 0.05, clearcoat: 1 }),
    Switch: std('Switch', 0xC2352A, { metalness: 0.4, roughness: 0.34 }),
    TorchGlow: std('TorchGlow', 0xEDEDED, { emissive: 0xFFFFFF, emissiveIntensity: 0.4 }),
  };
  const root = new THREE.Group();
  root.name = 'OY0X4';
  const add = (geo, mat, x = 0, y = 0, z = 0, name) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    root.add(m);
    return m;
  };
  // +Z — экран, −Z — спинка; островок со спины слева, то есть +X
  add(slab(W, H, 12.4, 4.85, 0.7, 12), 'Frame', 0, 0, 0, 'Frame');
  add(slab(W - 1.3, H - 1.3, 11.8, 0.5, 0.2, 12), 'Body', 0, 0, -HD + 0.25, 'Body');
  add(slab(W - 1.3, H - 1.3, 11.8, 0.5, 0.2, 12), 'Glass', 0, 0, HD - 0.25, 'Glass');
  const scr = new THREE.PlaneGeometry(SCR.w * MM, SCR.h * MM);
  const uv = scr.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - uv.getY(i));
  add(scr, 'Screen', 0, 0, HD + 0.02, 'Screen');
  const ix = 3.5, iz = 55.5;
  add(slab(47, 22.6, 11.3, 1.9, 0.8, 12), 'Island', ix, iz, -HD - 0.95, 'Island');
  for (const dx of [-12.4, 12.4]) {
    add(cylZ(7, 0.4), 'LensChrome', ix + dx, iz, -HD - 2);
    add(cylZ(5.1, 0.5), 'Lens', ix + dx, iz, -HD - 2.1);
  }
  add(boxG(0.6, 5.4, 1.8), 'Switch', -W / 2 - 0.25, HH - 40, 0, 'Switch');
  add(boxG(9, 0.4, 1.6), 'TorchGlow', 0, HH + 0.1, 0, 'Torch');
  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X4({ phone, scale, isRunning }) {
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

  // матовое стекло спинки, глянцевый островок и сатиновый титан
  const bodyMat = new THREE.MeshPhysicalMaterial({ name: 'Body', color: X4_COLORS.grifel.body, metalness: 0, roughness: 0.5, clearcoat: 0.06, clearcoatRoughness: 0.3, envMapIntensity: 0.6 });
  const islandMat = new THREE.MeshPhysicalMaterial({ name: 'Island', color: X4_COLORS.grifel.body, metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 });
  const frameMat = new THREE.MeshStandardMaterial({ name: 'Frame', color: X4_COLORS.grifel.frame, metalness: 1, roughness: 0.28, envMapIntensity: 1.15 });
  const logoMat = new THREE.MeshStandardMaterial({ name: 'Logo', color: X4_COLORS.grifel.frame, metalness: 1, roughness: 0.16, envMapIntensity: 1.4 });

  let color = 'grifel';
  const tgt = { body: new THREE.Color(), frame: new THREE.Color() };
  const cur = { body: new THREE.Color(), frame: new THREE.Color() };
  function setTargets(name) {
    tgt.body.setHex(X4_COLORS[name].body);
    tgt.frame.setHex(X4_COLORS[name].frame);
  }
  setTargets(color);
  for (const k in cur) cur[k].copy(tgt[k]);

  const screen = { mode: 'lock', zoom: '1', sw: 0 };
  let lastDraw = 0;
  function redraw(now = performance.now()) {
    drawScreen(scrCanvas, screen.mode, { ...screen, now, ui: X4_COLORS[color].ui });
    scrTex.needsUpdate = true;
    lastDraw = now;
  }
  redraw();

  const parts = { sw: null, swBase: 0, torchMat: null };
  const torchTarget = new THREE.Color(0xffffff);
  const torchCur = new THREE.Color(0xffffff);
  const white = new THREE.Color(0xffffff);

  function setup(root) {
    const byName = {};
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (m?.name && !byName[m.name]) byName[m.name] = m;
      const pick = (m) => {
        switch (m?.name) {
          case 'Body': return bodyMat;
          case 'Island': return islandMat;
          case 'Frame': case 'PowerKey': return frameMat;
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
    if (byName.LensChrome) { const m = byName.LensChrome; m.metalness = 1; m.roughness = 0.2; m.envMapIntensity = 1.4; }
    parts.torchMat = byName.TorchGlow || null;
    if (parts.torchMat) { parts.torchMat.emissive = new THREE.Color(0xffffff); parts.torchMat.emissiveIntensity = 0.3; parts.torchMat.toneMapped = false; }
    parts.sw = root.getObjectByName('Switch');
    parts.swBase = parts.sw?.position.y ?? 0;
    stepColors(1);
  }

  function stepColors(k) {
    for (const key in cur) cur[key].lerp(tgt[key], k);
    torchCur.lerp(torchTarget, k);
    bodyMat.color.copy(cur.body);
    islandMat.color.copy(cur.body).multiplyScalar(ISLAND_DARK);
    frameMat.color.copy(cur.frame);
    logoMat.color.copy(cur.frame).lerp(white, 0.1);
  }

  function update(st, dt, { reduced }) {
    const now = performance.now();
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));
    if (parts.sw) parts.sw.position.y = parts.swBase + SWITCH_STEP * Math.max(-1, Math.min(1, st.sw));

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
    const live = screen.mode === 'camera' || screen.mode === 'lock' || screen.mode === 'boot' || screen.mode === 'citadel';
    if (st.screen > 0.02 && now - lastDraw > (screen.mode === 'camera' ? 66 : live ? 1000 : 250)) redraw(now);
  }

  return {
    url: '/models/oy0x4.glb?v=8ab2d903da',
    state: { sw: 0, torch: 0, screen: 1 },
    parts,
    setup,
    buildFallback,
    update,
    snap() { stepColors(1); },
    api: {
      setBodyColor(name, instant = false) {
        if (!X4_COLORS[name] || name === color) return;
        color = name;
        setTargets(name);
        redraw();
        if (instant || !isRunning()) stepColors(1);
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
