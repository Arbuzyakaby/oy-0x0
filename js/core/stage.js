/* =========================================================================
   OY — 3D-сцена (ядро)
   Одна модель на fixed-canvas. Описание модели приходит фабрикой
   createModel(ctx) из js/models/*. Внешний код задаёт целевое состояние
   (поза + состояние модели), сцена плавно догоняет его каждый кадр.
   ========================================================================= */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const MODEL_SCALE = 10; // модель в метрах -> 1.46 единицы по высоте

export const POSE_DEFAULTS = {
  x: 0, y: 0, fx: 0, fy: 0, fz: 0,
  rx: 0, ry: 0, rz: 0, s: 1, dist: 5.4,
  float: 1, spin: 0,
};

export function createStage(canvas, createModel, { forceFallback = false, fitCanvas = false } = {}) {
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

  let raf = 0;
  const model = createModel({ phone, scale: MODEL_SCALE, isRunning: () => raf !== 0 });

  // Состояние: target задаёт скролл, cur догоняет его
  const target = { ...POSE_DEFAULTS, ...model.state };
  const cur = { ...target };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let reduced = false;

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

    const t = clock.elapsedTime;
    const fl = reduced ? 0 : Math.max(0, Math.min(1, cur.float));
    const idleY = Math.sin(t * 0.5) * 0.1 * fl;
    const idleX = Math.sin(t * 0.37) * 0.035 * fl;
    const bob = Math.sin(t * 0.8) * 0.018 * fl;

    phone.rotation.set(
      cur.rx + idleX + pointer.y * 0.1 * fl,
      cur.ry + cur.spin + idleY + pointer.x * 0.22 * fl,
      cur.rz,
    );
    phone.scale.setScalar(cur.s);

    camera.position.set(0, 0, cur.dist);
    camera.lookAt(0, 0, 0);
    const halfH = tanHalf * cur.dist;
    const halfW = halfH * camera.aspect;
    focus.set(cur.fx, cur.fy, cur.fz).applyEuler(phone.rotation).multiplyScalar(cur.s);
    phone.position.set(cur.x * halfW - focus.x, cur.y * halfH - focus.y + bob, -focus.z);

    model.update(cur, dt, { reduced });
  }

  /* ---- Цикл рендера ---- */
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
    model.snap();
  }

  function resize() {
    // fitCanvas: сцена в собственном canvas (витрина), иначе — на весь экран
    const w = fitCanvas ? canvas.clientWidth || 1 : window.innerWidth;
    const h = fitCanvas ? canvas.clientHeight || 1 : window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (modelReady && !raf) { update(0); renderer.render(scene, camera); }
  }
  resize();
  if (fitCanvas && 'ResizeObserver' in window) new ResizeObserver(() => resize()).observe(canvas);

  /* ---- Загрузка модели ---- */
  const ready = (async () => {
    let fallback = forceFallback;
    let root = null;
    if (!fallback) {
      try {
        const loader = new GLTFLoader();
        const gltf = await Promise.race([
          loader.loadAsync(model.url),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
        ]);
        root = gltf.scene;
      } catch (err) {
        console.info('[OY] GLB недоступен, используется процедурная модель:', err?.message || err);
        fallback = true;
      }
    }
    if (fallback) root = model.buildFallback();
    model.setup(root);
    modelRoot.add(root);
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
    debug: { cur, target, parts: model.parts },
    setTarget(values) {
      for (const k in values) if (k in target && Number.isFinite(values[k])) target[k] = values[k];
    },
    snap,
    setPointer(x, y) { pointer.tx = x; pointer.ty = y; },
    setActive(v) {
      wantActive = v;
      if (v) start(); else stop();
    },
    setReduced(v) { reduced = v; },
    resize,
    ...model.api,
  };
}
