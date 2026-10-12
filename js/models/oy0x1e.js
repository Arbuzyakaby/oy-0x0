/* =========================================================================
   OY 0X1 Essential — описание 3D-модели: «брат 0X0» с матовой спинкой из
   поликарбоната, островом камер в цвет корпуса, одной кнопкой «0» (нажатие
   и индикатор аппаратного режима), Null Chip при разлёте по слоям, экран,
   белый сигнальный фонарь и процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, roundRect, drawScreen, rrShape, slab, boxG, cylZ, labelTexture, drawChip, makeBeam } from './oy0x0.js';

export const OXE_COLORS = {
  mint: { body: 0x5DC496, frame: 0x8CC9AE, key: 0xFF6A1F, rough: 0.66, accent: '#5FD9A8' },
  sand: { body: 0xD9BC8C, frame: 0xC9B48F, key: 0xFF6A1F, rough: 0.68, accent: '#E6BE7A' },
  coal: { body: 0x2A2C2F, frame: 0x484B50, key: 0xFF6A1F, rough: 0.6, accent: '#FF7A2D' },
};

const KEYS_CARD = { title: 'Кнопка «0»', sub: 'долго — всё выключить', dots: 1 };
const KEY_TRAVEL = 0.0004;
const SIGNAL_Y = 0.0761;
const KEY_Y = 30;
const ANTENNA_Y = [64, -64];

const LAYER_OFFSET = { glass: 0.05, screen: 0.028, frame: 0, board: -0.022, nullchip: -0.038, battery: -0.054, back: -0.076 };
const LAYER_BY_NAME = {
  Glass: 'glass', PunchHole: 'glass', Screen: 'screen',
  Body: 'back', CameraModules: 'back', EngraveX: 'back', Flash: 'back',
  Board: 'board', NullChip: 'nullchip', Battery: 'battery',
};

/* ---------- Софт-тач: мелкое зерно поликарбоната ---------- */

function grainTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 20;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 16);
  t.flipY = false;
  return t;
}

/* ---------- Внутренности ---------- */

