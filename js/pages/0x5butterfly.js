/* =========================================================================
   OY 0X5 Butterfly — «Новая игра+». Страница — компьютерная игра.
   Загрузка CamelOS 3.1 → титульный экран («Нажмите любую клавишу») →
   уровни вместо глав. HUD внизу: уровень и полоса опыта, тайны «Техаса»
   (пять букв, три солнечные панели, капля), настоящие кадры в секунду.
   На смене уровня — полоса загрузки с советом. Меню паузы (Esc): графика
   (RTX и DLSS меняют рендер 3D-модели), достижения, тайны.
   Уровни: «Имаго» — телефон раскрывается по прокрутке; «Два глаза» — два
   сканера сетчатки, у каждой двери свой глаз; «Затмение» — электрохромный
   слой как ND-фильтр и шторка; карта кристалла GP30 Ultra; RTX и DLSS со
   шторкой сравнения; рабочий стол CamelOS 3.1 с .exe и сапёром; босс
   Love Gen 5 Semi, которого нельзя победить; инвентарь с потерянной
   третьей фронталкой; выбор скина; «Сохранить игру»; титры и сцена после
   титров — Project Texas, только когда найдены все девять тайн.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createKeys } from '../core/keys.js';
import { createOY0X5Butterfly, B5_COLORS, drawFalls, drawNeon, drawEye } from '../models/oy0x5butterfly.js';
import { $, $$, clamp01, createToast, syncRadio, initRadioGroup, store } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
const params = new URLSearchParams(location.search);
const toast = createToast($('#toast'), gsap);
const ease = (t) => { const c = clamp01(t); return c * c * (3 - 2 * c); };
const PI = Math.PI;
const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const dprOf = () => Math.min(window.devicePixelRatio || 1, 2);
function fit(cv) {
  const dpr = dprOf();
  const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
  if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
  return { w: cv.width, h: cv.height, dpr };
}

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createOY0X5Butterfly, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

const demo = { color: 'peacock', twirl: 0, nd: 0, rub: 0, rub2: 0, torch: 'off', eye: null, boss: 0 };

/* ---------- Сохранение: достижения и тайны ---------- */

const SAVE_KEY = 'oy-x5b-save';
const save = (() => {
  const empty = { ach: {}, tx: [0, 0, 0, 0, 0], sun: [0, 0, 0], drop: 0, skins: [], boss: [], rtxOff: 0 };
  try { return { ...empty, ...JSON.parse(store.get(SAVE_KEY) || '{}') }; } catch { return empty; }
})();
const persist = () => store.set(SAVE_KEY, JSON.stringify(save));

const ACH = [
  ['start', 'Новая игра+', 'Начать игру'],
  ['unfold', 'Расправил крылья', 'Раскрыть телефон до конца'],
  ['twoeyes', 'Смотрит в оба… снова', 'Открыть обе двери своими глазами'],
  ['eclipse', 'Полное затмение', 'Затемнить «Визор» целиком'],
  ['rtx', 'Лучи не врут', 'Выключить и снова включить RTX'],
  ['saper', 'Сапёр', 'Выиграть в САПЁР.EXE'],
  ['boom', 'Подорвался', 'Проиграть в САПЁР.EXE'],
  ['boss', 'Неуязвимый', 'Испробовать на боссе все пять атак'],
  ['skin', 'Модник', 'Примерить все пять скинов'],
  ['save', 'Сохранено', 'Дойти до «Сохранить игру»'],
  ['credits', 'До конца титров', 'Досмотреть титры'],
  ['texas', 'Техас', 'Найти все девять тайн'],
];
const achBox = $('[data-ach]');
const achList = $('[data-ach-list]');
function paintAch() {
  achList.replaceChildren(...ACH.map(([id, t, d]) => {
    const li = document.createElement('li');
    const on = !!save.ach[id];
    li.className = on ? 'is-on' : '';
    const secret = id === 'texas' && !on;
    li.innerHTML = `<i aria-hidden="true">${on ? '★' : ''}</i><b></b><span></span>`;
    li.querySelector('b').textContent = secret ? '???' : t;
    li.querySelector('span').textContent = (secret ? 'Секретное достижение' : d) + (on ? ' · получено' : '');
    return li;
  }));
  const n = ACH.filter(([id]) => save.ach[id]).length;
  $('[data-menu-ach]').textContent = `${n} из ${ACH.length}`;
  $$('[data-quest]').forEach((q) => q.classList.toggle('is-done', !!save.ach[q.dataset.quest]));
}
function unlock(id) {
  if (save.ach[id]) return;
  save.ach[id] = Date.now();
  persist();
  paintAch();
  const a = ACH.find((x) => x[0] === id);
  const card = document.createElement('div');
  card.className = 'b-ach__card';
  card.innerHTML = '<i aria-hidden="true">★</i><small>Достижение получено</small><b></b>';
  card.querySelector('b').textContent = a ? a[1] : id;
  achBox.append(card);
  if (reducedMode) { setTimeout(() => card.remove(), 3500); return; }
  gsap.fromTo(card, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.6)' });
  gsap.to(card, { x: 40, opacity: 0, duration: 0.4, delay: 3.4, onComplete: () => card.remove() });
}

/* ---------- Тайны «Техаса» ---------- */

