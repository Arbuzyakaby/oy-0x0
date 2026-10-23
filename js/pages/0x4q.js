/* =========================================================================
   OY 0X4Q — сделано в амбаре. Телефон висит на общем холсте и танцует:
   на первом экране, в CamelOS и в цветах он крутится, качается и
   подпрыгивает. Сцены: «мыло» кончилось — телефон показывает ребро и
   ступеньку модуля; «Прогулка по спинке» — телефон ложится горизонтально,
   камера едет по матовому стеклу к «Планке», и модуль снимается; «Шесть
   Планок» — модули меняются по прокрутке, «Шторка» закрывается; подпись
   обновления «2 из 3», кнопки «0» и «1», фонарь, двенадцать винтов, цвета.
   Прогресс — линия метро со станциями-главами.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createKeys } from '../core/keys.js';
import { createOY0X4Q, Q4_COLORS, MODULES } from '../models/oy0x4q.js';
import { $, $$, clamp01, createToast, syncRadio, initRadioGroup, store } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const toast = createToast($('#toast'), gsap);
const ease = (t) => { const c = clamp01(t); return c * c * (3 - 2 * c); };
const span = (p, a, b) => clamp01((p - a) / (b - a));
const PI = Math.PI;
const fmt = (n, d = 1) => n.toFixed(d).replace('.', ',');
const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOY0X4Q, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Главы и линия метро ---------- */

const CHAPTERS = ['hero', 'brand', 'design', 'planka', 'modules', 'regions', 'nc4', 'tesseract', 'keys', 'torch', 'camelos', 'power', 'colors', 'buy', 'specs'];
const PINNED = { design: '+=170%', planka: '+=360%', modules: '+=440%', power: '+=170%', colors: '+=280%' };
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
const stops = $$('[data-stop]');
const STOP_OF = { specs: 'buy' };
let current = '';
let reducedMode = false;

function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  if (id === current) return;
  current = id;
  // в «Прогулке» подписи лежат поверх телефона: он слишком близко к камере
  root.classList.toggle('q-over', id === 'planka');
  // вне главы о модулях на спинке — модуль из коробки
  stage?.setModule(id === 'modules' ? demo.module : demo.bundle);
  const on = STOP_OF[id] || id;
  const idx = stops.findIndex((a) => a.dataset.stop === on);
  stops.forEach((a, i) => { a.classList.toggle('is-on', i === idx); a.classList.toggle('is-past', i < idx); });
  updateScreen();
}

const metroFill = $('[data-metro-fill]');
const metroTrain = $('[data-metro-train]');
const metroLine = $('.q-metro__line');
function paintMetro(f) {
  metroFill.style.transform = `scaleX(${f.toFixed(4)})`;
  metroTrain.style.transform = `translateX(${(f * metroLine.clientWidth).toFixed(1)}px)`;
}

/* ---------- Состояние демо ---------- */

const demo = {
  color: 'tuile', module: 'classic', bundle: 'classic', modIdx: 0, shutter: 0, pull: 0,
  key0: 0, key1: 0, torch: 'off', keys: [0, 0, 0], region: 'eu',
  hop: 0, hopDir: 1, twirl: 0, planka: 0, colorIdx: 0,
};

/* ---------- Экран телефона ---------- */

let lastScreenKey = '';
function updateScreen(force = false) {
  if (!stage) return;
  let mode = 'lock';
  const extra = { key0: demo.key0, key1: demo.key1, region: demo.region };
  if (current === 'modules') { mode = 'camera'; extra.module = demo.module; }
  else if (current === 'tesseract') { mode = 'sign'; extra.keys = [...demo.keys]; }
  else if (current === 'keys') mode = 'kill';
  else if (current === 'torch') { mode = 'torch'; extra.torch = demo.torch === 'off' ? 0 : 1; extra.torchColor = demo.torch === 'red' ? 'red' : 'white'; extra.torchMode = TORCH[demo.torch].mode; }
  else if (current === 'camelos') mode = 'boot';
  const key = mode + JSON.stringify(extra);
  if (key === lastScreenKey && !force) return;
  lastScreenKey = key;
  stage.setScreen(mode, extra);
}

