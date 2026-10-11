/* =========================================================================
   OY 0X0 — сюжет прокрутки
   GSAP + ScrollTrigger: закрепление секций, scrub, появления.
   Lenis: плавная прокрутка.
   Позы 3D-модели заданы ключевыми кадрами, привязанными к ScrollTrigger
   секций; на каждом тике позиция прокрутки превращается в целевое
   состояние модели (детерминированно при любом прыжке скролла).
   ========================================================================= */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createStage, BODY_COLORS } from './scene.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
root.classList.add('anim');

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const PI = Math.PI;

const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const params = new URLSearchParams(location.search);

/* ---------- Хранилище (может быть недоступно) ---------- */

const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* приватный режим */ } },
};

/* ---------- Toast ---------- */

const toastEl = $('#toast');
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  gsap.fromTo(toastEl, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    gsap.to(toastEl, { autoAlpha: 0, y: 16, duration: 0.3, onComplete: () => { toastEl.hidden = true; } });
  }, 3600);
}

/* ---------- 3D-сцена ---------- */

const canvas = $('#stage');
let stage = null;
try {
  stage = createStage(canvas, { forceFallback: params.has('fallback') });
} catch (err) {
  console.warn('[OY 0X0] WebGL недоступен, 3D отключено.', err);
  canvas.style.display = 'none';
}

/* ---------- Радиогруппы (цвет, память, фонарь) ---------- */

