/* =========================================================================
   OY 0X Butterfly — описание 3D-модели: первый OY, который сделала Fyr.
   Книжка из двух половин по 4,6 мм на петле «Куколка». Левая половина
   (Left) складывается на правую; корешок (Hinge) поворачивается на половину
   угла. На спинке правой половины — «Глаз»: четыре объектива под сапфиром,
   кольцо «Диафрагма» (IrisRing) и шестнадцать лепестков (Blade00…Blade15),
   которые выходят из-под кольца и закрывают блок. Два «Рубильника» на
   верхних гранях, фонарь «Маяк» в торце петли. Экраны — два canvas:
   внутренний «Размах» (ScreenL + ScreenR с общей развёрткой) и внешний
   (Cover). Процедурная резервная модель с теми же именами нод.

   Состояние: fold 0 — раскрыт, 1 — сложен; iris 0 — открыт, 1 — закрыт;
   rub, rub2 — положения рубильников 0…2; torch 0…1.
   Сложенный телефон модель сама сдвигает к центру кадра.
   ========================================================================= */

import * as THREE from 'three';
import { MM, roundRect, slab, boxG, cylZ, makeBeam } from './oy0x0.js';

// body — спинка, island — дно «Глаза» и ободы, frame — рамка и кольцо, hinge — корешок, ui — акцент CamelOS
export const BF_COLORS = {
  // «Сигнальный Красный» — главный цвет OY со времён 0X0; лицо Butterfly
  signal: { body: 0xB3202A, island: 0xA51D27, frame: 0x9A2028, hinge: 0x9A2028, ui: '#FF6B73', ink: '#FFFFFF' },
  morpho: { body: 0x1D2B4F, island: 0x1A2747, frame: 0x5A6A8C, hinge: 0x5A6A8C, film: true, ui: '#7FA8FF', ink: '#F4F7FF' },
  swallowtail: { body: 0xE3D3A8, island: 0xDDCCA0, frame: 0x2A2A2C, hinge: 0x2A2A2C, ui: '#F2C94C', ink: '#1A1505' },
  cabbage: { body: 0xE9E8E3, island: 0xE2E1DB, frame: 0xC9CACC, hinge: 0xC9CACC, ui: '#DDE6F0', ink: '#16191C' },
  admiral: { body: 0x1B1C1F, island: 0x18191C, frame: 0x3A3B3F, hinge: 0xB3262E, ui: '#FF5A4E', ink: '#FFFFFF' },
};
export const SCREEN_MODES = ['off', 'lock', 'desk', 'camera', 'iris', 'kill', 'torch', 'guest'];

// Геометрия, мм — как в blender/build_oybutterfly.py
const HALF_W = 81, H = 120, HH = 60, HD = 2.3, GAP = 0.3;
const PIVOT_Y = -HD - 0.35;                 // Blender: ось петли перед экраном
const HINGE_TORCH_R = 4.95 - 1.1;           // фонарь в торце корешка
const RUB_STEP = 0.003;                     // м
const IRIS_RING = THREE.MathUtils.degToRad(60);
const IRIS_BLADE = THREE.MathUtils.degToRad(64);
const SCR = { w: 2 * (GAP + HALF_W - 1.6), h: H - 3.2 };          // внутренний экран, мм
const COVER = { w: HALF_W - 2.6, h: H - 2.6 };                  // внешний экран, мм
// центр сложенного телефона: правая половина от 0,3 до 81,3 мм, корешок слева до −4,95
const FOLDED_SHIFT = { x: (81.3 - 4.95) / 2 * MM, z: 2.6 * MM };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const SANS = (px, wt = 700) => `${wt} ${px}px "Onest", system-ui, sans-serif`;
const MONO = (px, wt = 600) => `${wt} ${px}px "JetBrains Mono", ui-monospace, monospace`;
const pad2 = (n) => String(n).padStart(2, '0');

/* ---------- Обои: сумерки над дюнами ---------- */

