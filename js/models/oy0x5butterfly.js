/* =========================================================================
   OY 0X5 Butterfly — описание 3D-модели: «Новая игра+». Вторая книжка OY.
   Две половины по 4,2 мм на петле «Имаго» — гладком бочонке без рисок.
   Левая половина (Left) складывается на правую; корешок (Hinge)
   поворачивается на половину угла. На спинке правой половины — «Визор»:
   капсула во всю ширину, четыре объектива в ряд под чёрным стеклом, над
   ними электрохромный слой «Затмение» (материал Tint) — от прозрачного до
   непроглядного, вместо механической диафрагмы первого Butterfly.
   Снаружи «пилюли» нет: фронталка и сканер сетчатки — под пикселями CPix 3,
   как и внутри. Два «Рубильника» на верхних гранях, фонарь «Маяк» в торце
   петли. Экраны — два canvas: внутренний (ScreenL + ScreenR с общей
   развёрткой) и внешний (Cover). Процедурная резервная модель с теми же
   именами нод.

   Состояние: fold 0 — раскрыт, 1 — сложен; tint 0…1 — «Затмение»;
   rtx 0…1 — блики и отражения; rub, rub2 — положения рубильников 0…2;
   torch 0…1. Сложенный телефон модель сама сдвигает к центру кадра.
   ========================================================================= */

import * as THREE from 'three';
import { MM, roundRect, slab, boxG, makeBeam } from './oy0x0.js';
import { drawDunes } from './oybutterfly.js';

// body — спинка, frame — рамка и цоколь «Визора», hinge — корешок, ui — акцент CamelOS 3.1
export const B5_COLORS = {
  // «Павлиний глаз» — лицо модели: винный с переливом, как крыло дневного павлиньего глаза
  peacock: { label: 'Павлиний глаз', body: 0x4A1430, frame: 0x6B2A44, hinge: 0x6B2A44, film: true, ui: '#62D6E8', css: '#7A2350' },
  blue: { label: 'Голубянка', body: 0x8FA9D6, frame: 0xB9C3D3, hinge: 0xB9C3D3, film: true, ui: '#A9C8FF', css: '#8FA9D6' },
  brimstone: { label: 'Лимонница', body: 0xDCD67A, frame: 0xC7C5B6, hinge: 0xC7C5B6, ui: '#E9E36B', css: '#DCD67A' },
  mourning: { label: 'Траурница', body: 0x2B1A16, frame: 0xD9C9A0, hinge: 0xD9C9A0, ui: '#E8D9A6', css: '#5A3A30' },
  pearl: { label: 'Перламутровка', body: 0xE6DFD5, frame: 0xB8743A, hinge: 0xB8743A, film: true, ui: '#F2A65A', css: '#E6DFD5' },
};
export const SCREEN_MODES = ['off', 'title', 'lock', 'desk', 'camera', 'retina', 'game', 'boss', 'kill', 'torch'];

// Геометрия, мм — как в blender/build_oy0x5butterfly.py
const HALF_W = 74, H = 128, HH = 64, HD = 2.1, GAP = 0.3;
const PIVOT_Y = -HD - 0.35;
const HINGE_R = HD - PIVOT_Y;                // 4,55 мм: диаметр корешка — толщина сложенного телефона
const HINGE_TORCH_R = HINGE_R - 1.2;
const RUB_STEP = 0.003;                      // м
const SCR = { w: 2 * (GAP + HALF_W - 1.6), h: H - 3.2 };
const COVER = { w: HALF_W - 1.9, h: H - 1.9 };
const FOLDED_SHIFT = { x: (GAP + HALF_W - HINGE_R) / 2 * MM, z: 2.4 * MM };
const XC = GAP + HALF_W / 2;
const VIS = { w: 60, h: 18.4, z: HH - 17 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const SANS = (px, wt = 700) => `${wt} ${px}px "Onest", system-ui, sans-serif`;
const MONO = (px, wt = 600) => `${wt} ${px}px "JetBrains Mono", ui-monospace, monospace`;
const pad2 = (n) => String(n).padStart(2, '0');

/* ---------- Рисунки для экранов ---------- */

// Крыло: переливающиеся чешуйки — «структурный цвет», как у настоящих бабочек
// Чешуйки рисуются один раз в кеш: их сотни, и перерисовывать каждый кадр экрана дорого
const wingCache = new Map();
export function drawWing(g, w, h, { accent = '#62D6E8', t = 0, dim = 1 } = {}) {
  const key = `${w}x${h}x${dim}`;
  let c = wingCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    paintScales(c.getContext('2d'), w, h, dim);
    wingCache.set(key, c);
  }
  g.drawImage(c, 0, 0);
  // перелив: блик медленно ходит по крылу
  const gx = w * (0.5 + 0.35 * Math.sin(t * 0.6)), gy = h * (0.45 + 0.2 * Math.cos(t * 0.45));
  const glow = g.createRadialGradient(gx, gy, 0, gx, gy, w * 0.6);
  glow.addColorStop(0, accent + '55');
  glow.addColorStop(1, accent + '00');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
}
function paintScales(g, w, h, dim) {
  const t = 0;
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#120A1C');
  bg.addColorStop(1, '#05040A');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const s = Math.max(w, h) / 34;
  for (let y = -1; y < h / (s * 0.6) + 1; y++) {
    for (let x = -1; x < w / s + 1; x++) {
      const cx = x * s + (y % 2) * s / 2, cy = y * s * 0.6;
      const k = Math.sin(cx / w * 4 + cy / h * 3 + t * 0.6);
      const hue = 190 + 110 * (0.5 + 0.5 * k);
      g.fillStyle = `hsla(${hue}, 70%, ${18 + 14 * (0.5 + 0.5 * Math.sin(cx * 0.01 - t))}%, ${0.55 * dim})`;
      g.beginPath();
      g.ellipse(cx, cy, s * 0.46, s * 0.34, 0, 0, Math.PI);
      g.fill();
    }
  }
}