function syncRadio(group, value) {
  $$('[role="radio"]', group).forEach((b) => {
    const on = b.dataset.value === value;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}

function initRadioGroup(group, onChange) {
  const radios = () => $$('[role="radio"]', group);
  group.addEventListener('click', (e) => {
    const b = e.target.closest('[role="radio"]');
    if (b && group.contains(b)) onChange(b.dataset.value);
  });
  group.addEventListener('keydown', (e) => {
    const list = radios();
    const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    let n = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % list.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + list.length) % list.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = list.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onChange(list[n].dataset.value);
    list[n].focus();
  });
}

// Цвет корпуса
const COLOR_NAMES = { red: 'Сигнальный Красный', ice: 'Арктический ледник' };
const colorGroups = $$('[data-color-switch]');
function setColor(name, { save = true, instant = false } = {}) {
  if (!COLOR_NAMES[name]) name = 'red';
  root.dataset.color = name;
  colorGroups.forEach((g) => syncRadio(g, name));
  $$('[data-cfg-color]').forEach((el) => { el.textContent = COLOR_NAMES[name]; });
  stage?.setBodyColor(name, instant);
  if (save) store.set('oy-color', name);
}
colorGroups.forEach((g) => initRadioGroup(g, (v) => setColor(v)));
setColor(store.get('oy-color') || root.dataset.color || 'red', { save: false, instant: true });

// Память и цена
const PRICES = {
  '8/128': { usd: 449, eur: 539 },
  '12/128': { usd: 489, eur: 579 },
  '12/256': { usd: 519, eur: 609 },
  '14/512': { usd: 639, eur: 729 },
};
const memGroup = $('[data-mem-switch]');
const usdEl = $('[data-price-usd]');
const eurEl = $('[data-price-eur]');
const cfgNameEl = $('[data-cfg-name]');
let currentMem = '8/128';
function setMemory(v, animate = true) {
  if (!PRICES[v]) return;
  const prev = PRICES[currentMem].usd;
  currentMem = v;
  syncRadio(memGroup, v);
  const { usd, eur } = PRICES[v];
  cfgNameEl.textContent = `${v} ГБ`;
  eurEl.textContent = `€${eur}`;
  if (!animate || reduceMQ.matches) { usdEl.textContent = `$${usd}`; return; }
  const o = { n: prev };
  gsap.to(o, {
    n: usd, duration: 0.6, ease: 'power3.out',
    onUpdate: () => { usdEl.textContent = `$${Math.round(o.n)}`; },
  });
  gsap.fromTo(usdEl, { y: 8, opacity: 0.6 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
}
initRadioGroup(memGroup, (v) => setMemory(v));
setMemory('8/128', false);

// Сигнальный фонарь
const signalGroup = $('[data-signal-switch]');
const signalSection = $('#signal');
function setSignal(v) {
  syncRadio(signalGroup, v);
  signalSection.dataset.signal = v;
  stage?.setSignalColor(v);
}
initRadioGroup(signalGroup, setSignal);
setSignal('white');

// Тумблеры (Tor, разрешения)
$$('[data-toggle]').forEach((t) => t.addEventListener('click', () => {
  t.setAttribute('aria-checked', String(t.getAttribute('aria-checked') !== 'true'));
}));

// Разрешения на время (демо)
const PERM_TEXT = {
  once: 'Доступ — до закрытия приложения',
  15: 'Доступ закроется в 14:17',
  no: 'Отклонено. Запись — в журнале доступа',
};
const permRes = $('.perm-prompt__res');
$$('.perm-btn').forEach((b) => b.addEventListener('click', () => {
  $$('.perm-btn').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  permRes.textContent = PERM_TEXT[b.dataset.perm];
}));

// Точность геолокации (демо)
const geoGroup = $('[data-geo-switch]');
if (geoGroup) {
  const setGeo = (v) => { syncRadio(geoGroup, v); geoGroup.closest('.geo-vis').dataset.geo = v; };
  initRadioGroup(geoGroup, setGeo);
  setGeo('exact');
}

// Заглушки
$$('[data-stub]').forEach((el) => el.addEventListener('click', (e) => {
  e.preventDefault();
  toast(el.dataset.stub);
}));

/* ---------- Плавная прокрутка ---------- */

let lenis = null;
function enableLenis() {
  if (lenis) return;
  lenis = new Lenis({ autoRaf: false, lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
}
function disableLenis() {
  if (!lenis) return;
  lenis.destroy();
  lenis = null;
}
gsap.ticker.add((time) => { lenis?.raf(time * 1000); });
gsap.ticker.lagSmoothing(0);

// Якоря
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.hasAttribute('data-stub')) return;
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  const target = document.querySelector(id);
  if (!target) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(target, { duration: 1.4 });
  else target.scrollIntoView({ behavior: reduceMQ.matches ? 'auto' : 'smooth' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  history.replaceState(null, '', id);
});

/* ---------- Ключевые кадры модели ---------- */

const Keys = (() => {
  let defs = [];
  let tracks = {};
  const smooth = (t) => t * t * (3 - 2 * t);
  return {
    reset() { defs = []; tracks = {}; },
    add(st, f, props, linear = false) { defs.push({ st, f, props, linear }); },
    compile() {
      tracks = {};
      const vh = window.innerHeight;
      for (const d of defs) {
        const s = d.st;
        if (!s) continue;
        const pos = d.f >= 0 ? s.start + d.f * (s.end - s.start) : s.start + d.f * vh;
        for (const k in d.props) (tracks[k] ||= []).push({ pos, v: d.props[k], linear: d.linear });
      }
      for (const k in tracks) tracks[k].sort((a, b) => a.pos - b.pos);
    },
    sample(y, step = false) {
      const out = {};
      for (const k in tracks) {
        const arr = tracks[k];
        const first = arr[0], lastK = arr[arr.length - 1];
        if (y <= first.pos) { out[k] = first.v; continue; }
        if (y >= lastK.pos) { out[k] = lastK.v; continue; }
        let i = 0;
        while (i < arr.length - 2 && arr[i + 1].pos <= y) i++;
        const a = arr[i], b = arr[i + 1];
        const span = b.pos - a.pos;
        const t = span > 0 ? (y - a.pos) / span : 1;
        out[k] = step ? (t < 0.5 ? a.v : b.v) : a.v + (b.v - a.v) * (b.linear ? t : smooth(t));
      }
      return out;
    },
    get empty() { return Object.keys(tracks).length === 0; },
  };
})();

// Позы. x/y — доля половины видимой ширины/высоты; fx/fy/fz — точка модели,
// которая ставится в (x, y); dist — расстояние камеры.
function makePoses(mobile) {
  const D = {
    hero: { x: 0.42, y: -0.02, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -0.5, rz: 0.06, s: 1, dist: 5.4, float: 1, screen: 1, shutter: 0, sw1: 1, sw2: 1, sw3: 1, signal: 0 },
    zeroA: { x: 0.38, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.06, ry: -0.35, rz: 0, dist: 5, float: 0 },
    zeroBack: { x: 0.34, y: 0, fx: 0, fy: 0.12, fz: 0, rx: 0.1, ry: -PI, rz: 0, dist: 4.4 },
    // Камерный остров: вертикальная пара, центр (0.205, 0.45) в координатах модели
    zeroClose: { x: 0.4, y: 0, fx: 0.205, fy: 0.45, fz: -0.055, rx: 0.14, ry: -PI + 0.22, rz: 0, dist: 1.4 },
    shutter: { x: 0.32, y: 0, fx: 0.09, fy: 0.45, fz: -0.06, rx: 0.22, ry: -PI + 0.38, rz: 0, dist: 2.1 },
    shutterEnd: { x: 0.32, y: 0, fx: 0.11, fy: 0.45, fz: -0.06, rx: 0.18, ry: -PI + 0.26, rz: 0, dist: 2.0 },
    switches: { x: 0.28, y: 0, fx: -0.36, fy: 0.26, fz: 0, rx: 0.1, ry: -1.5 * PI + 0.36, rz: 0, dist: 1.85 },
    switchesEnd: { x: 0.28, y: 0, fx: -0.36, fy: 0.26, fz: 0, rx: 0.06, ry: -1.5 * PI + 0.26, rz: 0, dist: 1.7 },
    signal: { x: -0.45, y: -0.06, fx: 0, fy: 0.73, fz: 0, rx: 0.36, ry: -0.5, rz: -PI / 2, dist: 2.7, float: 0, shutter: 0, sw1: 1, sw2: 1, sw3: 1 },
    signalEnd: { x: -0.42, y: -0.04, fx: 0, fy: 0.73, fz: 0, rx: 0.3, ry: -0.4, rz: -PI / 2, dist: 2.5 },
    display: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.02, ry: -0.3, rz: 0, dist: 4.9 },
    displayEnd: { x: 0.34, y: 0, fx: 0, fy: 0, fz: 0, rx: 0, ry: -0.16, rz: 0, dist: 4.7 },
    // Разлёт: спереди в три четверти, к концу — разворот к спинке
    insideA: { x: 0.3, y: 0, fx: 0, fy: 0, fz: 0, rx: 0.32, ry: -0.62, rz: 0.1, dist: 7.2, float: 0, screen: 1, signal: 0, shutter: 0, sw1: 1, sw2: 1, sw3: 1 },
    insideMid: { x: 0.3, y: 0, rx: 0.3, ry: -1.22, rz: 0.08, dist: 6.6 },
    insideB: { x: 0.3, y: 0, rx: 0.22, ry: -PI + 0.85, rz: -0.06, dist: 6.8 },
    colorsA: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.14, ry: -1.0, rz: 0.04, dist: 4.5, float: 0, screen: 1, signal: 0 },
    colorsB: { x: 0.26, y: 0.06, fx: 0, fy: 0, fz: 0, rx: 0.1, ry: -1.0 + PI * 1.35, rz: -0.04, dist: 4.3 },
    finalA: { x: 0, y: -0.75, fx: 0, fy: 0, fz: 0, rx: 0.08, ry: -0.7, rz: 0.04, dist: 8, float: 1, screen: 1, shutter: 0, signal: 0 },
    finalB: { x: 0, y: -0.5, fx: 0, fy: 0, fz: 0, rx: 0.06, ry: -0.3, rz: 0.03, dist: 8, float: 1 },
  };
  if (!mobile) return D;
  // Мобильные: модель сверху, текст снизу, облёты проще
  const M = {
    hero: { x: 0, y: 0.36, ry: -0.4, rx: 0.08, dist: 7.6 },
    zeroA: { x: 0, y: 0.4, ry: -0.3, dist: 7.2 },
    zeroBack: { x: 0, y: 0.42, fy: 0.1, ry: -PI, dist: 6.6 },
    zeroClose: { x: 0, y: 0.45, ry: -PI + 0.15, rx: 0.12, dist: 2.5 },
    shutter: { x: 0, y: 0.46, ry: -PI + 0.3, rx: 0.2, dist: 3.1 },
    shutterEnd: { x: 0, y: 0.46, ry: -PI + 0.22, dist: 3.0 },
    switches: { x: 0, y: 0.45, dist: 3.1, ry: -1.5 * PI + 0.5 },
    switchesEnd: { x: 0, y: 0.45, dist: 3.0, ry: -1.5 * PI + 0.4 },
    signal: { x: -0.3, y: 0.5, dist: 4.2 },
    signalEnd: { x: -0.28, y: 0.5, dist: 4.0 },
    display: { x: 0, y: 0.4, ry: -0.25, dist: 8.2 },
    displayEnd: { x: 0, y: 0.4, ry: -0.14, dist: 8 },
    insideA: { x: 0, y: 0.4, dist: 10.5 },
    insideMid: { x: 0, y: 0.4, dist: 9.8 },
    insideB: { x: 0, y: 0.4, dist: 10 },
    colorsA: { x: 0, y: 0.34, dist: 7.6 },
    colorsB: { x: 0, y: 0.34, dist: 7.3 },
    finalA: { x: 0, y: -0.7, dist: 9.4 },
    finalB: { x: 0, y: -0.45, dist: 9.4 },
  };
  for (const k in M) D[k] = { ...D[k], ...M[k] };
  return D;
}

/* ---------- Синхронизация HTML с состоянием сцены ---------- */

const ksItems = [1, 2, 3].map((n) => $(`.ks-item[data-ks="${n}"]`));
const ksIcons = [1, 2, 3].map((n) => $$(`[data-ks-icon="${n}"]`));
const statusPill = $('.shutter .status-pill');
const shade = $('#bgfx-shade');
const displaySec = $('#display');
const nitsDay = $('.nits__state--day');
const nitsNight = $('.nits__state--night');
const signalNum = $('.signal-num');
const lastHtml = {};

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function syncHtml(v) {
  const changed = (k, val) => {
    const r = Math.round(val * 1000) / 1000;
    if (lastHtml[k] === r) return false;
    lastHtml[k] = r;
    return true;
  };
  for (let i = 0; i < 3; i++) {
    const val = v[`sw${i + 1}`];
    if (val !== undefined && changed(`sw${i}`, val)) {
      const off = String(1 - clamp01(val));
      ksItems[i]?.style.setProperty('--off', off);
      ksIcons[i].forEach((el) => el.style.setProperty('--off', off));
    }
  }
  if (v.shutter !== undefined && changed('shutter', v.shutter > 0.55 ? 1 : 0)) {
    statusPill?.classList.toggle('is-closed', v.shutter > 0.55);
  }
  if (v.light !== undefined && changed('light', v.light)) {
    const l = clamp01(v.light);
    shade.style.opacity = String(l);
    displaySec.style.setProperty('--disp-ink', mixHex('#F2F2F0', '#0B0B0C', l));
    displaySec.style.setProperty('--disp-muted', mixHex('#A3A3A8', '#4A4A50', l));
  }
  if (v.nits !== undefined && changed('nits', v.nits)) {
    const n = clamp01(v.nits);
    nitsDay.style.opacity = String(clamp01(1 - n * 2));
    nitsNight.style.opacity = String(clamp01(n * 2 - 1));
    nitsDay.style.visibility = n > 0.5 ? 'hidden' : 'visible';
    nitsNight.style.visibility = n < 0.5 ? 'hidden' : 'visible';
  }
  if (v.signal !== undefined && changed('signalText', v.signal)) {
    signalNum.style.opacity = String(0.25 + clamp01(v.signal) * 0.75);
  }
}

/* ---------- Разбиение текста на строки ---------- */

function splitLines(el) {
  const text = el.dataset.splitText ?? (el.dataset.splitText = el.textContent.replace(/[ \t\r\n]+/g, ' ').trim());
  el.textContent = '';
  const words = text.split(' ');
  const spans = words.map((w, i) => {
    const s = document.createElement('span');
    s.textContent = w;
    el.append(s);
    if (i < words.length - 1) el.append(' ');
    return s;
  });
  const lines = [];
  let top = null;
  for (const s of spans) {
    const t = s.offsetTop;
    if (top === null || Math.abs(t - top) > 3) { lines.push([]); top = t; }
    lines[lines.length - 1].push(s.textContent);
  }
  el.textContent = '';
  return lines.map((ws) => {
    const line = document.createElement('span');
    line.className = 'line';
    const inner = document.createElement('span');
    inner.className = 'line__inner';
    inner.textContent = ws.join(' ');
    line.append(inner);
    el.append(line);
    return inner;
  });
}
function unsplit(el) {
  if (el.dataset.splitText !== undefined) el.textContent = el.dataset.splitText;
}

const splitEls = $$('[data-split]');
const splitState = new Map();

function buildSplitReveal(el, reduce) {
  const st = splitState.get(el) || {};
  st.tween?.scrollTrigger?.kill();
  st.tween?.kill();
  if (st.done) { unsplit(el); return; }
  if (reduce) {
    unsplit(el);
    st.tween = gsap.fromTo(el, { opacity: 0 }, {
      opacity: 1, duration: 0.6, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      onComplete: () => { st.done = true; },
    });
  } else {
    const lines = splitLines(el);
    st.tween = gsap.fromTo(lines,
      { yPercent: 110, opacity: 0, filter: 'blur(8px)' },
      {
        yPercent: 0, opacity: 1, filter: 'blur(0px)',
        duration: 1.15, ease: 'expo.out', stagger: 0.09,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onComplete: () => { st.done = true; unsplit(el); },
      });
  }
  splitState.set(el, st);
}

/* ---------- Абзац, который «загорается» по словам ---------- */

const scrubWords = $$('[data-scrub-words]').map((el) => {
  const words = el.textContent.replace(/[ \t\r\n]+/g, ' ').trim().split(' ');
  el.textContent = '';
  const spans = words.map((w, i) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.textContent = w;
    el.append(s);
    if (i < words.length - 1) el.append(' ');
    return s;
  });
  return { el, spans };
});

/* ---------- Карусель «Коротко о главном» ---------- */

const hl = (() => {
  const sec = $('#highlights');
  if (!sec) return null;
  const track = $('.hl__track', sec);
  const slides = $$('.hl__slide', sec);
  const dots = $$('.hl__dot', sec);
  const playBtn = $('.hl__play', sec);
  const DUR = 5;
  let idx = 0, p = 0, playing = true, inView = false, programmatic = 0;

  const offset = (i) => slides[i].offsetLeft - slides[0].offsetLeft;
  function setActive(i) {
    idx = i;
    slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
    dots.forEach((d, k) => {
      if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      d.style.setProperty('--p', '0');
    });
  }
  function go(i) {
    setActive(i);
    p = 0;
    programmatic = performance.now();
    track.scrollTo({ left: offset(i), behavior: reducedMode ? 'auto' : 'smooth' });
  }
  function setPlaying(v) {
    playing = v;
    playBtn.dataset.playing = String(v);
    playBtn.setAttribute('aria-label', v ? 'Пауза' : 'Воспроизвести');
  }

  dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
  playBtn.addEventListener('click', () => {
    if (!playing && idx === slides.length - 1 && p >= 1) go(0);
    setPlaying(!playing);
  });

  // Свайп или прокрутка пользователем
  let t = 0;
  track.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const x = track.scrollLeft;
      let best = 0;
      slides.forEach((s, i) => { if (Math.abs(offset(i) - x) < Math.abs(offset(best) - x)) best = i; });
      if (best !== idx) { setActive(best); p = 0; }
    }, 90);
    if (performance.now() - programmatic > 900) setPlaying(false);
  }, { passive: true });

  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }, { threshold: 0.35 }).observe(track);

  gsap.ticker.add((time, dt) => {
    if (!playing || !inView || reducedMode || document.hidden) return;
    p = Math.min(1, p + dt / 1000 / DUR);
    dots[idx]?.style.setProperty('--p', p.toFixed(4));
    if (p >= 1) go((idx + 1) % slides.length);
  });

  setActive(0);
  return { go, setPlaying };
})();

