/* =========================================================================
   OY 0X5 Essential — описание 3D-модели: «Из одного куска»,
   156,4 × 75,2 × 7,6 мм. Корпус — цельный алюминий: спинка и грани одна
   деталь. «Шов» — разомкнутая петля под камерами, залитая цветным полимером,
   не геометрия, а текстура по плоской UV-развёртке спинки. Шов
   светится цветом полимера, а при seam: 0…1 по петле бежит ток резонатора.
   Две камеры в горизонтальной «пилюле», «Рубильник» на левой грани
   (sw: −1, 0, 1), фонарь на верхней грани (torch). Экран CamelOS рисуется
   на canvas: заставка, «Резонанс», «Пломба», Cesium 5, видоискатель над
   цехом в Тулузе (1× · 2× · «Портрет»), «Рубильник», фонарь.
   Процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, roundRect, slab, boxG, cylZ, makeBeam } from './oy0x0.js';

// body — корпус; metal/rough/coat — анод или лак; ui — акцент на экране и на странице; sw — язычок «Рубильника»;
// seam — полимер в «Шве»: всегда контрастный к аноду
export const E5_COLORS = {
  blank: { body: 0xC9CCCF, metal: 1, rough: 0.4, coat: 0, ui: '#1F4FD8', sw: 0xC8102E, seam: '#1F4FD8', label: 'Заготовка' },
  anod: { body: 0x2F4F86, metal: 1, rough: 0.36, coat: 0, ui: '#6F9BFF', sw: 0xE8E4DA, seam: '#F2C14E', label: 'Анод' },
  chips: { body: 0xD6C3A2, metal: 1, rough: 0.38, coat: 0, ui: '#B5782A', sw: 0xC8102E, seam: '#2B2F35', label: 'Стружка' },
  signal: { body: 0xB3202A, metal: 1, rough: 0.36, coat: 0, ui: '#E0313D', sw: 0xE8E4DA, seam: '#F4F1EA', label: 'Сигнальный' },
  lacquer: { body: 0x141517, metal: 0.35, rough: 0.07, coat: 1, ui: '#3E434A', sw: 0xC8102E, seam: '#E0313D', label: 'Чёрный лак' },
};
export const SCREEN_MODES = ['off', 'lock', 'charge', 'chip', 'seal', 'camera', 'switch', 'torch'];
export const TORCH_COLORS = { white: 0xFFFFFF, red: 0xFF2A2A };

// Геометрия, мм — как в blender/build_oy0x5e.py
const W = 75.2, H = 156.4, D = 7.6, HH = H / 2, HD = D / 2;
const TOP_Y = HH * MM;
const SCR = { w: W - 4.4, h: H - 4.4 };
const SWITCH_STEP = 0.003;        // м: ход «Рубильника» между положениями

// «Шов» — один разрез 0,4 мм петлёй по спинке, под «пилюлей», с разрывом 12 мм внизу:
// разомкнутое кольцо — резонатор на 6,78 МГц, две его стороны — антенны. Концы разрыва — контакты
export const SEAM_LOOP = { x: 31, top: 54, bottom: -70.4, r: 9, gap: 12, pad: 1.5 };
const SEAM_W = 0.4;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const pad2 = (n) => String(n).padStart(2, '0');
const sans = (px, wt = 700) => `${wt} ${px}px "Onest", system-ui, sans-serif`;
const mono = (px, wt = 600) => `${wt} ${px}px "JetBrains Mono", ui-monospace, monospace`;

/* ---------- Картинка: цех в Тулузе, утро ---------- */

