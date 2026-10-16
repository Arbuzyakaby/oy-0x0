/* =========================================================================
   eXtream Y1 — интерактивные демо страницы: тепловизор стресс-теста,
   плавность 60/120/165 Гц, тест реакции, «Шаги», гонка пакетов Claw G
   и дерево навыков eXOS 4. Каждое демо рисует только пока видно.
   ========================================================================= */

import { $, $$, syncRadio, initRadioGroup } from '../core/ui.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fmt = (n, d = 0) => n.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

// Цикл, который крутится только пока элемент на экране
function whileVisible(el, frame) {
  let raf = 0;
  let last = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    frame(dt, now);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !raf) { last = 0; raf = requestAnimationFrame(loop); }
    if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
  }, { rootMargin: '80px' }).observe(el);
}

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/* ---------- Стресс-тест: тепловизор ---------- */

// Тепловая палитра: 20 °C — почти чёрный, 70 °C — белый
const PALETTE = [[0, [10, 4, 32]], [0.2, [75, 12, 110]], [0.45, [181, 23, 76]], [0.65, [242, 90, 31]], [0.85, [255, 201, 60]], [1, [255, 251, 230]]];
function heatColor(t) {
  const k = clamp((t - 20) / 50, 0, 1);
  for (let i = 1; i < PALETTE.length; i++) {
    const [b, cb] = PALETTE[i];
    if (k <= b) {
      const [a, ca] = PALETTE[i - 1];
      const f = (k - a) / (b - a);
      return [0, 1, 2].map((j) => Math.round(ca[j] + (cb[j] - ca[j]) * f));
    }
  }
  return PALETTE.at(-1)[1];
}

// Тепловые модели: R — тепловое сопротивление чип → воздух, °C/Вт; back — доля перегрева на спинке
const PHONES = {
  y1: { name: 'eXtream Y1', clock: 5.2, fpsK: 1, R: 3.1, Roff: 7.5, back: 0.32, spread: 0.34 },
  flagship: { name: 'Обычный флагман', clock: 4.9, fpsK: 0.92, R: 6.5, back: 0.38, spread: 0.17 },
};
const T_LIMIT = 88;