export function drawDunes(g, w, h, { accent = '#7FA8FF', t = 0, dim = 1 } = {}) {
  const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#0B1640');
  sky.addColorStop(0.42, '#3F4F9E');
  sky.addColorStop(0.72, '#B9A5D6');
  sky.addColorStop(1, '#F6D2B4');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // солнце над горизонтом и свет акцента сверху
  const sun = g.createRadialGradient(w * 0.62, h * 0.6, 0, w * 0.62, h * 0.6, w * 0.6);
  sun.addColorStop(0, 'rgba(255,236,206,.95)');
  sun.addColorStop(0.12, 'rgba(255,206,170,.45)');
  sun.addColorStop(1, 'rgba(255,190,160,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, w, h);
  const glow = g.createRadialGradient(w * 0.2, -h * 0.1, 0, w * 0.2, -h * 0.1, w * 0.9);
  glow.addColorStop(0, accent + '66');
  glow.addColorStop(1, accent + '00');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  // три гряды дюн: дальняя светлая, ближняя тёмная
  const ridges = [
    { y: 0.6, a: 0.035, k: 5.2, c0: '#E9C49C', c1: '#C2946C', ph: 0.4 },
    { y: 0.7, a: 0.05, k: 3.4, c0: '#C99A6E', c1: '#8E6444', ph: 1.7 },
    { y: 0.84, a: 0.06, k: 2.4, c0: '#8A5E3F', c1: '#3C2618', ph: 2.9 },
  ];
  for (const r of ridges) {
    const grd = g.createLinearGradient(0, h * (r.y - r.a), 0, h);
    grd.addColorStop(0, r.c0);
    grd.addColorStop(1, r.c1);
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 80) {
      const u = x / w;
      g.lineTo(x, h * (r.y + r.a * Math.sin(u * r.k + r.ph + t * 0.05) + r.a * 0.35 * Math.sin(u * r.k * 2.3 + r.ph)));
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();
  }
  if (dim < 1) {
    g.fillStyle = `rgba(4,6,12,${(1 - dim).toFixed(3)})`;
    g.fillRect(0, 0, w, h);
  }
}

/* ---------- Внутренний экран: CamelOS 2 на развороте ---------- */

function statusBar(g, w, st, ink = 'rgba(244,247,255,.85)', pad = 56) {
  g.font = MONO(24, 600);
  g.fillStyle = ink;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText('CamelOS 2', pad, 52);
  g.textAlign = 'right';
  const air = st.rub2 === 2 ? 'эфир выкл' : st.rub2 === 1 ? 'без гео' : '5G';
  const eye = st.rub === 2 ? ' · без камер' : st.rub === 1 ? ' · без мик.' : '';
  g.fillText(`${air}${eye} · 92 %`, w - pad, 52);
  g.textAlign = 'center';
}

const APPS = ['Погонщик', 'Маяк', 'Камера', 'Плёнка', 'Караван', 'Кошелёк', 'Сторож', 'Привал', 'Карты', 'Заметки', 'Колодец', 'Фонарь'];

export function drawInner(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const now = st.now ?? performance.now();
  const ui = st.ui || '#7FA8FF';
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  if (mode === 'off') return;
  g.textBaseline = 'middle';
  g.textAlign = 'center';

  if (mode === 'lock' || mode === 'desk' || mode === 'guest') {
    drawDunes(g, w, h, { accent: ui, t: now / 1000, dim: mode === 'desk' ? 0.82 : 1 });
    statusBar(g, w, st);
    const d = new Date();
    if (mode === 'lock' || mode === 'guest') {
      g.fillStyle = '#F4F7FF';
      g.font = SANS(250, 640);
      g.fillText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, w / 2, h * 0.26);
      g.font = SANS(36, 500);
      g.fillStyle = 'rgba(244,247,255,.78)';
      g.fillText(mode === 'guest' ? 'Внутренняя дверь заперта · Citadel 5X' : 'Караван: часы и KBook рядом', w / 2, h * 0.38);
      return;
    }
    // разворот: слева виджеты, справа приложения; посередине — сгиб, которого не видно
    const half = w / 2;
    roundRect(g, 70, 110, half - 120, h * 0.36, 40);
    g.fillStyle = 'rgba(255,255,255,.1)';
    g.fill();
    g.textAlign = 'left';
    g.fillStyle = '#F4F7FF';
    g.font = SANS(150, 640);
    g.fillText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, 110, 230);
    g.font = SANS(32, 500);
    g.fillStyle = 'rgba(244,247,255,.75)';
    g.fillText('Стокгольм · −3° · снег к вечеру', 114, 340);
    g.fillStyle = ui;
    g.font = MONO(26, 600);
    g.fillText('Погонщик: «Завтра в 9:00 — сдача макета»', 114, 400);
    roundRect(g, 70, h * 0.36 + 150, half - 120, h * 0.5 - 150, 40);
    g.fillStyle = 'rgba(255,255,255,.08)';
    g.fill();
    g.fillStyle = 'rgba(244,247,255,.6)';
    g.font = MONO(24, 600);
    g.fillText('КАРАВАН', 110, h * 0.36 + 200);
    ['Osmium X0 · 82 %', 'KBook 1 · заряжается', 'Наушники · рядом'].forEach((s, i) => {
      g.fillStyle = '#F4F7FF';
      g.font = SANS(34, 600);
      g.fillText(s, 110, h * 0.36 + 270 + i * 70);
    });
    APPS.forEach((name, i) => {
      const cx = half + 120 + (i % 4) * ((half - 240) / 3), cy = 220 + Math.floor(i / 4) * 230;
      roundRect(g, cx - 66, cy - 66, 132, 132, 38);
      g.fillStyle = i === 2 ? ui : 'rgba(255,255,255,.14)';
      g.fill();
      g.textAlign = 'center';
      g.fillStyle = i === 2 ? '#0A0B10' : ui;
      g.font = SANS(56, 700);
      g.fillText(name[0], cx, cy + 3);
      g.font = SANS(24, 500);
      g.fillStyle = 'rgba(244,247,255,.85)';
      g.fillText(name, cx, cy + 102);
    });
    return;
  }

  if (mode === 'camera' || mode === 'iris') {
    const iris = clamp01(st.iris ?? 0);
    const zoom = st.zoom || 1;
    // видоискатель: та же сцена, что на обоях, крупнее при зуме
    g.save();
    g.translate(w / 2, h * 0.55);
    g.scale(zoom ** 0.55, zoom ** 0.55);
    g.translate(-w / 2, -h * 0.55);
    drawDunes(g, w, h, { accent: ui, t: now / 1000 });
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.25)';
    g.lineWidth = 2;
    for (const k of [1 / 3, 2 / 3]) {
      g.beginPath(); g.moveTo(w * k, 0); g.lineTo(w * k, h); g.stroke();
      g.beginPath(); g.moveTo(0, h * k); g.lineTo(w, h * k); g.stroke();
    }
    // закрытая диафрагма: экран гаснет, как будто лепестки закрыли и его
    if (iris > 0.01) {
      const r = Math.hypot(w, h) * 0.6 * (1 - iris);
      g.save();
      g.fillStyle = '#05060A';
      g.beginPath();
      g.rect(0, 0, w, h);
      g.arc(w / 2, h / 2, Math.max(0, r), 0, Math.PI * 2, true);
      g.fill('evenodd');
      g.restore();
    }
    statusBar(g, w, st);
    g.font = MONO(28, 700);
    g.fillStyle = iris > 0.95 ? '#FF6B5A' : '#FFC93C';
    g.fillText(iris > 0.95 ? 'ДИАФРАГМА ЗАКРЫТА · КАМЕРЫ ОБЕСТОЧЕНЫ' : `KODAK · ТЁПЛАЯ 200 · ${st.lens || '1× · 24 мм'}`, w / 2, h * 0.9);
    if (iris < 0.95) {
      ['0,5', '1×', '3', '6'].forEach((z, i) => {
        const on = ['0,5', '1×', '3', '6'][i] === (st.zlabel || '1×');
        const cx = w / 2 + (i - 1.5) * 96, cy = h * 0.8;
        g.beginPath();
        g.arc(cx, cy, on ? 38 : 30, 0, Math.PI * 2);
        g.fillStyle = on ? 'rgba(255,201,60,.92)' : 'rgba(0,0,0,.5)';
        g.fill();
        g.font = MONO(on ? 26 : 22, 700);
        g.fillStyle = on ? '#141414' : '#F4F7FF';
        g.fillText(z, cx, cy + 1);
      });
    }
    return;
  }

  if (mode === 'kill') {
    g.fillStyle = '#05070A';
    g.fillRect(0, 0, w, h);
    statusBar(g, w, st);
    const panel = (x0, title, pos, rows, labels) => {
      g.textAlign = 'left';
      g.font = SANS(54, 760);
      g.fillStyle = '#F4F7FF';
      g.fillText(title, x0, 170);
      g.font = MONO(28, 600);
      g.fillStyle = ui;
      g.fillText(labels[pos], x0, 228);
      rows.forEach(([name, at], i) => {
        const y = 330 + i * 110;
        const off = pos >= at;
        roundRect(g, x0 - 20, y - 46, w / 2 - 140, 92, 26);
        g.fillStyle = off ? 'rgba(255,255,255,.04)' : 'rgba(127,168,255,.12)';
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
    panel(w / 2 + 70, '«Глаза и уши»', st.rub ?? 0, [['Микрофоны (5)', 1], ['Задние камеры (4)', 2], ['Фронтальные (3)', 2]],
      ['1 · всё работает', '2 · без микрофонов', '3 · без камер и микрофонов']);
    g.textAlign = 'center';
    return;
  }

  if (mode === 'torch') {
    const on = st.torch ?? 0;
    g.fillStyle = '#05070A';
    g.fillRect(0, 0, w, h);
    statusBar(g, w, st);
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
    g.fillText(st.torchMode || 'свет из петли · 900 лм', w / 2, h * 0.5);
  }
}

/* ---------- Внешний экран ---------- */

export function drawCover(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const now = st.now ?? performance.now();
  const ui = st.ui || '#7FA8FF';
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  if (mode === 'off') return;
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  const d = new Date();
  if (mode === 'camera' || mode === 'iris') {
    // «Зеркало»: внешний экран показывает кадр тому, кого снимают
    g.save();
    g.translate(w, 0);
    g.scale(-1, 1);
    drawDunes(g, w, h, { accent: ui, t: now / 1000 });
    g.restore();
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.fillRect(0, h * 0.82, w, h * 0.18);
    g.font = MONO(26, 700);
    g.fillStyle = '#FFC93C';
    g.fillText('«ЗЕРКАЛО» · ВАС СНИМАЮТ', w / 2, h * 0.9);
    if ((st.iris ?? 0) > 0.95) {
      g.fillStyle = 'rgba(5,6,10,.92)';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#FF6B5A';
      g.fillText('ДИАФРАГМА ЗАКРЫТА', w / 2, h / 2);
    }
    return;
  }
  drawDunes(g, w, h, { accent: ui, t: now / 1000, dim: 0.95 });
  g.font = MONO(22, 600);
  g.fillStyle = 'rgba(244,247,255,.8)';
  g.fillText(mode === 'guest' ? 'ГОСТЕВАЯ ДВЕРЬ' : 'CamelOS 2', w / 2, 120);
  g.fillStyle = '#F4F7FF';
  g.font = SANS(176, 640);
  g.fillText(pad2(d.getHours()), w / 2, h * 0.28);
  g.fillText(pad2(d.getMinutes()), w / 2, h * 0.44);
  g.font = SANS(30, 500);
  g.fillStyle = 'rgba(244,247,255,.8)';
  g.fillText(mode === 'guest' ? 'Звонки, камера и карты' : 'Раскройте, чтобы продолжить', w / 2, h * 0.55);
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const std = (name, color, o = {}) => new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.45, ...o });
  const mats = {
    Body: std('Body', BF_COLORS.signal.body),
    Island: std('Island', BF_COLORS.signal.island),
    Frame: std('Frame', BF_COLORS.signal.frame, { metalness: 0.9, roughness: 0.3 }),
    Ring: std('Ring', BF_COLORS.signal.frame, { metalness: 0.9, roughness: 0.28 }),
    Hinge: std('Hinge', BF_COLORS.signal.hinge, { metalness: 0.9, roughness: 0.2 }),
    Lens: std('Lens', 0x020306, { roughness: 0.05, clearcoat: 1 }),
    Blade: std('Blade', 0x2A2C31, { metalness: 0.85, roughness: 0.3 }),
    Screen: std('Screen', 0x020203),
    CoverScreen: std('CoverScreen', 0x020203),
    Rubilnik: std('Rubilnik', 0x2F6BFF, { metalness: 0.5, roughness: 0.3 }),
    TorchGlow: std('TorchGlow', 0xEDEDED, { emissive: 0xFFFFFF, emissiveIntensity: 0.4 }),
  };
  const root = new THREE.Group();
  root.name = 'OYButterfly';
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
    const m = add(geo, mat, x, 0, z, name, parent);
    return m;
  };
  // ось петли — glTF z = +2,65 мм (перед экраном); половины строятся от неё
  const pz = -PIVOT_Y;
  add(slab(HALF_W, H, 8, 4.6, 0.4, 10), 'Frame', GAP + HALF_W / 2, 0, 0, 'FrameR');
  add(slab(HALF_W - 1.4, H - 1.4, 7.4, 0.3, 0.1, 10), 'Body', GAP + HALF_W / 2, 0, -2.35, 'BodyR');
  screenPlane(SCR.w / 2, SCR.h, 0.5, 1, 'ScreenR', 'Screen', root, SCR.w / 4, 2.45);
  const left = new THREE.Group();
  left.name = 'Left';
  left.position.z = pz * MM;
  root.add(left);
  add(slab(HALF_W, H, 8, 4.6, 0.4, 10), 'Frame', -(GAP + HALF_W / 2), 0, -pz, 'FrameL', left);
  screenPlane(SCR.w / 2, SCR.h, 0, 0.5, 'ScreenL', 'Screen', left, -SCR.w / 4, 2.45 - pz);
  const cover = screenPlane(COVER.w, COVER.h, 0, 1, 'Cover', 'CoverScreen', left, -(GAP + HALF_W / 2), -2.5 - pz);
  cover.rotation.y = Math.PI;
  const hinge = new THREE.Group();
  hinge.name = 'Hinge';
  hinge.position.z = pz * MM;
  root.add(hinge);
  const spine = add(new THREE.CylinderGeometry(4.95 * MM, 4.95 * MM, (H - 1) * MM, 32, 1, true, -1.5, 3), 'Hinge', 0, 0, 0, 'HingeCover', hinge);
  spine.rotation.y = Math.PI;
  // «Глаз»: кольцо, объективы, лепестки
  const ex = GAP + HALF_W / 2, ey = HH - 29.4;
  const ring = new THREE.Group();
  ring.name = 'IrisRing';
  ring.position.set(ex * MM, ey * MM, -2.4 * MM);
  root.add(ring);
  const rg = new THREE.Mesh(new THREE.TorusGeometry(22.4 * MM, 2.6 * MM, 12, 96), mats.Ring);
  ring.add(rg);
  for (const [dx, dy, r] of [[0, 10.8, 7.4], [-10.8, 0, 6.4], [10.8, 0, 6.4], [0, -10.8, 6.4]]) {
    const l = add(cylZ(r - 1.1, 0.8), 'Lens', ex + dx, ey + dy, -3.0);
    l.rotation.y = Math.PI;
  }
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

