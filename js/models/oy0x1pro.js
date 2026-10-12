/* =========================================================================
   OY 0X1 Pro — описание 3D-модели: матовая стеклянная спинка с переливом,
   титановая рамка и стеклянные грани, «шайба» камер в полированном кольце,
   кнопки «0» и «1» с фиксацией, антенны Claw 2.0, сигнальный фонарь с SOS,
   разлёт по слоям с Citadel 2, испарительной камерой и катушкой XMagnum,
   экран и процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, SIGNAL_COLORS, roundRect, drawScreen, rrShape, slab, boxG, cylZ, labelTexture, drawChip, makeBeam } from './oy0x0.js';
import { frostTexture, shadeTexture } from './oy0x1.js';

export const OXP_COLORS = {
  obsidian: { body: 0x1A1B1F, frame: 0x34353A, ring: 0xA4A7AD, glass: 0xD5D8DE, key: 0xFF6A1F, rough: 0.4, accent: '#C9D1DC' },
  titan: { body: 0x9C9587, frame: 0xB6AE9F, ring: 0xD6CEBD, glass: 0xEEEAE2, key: 0xFF6A1F, rough: 0.44, accent: '#E3CFA6' },
  cobalt: { body: 0x16306A, frame: 0x2B416E, ring: 0xAEB9CE, glass: 0xC9D7F0, key: 0xFF6A1F, rough: 0.4, accent: '#7FA6FF' },
};

const KEYS_CARD = { title: 'Citadel 2 · кнопки «0» и «1»', sub: 'сторож: система проверена', dots: 2 };
const KEY_TRAVEL = 0.0004;      // м, нажатие
const LOCK_TRAVEL = 0.0009;     // м, фиксация в аппаратном режиме
const SIGNAL_Y = 0.0821;
const KEY_Y = [44, 30];
const ANTENNA_Y = [70, 60, -60, -70];

// Разлёт по слоям (м, вдоль оси Z модели: + к экрану, − к спинке)
const LAYER_OFFSET = { glass: 0.056, screen: 0.034, frame: 0, vapor: -0.016, board: -0.03, citadel: -0.046, battery: -0.062, coil: -0.078, back: -0.096 };
const LAYER_BY_NAME = {
  Glass: 'glass', FrontPill: 'glass', Screen: 'screen',
  Body: 'back', CamIsland: 'back', CamPlate: 'back', RingScale: 'back', MainCam: 'back', CameraModules: 'back', Periscope: 'back', EngraveX: 'back', Flash: 'back',
  Vapor: 'vapor', Board: 'board', Citadel: 'citadel', Battery: 'battery', Coil: 'coil',
};

/* ---------- Внутренности: испарительная камера, плата, Citadel 2, аккумулятор, катушка ---------- */