export function initStress(root, { onTemp, onAchieve, toast } = {}) {
  if (!root) return null;
  const cv = $('[data-thermo-canvas]', root);
  const g = cv.getContext('2d');
  const graph = $('[data-t-graph]', root);
  const gg = graph.getContext('2d');
  const out = {
    time: $('[data-t-time]', root), clock: $('[data-t-clock]', root), fps: $('[data-t-fps]', root),
    back: $('[data-t-back]', root), backRow: $('[data-t-backrow]', root), verdict: $('[data-t-verdict]', root),
  };
  const runBtn = $('[data-t-run]', root);
  const fansBtn = $('[data-t-fans]', root);
  const phoneGroup = $('[data-t-phone]', root);

  const field = document.createElement('canvas');
  field.width = 45; field.height = 70;
  const fg = field.getContext('2d');
  const img = fg.createImageData(field.width, field.height);

  const s = { phone: 'y1', fans: true, run: false, t: 0, chip: 30, clock: PHONES.y1.clock, hist: [] };
  const P = () => PHONES[s.phone];
  const R = () => (s.phone === 'y1' && !s.fans ? P().Roff : P().R);
  const backT = () => 25 + (s.chip - 25) * P().back;

  function reset() {
    s.run = false; s.t = 0; s.chip = 30; s.clock = P().clock; s.hist = [];
    runBtn.firstChild.textContent = 'Нагрузка ';
    out.verdict.textContent = 'Нажмите «Нагрузка». Секунда здесь — минута игры.';
    draw();
  }
  function setFans(v) {
    s.fans = v;
    fansBtn.setAttribute('aria-pressed', String(v));
    fansBtn.textContent = s.phone === 'flagship' ? 'Вентиляторов нет' : `Вентиляторы: ${v ? 'вкл' : 'выкл'}`;
  }
  function toggleRun() {
    if (s.t >= 60) reset();
    s.run = !s.run;
    runBtn.firstChild.textContent = s.run ? 'Пауза ' : 'Нагрузка ';
    if (s.run) out.verdict.textContent = s.phone === 'y1' && !s.fans ? 'Идёт игра без вентиляторов. Следите за частотой.' : 'Идёт игра. Секунда здесь — минута.';
  }

  runBtn.addEventListener('click', toggleRun);
  fansBtn.addEventListener('click', () => { if (s.phone === 'y1') setFans(!s.fans); });
  $('[data-t-reset]', root).addEventListener('click', reset);
  initRadioGroup(phoneGroup, (v) => {
    syncRadio(phoneGroup, v);
    s.phone = v;
    fansBtn.disabled = v === 'flagship';
    setFans(v === 'y1');
    reset();
  });

  function step(dt) {
    // секунда страницы — минута игры
    const m = dt;
    const load = s.run;
    const ph = P();
    const watts = load ? 14 * (s.clock / 5.2) ** 2 : 1.2;
    const target = 25 + watts * R();
    s.chip += (target - s.chip) * (1 - Math.exp(-m / 2.5));
    // троттлинг: частота, которую корпус может удержать на пределе
    const sustain = 5.2 * Math.sqrt(((T_LIMIT - 25) / R()) / 14);
    const want = load && s.chip > T_LIMIT - 3 ? Math.min(ph.clock, sustain) : ph.clock;
    s.clock += (want - s.clock) * (1 - Math.exp(-m / 1.4));
    if (load) {
      s.t = Math.min(60, s.t + m);
      const fps = 165 * ph.fpsK * (s.clock / 5.2);
      if (!s.hist.length || s.t - s.hist.at(-1)[0] >= 0.5) s.hist.push([s.t, fps]);
      if (s.t >= 60) finish();
      if (s.phone === 'y1' && s.fans && s.t >= 30) onAchieve?.('cool', 'Холодная голова: полчаса на 5,2 ГГц');
      if (s.phone === 'y1' && !s.fans && s.clock < 4.5) onAchieve?.('hot', 'Без вентиляторов не надо');
    }
  }
  function finish() {
    s.run = false;
    runBtn.firstChild.textContent = 'Ещё раз ';
    const ph = P();
    const fps = Math.round(165 * ph.fpsK * (s.clock / 5.2));
    const back = Math.round(backT());
    out.verdict.textContent = s.phone === 'flagship'
      ? `${ph.name} через час: ${fmt(s.clock, 2)} ГГц, ${fps} fps, спинка ${back} °C.`
      : s.fans
        ? `Час прошёл. Частота держится: ${fmt(s.clock, 2)} ГГц, ${fps} fps. Спинка — ${back} °C.`
        : `Без вентиляторов Y1 сбросил частоту до ${fmt(s.clock, 2)} ГГц — это уже обычный Gen 6. Включите их обратно.`;
    toast?.(out.verdict.textContent);
  }

  // Поле температур спинки: горячее пятно над чипом, у Y1 — холодные круги вентиляторов
  function draw() {
    const W = field.width, H = field.height;
    const ph = P();
    const back = backT();
    const spread = s.phone === 'y1' && s.fans ? ph.spread : 0.18;
    const peak = back + (s.chip - back) * (s.phone === 'y1' && s.fans ? 0.18 : 0.42);
    const cx = 0.5, cy = 0.37;
    const fanCool = s.phone === 'y1' && s.fans ? (s.chip - 30) * 0.12 : 0;
    const d = img.data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const u = x / (W - 1), v = y / (H - 1);
        const inside = u > 0.04 && u < 0.96 && v > 0.025 && v < 0.975 && (Math.min(u - 0.04, 0.96 - u) + Math.min(v - 0.025, 0.975 - v) * 0.47) > 0.025;
        let t = 22;
        if (inside) {
          const dx = (u - cx) * 0.47, dy = v - cy;
          t = back - 1.5 + (peak - back + 1.5) * Math.exp(-(dx * dx + dy * dy) / (2 * spread * spread * 0.22));
          // нижняя половина — аккумулятор, чуть теплее краёв
          t += Math.exp(-((v - 0.68) ** 2) / 0.02) * 0.8;
          for (const fx of [0.29, 0.71]) {
            const ex = (u - fx) * 0.47, ey = v - 0.37;
            t -= fanCool * Math.exp(-(ex * ex + ey * ey) / 0.0016);
          }
        }
        const [r, gC, b] = heatColor(t);
        const i = (y * W + x) * 4;
        d[i] = r; d[i + 1] = gC; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    fg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.fillStyle = '#05070A';
    g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(field, 0, 0, cv.width, cv.height);
    // контуры для ориентира: модуль камер и вентиляторы
    g.strokeStyle = 'rgba(255,255,255,.22)';
    g.lineWidth = 1.5;
    if (s.phone === 'y1') {
      g.beginPath(); g.arc(cv.width / 2, cv.height * 0.15, cv.width * 0.23, 0, Math.PI * 2); g.stroke();
      for (const fx of [0.29, 0.71]) { g.beginPath(); g.arc(cv.width * fx, cv.height * 0.37, cv.width * 0.165, 0, Math.PI * 2); g.stroke(); }
    } else {
      g.strokeRect(cv.width * 0.12, cv.height * 0.06, cv.width * 0.3, cv.height * 0.16);
    }
    // прицел на самой горячей точке
    const hx = cv.width / 2, hy = cv.height * cy;
    g.strokeStyle = '#FFFFFF'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(hx, hy, 12, 0, Math.PI * 2);
    g.moveTo(hx - 22, hy); g.lineTo(hx - 14, hy); g.moveTo(hx + 14, hy); g.lineTo(hx + 22, hy);
    g.stroke();
    g.font = '600 14px "JetBrains Mono", monospace';
    g.fillStyle = '#FFFFFF';
    g.fillText(`${Math.round(peak)} °C`, hx + 18, hy - 16);

    const fps = s.run || s.t > 0 ? Math.round(165 * ph.fpsK * (s.clock / 5.2)) : null;
    out.time.textContent = String(Math.floor(s.t));
    out.clock.textContent = fmt(s.clock, 2);
    out.fps.textContent = fps === null ? '—' : String(fps);
    out.back.textContent = String(Math.round(back));
    out.backRow.classList.toggle('is-hot', back >= 42);
    onTemp?.(back, s.chip);
    drawGraph();
  }
  function drawGraph() {
    const W = graph.width, H = graph.height;
    gg.clearRect(0, 0, W, H);
    gg.strokeStyle = 'rgba(122,139,152,.25)';
    gg.lineWidth = 1;
    for (const f of [60, 120, 165]) {
      const y = H - (f / 180) * H;
      gg.beginPath(); gg.moveTo(0, y); gg.lineTo(W, y); gg.stroke();
      gg.fillStyle = 'rgba(122,139,152,.7)';
      gg.font = '500 11px "JetBrains Mono", monospace';
      gg.fillText(String(f), 4, y - 3);
    }
    if (s.hist.length < 2) return;
    gg.strokeStyle = css('--x-accent') || '#4FF0FF';
    gg.lineWidth = 2;
    gg.beginPath();
    s.hist.forEach(([t, f], i) => {
      const x = (t / 60) * W, y = H - (f / 180) * H;
      if (i) gg.lineTo(x, y); else gg.moveTo(x, y);
    });
    gg.stroke();
  }

  whileVisible(root, (dt) => {
    if (s.run || s.chip > 30.5) step(dt);
    draw();
  });
  draw();
  return { toggleRun, get running() { return s.run; } };
}