// На верстаке — кружка с ○X○ и только что снятый со станка корпус; за ними окна цеха и станок.
// zoom: 1 или 2; portrait 0…1 — размытие фона по глубине от двух камер
const bgCache = { w: 0, h: 0, cv: null };
function drawShopBack(g, w, h, t) {
  // окна в переплёте, утренний свет
  const wall = g.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#8E969E');
  wall.addColorStop(1, '#5E646A');
  g.fillStyle = wall;
  g.fillRect(0, 0, w, h);
  const cols = 6;
  for (let i = 0; i < cols; i++) {
    const x = w * (0.04 + i * 0.16), y = h * 0.06, ww = w * 0.13, hh = h * 0.42;
    const sky = g.createLinearGradient(0, y, 0, y + hh);
    sky.addColorStop(0, '#F6E7C8');
    sky.addColorStop(1, '#DCE6EE');
    g.fillStyle = sky;
    g.fillRect(x, y, ww, hh);
    g.strokeStyle = '#3B4046';
    g.lineWidth = Math.max(2, w * 0.006);
    g.strokeRect(x, y, ww, hh);
    g.beginPath();
    for (let k = 1; k < 3; k++) { g.moveTo(x + (ww * k) / 3, y); g.lineTo(x + (ww * k) / 3, y + hh); }
    for (let k = 1; k < 4; k++) { g.moveTo(x, y + (hh * k) / 4); g.lineTo(x + ww, y + (hh * k) / 4); }
    g.stroke();
  }
  // лучи света из окон
  g.save();
  g.globalCompositeOperation = 'screen';
  for (let i = 0; i < cols; i++) {
    const x = w * (0.04 + i * 0.16);
    const grd = g.createLinearGradient(x, h * 0.1, x + w * 0.2, h * 0.9);
    grd.addColorStop(0, 'rgba(255,236,200,.22)');
    grd.addColorStop(1, 'rgba(255,236,200,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x, h * 0.48); g.lineTo(x + w * 0.13, h * 0.48); g.lineTo(x + w * 0.34, h); g.lineTo(x + w * 0.16, h);
    g.fill();
  }
  g.restore();
  // станок: серый короб с окном и шпинделем
  const mx = w * 0.58, my = h * 0.3, mw = w * 0.36, mh = h * 0.52;
  g.fillStyle = '#D8DADC';
  g.fillRect(mx, my, mw, mh);
  g.fillStyle = '#2B3036';
  g.fillRect(mx + mw * 0.1, my + mh * 0.14, mw * 0.56, mh * 0.5);
  g.fillStyle = '#C8102E';
  g.fillRect(mx + mw * 0.74, my + mh * 0.2, mw * 0.14, mh * 0.08);
  g.fillStyle = '#9EA4AA';
  g.fillRect(mx + mw * 0.34, my + mh * 0.14, mw * 0.08, mh * 0.22);
  // искры стружки за стеклом
  g.fillStyle = 'rgba(255,230,180,.85)';
  for (let i = 0; i < 18; i++) {
    const a = (i * 2.4 + t * 3) % (Math.PI * 2);
    const r = mh * (0.05 + ((i * 37) % 11) / 90);
    g.fillRect(mx + mw * 0.38 + Math.cos(a) * r, my + mh * 0.45 + Math.sin(a) * r * 0.6, 3, 3);
  }
  g.font = `800 ${Math.max(8, w * 0.022)}px "JetBrains Mono", monospace`;
  g.fillStyle = '#3B4046';
  g.textAlign = 'left';
  g.fillText('OY · ТУЛУЗА · ОП 010', mx + mw * 0.1, my + mh * 0.82);
  // стеллаж с брусками
  g.fillStyle = '#41474D';
  g.fillRect(w * 0.02, h * 0.56, w * 0.34, h * 0.02);
  g.fillRect(w * 0.02, h * 0.68, w * 0.34, h * 0.02);
  for (let i = 0; i < 7; i++) {
    const bx = w * (0.03 + i * 0.047);
    const grd = g.createLinearGradient(bx, 0, bx + w * 0.04, 0);
    grd.addColorStop(0, '#B9BEC3'); grd.addColorStop(0.5, '#ECEFF1'); grd.addColorStop(1, '#A9AEB3');
    g.fillStyle = grd;
    g.fillRect(bx, h * 0.5, w * 0.04, h * 0.06);
    g.fillRect(bx, h * 0.62, w * 0.04, h * 0.06);
  }
}
function drawShopFront(g, w, h, t, accent) {
  // верстак
  const bench = g.createLinearGradient(0, h * 0.74, 0, h);
  bench.addColorStop(0, '#9A7A55');
  bench.addColorStop(1, '#5E4630');
  g.fillStyle = bench;
  g.fillRect(0, h * 0.74, w, h * 0.26);
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.fillRect(0, h * 0.74, w, h * 0.012);
  // корпус 0X5 Essential, только что со станка: блестящий, с пилюлей
  const px = w * 0.28, py = h * 0.4, pw = w * 0.13, ph = h * 0.36;
  const al = g.createLinearGradient(px, 0, px + pw, 0);
  al.addColorStop(0, '#9FA5AB'); al.addColorStop(0.35, '#F2F4F6'); al.addColorStop(0.7, '#C9CDD1'); al.addColorStop(1, '#8B9197');
  g.fillStyle = al;
  roundRect(g, px, py, pw, ph, pw * 0.2);
  g.fill();
  g.fillStyle = 'rgba(40,44,50,.55)';
  roundRect(g, px + pw * 0.08, py + ph * 0.04, pw * 0.5, ph * 0.09, ph * 0.045);
  g.fill();
  // «Шов» петлёй — синим полимером
  g.strokeStyle = accent;
  g.lineWidth = Math.max(1, w * 0.003); roundRect(g, px + pw * 0.08, py + ph * 0.17, pw * 0.84, ph * 0.76, pw * 0.1); g.stroke();
  // кружка с ○X○ и пар
  const cx = w * 0.56, cy = h * 0.52, cw = w * 0.16, ch = h * 0.24;
  g.fillStyle = '#F3F1EC';
  roundRect(g, cx, cy, cw, ch, cw * 0.08);
  g.fill();
  g.strokeStyle = '#F3F1EC';
  g.lineWidth = cw * 0.09;
  g.beginPath(); g.arc(cx + cw * 1.02, cy + ch * 0.45, ch * 0.18, -Math.PI / 2, Math.PI / 2); g.stroke();
  g.strokeStyle = accent;
  g.lineWidth = Math.max(2, cw * 0.035);
  const ly = cy + ch * 0.45, r = cw * 0.11;
  g.beginPath(); g.arc(cx + cw * 0.24, ly, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(cx + cw * 0.76, ly, r, 0, Math.PI * 2); g.stroke();
  g.beginPath();
  g.moveTo(cx + cw * 0.43, ly - r * 0.7); g.lineTo(cx + cw * 0.57, ly + r * 0.7);
  g.moveTo(cx + cw * 0.57, ly - r * 0.7); g.lineTo(cx + cw * 0.43, ly + r * 0.7);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.5)';
  g.lineWidth = Math.max(2, w * 0.006);
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    for (let k = 0; k <= 20; k++) {
      const yy = cy - k * h * 0.008;
      const xx = cx + cw * (0.3 + i * 0.2) + Math.sin(k * 0.6 + t * 2 + i) * w * 0.01;
      if (k) g.lineTo(xx, yy); else g.moveTo(xx, yy);
    }
    g.stroke();
  }
}
export function drawShop(g, w, h, { t = 0, zoom = 1, portrait = 0, accent = '#1F4FD8' } = {}) {
  if (bgCache.w !== w || bgCache.h !== h) {
    bgCache.cv = bgCache.cv || document.createElement('canvas');
    bgCache.cv.width = w; bgCache.cv.height = h;
    bgCache.w = w; bgCache.h = h;
  }
  const bg = bgCache.cv.getContext('2d');
  bg.clearRect(0, 0, w, h);
  drawShopBack(bg, w, h, t);
  g.save();
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  // центр зума — кружка
  const fx = w * 0.56, fy = h * 0.6;
  g.translate(fx, fy);
  g.scale(zoom, zoom);
  g.translate(-fx, -fy);
  const blur = portrait * Math.max(4, w * 0.012) / zoom;
  if (blur > 0.3 && 'filter' in g) g.filter = `blur(${blur.toFixed(1)}px)`;
  g.drawImage(bgCache.cv, 0, 0);
  g.filter = 'none';
  drawShopFront(g, w, h, t, accent);
  g.restore();
}

