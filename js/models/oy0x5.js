/* =========================================================================
   OY 0X5 — описание 3D-модели: «Два сердца», 150,8 × 71,4 × 6,1 мм.
   Титановая рамка-лента, матовое стекло сзади, островок камер —
   скруглённый треугольник: ○X○ сверху, ромб «плоского перископа» снизу;
   глянцевое стекло на тон темнее спинки. «Рубильник» на левой грани ходит
   на три положения (sw: −1, 0, 1), фонарь на верхней грани (torch).
   Экран CamelOS рисуется на canvas: монитор OY Vitals с двумя
   кардиограммами («Мир» и «Дом»), взлом и «Дефибриллятор», видоискатель
   над амбаром под Парижем (0,5× · 1× · 2× · 5× · 10× и макро), аккумулятор,
   «Только Дом». Процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, roundRect, slab, boxG, cylZ, makeBeam } from './oy0x0.js';

// body — спинка, frame — рамка и кнопки; островок — body на 32 % темнее; ui — акцент на экране; sw — язычок «Рубильника»
export const X5_COLORS = {
  puls: { body: 0xA3202B, frame: 0x4E5157, ui: '#FF5A6A', sw: 0xE8E4DA, label: 'Пульс' },
  night: { body: 0x1C2333, frame: 0x596276, ui: '#7FB8FF', sw: 0xD8343C, label: 'Ночная смена' },
  phosphor: { body: 0xC3D3BE, frame: 0xA3AE9F, ui: '#6CFF9E', sw: 0xD8343C, label: 'Фосфор' },
  coat: { body: 0xE9EAE6, frame: 0xC5C8CC, ui: '#9FD8FF', sw: 0xD8343C, label: 'Халат' },
};
export const SCREEN_MODES = ['off', 'lock', 'vitals', 'attack', 'camera', 'battery', 'heat', 'switch', 'torch'];
export const TORCH_COLORS = { white: 0xFFFFFF, red: 0xFF2A2A };
export const ZOOMS = { '0.5': 0.5, 1: 1, 2: 2, 5: 5, 10: 10, macro: 0 };

// Геометрия, мм — как в blender/build_oy0x5.py
const W = 71.4, H = 150.8, D = 6.1, HH = H / 2, HD = D / 2;
const TOP_Y = HH * MM;
const SCR = { w: W - 3.2, h: H - 3.2 };
const SWITCH_STEP = 0.0032;       // м: ход «Рубильника» между положениями
const ISLAND_DARK = 0.68;         // островок = спинка × 0,68

// цвета кардиограмм: «Мир» — фосфорно-зелёный, «Дом» — голубой
export const WORLD = '#6CFF9E';
export const HOME = '#6CD8FF';
export const ALARM = '#FF4D5E';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pad2 = (n) => String(n).padStart(2, '0');
const sans = (px, wt = 700) => `${wt} ${px}px "Onest", system-ui, sans-serif`;
const mono = (px, wt = 600) => `${wt} ${px}px "JetBrains Mono", ui-monospace, monospace`;

/* ---------- Кардиограмма ---------- */

// Форма одного удара: P-волна, QRS, T-волна. x — фаза 0…1, ответ — −1…1
export function beatShape(x) {
  const g = (c, w, a) => a * Math.exp(-(((x - c) / w) ** 2));
  return g(0.18, 0.035, 0.12) + g(0.3, 0.008, -0.14) + g(0.32, 0.012, 1) + g(0.345, 0.01, -0.32) + g(0.55, 0.06, 0.22);
}
// Сигнал во времени t (с): bpm — частота, chaos — 0…1 фибрилляция, flat — 0…1 прямая
export function ecg(t, { bpm = 72, chaos = 0, flat = 0, seed = 0 } = {}) {
  const ph = (t * bpm) / 60 + seed;
  const base = beatShape(ph - Math.floor(ph));
  const fib = Math.sin(t * 37 + seed) * 0.35 + Math.sin(t * 23.7 + seed * 2) * 0.3 + Math.sin(t * 61 + seed * 3) * 0.18;
  return (base * (1 - chaos) + fib * chaos) * (1 - flat);
}

/* ---------- Картинка: амбар под Парижем на рассвете ---------- */

