/* =========================================================================
   OY 0X0 — 3D-сцена (Three.js)
   Одна модель на fixed-canvas. Внешний код задаёт целевое состояние (поза,
   шторка, ползунки, фонарь, экран), сцена плавно догоняет его каждый кадр.
   ========================================================================= */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const BODY_COLORS = {
  red: {
    body: 0xB3202A, frame: 0xC8343E, shutter: 0xB3202A,
    bodyMetal: 0.72, bodyRough: 0.42, frameMetal: 0.95, frameRough: 0.2,
    accent: '#FF6B73',
  },
  ice: {
    body: 0xDCE6EC, frame: 0xEEF3F6, shutter: 0xD3DEE5,
    bodyMetal: 0.62, bodyRough: 0.38, frameMetal: 1.0, frameRough: 0.16,
    accent: '#9CC7DD',
  },
};

const SIGNAL_COLORS = { white: 0xFFFFFF, red: 0xFF2A2A };

const MODEL_SCALE = 10;           // модель в метрах -> 1.46 единицы по высоте
const SHUTTER_TRAVEL = 0.023;     // м, ход шторки по X (см. blender/build_oy0x0.py)
const SWITCH_TRAVEL = 0.0024;     // м, ход ползунка
const SIGNAL_Y = 0.0734;          // м, верхняя грань

export const DEFAULT_STATE = {
  x: 0, y: 0, fx: 0, fy: 0, fz: 0,
  rx: 0, ry: 0, rz: 0, s: 1, dist: 5.4,
  shutter: 0, sw1: 1, sw2: 1, sw3: 1,
  signal: 0, screen: 1, float: 1,
};