const WORD = ['Т', 'Е', 'Х', 'А', 'С'];
const SECRET_NAMES = [
  ...WORD.map((l, i) => [`tx${i}`, `Буква «${l}»`]),
  ['sun0', 'Солнечная панель в отражении'], ['sun1', 'Солнечная панель на дюне'], ['sun2', 'Солнечная панель в характеристиках'],
  ['drop', 'Капля жидкого кремния'],
];
const found = () => save.tx.filter(Boolean).length + save.sun.filter(Boolean).length + (save.drop ? 1 : 0);
const hud = $('[data-hud]');
function paintSecrets() {
  $$('[data-slot]').forEach((s) => { const i = +s.dataset.slot; s.textContent = save.tx[i] ? WORD[i] : ''; });
  $$('[data-sun-slot]').forEach((s) => s.classList.toggle('is-on', !!save.sun[+s.dataset.sunSlot]));
  $('[data-drop-slot]').classList.toggle('is-on', !!save.drop);
  $$('.b-tx').forEach((b) => b.classList.toggle('is-found', !!save.tx[+b.dataset.tx]));
  $$('.b-sun').forEach((b) => b.classList.toggle('is-found', !!save.sun[+b.dataset.sun]));
  $('[data-drop]').classList.toggle('is-found', !!save.drop);
  const n = found();
  $('[data-secrets-n]').textContent = `${n}/9`;
  hud.classList.toggle('is-complete', n === 9);
  $('[data-secrets-list]').replaceChildren(...SECRET_NAMES.map(([id, name]) => {
    const on = id === 'drop' ? save.drop : id.startsWith('tx') ? save.tx[+id[2]] : save.sun[+id[3]];
    const li = document.createElement('li');
    li.className = on ? 'is-on' : '';
    li.innerHTML = '<span></span><b></b>';
    li.querySelector('span').textContent = on ? name : '???';
    li.querySelector('b').textContent = on ? 'найдено' : '—';
    return li;
  }));
  $('[data-texas-hint]').textContent = n === 9 ? 'Все тайны найдены. Досмотрите титры.' : `Найдено тайн: ${n} из 9.`;
  $('[data-post-hint]').textContent = `Найдено тайн: ${n} из 9. Три солнечные панели, пять слов и одна капля.`;
  const open = n === 9;
  $('[data-post-locked]').hidden = open;
  $('[data-post-open]').hidden = !open;
  $('[data-post-k]').textContent = open ? 'открыто' : 'заперто';
}
function findSecret(kind, i, el) {
  const list = kind === 'tx' ? save.tx : kind === 'sun' ? save.sun : null;
  if (list ? list[i] : save.drop) return;
  if (list) list[i] = 1; else save.drop = 1;
  persist();
  paintSecrets();
  const n = found();
  const msg = kind === 'tx' ? `Буква «${WORD[i]}». ${save.tx.map((v, k) => (v ? WORD[k] : '_')).join(' ')}`
    : kind === 'sun' ? 'Солнечная панель. Зачем она телефону?' : 'Жидкий кремний. В петле его быть не должно.';
  toast(`Тайна ${n}/9 · ${msg}`);
  if (el && !reducedMode) gsap.fromTo(el, { scale: 1.8 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, .4)' });
  if (n === 9) {
    unlock('texas');
    setTimeout(() => toast('Т Е Х А С. После титров что-то открылось.'), 1200);
  }
}
$$('.b-tx').forEach((b) => b.addEventListener('click', () => findSecret('tx', +b.dataset.tx, b)));
$$('.b-sun').forEach((b) => b.addEventListener('click', () => findSecret('sun', +b.dataset.sun, b)));
$('[data-drop]').addEventListener('click', (e) => findSecret('drop', 0, e.currentTarget));

/* ---------- Графика: RTX, DLSS, генерация кадров ---------- */

// k — внутреннее разрешение кадра в демо; m — разрешение рендера 3D-модели на странице:
// «Качество» почти не трогает модель, «Производительность» — заметно, это и видно
const DLSS = {
  off: { k: 1, m: 1, label: 'Выкл', short: 'выкл' },
  q: { k: 1 / 1.5, m: 0.9, label: 'Качество', short: 'К' },
  b: { k: 1 / 1.72, m: 0.75, label: 'Баланс', short: 'Б' },
  p: { k: 0.5, m: 0.5, label: 'Производительность', short: 'П' },
};
const gfx = (() => {
  const d = { rtx: true, dlss: 'q', fg: true };
  try { return { ...d, ...JSON.parse(store.get('oy-x5b-gfx') || '{}') }; } catch { return d; }
})();
if (!DLSS[gfx.dlss]) gfx.dlss = 'q';
const rtxGroups = [$('[data-rtx-on]'), $('[data-g-rtx]')];
const dlssGroups = [$('[data-dlss]'), $('[data-g-dlss]')];
const fgBoxes = [$('[data-fg]'), $('[data-g-fg]')];
function applyGfx({ from } = {}) {
  root.dataset.rtx = gfx.rtx ? 'on' : 'off';
  rtxGroups.forEach((g) => syncRadio(g, gfx.rtx ? 'on' : 'off'));
  dlssGroups.forEach((g) => syncRadio(g, gfx.dlss));
  fgBoxes.forEach((c) => { c.checked = gfx.fg; });
  stage?.setPixelScale(DLSS[gfx.dlss].m);
  $('[data-gfx-badge]').textContent = `${gfx.rtx ? 'RTX' : 'без RTX'} · DLSS ${DLSS[gfx.dlss].short}${gfx.fg ? ' · ГК' : ''}`;
  $('[data-menu-gfx]').textContent = `RTX ${gfx.rtx ? 'вкл' : 'выкл'} · DLSS «${DLSS[gfx.dlss].label}»`;
  store.set('oy-x5b-gfx', JSON.stringify(gfx));
  paintFpsBars();
  if (from !== 'init') { lastScreenKey = ''; updateScreen(); }
}
rtxGroups.forEach((g) => initRadioGroup(g, (v) => {
  const on = v === 'on';
  if (on === gfx.rtx) return;
  gfx.rtx = on;
  if (!on) { save.rtxOff = 1; persist(); } else if (save.rtxOff) unlock('rtx');
  applyGfx();
}));
dlssGroups.forEach((g) => initRadioGroup(g, (v) => { gfx.dlss = v; applyGfx(); }));
fgBoxes.forEach((c) => c.addEventListener('change', () => { gfx.fg = c.checked; applyGfx(); }));

// Настоящие кадры в секунду браузера; генерация кадров честно удваивает цифру и подписывает «ГК»
const fpsOut = $('[data-fps]');
let frames = 0, fpsT = performance.now(), fpsNow = 60;
gsap.ticker.add(() => {
  frames++;
  const now = performance.now();
  if (now - fpsT >= 500) {
    fpsNow = (frames * 1000) / (now - fpsT);
    frames = 0;
    fpsT = now;
    fpsOut.textContent = String(Math.round(fpsNow * (gfx.fg ? 2 : 1)));
  }
});

/* ---------- Меню паузы ---------- */

const pause = $('[data-pause]');
const tabs = $$('[data-tab]');
function showTab(id) {
  tabs.forEach((t) => { const on = t.dataset.tab === id; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  $$('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== id; });
}
function openPause(tab = 'gfx') {
  showTab(tab);
  if (!pause.open) {
    if (typeof pause.showModal === 'function') pause.showModal(); else pause.setAttribute('open', '');
  }
  smooth.lenis?.stop();
}
function closePause() {
  if (pause.open) { if (typeof pause.close === 'function') pause.close(); else pause.removeAttribute('open'); }
}
pause.addEventListener('close', () => smooth.lenis?.start());
pause.addEventListener('click', (e) => { if (e.target === pause) closePause(); });
$('[data-pause-close]').addEventListener('click', closePause);
$$('[data-open]').forEach((b) => b.addEventListener('click', () => openPause(b.dataset.open)));
$('[data-pause-tabs]').addEventListener('click', (e) => { const t = e.target.closest('[data-tab]'); if (t) showTab(t.dataset.tab); });
$('[data-pause-tabs]').addEventListener('keydown', (e) => {
  const i = tabs.indexOf(document.activeElement);
  if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  showTab(tabs[n].dataset.tab);
  tabs[n].focus();
});
$('[data-reset]').addEventListener('click', () => {
  Object.assign(save, { ach: {}, tx: [0, 0, 0, 0, 0], sun: [0, 0, 0], drop: 0, skins: [], boss: [], rtxOff: 0 });
  persist();
  paintAch();
  paintSecrets();
  toast('Прогресс стёрт. Новая игра.');
});

/* ---------- Уровни, HUD, экраны загрузки ---------- */

const CHAPTERS = ['hero', 'imago', 'eyes', 'eclipse', 'ultra', 'rtx', 'exe', 'boss', 'inventory', 'skins', 'buy', 'stats', 'credits'];
const LEVEL = {
  hero: ['ТИТУЛ', 'Новая игра+'], imago: ['УР. 1', 'Имаго'], eyes: ['УР. 2', 'Два глаза'], eclipse: ['УР. 3', 'Затмение'],
  ultra: ['УР. 4', 'GP30 Ultra'], rtx: ['УР. 5', 'RTX и DLSS'], exe: ['УР. 6', 'Окна в пустыне'], boss: ['УР. 7', 'Босс'],
  inventory: ['ИНВ.', 'Инвентарь'], skins: ['СКИН', 'Выбор скина'], buy: ['СЕЙВ', 'Сохранить игру'], stats: ['ПЕРС.', 'Характеристики'], credits: ['КОНЕЦ', 'Титры'],
};
const TIPS = {
  imago: 'Петля держит угол от 20 до 160°: поставьте телефон домиком и смотрите кино без подставки.',
  eyes: 'Заприте внешнюю дверь на один глаз, а внутреннюю — на другой.',
  eclipse: 'ND-фильтр нужен днём: выдержка длиннее, и водопад превращается в шёлк.',
  ultra: 'Нажимайте на районы кристалла.',
  rtx: 'Настройки графики есть и в меню паузы: Esc.',
  exe: 'В САПЁР.EXE правая кнопка мыши или долгое нажатие ставит флажок.',
  boss: 'Этого босса не победить. Попробуйте всё равно.',
  inventory: 'Рубильники работают на ощупь — даже в темноте.',
  skins: 'Скины бесплатные. Все пять.',
  buy: 'Сохраняйтесь чаще.',
  stats: 'Все характеристики — на отдельной странице.',
  credits: 'Не уходите сразу после титров.',
};
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
const PINNED = { imago: '+=160%' };
let current = '';
let reducedMode = false;
let booted = false;

const loading = $('[data-loading]');
const loadBar = $('[data-load-bar]');
function showLoading(id) {
  if (reducedMode || !booted || !TIPS[id]) return;
  $('[data-load-title]').textContent = `Загрузка · ${LEVEL[id][1]}`;
  $('[data-load-tip]').textContent = `Совет: ${TIPS[id]}`;
  gsap.killTweensOf([loading, loadBar]);
  gsap.set(loadBar, { width: '0%' });
  gsap.timeline()
    .fromTo(loading, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.25 })
    .to(loadBar, { width: '100%', duration: 0.9, ease: 'power2.inOut' }, 0)
    .to(loading, { opacity: 0, y: -10, duration: 0.4, delay: 1.2 });
}

function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  $('[data-hud-xp]').style.width = `${(clamp01(window.scrollY / Math.max(1, max)) * 100).toFixed(1)}%`;
  root.style.setProperty('--scroll', clamp01(window.scrollY / Math.max(1, max)).toFixed(3));
  if (id === current) return;
  const prev = current;
  current = id;
  $('[data-hud-n]').textContent = LEVEL[id][0];
  $('[data-hud-name]').textContent = LEVEL[id][1];
  $('[data-hud-lvl]').setAttribute('href', `#${id}`);
  if (prev) showLoading(id);
  if (id !== 'hero' && booted) unlock('start');
  if (id === 'buy') unlock('save');
  updateScreen();
}

/* ---------- Экраны телефона ---------- */

let lastScreenKey = '';
function updateScreen(force = false) {
  if (!stage) return;
  let mode = 'lock';
  const extra = { rub: demo.rub, rub2: demo.rub2, rtx: gfx.rtx ? 1 : 0, dlssLabel: DLSS[gfx.dlss].label, fps: gfx.rtx ? 120 : 165 };
  if (current === 'hero') mode = 'title';
  else if (current === 'imago' || current === 'exe') mode = 'desk';
  else if (current === 'eyes') {
    mode = 'retina';
    Object.assign(extra, { scan: eye.scan.in, ok: eye.ok.in, seed: SEEDS[eye.key.in], coverScan: eye.scan.out, coverOk: eye.ok.out, coverSeed: SEEDS[eye.key.out], coverSub: eye.key.out === 'L' ? 'ЛЕВЫЙ ГЛАЗ' : 'ПРАВЫЙ ГЛАЗ', retinaText: `ВНУТРЕННЯЯ ДВЕРЬ · ${eye.key.in === 'L' ? 'ЛЕВЫЙ' : 'ПРАВЫЙ'} ГЛАЗ` });
  } else if (current === 'eclipse') { mode = 'camera'; extra.ndLabel = ndLabel(demo.nd).toUpperCase(); }
  else if (current === 'ultra' || current === 'rtx') mode = 'game';
  else if (current === 'boss') { mode = 'boss'; extra.dmg = 0; }
  else if (current === 'inventory') {
    mode = demo.torch !== 'off' ? 'torch' : 'kill';
    Object.assign(extra, { torch: demo.torch === 'off' ? 0 : 1, torchColor: demo.torch === 'red' || demo.torch === 'sos' ? 'red' : 'white', torchMode: TORCH[demo.torch].mode });
  }
  const key = mode + JSON.stringify(extra);
  if (key === lastScreenKey && !force) return;
  lastScreenKey = key;
  stage.setScreen(mode, extra);
}

/* ---------- Позы ---------- */

// x/y — доля половины видимой ширины/высоты; fold 1 — сложен; ry = 0 — к нам внутренним экраном (или внешним у сложенного)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, s: 1, dist: 6, float: 1, vis: 1, spin: 0, fold: 1, screen: 1, cover: 1 };
function makePoses(mobile) {
  const P = {
    far: { x: 0.25, y: 0.1, rx: 0.3, ry: PI - 0.2, rz: -0.2, dist: 30, float: 0, fold: 1 },
    hero: { x: 0.56, y: -0.08, rx: 0.12, ry: -0.5, rz: 0.03, dist: 7.4, fold: 0.38 },
    imago0: { x: 0.44, rx: 0.12, ry: 0.35, rz: 0.02, dist: 6.4, fold: 1, float: 0.4 },
    imago1: { x: 0.4, rx: 0.05, ry: -0.1, dist: 7.0, fold: 0, float: 0.4 },
    eclipse: { x: 0.46, fy: 0.3, rx: 0.08, ry: PI + 0.3, rz: -0.02, dist: 5.2, fold: 1 },
    boss: { x: -0.44, rx: 0.06, ry: 0.28, dist: 7.2, fold: 0, float: 0.6 },
    inventory: { x: 0.6, y: 0.4, rx: 0.9, ry: PI + 0.35, dist: 9.5, fold: 1, float: 0.3 },
    skins: { x: 0.45, rx: 0.1, ry: PI - 0.42, rz: 0.03, dist: 5.6, fold: 1 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  if (!mobile) return P;
  for (const k in P) {
    const p = P[k];
    P[k] = { ...p, x: 0, y: -0.42, dist: p.dist * 1.9 };
  }
  P.imago0 = { ...P.imago0, y: -0.5, dist: 13 };
  P.imago1 = { ...P.imago1, y: -0.5, ry: 0, dist: 16 };
  P.hero = { ...P.hero, vis: 0 };
  for (const k of ['eclipse', 'boss', 'inventory']) P[k] = { ...P[k], vis: 0 };
  P.skins = { ...P.skins, y: -0.5, dist: 9 };
  P.far = { ...P.far, y: -0.3 };
  P.mobile = true;
  return P;
}

const Keys = createKeys();
const sts = {};
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });

/* ---------- Заголовки по словам ---------- */

function splitWords(el) {
  const words = [];
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of n.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(part); continue; }
          const w = document.createElement('span');
          w.className = 'x-w';
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
const splitHeads = $$('[data-split]').filter((el) => !el.closest('#hero')).map((el) => ({ el, words: splitWords(el) }));

/* ---------- Титул: «Нажмите любую клавишу» ---------- */

const IGNORE_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'F5', 'F12']);
function goto(id) {
  const t = document.getElementById(id);
  if (!t) return;
  if (smooth.lenis) smooth.lenis.scrollTo(t, { duration: 1.4 }); else t.scrollIntoView({ behavior: reducedMode ? 'auto' : 'smooth' });
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !pause.open) { e.preventDefault(); openPause('gfx'); return; }
  if (current !== 'hero' || pause.open || e.ctrlKey || e.metaKey || e.altKey || IGNORE_KEYS.has(e.key)) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (document.activeElement?.closest('.b-menu, .site-header, .b-hud')) return;
  goto('imago');
});

