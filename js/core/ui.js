/* =========================================================================
   OY — интерфейсные помощники: выборки, хранилище, тост, радиогруппы
   ========================================================================= */

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---------- Хранилище (может быть недоступно) ---------- */

export const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* приватный режим */ } },
};

/* ---------- Toast ---------- */

export function createToast(el, gsap) {
  let timer = 0;
  return function toast(msg) {
    el.textContent = msg;
    el.hidden = false;
    gsap.fromTo(el, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' });
    clearTimeout(timer);
    timer = setTimeout(() => {
      gsap.to(el, { autoAlpha: 0, y: 16, duration: 0.3, onComplete: () => { el.hidden = true; } });
    }, 3600);
  };
}

/* ---------- Радиогруппы ---------- */

export function syncRadio(group, value) {
  $$('[role="radio"]', group).forEach((b) => {
    const on = b.dataset.value === value;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  });
}

export function initRadioGroup(group, onChange) {
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

/* ---------- Тумблеры и заглушки ---------- */

export function bindToggles(root = document) {
  $$('[data-toggle]', root).forEach((t) => t.addEventListener('click', () => {
    t.setAttribute('aria-checked', String(t.getAttribute('aria-checked') !== 'true'));
  }));
}

export function bindStubs(toast, root = document) {
  $$('[data-stub]', root).forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    toast(el.dataset.stub);
  }));
}