function buildInternals({ citadelGlow, vaporGlow, coilGlow }) {
  const boardTex = labelTexture(640, 560, (g, w, h) => {
    g.fillStyle = '#0D1214'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,190,210,.16)'; g.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const y = 20 + i * 22;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w * (0.2 + (i % 5) * 0.12), y); g.lineTo(w * (0.26 + (i % 5) * 0.12), y + 16); g.lineTo(w, y + 16); g.stroke();
    }
    drawChip(g, 170, 110, 300, 230, 'DIMENSITY', '9500');
    drawChip(g, 40, 390, 260, 130, 'NC1', 'модем OY');
    drawChip(g, 340, 390, 260, 130, 'UFS 4.1');
  });
  const citTex = labelTexture(640, 340, (g, w, h) => {
    g.fillStyle = '#101114'; g.fillRect(0, 0, w, h);
    roundRect(g, 14, 14, w - 28, h - 28, 20);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.stroke();
    // сетка от вскрытия
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
    for (let x = 30; x < w - 20; x += 16) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x, h - 24); g.stroke(); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 92px "Onest", system-ui, sans-serif';
    g.fillText('CITADEL 2', w / 2, h / 2 - 40);
    g.font = '500 30px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.6)';
    g.fillText('64 ГБ · 600 мАч · сторож', w / 2, h / 2 + 50);
  });
  const battTex = labelTexture(620, 760, (g, w, h) => {
    g.fillStyle = '#16171A'; g.fillRect(0, 0, w, h);
    roundRect(g, 24, 24, w - 48, h - 48, 20);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 132px "Onest", system-ui, sans-serif';
    g.fillText('7800', w / 2, h / 2 - 50);
    g.font = '600 58px "Onest", system-ui, sans-serif';
    g.fillText('мАч', w / 2, h / 2 + 50);
    g.font = '500 34px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.55)';
    g.fillText('Si-C · 150 Вт · XMagnum', w / 2, h / 2 + 140);
  });

  const side = new THREE.MeshStandardMaterial({ color: 0x1A1B1E, metalness: 0.5, roughness: 0.5 });
  const make = (name, w, h, d, y, tex) => {
    const grp = new THREE.Group();
    grp.name = name;
    grp.add(new THREE.Mesh(boxG(w, h, d), side));
    const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.2 });
    for (const sz of [1, -1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w * MM, h * MM), face);
      pl.position.z = sz * (d / 2 + 0.02) * MM;
      if (sz < 0) pl.rotation.y = Math.PI;
      grp.add(pl);
    }
    grp.position.y = y * MM;
    grp.visible = false;
    return grp;
  };

  // Испарительная камера: медная пластина почти во всю площадь
  const vapor = new THREE.Group();
  vapor.name = 'Vapor';
  vapor.add(new THREE.Mesh(slab(64, 98, 6, 0.5, 0.15), new THREE.MeshStandardMaterial({ color: 0xB8734A, metalness: 1, roughness: 0.32 })));
  const vg = new THREE.Mesh(slab(58, 92, 5, 0.6, 0.1), vaporGlow);
  vapor.add(vg);
  vapor.position.y = 18 * MM;
  vapor.visible = false;

  const cit = make('Citadel', 42, 22, 2.8, 4, citTex);
  for (const [w, h, x, y] of [[42.8, 0.6, 0, 11.3], [42.8, 0.6, 0, -11.3], [0.6, 23.2, 21.1, 0], [0.6, 23.2, -21.1, 0]]) {
    const m = new THREE.Mesh(boxG(w, h, 3.2), citadelGlow);
    m.position.set(x * MM, y * MM, 0);
    cit.add(m);
  }

  // Катушка XMagnum: плоская спираль-кольцо
  const coil = new THREE.Group();
  coil.name = 'Coil';
  for (let i = 0; i < 6; i++) {
    const r = 15 + i * 2.2;
    const t = new THREE.Mesh(new THREE.TorusGeometry(r * MM, 0.55 * MM, 8, 96), coilGlow);
    coil.add(t);
  }
  coil.position.y = -28 * MM;
  coil.visible = false;

  return [vapor, make('Board', 68, 56, 0.9, 48, boardTex), cit, make('Battery', 68, 84, 4.0, -36, battTex), coil];
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const mats = {
    Body: new THREE.MeshPhysicalMaterial({ name: 'Body', color: 0x1A1B1F, roughness: 0.4, clearcoat: 1 }),
    Frame: new THREE.MeshStandardMaterial({ name: 'Frame', color: 0x34353A, metalness: 1, roughness: 0.3 }),
    FrameGlass: new THREE.MeshPhysicalMaterial({ name: 'FrameGlass', color: 0xD5D8DE, roughness: 0.4, transmission: 1 }),
    Antenna: new THREE.MeshStandardMaterial({ name: 'Antenna', color: 0x2A2C2F, roughness: 0.5 }),
    CamPlate: new THREE.MeshPhysicalMaterial({ name: 'CamPlate', color: 0x050506, roughness: 0.05, clearcoat: 1 }),
    Key: new THREE.MeshStandardMaterial({ name: 'Key', color: 0xFF6A1F, metalness: 0.85, roughness: 0.3 }),
    KeyIndicator: new THREE.MeshStandardMaterial({ name: 'KeyIndicator', color: 0xFF7A2D, emissive: 0xFF7A2D, emissiveIntensity: 1.5 }),
    SignalLightGlow: new THREE.MeshStandardMaterial({ name: 'SignalLightGlow', color: 0xEDEDED, emissive: 0xFFFFFF, emissiveIntensity: 0.4, roughness: 0.15 }),
    Lens: new THREE.MeshPhysicalMaterial({ name: 'Lens', color: 0x020306, roughness: 0.02, clearcoat: 1 }),
    LensRim: new THREE.MeshStandardMaterial({ name: 'LensRim', color: 0x4A4B50, metalness: 1, roughness: 0.14 }),
    LensInner: new THREE.MeshPhysicalMaterial({ name: 'LensInner', color: 0x0B1222, metalness: 0.4, roughness: 0.08, clearcoat: 1 }),
    Etch: new THREE.MeshStandardMaterial({ name: 'Etch', color: 0x4A4C50, roughness: 0.7 }),
    Screen: new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x020203, roughness: 0.18 }),
    Glass: new THREE.MeshPhysicalMaterial({ name: 'Glass', color: 0x030304, roughness: 0.05, clearcoat: 1 }),
    Dark: new THREE.MeshStandardMaterial({ name: 'Dark', color: 0x0B0B0C, roughness: 0.6 }),
    Flash: new THREE.MeshStandardMaterial({ name: 'Flash', color: 0xF3EAD6, emissive: 0xFFF4DD, emissiveIntensity: 0.15, roughness: 0.25 }),
  };

  const root = new THREE.Group();
  root.name = 'OY0X1Pro';
  const group = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); return g; };
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };

  add(slab(75.2, 161.9, 9.7, 6.8, 0, 16), 'Frame', 0, 0, 0, 'Frame');
  add(slab(76.8, 163.5, 10.5, 6.8, 0, 16), 'FrameGlass', 0, 0, 0, 'GlassSides');
  const ant = group('Antennas');
  for (const sx of [-1, 1]) for (const y of ANTENNA_Y) add(boxG(0.26, 0.8, 6.8), 'Antenna', sx * 38.3, y, 0, null, ant);
  add(slab(76.8, 163.5, 10.5, 0.6, 0.2, 16), 'Body', 0, 0, -3.7, 'Body');
  add(slab(76.8, 163.5, 10.5, 0.6, 0.2, 16), 'Glass', 0, 0, 3.7, 'Glass');

  const sw = 72.8, sh = 159.3;
  const scr = new THREE.ShapeGeometry(rrShape(sw, sh, 8.3), 12);
  const pos = scr.attributes.position, uv = scr.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + sw / 2) / sw, 1 - (pos.getY(i) + sh / 2) / sh);
  scr.scale(MM, MM, MM);
  add(scr, 'Screen', 0, 0, 4.03, 'Screen');
  const fp = group('FrontPill');
  add(slab(12.6, 4.2, 2.1, 0.06), 'Dark', 0, 75.05, 4.06, null, fp);
  for (const sx of [-1, 1]) add(cylZ(1.15, 0.08, 32), 'Lens', sx * 3.3, 75.05, 4.1, null, fp);

  // «Шайба»: кольцо и диск
  add(cylZ(23, 1.9, 96), 'Frame', 10.5, 52, -4.95, 'CamIsland');
  add(cylZ(21.5, 0.2, 96), 'CamPlate', 10.5, 52, -5.9, 'CamPlate');
  const cams = group('CameraModules');
  for (const [x, y, r] of [[19.9, 61.4, 7], [1.1, 61.4, 5.4], [19.9, 42.6, 5.4]]) {
    add(cylZ(r + 0.5, 0.4), 'LensRim', x, y, -6.1, null, cams);
    add(cylZ(r - 0.9, 0.1), 'Lens', x, y, -6.3, null, cams);
    add(cylZ(r * 0.22, 0.1), 'LensInner', x, y, -6.36, null, cams);
  }
  const peri = group('Periscope');
  add(boxG(10, 10, 0.4), 'LensRim', 1.1, 42.6, -6.1, null, peri);
  add(boxG(8.2, 8.2, 0.1), 'Lens', 1.1, 42.6, -6.32, null, peri);
  add(boxG(3.4, 3.4, 0.1), 'LensInner', 1.1, 42.6, -6.36, null, peri);
  add(boxG(5, 1.3, 0.06), 'Flash', 10.5, 33.1, -5.95, 'Flash');

  add(boxG(14.6, 0.2, 3.5), 'Dark', 0, 81.85, 0);
  const sl = add(boxG(13, 0.34, 2.4), 'SignalLightGlow', 0, 81.8, 0, 'SignalLight');
  sl.geometry.translate(0, 0.17 * MM, 0);

  KEY_Y.forEach((y, i) => {
    add(boxG(0.2, 9.2, 3.1), 'Dark', -38.5, y, 0);
    const g = boxG(0.85, 8.4, 2.5);
    g.translate(-0.38 * MM, 0, 0);
    add(g, 'Key', -38.45, y, 0, `Key_${i + 1}`);
    add(cylZ(0.4, 0.2, 16).rotateY(Math.PI / 2), 'KeyIndicator', -38.45, y + 6.1, 0, `KeyIndicator_${i + 1}`);
  });

  add(boxG(0.45, 12, 2.5), 'Frame', 38.65, 16, 0, 'PowerButton');
  add(boxG(0.7, 23, 2.3), 'Frame', 38.8, 41, 0, 'VolumeRocker');

  add(boxG(8.6, 0.1, 2.8), 'Dark', 0, -81.8, 0);
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) add(boxG(1, 0.1, 1), 'Dark', sx * (11 + i * 2.2), -81.8, 0);

  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X1Pro({ phone, scale, isRunning }) {
  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, SIGNAL_Y * scale + 0.004, 0);
  glow.position.set(0, SIGNAL_Y * scale + 0.01, 0);
  phone.add(beam, glow);

  const scrCanvas = { day: document.createElement('canvas'), night: document.createElement('canvas') };
  for (const c of Object.values(scrCanvas)) { c.width = 600; c.height = 1310; }
  const scrTex = {};
  for (const k of ['day', 'night']) {
    const t = new THREE.CanvasTexture(scrCanvas[k]);
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    t.anisotropy = 4;
    scrTex[k] = t;
  }
  const screenMat = new THREE.MeshStandardMaterial({
    name: 'Screen', color: 0x000000, roughness: 0.22, metalness: 0,
    emissive: 0xffffff, emissiveMap: scrTex.day, emissiveIntensity: 1,
  });
  let screenMode = 'day';
  let accentHex = OXP_COLORS.obsidian.accent;
  function redrawScreen(accent = accentHex) {
    accentHex = accent;
    drawScreen(scrCanvas.day, 'day', accentHex, 'OY OS 2 · Citadel 2', KEYS_CARD);
    drawScreen(scrCanvas.night, 'night', accentHex, 'OY OS 2 · Citadel 2', KEYS_CARD);
    scrTex.day.needsUpdate = true;
    scrTex.night.needsUpdate = true;
  }
  redrawScreen();

  // Матовое стекло спинки с глубоким переливом: тонкое зерно и лаковый слой сверху
  const bodyMat = new THREE.MeshPhysicalMaterial({
    name: 'Body', color: OXP_COLORS.obsidian.body, metalness: 0.15, roughness: 0.4,
    map: shadeTexture(), clearcoat: 1, clearcoatRoughness: 0.08, specularIntensity: 1,
    sheen: 0.35, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xffffff),
    bumpMap: frostTexture(), bumpScale: 0.45, envMapIntensity: 1.6,
  });
  // Стеклянные грани; на слабых устройствах — обычная полупрозрачность
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 400;
  const glassMat = new THREE.MeshPhysicalMaterial({
    name: 'FrameGlass', color: OXP_COLORS.obsidian.glass, metalness: 0, roughness: 0.38,
    transmission: lowEnd ? 0 : 1, thickness: 0.03, ior: 1.5,
    specularIntensity: 1, envMapIntensity: 1.2,
    transparent: lowEnd, opacity: lowEnd ? 0.5 : 1,
    clearcoat: 1, clearcoatRoughness: 0.1,
  });
  // Кольцо шайбы — полированный титан: зеркальнее рамки
  const ringMat = new THREE.MeshPhysicalMaterial({
    name: 'Ring', color: OXP_COLORS.obsidian.ring, metalness: 1, roughness: 0.1,
    clearcoat: 0.6, clearcoatRoughness: 0.05, envMapIntensity: 1.6,
  });
  const accentColor = new THREE.Color(OXP_COLORS.obsidian.accent);
  const citadelGlow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: accentColor, emissiveIntensity: 0.3 });
  const vaporGlow = new THREE.MeshStandardMaterial({ color: 0x2A1208, emissive: new THREE.Color(0xFF6A2A), emissiveIntensity: 0, transparent: true, opacity: 0.85 });
  const coilGlow = new THREE.MeshStandardMaterial({ color: 0xB8734A, metalness: 1, roughness: 0.3, emissive: accentColor, emissiveIntensity: 0 });

  const parts = {
    keys: [], keyBase: [], indicatorMats: [],
    frame: null, keyMat: null, antenna: null, signalMat: null, flashMat: null,
    layers: [], internals: [],
  };

  const colorTarget = { body: new THREE.Color(), frame: new THREE.Color(), ring: new THREE.Color(), glass: new THREE.Color(), key: new THREE.Color(), rough: 0.4 };
  const signalTarget = new THREE.Color(0xffffff);
  const signalCur = new THREE.Color(0xffffff);
  const ledOff = new THREE.Color(0x3A3A3E);
  const ledReady = new THREE.Color(0xFF7A2D);
  const ledCut = new THREE.Color(0xFF2D2D);

  function setupLayers(root) {
    const anchor = root.getObjectByName('Frame');
    const holder = anchor?.parent || root;
    const internals = buildInternals({ citadelGlow, vaporGlow, coilGlow });
    holder.add(...internals);
    parts.internals = internals;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const c = new THREE.Vector3();
    const inv = new THREE.Matrix4().copy(holder.matrixWorld).invert();
    for (const o of holder.children) {
      let layer = LAYER_BY_NAME[o.name];
      if (!layer) {
        box.setFromObject(o).getCenter(c).applyMatrix4(inv);
        layer = c.z < -0.0042 ? 'back' : c.z > 0.004 ? 'glass' : 'frame';
      }
      const off = LAYER_OFFSET[layer];
      if (off) parts.layers.push({ o, base: o.position.z, off });
    }
  }

  function setup(root) {
    setupLayers(root);
    const byName = {};
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (m && m.name && !byName[m.name]) byName[m.name] = m;
      if (o.material?.name === 'Body') o.material = bodyMat;
      if (o.material?.name === 'FrameGlass') o.material = glassMat;
    });
    root.getObjectByName('CamIsland')?.traverse((o) => { if (o.isMesh) o.material = ringMat; });
    parts.frame = byName.Frame || null;
    if (parts.frame) { parts.frame.metalness = 1; parts.frame.roughness = 0.24; parts.frame.envMapIntensity = 1.3; }
    parts.keyMat = byName.Key || null;
    if (parts.keyMat) { parts.keyMat.metalness = 0.85; parts.keyMat.roughness = 0.3; }
    // Ободки объективов — тёмный полированный титан, без латуни
    if (byName.LensRim) { const m = byName.LensRim; m.color.set(0x2E2F33); m.metalness = 1; m.roughness = 0.12; m.envMapIntensity = 1.5; }
    if (byName.Etch) { byName.Etch.color.set(0x8E9196); byName.Etch.roughness = 0.5; }
    parts.antenna = byName.Antenna || null;
    if (parts.antenna) parts.antenna.emissive = new THREE.Color(0x000000);
    parts.signalMat = byName.SignalLightGlow || null;
    if (parts.signalMat) { parts.signalMat.emissive = new THREE.Color(0xffffff); parts.signalMat.emissiveIntensity = 0.3; }
    parts.flashMat = byName.Flash || null;
    if (byName.Lens) {
      byName.Lens.envMapIntensity = 0.12;
      if ('clearcoat' in byName.Lens) byName.Lens.clearcoat = 0;
      byName.Lens.roughness = 0.05;
    }
    if (byName.LensInner) {
      const m = byName.LensInner;
      m.envMapIntensity = 0.25; m.color.set(0x050C1E); m.roughness = 0.1; m.metalness = 0.6;
      if ('clearcoat' in m) m.clearcoat = 0;
    }
    if (byName.LensRing) byName.LensRing.envMapIntensity = 0.8;
    if (byName.CamPlate) {
      const m = byName.CamPlate;   // глубокий чёрный диск с чёткими отражениями
      m.color.set(0x020203); m.metalness = 0; m.roughness = 0.03; m.envMapIntensity = 1.5;
      if ('clearcoat' in m) { m.clearcoat = 1; m.clearcoatRoughness = 0.02; }
    }

    for (let i = 1; i <= 2; i++) {
      const k = root.getObjectByName(`Key_${i}`);
      parts.keys.push(k || null);
      parts.keyBase.push(k ? k.position.x : 0);
      let mat = null;
      root.getObjectByName(`KeyIndicator_${i}`)?.traverse((o) => {
        if (o.isMesh) { o.material = o.material.clone(); o.material.toneMapped = false; mat = o.material; }
      });
      parts.indicatorMats.push(mat);
    }

    root.getObjectByName('Screen')?.traverse((o) => { if (o.isMesh) o.material = screenMat; });
    screenMat.toneMapped = false;

    applyColorsInstant();
  }

  function setBodyTargets(name) {
    const c = OXP_COLORS[name] || OXP_COLORS.obsidian;
    colorTarget.body.setHex(c.body);
    colorTarget.frame.setHex(c.frame);
    colorTarget.ring.setHex(c.ring);
    colorTarget.glass.setHex(c.glass);
    colorTarget.key.setHex(c.key);
    colorTarget.rough = c.rough;
    accentColor.set(c.accent);
  }
  setBodyTargets('obsidian');

  function stepColors(k) {
    bodyMat.color.lerp(colorTarget.body, k);
    bodyMat.roughness += (colorTarget.rough - bodyMat.roughness) * k;
    ringMat.color.lerp(colorTarget.ring, k);
    glassMat.color.lerp(colorTarget.glass, k);
    if (parts.frame) parts.frame.color.lerp(colorTarget.frame, k);
    if (parts.keyMat) parts.keyMat.color.lerp(colorTarget.key, k);
    signalCur.lerp(signalTarget, k);
  }
  function applyColorsInstant() { stepColors(1); }

  const tmp = new THREE.Color();
  function update(cur, dt, { reduced }) {
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));
    const now = performance.now();

    // Разлёт по слоям
    const ex = clamp01(cur.explode);
    const e = ex * ex * (3 - 2 * ex);
    for (const l of parts.layers) l.o.position.z = l.base + l.off * e;
    for (const m of parts.internals) m.visible = e > 0.01;

    // Citadel 2, испарительная камера и катушка XMagnum
    citadelGlow.emissive.copy(accentColor);
    citadelGlow.emissiveIntensity = 0.25 + clamp01(cur.citadel) * 6;
    vaporGlow.emissiveIntensity = clamp01(cur.vapor) * (1.6 + (reduced ? 0 : Math.sin(now / 420) * 0.4));
    coilGlow.emissive.copy(accentColor);
    coilGlow.emissiveIntensity = clamp01(cur.coil) * 2.5;
    if (parts.antenna) {
      const a = clamp01(cur.antenna);
      parts.antenna.emissive.copy(accentColor);
      parts.antenna.emissiveIntensity = a * (2.2 + Math.sin(now / 260) * 0.8 * (reduced ? 0 : 1));
    }

    // Кнопки: нажатие, фиксация и индикатор (0 — выкл, 1 — назначено, 2 — питание отключено)
    for (let i = 0; i < 2; i++) {
      const k = parts.keys[i];
      if (k) k.position.x = parts.keyBase[i] + Math.max(clamp01(cur[`key${i + 1}`]) * KEY_TRAVEL, clamp01(cur[`lock${i + 1}`]) * LOCK_TRAVEL);
      const m = parts.indicatorMats[i];
      if (m) {
        const v = Math.max(0, Math.min(2, cur[`led${i + 1}`]));
        if (v <= 1) tmp.copy(ledOff).lerp(ledReady, v); else tmp.copy(ledReady).lerp(ledCut, v - 1);
        m.color.copy(tmp);
        if (m.emissive) { m.emissive.copy(tmp); m.emissiveIntensity = 0.9 * Math.min(1, v); }
      }
    }

    // Фонарь; sos — мигание «· · · — — — · · ·» от Citadel 2
    let sig = clamp01(cur.signal);
    const sos = clamp01(cur.sos);
    if (sos > 0.01) {
      const t = (now / 180) % 34;
      const on = [0, 2, 4, 8, 12, 16, 20, 22, 24].some((s, idx) => t >= s && t < s + (idx >= 3 && idx <= 5 ? 3 : 1));
      sig = Math.max(sig, sos * (reduced ? 0.8 : on ? 1 : 0.04));
    }
    if (parts.signalMat) {
      parts.signalMat.emissive.copy(signalCur);
      parts.signalMat.emissiveIntensity = 0.25 + sig * 9;
    }
    beamMat.uniforms.uIntensity.value = sig;
    beamMat.uniforms.uColor.value.copy(signalCur);
    beam.visible = sig > 0.002;
    glow.material.opacity = sig;
    glow.material.color.copy(signalCur);
    glow.visible = sig > 0.002;

    // Экран
    const scr = clamp01(cur.screen);
    const mode = scr < 0.35 ? 'night' : 'day';
    if (mode !== screenMode) { screenMode = mode; screenMat.emissiveMap = scrTex[mode]; }
    screenMat.emissiveIntensity = mode === 'night' ? 0.35 + scr : 0.15 + scr * 0.9;
  }

  return {
    url: '/models/oy0x1pro.glb?v=e997b2015b',
    state: { key1: 0, key2: 0, lock1: 0, lock2: 0, led1: 1, led2: 1, signal: 0, sos: 0, screen: 1, explode: 0, citadel: 0, vapor: 0, coil: 0, antenna: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap: applyColorsInstant,
    api: {
      setBodyColor(name, instant = false) {
        const c = OXP_COLORS[name] ? name : 'obsidian';
        setBodyTargets(c);
        redrawScreen(OXP_COLORS[c].accent);
        if (instant || !isRunning()) applyColorsInstant();
      },
      setSignalColor(name, instant = false) {
        signalTarget.setHex(SIGNAL_COLORS[name] || SIGNAL_COLORS.white);
        if (instant || !isRunning()) signalCur.copy(signalTarget);
      },
      redrawScreen,
    },
  };
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