/* ---------- Уровень 1. Имаго ---------- */

const angleOut = $('[data-angle]');
const creaseOut = $('[data-crease]');
function setImago(p) {
  const k = ease((p - 0.05) / 0.8);
  angleOut.textContent = String(Math.round(k * 180));
  creaseOut.textContent = k > 0.98 ? '0,03 мм' : k > 0.02 ? 'выпрямляется' : 'сложен';
  if (k > 0.97 && booted) unlock('unfold');
}

/* ---------- Уровень 2. Два глаза ---------- */

const SEEDS = { L: 11, R: 23, X: 57, P: 11 };
const eye = { key: { out: 'L', in: 'R' }, look: 'L', scan: { out: 0, in: 0 }, ok: { out: null, in: null }, opened: { out: false, in: false } };
const eyeCv = { out: $('[data-eye="out"]'), in: $('[data-eye="in"]') };
const eyeVerdict = $('[data-eye-verdict]');
function drawDoor(door) {
  const cv = eyeCv[door];
  const { w, h } = fit(cv);
  if (!w) return;
  const g = cv.getContext('2d');
  g.fillStyle = '#06070C';
  g.fillRect(0, 0, w, h);
  const scanning = eye.scan[door] > 0 && eye.scan[door] < 1;
  const seed = scanning || eye.ok[door] !== null ? SEEDS[eye.look] : SEEDS[eye.key[door]];
  drawEye(g, w / 2, h / 2, w * 0.36, { scan: eye.scan[door], ok: eye.ok[door], accent: B5_COLORS[demo.color].ui, seed });
  if (eye.look === 'P' && (scanning || eye.ok[door] === false)) {
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.fillRect(0, 0, w, h);
  }
}
const keyGroups = { out: $('[data-key-out]'), in: $('[data-key-in]') };
for (const door of ['out', 'in']) {
  initRadioGroup(keyGroups[door], (v) => {
    syncRadio(keyGroups[door], v);
    eye.key[door] = v;
    eye.ok[door] = null;
    eye.opened[door] = false;
    $(`[data-door="${door}"]`).classList.remove('is-open', 'is-denied');
    drawDoor(door);
    updateScreen();
    eyeVerdict.textContent = `Снаружи заперто на ${eye.key.out === 'L' ? 'левый' : 'правый'} глаз, внутри — на ${eye.key.in === 'L' ? 'левый' : 'правый'}.`;
  });
}
const lookGroup = $('[data-look]');
initRadioGroup(lookGroup, (v) => { syncRadio(lookGroup, v); eye.look = v; });
$$('[data-scan]').forEach((b) => b.addEventListener('click', () => {
  const door = b.dataset.scan;
  demo.eye = door;
  eye.ok[door] = null;
  const box = $(`[data-door="${door}"]`);
  box.classList.remove('is-open', 'is-denied');
  const o = { t: 0 };
  eyeVerdict.textContent = door === 'in' ? 'Телефон раскрывается, CPix 3 уводит пиксели, сканер светит в зрачок…' : 'Внешний CPix 3 уводит пиксели, сканер светит в зрачок…';
  const finish = () => {
    eye.scan[door] = 1;
    const ok = eye.look === eye.key[door];
    eye.ok[door] = ok;
    eye.opened[door] = ok;
    box.classList.add(ok ? 'is-open' : 'is-denied');
    const doorName = door === 'in' ? 'Внутренняя дверь' : 'Внешняя дверь';
    if (ok) eyeVerdict.textContent = `${doorName} открыта. ${door === 'in' ? 'Всё внутри — ваше.' : 'Снаружи — звонки, камера и карты.'}`;
    else if (eye.look === 'X') eyeVerdict.textContent = `${doorName}: чужой рисунок сосудов. Заперто.`;
    else if (eye.look === 'P') eyeVerdict.textContent = `${doorName}: зрачок не сузился от вспышки — это фото. Заперто, попытка записана в журнал.`;
    else eyeVerdict.textContent = `${doorName}: это ваш глаз, но не тот. Эта дверь заперта на ${eye.key[door] === 'L' ? 'левый' : 'правый'}.`;
    drawDoor(door);
    updateScreen();
    if (eye.opened.out && eye.opened.in) unlock('twoeyes');
  };
  if (reducedMode) { finish(); return; }
  gsap.to(o, { t: 1, duration: 0.9, ease: 'none', onUpdate: () => { eye.scan[door] = o.t; drawDoor(door); updateScreen(); }, onComplete: finish });
}));

