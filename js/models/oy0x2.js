/* =========================================================================
   OY 0X2 — описание 3D-модели: дизайн 0X1 в корпусе 7,9 мм, спинка из
   матового стекла, кнопки «0» и «1», две фронтальные камеры, антенны
   Claw 2.0, разлёт по слоям с Tesseract, испарительной камерой и катушкой
   XMagnum, экран, сигнальный фонарь и процедурная резервная модель.
   ========================================================================= */

import * as THREE from 'three';
import { MM, SIGNAL_COLORS, roundRect, drawScreen, rrShape, slab, boxG, cylZ, labelTexture, drawChip, makeBeam } from './oy0x0.js';
import { frostTexture, shadeTexture } from './oy0x1.js';

export const OX2_COLORS = {
  honey: { body: 0xC98A22, frame: 0xD8C6A2, key: 0xFF6A1F, rough: 0.36, accent: '#FFC24A' },
  leaf: { body: 0x3E6A2C, frame: 0xB7C2A8, key: 0xFF6A1F, rough: 0.38, accent: '#9BE07A' },
  blossom: { body: 0xE09AB0, frame: 0xE6D3D8, key: 0xFF6A1F, rough: 0.36, accent: '#FF8FB4' },
};

// Карточка на экране блокировки: что сейчас на кнопках
const KEYS_CARD = { title: 'Tesseract · кнопки «0» и «1»', sub: 'двойник готов · кошелёк в чипе', dots: 2 };
const KEY_TRAVEL = 0.0004;      // м, ход кнопки внутрь
const SIGNAL_Y = 0.0809;        // м, верхняя грань
const KEY_Y = [41, 27];
const ANTENNA_Y = [69, 59, -59, -69];

// Разлёт по слоям (м, вдоль оси Z модели: + к экрану, − к спинке)
const LAYER_OFFSET = { glass: 0.056, screen: 0.034, frame: 0, vapor: -0.016, board: -0.03, tesseract: -0.046, battery: -0.062, coil: -0.078, back: -0.096 };
const LAYER_BY_NAME = {
  Glass: 'glass', FrontPill: 'glass', Screen: 'screen',
  Body: 'back', CamIsland: 'back', CamPlate: 'back', CameraModules: 'back', Periscope: 'back', EngraveX: 'back', Flash: 'back',
  Vapor: 'vapor', Board: 'board', Tesseract: 'tesseract', Battery: 'battery', Coil: 'coil',
};

/* ---------- Внутренности: испарительная камера, плата, Tesseract, аккумулятор, катушка ---------- */

