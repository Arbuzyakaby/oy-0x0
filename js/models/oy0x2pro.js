/* =========================================================================
   OY 0X2 Pro — описание 3D-модели: матовая стеклянная спинка, титановая
   рамка, гигантская шайба, перегнутая через верхнюю грань, тонированные
   объективы, шкала зума на кольце, экран CPix с двумя фронталками,
   кнопки «0» и «1», антенны Claw 3, сигнальный фонарь на наплыве шайбы,
   разлёт по слоям с Citadel 4, перископом 6–14×, испарительной камерой
   и катушкой XMagnum, экран и процедурная резервная модель.

   CPix. Пока обе фронталки спрятаны, виден цельный экран Screen — ни окон,
   ни стыков. На время открытия показываются экран с окнами ScreenCPix и
   блоки CPix_n: блок гаснет, уходит под экран, отъезжает влево, затем
   камера FrontCam_n поднимается из колодца на 1,3 мм — вровень с экраном.
   ========================================================================= */

import * as THREE from 'three';
import { MM, SIGNAL_COLORS, roundRect, drawScreen, rrShape, slab, boxG, cylZ, labelTexture, drawChip, makeBeam } from './oy0x0.js';
import { frostTexture, shadeTexture } from './oy0x1.js';

// Кольцо шайбы — металл в тон корпуса, как у рамки
export const OX2P_COLORS = {
  sky: { body: 0x44586F, frame: 0x8C96A3, ring: 0xB9C3CF, key: 0xFF6A1F, rough: 0.42, accent: '#8FB4E0' },
  peach: { body: 0xF2B79A, frame: 0xE0B9A2, ring: 0xF0CDB8, key: 0xE5532B, rough: 0.46, accent: '#FFB48A' },
  provence: { body: 0xB9A7D6, frame: 0xBDB2CF, ring: 0xD9D0E8, key: 0x6B4FD8, rough: 0.46, accent: '#C3A6FF' },
  maple: { body: 0x9E2A2B, frame: 0x8F5550, ring: 0xC79A93, key: 0xFFB020, rough: 0.4, accent: '#FF7A66' },
};

const KEYS_CARD = { title: 'Citadel 4 · «Веко»', sub: 'фронталки спрятаны и обесточены', dots: 2 };
const KEY_TRAVEL = 0.0004;
const LOCK_TRAVEL = 0.0009;
export const SIGNAL_Y = 0.08455;     // м, верх наплыва шайбы на верхней грани
const ANTENNA_Y = [72, 60, -60, -72];

// Геометрия (мм) — как в blender/build_oy0x2pro.py
const W = 78.5, H = 166, D = 8.6, R = 11;
const SCR_W = 74.9, SCR_H = 162.2;
export const FRONT_CAMS = { x: 5.6, y: 75.7 };   // центры окон CPix
export const PUCK = { y: 58.21, r: 30 };
const CPIX_TRAVEL = 0.0058;          // м, блок отъезжает влево
const CPIX_SINK = 0.00025;           // м, и уходит под экран
const CAM_DROP = 0.0013;             // м, глубина колодца

// Разлёт по слоям (м, вдоль Z модели: + к экрану, − к спинке)
const LAYER_OFFSET = { glass: 0.06, screen: 0.038, frame: 0, vapor: -0.016, peri: -0.028, board: -0.04, citadel: -0.054, battery: -0.07, coil: -0.086, back: -0.104 };
const LAYER_BY_NAME = {
  Glass: 'glass', FrontCam_1: 'glass', FrontCam_2: 'glass', Earpiece: 'glass',
  Screen: 'screen', ScreenCPix: 'screen', CPix_1: 'screen', CPix_2: 'screen',
  Body: 'back', CamIsland: 'back', CamPlate: 'back', RingScale: 'back', MainCam: 'back', TeleCam: 'back',
  CameraModules: 'back', Periscope: 'back', EngraveX: 'back', Flash: 'back', SignalLight: 'back',
  Vapor: 'vapor', PeriModule: 'peri', Board: 'board', Citadel: 'citadel', Battery: 'battery', Coil: 'coil',
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };

/* ---------- Внутренности ---------- */