/* ---------- Уровень 3. Затмение ---------- */

const ndIn = $('[data-nd]');
const ndOut = $('[data-nd-out]');
const fallsCv = $('[data-falls]');
const fallsLabel = $('[data-falls-label]');
const sun0 = $('[data-sun="0"]');
const SHUTTER = ['1/500 с', '1/250 с', '1/125 с', '1/60 с', '1/30 с', '1/15 с', '1/8 с', '1/4 с', '1/2 с', '1 с', '2 с', '4 с'];
function ndLabel(n) {
  if (n <= 0) return '«Затмение» выкл · 1/500 с';
  if (n >= 12) return '«Затмение» полное · камеры обесточены';
  return `ND ${2 ** n} · ${n} ${n === 1 ? 'ступень' : n < 5 ? 'ступени' : 'ступеней'} · ${SHUTTER[n]}`;
}
function setNd(n) {
  demo.nd = n;
  ndOut.textContent = n >= 12 ? 'шторка' : `${n} ${n === 1 ? 'ступень' : n > 1 && n < 5 ? 'ступени' : 'ступеней'}`;
  fallsLabel.textContent = ndLabel(n);
  sun0.classList.toggle('is-visible', n >= 11);
  if (n >= 12) unlock('eclipse');
  updateScreen();
}
ndIn.addEventListener('input', () => setNd(+ndIn.value));
const falls = { visible: false, raf: 0 };
function fallsLoop(now) {
  falls.raf = 0;
  const { w, h } = fit(fallsCv);
  const g = fallsCv.getContext('2d');
  const n = demo.nd;
  if (n >= 12) {
    g.fillStyle = '#04050A';
    g.fillRect(0, 0, w, h);
    // в непроглядном стекле отражается небо — и кое-что ещё
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, 'rgba(90,110,160,.18)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  } else {
    drawFalls(g, w, h, { nd: n / 11, t: now / 1000 });
    // ND-фильтр затемняет кадр, экспозицию компенсирует выдержка — но не до конца
    g.fillStyle = `rgba(6,10,22,${(n / 11) * 0.35})`;
    g.fillRect(0, 0, w, h);
  }
  if (falls.visible && !reducedMode) falls.raf = requestAnimationFrame(fallsLoop);
}

/* ---------- Уровень 4. GP30 Ultra ---------- */