// Мир нарисован шире кадра: 0,5× показывает больше, 10× — кота на крыше амбара.
// zoom: 0.5 · 1 · 2 · 5 · 10 или 0 — макро (роса на колосе)
export function drawBarn(g, w, h, { t = 0, zoom = 1, accent = '#FF5A6A' } = {}) {
  if (zoom === 0) { drawDew(g, w, h, { t }); return; }
  g.save();
  // центр зума — кот на коньке крыши
  const fx = w * 0.62, fy = h * 0.47;
  g.translate(fx, fy);
  g.scale(zoom, zoom);
  g.translate(-fx, -fy);
  const X0 = -w * 1.2, X1 = w * 2.2;
  const sky = g.createLinearGradient(0, -h * 0.6, 0, h * 0.66);
  sky.addColorStop(0, '#1B2A55');
  sky.addColorStop(0.45, '#6C7FB8');
  sky.addColorStop(0.78, '#F2B39A');
  sky.addColorStop(1, '#FFD9A0');
  g.fillStyle = sky;
  g.fillRect(X0, -h, X1 - X0, h * 1.7);
  // солнце встаёт слева, за тополями
  const sun = g.createRadialGradient(w * 0.18, h * 0.64, 0, w * 0.18, h * 0.64, w * 0.7);
  sun.addColorStop(0, 'rgba(255,240,200,.95)');
  sun.addColorStop(0.12, 'rgba(255,210,150,.5)');
  sun.addColorStop(1, 'rgba(255,190,140,0)');
  g.fillStyle = sun;
  g.fillRect(X0, -h, X1 - X0, h * 2);
  // дальние холмы и тополя
  g.fillStyle = '#8C87A8';
  g.beginPath();
  g.moveTo(X0, h * 0.66);
  for (let x = X0; x <= X1; x += w * 0.05) g.lineTo(x, h * (0.62 + Math.sin(x / w * 5) * 0.012));
  g.lineTo(X1, h * 0.7); g.lineTo(X0, h * 0.7); g.fill();
  g.fillStyle = '#5E5A7A';
  for (let i = 0; i < 9; i++) {
    const px = w * (-0.4 + i * 0.13), ph = h * (0.1 + (i % 3) * 0.02);
    g.beginPath(); g.ellipse(px, h * 0.64 - ph / 2, w * 0.018, ph / 2, 0, 0, Math.PI * 2); g.fill();
  }
  // поле: полосы пшеницы к горизонту
  const field = g.createLinearGradient(0, h * 0.64, 0, h * 1.8);
  field.addColorStop(0, '#C9A267');
  field.addColorStop(0.25, '#9C7A45');
  field.addColorStop(1, '#3A2E1E');
  g.fillStyle = field;
  g.fillRect(X0, h * 0.64, X1 - X0, h * 1.3);
  g.strokeStyle = 'rgba(255,226,170,.22)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    g.beginPath(); g.moveTo(w * 0.55, h * 0.64); g.lineTo(w * (-1 + i * 0.22), h * 1.7); g.stroke();
  }
  // амбар: стены из старых досок, двускатная крыша, ворота с «OY»
  const bx = fx - w * 0.13, bw = w * 0.26, by = h * 0.66, bh = h * 0.12;
  g.fillStyle = '#7A3A2A';
  g.fillRect(bx, by - bh, bw, bh);
  g.strokeStyle = 'rgba(0,0,0,.22)';
  g.lineWidth = 1;
  for (let i = 1; i < 14; i++) { g.beginPath(); g.moveTo(bx + (bw * i) / 14, by - bh); g.lineTo(bx + (bw * i) / 14, by); g.stroke(); }
  g.fillStyle = '#3B2A26';
  g.beginPath();
  g.moveTo(bx - w * 0.015, by - bh); g.lineTo(fx, fy + h * 0.004); g.lineTo(bx + bw + w * 0.015, by - bh); g.fill();
  // ворота
  const dw = bw * 0.34, dh = bh * 0.78;
  g.fillStyle = '#E9DCC6';
  g.fillRect(fx - dw / 2, by - dh, dw, dh);
  g.strokeStyle = '#7A3A2A';
  g.lineWidth = Math.max(1, w * 0.004);
  g.beginPath(); g.moveTo(fx - dw / 2, by - dh); g.lineTo(fx + dw / 2, by); g.moveTo(fx + dw / 2, by - dh); g.lineTo(fx - dw / 2, by); g.stroke();
  // «OY» над воротами — видно с 5×
  g.fillStyle = '#E9DCC6';
  g.font = `800 ${Math.max(3, w * 0.014)}px "JetBrains Mono", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('○X○', fx, by - dh - bh * 0.11);
  // окошко на чердаке светится: там допаивают «Дом»
  const on = 0.6 + 0.4 * Math.sin(t * 2.2);
  g.fillStyle = `rgba(255,214,140,${on})`;
  g.fillRect(fx - w * 0.008, fy + h * 0.025, w * 0.016, h * 0.012);
  // кот на коньке крыши — виден на 10×, хвост качается
  const cs = w * 0.0042;
  g.fillStyle = '#16120F';
  g.beginPath(); g.ellipse(fx, fy - cs * 1.4, cs * 1.5, cs * 1.1, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(fx + cs * 1.1, fy - cs * 2.9, cs * 0.85, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(fx + cs * 0.6, fy - cs * 3.4); g.lineTo(fx + cs * 0.75, fy - cs * 4.3); g.lineTo(fx + cs * 1.15, fy - cs * 3.6); g.fill();
  g.beginPath(); g.moveTo(fx + cs * 1.3, fy - cs * 3.6); g.lineTo(fx + cs * 1.7, fy - cs * 4.3); g.lineTo(fx + cs * 1.85, fy - cs * 3.3); g.fill();
  g.strokeStyle = '#16120F';
  g.lineWidth = cs * 0.45;
  g.lineCap = 'round';
  const sw = Math.sin(t * 1.6) * 0.8;
  g.beginPath(); g.moveTo(fx - cs * 1.3, fy - cs * 1.2); g.quadraticCurveTo(fx - cs * 3, fy - cs * (1 + sw), fx - cs * 2.6, fy - cs * (3.2 + sw)); g.stroke();
  g.fillStyle = '#B8E86A';
  g.beginPath(); g.arc(fx + cs * 1.45, fy - cs * 3, cs * 0.16, 0, Math.PI * 2); g.fill();
  // велосипед у стены — на нём ездили в ABC за советами
  g.strokeStyle = '#2A2220';
  g.lineWidth = Math.max(1, w * 0.002);
  const vx = bx + bw * 0.12, vy = by - h * 0.008, vr = h * 0.009;
  g.beginPath(); g.arc(vx, vy, vr, 0, Math.PI * 2); g.arc(vx + vr * 3, vy, vr, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(vx, vy); g.lineTo(vx + vr * 1.4, vy - vr * 1.6); g.lineTo(vx + vr * 3, vy); g.stroke();
  // птицы
  g.strokeStyle = 'rgba(40,30,50,.6)';
  for (let i = 0; i < 4; i++) {
    const x = w * (0.2 + i * 0.07 + ((t * 0.02) % 0.4)), y = h * (0.3 + (i % 2) * 0.03);
    g.beginPath(); g.moveTo(x - 6, y); g.quadraticCurveTo(x - 3, y - 4, x, y); g.quadraticCurveTo(x + 3, y - 4, x + 6, y); g.stroke();
  }
  g.fillStyle = accent;
  g.fillRect(fx + bw * 0.42, by - bh * 0.5, Math.max(2, w * 0.006), Math.max(2, w * 0.006));
  g.restore();
}

// Макро: капля росы на колосе, в ней перевёрнутый амбар
function drawDew(g, w, h, { t = 0 } = {}) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#E9B98A');
  bg.addColorStop(1, '#6E5A3A');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) {
    const x = ((i * 0.41 + 0.07) % 1) * w, y = ((i * 0.29 + 0.13) % 1) * h;
    const r = w * (0.05 + ((i * 7) % 5) * 0.02);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,236,200,.35)');
    grd.addColorStop(1, 'rgba(255,236,200,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // колос по диагонали
  g.strokeStyle = '#B8883E';
  g.lineWidth = w * 0.02;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(w * 0.05, h * 0.95); g.lineTo(w * 0.8, h * 0.1); g.stroke();
  for (let k = 0; k < 9; k++) {
    const x = w * (0.2 + k * 0.07), y = h * (0.78 - k * 0.075);
    g.fillStyle = k % 2 ? '#D7A957' : '#C8964A';
    g.beginPath(); g.ellipse(x + w * 0.03, y, w * 0.045, w * 0.022, -0.8, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x - w * 0.02, y - h * 0.01, w * 0.045, w * 0.022, -2.2, 0, Math.PI * 2); g.fill();
  }
  // капля
  const cx = w * 0.52, cy = h * 0.5 + Math.sin(t * 0.8) * 2, R = w * 0.17;
  const drop = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
  drop.addColorStop(0, 'rgba(255,255,255,.9)');
  drop.addColorStop(0.3, 'rgba(200,220,255,.35)');
  drop.addColorStop(1, 'rgba(90,70,40,.45)');
  g.fillStyle = drop;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  // перевёрнутый амбар в капле
  g.save();
  g.beginPath(); g.arc(cx, cy, R * 0.92, 0, Math.PI * 2); g.clip();
  g.fillStyle = 'rgba(122,58,42,.8)';
  g.fillRect(cx - R * 0.3, cy + R * 0.05, R * 0.6, R * 0.25);
  g.beginPath(); g.moveTo(cx - R * 0.35, cy + R * 0.3); g.lineTo(cx, cy + R * 0.55); g.lineTo(cx + R * 0.35, cy + R * 0.3); g.fillStyle = 'rgba(59,42,38,.8)'; g.fill();
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,.7)';
  g.lineWidth = w * 0.006;
  g.beginPath(); g.arc(cx, cy, R * 0.8, -2.6, -1.9); g.stroke();
}

/* ---------- Экран телефона ---------- */

const ZOOM_LABEL = { '0.5': '0,5× · сверхширокая 50 Мп', 1: '1× · 200 Мп · 24 мм', 2: '2× · 50 Мп из центра', 5: '5× · перископ 50 Мп · 120 мм', 10: '10× · из центра перископа', macro: 'МАКРО · 2 см · сверхширокая' };

// Трасса кардиограммы на экране: окно в 3 секунды, стирающая полоса бежит слева направо
function trace(g, x, y, w, h, t, opts, color) {
  const span = 3;
  const head = (t % span) / span;
  g.lineWidth = 4;
  g.lineJoin = 'round';
  g.strokeStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 12;
  g.beginPath();
  const N = 180;
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    if (Math.abs(f - head) < 0.03) { g.stroke(); g.beginPath(); continue; }
    const tt = t - (head - f + (f > head ? 1 : 0)) * span;
    const v = ecg(tt, opts);
    const px = x + f * w, py = y + h / 2 - v * h * 0.42;
    if (i === 0 || Math.abs(f - head) < 0.04) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.stroke();
  g.shadowBlur = 0;
}

export function drawScreen(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const now = st.now ?? performance.now();
  const t = now / 1000;
  const ui = st.ui || '#FF5A6A';
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  if (mode === 'off') return;
  g.textBaseline = 'middle';
  g.textAlign = 'center';

  const statusBar = (pct = st.pct ?? 81) => {
    g.font = mono(22, 600);
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.textAlign = 'left';
    g.fillText('CamelOS 2.5 · Vitals', 44, 58);
    g.textAlign = 'right';
    const sw = st.sw === 1 ? 'эфир выкл' : st.sw === -1 ? 'только дом' : 'FM3 · 5G';
    g.fillText(`${sw} · ${Math.round(pct)} %`, w - 44, 58);
    g.textAlign = 'center';
  };
  const dark = () => { g.fillStyle = '#04080A'; g.fillRect(0, 0, w, h); statusBar(); };
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
  const grid = () => {
    g.strokeStyle = 'rgba(108,255,158,.07)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  };
  // панель сердца: имя, цифры и кардиограмма
  const heart = (y, name, color, opts, nums, dead = false) => {
    roundRect(g, 40, y, w - 80, h * 0.3, 28);
    g.fillStyle = 'rgba(255,255,255,.04)';
    g.fill();
    g.textAlign = 'left';
    g.font = mono(26, 700);
    g.fillStyle = color;
    g.fillText(name, 72, y + 46);
    g.textAlign = 'right';
    g.font = mono(22, 600);
    g.fillStyle = 'rgba(244,246,255,.7)';
    g.fillText(nums, w - 72, y + 46);
    g.textAlign = 'center';
    if (dead) {
      g.strokeStyle = 'rgba(244,246,255,.25)';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(70, y + h * 0.17); g.lineTo(w - 70, y + h * 0.17); g.stroke();
      g.font = mono(24, 700);
      g.fillStyle = 'rgba(244,246,255,.45)';
      g.fillText('обесточен', w / 2, y + h * 0.24);
      return;
    }
    trace(g, 60, y + 80, w - 120, h * 0.18, t, opts, color);
  };

  if (mode === 'lock') {
    drawBarn(g, w, h, { t, accent: ui });
    g.fillStyle = 'rgba(0,0,0,.18)';
    g.fillRect(0, 0, w, h);
    statusBar();
    const d = new Date();
    g.fillStyle = '#F4F6FF';
    g.font = sans(190, 700);
    g.fillText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, w / 2, h * 0.2);
    g.font = sans(30, 500);
    g.fillStyle = 'rgba(244,246,255,.82)';
    g.fillText('Амбар · под Парижем · рассвет', w / 2, h * 0.28);
    // две маленькие кардиограммы внизу: сердца бьются
    g.save();
    g.globalAlpha = 0.9;
    trace(g, 70, h * 0.82, w - 140, 60, t, { bpm: 72 }, WORLD);
    trace(g, 70, h * 0.88, w - 140, 60, t, { bpm: 58, seed: 0.4 }, HOME);
    g.restore();
    return;
  }

  if (mode === 'vitals' || mode === 'attack' || mode === 'switch') {
    dark();
    grid();
    const hack = mode === 'attack' ? clamp01(st.hack ?? 0) : 0;
    const clamp = mode === 'attack' ? clamp01(st.clamp ?? 0) : 0;
    const only = mode === 'switch' && st.sw === -1;
    const air = mode === 'switch' && st.sw === 1;
    if (mode === 'switch') title('«Рубильник»', only ? '«Только Дом»: «Мир» обесточен' : air ? '«Эфир»: без связи и геолокации' : 'всё включено', 0.12);
    else if (hack > 0.5 && clamp < 0.5) title('Тревога: «Мир»', 'Tesseract 5 пережимает «Аорту»', 0.12);
    else if (clamp > 0.5) title('«Клапан» закрыт', '«Дом» цел · «Мир» перезапускается', 0.12);
    else title('OY Vitals', 'два сердца · GP30 Duo', 0.12);
    const worldColor = hack > 0.3 ? ALARM : WORLD;
    heart(h * 0.24, 'МИР · GP30', worldColor, { bpm: 72 + hack * 60, chaos: hack, flat: (st.restart ?? 0) }, hack > 0.3 ? '?? ГГц · 51 °C' : air ? 'без радио · 34 °C' : '3,9 ГГц · 36 °C', only);
    heart(h * 0.58, 'ДОМ · GP30', HOME, { bpm: 58, seed: 0.4 }, '2,1 ГГц · 31 °C');
    // «Аорта» между сердцами
    const ax = w / 2, ay0 = h * 0.54, ay1 = h * 0.58;
    g.strokeStyle = clamp > 0.5 || only ? ALARM : 'rgba(244,246,255,.5)';
    g.lineWidth = 6;
    g.setLineDash(clamp > 0.5 || only ? [6, 10] : []);
    g.beginPath(); g.moveTo(ax, ay0); g.lineTo(ax, ay1); g.stroke();
    g.setLineDash([]);
    g.font = mono(20, 700);
    g.fillStyle = 'rgba(244,246,255,.6)';
    g.fillText(clamp > 0.5 || only ? 'аорта · закрыта' : 'аорта · только шифр', w / 2, h * 0.925);
    return;
  }

  if (mode === 'camera') {
    const zk = String(st.zoom ?? 1);
    drawBarn(g, w, h, { t, accent: ui, zoom: ZOOMS[zk] ?? 1 });
    g.strokeStyle = 'rgba(255,255,255,.28)';
    g.lineWidth = 2;
    for (const k of [1 / 3, 2 / 3]) {
      g.beginPath(); g.moveTo(w * k, 0); g.lineTo(w * k, h); g.stroke();
      g.beginPath(); g.moveTo(0, h * k); g.lineTo(w, h * k); g.stroke();
    }
    statusBar();
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.fillRect(0, h * 0.8, w, h * 0.2);
    const keys = ['0.5', '1', '2', '5', '10'];
    keys.forEach((k, i) => {
      const x = w * (0.18 + i * 0.16), y = h * 0.835;
      g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2);
      g.fillStyle = k === zk ? ui : 'rgba(255,255,255,.14)';
      g.fill();
      g.font = mono(22, 700);
      g.fillStyle = k === zk ? '#07080C' : '#F4F6FF';
      g.fillText(k === '0.5' ? ',5' : `${k}×`, x, y);
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
    title(`${Math.round(pct)} %`, st.clock ? `${st.clock} · ${st.profile || 'обычный день'}` : '4400 мАч', 0.2);
    const bx = w * 0.3, by = h * 0.36, bw = w * 0.4, bh = h * 0.34;
    roundRect(g, bx, by, bw, bh, 40);
    g.strokeStyle = 'rgba(244,246,255,.5)';
    g.lineWidth = 6;
    g.stroke();
    const fh = (bh - 28) * clamp01(pct / 100);
    roundRect(g, bx + 14, by + bh - 14 - fh, bw - 28, Math.max(fh, 1), 28);
    g.fillStyle = pct < 15 ? ALARM : ui;
    g.fill();
    g.font = mono(24, 600);
    g.fillStyle = 'rgba(244,246,255,.7)';
    g.fillText('4400 мАч · два сердца на одной ячейке', w / 2, h * 0.76);
    return;
  }

  if (mode === 'heat') {
    dark();
    const two = st.two ?? true;
    const min = st.min ?? 20;
    title(`${Math.round(min)} мин игры`, two ? '«Эстафета» · два сердца' : 'одно сердце', 0.14);
    // силуэт платы с двумя пятнами тепла
    const px = w * 0.22, py = h * 0.27, pw = w * 0.56, ph = h * 0.56;
    roundRect(g, px, py, pw, ph, 40);
    g.fillStyle = '#0B1014';
    g.fill();
    const blob = (cx, cy, k) => {
      const r = pw * (0.3 + k * 0.5);
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0, `rgba(255,${Math.round(200 - k * 150)},80,${0.3 + k * 0.6})`);
      grd.addColorStop(1, 'rgba(255,80,60,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    };
    const k = clamp01(min / 20);
    g.save();
    roundRect(g, px, py, pw, ph, 40);
    g.clip();
    if (two) { blob(px + pw / 2, py + ph * 0.18, k * 0.55); blob(px + pw / 2, py + ph * 0.86, k * 0.45); }
    else blob(px + pw / 2, py + ph * 0.18, k);
    g.restore();
    g.font = mono(26, 700);
    g.fillStyle = '#F4F6FF';
    g.fillText(`${two ? Math.round(100 - k * 6) : Math.round(100 - k * 19)} % пика`, w / 2, h * 0.88);
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
    title('Сигнальный фонарь', st.torchMode || 'до 4500 м', 0.42);
  }
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const std = (name, color, o = {}) => new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.45, ...o });
  const mats = {
    Body: std('Body', X5_COLORS.puls.body, { roughness: 0.5 }),
    Island: std('Island', X5_COLORS.puls.body, { roughness: 0.12, clearcoat: 1 }),
    Frame: std('Frame', X5_COLORS.puls.frame, { metalness: 1, roughness: 0.28 }),
    Lens: std('Lens', 0x020306, { roughness: 0.05, clearcoat: 1 }),
    LensChrome: std('LensChrome', 0x8D9197, { metalness: 1, roughness: 0.2 }),
    Screen: std('Screen', 0x020203),
    Glass: std('Glass', 0x030304, { roughness: 0.05, clearcoat: 1 }),
    Switch: std('Switch', X5_COLORS.puls.sw, { metalness: 0.3, roughness: 0.34 }),
    TorchGlow: std('TorchGlow', 0xEDEDED, { emissive: 0xFFFFFF, emissiveIntensity: 0.4 }),
  };
  const root = new THREE.Group();
  root.name = 'OY0X5';
  const add = (geo, mat, x = 0, y = 0, z = 0, name) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    root.add(m);
    return m;
  };
  // +Z — экран, −Z — спинка; островок со спины слева, то есть +X
  add(slab(W, H, 12.2, 5.1, 0.7, 12), 'Frame', 0, 0, 0, 'Frame');
  add(slab(W - 1.4, H - 1.4, 11.5, 0.5, 0.2, 12), 'Body', 0, 0, -HD + 0.25, 'Body');
  add(slab(W - 1.4, H - 1.4, 11.5, 0.5, 0.2, 12), 'Glass', 0, 0, HD - 0.25, 'Glass');
  const scr = new THREE.PlaneGeometry(SCR.w * MM, SCR.h * MM);
  const uv = scr.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - uv.getY(i));
  add(scr, 'Screen', 0, 0, HD + 0.02, 'Screen');
  const ix = 5, iz = 54.9;
  add(slab(40, 24, 10, 1.7, 0.8, 12), 'Island', ix, iz - 3, -HD - 0.85, 'Island');
  for (const dx of [-10.2, 10.2]) {
    add(cylZ(7.2, 0.4), 'LensChrome', ix + dx, iz, -HD - 1.8);
    add(cylZ(5.3, 0.5), 'Lens', ix + dx, iz, -HD - 1.9);
  }
  const peri = add(boxG(6, 6, 0.5), 'Lens', ix, iz - 17.2, -HD - 1.9);
  peri.rotation.z = Math.PI / 4;
  add(boxG(0.6, 5.4, 1.8), 'Switch', -W / 2 - 0.25, HH - 40, 0, 'Switch');
  add(boxG(9, 0.4, 1.9), 'TorchGlow', 0, HH + 0.1, 0, 'Torch');
  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X5({ phone, scale, isRunning }) {
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

  const bodyMat = new THREE.MeshPhysicalMaterial({ name: 'Body', color: X5_COLORS.puls.body, metalness: 0, roughness: 0.5, clearcoat: 0.06, clearcoatRoughness: 0.3, envMapIntensity: 0.6 });
  const islandMat = new THREE.MeshPhysicalMaterial({ name: 'Island', color: X5_COLORS.puls.body, metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 });
  const frameMat = new THREE.MeshStandardMaterial({ name: 'Frame', color: X5_COLORS.puls.frame, metalness: 1, roughness: 0.28, envMapIntensity: 1.15 });
  const logoMat = new THREE.MeshStandardMaterial({ name: 'Logo', color: X5_COLORS.puls.frame, metalness: 1, roughness: 0.16, envMapIntensity: 1.4 });
  const switchMat = new THREE.MeshStandardMaterial({ name: 'Switch', color: X5_COLORS.puls.sw, metalness: 0.3, roughness: 0.34 });

  let color = 'puls';
  const tgt = { body: new THREE.Color(), frame: new THREE.Color(), sw: new THREE.Color() };
  const cur = { body: new THREE.Color(), frame: new THREE.Color(), sw: new THREE.Color() };
  function setTargets(name) {
    tgt.body.setHex(X5_COLORS[name].body);
    tgt.frame.setHex(X5_COLORS[name].frame);
    tgt.sw.setHex(X5_COLORS[name].sw);
  }
  setTargets(color);
  for (const k in cur) cur[k].copy(tgt[k]);

  const screen = { mode: 'lock', zoom: '1', sw: 0 };
  let lastDraw = 0;
  function redraw(now = performance.now()) {
    drawScreen(scrCanvas, screen.mode, { ...screen, now, ui: X5_COLORS[color].ui });
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
          case 'Switch': return switchMat;
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
    switchMat.color.copy(cur.sw);
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
    // кардиограммы на экране живые — перерисовка часто, остальное реже
    const fast = screen.mode === 'camera' || screen.mode === 'vitals' || screen.mode === 'attack' || screen.mode === 'switch' || screen.mode === 'lock';
    if (st.screen > 0.02 && now - lastDraw > (fast ? (reduced ? 1000 : 50) : 250)) redraw(now);
  }

  return {
    url: '/models/oy0x5.glb?v=8f2080c534',
    state: { sw: 0, torch: 0, screen: 1 },
    parts,
    setup,
    buildFallback,
    update,
    snap() { stepColors(1); },
    api: {
      setBodyColor(name, instant = false) {
        if (!X5_COLORS[name] || name === color) return;
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