function buildInternals({ chipGlow, vaporGlow, coilGlow }) {
  const boardTex = labelTexture(620, 560, (g, w, h) => {
    g.fillStyle = '#0D1214'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,190,210,.16)'; g.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const y = 20 + i * 22;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w * (0.2 + (i % 5) * 0.12), y); g.lineTo(w * (0.26 + (i % 5) * 0.12), y + 16); g.lineTo(w, y + 16); g.stroke();
    }
    drawChip(g, 160, 110, 300, 230, 'SNAPDRAGON', '8s Gen 4');
    drawChip(g, 40, 400, 230, 120, 'LPDDR5X');
    drawChip(g, 350, 400, 230, 120, 'UFS 4.0');
  });
  // Tesseract: проекция четырёхмерного куба поверх сетки от вскрытия
  const chipTex = labelTexture(640, 340, (g, w, h) => {
    g.fillStyle = '#101114'; g.fillRect(0, 0, w, h);
    roundRect(g, 14, 14, w - 28, h - 28, 20);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
    for (let x = 30; x < w - 20; x += 16) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x, h - 24); g.stroke(); }
    const cx = 110, cy = h / 2, o = 52, n = 26;
    g.strokeStyle = 'rgba(242,242,240,.75)'; g.lineWidth = 3;
    g.strokeRect(cx - o, cy - o, o * 2, o * 2);
    g.strokeRect(cx - n, cy - n, n * 2, n * 2);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      g.beginPath(); g.moveTo(cx + sx * o, cy + sy * o); g.lineTo(cx + sx * n, cy + sy * n); g.stroke();
    }
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 76px "Onest", system-ui, sans-serif';
    g.fillText('TESSERACT', 196, h / 2 - 34);
    g.font = '500 28px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.6)';
    g.fillText('84 ГБ · 1000 мАч · двойник', 198, h / 2 + 46);
  });
  const battTex = labelTexture(620, 760, (g, w, h) => {
    g.fillStyle = '#16171A'; g.fillRect(0, 0, w, h);
    roundRect(g, 24, 24, w - 48, h - 48, 20);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 132px "Onest", system-ui, sans-serif';
    g.fillText('7300', w / 2, h / 2 - 50);
    g.font = '600 58px "Onest", system-ui, sans-serif';
    g.fillText('мАч', w / 2, h / 2 + 50);
    g.font = '500 34px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.55)';
    g.fillText('Si-C · 140 Вт · XMagnum', w / 2, h / 2 + 140);
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
  vapor.add(new THREE.Mesh(slab(62, 92, 6, 0.4, 0.12), new THREE.MeshStandardMaterial({ color: 0xB8734A, metalness: 1, roughness: 0.32 })));
  vapor.add(new THREE.Mesh(slab(56, 86, 5, 0.5, 0.1), vaporGlow));
  vapor.position.y = 20 * MM;
  vapor.visible = false;

  const chip = make('Tesseract', 42, 22, 2.6, 4, chipTex);
  for (const [w, h, x, y] of [[42.8, 0.6, 0, 11.3], [42.8, 0.6, 0, -11.3], [0.6, 23.2, 21.1, 0], [0.6, 23.2, -21.1, 0]]) {
    const m = new THREE.Mesh(boxG(w, h, 3), chipGlow);
    m.position.set(x * MM, y * MM, 0);
    chip.add(m);
  }

  // Катушка XMagnum: плоская спираль-кольцо под спинкой
  const coil = new THREE.Group();
  coil.name = 'Coil';
  for (let i = 0; i < 6; i++) {
    coil.add(new THREE.Mesh(new THREE.TorusGeometry((15 + i * 2.2) * MM, 0.55 * MM, 8, 96), coilGlow));
  }
  coil.position.y = -30 * MM;
  coil.visible = false;

  return [vapor, make('Board', 66, 56, 0.9, 46, boardTex), chip, make('Battery', 66, 82, 3.6, -38, battTex), coil];
}

/* ---------- Резервная процедурная модель ---------- */

function buildFallback() {
  const mats = {
    Body: new THREE.MeshPhysicalMaterial({ name: 'Body', color: 0xC98A22, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.22 }),
    Frame: new THREE.MeshStandardMaterial({ name: 'Frame', color: 0xC4C7CB, metalness: 0.92, roughness: 0.24 }),
    Antenna: new THREE.MeshStandardMaterial({ name: 'Antenna', color: 0x2A2C2F, roughness: 0.5 }),
    CamPlate: new THREE.MeshPhysicalMaterial({ name: 'CamPlate', color: 0x050506, roughness: 0.05, clearcoat: 1 }),
    Key: new THREE.MeshStandardMaterial({ name: 'Key', color: 0xFF6A1F, metalness: 0.85, roughness: 0.3 }),
    KeyIndicator: new THREE.MeshStandardMaterial({ name: 'KeyIndicator', color: 0xFF7A2D, emissive: 0xFF7A2D, emissiveIntensity: 1.5 }),
    SignalLightGlow: new THREE.MeshStandardMaterial({ name: 'SignalLightGlow', color: 0xEDEDED, emissive: 0xFFFFFF, emissiveIntensity: 0.4, roughness: 0.15 }),
    Lens: new THREE.MeshPhysicalMaterial({ name: 'Lens', color: 0x020306, roughness: 0.02, clearcoat: 1 }),
    LensRim: new THREE.MeshStandardMaterial({ name: 'LensRim', color: 0xC9C2B2, metalness: 1, roughness: 0.12 }),
    LensInner: new THREE.MeshPhysicalMaterial({ name: 'LensInner', color: 0x0B1222, metalness: 0.4, roughness: 0.08, clearcoat: 1 }),
    Etch: new THREE.MeshStandardMaterial({ name: 'Etch', color: 0x4A4C50, roughness: 0.7 }),
    Screen: new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x020203, roughness: 0.18 }),
    Glass: new THREE.MeshPhysicalMaterial({ name: 'Glass', color: 0x030304, roughness: 0.05, clearcoat: 1 }),
    Dark: new THREE.MeshStandardMaterial({ name: 'Dark', color: 0x0B0B0C, roughness: 0.6 }),
    Flash: new THREE.MeshStandardMaterial({ name: 'Flash', color: 0xF3EAD6, emissive: 0xFFF4DD, emissiveIntensity: 0.15, roughness: 0.25 }),
  };

  const root = new THREE.Group();
  root.name = 'OY0X2';
  const group = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); return g; };
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };

  // Корпус: +Z — экран, -Z — спинка
  add(slab(74.5, 161, 9.5, 6.5, 1.1, 16), 'Frame', 0, 0, 0, 'Frame');
  const ant = group('Antennas');
  for (const sx of [-1, 1]) for (const y of ANTENNA_Y) add(boxG(0.26, 0.8, 5.2), 'Antenna', sx * 37.15, y, 0, null, ant);
  add(slab(73.0, 159.5, 8.8, 0.7, 0.3, 16), 'Body', 0, 0, -3.6, 'Body');
  add(slab(73.0, 159.5, 8.8, 0.7, 0.3, 16), 'Glass', 0, 0, 3.6, 'Glass');

  const sw = 69.4, sh = 155.5;
  const scr = new THREE.ShapeGeometry(rrShape(sw, sh, 7), 12);
  const pos = scr.attributes.position, uv = scr.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + sw / 2) / sw, 1 - (pos.getY(i) + sh / 2) / sh);
  scr.scale(MM, MM, MM);
  add(scr, 'Screen', 0, 0, 3.98, 'Screen');
  const ph = group('FrontPill');
  add(boxG(11.8, 4, 0.06), 'Dark', 0, 72.7, 4.0, null, ph);
  for (const x of [-3.1, 3.1]) add(cylZ(1.1, 0.08, 32), 'Lens', x, 72.7, 4.02, null, ph);

  // Остров камер (со спины — слева сверху)
  add(slab(28.5, 53.5, 7, 1.4, 0.3), 'Frame', 19.25, 48.75, -4.6, 'CamIsland');
  add(slab(26.9, 51.9, 6.2, 0.2), 'CamPlate', 19.25, 48.75, -5.35, 'CamPlate');
  const cams = group('CameraModules');
  for (const [y, r] of [[66, 5], [50.5, 6.9]]) {
    add(cylZ(r + 0.5, 0.6), 'LensRim', 24.6, y, -5.6, null, cams);
    add(cylZ(r - 0.3, 0.1), 'Lens', 24.6, y, -5.95, null, cams);
    add(cylZ(r * 0.3, 0.1), 'LensInner', 24.6, y, -6, null, cams);
  }
  const peri = group('Periscope');
  add(boxG(10.6, 10.6, 0.5), 'LensRim', 24.6, 33.5, -5.6, null, peri);
  add(boxG(9, 9, 0.1), 'Lens', 24.6, 33.5, -5.9, null, peri);
  add(boxG(3.6, 3.6, 0.1), 'LensInner', 24.6, 33.5, -5.95, null, peri);
  const fl = group('Flash');
  add(cylZ(1.5, 0.12, 24), 'Flash', 11.2, 68, -5.5, null, fl);
  const ex = group('EngraveX');
  for (const a of [Math.PI / 4, -Math.PI / 4]) add(boxG(4.6, 0.55, 0.04), 'Etch', 11.2, 44, -5.47, null, ex).rotation.z = a;

  // Верхняя грань: сигнальный фонарь
  add(boxG(14.6, 0.2, 3.8), 'Dark', 0, 80.55, 0);
  const sl = add(boxG(13, 0.36, 2.6), 'SignalLightGlow', 0, 80.5, 0, 'SignalLight');
  sl.geometry.translate(0, 0.18 * MM, 0);

  // Левая грань: кнопки «0» и «1»
  KEY_Y.forEach((y, i) => {
    add(boxG(0.2, 9.2, 3.3), 'Dark', -37.3, y, 0);
    const g = boxG(0.85, 8.4, 2.7);
    g.translate(-0.38 * MM, 0, 0);
    add(g, 'Key', -37.25, y, 0, `Key_${i + 1}`);
    add(cylZ(0.42, 0.2, 16).rotateY(Math.PI / 2), 'KeyIndicator', -37.25, y + 6.2, 0, `KeyIndicator_${i + 1}`);
  });

  // Правая грань
  add(boxG(0.45, 12, 2.7), 'Frame', 37.45, 14, 0, 'PowerButton');
  add(boxG(0.7, 23, 2.5), 'Frame', 37.6, 39, 0, 'VolumeRocker');

  // Нижняя грань
  add(boxG(8.6, 0.1, 2.8), 'Dark', 0, -80.52, 0);
  for (let i = 0; i < 7; i++) add(boxG(1.1, 0.1, 1.1), 'Dark', -11 - i * 2.3, -80.52, 0);

  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X2({ phone, scale, isRunning }) {
  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, SIGNAL_Y * scale + 0.004, 0);
  glow.position.set(0, SIGNAL_Y * scale + 0.01, 0);
  phone.add(beam, glow);

  // Текстуры экрана
  const scrCanvas = { day: document.createElement('canvas'), night: document.createElement('canvas') };
  for (const c of Object.values(scrCanvas)) { c.width = 600; c.height = 1330; }
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
  let accentHex = OX2_COLORS.honey.accent;
  function redrawScreen(accent = accentHex) {
    accentHex = accent;
    drawScreen(scrCanvas.day, 'day', accentHex, 'OY OS 3', KEYS_CARD);
    drawScreen(scrCanvas.night, 'night', accentHex, 'OY OS 3', KEYS_CARD);
    scrTex.day.needsUpdate = true;
    scrTex.night.needsUpdate = true;
  }
  redrawScreen();

  // Спинка — матовое (травлёное) стекло: тонкое зерно рассеивает блик, а лаковый
  // слой сверху даёт мягкие широкие отражения на изгибе к рамке
  const bodyMat = new THREE.MeshPhysicalMaterial({
    name: 'Body', color: OX2_COLORS.honey.body, metalness: 0.1, roughness: 0.42,
    map: shadeTexture(), clearcoat: 1, clearcoatRoughness: 0.1, specularIntensity: 1,
    sheen: 0.4, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xffffff),
    bumpMap: frostTexture(), bumpScale: 0.5, envMapIntensity: 1.5,
  });
  const accentColor = new THREE.Color(OX2_COLORS.honey.accent);
  const chipGlow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: accentColor, emissiveIntensity: 0.3 });
  const vaporGlow = new THREE.MeshStandardMaterial({ color: 0x2A1208, emissive: new THREE.Color(0xFF6A2A), emissiveIntensity: 0, transparent: true, opacity: 0.85 });
  const coilGlow = new THREE.MeshStandardMaterial({ color: 0xB8734A, metalness: 1, roughness: 0.3, emissive: accentColor, emissiveIntensity: 0 });

  const parts = {
    keys: [], keyBase: [], indicatorMats: [],
    frame: null, key: null, antenna: null, signalMat: null,
    layers: [], internals: [],
  };

  const colorTarget = { body: new THREE.Color(), frame: new THREE.Color(), key: new THREE.Color(), rough: 0.46 };
  const signalTarget = new THREE.Color(0xffffff);
  const signalCur = new THREE.Color(0xffffff);
  const ledOff = new THREE.Color(0x3A3A3E);
  const ledReady = new THREE.Color(0xFF7A2D);   // кнопка назначена на действие
  const ledCut = new THREE.Color(0xFF2D2D);     // аппаратный режим: питание отключено

  function setupLayers(root) {
    const anchor = root.getObjectByName('Frame');
    const holder = anchor?.parent || root;
    const internals = buildInternals({ chipGlow, vaporGlow, coilGlow });
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
    });
    parts.frame = byName.Frame || null;
    if (parts.frame) { parts.frame.metalness = 1; parts.frame.roughness = 0.15; parts.frame.envMapIntensity = 1.35; }
    parts.key = byName.Key || null;
    if (parts.key) { parts.key.metalness = 0.85; parts.key.roughness = 0.3; }
    if (byName.LensRim) { const m = byName.LensRim; m.metalness = 1; m.roughness = 0.14; m.envMapIntensity = 1.25; }
    parts.antenna = byName.Antenna || null;
    if (parts.antenna) parts.antenna.emissive = new THREE.Color(0x000000);
    parts.signalMat = byName.SignalLightGlow || null;
    if (parts.signalMat) {
      parts.signalMat.emissive = new THREE.Color(0xffffff);
      parts.signalMat.emissiveIntensity = 0.3;
    }
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
      const m = byName.CamPlate;
      m.color.set(0x020203); m.metalness = 0; m.roughness = 0.04; m.envMapIntensity = 1.4;
      if ('clearcoat' in m) { m.clearcoat = 1; m.clearcoatRoughness = 0.03; }
    }

    for (let i = 1; i <= 2; i++) {
      const k = root.getObjectByName(`Key_${i}`);
      parts.keys.push(k || null);
      parts.keyBase.push(k ? k.position.x : 0);
      const ind = root.getObjectByName(`KeyIndicator_${i}`);
      let mat = null;
      ind?.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.toneMapped = false;
          mat = o.material;
        }
      });
      parts.indicatorMats.push(mat);
    }

    const screenObj = root.getObjectByName('Screen');
    screenObj?.traverse((o) => { if (o.isMesh) o.material = screenMat; });
    screenMat.toneMapped = false;

    applyColorsInstant();
  }

  function setBodyTargets(name) {
    const c = OX2_COLORS[name] || OX2_COLORS.honey;
    colorTarget.body.setHex(c.body);
    colorTarget.frame.setHex(c.frame);
    colorTarget.key.setHex(c.key);
    colorTarget.rough = c.rough;
    accentColor.set(c.accent);
  }
  setBodyTargets('honey');

  function stepColors(k) {
    bodyMat.color.lerp(colorTarget.body, k);
    bodyMat.roughness += (colorTarget.rough - bodyMat.roughness) * k;
    if (parts.frame) parts.frame.color.lerp(colorTarget.frame, k);
    if (parts.key) parts.key.color.lerp(colorTarget.key, k);
    signalCur.lerp(signalTarget, k);
  }
  function applyColorsInstant() { stepColors(1); }

  const tmp = new THREE.Color();
  function update(cur, dt, { reduced }) {
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));

    // Разлёт по слоям
    const ex = clamp01(cur.explode);
    const e = ex * ex * (3 - 2 * ex);
    for (const l of parts.layers) l.o.position.z = l.base + l.off * e;
    for (const m of parts.internals) m.visible = e > 0.01;

    // Tesseract, испарительная камера, катушка и антенны Claw 2.0 светятся
    const now = performance.now();
    chipGlow.emissive.copy(accentColor);
    chipGlow.emissiveIntensity = 0.25 + clamp01(cur.tesseract) * 6;
    vaporGlow.emissiveIntensity = clamp01(cur.vapor) * (1.6 + (reduced ? 0 : Math.sin(now / 420) * 0.4));
    coilGlow.emissive.copy(accentColor);
    coilGlow.emissiveIntensity = clamp01(cur.coil) * 2.5;
    if (parts.antenna) {
      const a = clamp01(cur.antenna);
      parts.antenna.emissive.copy(accentColor);
      parts.antenna.emissiveIntensity = a * (2.2 + Math.sin(now / 260) * 0.8 * (reduced ? 0 : 1));
    }

    // Кнопки: нажатие и индикатор (0 — выкл, 1 — назначено, 2 — аппаратное отключение)
    for (let i = 0; i < 2; i++) {
      const k = parts.keys[i];
      if (k) k.position.x = parts.keyBase[i] + clamp01(cur[`key${i + 1}`]) * KEY_TRAVEL;
      const m = parts.indicatorMats[i];
      if (m) {
        const v = Math.max(0, Math.min(2, cur[`led${i + 1}`]));
        if (v <= 1) tmp.copy(ledOff).lerp(ledReady, v); else tmp.copy(ledReady).lerp(ledCut, v - 1);
        m.color.copy(tmp);
        if (m.emissive) { m.emissive.copy(tmp); m.emissiveIntensity = 0.9 * Math.min(1, v); }
      }
    }

    // Фонарь
    const sig = clamp01(cur.signal);
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
    if (mode !== screenMode) {
      screenMode = mode;
      screenMat.emissiveMap = scrTex[mode];
    }
    screenMat.emissiveIntensity = mode === 'night' ? 0.35 + scr : 0.15 + scr * 0.9;
  }

  return {
    url: '/models/oy0x2.glb?v=ae195d93be',
    state: { key1: 0, key2: 0, led1: 1, led2: 1, signal: 0, screen: 1, explode: 0, tesseract: 0, vapor: 0, coil: 0, antenna: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap: applyColorsInstant,
    api: {
      setBodyColor(name, instant = false) {
        const c = OX2_COLORS[name] ? name : 'honey';
        setBodyTargets(c);
        redrawScreen(OX2_COLORS[c].accent);
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
