/* =========================================================================
   eXtream — общее для хаба и страницы Y1: меню, достижения, телеметрия
   (настоящий fps браузера), геймпад (Gamepad API), тост.
   ========================================================================= */

import { $, $$, store } from '../core/ui.js';

/* ---------- Меню на телефоне ---------- */

export function initMenu() {
  const btn = $('[data-menu]');
  const sheet = $('#x-sheet');
  if (!btn || !sheet) return;
  const set = (open) => {
    sheet.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Закрыть' : 'Меню';
  };
  btn.addEventListener('click', () => set(sheet.hidden));
  sheet.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) set(false); });
}

/* ---------- Тост ---------- */

export function createToast(el) {
  let timer = 0;
  return (msg, ms = 3200) => {
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { el.hidden = true; }, ms);
  };
}

/* ---------- Достижения ---------- */

const ACH_KEY = 'xtr-achievements';

export function createAchievements(host, { onChange } = {}) {
  let got = new Set();
  try { got = new Set(JSON.parse(store.get(ACH_KEY) || '[]')); } catch { /* испорченная запись */ }
  const save = () => store.set(ACH_KEY, JSON.stringify([...got]));
  const show = (title) => {
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'x-ach__item';
    el.innerHTML = '<span class="x-ach__ico" aria-hidden="true">✓</span><span><p class="x-ach__k">Достижение · +100 XP</p><p class="x-ach__t"></p></span>';
    el.querySelector('.x-ach__t').textContent = title;
    host.append(el);
    setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 240); }, 3600);
  };
  const api = {
    unlock(id, title) {
      if (got.has(id)) return false;
      got.add(id);
      save();
      show(title);
      onChange?.(api.xp);
      return true;
    },
    has: (id) => got.has(id),
    get xp() { return got.size * 100; },
  };
  onChange?.(api.xp);
  return api;
}

/* ---------- Телеметрия: настоящий fps браузера и значения сцены ---------- */

export function createHud(root = document) {
  const el = Object.fromEntries($$('[data-hud]', root).map((d) => [d.dataset.hud, d]));
  const tempBox = $('[data-hud-box="temp"]', root);
  let frames = 0;
  let last = performance.now();
  let fps = 0;
  const values = { temp: 31, rpm: 0, ping: 9 };
  const shown = {};
  const set = (k, text) => { if (el[k] && shown[k] !== text) { el[k].textContent = text; shown[k] = text; } };
  function loop(now) {
    frames++;
    if (now - last >= 500) {
      fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
      set('fps', String(fps));
      set('temp', String(Math.round(values.temp)));
      set('rpm', Math.round(values.rpm / 100) * 100 >= 1000 ? (Math.round(values.rpm / 100) * 100).toLocaleString('ru-RU') : String(Math.round(values.rpm)));
      set('ping', String(Math.round(values.ping)));
      tempBox?.classList.toggle('is-hot', values.temp >= 45);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  return {
    set(v) { Object.assign(values, v); },
    get fps() { return fps; },
  };
}

/* ---------- Геймпад ---------- */

// Стандартная раскладка: 0 — A, 1 — B, 6/7 — LT/RT (аналоговые), 12–15 — крестовина
export function createGamepad({ onButton, onTriggers, onConnect } = {}) {
  if (!('getGamepads' in navigator)) return null;
  const prev = [];
  let active = false;
  let raf = 0;
  let stickLock = 0;
  function poll() {
    raf = requestAnimationFrame(poll);
    const pads = navigator.getGamepads();
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) return;
    gp.buttons.forEach((b, i) => {
      const down = b.pressed;
      if (down && !prev[i]) onButton?.(i);
      prev[i] = down;
    });
    onTriggers?.(gp.buttons[6]?.value ?? 0, gp.buttons[7]?.value ?? 0);
    // левый стик вниз/вверх — как крестовина, с задержкой между шагами
    const y = gp.axes[1] ?? 0;
    const now = performance.now();
    if (Math.abs(y) > 0.7 && now > stickLock) {
      onButton?.(y > 0 ? 13 : 12);
      stickLock = now + 420;
    }
  }
  window.addEventListener('gamepadconnected', (e) => {
    if (!active) { active = true; raf = requestAnimationFrame(poll); }
    onConnect?.(e.gamepad);
  });
  window.addEventListener('gamepaddisconnected', () => {
    if (![...navigator.getGamepads()].some((p) => p && p.connected)) { active = false; cancelAnimationFrame(raf); }
  });
  return { get active() { return active; } };
}

/* ---------- Цены: общий выбор валюты с остальным сайтом ---------- */

export const CUR_KEY = 'oy-currency';
// ¥ — только у eXtream Y1, первого OY в Китае; остальные страницы сайта видят его как $
const CURRENCIES = ['usd', 'eur', 'cny'];
export const getCurrency = () => { const v = store.get(CUR_KEY) || store.get('oy-0x2pro-currency'); return CURRENCIES.includes(v) ? v : 'usd'; };
export const setCurrency = (v) => store.set(CUR_KEY, CURRENCIES.includes(v) ? v : 'usd');