export function createOYButterfly({ phone, scale, isRunning }) {
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

  const bodyMat = new THREE.MeshPhysicalMaterial({
    name: 'Body', color: BF_COLORS.signal.body, metalness: 0, roughness: 0.5,
    clearcoat: 0.12, clearcoatRoughness: 0.34, envMapIntensity: 0.6,
    iridescence: 0, iridescenceIOR: 1.45, iridescenceThicknessRange: [240, 520],
  });
  const islandMat = bodyMat.clone();
  islandMat.name = 'Island';
  const frameMat = new THREE.MeshStandardMaterial({ name: 'Frame', color: BF_COLORS.signal.frame, metalness: 1, roughness: 0.3, envMapIntensity: 1.1 });
  const ringMat = new THREE.MeshStandardMaterial({ name: 'Ring', color: BF_COLORS.signal.frame, metalness: 1, roughness: 0.26, envMapIntensity: 1.3 });
  const hingeMat = new THREE.MeshStandardMaterial({ name: 'Hinge', color: BF_COLORS.signal.hinge, metalness: 1, roughness: 0.2, envMapIntensity: 1.3 });
  const keyMat = new THREE.MeshStandardMaterial({ name: 'PowerKey', color: BF_COLORS.signal.frame, metalness: 1, roughness: 0.2, envMapIntensity: 1.2 });
  const logoMat = new THREE.MeshStandardMaterial({ name: 'Logo', color: BF_COLORS.signal.frame, metalness: 1, roughness: 0.2, envMapIntensity: 1.4 });
  const glassMat = new THREE.MeshPhysicalMaterial({ name: 'EyeGlass', color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 0.8 });
  const bladeMat = new THREE.MeshStandardMaterial({ name: 'Blade', color: 0x2E3036, metalness: 0.85, roughness: 0.32, envMapIntensity: 1 });
  const bladeEdgeMat = new THREE.MeshStandardMaterial({ name: 'BladeEdge', color: 0x8A909A, metalness: 1, roughness: 0.24, envMapIntensity: 1.4 });

  let color = 'signal';
  const keys = ['body', 'island', 'frame', 'hinge'];
  const tgt = Object.fromEntries(keys.map((k) => [k, new THREE.Color()]));
  const cur = Object.fromEntries(keys.map((k) => [k, new THREE.Color()]));
  let irid = 0, iridTgt = 0;
  function setTargets(name) {
    const c = BF_COLORS[name];
    for (const k of keys) tgt[k].setHex(c[k]);
    iridTgt = c.film ? 1 : 0;
  }
  setTargets(color);
  for (const k of keys) cur[k].copy(tgt[k]);

  const screen = { mode: 'lock', cover: 'lock' };
  let lastDraw = 0;
  function redraw(now = performance.now()) {
    const st = { ...screen, now, ui: BF_COLORS[color].ui };
    drawInner(inner.c, screen.mode, st);
    drawCover(cover.c, screen.cover, st);
    inner.tex.needsUpdate = true;
    cover.tex.needsUpdate = true;
    lastDraw = now;
  }
  redraw();

  const parts = { root: null, left: null, hinge: null, ring: null, blades: [], rub: null, rub2: null, rubBase: 0, rub2Base: 0, torchMat: null };
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
          case 'Body': return bodyMat;
          case 'Island': case 'LensBezel': return islandMat;
          case 'Frame': return frameMat;
          case 'Ring': return ringMat;
          case 'Hinge': return hingeMat;
          case 'PowerKey': return keyMat;
          case 'Logo': return logoMat;
          case 'Screen': return inner.mat;
          case 'CoverScreen': return cover.mat;
          case 'EyeGlass': return glassMat;
          case 'Blade': return bladeMat;
          case 'BladeEdge': return bladeEdgeMat;
          default: return m;
        }
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
      if (o.material === glassMat) o.renderOrder = 5;
    });
    if (byName.Lens) { const m = byName.Lens; m.envMapIntensity = 0.45; m.roughness = 0.04; if ('clearcoat' in m) m.clearcoat = 1; }
    if (byName.LensCoat) { const m = byName.LensCoat; m.color.set(0x140F33); m.metalness = 0.5; m.roughness = 0.06; m.envMapIntensity = 0.9; }
    if (byName.LensInner) { const m = byName.LensInner; m.color.set(0x05070C); m.metalness = 0.6; m.roughness = 0.1; }
    // CPix 2 под пикселями: тот же экран, чуть темнее — видно только на просвет
    if (byName.CPix) { const m = byName.CPix; m.color.set(0x000000); m.transparent = true; m.opacity = 0.12; m.depthWrite = false; }
    parts.torchMat = byName.TorchGlow || null;
    if (parts.torchMat) { parts.torchMat.emissive = new THREE.Color(0xffffff); parts.torchMat.emissiveIntensity = 0.3; parts.torchMat.toneMapped = false; }
    parts.left = root.getObjectByName('Left');
    parts.hinge = root.getObjectByName('Hinge');
    parts.ring = root.getObjectByName('IrisRing');
    parts.blades = [];
    root.traverse((o) => { if (/^Blade\d\d$/.test(o.name)) parts.blades.push(o); });
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
    islandMat.color.copy(cur.island);
    frameMat.color.copy(cur.frame);
    ringMat.color.copy(cur.frame);
    keyMat.color.copy(cur.frame);
    logoMat.color.copy(cur.frame);
    hingeMat.color.copy(cur.hinge);
    bodyMat.iridescence = irid;
    islandMat.iridescence = irid * 0.6;
  }

  const torchPos = new THREE.Vector3();
  function update(st, dt, { reduced }) {
    const now = performance.now();
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));

    const fold = clamp01(st.fold);
    const a = fold * Math.PI;
    if (parts.left) parts.left.rotation.y = a;
    if (parts.hinge) parts.hinge.rotation.y = a / 2;
    // сложенный телефон — в центре кадра
    if (parts.root) parts.root.position.set(-FOLDED_SHIFT.x * fold, 0, -FOLDED_SHIFT.z * fold);

    const iris = clamp01(st.iris);
    const e = iris * iris * (3 - 2 * iris);
    if (parts.ring) parts.ring.rotation.z = IRIS_RING * e;
    for (const b of parts.blades) b.rotation.z = IRIS_BLADE * e;

    if (parts.rub) parts.rub.position.x = parts.rubBase - Math.max(0, Math.min(2, st.rub)) * RUB_STEP;
    if (parts.rub2) parts.rub2.position.x = parts.rub2Base + Math.max(0, Math.min(2, st.rub2)) * RUB_STEP;

    // фонарь в торце корешка: корешок повёрнут на половину угла сгиба
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
    // экран и видоискатель: камера живёт быстрее, часы — раз в секунду
    const camera = screen.mode === 'camera' || screen.mode === 'iris';
    if (camera) screen.iris = iris;
    if ((st.screen > 0.02 || st.cover > 0.02) && now - lastDraw > (camera ? 66 : 1000)) redraw(now);
  }

  return {
    url: '/models/oybutterfly.glb?v=86e5c0c15e',
    state: { fold: 0, iris: 0, rub: 0, rub2: 0, torch: 0, screen: 1, cover: 1 },
    parts,
    setup,
    buildFallback,
    update,
    snap() { stepColors(1); },
    api: {
      setBodyColor(name, instant = false) {
        if (!BF_COLORS[name] || name === color) return;
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
        screen.cover = extra.cover || (screen.mode === 'camera' || screen.mode === 'iris' ? screen.mode : extra.guest ? 'guest' : 'lock');
        Object.assign(screen, extra);
        redraw();
      },
      redrawScreen() { redraw(); },
    },
  };
}