const DIE = {
  p: ['Большие ядра', 'Восемь ядер до 5,4 ГГц. Игры, компиляция и «Мираж 3», когда он переводит .exe на лету.'],
  m: ['Средние ядра', 'Десять ядер до 4,4 ГГц: браузер, приложения, окна на обеих половинах.'],
  e: ['Экономные ядра', 'Двенадцать ядер до 3,1 ГГц. Почта, музыка и часы на внешнем экране — почти без батареи.'],
  g: ['FIG FourNV', '24 графических ядра, RT-ядра для трассировки лучей и тензорные ядра для DLSS. Первая графика Fyr, сделанная вместе с NVIDIA. ~9600 ГФЛОПС.'],
  n: ['Нейроядро', '300 TOPS. «Погонщик» думает в телефоне, а DLSS дорисовывает кадры, не трогая облако.'],
  r: ['Модем FM3 Ultra', '5G с mmWave и спутником. Как у 0X5, с «Ловцом вышек 3».'],
  c: ['Общий кеш', '48 МБ — у графики и процессора одна память, кадр не гоняется туда-обратно.'],
};
const dieGrp = $('[data-die]');
initRadioGroup(dieGrp, (v) => {
  syncRadio(dieGrp, v);
  $('[data-die-k]').textContent = DIE[v][0];
  $('[data-die-t]').textContent = DIE[v][1];
});

/* ---------- Уровень 5. RTX и DLSS ---------- */

// кадры в секунду в тяжёлой игре на 1440p (вымышленные): [без DLSS, К, Б, П]
const FPS = { on: [48, 86, 104, 128], off: [92, 140, 158, 165] };
const FPS_OLD = { on: 14, off: 41 };
const DIDX = { off: 0, q: 1, b: 2, p: 3 };
function fpsFor() {
  const base = FPS[gfx.rtx ? 'on' : 'off'][DIDX[gfx.dlss]];
  return Math.min(330, base * (gfx.fg && gfx.dlss !== 'off' ? 2 : 1));
}
function paintFpsBars() {
  const b = fpsFor(), o = FPS_OLD[gfx.rtx ? 'on' : 'off'];
  $('[data-fv="b"]').textContent = `${b} к/с`;
  $('[data-fv="o"]').textContent = `${o} к/с`;
  $('[data-fb="b"]').style.width = `${(b / 330) * 100}%`;
  $('[data-fb="o"]').style.width = `${(o / 330) * 100}%`;
  const d = DLSS[gfx.dlss];
  $('[data-rtx-note]').textContent = gfx.dlss === 'off'
    ? 'DLSS выкл: каждый пиксель 1440p считается честно. Красиво — и медленно.'
    : `${d.label}: кадр считается в ${Math.round(1440 * d.k)}p, нейросеть дорисовывает до 1440p.${gfx.fg ? ' Генерация кадров вставляет по кадру между настоящими.' : ''}`;
  $('[data-rtx-l]').textContent = gfx.dlss === 'off' ? '1440p · нативное' : `${Math.round(1440 * d.k)}p · без DLSS`;
  $('[data-rtx-r]').textContent = gfx.dlss === 'off' ? '1440p · нативное' : 'DLSS → 1440p';
}
const rtxCv = $('[data-rtx-cv]');
const rtxSplit = $('[data-rtx-split]');
const lowCv = document.createElement('canvas');
const rtx = { visible: false, raf: 0, split: 0.5, last: 0 };
function rtxLoop(now) {
  rtx.raf = 0;
  if (now - rtx.last > 40) {
    rtx.last = now;
    const { w, h } = fit(rtxCv);
    const g = rtxCv.getContext('2d');
    const t = now / 1000;
    const accent = B5_COLORS[demo.color].ui;
    drawNeon(g, w, h, { rtx: gfx.rtx ? 1 : 0, t, accent });
    // левая сторона — тот же кадр в низком разрешении, растянутый без DLSS
    const k = DLSS[gfx.dlss].k * 0.5;
    if (gfx.dlss !== 'off') {
      lowCv.width = Math.max(32, Math.round(w * k));
      lowCv.height = Math.max(18, Math.round(h * k));
      drawNeon(lowCv.getContext('2d'), lowCv.width, lowCv.height, { rtx: gfx.rtx ? 1 : 0, t, accent });
      g.save();
      g.beginPath();
      g.rect(0, 0, w * rtx.split, h);
      g.clip();
      g.imageSmoothingEnabled = false;
      g.drawImage(lowCv, 0, 0, w, h);
      g.restore();
    }
  }
  if (rtx.visible && !reducedMode) rtx.raf = requestAnimationFrame(rtxLoop);
}
function setSplit(v) {
  rtx.split = Math.min(0.95, Math.max(0.05, v));
  rtxSplit.style.left = `${rtx.split * 100}%`;
  rtxSplit.setAttribute('aria-valuenow', String(Math.round(rtx.split * 100)));
  rtx.last = 0;
  if (!rtx.raf) rtx.raf = requestAnimationFrame(rtxLoop);
}
{
  let drag = false;
  const view = $('[data-rtx-view]');
  const at = (e) => { const r = view.getBoundingClientRect(); setSplit((e.clientX - r.left) / r.width); };
  view.addEventListener('pointerdown', (e) => { drag = true; view.setPointerCapture?.(e.pointerId); at(e); });
  view.addEventListener('pointermove', (e) => { if (drag) at(e); });
  view.addEventListener('pointerup', () => { drag = false; });
  view.addEventListener('pointercancel', () => { drag = false; });
  rtxSplit.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { setSplit(rtx.split - 0.05); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setSplit(rtx.split + 0.05); e.preventDefault(); }
  });
}

/* ---------- Уровень 6. Окна в пустыне ---------- */

