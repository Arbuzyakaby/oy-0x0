/* =========================================================================
   OY 0X Nova — описание 3D-модели: экран-водопад, матовое стекло
   «Сверхновая», титановая рамка, остров «Обсерватории» с пятью камерами
   (у каждой своё кольцо подсветки), лазерный автофокус и спектральный
   датчик, OY 0Pen в слоте (выезжает вниз), фонарь на верхней грани,
   экран с режимами OY OS 4 и процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, SIGNAL_COLORS, roundRect, rrShape, slab, boxG, cylZ, makeBeam } from './oy0x0.js';
import { frostTexture, shadeTexture } from './oy0x1.js';

export const NOVA_COLORS = {
  supernova: { body: 0xC9A46E, frame: 0xC7A677, ring: 0xD9BC8E, pen: 0xC9A46E, rough: 0.46, accent: '#F4C978' },
};

// Геометрия (мм) — как в blender/build_oynova.py
const W = 77.2, H = 164.8, D = 7.6, R = 7.0;
const SW = 75.4, SH = 163.0;
export const SIGNAL_Y = 0.08258;          // м, поверх фонаря на верхней грани
const PEN_TRAVEL = 0.124;                 // м, перо выходит из слота целиком
export const CAMS = ['ultra', 'main', 'tele', 'peri', 'mono'];
export const SCREEN_MODES = ['lock', 'camera', 'pen', 'blocked', 'off'];
// Шкала «Обсерватории»: какая камера снимает на каком зуме
export const ZOOM_STOPS = [
  { cam: 'ultra', label: '0,6×' },
  { cam: 'main', label: '1×' },
  { cam: 'tele', label: '3×' },
  { cam: 'peri', label: '6–14×' },
  { cam: 'mono', label: 'Mono' },
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---------- Экран (OY OS 4) ---------- */

// Звёзды для обоев и видоискателя — одни и те же, детерминированные
const STARS = (() => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return Array.from({ length: 260 }, () => ({ x: rnd(), y: rnd(), r: 0.6 + rnd() * rnd() * 3.2, a: 0.35 + rnd() * 0.65, t: rnd() }));
})();