/* ---------- Позы ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели (единицы сцены: мм × 0,01)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, dist: 5.4, float: 1, vis: 1, spin: 0, pull: 0, shutter: 0, key0: 0, key1: 0, torch: 0, screen: 1 };
const BACK_Z = -0.042;      // поверхность спинки
const MOD_Y = 0.63;         // центр «Планки» по высоте
function makePoses(mobile) {
  const P = {
    far: { x: 0.35, rx: 0.9, ry: PI + 2.6, rz: -0.6, dist: 30, float: 0 },
    hero: { x: 0.36, y: 0.02, rx: 0.08, ry: PI - 0.45, rz: 0.05, dist: 5.6 },
    brand: { x: 0.36, rx: 0.12, ry: PI + 0.38, rz: -0.07, dist: 5 },
    // ребро: левая грань с кнопками «0» и «1», потом поворот к ступеньке модуля
    design0: { x: 0.12, rx: 0.04, ry: PI / 2 - 0.06, rz: 0, dist: 4.4, float: 0.3 },
    design1: { x: 0.12, y: -0.04, fy: 0.3, rx: 0.32, ry: PI - 1.15, rz: 0.02, dist: 3.4, float: 0.3 },
    // «Прогулка по спинке»: телефон лежит горизонтально, «Планкой» вправо
    walk0: { x: -0.06, rx: 0.05, ry: PI, rz: PI / 2, dist: 6.6, float: 0.2 },
    walk1: { x: -0.22, fy: -0.62, fz: BACK_Z, rx: 0.12, ry: PI + 0.62, rz: PI / 2, dist: 2.1, float: 0 },
    walk2: { x: -0.22, fy: 0.12, fz: BACK_Z, rx: 0.08, ry: PI + 0.5, rz: PI / 2, dist: 1.95, float: 0 },
    walk3: { x: -0.22, fy: MOD_Y, fz: BACK_Z, rx: 0.05, ry: PI + 0.3, rz: PI / 2, dist: 1.75, float: 0 },
    walk4: { x: -0.16, fy: MOD_Y - 0.05, fz: BACK_Z - 0.1, rx: 0.22, ry: PI + 0.42, rz: PI / 2 + 0.08, dist: 2.2, float: 0, pull: 1 },
    modules: { x: 0.24, y: -0.04, fy: 0.42, rx: 0.3, ry: PI - 0.32, rz: 0.04, dist: 2.7, float: 0.3 },
    tesseract: { x: 0.3, rx: 0.06, ry: -0.3, rz: 0.02, dist: 4.8 },
    keys: { x: -0.28, fy: 0.24, rx: 0.08, ry: PI / 2 - 0.42, rz: 0, dist: 2.8, float: 0.3 },
    torch: { x: 0.3, y: -0.06, fy: 0.62, rx: 1.0, ry: 0.42, rz: -0.06, dist: 2.4, float: 0.15 },
    camelos: { x: -0.3, rx: 0.05, ry: 0.32, rz: -0.03, dist: 4.9 },
    colors: { x: 0.28, rx: 0.1, ry: PI - 0.4, rz: 0.04, dist: 5 },
    hidden: { rx: 0.3, ry: PI - 0.8, dist: 16, float: 0, vis: 0 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  if (!mobile) return P;
  // телефон: модель в верхней половине экрана, текст ниже
  for (const k in P) {
    const p = P[k];
    if (k.startsWith('walk')) { P[k] = { ...p, x: 0, y: 0.1, dist: p.dist * 1.9 }; continue; }
    if (k === 'design0' || k === 'design1') { P[k] = { ...p, x: 0, y: 0.3, dist: p.dist * 2.2 }; continue; }
    if (k === 'modules') { P[k] = { ...p, x: 0, y: 0.5, dist: p.dist * 2.7 }; continue; }
    // крупные планы граней (кнопки, фонарь) на узком экране отодвигаем дальше
    P[k] = { ...p, x: 0, y: 0.5, dist: p.dist * (p.dist < 3 ? 2.7 : 1.9) };
  }
  P.hero = { ...P.hero, y: 0.48, dist: 10 };
  P.mobile = true;
  P.far = { ...P.far, y: 0.45 };
  return P;
}

const Keys = createKeys();
const sts = {};
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ: window.matchMedia('(prefers-reduced-motion: reduce)') });

/* ---------- Танец ---------- */

// Раз в семь секунд — полный оборот, между ними телефон покачивается и подпрыгивает
function dance(t, amp) {
  if (amp <= 0.001) return null;
  const ph = (t % 7) / 7;
  const twirl = ph > 0.78 ? ease((ph - 0.78) / 0.22) * 2 * PI : 0;
  return {
    ry: (Math.sin(t * 1.15) * 0.55 + twirl) * amp,
    rz: Math.sin(t * 1.7 + 0.4) * 0.13 * amp,
    rx: Math.sin(t * 0.9 + 1) * 0.09 * amp,
    y: Math.abs(Math.sin(t * 2.3)) * 0.04 * amp,
  };
}

/* ---------- Заголовки по словам ---------- */

function splitWords(el) {
  const words = [];
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of n.textContent.split(/(\s+)/)) {
          if (!part) continue;
          // пробелы — обычным текстом между словами: внутри inline-block они схлопываются
          if (/^\s+$/.test(part)) { frag.append(part); continue; }
          const w = document.createElement('span');
          w.className = 'q-w';
          const inner = document.createElement('span');
          inner.textContent = part;
          w.append(inner);
          frag.append(w);
          words.push(inner);
        }
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    }
  };
  walk(el);
  return words;
}
const splitHeads = $$('[data-split]').map((el) => ({ el, words: splitWords(el) }));

