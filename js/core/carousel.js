/* =========================================================================
   OY — карусель «Коротко о главном»: автопрокрутка с прогрессом на активной
   точке, пауза, свайп, клики по точкам.
   ========================================================================= */

import { $, $$ } from './ui.js';

export function initCarousel(sec, { gsap, isReduced, duration = 5 }) {
  if (!sec) return null;
  const track = $('.hl__track', sec);
  const slides = $$('.hl__slide', sec);
  const dots = $$('.hl__dot', sec);
  const playBtn = $('.hl__play', sec);
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
    track.scrollTo({ left: offset(i), behavior: isReduced() ? 'auto' : 'smooth' });
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
    if (!playing || !inView || isReduced() || document.hidden) return;
    p = Math.min(1, p + dt / 1000 / duration);
    dots[idx]?.style.setProperty('--p', p.toFixed(4));
    if (p >= 1) go((idx + 1) % slides.length);
  });

  setActive(0);
  return { go, setPlaying };
}
