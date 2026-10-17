/* =========================================================================
   Открытое письмо сотрудников OY: появление блоков при прокрутке и счётчик
   подписей. Подпись нигде не сохраняется — это шутка письма над облаком.
   ========================================================================= */

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const els = Array.from(document.querySelectorAll('[data-reveal]'));
if (reduce || !('IntersectionObserver' in window)) {
  els.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
}

let n = 1412;
const out = Array.from(document.querySelectorAll('[data-sign-n]'));
const fmt = (v) => v.toLocaleString('ru-RU').replace(/\s/g, '\u00A0');
const render = () => out.forEach((o) => { o.textContent = fmt(n); });
render();

// счёт «растёт» сам: раз в несколько секунд кто-то ещё присоединяется
if (!reduce) setInterval(() => { if (!document.hidden) { n += 1 + ((Math.random() * 3) | 0); render(); } }, 3200);

const btn = document.querySelector('[data-sign]');
const done = document.querySelector('[data-sign-done]');
btn?.addEventListener('click', () => {
  n += 1;
  render();
  btn.disabled = true;
  btn.textContent = 'Вы с нами';
  if (done) done.hidden = false;
});
