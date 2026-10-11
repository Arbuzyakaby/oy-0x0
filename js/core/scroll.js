/* =========================================================================
   OY — плавная прокрутка (Lenis) и якоря
   ========================================================================= */

export function createSmoothScroll({ gsap, ScrollTrigger, Lenis, reduceMQ }) {
  let lenis = null;
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

  return {
    enable() {
      if (lenis) return;
      lenis = new Lenis({ autoRaf: false, lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
    },
    disable() {
      if (!lenis) return;
      lenis.destroy();
      lenis = null;
    },
    get lenis() { return lenis; },
  };
}
