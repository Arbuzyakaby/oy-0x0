/* =========================================================================
   Fyr Osmium X0 — описание 3D-модели: круглый титановый корпус 44 мм,
   вращающийся безель из осмиридия с делениями 0–F (шаг 22,5°), коронка-
   рубильник, колбы трития на 12/3/6/9, экран CamelOS 2.0, ремешок-петля
   и титановый браслет (по умолчанию спрятан). Внутри — плата с τρίτος 1
   и GFC 1, аккумулятор и катушка: state.explode разносит слои по оси
   циферблата. Два цвета: «Полярная ночь» и «Луч». Процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';

const MM = 0.001;
export const FYR_COLORS = {
  polarnatt: { case: 0x23262C, bezel: 0x3B4048, top: 0x1C1F25, strap: 0x0E1014, ink: '#F4F7FF', dim: '#7D8799', trit: '#3D7BFF', tritOn: 0x3D7BFF },
  stral: { case: 0xC6CAD0, bezel: 0xA6AAB2, top: 0xD3D6DB, strap: 0xD7DADF, ink: '#05070A', dim: '#59606C', trit: '#EAF2FF', tritOn: 0xDDE8FF },
};
export const HEX = '0123456789ABCDEF';
export const BEZEL_STEP = (Math.PI * 2) / 16;
export const SCREEN_MODES = ['face', 'intercept', 'safe', 'open', 'wiped', 'radar', 'morse', 'radio', 'caravan', 'beacon', 'halt', 'off'];
const CROWN_TRAVEL = 1.2 * MM;
// «Разлёт»: насколько каждый слой уходит по оси циферблата (мм, + — к стеклу)
const EXPLODE = {
  Glass: 17, Bezel: 12, Glow_12: 7, Glow_3: 7, Glow_6: 7, Glow_9: 7, Rehaut: 7, Screen: 6,
  ChipT: 2.5, ChipG: 2.5, Board: 0, Battery: -8, Coil: -15, Case: -24, Crown: -24, Caseback: -32,
};
const R_SCREEN = 16.8, R_BEZEL = 22.0;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---------- Безель: деления 0–F ---------- */

