/* =========================================================================
   OY — подменю страницы модели: прилипает при прокрутке (общая шапка уезжает
   вверх), подсвечивает текущий раздел, на узких экранах раскрывается списком.
   Отдельный модуль: страницы моделей подключают его рядом со своим скриптом.
   ========================================================================= */

const nav = document.querySelector('[data-subnav]:not(html)');
if (nav) {
  const root = document.documentElement;
  const toggle = nav.querySelector('[data-subnav-toggle]');
  const links = [...nav.querySelectorAll('.subnav__menu a')];

  // Прилипание: общая шапка прячется, как только её высота ушла за край
  let stuck = false;
  const onScroll = () => {
    const next = window.scrollY > 8;
    if (next !== stuck) { stuck = next; root.classList.toggle('subnav-stuck', stuck); }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Список разделов на телефоне
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  links.forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); } });
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) setOpen(false); });

  // Текущий раздел: последний, чей верх уже выше середины экрана
  const targets = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  let current = null;
  const mark = () => {
    const mid = window.innerHeight * 0.45;
    let idx = -1;
    targets.forEach((t, i) => { if (t.getBoundingClientRect().top < mid) idx = i; });
    const next = links[idx] ?? null;
    if (next === current) return;
    current?.classList.remove('is-active');
    current?.removeAttribute('aria-current');
    current = next;
    current?.classList.add('is-active');
    current?.setAttribute('aria-current', 'true');
  };
  let raf = 0;
  window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; mark(); }); }, { passive: true });
  mark();
}