/* ---------- Экран CamelOS ---------- */

export function drawScreen(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const now = st.now ?? performance.now();
  const t = now / 1000;
  const ui = st.ui || '#1F4FD8';
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  if (mode === 'off') return;
  g.textBaseline = 'middle';
  g.textAlign = 'center';

  const paper = '#ECEEEF';
  const ink = '#15171A';
  const statusBar = (light = true) => {
    g.font = mono(22, 600);
    g.fillStyle = light ? 'rgba(21,23,26,.75)' : 'rgba(255,255,255,.85)';
    g.textAlign = 'left';
    g.fillText('CamelOS 2.5 · OY', 44, 58);
    g.textAlign = 'right';
    const sw = st.sw === 1 ? 'эфир выкл' : st.sw === -1 ? 'тишина' : 'NC5 · 5G';
    g.fillText(`${sw} · ${Math.round(st.pct ?? 72)} %`, w - 44, 58);
    g.textAlign = 'center';
  };
  const brushed = () => {
    g.fillStyle = paper;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.035)';
    g.lineWidth = 1;
    for (let y = 0; y < h; y += 3) { g.beginPath(); g.moveTo(0, y + (y % 7) * 0.1); g.lineTo(w, y); g.stroke(); }
  };
  const fit = (text, y, font, px, color) => {
    let size = px;
    g.font = font(size);
    while (size > 12 && g.measureText(text).width > w - 100) { size -= 1; g.font = font(size); }
    g.fillStyle = color;
    g.fillText(text, w / 2, y);
  };
  const title = (a, b, y = 0.16, color = ink) => {
    fit(a, h * y, (px) => sans(px, 760), 54, color);
    if (b) fit(b, h * (y + 0.055), (px) => mono(px, 600), 26, ui);
  };
  const card = (y, hh) => {
    roundRect(g, 40, y, w - 80, hh, 30);
    g.fillStyle = 'rgba(255,255,255,.72)';
    g.fill();
    g.strokeStyle = 'rgba(21,23,26,.1)';
    g.lineWidth = 2;
    g.stroke();
  };

  if (mode === 'lock') {
    brushed();
    statusBar();
    const d = new Date(now);
    g.font = sans(150, 300);
    g.fillStyle = ink;
    g.fillText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, w / 2, h * 0.2);
    g.font = mono(24, 600);
    g.fillStyle = 'rgba(21,23,26,.6)';
    g.fillText('ОП 120 · ГОТОВО', w / 2, h * 0.28);
    // ○X○ во всю ширину, как клеймо
    g.strokeStyle = ui;
    g.lineWidth = 10;
    const cy = h * 0.52, r = w * 0.13;
    g.beginPath(); g.arc(w * 0.26, cy, r, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(w * 0.74, cy, r, 0, Math.PI * 2); g.stroke();
    g.beginPath();
    g.moveTo(w * 0.44, cy - r * 0.6); g.lineTo(w * 0.56, cy + r * 0.6);
    g.moveTo(w * 0.56, cy - r * 0.6); g.lineTo(w * 0.44, cy + r * 0.6);
    g.stroke();
    title('Из одного куска.', '0X5 Essential · 186 г', 0.72);
    g.font = mono(20, 600);
    g.fillStyle = 'rgba(21,23,26,.45)';
    g.fillText('Пломба цела · Palladium 5', w / 2, h * 0.92);
    return;
  }

  if (mode === 'charge') {
    brushed();
    statusBar();
    const watts = st.watts ?? 20;
    const on = watts > 0.4;
    title(on ? 'Резонанс' : 'Нет заряда', on ? `6,78 МГц · ${watts.toFixed(0)} Вт` : (st.hot ? 'металл греется' : 'плиты не видно'), 0.14);
    // кольца поля от плиты
    const cx = w / 2, cy = h * 0.5;
    for (let i = 0; i < 5; i++) {
      const k = ((t * 0.6 + i / 5) % 1);
      g.strokeStyle = on ? ui : 'rgba(21,23,26,.15)';
      g.globalAlpha = on ? (1 - k) * 0.8 : 0.4;
      g.lineWidth = 6;
      g.beginPath(); g.arc(cx, cy, w * (0.1 + k * 0.32), 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
    const pct = Math.round(st.pct ?? 72);
    g.font = sans(120, 300);
    g.fillStyle = ink;
    g.fillText(`${pct}`, cx, cy - 10);
    g.font = mono(24, 700);
    g.fillStyle = 'rgba(21,23,26,.55)';
    g.fillText('%', cx, cy + 70);
    card(h * 0.74, h * 0.16);
    g.font = mono(22, 600);
    g.fillStyle = 'rgba(21,23,26,.7)';
    g.fillText(st.gap ? `до плиты ${st.gap} мм · ${st.through || 'воздух'}` : 'вплотную к плите', w / 2, h * 0.79);
    g.fillText(on ? 'ток идёт по «Шву» · сквозь металл' : 'индукция гаснет в алюминии', w / 2, h * 0.85);
    return;
  }

  if (mode === 'chip') {
    brushed();
    statusBar();
    title('Cesium 5', '3 нм · 8 ядер · NC5', 0.13);
    // кристалл: восемь ядер, графика, нейроядро, модем, Palladium 5 рядом
    const x0 = 70, y0 = h * 0.24, cw = w - 140, chh = h * 0.42;
    g.fillStyle = '#23272C';
    roundRect(g, x0, y0, cw, chh, 18);
    g.fill();
    const block = (x, y, bw, bh, label, color, pulse = 0) => {
      roundRect(g, x0 + x * cw, y0 + y * chh, bw * cw, bh * chh, 10);
      g.fillStyle = color;
      g.globalAlpha = 0.75 + 0.25 * pulse;
      g.fill();
      g.globalAlpha = 1;
      g.font = mono(18, 700);
      g.fillStyle = 'rgba(255,255,255,.92)';
      g.fillText(label, x0 + (x + bw / 2) * cw, y0 + (y + bh / 2) * chh);
    };
    const p = (k) => 0.5 + 0.5 * Math.sin(t * 3 + k);
    block(0.05, 0.06, 0.2, 0.26, '3,8', ui, p(0));
    for (let i = 0; i < 3; i++) block(0.28 + i * 0.13, 0.06, 0.11, 0.26, '3,2', '#4A5361', p(i + 1));
    for (let i = 0; i < 4; i++) block(0.05 + i * 0.11, 0.36, 0.09, 0.2, '2,1', '#39414C', p(i + 4));
    block(0.5, 0.36, 0.45, 0.2, 'ГРАФИКА · 6', '#5A4A7A', p(9));
    block(0.05, 0.62, 0.42, 0.32, 'НЕЙРО · 40 TOPS', '#3E5A4C', p(10));
    block(0.5, 0.62, 0.22, 0.32, 'NC5', '#6A4F2E', p(11));
    block(0.75, 0.62, 0.2, 0.32, 'Pd 5', '#8A2F3A', 1);
    card(h * 0.71, h * 0.2);
    g.font = mono(24, 700);
    g.fillStyle = ink;
    g.fillText('AnTuTu 11 · 1 862 400', w / 2, h * 0.76);
    g.font = mono(20, 600);
    g.fillStyle = 'rgba(21,23,26,.6)';
    g.fillText('в 1,8 раза быстрее Cesium 1', w / 2, h * 0.81);
    g.fillText('тепло уходит в корпус', w / 2, h * 0.86);
    return;
  }

  if (mode === 'seal') {
    const opened = st.opened;
    g.fillStyle = opened ? '#1A0E10' : paper;
    g.fillRect(0, 0, w, h);
    statusBar(!opened);
    // нить «Пломбы» по периметру экрана
    g.strokeStyle = opened ? '#FF4D5E' : ui;
    g.lineWidth = 8;
    g.setLineDash(opened ? [40, 26] : []);
    roundRect(g, 34, 34, w - 68, h - 68, 70);
    g.stroke();
    g.setLineDash([]);
    if (opened) {
      title('Корпус вскрывали', st.when || '14.03.2033 · 22:41', 0.3, '#FFE9EC');
      g.font = mono(22, 600);
      g.fillStyle = 'rgba(255,233,236,.75)';
      g.fillText('нить «Пломбы» порвана', w / 2, h * 0.48);
      g.fillText('ключи Palladium 5 на месте', w / 2, h * 0.53);
      g.fillText('решать вам: доверять или нет', w / 2, h * 0.58);
    } else {
      title('Пломба цела', 'Palladium 5 · с завода', 0.3);
      g.font = mono(22, 600);
      g.fillStyle = 'rgba(21,23,26,.6)';
      g.fillText('ни одного винта снаружи', w / 2, h * 0.48);
      g.fillText('экран на клею с нитью', w / 2, h * 0.53);
      g.fillText('вскрытий: 0', w / 2, h * 0.58);
    }
    return;
  }

  if (mode === 'camera') {
    const zoom = st.zoom === '2' || st.zoom === 'portrait' ? 2 : 1;
    const portrait = st.zoom === 'portrait' ? 1 : 0;
    drawShop(g, w, h, { t, zoom, portrait, accent: ui });
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(0, 0, w, 96);
    g.fillRect(0, h - 170, w, 170);
    statusBar(false);
    g.font = mono(24, 700);
    g.fillStyle = '#FFF';
    g.fillText(portrait ? 'ПОРТРЕТ · 2×' : zoom === 2 ? '2× · ТЕЛЕВИК' : '1× · ОСНОВНАЯ', w / 2, h - 120);
    g.strokeStyle = '#FFF';
    g.lineWidth = 6;
    g.beginPath(); g.arc(w / 2, h - 60, 34, 0, Math.PI * 2); g.stroke();
    return;
  }

  if (mode === 'switch') {
    brushed();
    statusBar();
    const sw = st.sw ?? 0;
    title('Рубильник', sw === 1 ? 'вверх · «Эфир»' : sw === -1 ? 'вниз · «Тишина»' : 'середина · всё включено', 0.14);
    const rows = [['Связь', sw !== 0], ['Геолокация', sw !== 0], ['Камеры', sw === -1], ['Микрофоны', sw === -1]];
    rows.forEach(([name, off], i) => {
      const y = h * (0.3 + i * 0.12);
      card(y, h * 0.09);
      g.textAlign = 'left';
      g.font = sans(30, 650);
      g.fillStyle = ink;
      g.fillText(name, 80, y + h * 0.045);
      g.textAlign = 'right';
      g.font = mono(22, 700);
      g.fillStyle = off ? '#C8102E' : 'rgba(21,23,26,.5)';
      g.fillText(off ? 'ОБЕСТОЧЕНО' : 'вкл', w - 80, y + h * 0.045);
      g.textAlign = 'center';
    });
    g.font = mono(20, 600);
    g.fillStyle = 'rgba(21,23,26,.5)';
    g.fillText('проводами, а не настройкой', w / 2, h * 0.84);
    return;
  }

  if (mode === 'torch') {
    g.fillStyle = '#060708';
    g.fillRect(0, 0, w, h);
    statusBar(false);
    const on = st.torch ?? 0;
    const c = st.torchColor === 'red' ? '255,60,60' : '255,246,230';
    const grd = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.7);
    grd.addColorStop(0, `rgba(${c},${0.55 * on})`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    title('Сигнальный фонарь', st.torchMode || 'до 5000 м', 0.42, '#F4F6FF');
  }
}

/* ---------- Текстура «Шва» ---------- */

// Путь шва в мм спинки (x — как у модели, z — высота): петля с разрывом внизу и два контакта по краям разрыва
export function seamPath(g, toX, toY, k = 1) {
  const { x, top, bottom, r, gap } = SEAM_LOOP;
  g.beginPath();
  g.moveTo(toX(gap / 2), toY(bottom));
  g.lineTo(toX(x - r), toY(bottom));
  g.arc(toX(x - r), toY(bottom + r), r * k, Math.PI / 2, 0, true);
  g.lineTo(toX(x), toY(top - r));
  g.arc(toX(x - r), toY(top - r), r * k, 0, -Math.PI / 2, true);
  g.lineTo(toX(-x + r), toY(top));
  g.arc(toX(-x + r), toY(top - r), r * k, -Math.PI / 2, -Math.PI, true);
  g.lineTo(toX(-x), toY(bottom + r));
  g.arc(toX(-x + r), toY(bottom + r), r * k, Math.PI, Math.PI / 2, true);
  g.lineTo(toX(-gap / 2), toY(bottom));
}
export function seamPads(g, toX, toY, k = 1) {
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(toX((s * SEAM_LOOP.gap) / 2), toY(SEAM_LOOP.bottom), SEAM_LOOP.pad * k, 0, Math.PI * 2);
    g.fill();
  }
}