/* ---------- Одометры «до нуля» ---------- */

const reels = $$('.odo__reel');
reels.forEach((reel, i) => {
  const cycles = 2 + i;
  const digits = [];
  for (let c = 0; c < cycles; c++) for (let d = 9; d >= 0; d--) digits.push(d);
  reel.innerHTML = digits.map((d) => `<span>${d}</span>`).join('');
  reel.dataset.steps = String(digits.length - 1);
});

/* ---------- Главная хореография ---------- */

const sections = {
  hero: $('#hero'), zero: $('#zero'), shutter: $('#shutter'), switches: $('#switches'),
  journal: $('#journal'), signal: $('#signal'), display: $('#display'),
  inside: $('#inside'), colors: $('#colors'), final: $('#final'),
};

let reducedMode = reduceMQ.matches;

function buildChoreography({ isMobile, reduce }) {
  reducedMode = reduce;
  stage?.setReduced(reduce);
  if (reduce) disableLenis(); else enableLenis();
  root.classList.toggle('reduced', reduce);

  Keys.reset();
  const P = makePoses(isMobile);
  const m = isMobile ? 0.75 : 1;

  // Секции: закреплённые (scrub) или обычные (reduced motion)
  const sts = {};
  const tls = {};
  const pinned = (name, len) => {
    const sec = sections[name];
    if (reduce) {
      sts[name] = ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom top' });
      return null;
    }
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: sec, start: 'top top', end: `+=${Math.round(len * m)}%`, pin: true, scrub: true, anticipatePin: 1 },
    });
    tl.set({}, {}, 1); // длительность таймлайна = 1 (доля пина)
    sts[name] = tl.scrollTrigger;
    tls[name] = tl;
    return tl;
  };

  sts.hero = ScrollTrigger.create({ trigger: sections.hero, start: 'top top', end: 'bottom top' });
  const tlZero = pinned('zero', 170);
  pinned('shutter', 130);
  pinned('switches', 220);
  const tlJournal = pinned('journal', 120);
  const track = $('.features__track');
  if (!reduce && track) {
    const dist = () => Math.max(0, track.scrollWidth - document.documentElement.clientWidth);
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '#features', start: 'top top', end: () => `+=${dist()}`,
        pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true,
      },
    });
  }
  const tlSignal = pinned('signal', 150);
  pinned('display', 170);
  const tlInside = pinned('inside', 200);
  pinned('colors', 130);
  // Диапазон ровно в один экран: модель уезжает вверх синхронно с контентом
  sts.final = ScrollTrigger.create({ trigger: sections.final, start: 'top top', end: '+=100%' });

  // HTML-таймлайны внутри пинов
  if (tlZero) {
    $$('.zero-item', sections.zero).forEach((el, i) => {
      tlZero.fromTo(el, { autoAlpha: 0, y: 40, filter: 'blur(6px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.1 }, 0.28 + i * 0.14);
    });
    tlZero.fromTo('.zero-note', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.1 }, 0.72);
  }
  if (tlJournal) {
    $$('.log__item', sections.journal).forEach((el, i, all) => {
      tlJournal.fromTo(el, { autoAlpha: 0, y: 18, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.06 }, 0.04 + (i / all.length) * 0.8);
    });
  }
  if (tlInside) {
    $$('.layer', sections.inside).forEach((el, i) => {
      tlInside.fromTo(el, { autoAlpha: 0.12, x: -16 }, { autoAlpha: 1, x: 0, duration: 0.08 }, 0.14 + i * 0.075);
    });
  }
  if (tlSignal) {
    tlSignal.fromTo('#signal .lead, #signal .note', { autoAlpha: 0.3 }, { autoAlpha: 1, duration: 0.2 }, 0.3);
  }

  // Ключевые кадры модели
  const K = (name, f, props, linear) => Keys.add(sts[name], f, props, linear);
  K('hero', 0, { ...P.hero, light: 0, nits: 0 });
  K('zero', 0, P.zeroA);
  K('zero', 0.45, P.zeroBack);
  K('zero', 0.85, P.zeroClose);
  K('zero', 1, P.zeroClose);
  K('shutter', 0, { ...P.shutter, shutter: 0 });
  K('shutter', 0.15, { shutter: 0 });
  K('shutter', 0.7, { shutter: 1 });
  K('shutter', 1, { ...P.shutterEnd, shutter: 1 });
  K('switches', 0, { ...P.switches, sw1: 1, sw2: 1, sw3: 1 });
  K('switches', 0.12, { sw1: 1 });
  K('switches', 0.28, { sw1: 0 });
  K('switches', 0.38, { sw2: 1 });
  K('switches', 0.54, { sw2: 0 });
  K('switches', 0.64, { sw3: 1 });
  K('switches', 0.8, { sw3: 0 });
  K('switches', 1, { ...P.switchesEnd, shutter: 1, sw1: 0, sw2: 0, sw3: 0 });
  // Сброс механики, пока модель скрыта за 2D-секциями
  K('signal', -2.2, { shutter: 1, sw1: 0, sw2: 0, sw3: 0 });
  K('signal', -2, { shutter: 0, sw1: 1, sw2: 1, sw3: 1 });
  K('signal', -1, { ...P.signal, signal: 0 });
  K('signal', 0.1, { signal: 0 });
  K('signal', 0.42, { signal: 1 });
  K('signal', 1, { ...P.signalEnd, signal: 1 });
  K('display', -0.6, { light: 0, screen: 1 });
  K('display', 0, { ...P.display, signal: 0, light: 1, nits: 0 });
  K('display', 0.35, { light: 1, nits: 0, screen: 1 });
  K('display', 0.65, { light: 0, nits: 1, screen: 0.04 });
  K('display', 1, { ...P.displayEnd, screen: 0.04 });
  K('inside', -1, { ...P.insideA, explode: 0, light: 0, nits: 1 });
  K('inside', 0, { ...P.insideA, explode: 0 });
  K('inside', 0.12, { explode: 0 });
  K('inside', 0.6, { ...P.insideMid, explode: 1 });
  K('inside', 1, { ...P.insideB, explode: 1 });
  K('colors', -1, { ...P.colorsA, light: 0, nits: 1, explode: 0 });
  K('colors', 0, P.colorsA);
  K('colors', 1, P.colorsB);
  K('final', -1, P.finalA);
  K('final', 0, P.finalB);
  K('final', 1, { y: P.finalB.y + 2 }, true);

  // Появления
  splitEls.forEach((el) => buildSplitReveal(el, reduce));

  const reveals = $$('[data-reveal]');
  reveals.forEach((el) => {
    // Лёгкий stagger внутри одного родителя
    const sibs = Array.from(el.parentElement.children).filter((c) => c.hasAttribute('data-reveal'));
    const delay = Math.min(sibs.indexOf(el), 6) * (reduce ? 0.04 : 0.07);
    const from = reduce ? { opacity: 0 } : { opacity: 0, y: 32, filter: 'blur(6px)' };
    const to = reduce
      ? { opacity: 1, duration: 0.5, delay }
      : { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, delay, ease: 'expo.out' };
    gsap.fromTo(el, from, { ...to, scrollTrigger: { trigger: el, start: 'top 92%', toggleActions: 'play none none none' } });
  });

  // Слова загораются по мере прокрутки
  scrubWords.forEach(({ el, spans }) => {
    const n = spans.length;
    const paint = (p) => spans.forEach((s, i) => s.style.setProperty('--o', String(0.16 + 0.84 * clamp01(p * (n + 4) - i))));
    if (reduce) { paint(1); return; }
    paint(0);
    ScrollTrigger.create({ trigger: el, start: 'top 82%', end: 'bottom 52%', onUpdate: (st) => paint(st.progress), onRefresh: (st) => paint(st.progress) });
  });

  // Одометры
  reels.forEach((reel, i) => {
    const steps = Number(reel.dataset.steps);
    if (reduce) { gsap.set(reel, { yPercent: -100 * steps / (steps + 1) }); return; }
    gsap.fromTo(reel, { yPercent: 0 }, {
      yPercent: -100 * steps / (steps + 1), duration: 2.4 + i * 0.4, ease: 'power4.out',
      scrollTrigger: { trigger: reel.closest('.counters'), start: 'top 80%', once: true },
    });
  });

  // Зачёркивания
  const strikes = $$('.strike');
  if (reduce) gsap.set(strikes, { '--s': 1 });
  else {
    strikes.forEach((el) => gsap.fromTo(el, { '--s': 0 }, {
      '--s': 1, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'top 58%', scrub: true },
    }));
  }

  // Зарядка 0 → 100 %
  const fill = $('.charge__fill');
  const pctEl = $('[data-charge-pct]');
  const minEl = $('[data-charge-min]');
  const setCharge = (p) => {
    fill.style.setProperty('--p', p.toFixed(3));
    pctEl.textContent = String(Math.round(p * 100));
    minEl.textContent = String(Math.round(p * 25));
  };
  if (reduce) setCharge(1);
  else {
    const o = { p: 0 };
    gsap.to(o, {
      p: 1, ease: 'none', onUpdate: () => setCharge(o.p),
      scrollTrigger: { trigger: '.charge', start: 'top 80%', end: 'bottom 55%', scrub: true },
    });
  }

  // Квадратная фронталка: кадр 9:16 ⇄ 16:9, телефон неподвижен
  if (!reduce) {
    const sq = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true, defaults: { ease: 'power3.inOut', duration: 0.9 } });
    sq.to('.square__frame', { width: '100%', height: '56.25%' }, 0.8)
      .to('.square__label--v', { opacity: 0, duration: 0.3 }, 0.8)
      .to('.square__label--h', { opacity: 1, duration: 0.3 }, 1.4)
      .to('.square__frame', { width: '56.25%', height: '100%' }, 3)
      .to('.square__label--h', { opacity: 0, duration: 0.3 }, 3)
      .to('.square__label--v', { opacity: 1, duration: 0.3 }, 3.6);
    ScrollTrigger.create({ trigger: '.square', start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? sq.play() : sq.pause()) });
  }

  // Параллакс фона и крупных цифр
  if (!reduce) {
    gsap.to('.bgfx__glow--a', { yPercent: 70, xPercent: -20, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
    gsap.to('.bgfx__glow--b', { yPercent: -60, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });
    $$('.cam-hero .giant').forEach((el, i) => {
      gsap.fromTo(el, { xPercent: i ? 6 : -6 }, { xPercent: i ? -4 : 4, ease: 'none', scrollTrigger: { trigger: '.cam-hero', start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    gsap.fromTo('.fourteen__main', { yPercent: 18 }, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: '.fourteen', start: 'top bottom', end: 'bottom top', scrub: true } });
    gsap.fromTo('.hero__inner', { y: 0 }, { y: -80, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: sections.hero, start: 'top top', end: 'bottom top', scrub: true } });
  }

  // Анимации карточек — только пока секции видны
  ['.os', '.features', '.network', '.highlights'].forEach((sel) => ScrollTrigger.create({ trigger: sel, start: 'top bottom', end: 'bottom top', toggleClass: 'in-view' }));

  ScrollTrigger.refresh();

  return () => {
    Keys.reset();
    splitEls.forEach(unsplit);
  };
}

ScrollTrigger.addEventListener('refresh', () => {
  Keys.compile();
  const ln = $('.dns__lane');
  if (ln) ln.style.setProperty('--lane-w', `${ln.clientWidth}px`);
});

/* ---------- Вращение модели перетаскиванием (секция цветов) ---------- */

const spin = { v: 0, on: false };
{
  const sec = sections.colors;
  let drag = null;
  new IntersectionObserver(([e]) => {
    spin.on = e.isIntersecting;
    if (!spin.on) spin.v = 0;
  }, { threshold: 0.6 }).observe(sec);
  sec.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button, a')) return;
    drag = { x: e.clientX, v: spin.v, id: e.pointerId };
    sec.setPointerCapture(e.pointerId);
    sec.classList.add('is-dragging');
  });
  sec.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    spin.v = drag.v + ((e.clientX - drag.x) / window.innerWidth) * PI * 2.2;
    if (Math.abs(e.clientX - drag.x) > 6) sec.classList.add('was-dragged');
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    sec.classList.remove('is-dragging');
  };
  sec.addEventListener('pointerup', end);
  sec.addEventListener('pointercancel', end);
}