/* ---------- Текстура экрана (интерфейс OY OS) ---------- */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawScreen(canvas, mode, accent) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const night = mode === 'night';
  const ink = night ? '#FF3B30' : '#F2F2F0';
  const dim = night ? 'rgba(255,59,48,.55)' : 'rgba(242,242,240,.58)';
  const sans = '"Onest", system-ui, sans-serif';
  const mono = '"JetBrains Mono", ui-monospace, monospace';

  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, night ? '#070000' : '#111116');
  bg.addColorStop(1, night ? '#000000' : '#040405');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (!night) {
    const g = ctx.createRadialGradient(W * 0.75, H * 0.12, 10, W * 0.75, H * 0.12, W * 1.1);
    g.addColorStop(0, accent + '88');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Статус-бар
  ctx.fillStyle = ink;
  ctx.font = `600 28px ${sans}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText('14:02', 46, 62);
  ctx.textAlign = 'right';
  ctx.font = `600 24px ${mono}`;
  ctx.fillText('5G', W - 110, 62);
  roundRect(ctx, W - 92, 50, 46, 24, 7);
  ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillRect(W - 88, 54, 30, 16);

  // Часы
  ctx.textAlign = 'center';
  ctx.font = `700 190px ${sans}`;
  ctx.fillText('14:02', W / 2, 300);
  ctx.font = `500 30px ${sans}`;
  ctx.fillStyle = dim;
  ctx.fillText(night ? 'Ночной режим · 0,5 нит' : 'OY OS', W / 2, 420);

  // Знак 0X0
  const cy = 560;
  ctx.lineWidth = 7;
  ctx.strokeStyle = night ? ink : accent;
  ctx.beginPath(); ctx.arc(W / 2 - 92, cy, 44, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2 + 92, cy, 44, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = ink;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 20, cy - 26); ctx.lineTo(W / 2 + 20, cy + 26);
  ctx.moveTo(W / 2 + 20, cy - 26); ctx.lineTo(W / 2 - 20, cy + 26);
  ctx.stroke();

  // Карточки
  const card = (y, h, title, lines) => {
    roundRect(ctx, 40, y, W - 80, h, 34);
    ctx.fillStyle = night ? 'rgba(255,40,30,.08)' : 'rgba(255,255,255,.07)';
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.font = `600 30px ${sans}`;
    ctx.fillText(title, 76, y + 50);
    ctx.font = `400 22px ${mono}`;
    ctx.fillStyle = dim;
    lines.forEach((l, i) => ctx.fillText(l, 76, y + 96 + i * 36));
  };
  card(700, 190, 'Журнал доступа', ['Камера — Сканер QR — 14:02', 'Геолокация — отклонено — 14:05']);
  card(920, 150, 'Kill Switches', ['камера+мик · связь · гео']);
  // индикаторы
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(W - 160 + i * 36, 970, 10, 0, Math.PI * 2);
    ctx.fillStyle = night ? ink : '#4ADE9B';
    ctx.fill();
  }

  // Док
  for (let i = 0; i < 4; i++) {
    const x = 70 + i * ((W - 140 - 96) / 3);
    roundRect(ctx, x, H - 160, 96, 96, 28);
    ctx.fillStyle = night ? 'rgba(255,40,30,.14)' : 'rgba(255,255,255,.12)';
    ctx.fill();
  }
}

/* ---------- Резервная процедурная модель ---------- */

const MM = 0.001;

function rrShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Скруглённая пластина (мм), центрирована по Z. */
function slab(w, h, r, depth, bevel = 0, seg = 10) {
  const b = Math.min(bevel, depth / 2 - 0.01);
  const g = new THREE.ExtrudeGeometry(
    rrShape(w - 2 * b, h - 2 * b, Math.max(r - b, 0.1)),
    { depth: depth - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: seg },
  );
  g.translate(0, 0, -(depth - 2 * b) / 2);
  g.scale(MM, MM, MM);
  return g;
}

function boxG(sx, sy, sz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.scale(MM, MM, MM);
  return g;
}

function cylZ(r, depth, seg = 64) {
  const g = new THREE.CylinderGeometry(r, r, depth, seg);
  g.rotateX(Math.PI / 2);
  g.scale(MM, MM, MM);
  return g;
}

function buildFallbackModel() {
  const mats = {
    Body: new THREE.MeshPhysicalMaterial({ name: 'Body', color: 0xB3202A, metalness: 0.72, roughness: 0.42 }),
    Frame: new THREE.MeshPhysicalMaterial({ name: 'Frame', color: 0xC8343E, metalness: 0.95, roughness: 0.2 }),
    Shutter: new THREE.MeshPhysicalMaterial({ name: 'Shutter', color: 0xB3202A, metalness: 0.8, roughness: 0.34 }),
    Switch: new THREE.MeshStandardMaterial({ name: 'Switch', color: 0x2A2B2E, metalness: 0.8, roughness: 0.35 }),
    SwitchIndicator: new THREE.MeshStandardMaterial({ name: 'SwitchIndicator', color: 0xFF2D2D, emissive: 0xFF2D2D, emissiveIntensity: 1.5 }),
    SignalLightGlow: new THREE.MeshStandardMaterial({ name: 'SignalLightGlow', color: 0xEDEDED, emissive: 0xFFFFFF, emissiveIntensity: 0.4, roughness: 0.15 }),
    Lens: new THREE.MeshPhysicalMaterial({ name: 'Lens', color: 0x05070A, roughness: 0.03, clearcoat: 1 }),
    LensRing: new THREE.MeshStandardMaterial({ name: 'LensRing', color: 0xD9DCE0, metalness: 1, roughness: 0.12 }),
    Screen: new THREE.MeshStandardMaterial({ name: 'Screen', color: 0x020203, roughness: 0.18 }),
    Glass: new THREE.MeshPhysicalMaterial({ name: 'Glass', color: 0x030304, roughness: 0.05, clearcoat: 1 }),
    Dark: new THREE.MeshStandardMaterial({ name: 'Dark', color: 0x0B0B0C, roughness: 0.6 }),
    Engrave: new THREE.MeshStandardMaterial({ name: 'Engrave', color: 0x1A1A1C, metalness: 0.6, roughness: 0.55 }),
    Flash: new THREE.MeshStandardMaterial({ name: 'Flash', color: 0xF3EAD6, emissive: 0xFFF4DD, emissiveIntensity: 0.15, roughness: 0.25 }),
  };

  const root = new THREE.Group();
  root.name = 'OY0X0';
  const add = (geo, mat, x = 0, y = 0, z = 0, name, parent = root) => {
    const m = new THREE.Mesh(geo, mats[mat]);
    m.position.set(x * MM, y * MM, z * MM);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };

  // Корпус: +Z — экран, -Z — спинка
  add(slab(70, 146, 9.5, 9, 0.6, 14), 'Frame', 0, 0, 0, 'Frame');
  add(slab(68.4, 144.4, 8.7, 0.4, 0.15, 14), 'Body', 0, 0, -4.42, 'Body');
  add(slab(68.4, 144.4, 8.7, 0.4, 0.15, 14), 'Glass', 0, 0, 4.42, 'Glass');

  // Экран с UV 0..1 (v = 0 сверху, как в GLB)
  const sw = 66, sh = 141.8;
  const scr = new THREE.ShapeGeometry(rrShape(sw, sh, 7.5), 12);
  const pos = scr.attributes.position;
  const uv = scr.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + sw / 2) / sw, 1 - (pos.getY(i) + sh / 2) / sh);
  }
  scr.scale(MM, MM, MM);
  add(scr, 'Screen', 0, 0, 4.66, 'Screen');
  add(boxG(3.6, 3.6, 0.06), 'Dark', 0, 67.7, 4.68, 'FrontCamera');

  // Камеры «0X0»: вертикальная пара на острове (со спины — слева сверху)
  const CX = 20.5, CZ = 45;
  add(slab(19.2, 41.2, 9.6, 0.4, 0.15, 16), 'Frame', CX, CZ, -4.77, 'CameraIsland');
  const lensGeo = (() => {
    const R = 39.2, th = 0.128;
    const g = new THREE.SphereGeometry(R, 48, 4, 0, Math.PI * 2, 0, th);
    g.translate(0, -R * Math.cos(th), 0);
    g.rotateX(-Math.PI / 2);
    g.scale(MM, MM, MM);
    return g;
  })();
  for (const dz of [11, -11]) {
    const cz = CZ + dz;
    add(cylZ(8, 0.6), 'Frame', CX, cz, -5.22);
    add(cylZ(6.8, 0.12), 'Dark', CX, cz, -5.52);
    const ring = new THREE.TorusGeometry(5.42, 0.42, 12, 64); ring.scale(MM, MM, MM);
    add(ring, 'LensRing', CX, cz, -5.62);
    add(lensGeo, 'Lens', CX, cz, -5.54);
    const ring2 = new THREE.TorusGeometry(2.35, 0.12, 8, 48); ring2.scale(MM, MM, MM);
    add(ring2, 'LensRing', CX, cz, -5.86);
  }
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const x = add(boxG(5.2, 0.7, 0.05), 'Engrave', CX, CZ, -4.99);
    x.rotation.z = a;
  }
  add(cylZ(1.25, 0.25, 24), 'Flash', CX, 19.2, -4.72, 'Flash');

  // Шторка: пазы заподлицо со спинкой, полозья под краями шторки; едет по X
  for (const dz of [22.6, -22.6]) add(boxG(45, 0.6, 0.06), 'Engrave', 7.5, CZ + dz, -4.62);
  const shutter = new THREE.Group();
  shutter.name = 'Shutter';
  shutter.position.set(-2.5 * MM, CZ * MM, 0);
  root.add(shutter);
  add(slab(23, 48.4, 4, 0.5, 0.2, 10), 'Shutter', 0, 0, -6.2, null, shutter);
  for (const dz of [22.6, -22.6]) add(boxG(15, 0.5, 1.4), 'Shutter', 0, dz, -5.3, null, shutter);
  // Верхняя грань: сигнальный фонарь, 3,5 мм, ИК
  add(boxG(14.6, 0.2, 4), 'Dark', 0, 73.05, 0);
  const sl = add(boxG(13, 0.4, 2.8), 'SignalLightGlow', 0, 73, 0, 'SignalLight');
  sl.geometry.translate(0, 0.2 * MM, 0);
  add(new THREE.CylinderGeometry(1.75 * MM, 1.75 * MM, 0.2 * MM, 24), 'Dark', 22, 73.02, 0);
  add(boxG(3.4, 0.15, 2), 'Dark', -22, 73.04, 0);

  // Левая грань: kill switches
  [40, 26, 12].forEach((z, i) => {
    add(boxG(0.2, 9.6, 3.4), 'Dark', -35.02, z, 0);
    const g = boxG(1.1, 4.8, 2.6);
    g.translate(-0.5 * MM, 0, 0);
    const sw = add(g, 'Switch', -35, z + 1.2, 0, `Switch_${i + 1}`);
    add(boxG(0.1, 3, 1.2), 'SwitchIndicator', -1.08, 0, 0, `SwitchIndicator_${i + 1}`, sw);
  });

  // Правая грань: кнопка питания со сканером, громкость
  add(boxG(0.45, 12, 2.8), 'Frame', 35.2, 16, 0, 'PowerButton');
  add(boxG(0.75, 22, 2.6), 'Frame', 35.37, 38, 0, 'VolumeRocker');

  // Нижняя грань: USB-C, динамики
  add(boxG(8.6, 0.1, 2.8), 'Dark', 0, -73.02, 0);
  for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) add(boxG(1.1, 0.1, 1.1), 'Dark', sx * (11 + i * 2.3), -73.02, 0);

  return root;
}

/* ---------- Луч и свечение фонаря ---------- */

function makeBeam() {
  const geo = new THREE.CylinderGeometry(0.85, 0.035, 14, 48, 1, true);
  geo.translate(0, 7, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0xffffff) }, uIntensity: { value: 0 } },
    vertexShader: /* glsl */`
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vAlong = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uIntensity;
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float along = pow(1.0 - vAlong, 1.25) * smoothstep(0.0, 0.015, vAlong);
        float edge = pow(abs(dot(normalize(vN), normalize(vView))), 2.4);
        float a = along * edge * uIntensity * 0.75;
        gl_FragColor = vec4(uColor * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(geo, mat);
  beam.frustumCulled = false;
  beam.renderOrder = 10;

  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  glow.scale.set(0.42, 0.42, 1);
  glow.renderOrder = 11;
  return { beam, glow, beamMat: mat };
}

/* ---------- Сцена ---------- */

export function createStage(canvas, { forceFallback = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
  roomEnv.dispose?.();
  pmrem.dispose();
  scene.environmentIntensity = 0.95;

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight(0xffffff, 1.8);
  rim.position.set(-5, 2.5, -4);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-2, -3, 3);
  scene.add(key, rim, fill);

  const phone = new THREE.Group();
  const modelRoot = new THREE.Group();
  modelRoot.scale.setScalar(MODEL_SCALE);
  phone.add(modelRoot);
  scene.add(phone);

  const { beam, glow, beamMat } = makeBeam();
  beam.position.set(0, SIGNAL_Y * MODEL_SCALE + 0.004, 0);
  glow.position.set(0, SIGNAL_Y * MODEL_SCALE + 0.01, 0);
  phone.add(beam, glow);

  // Текстуры экрана
  const scrCanvas = { day: document.createElement('canvas'), night: document.createElement('canvas') };
  for (const c of Object.values(scrCanvas)) { c.width = 600; c.height = 1290; }
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
  let accentHex = BODY_COLORS.red.accent;
  function redrawScreen(accent = accentHex) {
    accentHex = accent;
    drawScreen(scrCanvas.day, 'day', accentHex);
    drawScreen(scrCanvas.night, 'night', accentHex);
    scrTex.day.needsUpdate = true;
    scrTex.night.needsUpdate = true;
  }
  redrawScreen();

  const parts = {
    shutter: null, shutterBase: 0,
    switches: [], switchBase: [], indicatorMats: [],
    body: [], frame: [], shutterMats: [],
    signalMat: null,
  };

  // Состояние: target задаёт скролл, cur догоняет его
  const target = { ...DEFAULT_STATE };
  const cur = { ...DEFAULT_STATE };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let reduced = false;

  const colorTarget = { body: new THREE.Color(), frame: new THREE.Color(), shutter: new THREE.Color(), bodyMetal: 0.7, bodyRough: 0.4, frameMetal: 0.95, frameRough: 0.2 };
  const signalTarget = new THREE.Color(0xffffff);
  const signalCur = new THREE.Color(0xffffff);
  const indicatorOn = new THREE.Color(0xFF2D2D);
  const indicatorOff = new THREE.Color(0x3A3A3E);

  function setupModel(root) {
    modelRoot.add(root);
    const byName = {};
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) if (m && m.name && !byName[m.name]) byName[m.name] = m;
    });

    parts.body = byName.Body ? [byName.Body] : [];
    parts.frame = byName.Frame ? [byName.Frame] : [];
    parts.shutterMats = byName.Shutter ? [byName.Shutter] : [];
    parts.signalMat = byName.SignalLightGlow || null;
    if (parts.signalMat) {
      parts.signalMat.emissive = new THREE.Color(0xffffff);
      parts.signalMat.emissiveIntensity = 0.3;
    }
    if (byName.Lens) byName.Lens.envMapIntensity = 1.4;
    if (byName.LensRing) byName.LensRing.envMapIntensity = 1.3;

    parts.shutter = root.getObjectByName('Shutter');
    parts.shutterBase = parts.shutter ? parts.shutter.position.x : 0;

    for (let i = 1; i <= 3; i++) {
      const sw = root.getObjectByName(`Switch_${i}`);
      parts.switches.push(sw || null);
      parts.switchBase.push(sw ? sw.position.y : 0);
      const ind = root.getObjectByName(`SwitchIndicator_${i}`);
      let mat = null;
      ind?.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          mat = o.material;
        }
      });
      parts.indicatorMats.push(mat);
    }

    const screen = root.getObjectByName('Screen');
    screen?.traverse((o) => { if (o.isMesh) o.material = screenMat; });
    screenMat.toneMapped = false;

    applyColorsInstant();
  }

  function setBodyTargets(name) {
    const c = BODY_COLORS[name] || BODY_COLORS.red;
    colorTarget.body.setHex(c.body);
    colorTarget.frame.setHex(c.frame);
    colorTarget.shutter.setHex(c.shutter);
    colorTarget.bodyMetal = c.bodyMetal;
    colorTarget.bodyRough = c.bodyRough;
    colorTarget.frameMetal = c.frameMetal;
    colorTarget.frameRough = c.frameRough;
  }
  setBodyTargets('red');

  function stepColors(k) {
    for (const m of parts.body) {
      m.color.lerp(colorTarget.body, k);
      m.metalness += (colorTarget.bodyMetal - m.metalness) * k;
      m.roughness += (colorTarget.bodyRough - m.roughness) * k;
    }
    for (const m of parts.frame) {
      m.color.lerp(colorTarget.frame, k);
      m.metalness += (colorTarget.frameMetal - m.metalness) * k;
      m.roughness += (colorTarget.frameRough - m.roughness) * k;
    }
    for (const m of parts.shutterMats) {
      m.color.lerp(colorTarget.shutter, k);
      m.metalness += (colorTarget.bodyMetal + 0.08 - m.metalness) * k;
      m.roughness += (colorTarget.bodyRough - 0.06 - m.roughness) * k;
    }
    signalCur.lerp(signalTarget, k);
  }
  function applyColorsInstant() { stepColors(1); }

  /* ---- Применение состояния ---- */
  const focus = new THREE.Vector3();
  const clock = new THREE.Clock();
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  function update(dt) {
    const k = reduced ? 1 : 1 - Math.exp(-dt * 5.5);
    for (const key in target) cur[key] += (target[key] - cur[key]) * k;
    const pk = 1 - Math.exp(-dt * 3);
    pointer.x += (pointer.tx - pointer.x) * pk;
    pointer.y += (pointer.ty - pointer.y) * pk;
    stepColors(reduced ? 1 : 1 - Math.exp(-dt * 6));

    const t = clock.elapsedTime;
    const fl = reduced ? 0 : Math.max(0, Math.min(1, cur.float));
    const idleY = Math.sin(t * 0.5) * 0.1 * fl;
    const idleX = Math.sin(t * 0.37) * 0.035 * fl;
    const bob = Math.sin(t * 0.8) * 0.018 * fl;

    phone.rotation.set(
      cur.rx + idleX + pointer.y * 0.1 * fl,
      cur.ry + idleY + pointer.x * 0.22 * fl,
      cur.rz,
    );
    phone.scale.setScalar(cur.s);

    camera.position.set(0, 0, cur.dist);
    camera.lookAt(0, 0, 0);
    const halfH = tanHalf * cur.dist;
    const halfW = halfH * camera.aspect;
    focus.set(cur.fx, cur.fy, cur.fz).applyEuler(phone.rotation).multiplyScalar(cur.s);
    phone.position.set(cur.x * halfW - focus.x, cur.y * halfH - focus.y + bob, -focus.z);

    // Механика
    if (parts.shutter) parts.shutter.position.x = parts.shutterBase + clamp01(cur.shutter) * SHUTTER_TRAVEL;
    for (let i = 0; i < 3; i++) {
      const v = clamp01(cur[`sw${i + 1}`]);
      const sw = parts.switches[i];
      if (sw) sw.position.y = parts.switchBase[i] - (1 - v) * SWITCH_TRAVEL;
      const m = parts.indicatorMats[i];
      if (m) {
        m.color.copy(indicatorOff).lerp(indicatorOn, v);
        if (m.emissive) { m.emissive.copy(indicatorOn); m.emissiveIntensity = 1.6 * v; }
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

  /* ---- Цикл рендера ---- */
  let raf = 0;
  let last = 0;
  let wantActive = true;
  let modelReady = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    renderer.render(scene, camera);
  }

  function start() {
    if (raf || !modelReady) return;
    snap();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function snap() {
    Object.assign(cur, target);
    applyColorsInstant();
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (modelReady && !raf) { update(0); renderer.render(scene, camera); }
  }
  resize();

  /* ---- Загрузка модели ---- */
  const ready = (async () => {
    let fallback = forceFallback;
    if (!fallback) {
      try {
        const loader = new GLTFLoader();
        const gltf = await Promise.race([
          loader.loadAsync('models/oy0x0.glb'),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
        ]);
        setupModel(gltf.scene);
      } catch (err) {
        console.info('[OY 0X0] GLB недоступен, используется процедурная модель:', err?.message || err);
        fallback = true;
      }
    }
    if (fallback) setupModel(buildFallbackModel());
    modelReady = true;
    snap();
    update(0);
    renderer.render(scene, camera);
    if (wantActive) start();
    return { fallback };
  })();

  return {
    ready,
    renderer,
    debug: { cur, target, parts },
    setTarget(values) {
      for (const k in values) if (k in target && Number.isFinite(values[k])) target[k] = values[k];
    },
    snap,
    setPointer(x, y) { pointer.tx = x; pointer.ty = y; },
    setBodyColor(name, instant = false) {
      setBodyTargets(name);
      redrawScreen((BODY_COLORS[name] || BODY_COLORS.red).accent);
      if (instant || !raf) applyColorsInstant();
    },
    setSignalColor(name, instant = false) {
      signalTarget.setHex(SIGNAL_COLORS[name] || SIGNAL_COLORS.white);
      if (instant || !raf) signalCur.copy(signalTarget);
    },
    setActive(v) {
      wantActive = v;
      if (v) start(); else stop();
    },
    setReduced(v) { reduced = v; },
    redrawScreen,
    resize,
  };
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
