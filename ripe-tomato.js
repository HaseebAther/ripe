// ripe-tomato.js — the Ripe 3D tomato timer, as a standalone ES module.
// One-piece tomato that stays still and ripens green -> red; the minute numbers are a printed layer that slides round it.
//
// Needs three.js (tested with 0.170):  npm i three
//
// Usage:
//   import { createTomato } from './ripe-tomato.js';
//   const tomato = createTomato(document.getElementById('stage'), {
//     minutes: 25,
//     onChange: (m) => console.log('set to', m),   // fires when the user drags the dial
//   });
//   tomato.setMinutes(remainingSeconds / 60);      // call as your timer ticks; the dial turns
//   tomato.setRipeness(elapsed / total);           // 0 = green, 1 = red (or setColor('#hex'))
//   tomato.bump(); tomato.jump();                  // little press / "ding" animations
//   tomato.dispose();
//
// The container should have a size (e.g. width:100%; height:320px). The canvas fills it.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const TAU = Math.PI * 2;
const FLAT = 0.8;
const DIR = -1; // texture slide direction so the number under the pointer = minutes
const RIPE = ['#79A93A', '#E9A12A', '#E0392A'].map((c) => new THREE.Color(c));
const ripeColor = (p, out) => (p < 0.55 ? out.lerpColors(RIPE[0], RIPE[1], p / 0.55) : out.lerpColors(RIPE[1], RIPE[2], (p - 0.55) / 0.45));