/* ---------- Каждый тик: прокрутка → состояние ---------- */

let lastPoseKey = '';
let fading = false;
function tick() {
  if (Keys.empty) return;
  const v = Keys.sample(window.scrollY, reducedMode);
  v.spin = spin.on ? spin.v : 0;
  syncHtml(v);
  if (!stage) return;
  if (!reducedMode) { stage.setTarget(v); return; }
  // Reduced motion: позы меняются ступенчато, через короткое затухание
  const keyStr = ['x', 'y', 'rx', 'ry', 'rz', 'dist', 'fy', 'explode'].map((k) => (v[k] ?? 0).toFixed(2)).join('|');
  if (keyStr === lastPoseKey || fading) { if (!fading) stage.setTarget(v); return; }
  if (!lastPoseKey) { lastPoseKey = keyStr; stage.setTarget(v); return; }
  lastPoseKey = keyStr;
  fading = true;
  gsap.to(canvas, {
    opacity: 0, duration: 0.15, onComplete: () => {
      stage.setTarget(Keys.sample(window.scrollY, true));
      gsap.to(canvas, { opacity: 1, duration: 0.3, onComplete: () => { fading = false; } });
    },
  });
}
gsap.ticker.add(tick);
if (params.has('debug')) window.__oy = { stage, Keys, ScrollTrigger, lenis: () => lenis };