function buildInternals({ citadelGlow, vaporGlow, coilGlow, lensGlow }) {
  const boardTex = labelTexture(660, 520, (g, w, h) => {
    g.fillStyle = '#0D1214'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,190,210,.16)'; g.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      const y = 20 + i * 22;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w * (0.2 + (i % 5) * 0.12), y); g.lineTo(w * (0.26 + (i % 5) * 0.12), y + 16); g.lineTo(w, y + 16); g.stroke();
    }
    drawChip(g, 180, 90, 300, 220, 'DIMENSITY', '9600 PRO · 2 нм');
    drawChip(g, 40, 360, 270, 130, 'NC2', 'модем OY');
    drawChip(g, 350, 360, 270, 130, 'UFS 4.1');
  });
  const citTex = labelTexture(680, 300, (g, w, h) => {
    g.fillStyle = '#101114'; g.fillRect(0, 0, w, h);
    roundRect(g, 14, 14, w - 28, h - 28, 20);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1;
    for (let x = 30; x < w - 20; x += 16) { g.beginPath(); g.moveTo(x, 24); g.lineTo(x, h - 24); g.stroke(); }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 92px "Onest", system-ui, sans-serif';
    g.fillText('CITADEL 4', w / 2, h / 2 - 34);
    g.font = '500 30px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.6)';
    g.fillText('256 ГБ · 2500 мАч · веко', w / 2, h / 2 + 48);
  });
  const battTex = labelTexture(620, 760, (g, w, h) => {
    g.fillStyle = '#16171A'; g.fillRect(0, 0, w, h);
    roundRect(g, 24, 24, w - 48, h - 48, 20);
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 3; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F2F2F0';
    g.font = '800 132px "Onest", system-ui, sans-serif';
    g.fillText('9000', w / 2, h / 2 - 50);
    g.font = '600 58px "Onest", system-ui, sans-serif';
    g.fillText('мАч', w / 2, h / 2 + 50);
    g.font = '500 34px "JetBrains Mono", ui-monospace, monospace';
    g.fillStyle = 'rgba(242,242,240,.55)';
    g.fillText('Si-C · 150 Вт · XMagnum 80', w / 2, h / 2 + 140);
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

  const vapor = new THREE.Group();
  vapor.name = 'Vapor';
  vapor.add(new THREE.Mesh(slab(68, 102, 6, 0.5, 0.15), new THREE.MeshStandardMaterial({ color: 0xB8734A, metalness: 1, roughness: 0.32 })));
  vapor.add(new THREE.Mesh(slab(62, 96, 5, 0.6, 0.1), vaporGlow));
  vapor.position.y = 20 * MM;
  vapor.visible = false;

  // Перископ 6–14×: призма, корпус и группа плавающей линзы, которая ездит вдоль оси
  const peri = new THREE.Group();
  peri.name = 'PeriModule';
  const metal = new THREE.MeshStandardMaterial({ color: 0x2A2C30, metalness: 0.9, roughness: 0.35 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9FB6D8, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.55 });
  const tube = new THREE.Mesh(boxG(34, 9, 6), new THREE.MeshStandardMaterial({ color: 0x1C1D21, metalness: 0.6, roughness: 0.45, transparent: true, opacity: 0.45 }));
  peri.add(tube);
  const prism = new THREE.Mesh(boxG(7, 8, 5.4), glassMat);
  prism.position.x = 13 * MM;
  peri.add(prism);
  const lensGroup = new THREE.Group();
  lensGroup.name = 'FloatLens';
  for (const [dx, r] of [[-2, 3.2], [0, 3.6], [2, 3.2]]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(r * MM, r * MM, 1.1 * MM, 32), lensGlow);
    l.rotation.z = Math.PI / 2;
    l.position.x = dx * MM;
    lensGroup.add(l);
  }
  const rail = new THREE.Mesh(boxG(26, 0.6, 0.6), metal);
  rail.position.y = -4 * MM;
  peri.add(rail, lensGroup);
  const sensor = new THREE.Mesh(boxG(1, 7, 5), new THREE.MeshStandardMaterial({ color: 0x0B1222, metalness: 0.4, roughness: 0.2 }));
  sensor.position.x = -16 * MM;
  peri.add(sensor);
  peri.position.set(-6 * MM, 47.6 * MM, 0);
  peri.visible = false;

  const cit = make('Citadel', 46, 20, 2.8, -66, citTex);
  for (const [w, h, x, y] of [[46.8, 0.6, 0, 10.3], [46.8, 0.6, 0, -10.3], [0.6, 21.2, 23.1, 0], [0.6, 21.2, -23.1, 0]]) {
    const m = new THREE.Mesh(boxG(w, h, 3.2), citadelGlow);
    m.position.set(x * MM, y * MM, 0);
    cit.add(m);
  }

  const coil = new THREE.Group();
  coil.name = 'Coil';
  for (let i = 0; i < 6; i++) {
    const r = 16 + i * 2.3;
    coil.add(new THREE.Mesh(new THREE.TorusGeometry(r * MM, 0.55 * MM, 8, 96), coilGlow));
  }
  coil.position.y = -14 * MM;
  coil.visible = false;

  return { list: [vapor, peri, make('Board', 70, 50, 0.9, 52, boardTex), cit, make('Battery', 70, 92, 4.2, -14, battTex), coil], lensGroup };
}