/* ---------- 2. Дизайн: толщина ---------- */

const gauge = $('[data-gauge]');
const gaugeSub = $('[data-gauge-sub]');
function setDesign(p) {
  const t = ease(span(p, 0.45, 0.75));
  gauge.textContent = fmt(7.9 + 1.8 * t);
  gaugeSub.textContent = t < 0.02 ? 'по корпусу' : t > 0.98 ? 'по ступеньке модуля' : 'ступенька…';
}

/* ---------- 3. Прогулка по спинке ---------- */

const walkItems = $$('[data-walk] li');
const ruler = $('[data-ruler]');
const rulerMm = $('[data-ruler-mm]');
function setPlanka(p) {
  demo.planka = p;
  let last = -1;
  walkItems.forEach((li, i) => { const on = p >= Number(li.dataset.at); li.classList.toggle('is-on', on); if (on) last = i; });
  walkItems.forEach((li, i) => li.classList.toggle('is-cur', i === last));
  // путь камеры по спинке — от нижнего края до центра «Планки», 138 мм
  const mm = 138 * ease(span(p, 0.1, 0.62));
  rulerMm.textContent = String(Math.round(mm));
  ruler.style.transform = `scaleX(${(mm / 150.4).toFixed(4)})`;
}

/* ---------- 4. Модули ---------- */

const MODS = {
  classic: { n: '01 / 06 · в коробке', name: '«Классика 4»', text: 'Сверхширокая 12 Мп, основная 50 Мп с сенсором 1/1,3″ и перископ 3×. Первая сверхширокая в линейке Q.', price: '$109 · €119 · C$149' },
  shutter: { n: '02 / 06 · впервые в Q', name: '«Шторка»', text: 'Те же три камеры под алюминиевой шторкой на полозьях. Закрыли — Tesseract 5 обесточил сенсоры, система только узнаёт.', price: '$129 · €149 · C$179' },
  night: { n: '03 / 06 · для темноты', name: '«Ночь»', text: 'Монохромная 50 Мп без ИК-фильтра и две ИК-подсветки. 940 нм не видно глазом: ищете человека ночью и не слепите его.', price: '$149 · €169 · C$209' },
  thermal: { n: '04 / 06 · для спасателей', name: '«Тепло 2»', text: 'Тепловизор 640 × 512 от −20 до +650 °C и обычная камера 50 Мп для режима «Контур». Германиевое окно выступает на 1,3 мм.', price: '$229 · €259 · C$319' },
  beam: { n: '05 / 06 · свет', name: '«Луч 2»', text: 'Камер нет. 5000 лм и луч до 10 км: белый, красный и ИК. Снятый с телефона светит сам ещё 15 минут.', price: '$79 · €89 · C$109' },
  cap: { n: '06 / 06 · тишина', name: 'Заглушка', text: 'Полый алюминий с полированной «Q». Задних камер нет, спинка ровная — для тех, кому они не нужны.', price: '$9 · €9 · C$12' },
};
const modsGrp = $('[data-mods]');
const modCard = $('[data-mod-card]');
const modOut = { n: $('[data-mod-n]'), name: $('[data-mod-name]'), text: $('[data-mod-text]'), price: $('[data-mod-price]') };
let shutterManual = null;
function showModule(id, { hop = true } = {}) {
  if (!MODS[id] || id === demo.module) return;
  demo.module = id;
  syncRadio(modsGrp, id);
  const m = MODS[id];
  modOut.n.textContent = m.n;
  modOut.name.textContent = m.name;
  modOut.text.textContent = m.text;
  modOut.price.textContent = m.price;
  modCard.classList.remove('is-swap');
  void modCard.offsetWidth;
  modCard.classList.add('is-swap');
  stage?.setModule(id);
  updateScreen();
  if (hop && !reducedMode) {
    // смена модуля — прыжок с поворотом в другую сторону
    demo.hopDir *= -1;
    gsap.fromTo(demo, { hop: 0 }, { hop: 1, duration: 0.35, ease: 'power2.out', yoyo: true, repeat: 1 });
  }
}
function setModules(p) {
  const f = p * MODULES.length;
  const idx = Math.min(MODULES.length - 1, Math.floor(f));
  if (idx !== demo.modIdx) { demo.modIdx = idx; shutterManual = null; showModule(MODULES[idx]); }
  // у «Шторки» шторка закрывается во второй половине шага
  demo.shutter = MODULES[idx] === 'shutter' ? ease(span(f - idx, 0.35, 0.8)) : 0;
}
initRadioGroup(modsGrp, (v) => {
  showModule(v);
  shutterManual = null;
  if (v === 'shutter') {
    const o = { v: 0 };
    gsap.to(o, { v: 1, duration: reducedMode ? 0 : 0.9, delay: 0.6, ease: 'power2.inOut', onUpdate: () => { shutterManual = o.v; } });
    toast('«Шторка» закрывается: Tesseract 5 обесточит сенсоры.');
  }
});