/* ---------- Рендер только когда 3D-секции видны ---------- */

if (stage) {
  const visible = new Set();
  const update = () => stage.setActive(visible.size > 0 && !document.hidden);
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    update();
  }, { rootMargin: '10% 0px 10% 0px' });
  $$('[data-3d]').forEach((s) => io.observe(s));
  document.addEventListener('visibilitychange', update);

  window.addEventListener('pointermove', (e) => {
    if (reducedMode || e.pointerType === 'touch') return;
    stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });

  let rw = window.innerWidth;
  window.addEventListener('resize', () => {
    stage.resize();
    if (Math.abs(window.innerWidth - rw) > 2) {
      rw = window.innerWidth;
      splitEls.forEach((el) => {
        const st = splitState.get(el);
        if (st && !st.done) buildSplitReveal(el, reducedMode);
      });
    }
  });
}

/* ---------- Случайный MAC ---------- */

const macEl = $('[data-mac]');
setInterval(() => {
  if (reducedMode || !$('.network')?.classList.contains('in-view')) return;
  const hex = () => Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');
  const bytes = Array.from({ length: 6 }, hex);
  bytes[0] = ((parseInt(bytes[0], 16) & 0xFC) | 0x02).toString(16).toUpperCase().padStart(2, '0');
  macEl.textContent = bytes.join(':');
}, 1800);

/* ---------- Запуск ---------- */

async function boot() {
  const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
  const fonts = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
  await Promise.race([Promise.all([fonts, stage ? stage.ready : null, timeout(500)]), timeout(14000)]);
  stage?.redrawScreen(BODY_COLORS[root.dataset.color]?.accent);

  const mm = gsap.matchMedia();
  mm.add({
    isMobile: '(max-width: 760px)',
    isDesktop: '(min-width: 761px)',
    reduce: '(prefers-reduced-motion: reduce)',
    motion: '(prefers-reduced-motion: no-preference)',
  }, (ctx) => buildChoreography(ctx.conditions));

  // Вступление
  const loader = $('#loader');
  loader.classList.add('is-done');
  loader.setAttribute('aria-hidden', 'true');
  if (!reduceMQ.matches) {
    gsap.from('.site-header', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.2 });
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
boot();