const desk = $('[data-desk]');
function openWin(id) {
  $$('.b-win', desk).forEach((w) => { w.hidden = w.dataset.win !== id; });
  const w = $(`[data-win="${id}"]`, desk);
  if (id === 'saper' && !sp.cells.length) newSaper();
  if (id === 'setup') setupStep(0);
  if (!reducedMode) gsap.fromTo(w, { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: 'power2.out' });
  ($('[data-close]', w))?.focus({ preventScroll: true });
}
$$('[data-app]', desk).forEach((b) => {
  b.addEventListener('click', () => { $$('.b-icon', desk).forEach((x) => x.classList.toggle('is-sel', x === b)); openWin(b.dataset.app); });
});
$$('[data-close]', desk).forEach((b) => b.addEventListener('click', () => { const w = b.closest('.b-win'); w.hidden = true; $(`[data-app="${w.dataset.win}"]`, desk)?.focus({ preventScroll: true }); }));
const clock = $('[data-clock]');
const tickClock = () => { const d = new Date(); clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
tickClock();
setInterval(tickClock, 30000);

const SETUP = [
  'Добро пожаловать в мастер установки. Программа написана для ПК в 2011 году. Телефону всё равно.',
  'Лицензионное соглашение: вы соглашаетесь, что запускаете .exe на телефоне. Ещё год назад это было шуткой.',
  'Папка установки: C:\\Караван\\Program Files\\. Да, у CamelOS теперь есть диск C.',
  'Установка… «Мираж 3» переводит x86-64 в ARM и кладёт перевод в кеш: второй запуск будет быстрым.',
  'Готово. Программа в «Карантине» Love Gen 5 Semi: к камере, микрофону и ключам — только с вашего разрешения.',
];
let setupI = 0;
function setupStep(i) {
  setupI = i;
  $('[data-setup-text]').textContent = SETUP[i];
  $('[data-setup-bar]').style.width = `${(i / (SETUP.length - 1)) * 100}%`;
  $('[data-setup-next]').textContent = i === SETUP.length - 1 ? 'Готово' : 'Далее >';
}
$('[data-setup-next]').addEventListener('click', () => {
  if (setupI >= SETUP.length - 1) { $('[data-win="setup"]').hidden = true; return; }
  setupStep(setupI + 1);
});

// САПЁР.EXE: 9 × 9, 10 мин. Первый ход всегда безопасен
const sp = { cells: [], mines: new Set(), open: new Set(), flags: new Set(), over: false, started: 0, timer: 0 };
const spGrid = $('[data-sp-grid]');
const N = 9, MINES = 10;
const nbrs = (i) => { const r = Math.floor(i / N), c = i % N, out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc); } return out; };
function newSaper() {
  sp.mines.clear(); sp.open.clear(); sp.flags.clear(); sp.over = false; sp.started = 0;
  clearInterval(sp.timer);
  $('[data-sp-time]').textContent = '000';
  $('[data-sp-new]').textContent = '☺';
  spGrid.replaceChildren();
  sp.cells = [];
  for (let i = 0; i < N * N; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'gridcell');
    b.dataset.i = i;
    b.tabIndex = i === 0 ? 0 : -1;
    b.setAttribute('aria-label', `Клетка ${Math.floor(i / N) + 1}-${(i % N) + 1}, закрыта`);
    sp.cells.push(b);
  }
  spGrid.append(...sp.cells);
  paintMines();
}
function paintMines() { $('[data-sp-mines]').textContent = `Мин: ${MINES - sp.flags.size}`; }
function plant(safe) {
  const ban = new Set([safe, ...nbrs(safe)]);
  while (sp.mines.size < MINES) { const i = Math.floor(Math.random() * N * N); if (!ban.has(i)) sp.mines.add(i); }
}
function reveal(i) {
  if (sp.over || sp.open.has(i) || sp.flags.has(i)) return;
  if (!sp.started) {
    plant(i);
    sp.started = performance.now();
    sp.timer = setInterval(() => { $('[data-sp-time]').textContent = String(Math.min(999, Math.floor((performance.now() - sp.started) / 1000))).padStart(3, '0'); }, 500);
  }
  if (sp.mines.has(i)) {
    sp.over = true;
    clearInterval(sp.timer);
    sp.mines.forEach((m) => { sp.cells[m].textContent = '✹'; sp.cells[m].classList.add('is-open', 'is-mine'); });
    $('[data-sp-new]').textContent = '☹';
    unlock('boom');
    toast('Подорвались. Нажмите на смайлик — новая партия.');
    return;
  }
  const stack = [i];
  while (stack.length) {
    const j = stack.pop();
    if (sp.open.has(j) || sp.flags.has(j)) continue;
    sp.open.add(j);
    const n = nbrs(j).filter((k) => sp.mines.has(k)).length;
    const b = sp.cells[j];
    b.classList.add('is-open');
    b.textContent = n ? String(n) : '';
    b.dataset.n = n;
    b.setAttribute('aria-label', `Клетка ${Math.floor(j / N) + 1}-${(j % N) + 1}, ${n ? `рядом мин: ${n}` : 'пусто'}`);
    if (!n) stack.push(...nbrs(j));
  }
  if (sp.open.size === N * N - MINES) {
    sp.over = true;
    clearInterval(sp.timer);
    $('[data-sp-new]').textContent = '☻';
    unlock('saper');
    toast(`Победа за ${Math.round((performance.now() - sp.started) / 1000)} с. На 165 Гц.`);
  }
}
function flag(i) {
  if (sp.over || sp.open.has(i)) return;
  if (sp.flags.has(i)) { sp.flags.delete(i); sp.cells[i].textContent = ''; } else { sp.flags.add(i); sp.cells[i].textContent = '⚑'; }
  sp.cells[i].setAttribute('aria-label', `Клетка ${Math.floor(i / N) + 1}-${(i % N) + 1}, ${sp.flags.has(i) ? 'флажок' : 'закрыта'}`);
  paintMines();
}
{
  let press = 0, pressI = -1, longDone = false;
  spGrid.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button');
    if (!b || e.button !== 0) return;
    pressI = +b.dataset.i;
    longDone = false;
    clearTimeout(press);
    if (e.pointerType !== 'mouse') press = setTimeout(() => { longDone = true; flag(pressI); }, 450);
  });
  spGrid.addEventListener('pointerup', () => clearTimeout(press));
  spGrid.addEventListener('pointercancel', () => clearTimeout(press));
  spGrid.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (longDone) { longDone = false; return; } reveal(+b.dataset.i); });
  spGrid.addEventListener('contextmenu', (e) => { const b = e.target.closest('button'); if (!b) return; e.preventDefault(); flag(+b.dataset.i); });
  spGrid.addEventListener('keydown', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const i = +b.dataset.i;
    const mv = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: N, ArrowUp: -N }[e.key];
    if (mv !== undefined) {
      const j = i + mv;
      if (j < 0 || j >= N * N || (Math.abs(mv) === 1 && Math.floor(j / N) !== Math.floor(i / N))) return;
      e.preventDefault();
      b.tabIndex = -1;
      sp.cells[j].tabIndex = 0;
      sp.cells[j].focus();
    } else if (e.key === 'f' || e.key === 'а' || e.key === 'F' || e.key === 'А') { e.preventDefault(); flag(i); }
  });
}
$('[data-sp-new]').addEventListener('click', newSaper);

/* ---------- Уровень 7. Босс ---------- */

const MOVES = {
  hinge: 'Вскрыть петлю: сетка от вскрытия идёт и через петлю — «Мёртвая петля 2» стёрла ключи раньше, чем отвёртка дошла до винта.',
  photo: 'Фото глаза: зрачок не сузился от вспышки, а на снимке нет глубины. Попытка записана в журнал «Веко 3».',
  usb: 'USB-отладка: заблокированный телефон в «Коконе» — USB-C только заряжает. Данных нет.',
  exe: 'Вирус.exe: «Мираж 3» запустил его в «Карантине». Камера, микрофон и ключи для него не существуют.',
  fw: 'Подменить прошивку: обновление без подписи «2 из 3» не принимается. Один ключ у OY, два у Fyr.',
};
const bossLog = $('[data-boss-log]');
const bossBar = $('[data-boss-bar]');
const bossBox = $('.b-boss');
$$('[data-move]').forEach((b) => b.addEventListener('click', () => {
  const id = b.dataset.move;
  const li = document.createElement('li');
  li.innerHTML = '<b>Урон: 0.</b> <span></span>';
  li.querySelector('span').textContent = MOVES[id];
  bossLog.prepend(li);
  b.classList.add('is-used');
  if (!save.boss.includes(id)) { save.boss.push(id); persist(); }
  if (!reducedMode) {
    bossBox.classList.remove('is-hit');
    void bossBox.offsetWidth;
    bossBox.classList.add('is-hit');
    gsap.fromTo(bossBar, { width: '86%' }, { width: '100%', duration: 0.5, ease: 'power2.out' });
  }
  if (Object.keys(MOVES).every((m) => save.boss.includes(m))) {
    unlock('boss');
    const fin = document.createElement('li');
    fin.innerHTML = '<b>Босс непобедим.</b> Так и задумано: Love Gen 5 Semi защищает вас, а не себя.';
    bossLog.prepend(fin);
  }
}));
save.boss.forEach((m) => $(`[data-move="${m}"]`)?.classList.add('is-used'));

/* ---------- Инвентарь ---------- */

