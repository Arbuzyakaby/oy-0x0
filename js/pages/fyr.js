/* =========================================================================
   Fyr Osmium X0 — «Перехват». Скрытая страница бывших инженеров OY.
   Обычная прокрутка; сцены держит GSAP ScrollTrigger, поза часов —
   ключевые кадры по главам (js/core/keys.js). В «Корпусе» прокрутка крутит
   безель на полный оборот и утапливает коронку-рубильник, в «GFC 1» безель
   крутят руками: код — три hex-цифры.
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

/* ---------- Главы ---------- */

const CHAPTERS = ['intercept', 'eight', 'choice', 'case', 'tritium', 'gfc', 'quiet', 'missing', 'specs', 'price'];
const sections = Object.fromEntries(CHAPTERS.map((id) => [id, document.getElementById(id)]));
let current = 'intercept';

function detectChapter() {
  const line = window.innerHeight * 0.5;
  let id = CHAPTERS[0];
  for (const c of CHAPTERS) if (sections[c].getBoundingClientRect().top <= line) id = c;
  if (id !== current) { current = id; updateScreen(); }
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
  if (current === 'intercept') mode = 'intercept';
  else if (current === 'case') mode = radioOff ? 'radio' : 'face';
  else if (current === 'tritium') mode = dark ? 'off' : 'face';
  else if (current === 'gfc') {
    mode = safe.state === 'open' ? 'open' : safe.state === 'wiped' ? 'wiped' : 'safe';
    extra = { code: [...safe.code], digit: digitAt(safe.step), tries: safe.tries };
  } else if (current === 'quiet') mode = quiet;
  const key = mode + JSON.stringify(extra);
  if (key === lastScreen) return;
  lastScreen = key;
  stage.setScreen(mode, extra);
}

/* ---------- Позы ---------- */

