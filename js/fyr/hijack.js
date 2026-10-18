/* =========================================================================
   Fyr — загрузчик «Перехвата». Стоит на каждой странице и ничего не знает
   о её скриптах. Ждёт, пока виден подвал, и слушает триггер: «x0» (или «ч0»)
   на клавиатуре, пять касаний щита за две секунды. Подключается раньше
   скрипта страницы: если вкладка уже перехвачена, словарь ложится до того,
   как страница разобьёт заголовки на строки. Режим держится до закрытия
   вкладки.
   ========================================================================= */

import { createKeyBuffer, createTapCounter } from './dict.js';
import { hijack, restore, mountPage } from './glitch.js';

const root = document.documentElement;
const KEY = 'fyr';
const session = {
  get() { try { return window.sessionStorage.getItem(KEY) === '1'; } catch { return false; } },
};

const fire = () => { if (root.dataset.brand !== 'fyr') hijack(); };

// Страницы Fyr — свои: «Перехват» там не нужен
if (root.hasAttribute('data-fyr-page')) {
  mountPage();
} else {
  if (session.get()) restore();
  else root.classList.remove('fyr-pending');

  /* ---------- Подвал на экране ---------- */
  let footerSeen = false;
  const footers = document.querySelectorAll('.site-footer, .x-footer, body > footer');
  const io = new IntersectionObserver((entries) => {
    footerSeen = entries.some((e) => e.isIntersecting && (e.intersectionRatio >= 0.2 || e.intersectionRect.height >= 120));
  }, { threshold: [0, 0.2, 0.5] });
  footers.forEach((f) => io.observe(f));

  /* ---------- Клавиатура ---------- */
  const push = createKeyBuffer();
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) { push(''); return; }
    const t = e.target;
    if (t instanceof Element && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    const hit = push(e.key);
    if (hit && footerSeen) fire();
  });

  /* ---------- Пять касаний щита ---------- */
  const tap = createTapCounter();
  document.addEventListener('click', (e) => {
    const shield = e.target instanceof Element && e.target.closest('[data-fyr-shield]');
    if (!shield) return;
    const r = tap(performance.now());
    if (r === 'hint') {
      shield.classList.remove('is-twitch');
      void shield.offsetWidth;
      shield.classList.add('is-twitch');
    } else if (r === 'fire') fire();
  });
}
