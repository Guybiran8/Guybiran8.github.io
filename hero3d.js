// 3D candlestick chart for the homepage hero. Loaded only on capable desktops; index.html keeps the
// 2D chart underneath and falls back to it if anything here fails.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

const GREEN = 0x2e9e4f, RED = 0xe04848, CYAN = 0x4cc9f0;
const COUNT = 60;           // last ~3 months of candles
const SPACING = 1;
const BODY = 0.7, WICK = 0.1;
const HEIGHT = 34;          // world units from the lowest low to the highest high

export function mount(stage, data, opts) {
  const rows = data.candles.slice(-COUNT).map(c => ({ o: c[1], h: c[2], l: c[3], c: c[4] }));
  if (rows.length < 10) throw new Error('not enough candles');

  // Price scale; levels close to the range widen it, far ones are left out
  let lo = Math.min(...rows.map(r => r.l)), hi = Math.max(...rows.map(r => r.h));
  const pad = (hi - lo) * 0.15;
  const levels = (data.levels || []).filter(l => l.price > lo - pad && l.price < hi + pad);
  levels.forEach(l => { lo = Math.min(lo, l.price); hi = Math.max(hi, l.price); });
  lo -= (hi - lo) * 0.12;   // a little air between the lowest candle and the floor
  const y = p => (p - lo) / (hi - lo) * HEIGHT;
  const half = (rows.length - 1) * SPACING / 2;
  const x = i => i * SPACING - half;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'hero-3d-canvas';
  stage.prepend(canvas);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x11131a, 70, 140);
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
  const target = new THREE.Vector3(0, HEIGHT * 0.42, 0);

  // Lights: soft fill, a key light, and cyan from above and behind
  scene.add(new THREE.HemisphereLight(0x9fdcff, 0x0a0b0f, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(25, 40, 35);
  scene.add(key);
  const rim = new THREE.DirectionalLight(CYAN, 1.4);
  rim.position.set(-30, 18, -35);
  scene.add(rim);
  const glow = new THREE.PointLight(CYAN, 700, 70, 2);
  glow.position.set(0, HEIGHT + 8, -12);
  scene.add(glow);

  // Candles as instanced boxes: bodies and wicks, green up / red down
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mats = {
    up: new THREE.MeshStandardMaterial({ color: GREEN, emissive: GREEN, emissiveIntensity: 0.28, roughness: 0.35, metalness: 0.15 }),
    down: new THREE.MeshStandardMaterial({ color: RED, emissive: RED, emissiveIntensity: 0.28, roughness: 0.35, metalness: 0.15 })
  };
  const ups = rows.filter(r => r.c >= r.o).length, downs = rows.length - ups;
  function candleSet(opacity) {
    const group = new THREE.Group();
    const m = opacity < 1
      ? { up: Object.assign(mats.up.clone(), { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }),
          down: Object.assign(mats.down.clone(), { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }) }
      : mats;
    const meshes = {
      upBody: new THREE.InstancedMesh(box, m.up, ups), upWick: new THREE.InstancedMesh(box, m.up, ups),
      downBody: new THREE.InstancedMesh(box, m.down, downs), downWick: new THREE.InstancedMesh(box, m.down, downs)
    };
    const n = { up: 0, down: 0 }, mtx = new THREE.Matrix4();
    rows.forEach((r, i) => {
      const side = r.c >= r.o ? 'up' : 'down';
      const top = y(Math.max(r.o, r.c)), bottom = y(Math.min(r.o, r.c));
      const h = Math.max(top - bottom, 0.08);
      mtx.compose(new THREE.Vector3(x(i), bottom + h / 2, 0), new THREE.Quaternion(), new THREE.Vector3(BODY, h, BODY));
      meshes[side + 'Body'].setMatrixAt(n[side], mtx);
      const wh = Math.max(y(r.h) - y(r.l), 0.08);
      mtx.compose(new THREE.Vector3(x(i), y(r.l) + wh / 2, 0), new THREE.Quaternion(), new THREE.Vector3(WICK, wh, WICK));
      meshes[side + 'Wick'].setMatrixAt(n[side], mtx);
      n[side]++;
    });
    Object.values(meshes).forEach(mesh => group.add(mesh));
    return group;
  }
  scene.add(candleSet(1));

  // Reflective floor: a mirrored, faded copy of the candles under a dark, slightly see-through floor
  const mirror = candleSet(0.3);
  mirror.scale.y = -1;
  scene.add(mirror);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 70),
    new THREE.MeshStandardMaterial({ color: 0x0b0d13, metalness: 0.2, roughness: 0.75, transparent: true, opacity: 0.72 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(140, 70, CYAN, 0x2a3140);
  grid.material.transparent = true;
  grid.material.opacity = 0.16;
  grid.position.y = 0.01;
  scene.add(grid);

  // Support and resistance: faint glowing planes with a brighter front edge, and an HTML price label
  const labels = levels.map(l => {
    const color = l.kind === 'support' ? GREEN : RED;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 6, 9),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = y(l.price);
    scene.add(plane);
    const edge = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-half - 3, y(l.price), 4.5), new THREE.Vector3(half + 3, y(l.price), 4.5)]),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 })
    );
    scene.add(edge);
    const el = document.createElement('span');
    el.className = 'hero-3d-label ' + (l.kind === 'support' ? 'is-support' : 'is-resistance');
    el.textContent = l.price.toFixed(2);
    stage.appendChild(el);
    return { el, at: new THREE.Vector3(half + 3, y(l.price), 4.5) };
  });

  // Camera: slow sway around the chart, drag to turn it; no wheel zoom so the page scrolls normally
  let yaw = 0, pitch = 0.2, dragYaw = 0, dragPitch = 0, t = 0;
  let dragging = null;
  canvas.addEventListener('pointerdown', e => {
    dragging = { x: e.clientX, y: e.clientY, yaw: dragYaw, pitch: dragPitch };
    canvas.setPointerCapture(e.pointerId);
    stage.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', e => {
    if (!dragging) return;
    dragYaw = Math.max(-0.75, Math.min(0.75, dragging.yaw - (e.clientX - dragging.x) * 0.006));
    dragPitch = Math.max(-0.22, Math.min(0.4, dragging.pitch + (e.clientY - dragging.y) * 0.004));
    if (!running) render();
  });
  const endDrag = () => { dragging = null; stage.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  function size() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(() => { size(); if (!running) render(); });
  ro.observe(stage);
  size();

  const v = new THREE.Vector3();
  function render() {
    yaw = 0.32 * Math.sin(t * Math.PI * 2 / 26) + dragYaw;
    const p = pitch + dragPitch, r = 104;
    camera.position.set(target.x + r * Math.sin(yaw) * Math.cos(p), target.y + r * Math.sin(p), target.z + r * Math.cos(yaw) * Math.cos(p));
    camera.lookAt(target);
    renderer.render(scene, camera);
    const w = stage.clientWidth, h = stage.clientHeight;
    labels.forEach(lb => {
      v.copy(lb.at).project(camera);
      const px = Math.max(8, Math.min(w - lb.el.offsetWidth - 14, (v.x + 1) / 2 * w));
      const py = Math.max(14, Math.min(h - 14, (1 - v.y) / 2 * h));
      lb.el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(6px, -50%)`;
    });
  }

  // Only animate while on screen and the tab is visible. A device that can't keep up goes back to 2D.
  let running = false, onScreen = true, raf = 0, last = 0, frames = 0, slowTime = 0, dead = false;
  function loop(now) {
    if (!running) return;
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    if (!dragging) t += dt;
    if (frames < 90 && dt) { frames++; slowTime += dt; if (frames === 90 && slowTime / 90 > 0.05) return fail(); }
    render();
    raf = requestAnimationFrame(loop);
  }
  function update() {
    const want = onScreen && !document.hidden && !dead;
    if (want && !running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
    if (!want && running) { running = false; cancelAnimationFrame(raf); }
  }
  const io = new IntersectionObserver(e => { onScreen = e[0].isIntersecting; update(); });
  io.observe(stage);
  document.addEventListener('visibilitychange', update);

  function destroy() {
    dead = true; running = false;
    cancelAnimationFrame(raf);
    io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', update);
    labels.forEach(lb => lb.el.remove());
    renderer.dispose();
    canvas.remove();
  }
  function fail() { destroy(); if (opts && opts.onFail) opts.onFail(); }
  canvas.addEventListener('webglcontextlost', fail);

  render();
  update();
  return { destroy };
}