// x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели, которая ставится в (x, y)
const BASE = { x: 0, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: 0, rz: 0, dist: 3.2, float: 1, vis: 1, crown: 0, spin: 0 };
function makePoses(mobile) {
  const P = {
    hero: { x: 0.42, y: 0.02, rx: 0.32, ry: -0.55, rz: 0.12, dist: 3.1 },
    hidden: { x: 0.42, rx: 0.3, ry: -0.9, dist: 4.4, float: 0, vis: 0 },
    caseA: { x: 0.44, rx: 0.12, ry: -1.1, rz: 0.05, dist: 1.9, float: 0.3 },
    caseB: { x: 0.48, rx: 0.05, ry: 0.15, dist: 1.8, float: 0.3 },
    caseC: { x: 0.48, rx: 0.12, ry: -0.75, dist: 1.6, float: 0.2, fx: 0.012 },
    tritium: { x: -0.58, rx: 0.08, ry: 0.32, dist: 2.1, float: 0.5 },
    gfc: { x: 0.52, rx: 0.02, ry: -0.05, dist: 1.7, float: 0.15 },
    quiet: { x: -0.5, rx: 0.1, ry: 0.28, dist: 1.9, float: 0.4 },
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

/* ---------- 1. «Нас было восемь» ---------- */

const dotsBox = $('[data-eight-dots]');
const dots = Array.from({ length: 8 }, (_, i) => {
  const d = document.createElement('span');
  d.className = 'eight__dot';
  d.dataset.i = String(i);
  dotsBox.append(d);
  return d;
});
const num = $('[data-eight-num]');
const count = $('.eight__count');
// домики: OY 0–30 %, ABC 35–65 %, Стокгольм 70–100 % ширины
const home = (place, i, n) => {
  const cx = place === 0 ? 15 : place === 1 ? 50 : 85;
  const col = i % 2, row = Math.floor(i / 2);
  const rows = Math.ceil(n / 2);
  return [cx + (col - 0.5) * 9, 50 + (row - (rows - 1) / 2) * 17];
};
const FYR = [0, 2, 3, 5, 7];   // пятеро, что ушли первыми
const REST = [1, 4, 6];        // трое, что дождались нового CEO OY
const ease = (t) => { const c = clamp01(t); return c * c * (3 - 2 * c); };
function setEight(p) {
  // 0–0.3: все в OY · 0.3–0.55: пятеро → ABC · 0.55–0.8: → Стокгольм,
  // следом трое прямо из OY · дальше — 146
  const t1 = ease((p - 0.18) / 0.27), t2 = ease((p - 0.55) / 0.22), t3 = ease((p - 0.6) / 0.18);
  dots.forEach((d, i) => {
    const k = FYR.indexOf(i);
    const a = home(0, i, 8);
    let [x, y] = a;
    if (k >= 0) {
      const b = home(1, k, 5), c = home(2, k, 8);
      x = a[0] + (b[0] - a[0]) * t1 + (c[0] - b[0]) * t2;
      y = a[1] + (b[1] - a[1]) * t1 + (c[1] - b[1]) * t2;
      d.classList.toggle('is-fyr', t2 > 0.5);
      d.style.opacity = String(1 - ease((p - 0.74) / 0.1));
    } else {
      const j = REST.indexOf(i);
      const b = home(0, j, 3), c = home(2, 5 + j, 8);
      x = a[0] + (b[0] - a[0]) * t1 + (c[0] - b[0]) * t3;
      y = a[1] + (b[1] - a[1]) * t1 + (c[1] - b[1]) * t3;
      d.classList.toggle('is-fyr', t3 > 0.5);
      d.style.opacity = String((1 - t1 * 0.55 + t3 * 0.55) * (1 - ease((p - 0.76) / 0.1)));
    }
    d.style.left = `${x}%`;
    d.style.top = `${y}%`;
  });
  const g = ease((p - 0.76) / 0.16);
  count.style.setProperty('--o', g.toFixed(3));
  num.textContent = String(Math.round(8 + g * 138));
}

/* ---------- 3. Корпус: безель по прокрутке ---------- */

const bezelOut = $('[data-bezel-readout]');
const radioOut = $('[data-radio-readout]');
function setCase(p) {
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
const caseState = { bezel: 0, crown: 0 };

/* ---------- Хореография ---------- */

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) smooth.disable(); else smooth.enable();
  Keys.reset();
  const P = makePoses(isMobile);

  for (const id of CHAPTERS) {
    if (id === 'eight' || id === 'case') {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: id === 'eight' ? sections.eight : sections.case,
          start: 'top top', end: reduce ? 'bottom top' : '+=220%', pin: !reduce, scrub: reduce ? false : true, anticipatePin: 1,
          onUpdate: (st) => (id === 'eight' ? setEight(st.progress) : setCase(st.progress)),
        },
      });
      tl.set({}, {}, 1);
      sts[id] = tl.scrollTrigger;
    } else {
      sts[id] = ScrollTrigger.create({ trigger: sections[id], start: 'top top', end: 'bottom top' });
    }
  }
  if (reduce) { setEight(1); setCase(0); }

  const K = (id, f, props) => Keys.add(sts[id], f, props);
  const hold = (id, pose) => { K(id, -0.4, pose); K(id, 0.55, pose); };
  K('intercept', -1, P.hero);
  hold('intercept', P.hero);
  hold('eight', P.hidden);
  hold('choice', P.hidden);
  K('case', -0.15, P.caseA);
  K('case', 0.0, P.caseA);
  K('case', 0.45, P.caseB);
  K('case', 0.8, P.caseC);
  K('case', 1, P.caseC);
  hold('tritium', P.tritium);
  hold('gfc', P.gfc);
  hold('quiet', P.quiet);
  hold('missing', P.hidden);
  hold('specs', P.specs);
  K('price', -0.2, P.hidden);
  K('price', 1, P.hidden);

  // Ноутбук и планшет зачёркиваются
  $$('.choice__item.is-out').forEach((el, i) => {
    if (reduce) { el.style.setProperty('--cross', '1'); return; }
    gsap.fromTo(el, { '--cross': 0 }, { '--cross': 1, duration: 0.6, delay: i * 0.25, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 72%', toggleActions: 'play none none reverse' } });
  });
  // Лог печатается строка за строкой
  const lines = $$('[data-log] span');
  if (reduce) lines.forEach((l) => l.style.setProperty('--o', '1'));
  else {
    ScrollTrigger.create({
      trigger: $('[data-log]'), start: 'top 85%', end: 'bottom 55%', scrub: true,
      onUpdate: (st) => lines.forEach((l, i) => l.style.setProperty('--o', String(clamp01(st.progress * (lines.length + 2) - i)))),
    });
  }

  // Появление текста глав — короткий сдвиг
  if (!reduce) {
    $$('.fy__text > *').forEach((el) => {
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
$('[data-calm]').addEventListener('click', () => toast('Мы тоже не торопились. Часы вышли в один день с 0X Nova — осенью 2030.'));
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

/* ---------- 6. Тихие функции ---------- */

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

/* ---------- 8. Цвет ---------- */

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
  v.bezel = current === 'gfc' ? safe.step : current === 'case' ? caseState.bezel : 0;
  v.crown = current === 'case' ? caseState.crown : 0;
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