/* ---------- 5. Две версии ---------- */

const regionGrp = $('[data-region]');
const bench = $('[data-bench]');
const benchRows = $$('.q-bench__row', bench);
function paintBench() {
  bench.dataset.on = demo.region;
  for (const r of benchRows) {
    const eu = Number(r.dataset.eu), na = Number(r.dataset.na), max = Math.max(eu, na);
    r.style.setProperty('--eu', `${(eu / max) * 100}%`);
    r.style.setProperty('--na', `${(na / max) * 100}%`);
    const mine = demo.region === 'eu' ? eu : na, other = demo.region === 'eu' ? na : eu;
    r.querySelector('[data-v]').innerHTML = `<b>${num(mine)}</b> · ${num(other)}`;
  }
}
initRadioGroup(regionGrp, (v) => {
  syncRadio(regionGrp, v);
  demo.region = v;
  paintBench();
  updateScreen();
  toast(v === 'eu' ? 'OY-Q4E: Fyr GP20 Slim, LPDDR6. Модем Fyr на кристалле выключен.' : 'OY-Q4A: Snapdragon 8 Gen 5, mmWave. Модем X80 на кристалле выключен.');
});
paintBench();

/* ---------- 6. «Эхо 2»: два телефона без вышек ---------- */

const echoCanvas = $('[data-echo-map]');
const echoMsg = $('[data-echo-msg]');
const echo = { raf: 0, visible: false };
const ECHO_MSGS = ['«Вижу фонарь. Иду к вам» · 9,6 км · без вышек', '«Связи нет. Эхо есть» · 7,2 км', '«Координаты отправлены» · SOS по «Эху 2»'];
function drawEcho(now) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(echoCanvas.clientWidth * dpr), h = Math.round(echoCanvas.clientHeight * dpr);
  if (!w || !h) return;
  if (echoCanvas.width !== w || echoCanvas.height !== h) { echoCanvas.width = w; echoCanvas.height = h; }
  const g = echoCanvas.getContext('2d');
  const t = now / 1000;
  g.fillStyle = '#14110F';
  g.fillRect(0, 0, w, h);
  // горизонтали: горы между двумя телефонами
  g.lineWidth = dpr;
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = `rgba(255,214,170,${0.05 + (i % 4 === 0 ? 0.07 : 0)})`;
    g.beginPath();
    for (let x = 0; x <= w; x += w / 60) {
      const u = x / w;
      const y = h * (0.12 + i * 0.065) + Math.sin(u * 6 + i * 0.7) * h * 0.035 + Math.sin(u * 15 + i) * h * 0.01;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  const a = { x: w * 0.2, y: h * 0.72 }, b = { x: w * 0.8, y: h * 0.26 };
  // пунктир расстояния
  g.setLineDash([6 * dpr, 8 * dpr]);
  g.strokeStyle = 'rgba(255,246,236,.25)';
  g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
  g.setLineDash([]);
  // волны «Эха»: от одного телефона к другому
  for (const [p, ph] of [[a, 0], [b, 0.5]]) {
    for (let k = 0; k < 3; k++) {
      const f = ((t * 0.45 + ph + k / 3) % 1);
      g.strokeStyle = `rgba(255,138,92,${(1 - f) * 0.7})`;
      g.lineWidth = 2 * dpr;
      g.beginPath();
      g.arc(p.x, p.y, f * Math.hypot(w, h) * 0.55, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#FF8A5C';
    g.beginPath(); g.arc(p.x, p.y, 7 * dpr, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FFF6EC';
    g.beginPath(); g.arc(p.x, p.y, 3 * dpr, 0, Math.PI * 2); g.fill();
  }
  // пакет едет по пунктиру
  const f = (t * 0.25) % 1;
  g.fillStyle = '#FFF6EC';
  g.beginPath(); g.arc(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, 4 * dpr, 0, Math.PI * 2); g.fill();
  g.font = `600 ${11 * dpr}px "JetBrains Mono", monospace`;
  g.fillStyle = 'rgba(255,246,236,.6)';
  g.fillText('0X4Q · А', a.x + 12 * dpr, a.y + 22 * dpr);
  g.fillText('0X4Q · Б', b.x - 70 * dpr, b.y - 16 * dpr);
  g.fillText('вышек: 0', w * 0.06, h * 0.08);
  const msg = ECHO_MSGS[Math.floor(t / 4) % ECHO_MSGS.length];
  if (echoMsg.textContent !== msg) echoMsg.textContent = msg;
}
function echoLoop(now) {
  echo.raf = 0;
  if (!echo.visible || document.hidden) return;
  drawEcho(now);
  if (!reducedMode) echo.raf = requestAnimationFrame(echoLoop);
}

/* ---------- 7. Tesseract 5: подпись 2 из 3 ---------- */

const signNote = $('[data-sign-note]');
$$('[data-key]').forEach((b) => b.addEventListener('click', () => {
  const i = Number(b.dataset.key);
  demo.keys[i] = demo.keys[i] ? 0 : 1;
  b.setAttribute('aria-pressed', String(!!demo.keys[i]));
  b.querySelector('span').textContent = demo.keys[i] ? 'подписано' : 'подписать';
  const n = demo.keys.filter(Boolean).length;
  if (n < 2) signNote.textContent = `Подписей: ${n} из 2. ${n ? 'Ещё одна.' : 'Нажмите на ключи.'}`;
  else if (!demo.keys[0]) signNote.textContent = 'Принято двумя ключами Fyr. Да, пока так можно. Мы над этим работаем.';
  else signNote.textContent = 'Принято: ключ OY и ключ Fyr. «Свидетель» записал, кто подписал.';
  updateScreen();
}));

/* ---------- 8. Кнопки «0» и «1» ---------- */

$$('[data-tkey]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.tkey;
  demo[k] = demo[k] ? 0 : 1;
  b.setAttribute('aria-pressed', String(!!demo[k]));
  if (demo.key0 && demo.key1) toast('«0» и «1» утоплены: Tesseract 5 обесточил камеры, микрофоны, связь и геолокацию.');
  else toast(demo[k] ? `Кнопка «${k === 'key0' ? '0' : '1'}» утоплена: обесточено аппаратно.` : `Кнопка «${k === 'key0' ? '0' : '1'}» отпущена.`);
  updateScreen();
}));

/* ---------- 9. Фонарь ---------- */

const TORCH = {
  off: { mode: 'выключен', note: 'Фонарь выключен. Нажмите «Красный».' },
  white: { mode: 'белый · около 3000 м', note: 'Белый: видно примерно за 3 км. Светит вверх с верхней грани.' },
  red: { mode: 'красный · до 5000 м', note: 'Красный: виден за 5 км и бережёт ночное зрение. Как у 0X0.' },
  sos: { mode: 'SOS · ··· ——— ···', note: 'SOS азбукой Морзе. Фонарь в корпусе: работает и без модуля.' },
};
const torchGrp = $('[data-torch]');
const torchNote = $('[data-torch-note]');
const darkEl = $('[data-dark]');
initRadioGroup(torchGrp, (v) => {
  syncRadio(torchGrp, v);
  demo.torch = v;
  torchNote.textContent = TORCH[v].note;
  stage?.setTorchColor(v === 'red' || v === 'sos' ? 'red' : 'white');
  updateScreen();
});
const SOS = [1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0];
function torchLevel(now) {
  if (demo.torch === 'off') return 0;
  if (demo.torch === 'sos') return SOS[Math.floor(now / 220) % SOS.length];
  return 1;
}

/* ---------- 11. Двенадцать винтов ---------- */

const screwsEl = $('[data-screws]');
screwsEl.innerHTML = '<i class="q-screw"></i>'.repeat(12);
const screws = $$('.q-screw', screwsEl);
const screwN = $('[data-screws-n]');
const screwState = $('[data-screws-state]');
function setPower(p) {
  const t = span(p, 0.08, 0.82) * 12;
  let out = 0;
  screws.forEach((s, i) => {
    const k = clamp01(t - i);
    s.style.transform = `rotate(${(-k * 720).toFixed(0)}deg)`;
    s.classList.toggle('is-out', k >= 1);
    if (k >= 1) out++;
  });
  screwN.textContent = String(out);
  screwState.textContent = out === 0 ? 'крышка на месте' : out < 12 ? 'откручиваем обычной отвёрткой' : 'крышка снята · аккумулятор меняется за 15 минут';
}

/* ---------- 12. Цвета ---------- */

const COLOR_ORDER = ['tuile', 'seine', 'calcaire', 'ardoise'];
const COLOR_NOTES = {
  tuile: '«Черепица». Терракота парижских крыш и старого амбара, медная рамка.',
  seine: '«Сена». Серо-зелёная вода у набережных и тёмно-серая рамка.',
  calcaire: '«Известняк». Тёплый камень, из которого построен Париж, и серебро.',
  ardoise: '«Сланец». Почти чёрный, как мокрые крыши после дождя, и графит.',
};
const colorGrps = [$('[data-colors]'), $('[data-colors-buy]')];
const colorNote = $('[data-color-note]');
const buyColor = $('[data-buy-color]');
function applyColor(v, { instant = false, twirl = true } = {}) {
  if (!Q4_COLORS[v]) return;
  const changed = v !== demo.color;
  demo.color = v;
  colorGrps.forEach((g) => syncRadio(g, v));
  root.dataset.color = v;
  store.set('oy-q4-color', v);
  colorNote.textContent = COLOR_NOTES[v];
  buyColor.textContent = Q4_COLORS[v].label;
  stage?.setBodyColor(v, instant);
  // новый цвет — пируэт
  if (changed && twirl && !instant && !reducedMode) gsap.fromTo(demo, { twirl: 0 }, { twirl: 1, duration: 1.1, ease: 'power3.inOut', onComplete: () => { demo.twirl = 0; } });
}
colorGrps.forEach((g) => initRadioGroup(g, (v) => applyColor(v)));
function setColors(p) {
  const idx = Math.min(COLOR_ORDER.length - 1, Math.floor(span(p, 0.05, 0.95) * COLOR_ORDER.length));
  if (idx !== demo.colorIdx) { demo.colorIdx = idx; applyColor(COLOR_ORDER[idx]); }
}
const saved = root.dataset.color;
if (saved && saved !== 'tuile') { applyColor(saved, { instant: true }); demo.colorIdx = COLOR_ORDER.indexOf(saved); }

/* ---------- 13. Купить ---------- */

const curGrp = $('[data-cur]');
const memGrp = $('[data-mem]');
const bundleGrp = $('[data-bundle]');
const totalOut = $('[data-total]');
const totalK = $('[data-total-k]');
const totalNote = $('[data-total-note]');
const CUR = {
  usd: { k: 'США', f: (n) => `$${n}`, note: 'Версия OY-Q4A: Snapdragon 8 Gen 5 и mmWave.' },
  cad: { k: 'Канада', f: (n) => `C$${num(n)}`, note: 'Версия OY-Q4A. Первый OY в Канаде — на родине основателей.' },
  eur: { k: 'Евросоюз', f: (n) => `€${n}`, note: 'Версия OY-Q4E: Fyr GP20 Slim и LPDDR6.' },
};
let cur = 'usd';
function paintTotal(animate = true) {
  const mem = memGrp.querySelector('[aria-checked="true"]');
  const bun = bundleGrp.querySelector('[aria-checked="true"]');
  const total = Number(mem.dataset[cur]) + Number(bun.dataset[cur]);
  totalK.textContent = `Итого · ${CUR[cur].k}`;
  totalNote.textContent = CUR[cur].note;
  if (!animate || reducedMode) { totalOut.textContent = CUR[cur].f(total); return; }
  const from = Number(totalOut.textContent.replace(/[^0-9]/g, '')) || total;
  const o = { v: from };
  gsap.to(o, { v: total, duration: 0.6, ease: 'power2.out', onUpdate: () => { totalOut.textContent = CUR[cur].f(Math.round(o.v)); } });
}
initRadioGroup(curGrp, (v) => { syncRadio(curGrp, v); cur = v; paintTotal(); });
initRadioGroup(memGrp, (v) => { syncRadio(memGrp, v); paintTotal(); });
initRadioGroup(bundleGrp, (v) => { syncRadio(bundleGrp, v); demo.bundle = v; paintTotal(); });
paintTotal(false);
$('[data-buy]').addEventListener('click', () => toast('Купить здесь нельзя: это концепт. Но амбар уже открыт.'));

/* ---------- Хореография ---------- */

let poses = null;
function addKeys(P) {
  const K = (id, f, props) => Keys.add(sts[id], f, props);
  const hold = (id, pose) => { K(id, -0.4, pose); K(id, 0.3, pose); };
  K('hero', -1, P.hero);
  K('hero', 0, P.hero);
  // телефон уходит вверх и гаснет, когда под ним начинается текст во всю ширину
  const away = (id, pose, at) => K(id, at, { ...pose, y: 0.9, ry: pose.ry + 0.5, vis: 0 });
  K('brand', -0.5, P.brand);
  K('brand', 0.05, { ...P.brand, ry: P.brand.ry + 0.1 });
  away('brand', P.brand, 0.35);
  K('design', -0.4, P.design0);
  K('design', 0.3, P.design0);
  K('design', 0.75, P.design1);
  K('design', 1, P.design1);
  // горизонталь: сначала весь телефон, потом камера едет по спинке
  K('planka', -0.5, P.walk0);
  K('planka', 0, P.walk0);
  K('planka', 0.1, P.walk1);
  K('planka', 0.38, P.walk2);
  K('planka', 0.62, P.walk3);
  K('planka', 0.74, P.walk3);
  K('planka', 0.9, P.walk4);
  K('planka', 1, P.walk4);
  K('modules', -0.4, P.modules);
  K('modules', 1, { ...P.modules, ry: P.modules.ry + 0.2 });
  hold('regions', P.hidden);
  hold('nc4', P.hidden);
  if (P.mobile) {
    // на телефоне текст глав на подложке уезжает под модель — она уходит раньше
    for (const id of ['tesseract', 'keys', 'torch', 'camelos']) { K(id, -0.4, P[id]); K(id, 0.06, P[id]); away(id, P[id], 0.24); }
  } else {
    K('tesseract', -0.4, P.tesseract);
    K('tesseract', 0.25, { ...P.tesseract, ry: P.tesseract.ry + 0.15 });
    away('tesseract', P.tesseract, 0.5);
    for (const id of ['keys', 'torch', 'camelos']) { K(id, -0.4, P[id]); K(id, 0.5, P[id]); }
  }
  hold('power', P.hidden);
  K('power', 1, P.hidden);
  K('colors', -0.3, P.colors);
  K('colors', 1, P.colors);
  hold('buy', P.hidden);
  K('specs', 1, P.hidden);
}

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  const SETTERS = { design: setDesign, planka: setPlanka, modules: setModules, power: setPower, colors: setColors };

  for (const id of CHAPTERS) {
    if (PINNED[id]) {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sections[id],
          start: 'top top', end: reduce ? 'bottom top' : PINNED[id], pin: !reduce, scrub: reduce ? false : true, anticipatePin: 1,
          onUpdate: (st) => SETTERS[id](st.progress),
        },
      });
      tl.set({}, {}, 1);
      sts[id] = tl.scrollTrigger;
    } else {
      sts[id] = ScrollTrigger.create({ trigger: sections[id], start: 'top top', end: 'bottom top' });
    }
  }
  if (reduce) { setDesign(1); setPlanka(1); setPower(1); }

  // гигантское 0X4Q расходится: «0X» влево, «Q» вправо, «4» вверх
  ScrollTrigger.create({
    trigger: sections.hero, start: 'top top', end: 'bottom top',
    onUpdate: (st) => {
      if (reduce) return;
      const [a, b, c] = $$('[data-mega] > span');
      const p = st.progress;
      a.style.transform = `translateX(${-p * 34}vw)`;
      b.style.transform = `translateY(${-p * 30}vh) rotate(${p * -14}deg)`;
      c.style.transform = `translateX(${p * 34}vw)`;
      root.style.setProperty('--tiles-o', (1 - p * 0.8).toFixed(3));
    },
  });

  poses = makePoses(isMobile);
  Keys.reset();
  addKeys(poses);

  if (!reduce) {
    for (const { el, words } of splitHeads) {
      if (el.closest('#hero')) continue;
      gsap.fromTo(words, { yPercent: 110, opacity: 0, rotate: 4 }, {
        yPercent: 0, opacity: 1, rotate: 0, duration: 0.95, ease: 'power4.out', stagger: 0.05,
        scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none reverse' },
      });
    }
    // таблички прибиваются к стене: падают с лёгким покачиванием
    $$('.q-plaque').forEach((pl) => {
      if (pl.closest('#hero')) return;
      gsap.fromTo(pl, { y: -40, rotate: -9, opacity: 0 }, { y: 0, rotate: -1.2, opacity: 1, duration: 1.1, ease: 'elastic.out(1, 0.55)', scrollTrigger: { trigger: pl, start: 'top 90%', toggleActions: 'play none none none' } });
    });
    $$('[data-reveal], .q-lead, .q-feats li, .q-specs div, .q-buy__panel, .q-region button, .q-os li').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
    });
    // штамп: 0X4Q бьёт поверх зачёркнутого 0X3Q
    gsap.fromTo('.q-stamp__new', { '--stamp-s': 2.6, '--stamp-o': 0 }, { '--stamp-s': 1, '--stamp-o': 1, duration: 0.5, ease: 'power4.in', scrollTrigger: { trigger: '[data-stamp]', start: 'top 70%', toggleActions: 'play none none reverse' } });
  }
  bindOnEnter();
  ScrollTrigger.refresh();
  return () => Keys.reset();
}
ScrollTrigger.addEventListener('refresh', () => { Keys.compile(window.innerHeight); detectChapter(); });