function sky(g, w, h, { zoom = 1, cx = 0.62, cy = 0.3, mono = false } = {}) {
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, mono ? '#0B0B0B' : '#0A0B1E');
  bg.addColorStop(0.6, mono ? '#050505' : '#06060F');
  bg.addColorStop(1, '#020203');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  // туманность вокруг новой звезды
  const neb = g.createRadialGradient(w * cx, h * cy, 0, w * cx, h * cy, w * 0.9 * Math.min(zoom, 3));
  neb.addColorStop(0, mono ? 'rgba(220,220,220,.32)' : 'rgba(244,201,120,.38)');
  neb.addColorStop(0.35, mono ? 'rgba(120,120,120,.12)' : 'rgba(150,90,200,.16)');
  neb.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = neb;
  g.fillRect(0, 0, w, h);
  for (const s of STARS) {
    const x = w * cx + (s.x - cx) * w * zoom;
    const y = h * cy + (s.y - cy) * h * zoom;
    if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
    g.globalAlpha = s.a;
    g.fillStyle = mono ? '#FFFFFF' : s.t > 0.8 ? '#FFD9A0' : s.t < 0.15 ? '#B8C8FF' : '#FFFFFF';
    g.beginPath();
    g.arc(x, y, s.r * Math.sqrt(zoom), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // сама Nova
  const nr = 7 * Math.sqrt(zoom);
  const core = g.createRadialGradient(w * cx, h * cy, 0, w * cx, h * cy, nr * 6);
  core.addColorStop(0, '#FFFFFF');
  core.addColorStop(0.18, mono ? '#EDEDED' : '#FFE7B0');
  core.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = core;
  g.beginPath();
  g.arc(w * cx, h * cy, nr * 6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = mono ? 'rgba(255,255,255,.5)' : 'rgba(255,231,176,.55)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(w * cx - nr * 5, h * cy); g.lineTo(w * cx + nr * 5, h * cy);
  g.moveTo(w * cx, h * cy - nr * 5); g.lineTo(w * cx, h * cy + nr * 5);
  g.stroke();
}

function statusBar(g, w, ink) {
  g.fillStyle = ink;
  g.font = '600 28px "Onest", system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText('21:47', 46, 62);
  g.textAlign = 'right';
  g.font = '600 24px "JetBrains Mono", ui-monospace, monospace';
  g.fillText('5G', w - 110, 62);
  roundRect(g, w - 92, 50, 46, 24, 7);
  g.strokeStyle = ink; g.lineWidth = 2.5; g.stroke();
  g.fillRect(w - 88, 54, 30, 16);
}

export function drawNovaScreen(canvas, mode, { zoom = 1, stop = 1, accent = NOVA_COLORS.supernova.accent } = {}) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const sans = '"Onest", system-ui, sans-serif';
  const mono = '"JetBrains Mono", ui-monospace, monospace';
  g.clearRect(0, 0, w, h);
  g.textBaseline = 'middle';

  if (mode === 'off') {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    return;
  }

  if (mode === 'camera') {
    const isMono = ZOOM_STOPS[stop]?.cam === 'mono';
    sky(g, w, h, { zoom, cy: 0.42, mono: isMono });
    // рамка кадра и сетка
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5;
    for (const f of [1 / 3, 2 / 3]) {
      g.beginPath(); g.moveTo(w * f, 140); g.lineTo(w * f, h - 330); g.stroke();
      g.beginPath(); g.moveTo(0, 140 + (h - 470) * f); g.lineTo(w, 140 + (h - 470) * f); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(0, 0, w, 130);
    g.fillRect(0, h - 330, w, 330);
    g.fillStyle = '#F2F2F0';
    g.font = `600 22px ${mono}`;
    g.textAlign = 'left';
    g.fillText('RAW · 10-бит', 40, 70);
    g.textAlign = 'right';
    g.fillText(isMono ? 'f/1.8 · Mono' : `f/${stop === 1 ? '1.4' : '2.0'} · 4K/120`, w - 40, 70);
    // рамка фокуса лазера
    g.strokeStyle = accent; g.lineWidth = 3;
    const fx = w * 0.62, fy = h * 0.42, fs = 70;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      g.beginPath();
      g.moveTo(fx + sx * fs, fy + sy * (fs - 22)); g.lineTo(fx + sx * fs, fy + sy * fs); g.lineTo(fx + sx * (fs - 22), fy + sy * fs);
      g.stroke();
    }
    // шкала зума
    const n = ZOOM_STOPS.length, pw = 92, gap = 12;
    const x0 = (w - (n * pw + (n - 1) * gap)) / 2;
    ZOOM_STOPS.forEach((z, i) => {
      roundRect(g, x0 + i * (pw + gap), h - 290, pw, 54, 27);
      g.fillStyle = i === stop ? accent : 'rgba(255,255,255,.12)';
      g.fill();
      g.fillStyle = i === stop ? '#1A1206' : '#F2F2F0';
      g.font = `700 ${z.label.length > 4 ? 18 : 22}px ${sans}`;
      g.textAlign = 'center';
      g.fillText(z.label, x0 + i * (pw + gap) + pw / 2, h - 263);
    });
    // спуск
    g.beginPath(); g.arc(w / 2, h - 140, 62, 0, Math.PI * 2);
    g.fillStyle = '#F2F2F0'; g.fill();
    g.beginPath(); g.arc(w / 2, h - 140, 72, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(242,242,240,.7)'; g.lineWidth = 4; g.stroke();
    return;
  }

  if (mode === 'pen') {
    // заметка 0Pen поверх погасшего экрана
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    statusBar(g, w, 'rgba(242,242,240,.6)');
    g.strokeStyle = '#F4D79C'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
    const pts = [[120, 360], [230, 300], [330, 380], [420, 290], [490, 420]];
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.fillStyle = '#FFF4D8';
    for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); }
    g.font = `italic 500 46px ${sans}`;
    g.textAlign = 'left';
    g.fillStyle = '#F4D79C';
    g.fillText('Кассиопея —', 80, 560);
    g.fillText('снять в 23:10', 80, 624);
    g.font = `500 22px ${mono}`;
    g.fillStyle = 'rgba(242,242,240,.5)';
    g.fillText('Заметка 0Pen · зашифрована в Citadel', 80, 720);
    return;
  }

  sky(g, w, h, { zoom: 1 });
  statusBar(g, w, '#F2F2F0');

  if (mode === 'blocked') {
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fillRect(0, 0, w, h);
    roundRect(g, 60, 420, w - 120, 470, 44);
    g.fillStyle = 'rgba(20,18,14,.92)'; g.fill();
    g.strokeStyle = 'rgba(244,201,120,.4)'; g.lineWidth = 2; g.stroke();
    g.textAlign = 'center';
    g.fillStyle = accent;
    g.font = `700 42px ${sans}`;
    g.fillText('Nova не играет.', w / 2, 520);
    g.fillStyle = 'rgba(242,242,240,.75)';
    g.font = `400 26px ${sans}`;
    g.fillText('Игры на этом телефоне', w / 2, 600);
    g.fillText('не запускаются.', w / 2, 638);
    roundRect(g, 110, 720, w - 220, 84, 42);
    g.fillStyle = '#F2F2F0'; g.fill();
    g.fillStyle = '#111';
    g.font = `700 26px ${sans}`;
    g.fillText('Для игр — eXtream Y1', w / 2, 762);
    return;
  }

  // экран блокировки
  g.textAlign = 'center';
  g.fillStyle = '#F2F2F0';
  g.font = `700 186px ${sans}`;
  g.fillText('21:47', w / 2, 300);
  g.font = `500 30px ${sans}`;
  g.fillStyle = 'rgba(242,242,240,.7)';
  g.fillText('Пятница, 16 октября', w / 2, 410);
  roundRect(g, 60, 960, w - 120, 150, 34);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.fill();
  g.textAlign = 'left';
  g.fillStyle = '#F2F2F0';
  g.font = `600 28px ${sans}`;
  g.fillText('Ясно, видимость 9 из 10', 96, 1010);
  g.font = `400 22px ${mono}`;
  g.fillStyle = 'rgba(242,242,240,.55)';
  g.fillText('Луна зайдёт в 23:40 · хорошее небо', 96, 1060);
  g.textAlign = 'center';
  g.font = `500 22px ${mono}`;
  g.fillStyle = accent;
  g.fillText('OY OS 4 · Citadel 4 Plus', w / 2, 1180);
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const mats = {
    Body: new THREE.MeshPhysicalMaterial({ name: 'Body', color: 0xC9A46E, roughness: 0.45, clearcoat: 1 }),
    Frame: new THREE.MeshStandardMaterial({ name: 'Frame', color: 0xC7A677, metalness: 1, roughness: 0.3 }),
    Glass: new THREE.MeshPhysicalMaterial({ name: 'Glass', color: 0x030304, roughness: 0.05, clearcoat: 1 }),
    Screen: new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x020203, roughness: 0.18 }),
    CamPlate: new THREE.MeshPhysicalMaterial({ name: 'CamPlate', color: 0xB8945E, metalness: 0.35, roughness: 0.1, clearcoat: 1 }),
    Lens: new THREE.MeshPhysicalMaterial({ name: 'Lens', color: 0x030304, roughness: 0.08, clearcoat: 1 }),
    LensRim: new THREE.MeshStandardMaterial({ name: 'LensRim', color: 0xB89A70, metalness: 1, roughness: 0.22 }),
    LensGlow: new THREE.MeshStandardMaterial({ name: 'LensGlow', color: 0x0A0A0C, emissive: 0xFFE3A8, emissiveIntensity: 0 }),
    Laser: new THREE.MeshPhysicalMaterial({ name: 'Laser', color: 0x1A0507, roughness: 0.05, clearcoat: 1 }),
    Spectral: new THREE.MeshPhysicalMaterial({ name: 'Spectral', color: 0x0D0A1A, roughness: 0.05, clearcoat: 1 }),
    Flash: new THREE.MeshStandardMaterial({ name: 'Flash', color: 0xF3EAD6, emissive: 0xFFF4DD, emissiveIntensity: 0.15 }),
    SignalLightGlow: new THREE.MeshStandardMaterial({ name: 'SignalLightGlow', color: 0xEDEDED, emissive: 0xFFFFFF, emissiveIntensity: 0.4 }),
    Pen: new THREE.MeshStandardMaterial({ name: 'Pen', color: 0xC9A46E, metalness: 0.35, roughness: 0.4 }),
    Dark: new THREE.MeshStandardMaterial({ name: 'Dark', color: 0x0B0B0C, roughness: 0.6 }),
  };
  const root = new THREE.Group();
  root.name = 'OYNova';
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };
  const group = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); return g; };

  add(slab(W, H, R, D - 1.2, 0.5, 12), 'Frame', 0, 0, 0, 'Frame');
  add(slab(W - 0.3, H - 0.3, R - 0.2, 0.6, 0.25, 12), 'Body', 0, 0, -D / 2 + 0.3, 'Body');
  add(slab(W - 0.3, H - 0.3, R - 0.2, 0.6, 0.25, 12), 'Glass', 0, 0, D / 2 - 0.3, 'Glass');
  const scr = new THREE.ShapeGeometry(rrShape(SW, SH, R - 0.9), 12);
  const pos = scr.attributes.position, uv = scr.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + SW / 2) / SW, 1 - (pos.getY(i) + SH / 2) / SH);
  add(scr.scale(MM, MM, MM), 'Screen', 0, 0, D / 2 + 0.03, 'Screen');
  add(cylZ(1.5, 0.05, 32), 'Dark', 0, SH / 2 - 4.6, D / 2 + 0.06, 'FrontCam');

  // остров: со спины слева сверху (в three.js — +X со стороны экрана справа, со спины слева)
  const ix = W / 2 - 5.2 - 15.5, iy = H / 2 - 5.2 - 25;
  const isl = new THREE.ExtrudeGeometry(rrShape(31, 50, 6), { depth: 2.4, bevelEnabled: false, curveSegments: 10 });
  isl.scale(MM, MM, MM);
  isl.rotateY(Math.PI);
  add(isl, 'Frame', ix, iy, -D / 2, 'CamIsland');
  const out = ix + 7.4, inn = ix - 8;
  const cam = (name, key, x, y, r) => {
    const g = group(name);
    add(cylZ(r + 0.9, 0.5, 64), 'LensRim', x, y, -D / 2 - 2.6, null, g);
    add(cylZ(r, 0.52, 64), 'Lens', x, y, -D / 2 - 2.62, null, g);
    add(cylZ(r + 1.3, 0.04, 64), 'LensGlow', x, y, -D / 2 - 2.42, `Glow_${key}`);
  };
  cam('UltraCam', 'ultra', out, iy + 16, 5.2);
  cam('MainCam', 'main', out, iy, 6.7);
  cam('TeleCam', 'tele', inn, iy + 16.4, 4.2);
  cam('MonoCam', 'mono', inn, iy + 4.4, 4.2);
  const peri = group('Periscope');
  add(boxG(12.2, 12.2, 0.5), 'LensRim', out, iy - 16.2, -D / 2 - 2.6, null, peri);
  add(boxG(10.6, 10.6, 0.52), 'Lens', out, iy - 16.2, -D / 2 - 2.62, null, peri);
  add(boxG(13.4, 13.4, 0.04), 'LensGlow', out, iy - 16.2, -D / 2 - 2.42, 'Glow_peri');
  add(cylZ(1.5, 0.2, 32), 'Laser', inn, iy - 4.6, -D / 2 - 2.5, 'LaserAF');
  add(cylZ(2.1, 0.2, 32), 'Flash', inn, iy - 10.6, -D / 2 - 2.5, 'Flash');
  add(cylZ(1.2, 0.2, 32), 'Spectral', inn, iy - 16.2, -D / 2 - 2.5, 'Spectral');

  const sl = add(boxG(11, 0.2, 1.5), 'SignalLightGlow', 0, H / 2 + 0.05, 0, 'SignalLight');
  sl.geometry.translate(0, 0, 0);
  const pen = group('Pen');
  pen.position.set(-27 * MM, -H / 2 * MM, -0.3 * MM);
  const pg = new THREE.CylinderGeometry(2.3, 2.3, 118, 24);
  pg.translate(0, 59, 0);
  pg.scale(MM, MM, MM);
  pen.add(new THREE.Mesh(pg, mats.Pen));
  add(boxG(0.5, 11, 1.8), 'Frame', W / 2 + 0.2, 16, 0, 'PowerButton');
  add(boxG(0.5, 21, 1.8), 'Frame', W / 2 + 0.2, 40, 0, 'VolumeRocker');
  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOYNova({ phone, scale, isRunning }) {
  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, SIGNAL_Y * scale + 0.004, 0);
  glow.position.set(0, SIGNAL_Y * scale + 0.01, 0);
  phone.add(beam, glow);

  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = 600; scrCanvas.height = 1300;
  const scrTex = new THREE.CanvasTexture(scrCanvas);
  scrTex.colorSpace = THREE.SRGBColorSpace;
  scrTex.flipY = false;
  scrTex.anisotropy = 4;
  const screenMat = new THREE.MeshStandardMaterial({
    name: 'Screen', color: 0x000000, roughness: 0.22, metalness: 0,
    emissive: 0xffffff, emissiveMap: scrTex, emissiveIntensity: 1,
  });
  screenMat.toneMapped = false;

  const screen = { mode: 'lock', zoom: 1, stop: 1 };
  function redrawScreen() {
    drawNovaScreen(scrCanvas, screen.mode, { zoom: screen.zoom, stop: screen.stop });
    scrTex.needsUpdate = true;
  }
  redrawScreen();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    name: 'Body', color: NOVA_COLORS.supernova.body, metalness: 0.18, roughness: 0.46,
    map: shadeTexture(), clearcoat: 1, clearcoatRoughness: 0.12, specularIntensity: 1,
    sheen: 0.4, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xFFF1D6),
    bumpMap: frostTexture(), bumpScale: 0.45, envMapIntensity: 1.5,
  });
  const ringMat = new THREE.MeshPhysicalMaterial({
    name: 'Ring', color: NOVA_COLORS.supernova.ring, metalness: 1, roughness: 0.18,
    clearcoat: 0.6, clearcoatRoughness: 0.05, envMapIntensity: 1.6,
  });
  const tint = (hex, { rough = 0.1, metal = 0, env = 0.9 } = {}) => new THREE.MeshPhysicalMaterial({
    color: hex, metalness: metal, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: env,
  });
  const lensMats = {
    Lens: tint(0x060912, { rough: 0.04, env: 1.4 }),
    LensRing: tint(0x16181C, { rough: 0.2, metal: 0.6 }),
    LensInner: tint(0x14203A, { rough: 0.12, metal: 0.3, env: 1.2 }),
  };

  const parts = { pen: null, penBase: 0, glow: {}, laser: null, spectral: null, flash: null, signalMat: null, frame: null, penMat: null };
  const glowColor = new THREE.Color(NOVA_COLORS.supernova.accent);
  const laserColor = new THREE.Color(0xFF2A2A);
  const spectralColor = new THREE.Color();
  const signalTarget = new THREE.Color(0xffffff);
  const signalCur = new THREE.Color(0xffffff);

  function setup(root) {
    const byName = {};
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (m && m.name && !byName[m.name]) byName[m.name] = m;
      const swap = (m) => (m?.name === 'Body' ? bodyMat : m?.name === 'Screen' ? screenMat : lensMats[m?.name] || m);
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
    root.getObjectByName('CamIsland')?.traverse((o) => { if (o.isMesh) o.material = ringMat; });
    parts.frame = byName.Frame || null;
    if (parts.frame) { parts.frame.metalness = 1; parts.frame.roughness = 0.26; parts.frame.envMapIntensity = 1.3; }
    if (byName.LensRim) { byName.LensRim.metalness = 1; byName.LensRim.roughness = 0.2; }
    parts.penMat = byName.Pen || null;
    parts.signalMat = byName.SignalLightGlow || null;
    if (parts.signalMat) { parts.signalMat.emissive = new THREE.Color(0xffffff); parts.signalMat.emissiveIntensity = 0.3; }
    if (byName.CamPlate) {
      const m = byName.CamPlate;
      // стекло острова — в тон корпуса, глянцевое, как у Note
      m.color.set(0xB8945E); m.metalness = 0.35; m.roughness = 0.1; m.envMapIntensity = 1.5;
      if ('clearcoat' in m) { m.clearcoat = 1; m.clearcoatRoughness = 0.02; }
    }
    // у каждого кольца подсветки — свой материал
    for (const key of CAMS) {
      const g = root.getObjectByName(`Glow_${key}`);
      let mat = null;
      g?.traverse((o) => {
        if (!o.isMesh) return;
        o.material = new THREE.MeshStandardMaterial({ color: 0x0A0A0C, roughness: 0.3, emissive: glowColor.clone(), emissiveIntensity: 0 });
        o.material.toneMapped = false;
        mat = o.material;
      });
      parts.glow[key] = mat;
    }
    const own = (name) => {
      let mat = null;
      root.getObjectByName(name)?.traverse((o) => {
        if (!o.isMesh) return;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        o.material = list.map((m) => {
          if (m.name !== 'Laser' && m.name !== 'Spectral' && m.name !== 'Flash') return m;
          const c = m.clone();
          c.emissive = new THREE.Color(0x000000);
          c.toneMapped = false;
          mat = c;
          return c;
        });
        if (o.material.length === 1) o.material = o.material[0];
      });
      return mat;
    };
    parts.laser = own('LaserAF');
    parts.spectral = own('Spectral');
    parts.flash = own('Flash');
    parts.pen = root.getObjectByName('Pen');
    parts.penBase = parts.pen ? parts.pen.position.y : 0;
    applyColorsInstant();
  }

  function applyColorsInstant() {
    const c = NOVA_COLORS.supernova;
    bodyMat.color.setHex(c.body);
    ringMat.color.setHex(c.ring);
    if (parts.frame) parts.frame.color.setHex(c.frame);
    if (parts.penMat) parts.penMat.color.setHex(c.pen);
    signalCur.copy(signalTarget);
  }

  function update(cur, dt, { reduced }) {
    const now = performance.now();
    const k = reduced ? 1 : 1 - Math.exp(-dt * 6);
    signalCur.lerp(signalTarget, k);

    // Экран
    screenMat.emissiveIntensity = screen.mode === 'off' ? 0 : 0.25 + clamp01(cur.screen) * 0.9;

    // 0Pen выезжает из слота вниз
    if (parts.pen) parts.pen.position.y = parts.penBase - clamp01(cur.pen) * PEN_TRAVEL;

    // Подсветка камер
    for (const key of CAMS) {
      const m = parts.glow[key];
      if (m) m.emissiveIntensity = clamp01(cur[`g_${key}`]) * 5;
    }
    const pulse = reduced ? 1 : 0.6 + 0.4 * Math.sin(now / 140);
    if (parts.laser) { parts.laser.emissive.copy(laserColor); parts.laser.emissiveIntensity = clamp01(cur.laser) * 2.4 * pulse; }
    if (parts.spectral) {
      spectralColor.setHSL(reduced ? 0.75 : (now / 2400) % 1, 0.9, 0.55);
      parts.spectral.emissive.copy(spectralColor);
      parts.spectral.emissiveIntensity = clamp01(cur.spectral) * 2.2;
    }
    if (parts.flash) { parts.flash.emissive.setHex(0xFFF4DD); parts.flash.emissiveIntensity = 0.15 + clamp01(cur.flash) * 6; }

    // Фонарь на верхней грани; sos — «· · · — — — · · ·» от Citadel 4 Plus
    let sig = clamp01(cur.signal);
    const sos = clamp01(cur.sos);
    if (sos > 0.01) {
      const t = (now / 180) % 34;
      const on = [0, 2, 4, 8, 12, 16, 20, 22, 24].some((s, idx) => t >= s && t < s + (idx >= 3 && idx <= 5 ? 3 : 1));
      sig = Math.max(sig, sos * (reduced ? 0.8 : on ? 1 : 0.04));
    }
    if (parts.signalMat) {
      // красный не выгорает в белый: у насыщенного цвета пик ниже, рассеиватель — в цвет света
      parts.signalMat.color.copy(signalCur).multiplyScalar(0.93);
      parts.signalMat.emissive.copy(signalCur);
      parts.signalMat.emissiveIntensity = 0.25 + sig * (1.2 + 7.8 * signalCur.g * signalCur.g);
    }
    beamMat.uniforms.uIntensity.value = sig;
    beamMat.uniforms.uColor.value.copy(signalCur);
    beam.visible = sig > 0.002;
    glow.material.opacity = sig;
    glow.material.color.copy(signalCur);
    glow.visible = sig > 0.002;
  }

  return {
    url: '/models/oynova.glb?v=fd520d2bf5',
    state: { pen: 0, signal: 0, sos: 0, screen: 1, laser: 0, spectral: 0, flash: 0, g_ultra: 0, g_main: 0, g_tele: 0, g_peri: 0, g_mono: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap: applyColorsInstant,
    api: {
      setBodyColor() { applyColorsInstant(); },
      setSignalColor(name, instant = false) {
        signalTarget.setHex(SIGNAL_COLORS[name] || SIGNAL_COLORS.white);
        if (instant || !isRunning()) signalCur.copy(signalTarget);
      },
      // режим экрана: lock · camera · pen · blocked · off; для камеры — зум видоискателя и номер камеры
      setScreen(mode, { zoom = screen.zoom, stop = screen.stop } = {}) {
        const m = SCREEN_MODES.includes(mode) ? mode : 'lock';
        const z = Math.round(zoom * 20) / 20;
        if (m === screen.mode && z === screen.zoom && stop === screen.stop) return;
        Object.assign(screen, { mode: m, zoom: z, stop });
        redrawScreen();
      },
      redrawScreen,
    },
  };
}
