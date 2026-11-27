/* =========================================================================
   OY 0X5 Pro — описание 3D-модели: «Смотрит в оба», 164,2 × 77,8 × 8,4 мм.
   Жёсткий корпус: титановая рамка, плоское стекло спереди, матовое сзади.
   Шайба Ø46 мм выдвигается на 20 мм (ext: 0…1): ободок неподвижен, два
   колена тубуса растягиваются, голова с объективами уезжает от спинки.
   Под шайбой — цветной E Ink 4,6″ во всю ширину спинки: его рисует canvas, смена картинки идёт
   с «полной перерисовкой» (чёрный — белый — картинка), как у настоящей
   электронной бумаги. 0Pen 2 живёт в слоте нижней грани (pen: 0…1 — насколько
   вынут). Экран CamelOS: CPix 3, сканер сетчатки, видоискатель «Тубуса»
   над заливом с маяком Fyr, частота 0,1–180 Гц, «Тишина». Процедурная
   резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, roundRect, slab, boxG, cylZ, makeBeam } from './oy0x0.js';

// body — спинка, frame — рамка, кнопки, ободок шайбы; ui — акцент экрана; sw — язычок «Рубильника»
// paper — бумага E Ink под тонированным стеклом, inkFg — чернила на ней
export const PRO_COLORS = {
  iris: { body: 0x1E4650, frame: 0x5E6A6E, ui: '#7FD8E0', sw: 0xE8E4DA, paper: '#3F676D', inkFg: '#0D1B1E', label: 'Радужка' },
  ink: { body: 0x121316, frame: 0x2E3135, ui: '#E8E4DA', sw: 0xD8343C, paper: '#3A3C3F', inkFg: '#D3CFC4', label: 'Чернила' },
  paper: { body: 0xE8E2D4, frame: 0xBDB4A3, ui: '#9FC8D8', sw: 0x1A1B1D, paper: '#C4BCAA', inkFg: '#17181A', label: 'Бумага' },
  retina: { body: 0xB85A4E, frame: 0xB08A7A, ui: '#FFB4A8', sw: 0x1A1B1D, paper: '#C2877C', inkFg: '#2A0F0B', label: 'Сетчатка' },
  amber: { body: 0x8E4A1C, frame: 0x4A3A2C, ui: '#FFC27A', sw: 0xE8E4DA, paper: '#9A6640', inkFg: '#1E1209', label: 'Янтарь' },
};
export const SCREEN_MODES = ['off', 'lock', 'cpix', 'retina', 'tube', 'hz', 'silence', 'torch', 'pen'];
export const INK_MODES = ['clock', 'note', 'ticket', 'rec', 'book', 'love', 'switch'];
export const TORCH_COLORS = { white: 0xFFFFFF, red: 0xFF2A2A };

// Геометрия, мм — как в blender/build_oy0x5pro.py
const W = 77.8, H = 164.2, D = 8.4, HH = H / 2, HD = D / 2;
const TOP_Y = HH * MM;
const SCR = { w: W - 3.0, h: H - 3.0 };
const PZ = HH - 30.0;
const BEZEL_R = 23.0;
const BEZEL_H = 1.4;
const EXT_MM = 20;
const EINK_M = 6.5;
const EINK = { w: W - 2 * EINK_M, h: (PZ - BEZEL_R - EINK_M) - (-HH + EINK_M), r: 13.5 - EINK_M };
const EINK_Y = ((PZ - BEZEL_R - EINK_M) + (-HH + EINK_M)) / 2;
const SWITCH_STEP = 0.0032;
const PEN = { x: 27.5, r: 2.3, len: 128 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pad2 = (n) => String(n).padStart(2, '0');
const sans = (px, wt = 700) => `${wt} ${px}px "Onest", system-ui, sans-serif`;
const mono = (px, wt = 600) => `${wt} ${px}px "JetBrains Mono", ui-monospace, monospace`;
const serif = (px, wt = 600) => `${wt} ${px}px Georgia, "Times New Roman", serif`;

/* ---------- Залив и маяк Fyr: видоискатель «Тубуса» ---------- */