const TORCH = {
  off: { label: 'выкл', mode: '' },
  white: { label: 'белый · 1000 лм', mode: 'белый свет из петли · 1000 лм' },
  red: { label: 'красный', mode: 'красный: не слепит ночное зрение' },
  sos: { label: 'SOS', mode: 'SOS · · · — — — · · ·' },
};
const TORCH_ORDER = ['off', 'white', 'red', 'sos'];
const RUB = ['1 · всё работает', '2 · без микрофонов', '3 · без камер и микрофонов'];
const RUB2 = ['1 · всё работает', '2 · без геолокации', '3 · эфир выключен'];
$$('[data-item]').forEach((b) => b.addEventListener('click', () => {
  const id = b.dataset.item;
  if (id === 'rub') { demo.rub = (demo.rub + 1) % 3; $('[data-item-state="rub"]').textContent = RUB[demo.rub]; }
  if (id === 'rub2') { demo.rub2 = (demo.rub2 + 1) % 3; $('[data-item-state="rub2"]').textContent = RUB2[demo.rub2]; }
  if (id === 'torch') {
    demo.torch = TORCH_ORDER[(TORCH_ORDER.indexOf(demo.torch) + 1) % TORCH_ORDER.length];
    $('[data-item-state="torch"]').textContent = TORCH[demo.torch].label;
    stage?.setTorchColor(demo.torch === 'red' || demo.torch === 'sos' ? 'red' : 'white');
  }
  updateScreen();
}));
const SOS = [1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0];
function torchLevel(now) {
  if (demo.torch === 'off') return 0;
  if (demo.torch === 'sos') return SOS[Math.floor(now / 220) % SOS.length];
  return 1;
}

/* ---------- Выбор скина ---------- */

const COLOR_NOTES = {
  peacock: '«Павлиний глаз». Винный с переливом, как крыло бабочки, у которой на каждом крыле по глазу. Рамка — тёмная роза.',
  blue: '«Голубянка». Небесно-голубое стекло с перламутровым переливом и серебристо-голубой титан.',
  brimstone: '«Лимонница». Бледно-лимонный — первая бабочка весны. Рамка цвета сухой травы.',
  mourning: '«Траурница». Шоколадная спинка и кремовая рамка — как светлая кайма на тёмных крыльях.',
  pearl: '«Перламутровка». Перламутровое стекло с переливом и медная рамка — изнанка крыла и его лицо.',
};
const colorGrps = [$('[data-colors]'), $('[data-colors-buy]')];
const colorNote = $('[data-color-note]');
const buyColor = $('[data-buy-color]');
function applyColor(v, { instant = false, twirl = true } = {}) {
  if (!B5_COLORS[v]) return;
  const changed = v !== demo.color;
  demo.color = v;
  colorGrps.forEach((g) => syncRadio(g, v));
  root.dataset.color = v;
  store.set('oy-x5b-color', v);
  colorNote.textContent = COLOR_NOTES[v];
  buyColor.textContent = B5_COLORS[v].label;
  stage?.setBodyColor(v, instant);
  if (!save.skins.includes(v)) { save.skins.push(v); persist(); }
  if (save.skins.length >= 5) unlock('skin');
  drawDoor('out');
  drawDoor('in');
  if (changed && twirl && !instant && !reducedMode) gsap.fromTo(demo, { twirl: 0 }, { twirl: 1, duration: 1.1, ease: 'power3.inOut', onComplete: () => { demo.twirl = 0; } });
}
colorGrps.forEach((g) => initRadioGroup(g, (v) => applyColor(v)));
const saved = root.dataset.color;
if (saved && saved !== 'peacock') applyColor(saved, { instant: true, twirl: false });
else if (!save.skins.includes('peacock')) { save.skins.push('peacock'); persist(); }

/* ---------- Сохранить игру ---------- */

const curGrp = $('[data-cur]');
const memGrp = $('[data-mem]');
const totalOut = $('[data-total]');
const totalK = $('[data-total-k]');
const totalHex = $('[data-total-hex]');
const CUR = {
  usd: { k: 'США', sym: '$', f: (n) => `$${num(n)}` },
  cad: { k: 'Канада', sym: 'C$', f: (n) => `C$${num(n)}` },
  eur: { k: 'Евросоюз', sym: '€', f: (n) => `€${num(n)}` },
  sek: { k: 'Швеция', sym: 'kr', f: (n) => `${num(n)} kr` },
};
let cur = 'usd';
function paintTotal(animate = true) {
  const mem = memGrp.querySelector('[aria-checked="true"]');
  const total = Number(mem.dataset[cur]);
  totalK.textContent = `Итого · ${CUR[cur].k}`;
  totalHex.textContent = `Fyr пишет: 0x${total.toString(16).toUpperCase()} ${CUR[cur].sym}`;
  if (!animate || reducedMode) { totalOut.textContent = CUR[cur].f(total); return; }
  const from = Number(totalOut.textContent.replace(/[^0-9]/g, '')) || total;
  const o = { v: from };
  gsap.to(o, { v: total, duration: 0.6, ease: 'power2.out', onUpdate: () => { totalOut.textContent = CUR[cur].f(Math.round(o.v)); } });
}
initRadioGroup(curGrp, (v) => { syncRadio(curGrp, v); cur = v; paintTotal(); });
initRadioGroup(memGrp, (v) => { syncRadio(memGrp, v); paintTotal(); });
paintTotal(false);
$('[data-buy]').addEventListener('click', () => toast('Сохраниться здесь нельзя: это концепт. Прогресс тайн и достижений браузер помнит.'));

/* ---------- Титры ---------- */

const credits = $('[data-credits]');
$('[data-roll]').addEventListener('animationend', () => unlock('credits'));

/* ---------- Хореография ---------- */