export function drawBezel(canvas, color = 'polarnatt') {
  const c = FYR_COLORS[color] || FYR_COLORS.polarnatt;
  const g = canvas.getContext('2d');
  const s = canvas.width, mid = s / 2;
  const k = s / (2 * R_BEZEL);           // пикселей на мм
  g.fillStyle = '#' + c.top.toString(16).padStart(6, '0');
  g.fillRect(0, 0, s, s);
  g.save();
  g.translate(mid, mid);
  g.fillStyle = c.ink;
  g.strokeStyle = c.dim;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(2.3 * k)}px "JetBrains Mono", ui-monospace, monospace`;
  for (let i = 0; i < 16; i++) {
    const a = i * BEZEL_STEP;
    g.save();
    g.rotate(a);
    if (i === 0) {
      // треугольник-метка вместо нуля, с тритиевой точкой
      g.fillStyle = c.trit;
      g.beginPath();
      g.moveTo(0, -19.4 * k); g.lineTo(-1.3 * k, -21.0 * k); g.lineTo(1.3 * k, -21.0 * k);
      g.closePath(); g.fill();
      g.fillStyle = c.ink;
    } else if (i > 4 && i < 12) {
      // нижняя половина — цифры развёрнуты, чтобы читались, как на дайверском безеле
      g.save();
      g.translate(0, -20.2 * k);
      g.rotate(Math.PI);
      g.fillText(HEX[i], 0, 0);
      g.restore();
    } else {
      g.fillText(HEX[i], 0, -20.2 * k);
    }
    // промежуточные риски
    g.lineWidth = 0.22 * k;
    g.beginPath();
    g.rotate(BEZEL_STEP / 2);
    g.moveTo(0, -19.5 * k); g.lineTo(0, -20.9 * k);
    g.stroke();
    g.restore();
  }
  g.restore();
}

/* ---------- Экран CamelOS 2.0 (до неё — Fyr OS 0) ---------- */

const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');

export function drawScreen(canvas, mode, st = {}) {
  const g = canvas.getContext('2d');
  const s = canvas.width, m = s / 2;
  const accent = st.accent || '#2F6BFF';
  const now = st.now ?? performance.now();
  g.fillStyle = '#000';
  g.fillRect(0, 0, s, s);
  if (mode === 'off') return;
  g.save();
  g.beginPath();
  g.arc(m, m, m, 0, Math.PI * 2);
  g.clip();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const mono = (px, w = 600) => `${w} ${px}px "JetBrains Mono", ui-monospace, monospace`;
  const sans = (px, w = 700) => `${w} ${px}px "Onest", system-ui, sans-serif`;

  // кольцо секунд — 60 точек, текущая горит
  const ring = (sec) => {
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle = i === sec ? accent : i % 5 === 0 ? 'rgba(244,247,255,.55)' : 'rgba(244,247,255,.18)';
      g.beginPath();
      g.arc(m + Math.cos(a) * m * 0.9, m + Math.sin(a) * m * 0.9, i % 5 === 0 ? s * 0.007 : s * 0.004, 0, Math.PI * 2);
      g.fill();
    }
  };

  if (mode === 'face' || mode === 'open') {
    const d = st.date || new Date();
    ring(d.getSeconds());
    g.fillStyle = '#F4F7FF';
    g.font = mono(s * 0.2, 700);
    g.fillText(hex2(d.getHours()), m, m - s * 0.11);
    g.fillStyle = accent;
    g.fillText(hex2(d.getMinutes()), m, m + s * 0.1);
    g.fillStyle = 'rgba(244,247,255,.55)';
    g.font = mono(s * 0.036, 500);
    g.fillText(`0x${hex2(d.getDate())}·${hex2(d.getMonth() + 1)}·${d.getFullYear().toString(16).toUpperCase()}`, m, m + s * 0.27);
    g.font = mono(s * 0.03, 500);
    g.fillText(mode === 'open' ? 'GFC 1 · ОТКРЫТО' : 'CAMELOS 2.0', m, m - s * 0.3);
    if (mode === 'open') {
      g.strokeStyle = accent;
      g.lineWidth = s * 0.008;
      g.beginPath();
      g.arc(m, m, m * 0.8, 0, Math.PI * 2);
      g.stroke();
    }
  } else if (mode === 'intercept') {
    const sig = '0x2556FA10290A6F';
    g.fillStyle = 'rgba(47,107,255,.08)';
    g.fillRect(0, 0, s, s);
    g.font = mono(s * 0.03, 500);
    g.fillStyle = 'rgba(127,164,255,.6)';
    for (let r = 0; r < 18; r++) {
      const off = ((now / 40) + r * 37) % (s * 1.4);
      g.fillText(sig, s * 1.2 - off, s * 0.06 + r * s * 0.055);
    }
    g.fillStyle = '#F4F7FF';
    g.font = sans(s * 0.11);
    g.fillText('fyr', m, m);
    g.font = mono(s * 0.032, 500);
    g.fillStyle = 'rgba(244,247,255,.7)';
    g.fillText('SIGNAL INTERCEPTED', m, m + s * 0.12);
  } else if (mode === 'safe') {
    const code = st.code || [];
    g.fillStyle = 'rgba(244,247,255,.55)';
    g.font = mono(s * 0.034, 500);
    g.fillText('GFC 1 · ВВЕДИТЕ КОД', m, m - s * 0.26);
    for (let i = 0; i < 3; i++) {
      const x = m + (i - 1) * s * 0.2;
      const filled = i < code.length;
      const cur = i === code.length;
      g.strokeStyle = cur ? accent : 'rgba(244,247,255,.25)';
      g.lineWidth = s * 0.006;
      g.strokeRect(x - s * 0.08, m - s * 0.1, s * 0.16, s * 0.2);
      g.fillStyle = filled ? '#F4F7FF' : cur ? accent : 'rgba(244,247,255,.2)';
      g.font = mono(s * 0.13, 700);
      g.fillText(filled ? code[i] : cur ? (st.digit ?? '0') : '·', x, m + s * 0.005);
    }
    g.fillStyle = 'rgba(244,247,255,.45)';
    g.font = mono(s * 0.03, 500);
    const tries = st.tries ?? 3;
    g.fillText(`попыток: ${tries}`, m, m + s * 0.24);
  } else if (mode === 'wiped') {
    g.fillStyle = '#F4F7FF';
    g.font = mono(s * 0.15, 700);
    g.fillText('0x00', m, m - s * 0.04);
    g.font = mono(s * 0.036, 500);
    g.fillStyle = accent;
    g.fillText('МЁРТВАЯ РУКА', m, m + s * 0.1);
    g.fillStyle = 'rgba(244,247,255,.6)';
    g.fillText('ключи стёрты', m, m + s * 0.16);
  } else if (mode === 'radar') {
    const a = (now / 1400) * Math.PI * 2;
    for (let r = 1; r <= 4; r++) {
      g.strokeStyle = 'rgba(127,164,255,.18)';
      g.lineWidth = s * 0.003;
      g.beginPath();
      g.arc(m, m, (m * 0.88 * r) / 4, 0, Math.PI * 2);
      g.stroke();
    }
    const grad = g.createConicGradient ? g.createConicGradient(a - 0.9, m, m) : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(47,107,255,0)');
      grad.addColorStop(0.14, 'rgba(47,107,255,.5)');
      grad.addColorStop(0.145, 'rgba(47,107,255,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(m, m, m * 0.88, 0, Math.PI * 2);
      g.fill();
    }
    for (const [bx, by, ba] of [[0.3, 0.32, 0.7], [-0.42, 0.1, 2.9], [0.12, -0.5, 4.6]]) {
      const da = ((a - ba) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const glow = Math.max(0.15, 1 - da / 3);
      g.fillStyle = `rgba(244,247,255,${glow})`;
      g.beginPath();
      g.arc(m + bx * m, m + by * m, s * 0.016, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(244,247,255,.75)';
    g.font = mono(s * 0.034, 600);
    g.fillText('ЧИСТЫЙ ЭФИР · 3 МЕТКИ', m, m + s * 0.38);
  } else if (mode === 'morse') {
    // «· · · — — — · · ·» бежит по краю экрана, текста нет
    const pat = [1, 0, 1, 0, 1, 0, 0, 3, 0, 3, 0, 3, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0];
    const turn = (now / 6000) * Math.PI * 2;
    let pos = 0;
    const unit = (Math.PI * 2) / 64;
    for (let rep = 0; rep < 2; rep++) {
      for (const p of pat) {
        if (p) {
          const a0 = turn + pos * unit;
          g.strokeStyle = accent;
          g.lineWidth = s * 0.03;
          g.lineCap = 'round';
          g.beginPath();
          g.arc(m, m, m * 0.86, a0, a0 + unit * (p === 3 ? 2.2 : 0.35));
          g.stroke();
        }
        pos += p === 3 ? 3 : 1;
      }
    }
    g.fillStyle = 'rgba(244,247,255,.25)';
    g.beginPath();
    g.arc(m, m, s * 0.02, 0, Math.PI * 2);
    g.fill();
  } else if (mode === 'caravan') {
    // «Караван»: часы в центре, телефон и ноутбук на орбите, по дуге бегут пакеты
    const a0 = now / 2600;
    const nodes = [['H1', -Math.PI / 2], ['KBOOK', Math.PI / 6], ['BUTTERFLY', Math.PI * 5 / 6]];
    g.strokeStyle = 'rgba(127,164,255,.22)';
    g.lineWidth = s * 0.004;
    g.beginPath();
    g.arc(m, m, m * 0.6, 0, Math.PI * 2);
    g.stroke();
    nodes.forEach(([name, a], i) => {
      const x = m + Math.cos(a) * m * 0.6, y = m + Math.sin(a) * m * 0.6;
      const t = (a0 + i / 3) % 1;
      g.fillStyle = accent;
      g.beginPath();
      g.arc(m + (x - m) * t, m + (y - m) * t, s * 0.012, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#F4F7FF';
      g.beginPath();
      g.arc(x, y, s * 0.03, 0, Math.PI * 2);
      g.fill();
      g.font = mono(s * 0.03, 600);
      g.fillStyle = 'rgba(244,247,255,.7)';
      g.fillText(name, x, y + s * 0.065);
    });
    g.fillStyle = accent;
    g.beginPath();
    g.arc(m, m - s * 0.03, s * 0.045, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(244,247,255,.75)';
    g.font = mono(s * 0.032, 600);
    g.fillText('КАРАВАН · 3 РЯДОМ', m, m + s * 0.1);
  } else if (mode === 'beacon') {
    // «Маяк»: ищем потерянный телефон — расходящиеся кольца и метры
    const t = (now / 1800) % 1;
    for (let k = 0; k < 3; k++) {
      const r = ((t + k / 3) % 1) * m * 0.88;
      g.strokeStyle = `rgba(47,107,255,${(1 - r / (m * 0.88)) * 0.7})`;
      g.lineWidth = s * 0.008;
      g.beginPath();
      g.arc(m, m, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = '#F4F7FF';
    g.font = mono(s * 0.15, 700);
    g.fillText('0x2A', m, m - s * 0.02);
    g.font = mono(s * 0.034, 600);
    g.fillStyle = 'rgba(244,247,255,.6)';
    g.fillText('МЕТРА · ТЕЛЕФОН', m, m + s * 0.1);
    g.fillStyle = accent;
    g.fillText('МАЯК', m, m - s * 0.22);
  } else if (mode === 'halt') {
    // «Привал»: все устройства замолкли разом
    g.fillStyle = '#F4F7FF';
    g.beginPath();
    g.arc(m, m - s * 0.05, s * 0.12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#000';
    g.beginPath();
    g.arc(m + s * 0.055, m - s * 0.09, s * 0.11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(244,247,255,.85)';
    g.font = mono(s * 0.04, 700);
    g.fillText('ПРИВАЛ', m, m + s * 0.15);
    g.fillStyle = 'rgba(244,247,255,.45)';
    g.font = mono(s * 0.028, 500);
    g.fillText('часы · телефон · ноутбук', m, m + s * 0.21);
  } else if (mode === 'radio') {
    g.strokeStyle = 'rgba(244,247,255,.85)';
    g.lineWidth = s * 0.012;
    g.lineCap = 'round';
    for (let i = 1; i <= 3; i++) {
      g.beginPath();
      g.arc(m, m + s * 0.04, s * 0.06 * i, -Math.PI * 0.8, -Math.PI * 0.2);
      g.stroke();
    }
    g.strokeStyle = accent;
    g.beginPath();
    g.moveTo(m - s * 0.2, m - s * 0.2); g.lineTo(m + s * 0.2, m + s * 0.16);
    g.stroke();
    g.fillStyle = '#F4F7FF';
    g.font = mono(s * 0.038, 600);
    g.fillText('РАДИО ОБЕСТОЧЕНО', m, m + s * 0.24);
  }
  g.restore();
}

/* ---------- Резервная модель (без GLB) ---------- */

function planarUV(geo, r, axisA = 'x', axisB = 'y') {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos[`get${axisA.toUpperCase()}`](i) + r) / (2 * r);
    uv[i * 2 + 1] = 1 - (pos[`get${axisB.toUpperCase()}`](i) + r) / (2 * r);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function buildFallback() {
  const std = (name, color, o = {}) => new THREE.MeshStandardMaterial({ name, color, roughness: 0.4, ...o });
  const mats = {
    Case: std('Case', 0x23262C, { metalness: 1, roughness: 0.32 }),
    Bezel: std('Bezel', 0x3B4048, { metalness: 1, roughness: 0.22 }),
    BezelTop: std('BezelTop', 0x1C1F25),
    Crown: std('Crown', 0x3B4048, { metalness: 1, roughness: 0.2 }),
    Screen: std('Screen', 0x020306),
    Rehaut: std('Rehaut', 0x0B0D12),
    Tritium: std('Tritium', 0x9FB8FF, { emissive: 0x3D7BFF, emissiveIntensity: 1 }),
    Glass: std('Glass', 0x0A0E16),
    Strap: std('Strap', 0x0E1014, { roughness: 0.7 }),
  };
  const root = new THREE.Group();
  root.name = 'FyrOsmium';
  const add = (geo, mat, name, parent = root) => {
    geo.scale(MM, MM, MM);
    const m = new THREE.Mesh(geo, mats[mat]);
    m.name = name;
    parent.add(m);
    return m;
  };
  const lathe = (pts, seg = 96) => {
    const g = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), seg);
    g.rotateX(Math.PI / 2);   // ось вращения — Z (к зрителю)
    return g;
  };
  add(lathe([[18.9, 3.4], [21, 3.4], [21.6, 2.8], [21.8, 1], [21.6, -1.8], [20.8, -3.4], [17, -5.2], [0.01, -6.2]]), 'Case', 'Case');
  for (const sy of [1, -1]) for (const sx of [1, -1]) {
    const lug = new THREE.BoxGeometry(3.2, 9.4, 6.2);
    lug.translate(sx * 12.6, sy * 21.6, -0.5);
    add(lug, 'Case', null);
  }
  const bezel = new THREE.Group();
  bezel.name = 'Bezel';
  root.add(bezel);
  add(new THREE.CylinderGeometry(22, 22, 1.8, 96, 1, true).rotateX(Math.PI / 2).translate(0, 0, 4.3), 'Bezel', null, bezel);
  const top = new THREE.RingGeometry(18.85, 21.5, 128, 1);
  planarUV(top, R_BEZEL);
  top.translate(0, 0, 5.5);
  add(top, 'BezelTop', 'BezelTopMesh', bezel);
  const scr = new THREE.CircleGeometry(R_SCREEN, 128);
  planarUV(scr, R_SCREEN);
  scr.translate(0, 0, 4.6);
  add(scr, 'Screen', 'Screen');
  add(new THREE.RingGeometry(R_SCREEN, 18.9, 128).translate(0, 0, 4.8), 'Rehaut', 'Rehaut');
  for (const [name, ang] of [['Glow_12', 90], ['Glow_3', 0], ['Glow_6', 270], ['Glow_9', 180]]) {
    const a = THREE.MathUtils.degToRad(ang);
    const p = new THREE.CapsuleGeometry(0.62, 1.5, 4, 8);
    p.rotateZ(a + Math.PI / 2);
    p.translate(Math.cos(a) * 17.75, Math.sin(a) * 17.75, 5.0);
    add(p, 'Tritium', name);
  }
  const crown = new THREE.Group();
  crown.name = 'Crown';
  crown.position.set(21.7 * MM, 0, 0.6 * MM);
  root.add(crown);
  add(new THREE.CylinderGeometry(3.2, 3.2, 3.4, 32).rotateZ(Math.PI / 2).translate(2.6, 0, 0), 'Crown', null, crown);
  for (const sy of [1, -1]) {
    const strap = new THREE.BoxGeometry(21.6, 40, 2.6);
    strap.translate(0, sy * 42, -0.2);
    add(strap, 'Strap', sy > 0 ? 'Strap' : null);
  }
  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createFyrOsmium() {
  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = scrCanvas.height = 768;
  const scrTex = new THREE.CanvasTexture(scrCanvas);
  scrTex.colorSpace = THREE.SRGBColorSpace;
  scrTex.flipY = false;
  scrTex.anisotropy = 4;
  const screenMat = new THREE.MeshStandardMaterial({
    name: 'Screen', color: 0x000000, roughness: 0.2, emissive: 0xffffff, emissiveMap: scrTex, emissiveIntensity: 1,
  });
  screenMat.toneMapped = false;

  const bezCanvas = document.createElement('canvas');
  bezCanvas.width = bezCanvas.height = 1024;
  const bezTex = new THREE.CanvasTexture(bezCanvas);
  bezTex.colorSpace = THREE.SRGBColorSpace;
  bezTex.flipY = false;
  bezTex.anisotropy = 8;
  const bezelTopMat = new THREE.MeshStandardMaterial({ name: 'BezelTop', map: bezTex, metalness: 0.55, roughness: 0.32 });

  const caseMat = new THREE.MeshPhysicalMaterial({ name: 'Case', color: FYR_COLORS.polarnatt.case, metalness: 1, roughness: 0.3, clearcoat: 0.3, envMapIntensity: 1.4 });
  const bezelMat = new THREE.MeshPhysicalMaterial({ name: 'Bezel', color: FYR_COLORS.polarnatt.bezel, metalness: 1, roughness: 0.2, envMapIntensity: 1.6 });
  const strapMat = new THREE.MeshStandardMaterial({ name: 'Strap', color: FYR_COLORS.polarnatt.strap, roughness: 0.72, metalness: 0 });
  const braceletMat = new THREE.MeshPhysicalMaterial({ name: 'Bracelet', color: FYR_COLORS.polarnatt.case, metalness: 1, roughness: 0.4, envMapIntensity: 1.4 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    name: 'Glass', color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.16,
    clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false, envMapIntensity: 1.6,
  });
  const tritMat = new THREE.MeshStandardMaterial({ name: 'Tritium', color: 0x9FB8FF, emissive: FYR_COLORS.polarnatt.tritOn, emissiveIntensity: 1, roughness: 0.3 });
  tritMat.toneMapped = false;

  const screen = { mode: 'intercept', code: [], digit: '0', tries: 3 };
  let color = 'polarnatt';
  let lastDraw = 0;
  const animated = () => ['intercept', 'radar', 'morse', 'face', 'open'].includes(screen.mode);
  function redrawScreen(now = performance.now()) {
    drawScreen(scrCanvas, screen.mode, { ...screen, now, accent: '#2F6BFF' });
    scrTex.needsUpdate = true;
    lastDraw = now;
  }
  drawBezel(bezCanvas, color);
  redrawScreen();

  const parts = { bezel: null, crown: null, crownBase: 0, strap: null, bracelet: null, layers: [] };
  let band = 'strap';
  let lastDark = -1;

  function setup(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const swap = (m) => {
        switch (m?.name) {
          case 'Case': return caseMat;
          case 'Crown': case 'Bezel': return bezelMat;
          case 'BezelTop': return bezelTopMat;
          case 'Screen': return screenMat;
          case 'Glass': return glassMat;
          case 'Tritium': return tritMat;
          case 'Strap': return strapMat;
          case 'Bracelet': return braceletMat;
          case 'BraceletPol': return bezelMat;
          case 'Stitch': {
            const s = m.clone();
            s.color.set(0x2F6BFF);
            return s;
          }
          default: return m;
        }
      };
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
      if (o.name === 'Glass' || o.parent?.name === 'Glass') o.renderOrder = 2;
    });
    parts.bezel = root.getObjectByName('Bezel');
    parts.crown = root.getObjectByName('Crown');
    parts.crownBase = parts.crown ? parts.crown.position.x : 0;
    parts.strap = root.getObjectByName('Strap');
    parts.bracelet = root.getObjectByName('Bracelet');
    parts.layers = Object.entries(EXPLODE).map(([n, mm]) => {
      const o = root.getObjectByName(n);
      return o && { o, z: o.position.z, d: mm * MM };
    }).filter(Boolean);
    applyBand();
    applyColor();
  }

  function applyBand() {
    if (parts.strap) parts.strap.visible = band === 'strap';
    if (parts.bracelet) parts.bracelet.visible = band === 'bracelet';
  }

  function applyColor() {
    const c = FYR_COLORS[color];
    caseMat.color.setHex(c.case);
    braceletMat.color.setHex(c.case);
    bezelMat.color.setHex(c.bezel);
    strapMat.color.setHex(c.strap);
    tritMat.emissive.setHex(c.tritOn);
    drawBezel(bezCanvas, color);
    bezTex.needsUpdate = true;
    lastDark = -1;
  }

  function update(cur, dt, { reduced }) {
    const now = performance.now();
    // против часовой: под меткой на 12 встаёт цифра номер cur.bezel
    if (parts.bezel) parts.bezel.rotation.z = cur.bezel * BEZEL_STEP;
    if (parts.crown) parts.crown.position.x = parts.crownBase - clamp01(cur.crown) * CROWN_TRAVEL;
    // слои уходят по оси циферблата; ремешок и браслет на это время прячутся
    const ex = clamp01(cur.explode);
    for (const l of parts.layers) l.o.position.z = l.z + l.d * ex;
    if (parts.strap) parts.strap.visible = band === 'strap' && ex < 0.04;
    if (parts.bracelet) parts.bracelet.visible = band === 'bracelet' && ex < 0.04;
    screenMat.emissiveIntensity = clamp01(cur.screen) * 1.05;
    // тритий светится всегда; в темноте — ярче, с медленным дыханием
    const breath = reduced ? 1 : 0.92 + 0.08 * Math.sin(now / 900);
    tritMat.emissiveIntensity = (0.7 + clamp01(cur.dark) * 3.5) * breath;
    // «Темно»: корпус, безель и ремешок уходят в тень, светятся только колбы
    const d = clamp01(cur.dark);
    if (Math.abs(d - lastDark) > 0.002) {
      lastDark = d;
      const c = FYR_COLORS[color];
      const k = 1 - 0.88 * d;
      caseMat.color.setHex(c.case).multiplyScalar(k);
      bezelMat.color.setHex(c.bezel).multiplyScalar(k);
      strapMat.color.setHex(c.strap).multiplyScalar(k);
      braceletMat.color.setHex(c.case).multiplyScalar(k);
      bezelTopMat.color.setScalar(k);
      for (const m of [caseMat, bezelMat, bezelTopMat, screenMat, glassMat, braceletMat]) m.envMapIntensity = (m.userData.env ??= m.envMapIntensity) * k;
    }
    if (animated() && now - lastDraw > (screen.mode === 'face' ? 500 : 33)) redrawScreen(now);
  }

  return {
    url: '/models/fyrosmium.glb?v=3823fcc8e7',
    state: { bezel: 0, crown: 0, screen: 1, dark: 0, explode: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap: applyColor,
    api: {
      setBodyColor(name) { if (FYR_COLORS[name]) { color = name; applyColor(); } },
      setBand(name) { band = name === 'bracelet' ? 'bracelet' : 'strap'; applyBand(); },
      setScreen(mode, extra = {}) {
        screen.mode = SCREEN_MODES.includes(mode) ? mode : 'face';
        Object.assign(screen, extra);
        redrawScreen();
      },
      redrawScreen,
    },
  };
}