/* ---------- Холст в настоящем размере ---------- */

// Буфер холста — под его CSS-размер и плотность экрана: ничего не растягивается.
// Рисуем в CSS-пикселях, возвращаем ширину и высоту
function fit(cv) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight);
  const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, W: w, H: h };
}
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/* ---------- 60 / 120 / 165 Гц ---------- */

export function initHz(cv, group) {
  if (!cv) return;
  let rate = 165;
  initRadioGroup(group, (v) => { rate = Number(v); syncRadio(group, v); });
  whileVisible(cv, (dt, now) => {
    const { g, W, H } = fit(cv);
    const t = now / 1000;
    const accent = css('--x-accent') || '#4FF0FF';
    const lane = (y, hz, label, hot) => {
      const period = 1.6;
      const x0 = 24, x1 = W - 24;
      const step = Math.floor(t * hz) / hz;
      const pos = (s) => x0 + ((s % period) / period) * (x1 - x0 - 22);
      g.fillStyle = 'rgba(122,139,152,.18)';
      g.fillRect(x0, y + 15, x1 - x0, 1);
      // след: последние кадры, как их видит глаз
      for (let k = 4; k >= 0; k--) {
        g.globalAlpha = k ? 0.06 + (4 - k) * 0.05 : 1;
        g.fillStyle = hot ? accent : '#7A8B98';
        g.fillRect(pos(step - k / hz), y - 13, 22, 26);
      }
      g.globalAlpha = 1;
      g.fillStyle = hot ? '#DDE8EE' : '#7A8B98';
      g.font = `600 11px ${MONO}`;
      g.fillText(label, x0, y - 22);
    };
    lane(H * 0.34, 60, '60 ГЦ · ОБЫЧНЫЙ ТЕЛЕФОН', false);
    lane(H * 0.8, rate, `${rate} ГЦ · Y1`, true);
  });
}

