/* =========================================================================
   Fyr Osmium X0 — «Год спустя». Обычная прокрутка; сцены держит GSAP
   ScrollTrigger, поза часов — ключевые кадры по главам (js/core/keys.js).
   В «Осмии» прокрутка крутит безель на полный оборот и утапливает коронку,
   за часами проступает плотность осмия. «Внутри» разносит часы на восемь
   слоёв. В «GFC 1» безель крутят руками: код — три hex-цифры. В «CamelOS»
   шесть функций рисуются на экране часов, в «Ремешках» — ремешок или браслет.
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage } from '../core/stage.js';
import { createKeys } from '../core/keys.js';
import { createFyrOsmium, HEX } from '../models/fyrosmium.js';
import { $, $$, clamp01, createToast, syncRadio, initRadioGroup } from '../core/ui.js';
import { createSmoothScroll } from '../core/scroll.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
const PI = Math.PI;
const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);
const toast = createToast($('#toast'), gsap);

/* ---------- 3D ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, createFyrOsmium, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[Fyr] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Главы и прогресс ---------- */

const CHAPTERS = ['hero', 'year', 'osmium', 'inside', 'tritium', 'gfc', 'camel', 'bands', 'family', 'specs', 'price'];
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
let current = 'hero';

const progress = $('[data-progress]');
progress.innerHTML = CHAPTERS.map(() => '<li></li>').join('');
const marks = $$('li', progress);

function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  if (id !== current) { current = id; updateScreen(); }
  marks.forEach((m, i) => m.classList.toggle('is-on', CHAPTERS[i] === current));
}

/* ---------- Экран часов ---------- */

let dark = false;
let quiet = 'radar';
let radioOff = false;
const safe = { step: 0, code: [], tries: 3, state: 'input' };   // input · open · wiped
const digitAt = (step) => HEX[((step % 16) + 16) % 16];

let lastScreen = '';
function updateScreen() {
  if (!stage) return;
  let mode = 'face';
  let extra = {};
  if (current === 'osmium') mode = radioOff ? 'radio' : 'face';
  else if (current === 'tritium') mode = dark ? 'off' : 'face';
  else if (current === 'gfc') {
    mode = safe.state === 'open' ? 'open' : safe.state === 'wiped' ? 'wiped' : 'safe';
    extra = { code: [...safe.code], digit: digitAt(safe.step), tries: safe.tries };
  } else if (current === 'camel') mode = quiet;
  const key = mode + JSON.stringify(extra);
  if (key === lastScreen) return;
  lastScreen = key;
  stage.setScreen(mode, extra);
}

/* ---------- Позы ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели, которая ставится в (x, y)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, dist: 3.2, float: 1, vis: 1, crown: 0, spin: 0, explode: 0 };
function makePoses(mobile) {
  const P = {
    hero: { x: 0.42, y: 0.02, rx: 0.32, ry: -0.55, rz: 0.12, dist: 3.1 },
    hidden: { x: 0.42, rx: 0.3, ry: -0.9, dist: 4.4, float: 0, vis: 0 },
    osA: { x: 0.44, rx: 0.12, ry: -1.1, rz: 0.05, dist: 1.9, float: 0.3 },
    osB: { x: 0.48, rx: 0.05, ry: 0.15, dist: 1.8, float: 0.3 },
    osC: { x: 0.48, rx: 0.12, ry: -0.75, dist: 1.6, float: 0.2, fx: 0.012 },
    inA: { x: 0.42, rx: -0.55, ry: 0.35, rz: 0.1, dist: 2.6, float: 0.2 },
    inB: { x: 0.42, rx: -1.05, ry: 0.55, rz: 0.15, dist: 2.7, float: 0.15, explode: 1 },
    inC: { x: 0.42, rx: -1.0, ry: 0.95, rz: 0.15, dist: 2.7, float: 0.15, explode: 1 },
    tritium: { x: -0.58, rx: 0.08, ry: 0.32, dist: 2.1, float: 0.5 },
    gfc: { x: 0.52, rx: 0.02, ry: -0.05, dist: 1.7, float: 0.15 },
    camel: { x: -0.52, rx: 0.1, ry: 0.28, dist: 1.9, float: 0.4 },
    bands: { x: 0.44, rx: -0.2, ry: -0.75, rz: 0.08, dist: 3.5, float: 0.6 },
    specs: { x: 0.46, rx: 0.3, ry: -0.6, rz: 0.1, dist: 3.4 },
  };
  for (const k in P) P[k] = { ...BASE, ...P[k] };
  if (!mobile) return P;
  // телефон: часы в верхней части экрана, текст ниже
  for (const k in P) {
    const p = P[k];
    P[k] = { ...p, x: 0, fx: 0, y: 0.48, dist: p.dist * 1.75 };
  }
  return P;
}

const Keys = createKeys();
const sts = {};
let reducedMode = reduceMQ.matches;
const smooth = createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ });
const ease = (t) => { const c = clamp01(t); return c * c * (3 - 2 * c); };

/* ---------- 2. Осмий: безель по прокрутке, плотность за часами ---------- */