let enterBound = false;
function bindOnEnter() {
  if (enterBound) return;
  enterBound = true;
  ScrollTrigger.create({ trigger: '[data-bench]', start: 'top 80%', once: true, onEnter: () => bench.classList.add('is-in') });
  ScrollTrigger.create({ trigger: '[data-echo]', start: 'top bottom', end: 'bottom top', onToggle: (st) => { echo.visible = st.isActive; if (st.isActive && !echo.raf) echo.raf = requestAnimationFrame(echoLoop); } });
}

/* ---------- Каждый тик: прокрутка → модель ---------- */

let lastY = -1;
let dark = 0;
let lastT = performance.now();
function tick() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  const y = window.scrollY;
  if (y !== lastY) {
    lastY = y;
    detectChapter();
    const max = document.documentElement.scrollHeight - window.innerHeight;
    paintMetro(max > 0 ? clamp01(y / max) : 0);
  }
  const torch = current === 'torch' ? torchLevel(now) : 0;
  const wantDark = current === 'torch' && demo.torch !== 'off' ? 0.85 : 0;
  dark += (wantDark - dark) * (reducedMode ? 1 : 1 - Math.exp(-dt * 4));
  darkEl.style.opacity = dark.toFixed(3);
  root.classList.toggle('q-dark', dark > 0.4);
  if (Keys.empty || !stage) return;
  const v = Keys.sample(y, reducedMode);

  // танец: на первом экране — во всю силу, в CamelOS и цветах — тише
  const heroAmp = 1 - clamp01(y / (window.innerHeight * 0.7));
  const amp = reducedMode ? 0 : current === 'hero' || current === 'brand' ? heroAmp : current === 'camelos' ? 0.35 : current === 'colors' ? 0.7 : 0;
  const d = dance(now / 1000, amp);
  if (d) { v.ry += d.ry; v.rz += d.rz; v.rx += d.rx; v.y += d.y; }
  // прыжок при смене модуля и пируэт при смене цвета
  if (demo.hop) { v.y += demo.hop * 0.07; v.rz += demo.hop * 0.18 * demo.hopDir; v.ry += demo.hop * 0.3 * demo.hopDir; }
  if (demo.twirl) v.spin = ease(demo.twirl) * 2 * PI;

  v.shutter = current === 'modules' ? (shutterManual ?? demo.shutter) : 0;
  v.key0 = current === 'keys' ? demo.key0 : 0;
  v.key1 = current === 'keys' ? demo.key1 : 0;
  v.torch = torch;
  const vis = clamp01(v.vis ?? 1);
  canvas.style.opacity = vis.toFixed(3);
  stage.setActive(vis > 0.02 && !document.hidden);
  stage.setTarget(v);
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__q4 = { stage, Keys, ScrollTrigger, sts, demo };