/* ---------- Резервная процедурная модель ---------- */

function screenUV(geo, sw = SCR_W, sh = SCR_H) {
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + sw / 2) / sw, 1 - (pos.getY(i) + sh / 2) / sh);
  return geo;
}

function buildFallback() {
  const mats = {
    Body: new THREE.MeshPhysicalMaterial({ name: 'Body', color: 0x44586F, roughness: 0.42, clearcoat: 1 }),
    Frame: new THREE.MeshStandardMaterial({ name: 'Frame', color: 0x8C96A3, metalness: 1, roughness: 0.3 }),
    Antenna: new THREE.MeshStandardMaterial({ name: 'Antenna', color: 0x2A2C2F, roughness: 0.5 }),
    CamPlate: new THREE.MeshPhysicalMaterial({ name: 'CamPlate', color: 0x050506, roughness: 0.05, clearcoat: 1 }),
    Key: new THREE.MeshStandardMaterial({ name: 'Key', color: 0xFF6A1F, metalness: 0.85, roughness: 0.3 }),
    KeyIndicator: new THREE.MeshStandardMaterial({ name: 'KeyIndicator', color: 0xFF7A2D, emissive: 0xFF7A2D, emissiveIntensity: 1.5 }),
    SignalLightGlow: new THREE.MeshStandardMaterial({ name: 'SignalLightGlow', color: 0xEDEDED, emissive: 0xFFFFFF, emissiveIntensity: 0.4, roughness: 0.15 }),
    Lens: new THREE.MeshPhysicalMaterial({ name: 'Lens', color: 0x030304, roughness: 0.08, clearcoat: 1 }),
    LensRim: new THREE.MeshPhysicalMaterial({ name: 'LensRim', color: 0x0B0C0E, roughness: 0.14, clearcoat: 1 }),
    LensRing: new THREE.MeshPhysicalMaterial({ name: 'LensRing', color: 0x08090B, roughness: 0.16, clearcoat: 1 }),
    LensInner: new THREE.MeshPhysicalMaterial({ name: 'LensInner', color: 0x080A10, roughness: 0.2, clearcoat: 1 }),
    Etch: new THREE.MeshStandardMaterial({ name: 'Etch', color: 0x4A4C50, roughness: 0.7 }),
    Screen: new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x020203, roughness: 0.18 }),
    CPix: new THREE.MeshStandardMaterial({ name: 'CPix', color: 0x020203, roughness: 0.18 }),
    Glass: new THREE.MeshPhysicalMaterial({ name: 'Glass', color: 0x030304, roughness: 0.05, clearcoat: 1 }),
    Dark: new THREE.MeshStandardMaterial({ name: 'Dark', color: 0x0B0B0C, roughness: 0.6 }),
    Flash: new THREE.MeshStandardMaterial({ name: 'Flash', color: 0xF3EAD6, emissive: 0xFFF4DD, emissiveIntensity: 0.15, roughness: 0.25 }),
  };

  const root = new THREE.Group();
  root.name = 'OY0X2Pro';
  const group = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); return g; };
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };

  add(slab(W, H, R, D - 1.2, 0.5, 16), 'Frame', 0, 0, 0, 'Frame');
  const ant = group('Antennas');
  for (const sx of [-1, 1]) for (const y of ANTENNA_Y) add(boxG(0.24, 0.8, 6.2), 'Antenna', sx * (W / 2 - 0.05), y, 0, null, ant);
  add(slab(W - 0.4, H - 0.4, R - 0.2, 0.6, 0.2, 16), 'Body', 0, 0, -D / 2 + 0.3, 'Body');
  add(slab(W - 0.4, H - 0.4, R - 0.2, 0.6, 0.2, 16), 'Glass', 0, 0, D / 2 - 0.3, 'Glass');

  // Экран цельный и экран с окнами, блоки CPix и фронталки
  const zs = D / 2 + 0.03;
  add(screenUV(new THREE.ShapeGeometry(rrShape(SCR_W, SCR_H, R - 1.9), 12)).scale(MM, MM, MM), 'Screen', 0, 0, zs, 'Screen');
  const holed = rrShape(SCR_W, SCR_H, R - 1.9);
  for (const sx of [-1, 1]) {
    const hole = new THREE.Path();
    hole.absarc(sx * FRONT_CAMS.x, FRONT_CAMS.y, 1.55, 0, Math.PI * 2, true);
    holed.holes.push(hole);
  }
  add(screenUV(new THREE.ShapeGeometry(holed, 12)).scale(MM, MM, MM), 'Screen', 0, 0, zs, 'ScreenCPix');
  [-1, 1].forEach((sx, i) => {
    const g = new THREE.ShapeGeometry(rrShape(5.2, 5.2, 1.6), 6);
    g.translate(sx * FRONT_CAMS.x, FRONT_CAMS.y, 0);
    add(screenUV(g).scale(MM, MM, MM), 'CPix', 0, 0, zs + 0.015, `CPix_${i + 1}`);
    const cam = group(`FrontCam_${i + 1}`);
    add(cylZ(1.47, 0.1, 40), 'LensRing', sx * FRONT_CAMS.x, FRONT_CAMS.y, zs - 0.08, null, cam);
    add(cylZ(1.1, 0.06, 40), 'Lens', sx * FRONT_CAMS.x, FRONT_CAMS.y, zs - 0.03, null, cam);
    add(cylZ(0.45, 0.04, 24), 'LensInner', sx * FRONT_CAMS.x, FRONT_CAMS.y, zs - 0.01, null, cam);
  });

  // Шайба (в резервной модели без перегиба — целиком на спинке)
  const py = PUCK.y - 4;
  add(cylZ(PUCK.r, 1.9, 128), 'Frame', 0, py, -D / 2 - 0.65, 'CamIsland');
  add(cylZ(PUCK.r - 1.45, 1.85, 128), 'CamPlate', 0, py, -D / 2 - 0.7, 'CamPlate');
  const cam = (name, x, y, r) => {
    const g = group(name);
    add(cylZ(r + 0.22, 0.04, 96), 'LensRim', x, y, -D / 2 - 1.64, null, g);
    add(cylZ(r - 0.5, 0.04, 96), 'Lens', x, y, -D / 2 - 1.66, null, g);
    add(cylZ(r * 0.15, 0.03, 32), 'LensInner', x, y, -D / 2 - 1.68, null, g);
  };
  cam('MainCam', 11.2, py + 10.6, 8);
  cam('TeleCam', 11.2, py - 10.6, 8);
  cam('CameraModules', -11.2, py + 10.6, 6);
  const peri = group('Periscope');
  add(boxG(12.3, 12.3, 0.04), 'LensRim', -11.2, py - 10.6, -D / 2 - 1.64, null, peri);
  add(boxG(3.6, 3.6, 0.03), 'LensInner', -11.2, py - 10.6, -D / 2 - 1.67, null, peri);
  add(boxG(6, 1.4, 0.06), 'Flash', 0, py - PUCK.r + 4.5, -D / 2 - 1.6, 'Flash');
  const scale = group('RingScale');
  scale.position.set(0, py * MM, 0);
  for (let i = 0; i < 11; i++) {
    const a = (200 + i * 14) * Math.PI / 180;
    const m = add(boxG(0.25, i % 2 ? 0.6 : 1.1, 0.03), 'Etch', 29.25 * Math.cos(a), 29.25 * Math.sin(a), -D / 2 - 2.0, null, scale);
    m.rotation.z = a - Math.PI / 2;
  }

  const sl = add(boxG(12, 0.06, 1.3), 'SignalLightGlow', 0, SIGNAL_Y / MM, -1.0, 'SignalLight');
  sl.geometry.translate(0, 0.03 * MM, 0);

  [46, 32].forEach((y, i) => {
    add(boxG(0.2, 9.2, 3.1), 'Dark', -W / 2 - 0.05, y, 0);
    const g = boxG(0.85, 8.4, 2.5);
    g.translate(-0.38 * MM, 0, 0);
    add(g, 'Key', -W / 2, y, 0, `Key_${i + 1}`);
    add(cylZ(0.55, 0.24, 16).rotateY(Math.PI / 2), 'KeyIndicator', -W / 2 - 0.02, y + 6.1, 0, `KeyIndicator_${i + 1}`);
  });
  add(boxG(0.42, 12, 2.5), 'Frame', W / 2 + 0.21, 18, 0, 'PowerButton');
  add(boxG(0.7, 23, 2.3), 'Frame', W / 2 + 0.35, 43, 0, 'VolumeRocker');
  add(boxG(8.6, 0.1, 2.8), 'Dark', 0, -H / 2 - 0.02, 0);

  return root;
}