const bezelOut = $('[data-bezel-readout]');
const radioOut = $('[data-radio-readout]');
const giant = $('[data-giant]');
const caseState = { bezel: 0, crown: 0 };
function setOsmium(p) {
  const steps = Math.min(16, Math.floor(ease(p / 0.75) * 16.999));
  const crown = ease((p - 0.8) / 0.15);
  caseState.bezel = steps;
  caseState.crown = crown;
  bezelOut.textContent = digitAt(steps);
  const off = crown > 0.5;
  if (off !== radioOff) {
    radioOff = off;
    radioOut.textContent = off ? 'обесточено' : 'вкл';
    updateScreen();
  }
}
function setGiant(o) { giant.style.setProperty('--o', o.toFixed(3)); }

/* ---------- 3. Внутри: какой слой подписан ---------- */

const layers = $$('[data-layers] li');
function setInside(p) {
  const k = p < 0.22 ? -1 : Math.min(layers.length - 1, Math.floor(((p - 0.22) / 0.62) * layers.length));
  layers.forEach((l, i) => l.classList.toggle('is-on', i === k));
}

/* ---------- 4. Тритий: кривая яркости за двадцать лет ---------- */

const HALF = 12.3;
const bright = (y) => 2 ** (-y / HALF);
const dx = (y) => y * 15, dy = (y) => 20 + (1 - bright(y)) * 80;
$('[data-decay] .os-decay__curve').setAttribute('d', Array.from({ length: 41 }, (_, i) => `${i ? 'L' : 'M'}${dx(i / 2).toFixed(1)} ${dy(i / 2).toFixed(1)}`).join(''));
const decayDot = $('[data-decay] .os-decay__dot');
const decayYear = $('[data-decay-year]');
const decayVal = $('[data-decay-val]');
function setDecay(p) {
  const y = p * 20;
  decayDot.setAttribute('cx', dx(y).toFixed(1));
  decayDot.setAttribute('cy', dy(y).toFixed(1));
  decayDot.style.opacity = String(0.4 + bright(y) * 0.6);
  decayYear.textContent = String(Math.round(y));
  decayVal.textContent = `${Math.round(bright(y) * 100)} %`;
}

/* ---------- Хореография ---------- */

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  Keys.reset();
  const P = makePoses(isMobile);

  for (const id of CHAPTERS) {
    if (id === 'osmium' || id === 'inside') {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sections[id],
          start: 'top top', end: reduce ? 'bottom top' : '+=220%', pin: !reduce, scrub: reduce ? false : true, anticipatePin: 1,
          onUpdate: (st) => (id === 'osmium' ? setOsmium(st.progress) : setInside(st.progress)),
        },
      });
      tl.set({}, {}, 1);
      sts[id] = tl.scrollTrigger;
    } else {
      sts[id] = ScrollTrigger.create({ trigger: sections[id], start: 'top top', end: 'bottom top' });
    }
  }
  if (reduce) { setOsmium(0); setInside(1); }

  const K = (id, f, props) => Keys.add(sts[id], f, props);
  const hold = (id, pose) => { K(id, -0.4, pose); K(id, 0.55, pose); };
  K('hero', -1, P.hero);
  hold('hero', P.hero);
  hold('year', P.hidden);
  K('osmium', -0.15, P.osA);
  K('osmium', 0.0, P.osA);
  K('osmium', 0.45, P.osB);
  K('osmium', 0.8, P.osC);
  K('osmium', 1, P.osC);
  K('inside', -0.3, P.inA);
  K('inside', 0.05, P.inA);
  K('inside', 0.3, P.inB);
  K('inside', 0.85, P.inC);
  K('inside', 1, { ...P.inC, explode: 0 });
  hold('tritium', P.tritium);
  hold('gfc', P.gfc);
  hold('camel', P.camel);
  hold('bands', P.bands);
  hold('family', P.hidden);
  hold('specs', P.specs);
  K('price', -0.2, P.hidden);
  K('price', 1, P.hidden);

  // Плотность осмия проступает, пока безель крутится
  if (reduce) setGiant(0);
  else {
    ScrollTrigger.create({
      trigger: sections.osmium, start: 'top 60%', end: () => `+=${sts.osmium.end - sts.osmium.start + window.innerHeight * 0.9}`,
      onUpdate: (st) => setGiant(Math.min(ease(st.progress / 0.18), 1 - ease((st.progress - 0.82) / 0.18))),
      onLeave: () => setGiant(0), onLeaveBack: () => setGiant(0),
    });
  }
  // Тритий: точка катится по кривой
  if (reduce) setDecay(1);
  else ScrollTrigger.create({ trigger: $('[data-decay]'), start: 'top 85%', end: 'bottom 35%', scrub: true, onUpdate: (st) => setDecay(st.progress) });
  // Линия времени дорисовывается слева направо
  const time = $('[data-time]');
  if (reduce) time.style.setProperty('--line', '1');
  else gsap.fromTo(time, { '--line': 0 }, { '--line': 1, ease: 'none', scrollTrigger: { trigger: time, start: 'top 80%', end: 'bottom 50%', scrub: true } });
  // Появление текста глав — короткий сдвиг
  if (!reduce) {
    $$('.fy__text > *, .os-time__item, .os-family, .os-family__list li').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
    });
  }

  ScrollTrigger.refresh();
  return () => Keys.reset();
}
ScrollTrigger.addEventListener('refresh', () => { Keys.compile(window.innerHeight); detectChapter(); });