/* ---------- Тест реакции ---------- */

export function initReaction(root, { onResult } = {}) {
  if (!root) return;
  const btn = $('[data-react-btn]', root);
  const big = $('[data-react-big]', root);
  const small = $('[data-react-small]', root);
  const target = $('[data-react-target]', root);
  let state = 'idle';
  let timer = 0;
  let t0 = 0;
  let best = Infinity;
  const set = (st, b, sm) => { state = st; root.dataset.state = st; big.textContent = b; small.textContent = sm; };
  btn.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    hit();
  });
  btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(); } });
  function hit() {
    if (state === 'idle' || state === 'done' || state === 'early') {
      set('wait', 'Ждите…', 'Нажмите, когда экран загорится');
      clearTimeout(timer);
      timer = setTimeout(() => {
        const r = root.getBoundingClientRect();
        target.style.left = `${20 + Math.random() * (r.width - 40)}px`;
        target.style.top = `${20 + Math.random() * (r.height - 40)}px`;
        t0 = performance.now();
        set('go', 'Жми!', 'сейчас');
      }, 1100 + Math.random() * 2100);
    } else if (state === 'wait') {
      clearTimeout(timer);
      set('early', 'Рано', 'Фальстарт. Нажмите, чтобы попробовать снова');
    } else if (state === 'go') {
      const ms = Math.round(performance.now() - t0);
      best = Math.min(best, ms);
      set('done', `${ms} мс`, `лучшее — ${best} мс · Y1 заметил бы касание за 0,33 мс. Ещё раз?`);
      onResult?.(ms);
    }
  }
}

/* ---------- «Шаги» ---------- */