// Мир нарисован шире кадра. zoom: 0.5 · 1 · 3…20 — на 20× читается табличка смотрителя
export function drawBay(g, w, h, { t = 0, zoom = 1, accent = '#7FD8E0', night = 0 } = {}) {
  g.save();
  const fx = w * 0.64, fy = h * 0.49;      // центр зума — окно смотрителя под фонарём
  g.translate(fx, fy);
  g.scale(zoom, zoom);
  g.translate(-fx, -fy);
  const X0 = -w * 1.4, X1 = w * 2.4;
  const sky = g.createLinearGradient(0, -h * 0.4, 0, h * 0.6);
  sky.addColorStop(0, night ? '#0B1426' : '#3B5F86');
  sky.addColorStop(0.6, night ? '#24304A' : '#C9B7A6');
  sky.addColorStop(1, night ? '#3A3550' : '#F0C9A0');
  g.fillStyle = sky;
  g.fillRect(X0, -h, X1 - X0, h * 1.62);
  // дальний берег и ели
  g.fillStyle = night ? '#141A26' : '#4C5A5E';
  g.beginPath();
  g.moveTo(X0, h * 0.6);
  for (let x = X0; x <= X1; x += w * 0.04) g.lineTo(x, h * (0.585 + Math.sin(x / w * 7) * 0.006 + Math.sin(x / w * 23) * 0.004));
  g.lineTo(X1, h * 0.62); g.lineTo(X0, h * 0.62); g.fill();
  g.fillStyle = night ? '#0E131C' : '#34413F';
  for (let i = 0; i < 40; i++) {
    const px = w * (-1.2 + i * 0.09), ph = h * (0.02 + ((i * 7) % 5) * 0.004);
    g.beginPath(); g.moveTo(px - w * 0.008, h * 0.6); g.lineTo(px, h * 0.6 - ph); g.lineTo(px + w * 0.008, h * 0.6); g.fill();
  }
  // вода
  const sea = g.createLinearGradient(0, h * 0.6, 0, h * 1.5);
  sea.addColorStop(0, night ? '#1A2438' : '#7F96A6');
  sea.addColorStop(1, night ? '#05080E' : '#24384A');
  g.fillStyle = sea;
  g.fillRect(X0, h * 0.6, X1 - X0, h * 1.2);
  g.strokeStyle = night ? 'rgba(255,220,160,.12)' : 'rgba(255,255,255,.18)';
  g.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const y = h * (0.62 + i * i * 0.0012), off = ((t * 8 + i * 37) % 60) - 30;
    g.beginPath(); g.moveTo(X0, y); for (let x = X0; x < X1; x += 14) g.lineTo(x, y + Math.sin((x + off) / 9) * 0.6); g.stroke();
  }
  // скала и маяк
  g.fillStyle = night ? '#121418' : '#5A5550';
  g.beginPath(); g.ellipse(fx, h * 0.605, w * 0.07, h * 0.02, 0, Math.PI, 0); g.fill();
  const tw = w * 0.022, th = h * 0.11, tx = fx, ty = h * 0.595;
  g.fillStyle = '#EDE8DE';
  g.beginPath(); g.moveTo(tx - tw, ty); g.lineTo(tx - tw * 0.72, ty - th); g.lineTo(tx + tw * 0.72, ty - th); g.lineTo(tx + tw, ty); g.fill();
  g.fillStyle = '#B3202A';
  for (const k of [0.2, 0.55]) {
    const a = ty - th * k, b2 = ty - th * (k + 0.16);
    const wa = tw * (1 - k * 0.28), wb = tw * (1 - (k + 0.16) * 0.28);
    g.beginPath(); g.moveTo(tx - wa, a); g.lineTo(tx - wb, b2); g.lineTo(tx + wb, b2); g.lineTo(tx + wa, a); g.fill();
  }
  // галерея и фонарь
  g.fillStyle = '#2A2C30';
  g.fillRect(tx - tw * 0.95, ty - th - h * 0.004, tw * 1.9, h * 0.004);
  const lit = 0.55 + 0.45 * Math.max(0, Math.sin(t * 1.3));
  g.fillStyle = `rgba(255,214,140,${lit})`;
  g.fillRect(tx - tw * 0.45, ty - th - h * 0.018, tw * 0.9, h * 0.014);
  g.fillStyle = '#2A2C30';
  g.beginPath(); g.moveTo(tx - tw * 0.6, ty - th - h * 0.018); g.lineTo(tx, ty - th - h * 0.03); g.lineTo(tx + tw * 0.6, ty - th - h * 0.018); g.fill();
  // луч
  if (night) {
    const a = t * 0.7;
    g.save();
    g.translate(tx, ty - th - h * 0.011);
    g.rotate(Math.sin(a) * 0.9);
    const beam = g.createLinearGradient(0, 0, w * 1.2, 0);
    beam.addColorStop(0, 'rgba(255,226,170,.55)');
    beam.addColorStop(1, 'rgba(255,226,170,0)');
    g.fillStyle = beam;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 1.2, -h * 0.05); g.lineTo(w * 1.2, h * 0.05); g.fill();
    g.restore();
  }
  // дверь и табличка смотрителя: читается только на 20×
  g.fillStyle = '#3B2A26';
  g.fillRect(tx - tw * 0.18, ty - h * 0.016, tw * 0.36, h * 0.016);
  g.fillStyle = '#F4EFE2';
  g.fillRect(tx - tw * 0.42, ty - th * 0.42, tw * 0.84, h * 0.007);
  g.fillStyle = '#16171A';
  g.font = `700 ${Math.max(1, h * 0.0036)}px "JetBrains Mono", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('FYR · 0x5 PRO', tx, ty - th * 0.42 + h * 0.0036);
  // окно смотрителя с котом — центр зума
  g.fillStyle = `rgba(255,214,140,${0.7 + 0.3 * Math.sin(t * 2)})`;
  g.fillRect(tx - tw * 0.12, ty - th * 0.74, tw * 0.24, h * 0.008);
  g.fillStyle = '#16120F';
  const cs = h * 0.0012;
  g.beginPath(); g.arc(tx, ty - th * 0.74 + h * 0.006, cs * 1.6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(tx - cs * 1.4, ty - th * 0.74 + h * 0.005); g.lineTo(tx - cs * 0.8, ty - th * 0.74 + h * 0.0022); g.lineTo(tx - cs * 0.2, ty - th * 0.74 + h * 0.005); g.fill();
  g.beginPath(); g.moveTo(tx + cs * 0.2, ty - th * 0.74 + h * 0.005); g.lineTo(tx + cs * 0.8, ty - th * 0.74 + h * 0.0022); g.lineTo(tx + cs * 1.4, ty - th * 0.74 + h * 0.005); g.fill();
  // парус и чайки
  const bx = w * (0.1 + ((t * 0.008) % 0.5));
  g.fillStyle = night ? '#2A3040' : '#F2EEE6';
  g.beginPath(); g.moveTo(bx, h * 0.67); g.lineTo(bx + w * 0.01, h * 0.62); g.lineTo(bx + w * 0.02, h * 0.67); g.fill();
  g.fillStyle = accent;
  g.fillRect(bx - w * 0.004, h * 0.67, w * 0.028, h * 0.004);
  g.strokeStyle = night ? 'rgba(200,200,220,.4)' : 'rgba(40,40,50,.55)';
  for (let i = 0; i < 4; i++) {
    const x = w * (0.28 + i * 0.06 + ((t * 0.012) % 0.3)), y = h * (0.3 + (i % 2) * 0.04);
    g.beginPath(); g.moveTo(x - 5, y); g.quadraticCurveTo(x - 2.5, y - 3, x, y); g.quadraticCurveTo(x + 2.5, y - 3, x + 5, y); g.stroke();
  }
  g.restore();
}

/* ---------- Сетчатка: дерево сосудов по зерну ---------- */

function rnd32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Ветви: [{x0,y0,x1,y1,w,d}] в долях радиуса от диска зрительного нерва
export function retinaTree(seed = 2034) {
  const r = rnd32(seed);
  const out = [];
  const grow = (x, y, a, len, w, d) => {
    if (d > 6 || w < 0.003) return;
    const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    out.push({ x0: x, y0: y, x1, y1, w, d });
    const n = r() < 0.75 ? 2 : 1;
    for (let i = 0; i < n; i++) grow(x1, y1, a + (r() - 0.5) * 1.1 + (i ? 0.35 : -0.35), len * (0.7 + r() * 0.2), w * 0.72, d + 1);
  };
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6 + (r() - 0.5) * 0.4;
    grow(0, 0, a, 0.22, 0.03, 0);
  }
  return out;
}
export function drawRetina(g, cx, cy, R, { tree, scan = -1, ink = '#B3202A', bg = '#E9A07A', alpha = 1, squint = 0 } = {}) {
  g.save();
  g.globalAlpha = alpha;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
  const grd = g.createRadialGradient(cx - R * 0.35, cy, R * 0.05, cx, cy, R);
  grd.addColorStop(0, '#FFE2B8');
  grd.addColorStop(0.15, bg);
  grd.addColorStop(1, '#5E2418');
  g.fillStyle = grd;
  g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  // жёлтое пятно
  const mac = g.createRadialGradient(cx + R * 0.35, cy, 0, cx + R * 0.35, cy, R * 0.22);
  mac.addColorStop(0, 'rgba(90,30,20,.55)');
  mac.addColorStop(1, 'rgba(90,30,20,0)');
  g.fillStyle = mac;
  g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  const ox = cx - R * 0.35;
  g.lineCap = 'round';
  for (const b of tree) {
    g.strokeStyle = ink;
    g.globalAlpha = alpha * (1 - b.d * 0.08);
    g.lineWidth = Math.max(0.6, b.w * R);
    g.beginPath(); g.moveTo(ox + b.x0 * R, cy + b.y0 * R); g.lineTo(ox + b.x1 * R, cy + b.y1 * R); g.stroke();
  }
  g.globalAlpha = alpha;
  // диск зрительного нерва
  g.fillStyle = '#FFF0D0';
  g.beginPath(); g.arc(ox, cy, R * 0.09, 0, Math.PI * 2); g.fill();
  if (scan >= 0) {
    const y = cy - R + scan * 2 * R;
    const sg = g.createLinearGradient(0, y - R * 0.12, 0, y);
    sg.addColorStop(0, 'rgba(127,216,224,0)');
    sg.addColorStop(1, 'rgba(127,216,224,.75)');
    g.fillStyle = sg;
    g.fillRect(cx - R, y - R * 0.12, 2 * R, R * 0.12);
    g.fillStyle = '#E8FBFF';
    g.fillRect(cx - R, y - 1, 2 * R, 2);
  }
  if (squint > 0) {
    // «Тревожный взгляд»: веко прикрывает верх и низ
    g.fillStyle = '#16171A';
    g.fillRect(cx - R, cy - R, 2 * R, R * 0.55 * squint);
    g.fillRect(cx - R, cy + R - R * 0.55 * squint, 2 * R, R * 0.55 * squint);
  }
  g.restore();
}

/* ---------- E Ink на спинке ---------- */

const INK = { paper: '#C4BCAA', ink: '#17181A', red: '#A3352A', blue: '#2F5D88', yellow: '#C9A13A' };

// Растровая «электронная бумага»: картинка рисуется в 1-битную сетку с точками
function inkDither(g, w, h, density) {
  g.fillStyle = 'rgba(22,23,26,.06)';
  for (let y = 0; y < h; y += 3) for (let x = (y / 3) % 2 ? 1 : 0; x < w; x += 3) if (((x * 7 + y * 13) % 11) / 11 < density) g.fillRect(x, y, 1, 1);
}

export function drawInk(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  g.save();
  // на спинке ось X зеркальна — рисуем как видит человек со спины
  g.translate(w, 0);
  g.scale(-1, 1);
  INK.paper = st.paper || '#C4BCAA';
  INK.ink = st.inkFg || '#17181A';
  g.fillStyle = INK.paper;
  g.fillRect(0, 0, w, h);
  inkDither(g, w, h, 0.5);
  g.fillStyle = INK.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const now = st.now ? new Date(st.now) : new Date();
  if (mode === 'clock') {
    g.font = serif(w * 0.3, 700);
    g.fillText(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`, w / 2, h * 0.36);
    g.font = sans(w * 0.055, 600);
    const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    g.fillText(days[now.getDay()], w / 2, h * 0.5);
    g.fillStyle = INK.red;
    g.fillRect(w * 0.12, h * 0.6, w * 0.76, 2);
    g.fillStyle = INK.ink;
    g.font = sans(w * 0.048, 500);
    g.fillText('3 сообщения · «Дом» спит', w / 2, h * 0.68);
    g.font = mono(w * 0.04, 500);
    g.fillText('ни одного мВт на картинку', w / 2, h * 0.88);
  } else if (mode === 'note') {
    const strokes = st.strokes || [];
    g.strokeStyle = INK.ink;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of strokes) {
      g.strokeStyle = s.color === 'red' ? INK.red : s.color === 'blue' ? INK.blue : INK.ink;
      g.lineWidth = (s.width || 0.012) * w;
      g.beginPath();
      s.pts.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)));
      g.stroke();
    }
    if (!strokes.length) {
      g.font = serif(w * 0.075, 500);
      g.fillStyle = 'rgba(22,23,26,.45)';
      g.fillText('Напишите что-нибудь', w / 2, h * 0.45);
      g.font = sans(w * 0.05, 500);
      g.fillText('0Pen 2 пишет и здесь', w / 2, h * 0.55);
    }
  } else if (mode === 'ticket') {
    g.textAlign = 'left';
    g.font = mono(w * 0.05, 600);
    g.fillText('ПОСАДОЧНЫЙ · BOARDING', w * 0.08, h * 0.1);
    g.font = serif(w * 0.15, 700);
    g.fillText('ARN', w * 0.08, h * 0.25);
    g.textAlign = 'right';
    g.fillText('CDG', w * 0.92, h * 0.25);
    g.textAlign = 'left';
    g.font = mono(w * 0.045, 500);
    g.fillText('Стокгольм → Париж · FY 2034', w * 0.08, h * 0.37);
    g.fillText('Место 05A · выход 30', w * 0.08, h * 0.43);
    // штрихкод PDF417-подобный
    for (let y = 0; y < 5; y++) for (let x = 0; x < 46; x++) {
      if (((x * 31 + y * 17 + x * y) % 7) < 3) g.fillRect(w * 0.08 + x * w * 0.0183, h * (0.56 + y * 0.05), w * 0.0183, h * 0.05);
    }
    g.fillStyle = INK.blue;
    g.fillRect(w * 0.08, h * 0.86, w * 0.84, h * 0.006);
  } else if (mode === 'rec') {
    g.fillStyle = INK.red;
    g.beginPath(); g.arc(w / 2, h * 0.36, w * 0.18, 0, Math.PI * 2); g.fill();
    g.fillStyle = INK.ink;
    g.font = serif(w * 0.16, 700);
    g.fillText('REC', w / 2, h * 0.64);
    g.font = sans(w * 0.055, 600);
    g.fillText('вас снимают', w / 2, h * 0.75);
    g.font = mono(w * 0.04, 500);
    g.fillText(st.recText || 'Тубус · 20× · 4K', w / 2, h * 0.84);
  } else if (mode === 'book') {
    g.textAlign = 'left';
    g.font = serif(w * 0.05, 500);
    const lines = ['Маяк стоял на скале', 'двести лет и ни разу', 'не спросил у кораблей,', 'куда они плывут.', '', 'Он просто светил —', 'каждому одинаково,', 'не записывая, кто', 'прошёл мимо.'];
    lines.forEach((l, i) => g.fillText(l, w * 0.1, h * (0.12 + i * 0.075)));
    g.font = mono(w * 0.035, 500);
    g.textAlign = 'center';
    g.fillText('стр. 30 · до 3 недель без зарядки', w / 2, h * 0.92);
  } else if (mode === 'love') {
    g.fillStyle = INK.red;
    const s = w * 0.2, cx = w / 2, cy = h * 0.34;
    g.beginPath();
    g.moveTo(cx, cy + s * 0.9);
    g.bezierCurveTo(cx - s * 1.4, cy, cx - s * 0.7, cy - s * 0.9, cx, cy - s * 0.25);
    g.bezierCurveTo(cx + s * 0.7, cy - s * 0.9, cx + s * 1.4, cy, cx, cy + s * 0.9);
    g.fill();
    g.fillStyle = INK.ink;
    g.font = serif(w * 0.09, 700);
    g.fillText('Love Gen 5', w / 2, h * 0.62);
    g.font = sans(w * 0.05, 500);
    g.fillText(st.loveText || 'секреты под замком', w / 2, h * 0.71);
  } else if (mode === 'switch') {
    const pos = st.sw ?? 0;
    g.font = serif(w * 0.1, 700);
    g.fillText(pos === 1 ? '«Эфир»' : pos === -1 ? '«Тишина»' : 'Всё включено', w / 2, h * 0.38);
    g.font = sans(w * 0.05, 500);
    g.fillText(pos === 1 ? 'связь обесточена' : pos === -1 ? 'камеры, микрофоны и связь' : 'рубильник посередине', w / 2, h * 0.5);
    g.fillText(pos === -1 ? 'обесточены рукой' : ' ', w / 2, h * 0.56);
  }
  g.restore();
}