// Ночная улица после дождя: неон, остановка, ель и мокрый асфальт. Все размеры —
// доли кадра, поэтому кадр в низком разрешении совпадает с полным, только грубее.
// С RTX лужи отражают вывески и фонарь, без — асфальт просто тёмный
export function drawNeon(g, w, h, { rtx = 1, t = 0, accent = '#62D6E8' } = {}) {
  const u = Math.min(w / 1600, h / 900);
  const horizon = h * 0.6;
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#04040C');
  sky.addColorStop(0.7, '#160E2C');
  sky.addColorStop(1, '#2A1438');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // дальний город
  g.fillStyle = '#100B1E';
  for (let i = 0; i < 24; i++) {
    const x = (i / 24) * w, bw = w / 24 + 2, bh = h * (0.12 + ((i * 37) % 11) / 60);
    g.fillRect(x, horizon - bh, bw, bh);
  }
  // ближние дома с окнами и вывесками
  const blds = [[-0.02, 0.4, 0.2], [0.2, 0.3, 0.16], [0.58, 0.36, 0.17], [0.77, 0.26, 0.25]];
  const signs = [];
  const colors = ['#FF3D8B', accent, '#FFB23D', '#9A7CFF'];
  blds.forEach(([x0, top, bw], i) => {
    const x = x0 * w, y = h * top, ww = bw * w;
    g.fillStyle = i % 2 ? '#0C0916' : '#120D20';
    g.fillRect(x, y, ww, horizon - y);
    const cw = 14 * u, chh = 18 * u, sx = 30 * u, sy = 38 * u;
    for (let yy = y + 24 * u, r = 0; yy < horizon - 30 * u; yy += sy, r++) {
      for (let xx = x + 18 * u, c = 0; xx < x + ww - 18 * u; xx += sx, c++) {
        if ((r * 7 + c * 13 + i * 5) % 6 === 0) { g.fillStyle = 'rgba(255,196,120,.6)'; g.fillRect(xx, yy, cw, chh); }
      }
    }
    const c = colors[i % colors.length];
    signs.push({ x: x + ww * 0.5, y: y + 40 * u, c, wd: ww * 0.62, ht: 22 * u });
  });
  for (const s of signs) {
    g.shadowColor = s.c;
    g.shadowBlur = 40 * u * (0.25 + 0.75 * rtx);
    g.fillStyle = s.c;
    g.fillRect(s.x - s.wd / 2, s.y, s.wd, s.ht);
    g.fillStyle = 'rgba(255,255,255,.75)';
    g.fillRect(s.x - s.wd / 2 + 8 * u, s.y + s.ht * 0.4, s.wd - 16 * u, s.ht * 0.2);
  }
  g.shadowBlur = 0;
  // фонарь
  const lx = w * 0.7, ly = h * 0.34;
  g.fillStyle = '#05040A';
  g.fillRect(lx - 4 * u, ly, 8 * u, h - ly);
  g.fillRect(lx - 40 * u, ly, 44 * u, 7 * u);
  const cone = g.createRadialGradient(lx - 36 * u, ly + 10 * u, 0, lx - 36 * u, ly + 10 * u, h * 0.55);
  cone.addColorStop(0, `rgba(255,220,160,${0.5 * (0.4 + 0.6 * rtx)})`);
  cone.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = cone;
  g.fillRect(0, 0, w, h);
  // мокрый асфальт
  const road = g.createLinearGradient(0, horizon, 0, h);
  road.addColorStop(0, '#0B0912');
  road.addColorStop(1, '#040308');
  g.fillStyle = road;
  g.fillRect(0, horizon, w, h - horizon);
  if (rtx > 0.01) {
    // отражения: вывески и фонарь в лужах, с рябью
    g.save();
    g.globalAlpha = 0.6 * rtx;
    for (const s of signs) {
      for (let k = 0; k < 9; k++) {
        const yy = horizon + (horizon - s.y) * 0.55 + k * 10 * u;
        const wob = Math.sin(t * 2.4 + k * 1.3 + s.x * 0.01) * 6 * u;
        g.fillStyle = s.c;
        g.globalAlpha = 0.55 * rtx * (1 - k / 9);
        g.fillRect(s.x - s.wd / 2 + wob, yy, s.wd, 4 * u);
      }
    }
    const pool = g.createRadialGradient(lx - 36 * u, h * 0.86, 0, lx - 36 * u, h * 0.86, w * 0.18);
    pool.addColorStop(0, 'rgba(255,220,160,.55)');
    pool.addColorStop(1, 'rgba(255,220,160,0)');
    g.globalAlpha = rtx;
    g.fillStyle = pool;
    g.fillRect(0, horizon, w, h - horizon);
    g.restore();
  }
  // остановка
  const bx = w * 0.3, by = horizon - h * 0.2, bw2 = w * 0.16, bh2 = h * 0.22;
  g.fillStyle = 'rgba(140,200,255,.08)';
  g.fillRect(bx, by, bw2, bh2);
  g.strokeStyle = 'rgba(200,220,255,.35)';
  g.lineWidth = 3 * u;
  g.strokeRect(bx, by, bw2, bh2);
  g.fillStyle = '#05040A';
  g.fillRect(bx - 6 * u, by - 10 * u, bw2 + 12 * u, 12 * u);
  g.fillStyle = accent;
  g.fillRect(bx + bw2 - 34 * u, by - 46 * u, 28 * u, 28 * u);
  // ель у остановки: DLSS дорисовывает её иголки
  const ex = w * 0.17, ey = horizon + 8 * u;
  for (let k = 0; k < 6; k++) {
    const yy = ey - k * h * 0.055, ww2 = w * (0.075 - k * 0.011);
    g.fillStyle = k % 2 ? '#0C2016' : '#0F281B';
    g.beginPath(); g.moveTo(ex - ww2, yy); g.lineTo(ex, yy - h * 0.1); g.lineTo(ex + ww2, yy); g.fill();
  }
  g.fillStyle = 'rgba(170,255,200,.5)';
  for (let k = 0; k < 90; k++) {
    const a = ((k * 53) % 100) / 100, b = ((k * 31) % 100) / 100;
    const yy = ey - b * h * 0.32;
    const half = w * (0.075 - (b * 0.32 / 0.055) * 0.011) * 0.9;
    if (half > 0) g.fillRect(ex - half + a * 2 * half, yy, 2.5 * u, 2.5 * u);
  }
  // героиня с фонариком
  const hx = w * 0.52, hy = h * 0.83;
  g.fillStyle = '#000';
  g.beginPath(); g.ellipse(hx, hy - 120 * u, 20 * u, 24 * u, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(hx - 24 * u, hy - 96 * u, 48 * u, 110 * u);
  g.fillRect(hx - 20 * u, hy + 10 * u, 16 * u, 50 * u);
  g.fillRect(hx + 4 * u, hy + 10 * u, 16 * u, 50 * u);
  const lamp = g.createRadialGradient(hx + 40 * u, hy - 30 * u, 0, hx + 40 * u, hy - 30 * u, 160 * u);
  lamp.addColorStop(0, 'rgba(255,240,200,.9)');
  lamp.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = lamp;
  g.fillRect(hx - 140 * u, hy - 200 * u, 360 * u, 360 * u);
  // дождь
  g.strokeStyle = 'rgba(200,210,255,.22)';
  g.lineWidth = 1.5 * u;
  for (let k = 0; k < 70; k++) {
    const x = (((k * 97) % 1000) / 1000) * w + ((t * 60 * u) % (20 * u));
    const y = ((((k * 61) % 1000) / 1000) * h + t * 900 * u) % h;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6 * u, y + 26 * u); g.stroke();
  }
}

