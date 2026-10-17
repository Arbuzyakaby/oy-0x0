/* =========================================================================
   Fyr KBook 1 — описание 3D-модели: магний-литиевый ноутбук 304 × 215 мм,
   11,4 мм. Крышка Lid поворачивается вокруг оси петли, ползунок
   «Рубильника» Switch на левом торце, шторка камеры CamShutter, подсветка
   клавиатуры KeyGlow, тритиевый логотип Glow_Logo. Экран CamelOS рисуется
   на canvas. Два цвета: «Полярная ночь» и «Луч». Процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';

const MM = 0.001;
export const KB_COLORS = {
  polarnatt: { body: 0x1A1D23, deck: 0x1A1D23, key: 0x0D0E11, chamfer: 0xA9B2C2, trit: 0x3D7BFF },
  stral: { body: 0xC4C8CF, deck: 0xC9CDD3, key: 0x2A2D33, chamfer: 0xF2F5FA, trit: 0xDDE8FF },
};
export const SCREEN_MODES = ['off', 'intercept', 'boot', 'desk', 'lock', 'filter'];
const LID_MAX = THREE.MathUtils.degToRad(118);
const SWITCH_TRAVEL = 3.2 * MM;
const SHUTTER_TRAVEL = 5.2 * MM;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---------- Рабочий стол CamelOS: ночные дюны и луч маяка ---------- */

// Детерминированные «звёзды»: одни и те же на экране ноутбука и на странице
const STARS = Array.from({ length: 140 }, (_, i) => {
  const r = (n) => { const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return x - Math.floor(x); };
  return [r(1), r(2) * 0.55, 0.4 + r(3) * 1.2, 0.25 + r(4) * 0.6];
});