// Плоская UV-развёртка спинки: u = x, v = высота. Строка 0 — верх телефона (glTF, flipY = false).
// map — шов тёмный (паз), glow — где светится полимер: ровно по шву и бегущий по петле ток
function makeSeamTextures() {
  const mkCv = (w) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = Math.round((w * H) / W); return cv; };
  const dark = mkCv(1024);
  const glow = mkCv(512);
  const gd = dark.getContext('2d');
  const sx = (cv) => (x) => ((x + W / 2) / W) * cv.width;
  const sy = (cv) => (z) => ((HH - z) / H) * cv.height;
  const kd = dark.width / W;
  gd.fillStyle = '#FFFFFF';
  gd.fillRect(0, 0, dark.width, dark.height);
  gd.strokeStyle = '#000000';
  gd.fillStyle = '#000000';
  gd.lineWidth = SEAM_W * kd;
  gd.lineCap = 'round';
  seamPath(gd, sx(dark), sy(dark), kd);
  gd.stroke();
  seamPads(gd, sx(dark), sy(dark), kd);

  const gg = glow.getContext('2d');
  const kg = glow.width / W;
  // t — секунды, run — 0…1, насколько виден бегущий ток
  function drawGlow(t = 0, run = 0) {
    gg.fillStyle = '#000';
    gg.fillRect(0, 0, glow.width, glow.height);
    gg.lineCap = 'round';
    gg.strokeStyle = '#8C8C8C';
    gg.fillStyle = '#B4B4B4';
    gg.lineWidth = SEAM_W * kg * 1.3;
    seamPath(gg, sx(glow), sy(glow), kg);
    gg.stroke();
    seamPads(gg, sx(glow), sy(glow), kg);
    if (run > 0.01) {
      gg.save();
      gg.globalAlpha = run;
      gg.strokeStyle = '#FFFFFF';
      gg.lineWidth = SEAM_W * kg * 2.6;
      gg.setLineDash([14 * kg, 22 * kg]);
      gg.lineDashOffset = -t * 60 * kg;
      seamPath(gg, sx(glow), sy(glow), kg);
      gg.stroke();
      gg.restore();
    }
  }
  drawGlow();
  const mk = (cv, srgb) => {
    const tx = new THREE.CanvasTexture(cv);
    tx.flipY = false;
    if (srgb) tx.colorSpace = THREE.SRGBColorSpace;
    tx.anisotropy = 4;
    return tx;
  };
  const glowTex = mk(glow, false);
  return { map: mk(dark, true), glow: glowTex, drawGlow(t, run) { drawGlow(t, run); glowTex.needsUpdate = true; } };
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const std = (name, color, o = {}) => new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.45, ...o });
  const c = E5_COLORS.blank;
  const mats = {
    BodyPlain: std('BodyPlain', c.body, { metalness: 1, roughness: 0.4 }),
    Island: std('Island', c.body, { metalness: 1, roughness: 0.28 }),
    Lens: std('Lens', 0x020306, { roughness: 0.05, clearcoat: 1 }),
    LensChrome: std('LensChrome', 0x9EA2A8, { metalness: 1, roughness: 0.16 }),
    Screen: std('Screen', 0x020203),
    Glass: std('Glass', 0x030304, { roughness: 0.05, clearcoat: 1 }),
    Switch: std('Switch', c.sw, { metalness: 0.4, roughness: 0.32 }),
    TorchGlow: std('TorchGlow', 0xEDEDED, { emissive: 0xFFFFFF, emissiveIntensity: 0.4 }),
  };
  const root = new THREE.Group();
  root.name = 'OY0X5E';
  const add = (geo, mat, x = 0, y = 0, z = 0, name) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    root.add(m);
    return m;
  };
  // +Z — экран, −Z — спинка; пилюля со спины слева, то есть +X
  add(slab(W, H, 12.6, D - 0.7, 2.6, 12), 'BodyPlain', 0, 0, -0.35, 'Body');
  add(slab(W - 1, H - 1, 12, 0.6, 0.3, 12), 'Glass', 0, 0, HD - 0.35, 'Glass');
  const scr = new THREE.PlaneGeometry(SCR.w * MM, SCR.h * MM);
  const uv = scr.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - uv.getY(i));
  add(scr, 'Screen', 0, 0, HD + 0.02, 'Screen');
  const px = W / 2 - 6.4 - 13.7, pz = HH - 6.4 - 6.4;
  add(slab(27.4, 12.8, 6.4, 1.2, 0.4, 12), 'Island', px, pz, -HD - 0.6, 'Island');
  for (const dx of [-6.75, 6.75]) {
    add(cylZ(4.95, 0.4), 'LensChrome', px + dx, pz, -HD - 1.3);
    add(cylZ(3.45, 0.5), 'Lens', px + dx, pz, -HD - 1.4);
  }
  add(boxG(0.6, 5.2, 1.8), 'Switch', -W / 2 - 0.25, HH - 30, -0.6, 'Switch');
  add(boxG(9.4, 0.4, 1.7), 'TorchGlow', 0, HH + 0.1, -0.6, 'Torch');
  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X5E({ phone, scale, isRunning }) {
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

  const seamTex = makeSeamTextures();
  const c0 = E5_COLORS.blank;
  const bodyMat = new THREE.MeshPhysicalMaterial({
    name: 'Body', color: c0.body, metalness: c0.metal, roughness: c0.rough, clearcoat: 0, clearcoatRoughness: 0.05,
    envMapIntensity: 1.05, map: seamTex.map, emissive: c0.seam, emissiveMap: seamTex.glow, emissiveIntensity: 1.1,
  });
  const plainMat = new THREE.MeshPhysicalMaterial({ name: 'BodyPlain', color: c0.body, metalness: c0.metal, roughness: c0.rough, envMapIntensity: 1.05 });
  const islandMat = new THREE.MeshPhysicalMaterial({ name: 'Island', color: c0.body, metalness: c0.metal, roughness: 0.26, envMapIntensity: 1.2 });
  const keyMat = new THREE.MeshStandardMaterial({ name: 'Frame', color: c0.body, metalness: 1, roughness: 0.3, envMapIntensity: 1.15 });
  const logoMat = new THREE.MeshStandardMaterial({ name: 'Logo', color: c0.body, metalness: 1, roughness: 0.08, envMapIntensity: 1.6 });
  const switchMat = new THREE.MeshStandardMaterial({ name: 'Switch', color: c0.sw, metalness: 0.4, roughness: 0.32 });

  let color = 'blank';
  const tgt = { body: new THREE.Color(), sw: new THREE.Color(), metal: 1, rough: 0.4, coat: 0 };
  const cur = { body: new THREE.Color(), sw: new THREE.Color(), metal: 1, rough: 0.4, coat: 0 };
  function setTargets(name) {
    const c = E5_COLORS[name];
    tgt.body.setHex(c.body);
    tgt.sw.setHex(c.sw);
    tgt.metal = c.metal; tgt.rough = c.rough; tgt.coat = c.coat;
  }
  setTargets(color);
  cur.body.copy(tgt.body); cur.sw.copy(tgt.sw);

  const screen = { mode: 'lock', zoom: '1', sw: 0 };
  let lastDraw = 0;
  function redraw(now = performance.now()) {
    drawScreen(scrCanvas, screen.mode, { ...screen, now, ui: E5_COLORS[color].ui });
    scrTex.needsUpdate = true;
    lastDraw = now;
  }
  redraw();

  const parts = { sw: null, swBase: 0, torchMat: null };
  const torchTarget = new THREE.Color(0xffffff);
  const torchCur = new THREE.Color(0xffffff);
  const white = new THREE.Color(0xffffff);
  // полимер в шве: свой цвет у каждого анода; ток по петле — цветом акцента там, где полимер тёмный
  const seamBase = new THREE.Color(c0.seam);
  const seamRun = new THREE.Color(c0.seam);
  const seamGlow = new THREE.Color(c0.seam);
  let lastGlow = 0;
  let seam = 0;
  // люминофор в полимере: в темноте шов светится бирюзовым, какого бы цвета он ни был днём
  const GLOW = new THREE.Color('#5CF2D6');
  let glowK = 0;

  function setup(root) {
    const byName = {};
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (m?.name && !byName[m.name]) byName[m.name] = m;
      const pick = (m) => {
        switch (m?.name) {
          case 'Body': return bodyMat;
          case 'BodyPlain': return plainMat;
          case 'Island': return islandMat;
          case 'Frame': case 'PowerKey': return keyMat;
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
    if (byName.LensChrome) { const m = byName.LensChrome; m.metalness = 1; m.roughness = 0.16; m.envMapIntensity = 1.4; }
    parts.torchMat = byName.TorchGlow || null;
    if (parts.torchMat) { parts.torchMat.emissive = new THREE.Color(0xffffff); parts.torchMat.emissiveIntensity = 0.3; parts.torchMat.toneMapped = false; }
    parts.sw = root.getObjectByName('Switch');
    parts.swBase = parts.sw?.position.y ?? 0;
    stepColors(1);
  }

  function stepColors(k) {
    cur.body.lerp(tgt.body, k);
    cur.sw.lerp(tgt.sw, k);
    for (const key of ['metal', 'rough', 'coat']) cur[key] += (tgt[key] - cur[key]) * k;
    torchCur.lerp(torchTarget, k);
    for (const m of [bodyMat, plainMat]) {
      m.color.copy(cur.body);
      m.metalness = cur.metal;
      m.roughness = cur.rough;
      m.clearcoat = cur.coat;
    }
    islandMat.color.copy(cur.body);
    islandMat.metalness = cur.metal;
    islandMat.roughness = Math.min(cur.rough, 0.26);
    islandMat.clearcoat = cur.coat;
    keyMat.color.copy(cur.body);
    keyMat.metalness = cur.metal;
    logoMat.color.copy(cur.body).lerp(white, 0.22);
    switchMat.color.copy(cur.sw);
  }

  function update(st, dt, { reduced }) {
    const now = performance.now();
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));
    if (parts.sw) parts.sw.position.y = parts.swBase + SWITCH_STEP * Math.max(-1, Math.min(1, st.sw));

    // «Шов» светится цветом полимера; в главе «Шва» по петле бежит ток
    seam += (clamp01(st.seam) - seam) * (reduced ? 1 : 1 - Math.exp(-dt * 6));
    seamGlow.copy(seamBase).lerp(seamRun, seam);
    glowK += (clamp01(st.glow) - glowK) * (reduced ? 1 : 1 - Math.exp(-dt * 4));
    seamGlow.lerp(GLOW, clamp01(glowK * 1.6));
    bodyMat.emissive.copy(seamGlow);
    bodyMat.emissiveIntensity = 1.1 + seam * 1.4 + glowK * 13;
    // ток бежит по петле, только пока глава «Шва» на экране
    if (seam > 0.01 && !reduced && now - lastGlow > 40) { seamTex.drawGlow(now / 1000, seam); lastGlow = now; }
    else if (seam <= 0.01 && lastGlow) { seamTex.drawGlow(0, 0); lastGlow = 0; }

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
    const fast = screen.mode === 'camera' || screen.mode === 'charge' || screen.mode === 'chip';
    if (st.screen > 0.02 && now - lastDraw > (fast ? (reduced ? 1000 : 66) : 1000)) redraw(now);
  }

  return {
    url: '/models/oy0x5e.glb?v=8e44487979',
    state: { sw: 0, torch: 0, screen: 1, seam: 0, glow: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap() { stepColors(1); },
    api: {
      setBodyColor(name, instant = false) {
        if (!E5_COLORS[name] || name === color) return;
        color = name;
        setTargets(name);
        // полимер свой у каждого анода; у «Стружки» он тёмный, поэтому ток бежит цветом акцента
        seamBase.set(E5_COLORS[name].seam);
        seamRun.set(name === 'chips' ? E5_COLORS[name].ui : E5_COLORS[name].seam);
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