// Водопад для «Затмения»: чем плотнее фильтр, тем длиннее выдержка — вода превращается в шёлк
export function drawFalls(g, w, h, { nd = 0, t = 0 } = {}) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#BFD7E6');
  sky.addColorStop(1, '#E9F0E8');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // скалы
  g.fillStyle = '#2E3A2F';
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(w * 0.36, 0); g.lineTo(w * 0.4, h * 0.3); g.lineTo(w * 0.34, h); g.lineTo(0, h);
  g.fill();
  g.beginPath();
  g.moveTo(w, 0); g.lineTo(w * 0.64, 0); g.lineTo(w * 0.6, h * 0.35); g.lineTo(w * 0.68, h); g.lineTo(w, h);
  g.fill();
  g.fillStyle = '#4C6B45';
  g.fillRect(0, 0, w, h * 0.06);
  // вода: короткие струи при короткой выдержке, гладкие полосы при длинной
  const x0 = w * 0.38, x1 = w * 0.62;
  const smooth = clamp01(nd);
  for (let i = 0; i < 70; i++) {
    const x = x0 + (x1 - x0) * ((i * 37) % 70) / 70;
    const len = 8 + smooth * h;
    const y = ((i * 97 + t * 900 * (1 - smooth)) % (h + len)) - len;
    g.strokeStyle = `rgba(255,255,255,${0.35 + 0.4 * (1 - smooth)})`;
    g.lineWidth = 2 + smooth * 5;
    g.beginPath();
    g.moveTo(x, smooth > 0.6 ? 0 : y);
    g.lineTo(x + (i % 3 - 1) * 2, smooth > 0.6 ? h : y + len);
    g.stroke();
  }
  const mist = g.createLinearGradient(0, h * 0.75, 0, h);
  mist.addColorStop(0, 'rgba(255,255,255,0)');
  mist.addColorStop(1, `rgba(255,255,255,${0.4 + 0.4 * smooth})`);
  g.fillStyle = mist;
  g.fillRect(0, h * 0.7, w, h * 0.3);
}

export function drawEye(g, cx, cy, r, { scan = 0, ok = null, accent = '#62D6E8', seed = 1 } = {}) {
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  const bg = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  bg.addColorStop(0, '#5A1C12');
  bg.addColorStop(1, '#1B0806');
  g.fillStyle = bg;
  g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  g.strokeStyle = 'rgba(255,120,90,.75)';
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let k = 0; k < 9; k++) {
    let a = (k / 9) * Math.PI * 2 + rnd() * 0.4, x = cx + r * 0.12 * Math.cos(a), y = cy + r * 0.12 * Math.sin(a);
    g.lineWidth = r * 0.03;
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < 12; i++) {
      a += (rnd() - 0.5) * 0.7;
      x += Math.cos(a) * r * 0.08; y += Math.sin(a) * r * 0.08;
      g.lineTo(x, y);
      g.lineWidth *= 0.92;
    }
    g.stroke();
  }
  g.fillStyle = 'rgba(255,214,150,.85)';
  g.beginPath(); g.arc(cx, cy, r * 0.12, 0, Math.PI * 2); g.fill();
  if (scan > 0 && scan < 1) {
    const y = cy - r + 2 * r * scan;
    g.fillStyle = accent + 'AA';
    g.fillRect(cx - r, y - 3, 2 * r, 6);
  }
  g.restore();
  g.lineWidth = 6;
  g.strokeStyle = ok === true ? '#5BE39A' : ok === false ? '#FF5A5A' : accent;
  g.beginPath(); g.arc(cx, cy, r + 10, 0, Math.PI * 2); g.stroke();
}