export function drawDesk(canvas, { now = performance.now(), accent = '#2F6BFF', beam = true } = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#03050A');
  sky.addColorStop(0.55, '#0A1226');
  sky.addColorStop(1, '#101B38');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const k = Math.min(w, h) / 1000;
  for (const [x, y, r, a] of STARS) {
    g.fillStyle = `rgba(220,230,255,${a})`;
    g.beginPath();
    g.arc(x * w, y * h, r * k * 1.4, 0, Math.PI * 2);
    g.fill();
  }
  // луч маяка из правого края
  if (beam) {
    const ang = Math.sin(now / 4200) * 0.22 + Math.PI * 1.04;
    const ox = w * 0.86, oy = h * 0.5;
    const grad = g.createRadialGradient(ox, oy, 0, ox, oy, w * 0.9);
    grad.addColorStop(0, 'rgba(127,164,255,.32)');
    grad.addColorStop(1, 'rgba(127,164,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(ox, oy);
    g.arc(ox, oy, w * 0.9, ang - 0.07, ang + 0.07);
    g.closePath();
    g.fill();
    g.fillStyle = '#E8F0FF';
    g.beginPath();
    g.arc(ox, oy, 3.2 * k, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0A1022';
    g.fillRect(ox - 4 * k, oy + 3 * k, 8 * k, h * 0.08);
  }
  // дюны: четыре слоя, ближние темнее
  const layers = [
    [0.62, 0.05, 1.3, '#16244A'],
    [0.7, 0.06, 2.1, '#111C3A'],
    [0.79, 0.05, 1.6, '#0C142B'],
    [0.88, 0.045, 2.6, '#070C1B'],
  ];
  layers.forEach(([base, amp, f, col], i) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 80) {
      const t = x / w;
      const y = base + amp * Math.sin(t * Math.PI * f + i * 1.7) * Math.cos(t * Math.PI * 0.7 + i);
      g.lineTo(x, y * h);
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();
  });
  // караван на гребне: точки-верблюды цвета акцента
  g.fillStyle = accent;
  for (let i = 0; i < 4; i++) {
    const x = w * (0.2 + i * 0.028);
    const y = h * (0.7 + 0.06 * Math.sin((0.2 + i * 0.028) * Math.PI * 2.1 + 1.7) * Math.cos((0.2 + i * 0.028) * Math.PI * 0.7 + 1)) - 4 * k;
    g.beginPath();
    g.arc(x, y, 2.6 * k, 0, Math.PI * 2);
    g.fill();
  }
}

/* ---------- Экран ноутбука ---------- */

const pad2 = (n) => String(n).padStart(2, '0');

export function drawScreen(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const now = st.now ?? performance.now();
  const accent = st.accent || '#2F6BFF';
  const mono = (px, wt = 600) => `${wt} ${px}px "JetBrains Mono", ui-monospace, monospace`;
  const sans = (px, wt = 700) => `${wt} ${px}px "Onest", system-ui, sans-serif`;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  if (mode === 'off') return;
  g.textBaseline = 'middle';

  if (mode === 'intercept') {
    const sig = '0x0A050A14060F0117150B0E1D14061106121E030E06131406';
    g.fillStyle = 'rgba(47,107,255,.07)';
    g.fillRect(0, 0, w, h);
    g.font = mono(h * 0.026, 500);
    g.fillStyle = 'rgba(127,164,255,.42)';
    g.textAlign = 'left';
    for (let r = 0; r < 22; r++) {
      const off = ((now / 30) + r * 211) % (w * 1.6);
      g.fillText(sig, w - off, h * 0.04 + r * h * 0.046);
    }
    g.textAlign = 'center';
    g.fillStyle = '#F4F7FF';
    g.font = sans(h * 0.13, 760);
    g.fillText('KBook 1', w / 2, h * 0.47);
    g.font = mono(h * 0.03, 500);
    g.fillStyle = 'rgba(244,247,255,.7)';
    g.fillText('SIGNAL INTERCEPTED · FYR', w / 2, h * 0.6);
    return;
  }

  if (mode === 'boot') {
    const lines = ['oasis 1.0 · ядро Fyr', 'd1: ключи на месте', 'd1: хеш системы ··· ok · мы проверили', 'actinium 1: 12 ядер', 'fig one: 16 ядер', 'radio: рубильник вкл', 'camelos 1 · добро пожаловать'];
    g.textAlign = 'left';
    g.font = mono(h * 0.034, 500);
    const shown = Math.min(lines.length, Math.floor((now / 380) % (lines.length + 4)));
    for (let i = 0; i < shown; i++) {
      g.fillStyle = i === 2 ? accent : 'rgba(244,247,255,.78)';
      g.fillText(`[ ${(i * 0.137).toFixed(3)} ] ${lines[i]}`, w * 0.06, h * 0.12 + i * h * 0.07);
    }
    return;
  }

  drawDesk(canvas, { now, accent });
  // строка CamelOS
  const bar = h * 0.045;
  g.fillStyle = 'rgba(3,5,10,.62)';
  g.fillRect(0, 0, w, bar);
  g.font = mono(bar * 0.48, 600);
  g.fillStyle = '#F4F7FF';
  g.textAlign = 'left';
  g.fillText('CamelOS', w * 0.015, bar / 2);
  g.textAlign = 'right';
  const d = new Date();
  g.fillText(`24 ч · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`, w * 0.985, bar / 2);

  if (mode === 'desk') {
    // два окна: терминал и «Первая настройка»
    const win = (x, y, ww, hh, title) => {
      g.fillStyle = 'rgba(10,14,21,.86)';
      g.strokeStyle = 'rgba(160,190,255,.22)';
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect ? g.roundRect(x, y, ww, hh, 14) : g.rect(x, y, ww, hh);
      g.fill();
      g.stroke();
      g.fillStyle = 'rgba(244,247,255,.6)';
      g.font = mono(h * 0.022, 600);
      g.textAlign = 'left';
      g.fillText(title, x + 18, y + h * 0.03);
    };
    win(w * 0.07, h * 0.14, w * 0.42, h * 0.38, '~ терминал');
    g.font = mono(h * 0.022, 500);
    ['$ uname', 'Oasis 1.0', '$ d1 verify', 'ok · мы проверили', '$ oy-id login', 'команда не найдена'].forEach((l, i) => {
      g.fillStyle = l.startsWith('$') ? accent : 'rgba(244,247,255,.75)';
      g.fillText(l, w * 0.07 + 22, h * 0.22 + i * h * 0.045);
    });
    win(w * 0.53, h * 0.24, w * 0.38, h * 0.3, 'первая настройка');
    g.fillStyle = '#F4F7FF';
    g.font = sans(h * 0.04, 700);
    g.fillText('Выберите всё.', w * 0.53 + 22, h * 0.34);
    g.fillStyle = 'rgba(244,247,255,.55)';
    g.font = sans(h * 0.026, 500);
    g.fillText('Мы не выбрали за вас ничего.', w * 0.53 + 22, h * 0.4);
  } else if (mode === 'lock') {
    g.fillStyle = 'rgba(3,5,10,.6)';
    g.fillRect(0, bar, w, h - bar);
    g.strokeStyle = '#F4F7FF';
    g.lineWidth = h * 0.012;
    g.beginPath();
    g.arc(w / 2, h * 0.4, h * 0.05, Math.PI, 0);
    g.stroke();
    g.fillStyle = '#F4F7FF';
    g.fillRect(w / 2 - h * 0.075, h * 0.4, h * 0.15, h * 0.11);
    g.textAlign = 'center';
    g.font = sans(h * 0.04, 700);
    g.fillText('Часы далеко', w / 2, h * 0.62);
    g.font = mono(h * 0.024, 500);
    g.fillStyle = 'rgba(244,247,255,.6)';
    g.fillText('Osmium X0 > 3 м · заперто', w / 2, h * 0.68);
  } else if (mode === 'filter') {
    // «Шторка»: под углом остаётся только тёмное пятно
    g.fillStyle = 'rgba(0,0,0,.94)';
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.font = mono(h * 0.03, 500);
    g.fillStyle = 'rgba(127,164,255,.35)';
    g.fillText('шторка', w / 2, h / 2);
  }
}

/* ---------- Клавиатура: раскладка MacBook, подписи Fyr ---------- */

// Та же сетка, что в blender/build_fyrkbook.py (ROWS): колодец 266 × 104 мм,
// шаг 18 мм, функциональный ряд 10,8 мм. UV клавиш — по колодцу.
const KB = { w: 266, d: 104, cy: 34, u: 18, gap: 1.5, frow: 10.8 };
const F_WORDS = ['ярк −', 'ярк +', 'шторка', 'окна', 'свет −', 'свет +', 'назад', 'пуск', 'вперёд', 'тихо', 'звук −', 'звук +'];
const k = (m, s = '', c = '') => ({ m, s, c });
const row = (main, shift = '', cyr = []) => main.split(' ').map((m, i) => k(m, shift.split(' ')[i] || '', cyr[i] || ''));
export const KEY_ROWS = [
  [KB.frow, [[1.5, { mod: 'esc' }], ...F_WORDS.map((w, i) => [1, { fn: `0x${(i + 1).toString(16).toUpperCase()}`, w }]), [1, { seal: true }]]],
  [KB.u, [...row('` 1 2 3 4 5 6 7 8 9 0 - =', '~ ! @ # $ % ^ & * ( ) _ +', ['Ё']).map((x) => [1, x]), [1.5, { mod: 'del', right: true }]]],
  [KB.u, [[1.5, { mod: 'tab' }], ...row('q w e r t y u i o p [ ] \\', '- - - - - - - - - - { } |', [...'ЙЦУКЕНГШЩЗХЪ']).map((x) => [1, { ...x, s: x.s === '-' ? '' : x.s }])]],
  [KB.u, [[1.75, { mod: 'caps' }], ...row("a s d f g h j k l ; '", '- - - - - - - - - : "', [...'ФЫВАПРОЛДЖЭ']).map((x) => [1, { ...x, s: x.s === '-' ? '' : x.s }]), [1.75, { mod: 'enter', right: true }]]],
  [KB.u, [[2.25, { mod: 'shift' }], ...row('z x c v b n m , . /', '- - - - - - - < > ?', [...'ЯЧСМИТЬБЮ.']).map((x) => [1, { ...x, s: x.s === '-' ? '' : x.s }]), [2.25, { mod: 'shift', right: true }]]],
  [KB.u, [[1, { mod: 'fn' }], [1, { mod: 'ctrl' }], [1, { mod: 'alt' }], [1.25, { fyr: true }], [5, { space: true }], [1.25, { fyr: true, right: true }], [1, { mod: 'alt', right: true }], ['arrows']]],
];

export function keyRects() {
  const out = [];
  let y = KB.cy + KB.d / 2 - 1.6;
  for (const [h, keys] of KEY_ROWS) {
    const total = keys.reduce((a, [u]) => a + (u === 'arrows' ? 3 : u), 0) * KB.u;
    let x = -total / 2;
    const kh = h - KB.gap;
    const cy = y - h / 2;
    for (const [u, lab] of keys) {
      if (u === 'arrows') {
        const hh = (kh - 0.8) / 2, kw = KB.u - KB.gap;
        const lo = cy - kh / 2 + hh / 2, hi = cy + kh / 2 - hh / 2;
        out.push(
          { cx: x + KB.u / 2, cy: lo, w: kw, h: hh, lab: { arrow: 'l' } },
          { cx: x + 1.5 * KB.u, cy: hi, w: kw, h: hh, lab: { arrow: 'u' } },
          { cx: x + 1.5 * KB.u, cy: lo, w: kw, h: hh, lab: { arrow: 'd' } },
          { cx: x + 2.5 * KB.u, cy: lo, w: kw, h: hh, lab: { arrow: 'r' } },
        );
        x += 3 * KB.u;
        continue;
      }
      out.push({ cx: x + (u * KB.u) / 2, cy, w: u * KB.u - KB.gap, h: kh, lab });
      x += u * KB.u;
    }
    y -= h;
  }
  return out;
}

// Подписи клавиш: bg — цвет клавиш (null — чёрный фон для маски подсветки)
export function drawKeys(canvas, { bg = '#0D0E11', ink = '#E6EBF5', cyr = '#7FA4FF', glow = false } = {}) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const px = W / KB.w;
  const X = (x) => (x + KB.w / 2) * px;
  const Y = (y) => (KB.cy + KB.d / 2 - y) * px;
  g.fillStyle = glow ? '#000' : bg;
  g.fillRect(0, 0, W, H);
  const mono = (mm, wt = 500) => `${wt} ${Math.round(mm * px)}px "JetBrains Mono", ui-monospace, monospace`;
  const sans = (mm, wt = 700) => `${wt} ${Math.round(mm * px)}px "Onest", system-ui, sans-serif`;
  const inkC = glow ? '#FFFFFF' : ink;
  const cyrC = glow ? '#C8D6FF' : cyr;
  for (const r of keyRects()) {
    const L = r.lab;
    const x0 = X(r.cx - r.w / 2), x1 = X(r.cx + r.w / 2);
    const y0 = Y(r.cy + r.h / 2), y1 = Y(r.cy - r.h / 2);
    const pad = 1.6 * px;
    g.fillStyle = inkC;
    g.textBaseline = 'alphabetic';
    if (L.fn) {
      g.textAlign = 'center';
      g.font = mono(2.6, 700);
      g.fillText(L.fn, (x0 + x1) / 2, y0 + 4.2 * px);
      g.font = mono(1.55, 500);
      g.fillStyle = glow ? '#FFFFFF' : 'rgba(230,235,245,.6)';
      g.fillText(L.w, (x0 + x1) / 2, y1 - 1.3 * px);
    } else if (L.mod) {
      g.textAlign = L.right ? 'right' : 'left';
      g.font = mono(2.3, 500);
      g.fillText(L.mod, L.right ? x1 - pad : x0 + pad, y1 - pad);
    } else if (L.fyr) {
      g.textAlign = L.right ? 'left' : 'right';
      g.font = sans(3.4, 760);
      g.fillText('fyr', L.right ? x0 + pad : x1 - pad, y1 - pad);
      g.fillStyle = glow ? '#FFFFFF' : '#2F6BFF';
      g.beginPath();
      g.arc(L.right ? x0 + pad + 3.2 * px : x1 - pad - 2.5 * px, y1 - pad - 3.6 * px, 0.45 * px, 0, Math.PI * 2);
      g.fill();
    } else if (L.arrow) {
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, s = 1.3 * px;
      const pts = { l: [[-s, 0], [s * 0.7, -s], [s * 0.7, s]], r: [[s, 0], [-s * 0.7, -s], [-s * 0.7, s]], u: [[0, -s], [-s, s * 0.7], [s, s * 0.7]], d: [[0, s], [-s, -s * 0.7], [s, -s * 0.7]] }[L.arrow];
      g.beginPath();
      pts.forEach(([dx, dy], i) => (i ? g.lineTo(cx + dx, cy + dy) : g.moveTo(cx + dx, cy + dy)));
      g.closePath();
      g.fill();
    } else if (L.m) {
      // латиница — строчная, моно; кириллица — синим в правом нижнем углу; верхний символ — над основным
      g.textAlign = 'left';
      if (L.s) {
        g.font = mono(2.6, 500);
        g.fillText(L.s, x0 + pad, y0 + 4.4 * px);
        g.font = mono(2.9, 600);
        g.fillText(L.m, x0 + pad, y1 - pad);
      } else {
        g.font = mono(3.6, 600);
        g.fillText(L.m, x0 + pad, y0 + 5.2 * px);
      }
      if (L.c) {
        g.fillStyle = cyrC;
        g.textAlign = 'right';
        g.font = sans(3.0, 600);
        g.fillText(L.c, x1 - pad, y1 - pad);
      }
    }
  }
}