function tomatoGeometry() {
  const g = new THREE.SphereGeometry(1, 160, 110);
  const p = g.attributes.position, colors = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const az = Math.atan2(v.z, v.x);
    const band = 1 - Math.abs(v.y) ** 1.6;
    const rib = 1 + (0.05 * Math.cos(6 * az + 0.4) + 0.012 * Math.cos(13 * az)) * band;
    v.x *= rib; v.z *= rib;
    const h = Math.hypot(v.x, v.z);
    let y = v.y * FLAT;
    if (v.y > 0) y -= 0.16 * Math.exp(-(h * h) / 0.07);
    if (v.y < 0) y += 0.06 * Math.exp(-(h * h) / 0.05);
    p.setXYZ(i, v.x, y, v.z);
    const top = Math.max(0, v.y);
    const shade = 1 - 0.28 * top ** 3;
    colors.push(shade, shade * (1 + 0.06 * top ** 4), shade);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function dialTexture(renderer, font) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#FFF6EA'; x.textAlign = 'center'; x.lineCap = 'round';
  for (let m = 0; m < 60; m++) {
    const px = ((0.25 + m / 60) % 1) * 2048;
    const big = m % 5 === 0;
    x.beginPath(); x.moveTo(px, big ? 396 : 416); x.lineTo(px, 458);
    x.lineWidth = big ? 13 : 9; x.strokeStyle = 'rgba(45,12,4,.45)'; x.stroke();
    x.lineWidth = big ? 7 : 4; x.strokeStyle = '#FFF6EA'; x.globalAlpha = big ? 1 : 0.8; x.stroke();
    x.globalAlpha = 1;
    if (big) {
      x.font = `800 84px ${font}`;
      x.lineJoin = 'round'; x.lineWidth = 14; x.strokeStyle = 'rgba(45,12,4,.5)';
      x.strokeText(String(m), px, 552);
      x.fillText(String(m), px, 552);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

export function createTomato(container, {
  minutes = 25,
  ripeness = 0,          // 0 = green, 1 = red
  maxMinutes = 60,
  font = 'Figtree, system-ui, sans-serif',
  draggable = true,
  onChange = null,       // (minutes) => void, after a drag ends
  onTick = null,         // (minutes) => void, each whole minute crossed while dragging
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches,
} = {}) {
  /* renderer + scene */
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const CAM = new THREE.Vector3(0, 2.0, 5.0).normalize();

  const key = new THREE.DirectionalLight(0xfff3e6, 2.4); key.position.set(-2.2, 3.2, 2.6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe8ff, 1.6); rim.position.set(2.4, 1.2, -2.8); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6f8f9a, 0.5));

  /* model: tilt > squash > (tomato, printed numbers layer, calyx, pointer) — the numbers layer's texture slides to turn the dial */
  const tilt = new THREE.Group(); scene.add(tilt);
  const squash = new THREE.Group(); tilt.add(squash);

  const skin = new THREE.MeshPhysicalMaterial({
    color: ripeColor(ripeness, new THREE.Color()), vertexColors: true, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.55,
  });
  const bodyGeo = tomatoGeometry();
  squash.add(new THREE.Mesh(bodyGeo, skin));

  const decalMat = new THREE.MeshStandardMaterial({
    transparent: true, depthWrite: false, roughness: 0.25, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const decal = new THREE.Mesh(bodyGeo, decalMat); decal.scale.setScalar(1.002); squash.add(decal);
  const loadFont = document.fonts?.load ? document.fonts.load(`700 70px ${font}`) : Promise.resolve();
  loadFont.catch(() => {}).finally(() => {
    if (disposed) return;
    decalMat.map = dialTexture(renderer, font); decalMat.needsUpdate = true;
  });

  const leafMat = new THREE.MeshPhysicalMaterial({ color: '#3E7B35', roughness: 0.55, clearcoat: 0.4, clearcoatRoughness: 0.4, side: THREE.DoubleSide });
  const calyx = new THREE.Group(); calyx.position.y = FLAT - 0.07; squash.add(calyx);
  const sepalGeo = new THREE.SphereGeometry(1, 24, 12); sepalGeo.translate(0, 0, 1);
  for (let i = 0; i < 6; i++) {
    const pivot = new THREE.Group(); pivot.rotation.y = (i / 6) * TAU + Math.sin(i * 7.1) * 0.18;
    const s = new THREE.Mesh(sepalGeo, leafMat);
    s.scale.set(0.09, 0.024, 0.2 + 0.035 * Math.sin(i * 3.3));
    s.rotation.x = 0.07 + 0.06 * Math.cos(i * 5.7);
    s.rotation.z = Math.sin(i * 2.2) * 0.25;
    pivot.add(s); calyx.add(pivot);
  }
  const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0.01, 0.12, 0), new THREE.Vector3(0.06, 0.22, 0.02)]);
  const stemGeo = new THREE.TubeGeometry(stemCurve, 20, 0.034, 10, false);
  calyx.add(new THREE.Mesh(stemGeo, leafMat));
  const capTipGeo = new THREE.SphereGeometry(0.036, 12, 8);
  const capTip = new THREE.Mesh(capTipGeo, leafMat); capTip.position.copy(stemCurve.getPoint(1)); calyx.add(capTip);

  const brass = new THREE.MeshStandardMaterial({ color: '#C79A45', metalness: 1, roughness: 0.28 });
  const pointerGeo = new THREE.ConeGeometry(0.06, 0.15, 3);
  const pointer = new THREE.Mesh(pointerGeo, brass);
  pointer.rotation.x = Math.PI - 0.5; pointer.position.set(0, 0.42, 0.98); squash.add(pointer);

  const shadowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, '#7a7a7a'); g.addColorStop(0.45, '#333'); g.addColorStop(1, '#000');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c);
  })();
  const shadowGeo = new THREE.PlaneGeometry(2.8, 2.8);
  const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.84; scene.add(shadow);

  /* sizing */
  let rPx = 100;
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const fit = Math.max(1, 0.95 / camera.aspect);
    camera.position.copy(CAM).multiplyScalar(5.15 * fit);
    camera.lookAt(0, -0.08, 0);
    camera.updateProjectionMatrix();
    rPx = (h / 2) / (camera.position.length() * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  };
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  /* springs */
  const spring = (x, k, c) => ({ x, v: 0, t: x, k, c });
  const step = (s, dt) => { s.v += (s.k * (s.t - s.x) - s.c * s.v) * dt; s.x += s.v * dt; };
  const angleFor = (min) => -(min / 60) * TAU;
  let current = minutes;
  const sp = {
    spin: spring(angleFor(current), 160, 20),
    tx: spring(0, 90, 13), ty: spring(0, 90, 13),
    sq: spring(1, 380, 16), jump: spring(0, 120, 7),
  };
  const fruit = skin.color.clone(), fruitTarget = fruit.clone();
  let dragging = false, dragMin = current;

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    sp.spin.t = angleFor(dragging ? dragMin : current);
    if (reducedMotion || dragging) { sp.spin.x = sp.spin.t; sp.spin.v = 0; }
    for (let i = 0; i < 4; i++) for (const s of Object.values(sp)) step(s, dt / 4);
    if (decalMat.map) decalMat.map.offset.x = DIR * sp.spin.x / TAU;
    tilt.rotation.x = sp.tx.x; tilt.rotation.z = sp.ty.x * 0.5; tilt.rotation.y = sp.ty.x * 0.35;
    squash.scale.set(1 + (1 - sp.sq.x) * 0.6, sp.sq.x, 1 + (1 - sp.sq.x) * 0.6);
    squash.position.y = Math.max(0, sp.jump.x) - (1 - sp.sq.x) * 0.8;
    const lift = Math.max(0, sp.jump.x);
    shadow.material.opacity = 1 - lift * 1.4; shadow.scale.setScalar(1 - lift * 0.5);
    fruit.lerp(fruitTarget, reducedMotion ? 1 : 1 - Math.exp(-dt * 7));
    skin.color.copy(fruit);
    renderer.render(scene, camera);
  });

  /* pointer interaction: hover tilt + drag to twist the dial */
  let drag = null;
  const onDown = (e) => {
    if (!draggable || e.button !== 0 || drag) return;
    canvas.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, start: current, moved: false, lastMin: Math.round(current) };
    if (!reducedMotion) sp.sq.t = 0.965;
  };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    if (!reducedMotion && !drag) { sp.tx.t = ((e.clientY - r.top) / r.height - 0.5) * 0.4; sp.ty.t = ((e.clientX - r.left) / r.width - 0.5) * 0.5; }
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 5) return;
    if (!drag.moved) { drag.moved = true; dragging = true; canvas.style.cursor = 'grabbing'; }
    dragMin = Math.min(maxMinutes, Math.max(0.5, drag.start - dx * (60 / (TAU * rPx))));
    const m = Math.round(dragMin);
    if (m !== drag.lastMin) { drag.lastMin = m; onTick?.(m); }
    if (!reducedMotion) sp.ty.t = Math.max(-0.25, Math.min(0.25, dx / 600));
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    sp.sq.t = 1;
    if (drag.moved) {
      const m = Math.min(maxMinutes, Math.max(1, Math.round(dragMin)));
      sp.spin.x = angleFor(dragMin); sp.spin.v = 0;
      current = m;
      onChange?.(m);
    }
    dragging = false; drag = null; sp.ty.t = 0; canvas.style.cursor = draggable ? 'grab' : '';
  };
  const onLeave = () => { if (!drag) { sp.tx.t = 0; sp.ty.t = 0; } };
  canvas.style.cursor = draggable ? 'grab' : '';
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);

  let disposed = false;
  return {
    canvas,
    scene,
    /** Point the dial at a number of minutes (fractions are fine — pass remainingSeconds / 60). */
    setMinutes(min, { instant = false } = {}) {
      current = Math.max(0, Math.min(maxMinutes, min));
      if (instant) { sp.spin.x = sp.spin.t = angleFor(current); sp.spin.v = 0; }
    },
    getMinutes: () => current,
    /** Ripeness 0..1: green -> orange -> red. Call as time passes, e.g. 1 - remaining / total. */
    setRipeness(p) { ripeColor(Math.min(1, Math.max(0, p)), fruitTarget); },
    /** Or set any colour directly. */
    setColor(hex) { fruitTarget.set(hex); },
    /** Quick squash, e.g. on start/pause. */
    bump(amount = 0.93) { if (!reducedMotion) { sp.sq.x = amount; sp.sq.v = 0; } },
    /** Hop, e.g. when the timer rings. */
    jump() { if (!reducedMotion) { sp.jump.v = 4.2; sp.sq.x = 0.86; } },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      scene.traverse((o) => { if (o.isMesh) { o.material.map?.dispose(); o.material.dispose(); } });
      [bodyGeo, sepalGeo, stemGeo, capTipGeo, pointerGeo, shadowGeo].forEach((g) => g.dispose());
      shadowTex.dispose(); envTex.dispose(); pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