function bar(g, w, st, pad = 56, ink = 'rgba(244,247,255,.85)') {
  g.font = MONO(24, 600);
  g.fillStyle = ink;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText('CamelOS 3.1', pad, 52);
  g.textAlign = 'right';
  const air = st.rub2 === 2 ? 'эфир выкл' : st.rub2 === 1 ? 'без гео' : '5G';
  const eye = st.rub === 2 ? ' · без камер' : st.rub === 1 ? ' · без мик.' : '';
  g.fillText(`${air}${eye} · 88 %`, w - pad, 52);
  g.textAlign = 'center';
}

function win(g, x, y, ww, hh, title, ui) {
  roundRect(g, x, y, ww, hh, 22);
  g.fillStyle = 'rgba(14,12,22,.92)';
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,.14)';
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,.07)';
  g.fillRect(x + 2, y + 2, ww - 4, 54);
  g.textAlign = 'left';
  g.font = MONO(24, 700);
  g.fillStyle = '#F4F7FF';
  g.fillText(title, x + 26, y + 30);
  g.textAlign = 'right';
  g.fillStyle = ui;
  g.fillText('Мираж 3 · x86-64', x + ww - 26, y + 30);
}

/* ---------- Внутренний экран ---------- */

export function drawInner(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const now = st.now ?? performance.now();
  const t = now / 1000;
  const ui = st.ui || '#62D6E8';
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  if (mode === 'off') return;
  g.textBaseline = 'middle';
  g.textAlign = 'center';

  if (mode === 'title') {
    drawWing(g, w, h, { accent: ui, t });
    g.fillStyle = '#F4F7FF';
    g.font = SANS(190, 860);
    g.fillText('BUTTERFLY', w / 2, h * 0.42);
    g.font = MONO(40, 700);
    g.fillStyle = ui;
    g.fillText('НОВАЯ ИГРА+', w / 2, h * 0.55);
    g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4);
    g.font = MONO(30, 600);
    g.fillStyle = '#F4F7FF';
    g.fillText('нажмите любую клавишу', w / 2, h * 0.78);
    g.globalAlpha = 1;
    return;
  }

  if (mode === 'lock' || mode === 'desk') {
    drawDunes(g, w, h, { accent: ui, t, dim: mode === 'desk' ? 0.7 : 1 });
    bar(g, w, st);
    const d = new Date();
    if (mode === 'lock') {
      g.fillStyle = '#F4F7FF';
      g.font = SANS(250, 640);
      g.fillText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, w / 2, h * 0.27);
      g.font = SANS(36, 500);
      g.fillStyle = 'rgba(244,247,255,.8)';
      g.fillText(st.lockText || 'Внутренняя дверь · правый глаз', w / 2, h * 0.39);
      return;
    }
    // рабочий стол CamelOS 3.1: в пустыне появились окна
    const half = w / 2;
    win(g, 60, 110, half - 100, h * 0.5, 'ДЮНЫ.EXE', ui);
    g.save();
    roundRect(g, 64, 168, half - 108, h * 0.5 - 62, 16);
    g.clip();
    drawNeon(g, half, h * 0.62, { rtx: st.rtx ?? 1, t, accent: ui });
    g.restore();
    win(g, half + 40, 110, half - 100, h * 0.36, 'СМЕТА.EXE', ui);
    g.textAlign = 'left';
    g.font = MONO(24, 500);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        const x = half + 70 + c * ((half - 160) / 4), y = 200 + r * 52;
        g.strokeStyle = 'rgba(255,255,255,.12)';
        g.strokeRect(x - 8, y - 24, (half - 160) / 4, 52);
        g.fillStyle = r === 0 ? ui : 'rgba(244,247,255,.8)';
        g.fillText(r === 0 ? ['Статья', 'Янв', 'Фев', 'Итого'][c] : c === 0 ? ['Аренда', 'Еда', 'Сеть', 'Кофе', 'Итого'][r - 1] : String(((r * 37 + c * 11) % 90) * 10), x, y);
      }
    }
    win(g, half + 40, h * 0.36 + 150, half - 100, h * 0.34, 'TEXAS.EXE', '#FF6B5A');
    g.textAlign = 'center';
    g.font = MONO(28, 700);
    g.fillStyle = '#FF6B5A';
    g.fillText('Файл не запускается до 2036 года', half + 40 + (half - 100) / 2, h * 0.36 + 150 + h * 0.19);
    // панель «Караван»
    roundRect(g, w * 0.2, h - 120, w * 0.6, 84, 30);
    g.fillStyle = 'rgba(10,10,16,.85)';
    g.fill();
    ['☰', 'Д', 'С', 'Т', 'К', 'М'].forEach((c, i) => {
      const cx = w * 0.2 + 70 + i * (w * 0.6 - 140) / 5;
      g.fillStyle = i === 1 ? ui : 'rgba(255,255,255,.15)';
      roundRect(g, cx - 28, h - 106, 56, 56, 14);
      g.fill();
      g.fillStyle = i === 1 ? '#0A0B10' : '#F4F7FF';
      g.font = SANS(28, 700);
      g.fillText(c, cx, h - 77);
    });
    return;
  }

  if (mode === 'game') {
    drawNeon(g, w, h, { rtx: st.rtx ?? 1, t, accent: ui });
    g.textAlign = 'left';
    g.font = MONO(30, 700);
    g.fillStyle = ui;
    g.fillText(`RTX ${st.rtx > 0.5 ? 'ВКЛ' : 'ВЫКЛ'} · DLSS ${st.dlssLabel || 'Качество'}`, 60, 60);
    g.textAlign = 'right';
    g.fillStyle = '#F4F7FF';
    g.fillText(`${st.fps || 165} к/с`, w - 60, 60);
    return;
  }

  if (mode === 'camera') {
    const nd = clamp01(st.tint ?? 0);
    drawFalls(g, w, h, { nd, t });
    if (nd > 0.98) {
      g.fillStyle = '#04050A';
      g.fillRect(0, 0, w, h);
      g.font = MONO(36, 700);
      g.fillStyle = '#FF6B5A';
      g.fillText('ЗАТМЕНИЕ ПОЛНОЕ · КАМЕРЫ ОБЕСТОЧЕНЫ', w / 2, h / 2);
      bar(g, w, st);
      return;
    }
    g.strokeStyle = 'rgba(255,255,255,.3)';
    g.lineWidth = 2;
    for (const k of [1 / 3, 2 / 3]) {
      g.beginPath(); g.moveTo(w * k, 0); g.lineTo(w * k, h); g.stroke();
      g.beginPath(); g.moveTo(0, h * k); g.lineTo(w, h * k); g.stroke();
    }
    bar(g, w, st, 56, 'rgba(10,12,20,.85)');
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(0, h * 0.86, w, h * 0.14);
    g.font = MONO(30, 700);
    g.fillStyle = '#FFC93C';
    g.fillText(st.ndLabel || 'ЗАТМЕНИЕ ВЫКЛ · 1/500 с', w / 2, h * 0.93);
    return;
  }

  if (mode === 'retina') {
    g.fillStyle = '#06070C';
    g.fillRect(0, 0, w, h);
    bar(g, w, st);
    drawEye(g, w / 2, h * 0.47, h * 0.26, { scan: st.scan ?? 0, ok: st.ok ?? null, accent: ui, seed: st.seed || 7 });
    g.font = MONO(32, 700);
    g.fillStyle = ui;
    g.fillText(st.retinaText || 'ВНУТРЕННЯЯ ДВЕРЬ · ПРАВЫЙ ГЛАЗ', w / 2, h * 0.86);
    return;
  }

  if (mode === 'boss') {
    g.fillStyle = '#0B0509';
    g.fillRect(0, 0, w, h);
    const pulse = 1 + 0.04 * Math.sin(t * 5);
    g.save();
    g.translate(w / 2, h * 0.48);
    g.scale(pulse * 3.4, pulse * 3.4);
    g.translate(-100, -90);
    g.fillStyle = '#C2264E';
    g.fill(new Path2D('M100 168C40 120 8 90 8 52 8 26 28 8 54 8c20 0 36 12 46 28C110 20 126 8 146 8c26 0 46 18 46 44 0 38-32 68-92 116z'));
    g.restore();
    g.font = SANS(64, 860);
    g.fillStyle = '#F4F7FF';
    g.fillText('LOVE GEN 5 SEMI', w / 2, h * 0.13);
    roundRect(g, w * 0.2, h * 0.84, w * 0.6, 34, 17);
    g.fillStyle = '#C2264E';
    g.fill();
    g.font = MONO(28, 700);
    g.fillStyle = '#FFFFFF';
    g.fillText(`∞ / ∞ · урон ${st.dmg ?? 0}`, w / 2, h * 0.84 + 17);
    return;
  }

  if (mode === 'kill') {
    g.fillStyle = '#05070A';
    g.fillRect(0, 0, w, h);
    bar(g, w, st);
    const panel = (x0, title, pos, rows, labels) => {
      g.textAlign = 'left';
      g.font = SANS(52, 760);
      g.fillStyle = '#F4F7FF';
      g.fillText(title, x0, 170);
      g.font = MONO(28, 600);
      g.fillStyle = ui;
      g.fillText(labels[pos], x0, 228);
      rows.forEach(([name, at], i) => {
        const y = 330 + i * 110;
        const off = pos >= at;
        roundRect(g, x0 - 20, y - 46, w / 2 - 140, 92, 26);
        g.fillStyle = off ? 'rgba(255,255,255,.04)' : 'rgba(98,214,232,.12)';
        g.fill();
        g.textAlign = 'left';
        g.font = SANS(34, 600);
        g.fillStyle = off ? 'rgba(244,247,255,.35)' : '#F4F7FF';
        g.fillText(name, x0 + 16, y);
        g.textAlign = 'right';
        g.font = MONO(26, 700);
        g.fillStyle = off ? '#FF6B5A' : ui;
        g.fillText(off ? 'обесточено' : 'вкл', x0 + w / 2 - 190, y);
      });
    };
    panel(110, '«Эфир»', st.rub2 ?? 0, [['GNSS', 1], ['UWB и NFC', 1], ['Сотовая связь', 2], ['Wi-Fi и Bluetooth', 2], ['Спутник', 2]],
      ['1 · всё работает', '2 · без геолокации', '3 · эфир выключен']);
    panel(w / 2 + 70, '«Глаза и уши»', st.rub ?? 0, [['Микрофоны (5)', 1], ['Задние камеры (4)', 2], ['Фронталки и сканеры (2 + 2)', 2]],
      ['1 · всё работает', '2 · без микрофонов', '3 · без камер и микрофонов']);
    g.textAlign = 'center';
    return;
  }

  if (mode === 'torch') {
    const on = st.torch ?? 0;
    g.fillStyle = '#05070A';
    g.fillRect(0, 0, w, h);
    bar(g, w, st);
    const c = st.torchColor === 'red' ? '255,60,60' : '255,248,230';
    const grd = g.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.8);
    grd.addColorStop(0, `rgba(${c},${0.5 * on})`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.font = SANS(64, 760);
    g.fillStyle = '#F4F7FF';
    g.fillText('Маяк', w / 2, h * 0.42);
    g.font = MONO(30, 600);
    g.fillStyle = ui;
    g.fillText(st.torchMode || 'свет из петли · 1000 лм', w / 2, h * 0.5);
  }
}