/* ---------- Резервная модель (без GLB) ---------- */

function buildFallback() {
  const std = (name, color, o = {}) => new THREE.MeshStandardMaterial({ name, color, roughness: 0.4, ...o });
  const mats = {
    Body: std('Body', 0x1A1D23, { metalness: 0.85, roughness: 0.32 }),
    Key: std('Key', 0x0D0E11),
    KeyGlow: std('KeyGlow', 0x0B0D12, { emissive: 0xBFD2FF, emissiveIntensity: 0 }),
    Pad: std('Pad', 0x1F232A),
    Screen: std('Screen', 0x020306),
    Bezel: std('Bezel', 0x050608),
    Shutter: std('Shutter', 0x2A2E35),
    Switch: std('Switch', 0x2F6BFF),
    Tritium: std('Tritium', 0x9FB8FF, { emissive: 0x3D7BFF, emissiveIntensity: 1 }),
  };
  const root = new THREE.Group();
  root.name = 'FyrKBook';
  // в glTF: X — ширина, Y — вверх, Z — к зрителю (перед ноутбука)
  const box = (w, h, d, x, y, z, mat, name, parent = root) => {
    const geo = new THREE.BoxGeometry(w * MM, h * MM, d * MM);
    geo.translate(x * MM, y * MM, z * MM);
    const m = new THREE.Mesh(geo, mats[mat]);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };
  box(304, 6.4, 215, 0, 3.2, 0, 'Body', 'Base');
  box(264, 0.1, 102, 0, 5.45, -34, 'KeyGlow', 'KeyGlow');
  box(260, 0.6, 98, 0, 5.9, -34, 'Key', 'Keys');
  box(130, 0.2, 82, 0, 6.35, 60, 'Pad', 'Trackpad');
  const sw = new THREE.Group();
  sw.name = 'Switch';
  sw.position.set(-152 * MM, 3 * MM, 17.5 * MM);
  root.add(sw);
  box(1.4, 2, 5, -0.2, 0, 0, 'Switch', null, sw);
  const lid = new THREE.Group();
  lid.name = 'Lid';
  lid.position.set(0, 6.4 * MM, -104 * MM);
  root.add(lid);
  box(304, 4.6, 215, 0, 2.6, 103.5, 'Body', 'LidShell', lid);
  box(302, 0.3, 213, 0, 0.3, 103.5, 'Bezel', 'Bezel', lid);
  // экран: плоскость, смотрит вниз (−Y) в закрытом виде
  const scr = new THREE.PlaneGeometry(289 * MM, 188 * MM);
  scr.rotateX(Math.PI / 2);
  scr.translate(0, 0.12 * MM, (103.5 - 107.5 + 8 + 94) * MM);
  const scrMesh = new THREE.Mesh(scr, mats.Screen);
  scrMesh.name = 'Screen';
  lid.add(scrMesh);
  const sh = new THREE.Group();
  sh.name = 'CamShutter';
  sh.position.set(5.2 * MM, 0.15 * MM, 211.5 * MM - 4 * MM);
  lid.add(sh);
  box(5.6, 0.3, 4.6, 0, -0.3, 0, 'Shutter', null, sh);
  box(60, 0.1, 18, 0, 5.05, 103.5, 'Tritium', 'Glow_Logo', lid);
  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createFyrKBook() {
  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = 1280;
  scrCanvas.height = 832;
  const scrTex = new THREE.CanvasTexture(scrCanvas);
  scrTex.colorSpace = THREE.SRGBColorSpace;
  scrTex.flipY = false;
  scrTex.anisotropy = 8;
  const screenMat = new THREE.MeshStandardMaterial({
    name: 'Screen', color: 0x000000, roughness: 0.18, emissive: 0xffffff, emissiveMap: scrTex, emissiveIntensity: 1,
  });
  screenMat.toneMapped = false;
  // экран лежит на 0,02 мм ниже чёрной рамки: на расстоянии буфер глубины их путает,
  // и по экрану бегут тёмные полосы. Сдвиг глубины держит экран всегда поверх рамки
  screenMat.polygonOffset = true;
  screenMat.polygonOffsetFactor = -2;
  screenMat.polygonOffsetUnits = -8;

  const bodyMat = new THREE.MeshPhysicalMaterial({ name: 'Body', color: KB_COLORS.polarnatt.body, metalness: 0.85, roughness: 0.34, clearcoat: 0.15, envMapIntensity: 1.3 });
  const deckMat = new THREE.MeshPhysicalMaterial({ name: 'Deck', color: KB_COLORS.polarnatt.deck, metalness: 0.8, roughness: 0.4, envMapIntensity: 1.2 });
  const chamferMat = new THREE.MeshStandardMaterial({ name: 'Chamfer', color: KB_COLORS.polarnatt.chamfer, metalness: 1, roughness: 0.12, envMapIntensity: 2 });
  // подписи клавиш: цветная текстура и маска подсветки — светятся только символы
  const keyTexOf = () => {
    const c = document.createElement('canvas');
    c.width = 2048;
    c.height = Math.round((2048 * KB.d) / KB.w);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    t.anisotropy = 8;
    return [c, t];
  };
  const [keyCanvas, keyTex] = keyTexOf();
  const [glowCanvas, glowTex] = keyTexOf();
  drawKeys(glowCanvas, { glow: true });
  const keyMat = new THREE.MeshStandardMaterial({
    name: 'Key', color: 0xffffff, map: keyTex, roughness: 0.78, metalness: 0, envMapIntensity: 0.3,
    emissive: 0xBFD2FF, emissiveMap: glowTex, emissiveIntensity: 0,
  });
  const drawKeyTex = () => {
    drawKeys(keyCanvas, { bg: '#' + KB_COLORS[color].key.toString(16).padStart(6, '0') });
    keyTex.needsUpdate = true;
  };
  const glowMat = new THREE.MeshStandardMaterial({ name: 'KeyGlow', color: 0x0B0D12, emissive: 0xBFD2FF, emissiveIntensity: 0, roughness: 0.6 });
  glowMat.toneMapped = false;
  const tritMat = new THREE.MeshStandardMaterial({ name: 'Tritium', color: 0x9FB8FF, emissive: KB_COLORS.polarnatt.trit, emissiveIntensity: 1, roughness: 0.3 });
  tritMat.toneMapped = false;
  const switchMat = new THREE.MeshStandardMaterial({ name: 'Switch', color: 0x2F6BFF, metalness: 0.4, roughness: 0.35 });

  const screen = { mode: 'intercept' };
  let color = 'polarnatt';
  let lastDraw = 0;
  function redrawScreen(now = performance.now()) {
    drawScreen(scrCanvas, screen.mode, { now, accent: screen.accent || '#2F6BFF' });
    scrTex.needsUpdate = true;
    lastDraw = now;
  }
  redrawScreen();

  const parts = { lid: null, sw: null, swBase: 0, shutter: null, shBase: 0 };
  let lastDark = -1;

  function setup(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const swap = (m) => {
        switch (m?.name) {
          case 'Body': return bodyMat;
          case 'Deck': return deckMat;
          case 'Chamfer': return chamferMat;
          case 'Key': return keyMat;
          case 'KeyGlow': return glowMat;
          case 'Screen': return screenMat;
          case 'Tritium': return tritMat;
          case 'Switch': return switchMat;
          default: return m;
        }
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
    parts.lid = root.getObjectByName('Lid');
    parts.sw = root.getObjectByName('Switch');
    parts.swBase = parts.sw ? parts.sw.position.z : 0;
    parts.shutter = root.getObjectByName('CamShutter');
    parts.shBase = parts.shutter ? parts.shutter.position.x : 0;
    applyColor();
  }

  function applyColor() {
    const c = KB_COLORS[color];
    bodyMat.color.setHex(c.body);
    deckMat.color.setHex(c.deck);
    drawKeyTex();
    chamferMat.color.setHex(c.chamfer);
    tritMat.emissive.setHex(c.trit);
    lastDark = -1;
  }

  function update(cur, dt, { reduced }) {
    const now = performance.now();
    if (parts.lid) parts.lid.rotation.x = -clamp01(cur.lid) * LID_MAX;
    if (parts.sw) parts.sw.position.z = parts.swBase + clamp01(cur.sw) * SWITCH_TRAVEL;
    if (parts.shutter) parts.shutter.position.x = parts.shBase - clamp01(cur.shut) * SHUTTER_TRAVEL;
    screenMat.emissiveIntensity = clamp01(cur.screen) * 1.05;
    glowMat.emissiveIntensity = clamp01(cur.keys) * 0.35;
    keyMat.emissiveIntensity = clamp01(cur.keys) * 1.6;
    const breath = reduced ? 1 : 0.92 + 0.08 * Math.sin(now / 900);
    tritMat.emissiveIntensity = (0.55 + clamp01(cur.dark) * 3.2) * breath;
    // «Темно»: корпус уходит в тень, светится только логотип
    const d = clamp01(cur.dark);
    if (Math.abs(d - lastDark) > 0.002) {
      lastDark = d;
      const c = KB_COLORS[color];
      const k = 1 - 0.9 * d;
      bodyMat.color.setHex(c.body).multiplyScalar(k);
      deckMat.color.setHex(c.deck).multiplyScalar(k);
      chamferMat.color.setHex(c.chamfer).multiplyScalar(k);
      keyMat.color.setScalar(k);
      for (const m of [bodyMat, deckMat, chamferMat]) m.envMapIntensity = (m.userData.env ??= m.envMapIntensity) * k;
    }
    const live = screen.mode !== 'off' && screen.mode !== 'filter' && cur.screen > 0.02 && cur.lid > 0.05;
    if (live && now - lastDraw > (screen.mode === 'intercept' || screen.mode === 'boot' ? 40 : 120)) redrawScreen(now);
  }

  return {
    url: '/models/fyrkbook.glb?v=ae5bdbfe69',
    state: { lid: 0, sw: 0, shut: 0, screen: 1, keys: 0, dark: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap: applyColor,
    api: {
      setBodyColor(name) { if (KB_COLORS[name]) { color = name; applyColor(); } },
      setScreen(mode, extra = {}) {
        screen.mode = SCREEN_MODES.includes(mode) ? mode : 'desk';
        Object.assign(screen, extra);
        redrawScreen();
      },
      redrawScreen() { redrawScreen(); drawKeyTex(); drawKeys(glowCanvas, { glow: true }); glowTex.needsUpdate = true; },
    },
  };
}