window.addEventListener('pointermove', (e) => {
  if (!stage || reducedMode || e.pointerType === 'touch') return;
  stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });
window.addEventListener('resize', () => { stage?.resize(); lastY = -1; });

/* ---------- Запуск ---------- */

async function boot() {
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([fonts, stage ? stage.ready : null, timeout(300)]), timeout(12000)]);
  stage?.redrawScreen();

  const mm = gsap.matchMedia();
  mm.add({
    isMobile: '(max-width: 760px)', isDesktop: '(min-width: 761px)',
    reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)',
  }, (ctx) => buildChoreography(ctx.conditions));

  const loader = $('#loader');
  const hideLoader = () => { loader.classList.add('is-done'); loader.setAttribute('aria-hidden', 'true'); };
  setTimeout(hideLoader, reducedMode ? 0 : 500);
  setTimeout(hideLoader, 1400);
  updateScreen(true);

  // первый экран: телефон влетает из глубины, кувыркаясь, и начинает танцевать
  if (!reducedMode && stage && window.scrollY < 10) {
    const P = makePoses(window.matchMedia('(max-width: 760px)').matches);
    stage.setTarget(P.far);
    stage.snap();
    gsap.ticker.remove(tick);
    const k = { t: 0 };
    const intro = gsap.to(k, {
      t: 1, duration: 2.6, ease: 'power3.out', delay: 0.5,
      onUpdate: () => {
        if (window.scrollY > 40) { intro.kill(); gsap.ticker.add(tick); return; }
        const pose = {};
        for (const key in P.hero) pose[key] = P.far[key] + (P.hero[key] - P.far[key]) * k.t;
        // кувырок на подлёте: два оборота вокруг вертикали и сальто вперёд
        pose.spin = (1 - k.t) * 4 * PI;
        pose.rx += Math.sin(k.t * PI) * 1.2;
        stage.setTarget(pose);
      },
      onComplete: () => gsap.ticker.add(tick),
    });
    gsap.from('[data-mega] > span', { opacity: 0, y: 80, scale: 0.7, duration: 1.4, ease: 'back.out(1.6)', stagger: 0.12, delay: 0.3 });
    const hero = splitHeads.find(({ el }) => el.closest('#hero'));
    if (hero) gsap.from(hero.words, { yPercent: 115, opacity: 0, rotate: 6, duration: 1.1, ease: 'power4.out', stagger: 0.08, delay: 0.9 });
    gsap.from('.q-hero > *:not(.q-hero__title)', { opacity: 0, y: 20, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 1.3 });
    gsap.from('.q-hero .q-plaque', { y: -60, rotate: -14, duration: 1.4, ease: 'elastic.out(1, 0.5)', delay: 0.6 });
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());

  let hashTarget = null;
  try { hashTarget = location.hash.length > 1 ? document.querySelector(location.hash) : null; } catch { /* неверный якорь */ }
  if (hashTarget) {
    requestAnimationFrame(() => {
      if (smooth.lenis) { smooth.lenis.resize(); smooth.lenis.scrollTo(hashTarget, { immediate: true, force: true }); }
      else hashTarget.scrollIntoView();
    });
  }
}
boot();