/* ---------- Внешний экран ---------- */

export function drawCover(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const now = st.now ?? performance.now();
  const t = now / 1000;
  const ui = st.ui || '#62D6E8';
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  if (mode === 'off') return;
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  if (mode === 'title') {
    drawWing(g, w, h, { accent: ui, t });
    g.font = SANS(92, 860);
    g.fillStyle = '#F4F7FF';
    g.fillText('0X5', w / 2, h * 0.42);
    g.font = MONO(28, 700);
    g.fillStyle = ui;
    g.fillText('НОВАЯ ИГРА+', w / 2, h * 0.52);
    return;
  }
  if (mode === 'retina') {
    g.fillStyle = '#06070C';
    g.fillRect(0, 0, w, h);
    drawEye(g, w / 2, h * 0.42, w * 0.32, { scan: st.coverScan ?? 0, ok: st.coverOk ?? null, accent: ui, seed: st.coverSeed || 3 });
    g.font = MONO(26, 700);
    g.fillStyle = ui;
    g.fillText(st.coverText || 'ВНЕШНЯЯ ДВЕРЬ', w / 2, h * 0.75);
    g.fillText(st.coverSub || 'ЛЕВЫЙ ГЛАЗ', w / 2, h * 0.8);
    return;
  }
  if (mode === 'camera') {
    // «Зеркало»: внешний экран показывает кадр тому, кого снимают
    g.save();
    g.translate(w, 0);
    g.scale(-1, 1);
    drawFalls(g, w, h, { nd: st.tint ?? 0, t });
    g.restore();
    g.fillStyle = 'rgba(0,0,0,.5)';
    g.fillRect(0, h * 0.84, w, h * 0.16);
    g.font = MONO(24, 700);
    g.fillStyle = '#FFC93C';
    g.fillText('«ЗЕРКАЛО» · ВАС СНИМАЮТ', w / 2, h * 0.92);
    return;
  }
  drawDunes(g, w, h, { accent: ui, t, dim: 0.95 });
  const d = new Date();
  g.font = MONO(22, 600);
  g.fillStyle = 'rgba(244,247,255,.8)';
  g.fillText('CamelOS 3.1', w / 2, 120);
  g.fillStyle = '#F4F7FF';
  g.font = SANS(176, 640);
  g.fillText(pad2(d.getHours()), w / 2, h * 0.28);
  g.fillText(pad2(d.getMinutes()), w / 2, h * 0.44);
  g.font = SANS(30, 500);
  g.fillStyle = 'rgba(244,247,255,.8)';
  g.fillText('Раскройте, чтобы продолжить', w / 2, h * 0.55);
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const c0 = B5_COLORS.peacock;
  const std = (name, color, o = {}) => new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.45, ...o });
  const mats = {
    Body: std('Body', c0.body),
    Frame: std('Frame', c0.frame, { metalness: 0.9, roughness: 0.3 }),
    Ring: std('Ring', c0.frame, { metalness: 0.9, roughness: 0.2 }),
    Hinge: std('Hinge', c0.hinge, { metalness: 0.9, roughness: 0.2 }),
    Visor: std('Visor', 0x07080B, { roughness: 0.08, clearcoat: 1 }),
    Lens: std('Lens', 0x020306, { roughness: 0.05, clearcoat: 1 }),
    Tint: std('Tint', 0x0A1020, { transparent: true, opacity: 0, depthWrite: false }),
    Screen: std('Screen', 0x020203),
    CoverScreen: std('CoverScreen', 0x020203),
    Rubilnik: std('Rubilnik', 0xEDE6D8, { metalness: 0.2, roughness: 0.35 }),
    TorchGlow: std('TorchGlow', 0xEDEDED, { emissive: 0xFFFFFF, emissiveIntensity: 0.4 }),
  };
  const root = new THREE.Group();
  root.name = 'OY0X5Butterfly';
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };
  const screenPlane = (w, h, u0, u1, name, mat, parent, x, z) => {
    const geo = new THREE.PlaneGeometry(w * MM, h * MM);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), 1 - uv.getY(i));
    return add(geo, mat, x, 0, z, name, parent);
  };
  const pz = -PIVOT_Y;
  add(slab(HALF_W, H, 7, 4.2, 0.4, 10), 'Frame', XC, 0, 0, 'FrameR');
  add(slab(HALF_W - 1.4, H - 1.4, 6.4, 0.3, 0.1, 10), 'Body', XC, 0, -2.15, 'BodyR');
  screenPlane(SCR.w / 2, SCR.h, 0.5, 1, 'ScreenR', 'Screen', root, SCR.w / 4, 2.25);
  const left = new THREE.Group();
  left.name = 'Left';
  left.position.z = pz * MM;
  root.add(left);
  add(slab(HALF_W, H, 7, 4.2, 0.4, 10), 'Frame', -XC, 0, -pz, 'FrameL', left);
  screenPlane(SCR.w / 2, SCR.h, 0, 0.5, 'ScreenL', 'Screen', left, -SCR.w / 4, 2.25 - pz);
  const cover = screenPlane(COVER.w, COVER.h, 0, 1, 'Cover', 'CoverScreen', left, -XC, -2.3 - pz);
  cover.rotation.y = Math.PI;
  const hinge = new THREE.Group();
  hinge.name = 'Hinge';
  hinge.position.z = pz * MM;
  root.add(hinge);
  const spine = add(new THREE.CylinderGeometry(HINGE_R * MM, HINGE_R * MM, (H - 0.4) * MM, 32, 1, true, -1.5, 3), 'Hinge', 0, 0, 0, 'HingeCover', hinge);
  spine.rotation.y = Math.PI;
  // «Визор»: цоколь, чёрное стекло, объективы и «Затмение»
  add(slab(VIS.w + 1.4, VIS.h + 1.4, VIS.h / 2 + 0.7, 0.9, 0.2, 16), 'Ring', XC, VIS.z, -2.6);
  add(slab(VIS.w, VIS.h, VIS.h / 2, 0.2, 0, 16), 'Visor', XC, VIS.z, -3.1);
  for (const [u, r] of [[-21.6, 7.2], [-7.4, 5.5], [5.4, 5.5], [18.2, 5.5]]) {
    const l = add(new THREE.CylinderGeometry((r - 1) * MM, (r - 1) * MM, 0.6 * MM, 48), 'Lens', XC + u, VIS.z, -3.3);
    l.rotation.x = Math.PI / 2;
  }
  add(slab(VIS.w - 0.3, VIS.h - 0.3, VIS.h / 2 - 0.15, 0.05, 0, 16), 'Tint', XC, VIS.z, -3.7, 'EyeTint');
  const rub = new THREE.Group();
  rub.name = 'Rubilnik';
  rub.position.set((GAP + 20) * MM, HH * MM, 0);
  root.add(rub);
  add(boxG(5, 1.4, 2.2), 'Rubilnik', 0, 0.6, 0, null, rub);
  const rub2 = new THREE.Group();
  rub2.name = 'Rubilnik2';
  rub2.position.set(-(GAP + 20) * MM, HH * MM, -pz * MM);
  left.add(rub2);
  add(boxG(5, 1.4, 2.2), 'Rubilnik', 0, 0.6, 0, null, rub2);
  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X5Butterfly({ phone, scale, isRunning }) {
  const { beam, glow, beamMat } = makeBeam();
  phone.add(beam, glow);

  const makeScreen = (w, h, name) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({ name, color: 0x000000, roughness: 0.2, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1 });
    mat.toneMapped = false;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    mat.polygonOffsetUnits = -8;
    return { c, tex, mat };
  };
  const inner = makeScreen(1600, Math.round(1600 * SCR.h / SCR.w), 'Screen');
  const cover = makeScreen(720, Math.round(720 * COVER.h / COVER.w), 'CoverScreen');

  const c0 = B5_COLORS.peacock;
  const bodyMat = new THREE.MeshPhysicalMaterial({
    name: 'Body', color: c0.body, metalness: 0, roughness: 0.5,
    clearcoat: 0.12, clearcoatRoughness: 0.34, envMapIntensity: 0.6,
    iridescence: 0, iridescenceIOR: 1.45, iridescenceThicknessRange: [240, 520],
  });
  const frameMat = new THREE.MeshStandardMaterial({ name: 'Frame', color: c0.frame, metalness: 1, roughness: 0.3, envMapIntensity: 1.1 });
  const ringMat = new THREE.MeshStandardMaterial({ name: 'Ring', color: c0.frame, metalness: 1, roughness: 0.16, envMapIntensity: 1.4 });
  const hingeMat = new THREE.MeshStandardMaterial({ name: 'Hinge', color: c0.hinge, metalness: 1, roughness: 0.18, envMapIntensity: 1.3 });
  const keyMat = new THREE.MeshStandardMaterial({ name: 'PowerKey', color: c0.frame, metalness: 1, roughness: 0.2, envMapIntensity: 1.2 });
  const logoMat = new THREE.MeshStandardMaterial({ name: 'Logo', color: c0.frame, metalness: 1, roughness: 0.2, envMapIntensity: 1.4 });
  const visorMat = new THREE.MeshPhysicalMaterial({ name: 'Visor', color: 0x07080B, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 });
  const glassMat = new THREE.MeshPhysicalMaterial({ name: 'EyeGlass', color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 0.8 });
  // «Затмение»: тёмно-синий, как у электрохромного стекла; прозрачность задаёт tint
  const tintMat = new THREE.MeshPhysicalMaterial({ name: 'Tint', color: 0x0A1020, metalness: 0.1, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0, depthWrite: false, envMapIntensity: 1.3 });

  let color = 'peacock';
  const keys = ['body', 'frame', 'hinge'];
  const tgt = Object.fromEntries(keys.map((k) => [k, new THREE.Color()]));
  const cur = Object.fromEntries(keys.map((k) => [k, new THREE.Color()]));
  let irid = 0, iridTgt = 0;
  let rtx = 1;
  function setTargets(name) {
    const c = B5_COLORS[name];
    for (const k of keys) tgt[k].setHex(c[k]);
    iridTgt = c.film ? 1 : 0;
  }
  setTargets(color);
  for (const k of keys) cur[k].copy(tgt[k]);

  const screen = { mode: 'title', cover: 'title' };
  let lastDraw = 0;
  function redraw(now = performance.now()) {
    const st = { ...screen, now, ui: B5_COLORS[color].ui };
    drawInner(inner.c, screen.mode, st);
    drawCover(cover.c, screen.cover, st);
    inner.tex.needsUpdate = true;
    cover.tex.needsUpdate = true;
    lastDraw = now;
  }
  redraw();

  const parts = { root: null, left: null, hinge: null, rub: null, rub2: null, rubBase: 0, rub2Base: 0, torchMat: null, rubMat: null };
  const torchTarget = new THREE.Color(0xffffff);
  const torchCur = new THREE.Color(0xffffff);

  function setup(root) {
    parts.root = root;
    const byName = {};
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (m?.name && !byName[m.name]) byName[m.name] = m;
      const swap = (m) => {
        switch (m?.name) {
          case 'Body': case 'Island': return bodyMat;
          case 'Frame': return frameMat;
          case 'Ring': return ringMat;
          case 'Hinge': return hingeMat;
          case 'PowerKey': return keyMat;
          case 'Logo': return logoMat;
          case 'Visor': return visorMat;
          case 'Screen': return inner.mat;
          case 'CoverScreen': return cover.mat;
          case 'EyeGlass': return glassMat;
          case 'Tint': return tintMat;
          default: return m;
        }
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
      if (o.material === tintMat) o.renderOrder = 4;
      if (o.material === glassMat) o.renderOrder = 5;
    });
    if (byName.Lens) { const m = byName.Lens; m.envMapIntensity = 0.45; m.roughness = 0.04; if ('clearcoat' in m) m.clearcoat = 1; }
    if (byName.LensCoat) { const m = byName.LensCoat; m.color.set(0x140F33); m.metalness = 0.5; m.roughness = 0.06; m.envMapIntensity = 0.9; }
    if (byName.LensInner) { const m = byName.LensInner; m.color.set(0x05070C); m.metalness = 0.6; m.roughness = 0.1; }
    if (byName.CPix) { const m = byName.CPix; m.color.set(0x000000); m.transparent = true; m.opacity = 0.1; m.depthWrite = false; }
    parts.rubMat = byName.Rubilnik || null;
    parts.torchMat = byName.TorchGlow || null;
    if (parts.torchMat) { parts.torchMat.emissive = new THREE.Color(0xffffff); parts.torchMat.emissiveIntensity = 0.3; parts.torchMat.toneMapped = false; }
    parts.left = root.getObjectByName('Left');
    parts.hinge = root.getObjectByName('Hinge');
    parts.rub = root.getObjectByName('Rubilnik');
    parts.rub2 = root.getObjectByName('Rubilnik2');
    parts.rubBase = parts.rub ? parts.rub.position.x : 0;
    parts.rub2Base = parts.rub2 ? parts.rub2.position.x : 0;
    stepColors(1);
  }

  function stepColors(k) {
    for (const key of keys) cur[key].lerp(tgt[key], k);
    torchCur.lerp(torchTarget, k);
    irid += (iridTgt - irid) * k;
    bodyMat.color.copy(cur.body);
    frameMat.color.copy(cur.frame);
    ringMat.color.copy(cur.frame);
    keyMat.color.copy(cur.frame);
    logoMat.color.copy(cur.frame);
    hingeMat.color.copy(cur.hinge);
    // RTX: без трассировки — плоский свет, без бликов, перелива и отражений в стекле
    bodyMat.iridescence = irid * rtx;
    bodyMat.clearcoat = 0.12 * rtx;
    bodyMat.envMapIntensity = 0.15 + 0.45 * rtx;
    frameMat.envMapIntensity = 0.25 + 0.85 * rtx;
    frameMat.roughness = 0.3 + 0.35 * (1 - rtx);
    ringMat.envMapIntensity = 0.25 + 1.15 * rtx;
    hingeMat.envMapIntensity = 0.25 + 1.05 * rtx;
    visorMat.envMapIntensity = 0.1 + 1.1 * rtx;
    visorMat.clearcoat = rtx;
    tintMat.envMapIntensity = 0.1 + 1.2 * rtx;
  }

  const torchPos = new THREE.Vector3();
  function update(st, dt, { reduced }) {
    const now = performance.now();
    rtx = clamp01(st.rtx);
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));

    const fold = clamp01(st.fold);
    const a = fold * Math.PI;
    if (parts.left) parts.left.rotation.y = a;
    if (parts.hinge) parts.hinge.rotation.y = a / 2;
    if (parts.root) parts.root.position.set(-FOLDED_SHIFT.x * fold, 0, -FOLDED_SHIFT.z * fold);

    const tint = clamp01(st.tint);
    tintMat.opacity = 0.97 * tint;
    tintMat.visible = tint > 0.005;

    if (parts.rub) parts.rub.position.x = parts.rubBase - Math.max(0, Math.min(2, st.rub)) * RUB_STEP;
    if (parts.rub2) parts.rub2.position.x = parts.rub2Base + Math.max(0, Math.min(2, st.rub2)) * RUB_STEP;

    const ha = a / 2;
    torchPos.set(-Math.sin(ha) * HINGE_TORCH_R * MM, HH * MM, -(PIVOT_Y + Math.cos(ha) * HINGE_TORCH_R) * MM);
    if (parts.root) torchPos.add(parts.root.position);
    torchPos.multiplyScalar(scale);
    beam.position.copy(torchPos).setY(torchPos.y + 0.004);
    glow.position.copy(torchPos).setY(torchPos.y + 0.01);
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

    inner.mat.emissiveIntensity = clamp01(st.screen) * 1.02;
    cover.mat.emissiveIntensity = clamp01(st.cover) * 1.02;
    // экраны: анимированные режимы — 15 кадров в секунду, часы — раз в секунду
    const live = ['title', 'camera', 'game', 'boss', 'retina', 'desk'].includes(screen.mode) || ['title', 'camera', 'retina'].includes(screen.cover);
    if (screen.mode === 'camera' || screen.cover === 'camera') screen.tint = tint;
    if ((st.screen > 0.02 || st.cover > 0.02) && now - lastDraw > (live ? 100 : 1000)) redraw(now);
  }

  return {
    url: '/models/oy0x5butterfly.glb?v=64030f2f25',
    state: { fold: 1, tint: 0, rtx: 1, rub: 0, rub2: 0, torch: 0, screen: 1, cover: 1 },
    parts,
    setup,
    buildFallback,
    update,
    snap() { stepColors(1); },
    api: {
      setBodyColor(name, instant = false) {
        if (!B5_COLORS[name] || name === color) return;
        color = name;
        setTargets(name);
        redraw();
        if (instant || !isRunning()) stepColors(1);
      },
      setTorchColor(name, instant = false) {
        torchTarget.setHex(name === 'red' ? 0xFF2A2A : 0xFFFFFF);
        if (instant || !isRunning()) torchCur.copy(torchTarget);
      },
      setScreen(mode, extra = {}) {
        screen.mode = SCREEN_MODES.includes(mode) ? mode : 'lock';
        screen.cover = extra.cover || (mode === 'title' ? 'title' : mode === 'camera' ? 'camera' : mode === 'retina' ? 'retina' : 'lock');
        Object.assign(screen, extra);
        redraw();
      },
      redrawScreen() { redraw(); },
    },
  };
}
