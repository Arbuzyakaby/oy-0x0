/* =========================================================================
   OY — текст: разбиение заголовков на строки, появления, абзац «по словам»
   ========================================================================= */

import { clamp01 } from './ui.js';

export function splitLines(el) {
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

export function unsplit(el) {
  if (el.dataset.splitText !== undefined) el.textContent = el.dataset.splitText;
}

export function createSplitReveals(els, { gsap }) {
  const state = new Map();
  function build(el, reduce) {
    const st = state.get(el) || {};
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
    state.set(el, st);
  }
  return {
    buildAll(reduce) { els.forEach((el) => build(el, reduce)); },
    rebuildPending(reduce) {
      els.forEach((el) => {
        const st = state.get(el);
        if (st && !st.done) build(el, reduce);
      });
    },
    unsplitAll() { els.forEach(unsplit); },
  };
}

/* ---------- Абзац, который «загорается» по словам ---------- */

export function wrapWords(el) {
  const words = el.textContent.replace(/[ \t\r\n]+/g, ' ').trim().split(' ');
  el.textContent = '';
  return words.map((w, i) => {
    const s = document.createElement('span');
    s.className = 'w';
    s.textContent = w;
    el.append(s);
    if (i < words.length - 1) el.append(' ');
    return s;
  });
}

export function scrubWords(items, { reduce, ScrollTrigger }) {
  items.forEach(({ el, spans }) => {
    const n = spans.length;
    const paint = (p) => spans.forEach((s, i) => s.style.setProperty('--o', String(0.16 + 0.84 * clamp01(p * (n + 4) - i))));
    if (reduce) { paint(1); return; }
    paint(0);
    ScrollTrigger.create({ trigger: el, start: 'top 82%', end: 'bottom 52%', onUpdate: (st) => paint(st.progress), onRefresh: (st) => paint(st.progress) });
  });
}