export function initWave(cv, btn) {
  if (!cv) return;
  let on = false;
  btn?.addEventListener('click', () => {
    on = !on;
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = `«Шаги»: ${on ? 'вкл' : 'выкл'}`;
  });
  // псевдослучайный, но стабильный шум боя
  const noise = (x) => {
    const s = Math.sin(x * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };
  whileVisible(cv, (dt, now) => {
    const { g, W, H } = fit(cv);
    const mid = H / 2 + 8;
    const t = now / 1000;
    const accent = css('--x-accent') || '#4FF0FF';
    g.fillStyle = 'rgba(122,139,152,.18)';
    g.fillRect(0, mid, W, 1);
    for (let x = 0; x < W; x += 3) {
      const ph = t * 110 + x;
      const battle = (noise(Math.floor(ph / 3)) - 0.5) * (0.55 + 0.45 * Math.sin(ph / 60)) * (on ? 0.5 : 1);
      // шаг — короткий всплеск через равные промежутки
      const stepPos = (ph % 64) / 64;
      const step = stepPos < 0.1 ? Math.sin((stepPos / 0.1) * Math.PI) : 0;
      const bh = Math.abs(battle) * (H - 30) * 0.9;
      g.fillStyle = 'rgba(122,139,152,.5)';
      g.fillRect(x, mid - bh / 2, 2, bh);
      if (step > 0) {
        const sh = step * (H - 30) * (on ? 0.85 : 0.22);
        g.fillStyle = on ? accent : 'rgba(221,232,238,.55)';
        g.fillRect(x, mid - sh / 2, 2, sh);
      }
    }
    g.fillStyle = on ? accent : '#DDE8EE';
    g.font = `600 11px ${MONO}`;
    g.fillText(on ? 'ШАГИ — ГРОМЧЕ БОЯ' : 'ШАГИ ТОНУТ В ШУМЕ БОЯ', 4, 14);
  });
}

/* ---------- Claw G: гонка пакетов ---------- */

// Каждые 0,4 с телефон отправляет игровой пакет. С «Двойным каналом» — сразу по Wi-Fi и 5G:
// засчитывается тот, что пришёл первым. Без него — только Wi-Fi, со всплесками и потерями
export function initRace(cv, { pingEl, lostEl, toggle, onPing } = {}) {
  if (!cv) return;
  let dual = true;
  let lost = 0;
  let ping = 9;
  let spawn = 0;
  const last = [null, null];      // последний пинг каждой дорожки, мс (null — потерян)
  const packets = [];
  toggle?.addEventListener('click', () => {
    dual = toggle.getAttribute('aria-checked') !== 'true';
    toggle.setAttribute('aria-checked', String(dual));
  });
  const wifiLat = () => (Math.random() < 0.07 ? null : Math.random() < 0.16 ? 60 + Math.random() * 80 : 7 + Math.random() * 6);
  const nrLat = () => (Math.random() < 0.02 ? null : 11 + Math.random() * 7);
  // время полёта на схеме: заметно, но пропорционально пингу
  const travel = (lat) => Math.min(3.6, 0.55 + lat * 0.022);
  whileVisible(cv, (dt, now) => {
    spawn -= dt;
    if (spawn <= 0) {
      spawn = 0.4;
      const a = wifiLat();
      const b = dual ? nrLat() : null;
      const ok = [a, b].filter((x) => x !== null);
      const eff = ok.length ? Math.min(...ok) : null;
      packets.push({ t: now, lat: [a, dual ? b : undefined], win: eff === null ? -1 : a === eff ? 0 : 1, counted: false, eff });
    }
    const { g, W, H } = fit(cv);
    const accent = css('--x-accent') || '#4FF0FF';
    const LX = 132, FX = W - 64;                     // старт (телефон) и финиш (сервер)
    const lanes = [H * 0.36, H * 0.72];
    const names = ['WI-FI 7', '5G'];

    // дорожки и подписи
    g.font = `600 11px ${MONO}`;
    lanes.forEach((y, i) => {
      const off = i === 1 && !dual;
      g.fillStyle = off ? 'rgba(122,139,152,.35)' : '#DDE8EE';
      g.fillText(names[i], 8, y - 3);
      g.fillStyle = off ? 'rgba(122,139,152,.35)' : last[i] === null ? '#FF5A1F' : '#7A8B98';
      g.fillText(off ? 'выключен' : last[i] === null ? 'потерян' : `${Math.round(last[i])} мс`, 8, y + 12);
      g.fillStyle = off ? 'rgba(122,139,152,.08)' : 'rgba(122,139,152,.22)';
      g.fillRect(LX, y, FX - LX, 1);
    });
    // старт и финиш
    const top = lanes[0] - 22, bot = lanes[1] + 22;
    g.strokeStyle = 'rgba(221,232,238,.5)';
    g.lineWidth = 1;
    g.strokeRect(LX - 22, top, 16, bot - top);
    g.strokeRect(FX + 6, top, 16, bot - top);
    g.fillStyle = '#7A8B98';
    g.font = `600 10px ${MONO}`;
    g.fillText('Y1', LX - 22, top - 6);
    g.fillText('СЕРВЕР', FX - 18, top - 6);
    if (dual) {
      g.fillStyle = accent;
      g.fillText('ЗАСЧИТАН ПЕРВЫЙ', W - 170, H - 8);
    }

    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      const age = (now - p.t) / 1000;
      if (age > 4.4) { packets.splice(i, 1); continue; }
      // пакет засчитан, когда долетел первый живой
      if (!p.counted && (p.eff === null ? age > 1.2 : age >= travel(p.eff))) {
        p.counted = true;
        if (p.eff === null) lost++;
        else ping += (p.eff - ping) * 0.35;
        last[0] = p.lat[0];
        if (p.lat[1] !== undefined) last[1] = p.lat[1];
        if (pingEl) pingEl.textContent = String(Math.round(ping));
        if (lostEl) lostEl.textContent = String(lost);
        onPing?.(ping);
      }
      p.lat.forEach((lat, li) => {
        if (lat === undefined) return;
        const y = lanes[li];
        if (lat === null) {
          // потерянный пакет обрывается на полпути крестиком
          const k = Math.min(1, age / 1.2);
          const x = LX + k * (FX - LX) * 0.55;
          g.globalAlpha = age < 1.2 ? 1 : Math.max(0, 1 - (age - 1.2) / 0.5);
          g.strokeStyle = '#FF5A1F';
          g.lineWidth = 2;
          if (age < 1.2) { g.fillStyle = '#FF5A1F'; g.fillRect(x - 4, y - 4, 8, 8); }
          else { g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5); g.moveTo(x + 5, y - 5); g.lineTo(x - 5, y + 5); g.stroke(); }
          g.globalAlpha = 1;
          return;
        }
        const tr = travel(lat);
        const k = Math.min(1, age / tr);
        const x = LX + k * (FX - LX);
        const won = p.win === li;
        const done = age >= tr;
        if (done && age > tr + 0.5) return;
        g.fillStyle = won ? accent : 'rgba(221,232,238,.45)';
        g.fillRect(x - 5, y - 5, 10, 10);
        if (done && won) {
          g.strokeStyle = accent;
          g.lineWidth = 2;
          g.strokeRect(FX + 2, y - 10, 24, 20);
        }
      });
    }
  });
}