function buildInternals(glowMat) {
  const boardTex = labelTexture(620, 560, (g, w, h) => {
    g.fillStyle = '#0D1214'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,190,210,.16)'; g.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const y = 20 + i * 22;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w * (0.2 + (i % 5) * 0.12), y); g.lineTo(w * (0.26 + (i % 5) * 0.12), y + 16); g.lineTo(w, y + 16); g.stroke();
    }
    drawChip(g, 170, 130, 280, 220, 'DIMENSITY', '8350');
    drawChip(g, 40, 400, 230, 120, 'LPDDR5X');
    drawChip(g, 350, 400, 230, 120, 'UFS');
  });
  const chipTex = labelTexture(620, 300, (g, w, h) => {
    g.fillStyle = '#121316'; g.fillRect(0, 0, w, h);
    roundRect(g, 14, 14, w - 28, h - 28, 18);
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 88px "Onest", system-ui, sans-serif';
    g.fillText('NULL CHIP', w / 2, h / 2 - 34);
    g.font = '500 30px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.6)';
    g.fillText('кнопка «0» → питание', w / 2, h / 2 + 48);
  });
  const battTex = labelTexture(620, 760, (g, w, h) => {
    g.fillStyle = '#16171A'; g.fillRect(0, 0, w, h);
    roundRect(g, 24, 24, w - 48, h - 48, 20);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 132px "Onest", system-ui, sans-serif';
    g.fillText('6000', w / 2, h / 2 - 50);
    g.font = '600 58px "Onest", system-ui, sans-serif';
    g.fillText('мАч', w / 2, h / 2 + 50);
    g.font = '500 34px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.55)';
    g.fillText('Si-C · 67 Вт', w / 2, h / 2 + 140);
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
  const chip = make('NullChip', 40, 19, 2.6, 6, chipTex);
  for (const [w, h, x, y] of [[40.8, 0.6, 0, 9.8], [40.8, 0.6, 0, -9.8], [0.6, 20.2, 20.1, 0], [0.6, 20.2, -20.1, 0]]) {
    const m = new THREE.Mesh(boxG(w, h, 3), glowMat);
    m.position.set(x * MM, y * MM, 0);
    chip.add(m);
  }
  return [make('Board', 64, 54, 0.9, 42, boardTex), chip, make('Battery', 64, 78, 4.0, -36, battTex)];
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const mats = {
    Body: new THREE.MeshPhysicalMaterial({ name: 'Body', color: 0x86D3B2, roughness: 0.66 }),
    Frame: new THREE.MeshStandardMaterial({ name: 'Frame', color: 0xA6D2BF, metalness: 0.9, roughness: 0.3 }),
    Antenna: new THREE.MeshStandardMaterial({ name: 'Antenna', color: 0x2A2C2F, roughness: 0.5 }),
    Key: new THREE.MeshStandardMaterial({ name: 'Key', color: 0xFF6A1F, metalness: 0.85, roughness: 0.3 }),
    KeyIndicator: new THREE.MeshStandardMaterial({ name: 'KeyIndicator', color: 0xFF7A2D, emissive: 0xFF7A2D, emissiveIntensity: 1.5 }),
    SignalLightGlow: new THREE.MeshStandardMaterial({ name: 'SignalLightGlow', color: 0xEDEDED, emissive: 0xFFFFFF, emissiveIntensity: 0.4, roughness: 0.15 }),
    Lens: new THREE.MeshPhysicalMaterial({ name: 'Lens', color: 0x020306, roughness: 0.02, clearcoat: 1 }),
    LensInner: new THREE.MeshPhysicalMaterial({ name: 'LensInner', color: 0x0B1222, metalness: 0.4, roughness: 0.08, clearcoat: 1 }),
    Etch: new THREE.MeshStandardMaterial({ name: 'Etch', color: 0x4A4C50, roughness: 0.7 }),
    Screen: new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x020203, roughness: 0.18 }),
    Glass: new THREE.MeshPhysicalMaterial({ name: 'Glass', color: 0x030304, roughness: 0.05, clearcoat: 1 }),
    Dark: new THREE.MeshStandardMaterial({ name: 'Dark', color: 0x0B0B0C, roughness: 0.6 }),
    Flash: new THREE.MeshStandardMaterial({ name: 'Flash', color: 0xF3EAD6, emissive: 0xFFF4DD, emissiveIntensity: 0.15, roughness: 0.25 }),
  };

  const root = new THREE.Group();
  root.name = 'OY0X1E';
  const group = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); return g; };
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };

  add(slab(71.5, 152, 9.5, 8.6, 0.55, 14), 'Frame', 0, 0, 0, 'Frame');
  const ant = group('Antennas');
  for (const sx of [-1, 1]) for (const y of ANTENNA_Y) add(boxG(0.26, 0.8, 4.4), 'Antenna', sx * 35.7, y, 0, null, ant);
  add(slab(69.9, 150.4, 8.7, 0.3, 0.1, 14), 'Body', 0, 0, -4.15, 'Body');
  add(slab(18.6, 44, 9.3, 0.9, 0.3, 16), 'Body', 20.5, 46.5, -4.7);
  add(slab(69.9, 150.4, 8.7, 0.3, 0.1, 14), 'Glass', 0, 0, 4.15, 'Glass');

  const sw = 67.1, sh = 147.2;
  const scr = new THREE.ShapeGeometry(rrShape(sw, sh, 7.5), 12);
  const pos = scr.attributes.position, uv = scr.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + sw / 2) / sw, 1 - (pos.getY(i) + sh / 2) / sh);
  scr.scale(MM, MM, MM);
  add(scr, 'Screen', 0, 0, 4.32, 'Screen');
  const ph = group('PunchHole');
  add(cylZ(1.7, 0.06, 32), 'Dark', 0, 69, 4.34, null, ph);
  add(cylZ(1.15, 0.08, 32), 'Lens', 0, 69, 4.36, null, ph);

  const cams = group('CameraModules');
  for (const [y, r] of [[58.9, 7], [34.1, 5.9]]) {
    add(cylZ(r, 0.6), 'Frame', 20.5, y, -5.4, null, cams);
    add(cylZ(r - 0.9, 0.1), 'Lens', 20.5, y, -5.72, null, cams);
    add(cylZ(r * 0.34, 0.1), 'LensInner', 20.5, y, -5.78, null, cams);
  }
  add(cylZ(1.35, 0.12, 24), 'Flash', 20.5, 46.5, -5.2, 'Flash');
  const ex = group('EngraveX');
  for (const a of [Math.PI / 4, -Math.PI / 4]) add(boxG(4.6, 0.6, 0.04), 'Etch', 20.5, 18.5, -4.3, null, ex).rotation.z = a;

  add(boxG(12.6, 0.2, 3.8), 'Dark', 0, 76.05, 0);
  const sl = add(boxG(11, 0.34, 2.6), 'SignalLightGlow', 0, 76, 0, 'SignalLight');
  sl.geometry.translate(0, 0.17 * MM, 0);

  add(boxG(0.2, 9.2, 3.3), 'Dark', -35.8, KEY_Y, 0);
  const g = boxG(0.85, 8.4, 2.7);
  g.translate(-0.38 * MM, 0, 0);
  add(g, 'Key', -35.75, KEY_Y, 0, 'Key_1');
  add(cylZ(0.42, 0.2, 16).rotateY(Math.PI / 2), 'KeyIndicator', -35.75, KEY_Y + 6.2, 0, 'KeyIndicator_1');

  add(boxG(0.45, 12, 2.7), 'Frame', 35.95, 16, 0, 'PowerButton');
  add(boxG(0.72, 22, 2.5), 'Frame', 36.1, 39, 0, 'VolumeRocker');

  add(boxG(8.6, 0.1, 2.8), 'Dark', 0, -76.02, 0);
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) add(boxG(1.1, 0.1, 1.1), 'Dark', sx * (11 + i * 2.3), -76.02, 0);

  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X1E({ phone, scale, isRunning }) {
  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, SIGNAL_Y * scale + 0.004, 0);
  glow.position.set(0, SIGNAL_Y * scale + 0.01, 0);
  phone.add(beam, glow);

  const scrCanvas = { day: document.createElement('canvas'), night: document.createElement('canvas') };
  for (const c of Object.values(scrCanvas)) { c.width = 600; c.height = 1320; }
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
  let accentHex = OXE_COLORS.mint.accent;
  function redrawScreen(accent = accentHex) {
    accentHex = accent;
    drawScreen(scrCanvas.day, 'day', accentHex, 'OY OS 2', KEYS_CARD);
    drawScreen(scrCanvas.night, 'night', accentHex, 'OY OS 2', KEYS_CARD);
    scrTex.day.needsUpdate = true;
    scrTex.night.needsUpdate = true;
  }
  redrawScreen();

  // Поликарбонат софт-тач: матовый, с бархатистым «пушком» на скатах (sheen)
  const bodyMat = new THREE.MeshPhysicalMaterial({
    name: 'Body', color: OXE_COLORS.mint.body, metalness: 0, roughness: 0.66,
    sheen: 0.3, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff),
    clearcoat: 0.15, clearcoatRoughness: 0.5,
    bumpMap: grainTexture(), bumpScale: 0.35, envMapIntensity: 0.9,
  });
  const accentColor = new THREE.Color(OXE_COLORS.mint.accent);
  const chipGlow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: accentColor, emissiveIntensity: 0.3 });

  const parts = { key: null, keyBase: 0, indicatorMat: null, frame: null, keyMat: null, antenna: null, signalMat: null, layers: [], internals: [] };

  const colorTarget = { body: new THREE.Color(), frame: new THREE.Color(), key: new THREE.Color(), rough: 0.66 };
  const ledOff = new THREE.Color(0x3A3A3E);
  const ledReady = new THREE.Color(0xFF7A2D);
  const ledCut = new THREE.Color(0xFF2D2D);

  function setupLayers(root) {
    const anchor = root.getObjectByName('Frame');
    const holder = anchor?.parent || root;
    const internals = buildInternals(chipGlow);
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
        layer = c.z < -0.0045 ? 'back' : c.z > 0.0043 ? 'glass' : 'frame';
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
      if (Array.isArray(o.material)) o.material = o.material.map((m) => (m?.name === 'Body' ? bodyMat : m));
      else if (o.material?.name === 'Body') o.material = bodyMat;
    });
    parts.frame = byName.Frame || null;
    if (parts.frame) { parts.frame.metalness = 0.9; parts.frame.roughness = 0.28; parts.frame.envMapIntensity = 1.2; }
    parts.keyMat = byName.Key || null;
    if (parts.keyMat) { parts.keyMat.metalness = 0.85; parts.keyMat.roughness = 0.3; }
    parts.antenna = byName.Antenna || null;
    parts.signalMat = byName.SignalLightGlow || null;
    if (parts.signalMat) { parts.signalMat.emissive = new THREE.Color(0xffffff); parts.signalMat.emissiveIntensity = 0.3; }
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

    const k = root.getObjectByName('Key_1');
    parts.key = k || null;
    parts.keyBase = k ? k.position.x : 0;
    root.getObjectByName('KeyIndicator_1')?.traverse((o) => {
      if (o.isMesh) { o.material = o.material.clone(); o.material.toneMapped = false; parts.indicatorMat = o.material; }
    });

    root.getObjectByName('Screen')?.traverse((o) => { if (o.isMesh) o.material = screenMat; });
    screenMat.toneMapped = false;

    applyColorsInstant();
  }

  function setBodyTargets(name) {
    const c = OXE_COLORS[name] || OXE_COLORS.mint;
    colorTarget.body.setHex(c.body);
    colorTarget.frame.setHex(c.frame);
    colorTarget.key.setHex(c.key);
    colorTarget.rough = c.rough;
    accentColor.set(c.accent);
  }
  setBodyTargets('mint');

  function stepColors(k) {
    bodyMat.color.lerp(colorTarget.body, k);
    bodyMat.roughness += (colorTarget.rough - bodyMat.roughness) * k;
    if (parts.frame) parts.frame.color.lerp(colorTarget.frame, k);
    if (parts.keyMat) parts.keyMat.color.lerp(colorTarget.key, k);
  }
  function applyColorsInstant() { stepColors(1); }

  const tmp = new THREE.Color();
  const white = new THREE.Color(0xffffff);
  function update(cur, dt, { reduced }) {
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));

    const ex = clamp01(cur.explode);
    const e = ex * ex * (3 - 2 * ex);
    for (const l of parts.layers) l.o.position.z = l.base + l.off * e;
    for (const m of parts.internals) m.visible = e > 0.01;

    chipGlow.emissive.copy(accentColor);
    chipGlow.emissiveIntensity = 0.25 + clamp01(cur.nullchip) * 6;

    if (parts.key) parts.key.position.x = parts.keyBase + clamp01(cur.key1) * KEY_TRAVEL;
    const m = parts.indicatorMat;
    if (m) {
      const v = Math.max(0, Math.min(2, cur.led1));
      if (v <= 1) tmp.copy(ledOff).lerp(ledReady, v); else tmp.copy(ledReady).lerp(ledCut, v - 1);
      m.color.copy(tmp);
      if (m.emissive) { m.emissive.copy(tmp); m.emissiveIntensity = 0.9 * Math.min(1, v); }
    }

    // Фонарь — только белый
    const sig = clamp01(cur.signal);
    if (parts.signalMat) { parts.signalMat.emissive.copy(white); parts.signalMat.emissiveIntensity = 0.25 + sig * 9; }
    beamMat.uniforms.uIntensity.value = sig * 0.7;
    beamMat.uniforms.uColor.value.copy(white);
    beam.visible = sig > 0.002;
    glow.material.opacity = sig;
    glow.material.color.copy(white);
    glow.visible = sig > 0.002;

    const scr = clamp01(cur.screen);
    const mode = scr < 0.35 ? 'night' : 'day';
    if (mode !== screenMode) { screenMode = mode; screenMat.emissiveMap = scrTex[mode]; }
    screenMat.emissiveIntensity = mode === 'night' ? 0.35 + scr : 0.15 + scr * 0.9;
  }

  return {
    url: '/models/oy0x1e.glb?v=a053cad721',
    state: { key1: 0, led1: 1, signal: 0, screen: 1, explode: 0, nullchip: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap: applyColorsInstant,
    api: {
      setBodyColor(name, instant = false) {
        const c = OXE_COLORS[name] ? name : 'mint';
        setBodyTargets(c);
        redrawScreen(OXE_COLORS[c].accent);
        if (instant || !isRunning()) applyColorsInstant();
      },
      setSignalColor() {},
      redrawScreen,
    },
  };
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