/* ---------- Экран телефона ---------- */

export function drawScreen(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const now = st.now ?? performance.now();
  const t = now / 1000;
  const ui = st.ui || '#7FD8E0';
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  if (mode === 'off') return;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const d = new Date();
  const status = () => {
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.font = mono(w * 0.036);
    g.textAlign = 'left';
    g.fillText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, w * 0.08, h * 0.025);
    g.textAlign = 'right';
    g.fillText(st.sw === 1 ? 'ЭФИР' : st.sw === -1 ? 'ТИШИНА' : '5G · 92%', w * 0.92, h * 0.025);
    g.textAlign = 'center';
  };
  const title = (a, b, y = 0.15) => {
    g.fillStyle = '#fff';
    g.font = sans(w * 0.075, 700);
    g.fillText(a, w / 2, h * y);
    if (b) { g.fillStyle = 'rgba(255,255,255,.6)'; g.font = sans(w * 0.042, 500); g.fillText(b, w / 2, h * (y + 0.04)); }
  };
  if (mode === 'lock' || mode === 'silence') {
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0B1422');
    bg.addColorStop(1, '#1D2C3A');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    status();
    g.fillStyle = '#fff';
    g.font = sans(w * 0.24, 300);
    g.fillText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, w / 2, h * 0.2);
    g.font = sans(w * 0.045, 500);
    g.fillStyle = 'rgba(255,255,255,.7)';
    g.fillText(mode === 'silence' ? '«Тишина»: камеры, микрофоны и связь обесточены' : 'Love Gen 5 · всё под замком', w / 2, h * 0.27);
    // маяк на заставке
    g.save();
    g.beginPath(); roundRect(g, w * 0.08, h * 0.55, w * 0.84, h * 0.3, w * 0.06); g.clip();
    drawBay(g, w, h * 1.0, { t, zoom: 1.6, accent: ui, night: 1 });
    g.restore();
    return;
  }
  if (mode === 'cpix') {
    // блок пикселей над фронталками уезжает, поднимаются три модуля
    const k = clamp01(st.open ?? 0);
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1D2C3A');
    bg.addColorStop(1, '#0B1422');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    status();
    const bw = w * 0.36, bh = h * 0.035, bx = w / 2 - bw / 2, by = h * 0.045;
    g.fillStyle = '#000';
    g.fillRect(bx, by, bw, bh);
    const mods = [[-0.12, 'f'], [0, 'r'], [0.12, 'u']];
    for (const [dx, kind] of mods) {
      const cx = w / 2 + dx * w, cy = by + bh / 2, r = bh * 0.38 * k;
      if (r < 0.5) continue;
      g.fillStyle = kind === 'r' ? '#3A0B12' : '#0E1016';
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = kind === 'r' ? `rgba(255,60,60,${0.5 + 0.5 * Math.sin(t * 6)})` : '#2A3A58';
      g.beginPath(); g.arc(cx, cy, r * 0.4, 0, Math.PI * 2); g.fill();
    }
    // сам блок: гаснет и уезжает влево под соседей
    g.save();
    g.globalAlpha = 1 - k * 0.8;
    g.fillStyle = '#25384A';
    g.fillRect(bx - bw * k * 1.05, by, bw, bh);
    g.restore();
    title(k > 0.5 ? 'Камера поднята' : 'Пиксели на месте', k > 0.5 ? `окно открыто за ${st.ms || 40} мс` : 'фронталки обесточены', 0.3);
    g.fillStyle = ui;
    g.font = mono(w * 0.04);
    g.fillText('CPix 3 · журнал «Века 2»', w / 2, h * 0.9);
    return;
  }
  if (mode === 'retina') {
    g.fillStyle = '#050608';
    g.fillRect(0, 0, w, h);
    status();
    drawRetina(g, w / 2, h * 0.42, w * 0.34, { tree: st.tree || retinaTree(), scan: st.scan ?? -1, squint: st.squint || 0 });
    g.strokeStyle = ui;
    g.lineWidth = 3;
    g.beginPath(); g.arc(w / 2, h * 0.42, w * 0.37, 0, Math.PI * 2); g.stroke();
    title(st.ok ? (st.squint ? 'Открыт «Двойник»' : 'Это вы') : 'Посмотрите сюда', st.ok ? '0,4 с · шаблон в Love Gen 5' : '20–40 см от экрана', 0.72);
    return;
  }
  if (mode === 'tube') {
    drawBay(g, w, h, { t, zoom: st.zoom || 1, accent: ui, night: st.night || 0 });
    g.fillStyle = 'rgba(0,0,0,.4)';
    g.fillRect(0, h * 0.86, w, h * 0.14);
    g.fillStyle = '#fff';
    g.font = sans(w * 0.06, 700);
    g.fillText(`${(st.zoom || 1).toFixed(1).replace('.', ',').replace(',0', '')}×`, w / 2, h * 0.9);
    g.font = mono(w * 0.032);
    g.fillStyle = ui;
    g.fillText(st.ext > 0.95 ? 'шайба выдвинута на 20 мм · «Тубус»' : 'шайба сложена · основная', w / 2, h * 0.95);
    // рамка видоискателя
    g.strokeStyle = 'rgba(255,255,255,.5)';
    g.lineWidth = 2;
    const c = w * 0.06;
    for (const [x, y, sx, sy] of [[w * 0.12, h * 0.3, 1, 1], [w * 0.88, h * 0.3, -1, 1], [w * 0.12, h * 0.7, 1, -1], [w * 0.88, h * 0.7, -1, -1]]) {
      g.beginPath(); g.moveTo(x, y + c * sy); g.lineTo(x, y); g.lineTo(x + c * sx, y); g.stroke();
    }
    return;
  }
  if (mode === 'hz') {
    const hz = st.hz || 180;
    g.fillStyle = '#050608';
    g.fillRect(0, 0, w, h);
    status();
    title(`${String(hz).replace('.', ',')} Гц`, hz < 1 ? 'один кадр в десять секунд' : hz >= 120 ? 'игра · прокрутка' : 'видео', 0.2);
    // бегущая полоса: при 0,1 Гц стоит
    const step = hz < 1 ? Math.floor(t / 10) : Math.floor(t * Math.min(hz, 60));
    const x = ((step * 0.03) % 1) * w;
    g.fillStyle = ui;
    g.fillRect(x, h * 0.45, w * 0.1, h * 0.1);
    return;
  }
  if (mode === 'pen') {
    g.fillStyle = '#F4F1EA';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.08)';
    for (let y = h * 0.1; y < h; y += h * 0.04) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#16171A';
    g.font = serif(w * 0.07, 600);
    g.fillText('0Pen 2', w / 2, h * 0.12);
    g.font = sans(w * 0.04, 500);
    g.fillText('8192 уровня · 2 мс · и на спинке тоже', w / 2, h * 0.17);
    return;
  }
  if (mode === 'torch') {
    status();
    const on = clamp01(st.torch ?? 0);
    const c = st.torchColor === 'red' ? '255,60,60' : '255,246,230';
    const grd = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.7);
    grd.addColorStop(0, `rgba(${c},${0.55 * on})`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    title('Сигнальный фонарь', st.torchMode || 'до 6000 м', 0.42);
  }
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const std = (name, color, o = {}) => new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.45, ...o });
  const mats = {
    Body: std('Body', PRO_COLORS.iris.body, { roughness: 0.52 }),
    Frame: std('Frame', PRO_COLORS.iris.frame, { metalness: 1, roughness: 0.26 }),
    Bezel: std('Bezel', PRO_COLORS.iris.frame, { metalness: 1, roughness: 0.22 }),
    Tube: std('Tube', 0xB9BDC0, { metalness: 1, roughness: 0.16 }),
    Head: std('Head', 0x0C0D10, { roughness: 0.1, clearcoat: 1 }),
    Lens: std('Lens', 0x020306, { roughness: 0.05, clearcoat: 1 }),
    LensChrome: std('LensChrome', 0x8D9197, { metalness: 1, roughness: 0.2 }),
    Screen: std('Screen', 0x020203),
    Glass: std('Glass', 0x030304, { roughness: 0.05, clearcoat: 1 }),
    EInk: std('EInk', 0xD8D5CC, { roughness: 0.85 }),
    EInkBezel: std('EInkBezel', 0x1A1B1D),
    Switch: std('Switch', PRO_COLORS.iris.sw, { metalness: 0.3, roughness: 0.34 }),
    TorchGlow: std('TorchGlow', 0xEDEDED, { emissive: 0xFFFFFF, emissiveIntensity: 0.4 }),
  };
  const root = new THREE.Group();
  root.name = 'OY0X5Pro';
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };
  add(slab(W, H, 13.5, D - 1.2, 0.9, 12), 'Frame', 0, 0, 0, 'Frame');
  add(slab(W - 1.6, H - 1.6, 12.7, 0.6, 0.25, 12), 'Body', 0, 0, -HD + 0.3, 'Body');
  add(slab(W - 1.6, H - 1.6, 12.7, 0.6, 0.25, 12), 'Glass', 0, 0, HD - 0.3, 'Glass');
  const plane = (w, h) => {
    const g = new THREE.PlaneGeometry(w * MM, h * MM);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - uv.getY(i));
    return g;
  };
  add(plane(SCR.w, SCR.h), 'Screen', 0, 0, HD + 0.02, 'Screen');
  const ink = add(plane(EINK.w, EINK.h), 'EInk', 0, EINK_Y, -HD - 0.07, 'EInk');
  ink.rotation.y = Math.PI;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(22.4 * MM, 0.7 * MM, 12, 96), mats.Bezel);
  ring.position.set(0, PZ * MM, (-HD - 0.7) * MM);
  root.add(ring);
  const tubeGeo = (r) => { const g = new THREE.CylinderGeometry(r * MM, r * MM, MM, 96, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0, -MM / 2); return g; };
  const t1 = add(tubeGeo(21.4), 'Tube', 0, PZ, -HD + 0.5, 'Tube1');
  const t2 = add(tubeGeo(20.6), 'Tube', 0, PZ, -HD + 0.5, 'Tube2');
  t1.material = t2.material = mats.Tube;
  const head = new THREE.Group();
  head.name = 'Head';
  head.position.set(0, PZ * MM, (-HD - BEZEL_H) * MM);
  root.add(head);
  add(cylZ(20.8, 1.5), 'Head', 0, 0, -0.75, null, head);
  for (const [x, y, r] of [[0, 7, 8.2], [8.6, -6.8, 7], [-9.2, -7.4, 5]]) {
    add(cylZ(r, 0.4), 'LensChrome', x, y, -1.6, null, head);
    add(cylZ(r - 1.6, 0.5), 'Lens', x, y, -1.7, null, head);
  }
  add(boxG(0.6, 5.4, 2), 'Switch', -W / 2 - 0.25, HH - 42, 0, 'Switch');
  add(boxG(10, 0.4, 2.2), 'TorchGlow', 0, HH + 0.1, 0, 'Torch');
  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X5Pro({ phone, scale, isRunning }) {
  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, TOP_Y * scale + 0.004, 0);
  glow.position.set(0, TOP_Y * scale + 0.01, 0);
  phone.add(beam, glow);

  const mkTex = (cv) => {
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.anisotropy = 8;
    return tex;
  };
  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = 600;
  scrCanvas.height = Math.round(600 * SCR.h / SCR.w);
  const scrTex = mkTex(scrCanvas);
  const screenMat = new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x000000, roughness: 0.2, metalness: 0, emissive: 0xffffff, emissiveMap: scrTex, emissiveIntensity: 1 });
  screenMat.toneMapped = false;
  screenMat.polygonOffset = true;
  screenMat.polygonOffsetFactor = -2;
  screenMat.polygonOffsetUnits = -8;

  // E Ink — не светится: обычный матовый материал с картой цвета
  const inkCanvas = document.createElement('canvas');
  inkCanvas.width = 450;
  inkCanvas.height = Math.round(450 * EINK.h / EINK.w);
  const inkShow = document.createElement('canvas');
  inkShow.width = 450;
  inkShow.height = inkCanvas.height;
  const inkTex = mkTex(inkShow);
  const inkMat = new THREE.MeshStandardMaterial({ name: 'EInk', color: 0xffffff, map: inkTex, roughness: 0.88, metalness: 0, envMapIntensity: 0.35 });
  inkMat.polygonOffset = true;
  inkMat.polygonOffsetFactor = -2;
  inkMat.polygonOffsetUnits = -6;

  const bodyMat = new THREE.MeshPhysicalMaterial({ name: 'Body', color: PRO_COLORS.iris.body, metalness: 0, roughness: 0.52, clearcoat: 0.06, clearcoatRoughness: 0.3, envMapIntensity: 0.6 });
  const frameMat = new THREE.MeshStandardMaterial({ name: 'Frame', color: PRO_COLORS.iris.frame, metalness: 1, roughness: 0.26, envMapIntensity: 1.15 });
  const logoMat = new THREE.MeshStandardMaterial({ name: 'Logo', color: PRO_COLORS.iris.frame, metalness: 1, roughness: 0.16, envMapIntensity: 1.4 });
  const switchMat = new THREE.MeshStandardMaterial({ name: 'Switch', color: PRO_COLORS.iris.sw, metalness: 0.3, roughness: 0.34 });

  let color = 'iris';
  const tgt = { body: new THREE.Color(), frame: new THREE.Color(), sw: new THREE.Color() };
  const cur = { body: new THREE.Color(), frame: new THREE.Color(), sw: new THREE.Color() };
  function setTargets(name) {
    tgt.body.setHex(PRO_COLORS[name].body);
    tgt.frame.setHex(PRO_COLORS[name].frame);
    tgt.sw.setHex(PRO_COLORS[name].sw);
  }
  setTargets(color);
  for (const k in cur) cur[k].copy(tgt[k]);

  const screen = { mode: 'lock', sw: 0 };
  let lastDraw = 0;
  function redraw(now = performance.now()) {
    drawScreen(scrCanvas, screen.mode, { ...screen, now, ui: PRO_COLORS[color].ui });
    scrTex.needsUpdate = true;
    lastDraw = now;
  }
  redraw();

  // E Ink: новая картинка рисуется в запасной холст, показ — через полную перерисовку
  const ink = { mode: 'clock', extra: {}, flash: 0, key: '' };
  function paintInk() {
    drawInk(inkCanvas, ink.mode, { ...ink.extra, now: Date.now(), paper: PRO_COLORS[color].paper, inkFg: PRO_COLORS[color].inkFg });
  }
  function showInk(phase) {
    const g = inkShow.getContext('2d');
    if (phase === 'black') { g.fillStyle = '#16171A'; g.fillRect(0, 0, inkShow.width, inkShow.height); }
    else if (phase === 'white') { g.fillStyle = '#E6E3DA'; g.fillRect(0, 0, inkShow.width, inkShow.height); }
    else g.drawImage(inkCanvas, 0, 0);
    inkTex.needsUpdate = true;
  }
  paintInk();
  showInk('image');
  let inkTimers = [];
  function refreshInk(full = true) {
    paintInk();
    inkTimers.forEach(clearTimeout);
    inkTimers = [];
    if (!full) { showInk('image'); return; }
    showInk('black');
    inkTimers.push(setTimeout(() => showInk('white'), 110));
    inkTimers.push(setTimeout(() => showInk('image'), 230));
  }

  const parts = { sw: null, swBase: 0, torchMat: null, tube1: null, tube2: null, head: null, base: {}, pen: null };
  const torchTarget = new THREE.Color(0xffffff);
  const torchCur = new THREE.Color(0xffffff);
  const white = new THREE.Color(0xffffff);

  // 0Pen 2: в слоте нижней грани, справа (если смотреть на экран)
  const penGroup = new THREE.Group();
  const penBody = new THREE.Mesh(new THREE.CylinderGeometry(PEN.r * MM, PEN.r * MM, PEN.len * MM, 32), new THREE.MeshStandardMaterial({ color: 0x1A1B1D, metalness: 0.6, roughness: 0.3 }));
  penBody.position.y = (PEN.len / 2) * MM;
  const penTip = new THREE.Mesh(new THREE.ConeGeometry(PEN.r * MM, 8 * MM, 32), new THREE.MeshStandardMaterial({ color: 0xE8E4DA, roughness: 0.4 }));
  penTip.rotation.x = Math.PI;
  penTip.position.y = -4 * MM;
  const penRing = new THREE.Mesh(new THREE.TorusGeometry(PEN.r * MM, 0.35 * MM, 8, 32), new THREE.MeshStandardMaterial({ color: 0x7FD8E0, emissive: 0x7FD8E0, emissiveIntensity: 0.6 }));
  penRing.rotation.x = Math.PI / 2;
  penRing.position.y = (PEN.len - 14) * MM;
  penGroup.add(penBody, penTip, penRing);
  penGroup.position.set(PEN.x * MM, (-HH + 1) * MM, 0);
  penGroup.visible = false;

  function setup(root) {
    const byName = {};
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (m?.name && !byName[m.name]) byName[m.name] = m;
      const pick = (m) => {
        switch (m?.name) {
          case 'Body': return bodyMat;
          case 'Frame': case 'PowerKey': case 'Bezel': case 'Knurl': return frameMat;
          case 'Logo': return logoMat;
          case 'Switch': return switchMat;
          case 'Screen': return screenMat;
          case 'EInk': return inkMat;
          default: return m;
        }
      };
      o.material = Array.isArray(o.material) ? o.material.map(pick) : pick(o.material);
    });
    if (byName.Lens) { const m = byName.Lens; m.envMapIntensity = 0.5; m.roughness = 0.04; if ('clearcoat' in m) m.clearcoat = 1; }
    if (byName.LensCoat) { const m = byName.LensCoat; m.color.set(0x140F33); m.metalness = 0.5; m.roughness = 0.06; m.envMapIntensity = 0.9; }
    if (byName.LensChrome) { const m = byName.LensChrome; m.metalness = 1; m.roughness = 0.2; m.envMapIntensity = 1.4; }
    if (byName.Tube) { const m = byName.Tube; m.metalness = 1; m.roughness = 0.14; m.envMapIntensity = 1.5; }
    if (byName.Head) { const m = byName.Head; m.roughness = 0.08; m.envMapIntensity = 1.2; }
    parts.torchMat = byName.TorchGlow || null;
    if (parts.torchMat) { parts.torchMat.emissive = new THREE.Color(0xffffff); parts.torchMat.emissiveIntensity = 0.3; parts.torchMat.toneMapped = false; }
    parts.sw = root.getObjectByName('Switch');
    parts.swBase = parts.sw?.position.y ?? 0;
    parts.tube1 = root.getObjectByName('Tube1');
    parts.tube2 = root.getObjectByName('Tube2');
    parts.head = root.getObjectByName('Head');
    if (parts.head) parts.base.head = parts.head.position.z;
    root.add(penGroup);
    parts.pen = penGroup;
    stepColors(1);
  }

  function stepColors(k) {
    for (const key in cur) cur[key].lerp(tgt[key], k);
    torchCur.lerp(torchTarget, k);
    bodyMat.color.copy(cur.body);
    frameMat.color.copy(cur.frame);
    logoMat.color.copy(cur.frame).lerp(white, 0.1);
    switchMat.color.copy(cur.sw);
  }

  function update(st, dt, { reduced }) {
    const now = performance.now();
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));
    if (parts.sw) parts.sw.position.y = parts.swBase + SWITCH_STEP * Math.max(-1, Math.min(1, st.sw));
    // шайба: колена растягиваются, голова уезжает от спинки (−Z)
    const e = clamp01(st.ext);
    if (parts.head) parts.head.position.z = parts.base.head - EXT_MM * e * MM;
    if (parts.tube1) parts.tube1.scale.z = BEZEL_H + 0.5 + EXT_MM * 0.5 * e;
    if (parts.tube2) parts.tube2.scale.z = BEZEL_H + 0.5 + EXT_MM * e;
    const p = clamp01(st.pen);
    penGroup.visible = p > 0.005;
    penGroup.position.y = (-HH + 6 - 120 * p) * MM;
    penGroup.rotation.y = p * 0.6;

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
    const fast = screen.mode === 'tube' || screen.mode === 'retina' || screen.mode === 'cpix' || screen.mode === 'hz' || screen.mode === 'lock';
    if (st.screen > 0.02 && now - lastDraw > (fast ? (reduced ? 1000 : 50) : 250)) redraw(now);
  }

  return {
    url: '/models/oy0x5pro.glb?v=26b632c193',
    state: { sw: 0, torch: 0, screen: 1, ext: 0, pen: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap() { stepColors(1); },
    api: {
      setBodyColor(name, instant = false) {
        if (!PRO_COLORS[name] || name === color) return;
        color = name;
        setTargets(name);
        redraw();
        refreshInk(!instant);
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
      // full: полная перерисовка E Ink (чёрный — белый — картинка); для штрихов пера — без неё
      setInk(mode, extra = {}, full = true) {
        const m = INK_MODES.includes(mode) ? mode : 'clock';
        const key = m + JSON.stringify(extra);
        if (key === ink.key) return;
        ink.key = key;
        ink.mode = m;
        ink.extra = extra;
        refreshInk(full);
      },
      inkCanvas: () => inkShow,
      redrawScreen() { redraw(); },
    },
  };
}