/* ---------- eXOS 4: дерево навыков ---------- */

export const SKILLS = [
  ['Бой', [
    ['arena', '«Арена»', 'Игровой хаб. Открывается «Рубильником»: все игры, профили и статистика сессий.'],
    ['boost', '«Форсаж»', 'Профили «Эко», «Баланс» и «Форсаж» — свой для каждой игры. Здесь же генерация кадров и апскейл Neon 1.'],
    ['precool', '«Предохлаждение»', 'Вентиляторы раскручиваются, как только вы открыли игру, — до того, как чип нагрелся.'],
    ['reserve', '«Запас»', 'До пяти игр заморожены в памяти и продолжаются мгновенно, с того же кадра.'],
  ]],
  ['Управление', [
    ['layout', '«Раскладка»', 'Курки — на любые точки экрана, своя раскладка для каждой игры, обмен через QR. Одно нажатие — одно касание: макросов нет, чтобы вас не забанили.'],
    ['telemetry', '«Телеметрия»', 'HUD поверх игры: fps, время кадра, °C чипа и спинки, обороты, пинг и ватты. После сессии — графики.'],
    ['console', '«Консоль»', 'Нижний USB-C — на телевизор, 4K/120. Интерфейс под геймпад, телефон становится приставкой.'],
  ]],
  ['Эфир', [
    ['shade', '«Стрим-шторка»', 'Трансляция в один тап. В кадре сами скрываются уведомления, ввод паролей, имена и номера; фон за лицом размыт.'],
    ['replay', '«Повтор»', 'Зажали курок — сохранились последние 60 секунд. Запись остаётся на телефоне.'],
    ['silence', '«Тишина в бою»', 'Звонок сворачивается в полоску, а звонящий получает ответ: «В игре, перезвоню».'],
  ]],
  ['Честность', [
    ['fair', '«Честная игра»', 'Erbium подтверждает серверу игры, что система не изменена. Античит не лезет в ядро и не получает ни IMEI, ни списка приложений.'],
    ['wallet', '«Кошелёк на замке»', 'Каждая покупка в игре — только по отпечатку, через Erbium. Месячный лимит и счётчик «потрачено в этой игре».'],
  ]],
  ['Чувства', [
    ['ping', '«Чистый пинг»', 'Пока идёт игра, фоновые загрузки и обновления ждут. Пакеты идут «Двойным каналом» Claw G.'],
    ['pulse', '«Пульс»', 'Кольцо подсветки отвечает игре: мало здоровья — мигает красным. Умеет и SOS.'],
    ['recoil', '«Отдача»', 'Два мотора по оси X, по одному в каждой руке, — отдача от звука игры.'],
    ['steps', '«Шаги»', 'Частоты шагов поднимаются над шумом боя. Врага слышно раньше, чем видно.'],
  ]],
];

export function initTree(root, { onAll } = {}) {
  if (!root) return;
  const map = $('[data-tree-map]', root);
  const out = { branch: $('[data-tree-branch]', root), title: $('[data-tree-title]', root), text: $('[data-tree-text]', root), seen: $('[data-tree-seen]', root), total: $('[data-tree-total]', root) };
  const all = SKILLS.flatMap(([b, nodes]) => nodes.map((n) => [b, ...n]));
  map.innerHTML = `<div class="tree__branches">${SKILLS.map(([b, nodes]) => `
    <div class="tree__branch"><p class="tree__title">${b}</p>${nodes.map(([id, title]) => `<button class="tree__node" type="button" data-skill="${id}" aria-pressed="false">${title}</button>`).join('')}</div>`).join('')}</div>`;
  const seen = new Set();
  out.total.textContent = String(all.length);
  const pick = (id) => {
    const s = all.find((x) => x[1] === id);
    if (!s) return;
    $$('[data-skill]', map).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.skill === id)));
    $(`[data-skill="${id}"]`, map).classList.add('is-seen');
    seen.add(id);
    out.branch.textContent = s[0];
    out.title.textContent = s[2];
    out.text.textContent = s[3];
    out.seen.textContent = String(seen.size);
    if (seen.size === all.length) onAll?.();
  };
  map.addEventListener('click', (e) => { const b = e.target.closest('[data-skill]'); if (b) pick(b.dataset.skill); });
  pick('arena');
}