function addKeys(P) {
  const K = (id, f, props) => Keys.add(sts[id], f, props);
  const leave = (pose) => ({ ...pose, y: pose.y + 1.3, vis: 0, float: 0 });
  const enter = (pose) => ({ ...pose, y: pose.y - 1.3, vis: 0, float: 0 });
  K('hero', -1, P.hero);
  K('hero', 0, P.hero);
  K('imago', -0.6, P.mobile ? { ...P.imago0, vis: 0 } : P.hero);
  K('imago', 0, P.imago0);
  K('imago', 0.05, P.imago0);
  K('imago', 0.85, P.imago1);
  K('eyes', -0.5, P.imago1);
  K('eyes', -0.2, leave(P.imago1));
  K('eclipse', -0.4, enter(P.eclipse));
  K('eclipse', -0.1, P.eclipse);
  K('eclipse', P.mobile ? 0.1 : 0.4, P.eclipse);
  K('ultra', P.mobile ? -0.7 : -0.5, leave(P.eclipse));
  K('boss', -0.4, enter(P.boss));
  K('boss', -0.1, P.boss);
  K('boss', P.mobile ? 0.1 : 0.4, P.boss);
  K('inventory', -0.55, leave(P.boss));
  K('inventory', -0.3, enter(P.inventory));
  K('inventory', 0, P.inventory);
  K('inventory', P.mobile ? 0.05 : 0.45, P.inventory);
  K('skins', -0.55, leave(P.inventory));
  K('skins', -0.4, enter(P.skins));
  K('skins', -0.1, P.skins);
  K('skins', P.mobile ? 0.15 : 0.45, P.skins);
  K('buy', -0.5, leave(P.skins));
  K('buy', 0.5, leave(P.skins));
}

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  for (const id of CHAPTERS) {
    if (PINNED[id]) {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sections[id], start: 'top top', end: reduce ? 'bottom top' : PINNED[id], pin: !reduce, scrub: reduce ? false : true, anticipatePin: 1,
          onUpdate: (st) => setImago(st.progress),
        },
      });
      tl.set({}, {}, 1);
      sts[id] = tl.scrollTrigger;
    } else {
      sts[id] = ScrollTrigger.create({ trigger: sections[id], start: 'top top', end: 'bottom top' });
    }
  }
  setImago(reduce ? 1 : 0);
  Keys.reset();
  addKeys(makePoses(isMobile));
  if (reduce) {
    credits.classList.add('is-static');
  } else {
    for (const { el, words } of splitHeads) {
      gsap.fromTo(words, { yPercent: 110, opacity: 0 }, {
        yPercent: 0, opacity: 1, duration: 0.9, ease: 'power4.out', stagger: 0.05,
        scrollTrigger: { trigger: el, start: 'top 86%', toggleActions: 'play none none reverse' },
      });
    }
    $$('.b-lvl b').forEach((b) => {
      if (b.closest('#hero')) return;
      gsap.fromTo(b, { clipPath: 'polygon(8px 0, 8px 0, 0 100%, 0 100%)' }, { clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)', duration: 0.5, ease: 'steps(5)', scrollTrigger: { trigger: b, start: 'top 90%', toggleActions: 'play none none none' } });
    });
    $$('.b-lead, .b-quest, .b-eyes, .b-falls, .b-die, .b-rtx, .b-desk, .b-boss, .b-slot, .b-skins, .b-buy__panel, .b-sheet div').forEach((el) => {
      if (el.closest('#hero') || el.closest('.b-pause')) return;
      gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
    });
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
  const vis = (sel, cb) => ScrollTrigger.create({ trigger: sel, start: 'top bottom', end: 'bottom top', onToggle: (st) => cb(st.isActive) });
  vis('[data-falls]', (on) => { falls.visible = on; if (on && !falls.raf) falls.raf = requestAnimationFrame(fallsLoop); });
  vis('[data-rtx-cv]', (on) => { rtx.visible = on; if (on && !rtx.raf) rtx.raf = requestAnimationFrame(rtxLoop); });
  vis('.b-eyes', (on) => { if (on) { drawDoor('out'); drawDoor('in'); } });
  ScrollTrigger.create({
    trigger: credits, start: 'top 75%', once: true,
    onEnter: () => { if (reducedMode) unlock('credits'); else credits.classList.add('is-rolling'); },
  });
}

/* ---------- Каждый тик: прокрутка → модель ---------- */

let lastY = -1;
let lastDetect = 0;
let dark = 0;
let lastT = performance.now();
const darkEl = $('[data-dark]');
const pointer = { x: 0, y: 0 };
function tick() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  const y = window.scrollY;
  if (y !== lastY || now - lastDetect > 500) { lastY = y; lastDetect = now; detectChapter(); }

  const torch = current === 'inventory' ? torchLevel(now) : 0;
  const wantDark = current === 'inventory' && demo.torch !== 'off' ? 0.78 : 0;
  dark += (wantDark - dark) * (reducedMode ? 1 : 1 - Math.exp(-dt * 4));
  darkEl.style.opacity = dark.toFixed(3);
  if (Keys.empty || !stage) return;
  const v = Keys.sample(y, reducedMode);
  if (current === 'hero' && !reducedMode) {
    v.ry = (v.ry ?? 0) + pointer.x * 0.3;
    v.rx = (v.rx ?? 0) + pointer.y * 0.15;
  }
  if (demo.twirl) v.spin = ease(demo.twirl) * 2 * PI;
  v.tint = current === 'eclipse' || current === 'skins' ? demo.nd / 12 : 0;
  v.rtx = gfx.rtx ? 1 : 0;
  v.rub = demo.rub;
  v.rub2 = demo.rub2;
  v.torch = torch;
  const visK = clamp01(v.vis ?? 1);
  canvas.style.opacity = visK.toFixed(3);
  stage.setActive(visK > 0.02 && !document.hidden);
  stage.setTarget(v);
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__x5b = { stage, Keys, ScrollTrigger, sts, demo, save, gfx, unlock, findSecret };

window.addEventListener('pointermove', (e) => {
  if (!stage || reducedMode || e.pointerType === 'touch') return;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  stage.setPointer(pointer.x, pointer.y);
}, { passive: true });
window.addEventListener('resize', () => { stage?.resize(); lastY = -1; drawDoor('out'); drawDoor('in'); rtx.last = 0; });

/* ---------- Запуск ---------- */

async function boot() {
  paintAch();
  paintSecrets();
  applyGfx({ from: 'init' });
  setNd(0);
  setSplit(0.5);
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  // журнал загрузки печатается построчно
  const log = $('[data-boot]');
  const lines = log.textContent.split('\n');
  if (!reduceMQ.matches) {
    log.textContent = '';
    lines.forEach((l, i) => setTimeout(() => { log.textContent += (i ? '\n' : '') + l; }, 90 * i));
  }
  await Promise.race([Promise.all([fonts, stage ? stage.ready : null, timeout(700)]), timeout(12000)]);
  stage?.redrawScreen();

  const mm = gsap.matchMedia();
  mm.add({
    isMobile: '(max-width: 760px)', isDesktop: '(min-width: 761px)',
    reduce: '(prefers-reduced-motion: reduce)', motion: '(prefers-reduced-motion: no-preference)',
  }, (ctx) => buildChoreography(ctx.conditions));

  const loader = $('#loader');
  const hideLoader = () => { loader.classList.add('is-done'); loader.setAttribute('aria-hidden', 'true'); };
  setTimeout(hideLoader, reducedMode ? 0 : 300);
  setTimeout(hideLoader, 1600);
  updateScreen(true);
  drawDoor('out');
  drawDoor('in');
  setTimeout(() => { booted = true; }, 1200);

  // первый экран: телефон прилетает издалека и приоткрывается
  if (!reducedMode && stage && window.scrollY < 10) {
    const P = makePoses(window.matchMedia('(max-width: 760px)').matches);
    stage.setTarget(P.far);
    stage.snap();
    const k = { t: 0 };
    let introDone = false;
    const sample = Keys.sample.bind(Keys);
    let intro = null;
    Keys.sample = (yy, r) => {
      if (!introDone && window.scrollY > 40) { introDone = true; intro?.kill(); Keys.sample = sample; }
      if (introDone) return sample(yy, r);
      const pose = {};
      for (const key in P.hero) pose[key] = P.far[key] + (P.hero[key] - P.far[key]) * k.t;
      return pose;
    };
    intro = gsap.to(k, {
      t: 1, duration: 2.2, ease: 'expo.out', delay: 0.5,
      onUpdate: () => { if (window.scrollY > 40) { intro.kill(); introDone = true; Keys.sample = sample; } },
      onComplete: () => { introDone = true; Keys.sample = sample; },
    });
    gsap.from('.b-hero__big', { opacity: 0, scale: 1.15, filter: 'blur(12px)', duration: 1.2, ease: 'expo.out', delay: 0.5 });
    gsap.from('.b-hero > *:not(.b-hero__title)', { opacity: 0, y: 20, duration: 0.8, ease: 'power3.out', stagger: 0.08, delay: 0.9 });
    gsap.from('.b-menu__item', { opacity: 0, x: -20, duration: 0.5, stagger: 0.06, delay: 1.1 });
    gsap.from('.b-hud', { y: 60, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 1.4 });
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