/* ---------- Описание модели для сцены ---------- */

export function createOY0X2Pro({ phone, scale, isRunning }) {
  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, SIGNAL_Y * scale + 0.004, -0.01);
  glow.position.set(0, SIGNAL_Y * scale + 0.01, -0.01);
  phone.add(beam, glow);

  const scrCanvas = { day: document.createElement('canvas'), night: document.createElement('canvas') };
  for (const c of Object.values(scrCanvas)) { c.width = 600; c.height = 1300; }
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
  screenMat.toneMapped = false;
  // Блоки CPix — те же пиксели, но гаснут отдельно от экрана
  const cpixMats = [screenMat.clone(), screenMat.clone()];
  let screenMode = 'day';
  let accentHex = OX2P_COLORS.sky.accent;
  function redrawScreen(accent = accentHex) {
    accentHex = accent;
    drawScreen(scrCanvas.day, 'day', accentHex, 'OY OS 3 · Citadel 4', KEYS_CARD);
    drawScreen(scrCanvas.night, 'night', accentHex, 'OY OS 3 · Citadel 4', KEYS_CARD);
    scrTex.day.needsUpdate = true;
    scrTex.night.needsUpdate = true;
  }
  redrawScreen();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    name: 'Body', color: OX2P_COLORS.sky.body, metalness: 0.12, roughness: 0.42,
    map: shadeTexture(), clearcoat: 1, clearcoatRoughness: 0.1, specularIntensity: 1,
    sheen: 0.35, sheenRoughness: 0.35, sheenColor: new THREE.Color(0xffffff),
    bumpMap: frostTexture(), bumpScale: 0.45, envMapIntensity: 1.5,
  });
  const ringMat = new THREE.MeshPhysicalMaterial({
    name: 'Ring', color: OX2P_COLORS.sky.ring, metalness: 1, roughness: 0.12,
    clearcoat: 0.6, clearcoatRoughness: 0.05, envMapIntensity: 1.6,
  });
  // Тонированные объективы: тёмный глянец под стеклом диска. Кольца чуть отсвечивают металлом,
  // стекло — синевой: читаются, но не спорят с шайбой
  const tint = (hex, { rough = 0.1, metal = 0, env = 0.9 } = {}) => new THREE.MeshPhysicalMaterial({
    color: hex, metalness: metal, roughness: rough, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: env,
  });
  const lensMats = {
    Lens: tint(0x060912, { rough: 0.04, env: 1.4 }),
    LensRim: tint(0x2A2D33, { rough: 0.26, metal: 0.8, env: 1.1 }),
    LensRing: tint(0x16181C, { rough: 0.2, metal: 0.6 }),
    LensInner: tint(0x14203A, { rough: 0.12, metal: 0.3, env: 1.2 }),
  };
  const accentColor = new THREE.Color(OX2P_COLORS.sky.accent);
  const citadelGlow = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: accentColor, emissiveIntensity: 0.3 });
  const vaporGlow = new THREE.MeshStandardMaterial({ color: 0x2A1208, emissive: new THREE.Color(0xFF6A2A), emissiveIntensity: 0, transparent: true, opacity: 0.85 });
  const coilGlow = new THREE.MeshStandardMaterial({ color: 0xB8734A, metalness: 1, roughness: 0.3, emissive: accentColor, emissiveIntensity: 0 });
  const lensGlow = new THREE.MeshPhysicalMaterial({ color: 0xBFD6FF, metalness: 0, roughness: 0.05, emissive: accentColor, emissiveIntensity: 0.2, transparent: true, opacity: 0.8 });

  // «Зрачок» поднятой фронталки: следит за курсором на первом слое страницы
  const pupil = new THREE.Group();
  const pupilDisc = new THREE.Mesh(new THREE.CircleGeometry(0.5 * MM, 32), new THREE.MeshBasicMaterial({ color: 0x0B1830 }));
  const pupilGlint = new THREE.Mesh(new THREE.CircleGeometry(0.13 * MM, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  pupilGlint.position.set(0.18 * MM, 0.2 * MM, 0.002 * MM);
  pupil.add(pupilDisc, pupilGlint);
  pupil.visible = false;
  const pupilTarget = new THREE.Vector2();
  const pupilCur = new THREE.Vector2();

  const parts = {
    keys: [], keyBase: [], indicatorMats: [],
    frame: null, keyMat: null, antenna: null, signalMat: null,
    layers: [], internals: [], lensGroup: null,
    screen: null, screenCPix: null, cpix: [], cpixBase: [], cams: [], camBase: [], ringScale: null,
  };

  const colorTarget = { body: new THREE.Color(), frame: new THREE.Color(), ring: new THREE.Color(), key: new THREE.Color(), rough: 0.42 };
  const signalTarget = new THREE.Color(0xffffff);
  const signalCur = new THREE.Color(0xffffff);
  const ledOff = new THREE.Color(0x3A3A3E);
  const ledReady = new THREE.Color(0xFF7A2D);
  const ledCut = new THREE.Color(0xFF2D2D);

  function setupLayers(root) {
    const anchor = root.getObjectByName('Frame');
    const holder = anchor?.parent || root;
    const { list, lensGroup } = buildInternals({ citadelGlow, vaporGlow, coilGlow, lensGlow });
    holder.add(...list);
    parts.internals = list;
    parts.lensGroup = lensGroup;
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
      const swap = (m) => (m?.name === 'Body' ? bodyMat : lensMats[m?.name] || m);
      o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    });
    root.getObjectByName('CamIsland')?.traverse((o) => { if (o.isMesh) o.material = ringMat; });
    parts.frame = byName.Frame || null;
    if (parts.frame) { parts.frame.metalness = 1; parts.frame.roughness = 0.26; parts.frame.envMapIntensity = 1.3; }
    parts.keyMat = byName.Key || null;
    if (parts.keyMat) { parts.keyMat.metalness = 0.85; parts.keyMat.roughness = 0.3; }
    if (byName.Etch) { byName.Etch.color.set(0x8E9196); byName.Etch.roughness = 0.5; }
    parts.antenna = byName.Antenna || null;
    if (parts.antenna) parts.antenna.emissive = new THREE.Color(0x000000);
    parts.signalMat = byName.SignalLightGlow || null;
    if (parts.signalMat) { parts.signalMat.emissive = new THREE.Color(0xffffff); parts.signalMat.emissiveIntensity = 0.3; }
    if (byName.CamPlate) {
      const m = byName.CamPlate;
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

      const block = root.getObjectByName(`CPix_${i}`);
      block?.traverse((o) => { if (o.isMesh) o.material = cpixMats[i - 1]; });
      parts.cpix.push(block || null);
      parts.cpixBase.push(block ? { x: block.position.x } : { x: 0 });
      const cam = root.getObjectByName(`FrontCam_${i}`);
      parts.cams.push(cam || null);
    }
    for (const name of ['Screen', 'ScreenCPix']) {
      root.getObjectByName(name)?.traverse((o) => { if (o.isMesh) o.material = screenMat; });
    }
    parts.screen = root.getObjectByName('Screen');
    parts.screenCPix = root.getObjectByName('ScreenCPix');
    parts.ringScale = root.getObjectByName('RingScale');

    // зрачок — над левой фронталкой (центр окна, чуть перед объективом)
    if (parts.cams[0]) {
      pupil.position.set(-FRONT_CAMS.x * MM, FRONT_CAMS.y * MM, (D / 2 + 0.01) * MM);
      parts.cams[0].add(pupil);
    }

    applyColorsInstant();
  }

  function setBodyTargets(name) {
    const c = OX2P_COLORS[name] || OX2P_COLORS.sky;
    colorTarget.body.setHex(c.body);
    colorTarget.frame.setHex(c.frame);
    colorTarget.ring.setHex(c.ring);
    colorTarget.key.setHex(c.key);
    colorTarget.rough = c.rough;
    accentColor.set(c.accent);
  }
  setBodyTargets('sky');

  function stepColors(k) {
    bodyMat.color.lerp(colorTarget.body, k);
    bodyMat.roughness += (colorTarget.rough - bodyMat.roughness) * k;
    ringMat.color.lerp(colorTarget.ring, k);
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

    // Экран
    const scr = clamp01(cur.screen);
    const mode = scr < 0.35 ? 'night' : 'day';
    if (mode !== screenMode) {
      screenMode = mode;
      screenMat.emissiveMap = scrTex[mode];
      for (const m of cpixMats) m.emissiveMap = scrTex[mode];
    }
    const glowI = mode === 'night' ? 0.35 + scr : 0.15 + scr * 0.9;
    screenMat.emissiveIntensity = glowI;

    // CPix: пока обе камеры спрятаны — цельный экран; иначе окна, блоки и подъём камер
    const open = [clamp01(cur.cpix1), clamp01(cur.cpix2)];
    const anyOpen = open[0] > 0.001 || open[1] > 0.001;
    if (parts.screen) parts.screen.visible = !anyOpen;
    if (parts.screenCPix) parts.screenCPix.visible = anyOpen;
    for (let i = 0; i < 2; i++) {
      const o = open[i];
      const fade = smooth(o / 0.3);
      const slide = smooth((o - 0.2) / 0.45);
      const rise = smooth((o - 0.6) / 0.4);
      const block = parts.cpix[i];
      if (block) {
        block.visible = anyOpen;
        block.position.x = parts.cpixBase[i].x - CPIX_TRAVEL * slide;
        if (fade > 0.001) block.position.z -= CPIX_SINK;
        cpixMats[i].emissiveIntensity = glowI * (1 - 0.92 * fade);
      }
      const cam = parts.cams[i];
      if (cam) {
        cam.visible = anyOpen;
        cam.position.z -= CAM_DROP * (1 - rise);
      }
    }
    pupil.visible = open[0] > 0.98 && !reduced;
    if (pupil.visible) {
      pupilCur.lerp(pupilTarget, 1 - Math.exp(-dt * 8));
      pupil.position.x = -FRONT_CAMS.x * MM + pupilCur.x * 0.28 * MM;
      pupil.position.y = FRONT_CAMS.y * MM + pupilCur.y * 0.28 * MM;
    }

    // Шкала зума на кольце: 0,5× → 14× — поворот на 140°
    if (parts.ringScale) parts.ringScale.rotation.z = -clamp01(cur.zoom) * 2.44;
    if (parts.lensGroup) parts.lensGroup.position.x = (-6 + 12 * clamp01(cur.zoom)) * MM;
    lensGlow.emissive.copy(accentColor);
    lensGlow.emissiveIntensity = 0.2 + clamp01(cur.peri) * 2.4;

    // Citadel 4, испарительная камера, катушка, антенны Claw 3
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

    // Фонарь; sos — «· · · — — — · · ·» от Citadel 4
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
  }

  return {
    url: '/models/oy0x2pro.glb?v=7f499208c9',
    state: { key1: 0, key2: 0, lock1: 0, lock2: 0, led1: 1, led2: 1, signal: 0, sos: 0, screen: 1, explode: 0, citadel: 0, vapor: 0, coil: 0, antenna: 0, cpix1: 0, cpix2: 0, zoom: 0, peri: 0 },
    parts,
    setup,
    buildFallback,
    update,
    snap: applyColorsInstant,
    api: {
      setBodyColor(name, instant = false) {
        const c = OX2P_COLORS[name] ? name : 'sky';
        setBodyTargets(c);
        redrawScreen(OX2P_COLORS[c].accent);
        if (instant || !isRunning()) applyColorsInstant();
      },
      setSignalColor(name, instant = false) {
        signalTarget.setHex(SIGNAL_COLORS[name] || SIGNAL_COLORS.white);
        if (instant || !isRunning()) signalCur.copy(signalTarget);
      },
      setPupil(x, y) { pupilTarget.set(x, -y); },
      redrawScreen,
    },
  };
}