/* ---------- 0. Печать сигнала ---------- */

const typeEl = $('[data-type]');
const typeText = typeEl.textContent;
function typeIn() {
  if (reducedMode) return;
  typeEl.textContent = '';
  let i = 0;
  const step = () => {
    typeEl.textContent = typeText.slice(0, ++i);
    if (i < typeText.length) setTimeout(step, 28 + Math.random() * 40);
  };
  step();
}

/* ---------- Цены в hex: касание открывает десятичную ---------- */

$$('.fy-hex').forEach((b) => {
  const hex = b.textContent.trim();
  b.setAttribute('aria-label', `${hex} — это ${b.dataset.hex}`);
  const tip = document.createElement('span');
  tip.className = 'fy-hex__tip';
  tip.setAttribute('aria-hidden', 'true');
  tip.innerHTML = '<span class="fy-hex__tip-head"></span><span class="fy-hex__tip-val"></span><span class="fy-hex__tip-note">base 16 → base 10</span>';
  tip.children[0].textContent = `${hex.split(' ')[0]} → DEC`;
  tip.children[1].textContent = b.dataset.hex;
  b.append(tip);
  b.addEventListener('click', () => {
    const open = !b.classList.contains('is-open');
    $$('.fy-hex').forEach((o) => o.classList.remove('is-open'));
    b.classList.toggle('is-open', open);
  });
});
$('[data-calm]').addEventListener('click', () => toast('Мы тоже не торопились: от часов до телефона прошёл год.'));
$$('.fy-hero__buy a[href="#price"]').forEach((a) => a.addEventListener('click', () => setTimeout(() => toast('Не торопитесь. Сначала посмотрите на часы.'), 300)));

/* ---------- 4. Темно ---------- */

const darkGrp = $('[data-dark]');
initRadioGroup(darkGrp, (v) => {
  dark = v === 'dark';
  syncRadio(darkGrp, v);
  root.classList.toggle('is-dark', dark);
  updateScreen();
});

/* ---------- 5. GFC 1: расшифровка и «Сейф» ---------- */

const redact = $('[data-redact]');
redact.addEventListener('click', () => {
  const open = redact.classList.toggle('is-open');
  redact.setAttribute('aria-label', open ? 'Go F*** Citadel' : 'Показать расшифровку');
});

const CODE = '146';
const dial = $('[data-dial]');
const digitsG = $('[data-dial-digits]');
const digitOut = $('[data-dial-digit]');
const status = $('[data-safe-status]');
const NS = 'http://www.w3.org/2000/svg';
const labels = HEX.split('').map((ch, i) => {
  const a = (i / 16) * PI * 2;
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', (Math.sin(a) * 44).toFixed(2));
  t.setAttribute('y', (-Math.cos(a) * 44).toFixed(2));
  t.textContent = ch;
  digitsG.append(t);
  return t;
});
function renderDial() {
  digitsG.style.transform = `rotate(${-safe.step * 22.5}deg)`;
  const d = digitAt(safe.step);
  labels.forEach((t, i) => t.classList.toggle('is-top', HEX[i] === d));
  digitOut.textContent = d;
  dial.setAttribute('aria-valuenow', String(HEX.indexOf(d)));
  dial.setAttribute('aria-valuetext', d);
  updateScreen();
}
function setStatus(text, ok = false) {
  status.textContent = text;
  status.classList.toggle('is-ok', ok);
}
function turn(by) {
  if (safe.state !== 'input') return;
  safe.step += by;
  renderDial();
}
function enter() {
  if (safe.state === 'open') return;
  if (safe.state === 'wiped') return;
  safe.code.push(digitAt(safe.step));
  if (safe.code.length < 3) {
    setStatus(`Введено: ${safe.code.join(' ')} · ещё ${3 - safe.code.length}`);
    renderDial();
    return;
  }
  if (safe.code.join('') === CODE) {
    safe.state = 'open';
    setStatus('Открыто. Нас 146 — это и есть код.', true);
    renderDial();
    return;
  }
  safe.tries -= 1;
  safe.code = [];
  if (safe.tries > 0) {
    setStatus(`Неверно. Попыток: ${safe.tries}`);
    renderDial();
    return;
  }
  safe.state = 'wiped';
  setStatus('Мёртвая рука: ключи стёрты. Сброс через 2 секунды.');
  renderDial();
  setTimeout(() => { reset(); setStatus('Ключи на месте. Это была демонстрация.'); }, 2000);
}
function reset() {
  Object.assign(safe, { code: [], tries: 3, state: 'input' });
  renderDial();
}
$('[data-safe-enter]').addEventListener('click', enter);
$('[data-safe-reset]').addEventListener('click', () => { reset(); setStatus('Поверните безель и введите три цифры.'); });
dial.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); turn(1); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); turn(-1); }
  else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); }
});
// Перетаскивание по окружности: шаг 22,5°
let drag = null;
const angleOf = (e) => {
  const r = dial.getBoundingClientRect();
  return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2)));
};
dial.addEventListener('pointerdown', (e) => {
  dial.setPointerCapture(e.pointerId);
  drag = { a: angleOf(e), step: safe.step };
});
dial.addEventListener('pointermove', (e) => {
  if (!drag) return;
  let da = angleOf(e) - drag.a;
  while (da > PI) da -= 2 * PI;
  while (da < -PI) da += 2 * PI;
  // безель крутится против часовой: цифры едут влево, под меткой — следующая
  const next = drag.step + Math.round((-da / (2 * PI)) * 16);
  if (next !== safe.step) {
    turn(next - safe.step);
    drag.a = angleOf(e);
    drag.step = safe.step;
  }
});
const endDrag = () => { drag = null; };
dial.addEventListener('pointerup', endDrag);
dial.addEventListener('pointercancel', endDrag);
renderDial();

/* ---------- 6. CamelOS: шесть функций ---------- */

const quietTabs = $$('[data-quiet] [role="tab"]');
function setQuiet(v) {
  quiet = v;
  quietTabs.forEach((t) => {
    const on = t.dataset.value === v;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
  });
  updateScreen();
}
quietTabs.forEach((t, i) => {
  t.addEventListener('click', () => setQuiet(t.dataset.value));
  t.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const n = quietTabs[(i + d + quietTabs.length) % quietTabs.length];
    n.focus();
    setQuiet(n.dataset.value);
  });
});

/* ---------- 7. Ремешок или браслет, цвет ---------- */

const BANDS = {
  strap: 'Фторэластомер с&nbsp;синей строчкой и&nbsp;пряжка из&nbsp;титана DLC. Не&nbsp;впитывает воду и&nbsp;пот.',
  bracelet: 'Титан Grade&nbsp;5, как корпус: крайние звенья матовые, средние полированные и&nbsp;сдвинуты на&nbsp;полшага. Гнётся, как ткань.',
};
const bandGrp = $('[data-band-switch]');
initRadioGroup(bandGrp, (v) => {
  syncRadio(bandGrp, v);
  $('[data-band-note]').innerHTML = BANDS[v];
  stage?.setBand(v);
});
const NOTES = {
  polarnatt: 'Чёрный титан DLC, тёмный осмиридий, синий тритий.',
  stral: 'Светлый шлифованный титан, светлый осмиридий, белый тритий.',
};
const colorGrp = $('[data-color-switch]');
initRadioGroup(colorGrp, (v) => {
  syncRadio(colorGrp, v);
  root.dataset.color = v;
  $('[data-color-note]').textContent = NOTES[v];
  stage?.setBodyColor(v);
});

/* ---------- Каждый тик: прокрутка → модель ---------- */

let lastY = -1;
function tick() {
  const y = window.scrollY;
  if (y !== lastY) { lastY = y; detectChapter(); }
  if (Keys.empty || !stage) return;
  const v = Keys.sample(y, reducedMode);
  v.bezel = current === 'gfc' ? safe.step : current === 'osmium' ? caseState.bezel : 0;
  v.crown = current === 'osmium' ? caseState.crown : 0;
  v.dark = current === 'tritium' && dark ? 1 : 0;
  v.screen = current === 'tritium' && dark ? 0 : 1;
  const vis = clamp01(v.vis ?? 1);
  canvas.style.opacity = vis.toFixed(3);
  stage.setActive(vis > 0.02 && !document.hidden);
  stage.setTarget(v);
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__fyr = { stage, Keys, ScrollTrigger, sts, safe };

window.addEventListener('pointermove', (e) => {
  if (!stage || reducedMode || e.pointerType === 'touch') return;
  stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
}, { passive: true });
window.addEventListener('resize', () => stage?.resize());

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
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');
  updateScreen();
  typeIn();
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
