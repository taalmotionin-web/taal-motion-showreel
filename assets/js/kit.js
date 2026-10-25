// Shared kit for the showreel scenes: palette, easing, and a small 3D Bauhaus set on three.js.
// Scenes load it with import("./assets/js/kit.js"). Every value a scene draws is a function of time.
import { GLYPHS } from "./glyphs.js";

export const C = {
  bone: "#F4F1EA",
  ink: "#14161A",
  cobalt: "#2B4BFF",
  coral: "#FF4B3E",
  saffron: "#FFB02E",
  muted: "#6B6A66",
};

let threeModule;
export function three() {
  return (threeModule ||= import("https://cdn.jsdelivr.net/npm/three@0.184.0/+esm"));
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut3 = (x) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeIn3 = (x) => Math.pow(clamp01(x), 3);
export const easeInOut = (x) => {
  x = clamp01(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const SPRING_END = 1 - Math.exp(-5.5) * Math.cos(9.5);
// 0 -> 1 with about 16% overshoot (damping ~0.5); lands exactly on 1 at x = 1.
export const spring = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : (1 - Math.exp(-5.5 * x) * Math.cos(9.5 * x)) / SPRING_END);
// 0 -> 1 -> 0 bump that decays, for squash on a landing or a pop on a beat.
export const hump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x) * (1 - x) * 1.6);

// One WebGL context for the whole film. Every 3D scene renders through it and copies the frame into
// its own 2D canvas, so scenes never compete for (or lose) GPU contexts.
let sharedRenderer;
function renderer3d() {
  return (sharedRenderer ||= three().then((THREE) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(1920, 1080, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    return { THREE, renderer };
  }));
}

// A scene, studio light and camera drawn into `target` (a 2D canvas, 1920 x 1080).
// bg null = transparent, over the scene's own ground.
export async function stage(target, { bg = null, fov = 30, z = 12, ortho = false } = {}) {
  const { THREE, renderer } = await renderer3d();
  const ctx = target.getContext("2d");
  const scene = new THREE.Scene();
  if (bg) scene.background = new THREE.Color(bg);
  // Reflections come from a soft studio: a key box overhead, two tall strips, a low fill.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0.3, 0.29, 0.28);
  const box = (w, h, x, y, zz, v) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v), side: THREE.DoubleSide }));
    m.position.set(x, y, zz);
    m.lookAt(0, 0, 0);
    studio.add(m);
  };
  box(9, 3, -1, 7, 3, 3.2);
  box(1.4, 10, -8, 0, 2, 2.4);
  box(1.4, 10, 8, 0, -1, 1.8);
  box(10, 2, 0, -7, 2, 0.8);
  scene.environment = pmrem.fromScene(studio, 0.035).texture;
  // ortho: 1 unit = 1 px, origin at the frame centre, for things that must match flat artwork exactly.
  const camera = ortho ? new THREE.OrthographicCamera(-960, 960, 540, -540, -3000, 3000) : new THREE.PerspectiveCamera(fov, 1920 / 1080, 0.1, 400);
  camera.position.set(0, 0, ortho ? 1500 : z);
  const key = new THREE.DirectionalLight(0xfff2e4, 1.7);
  key.position.set(-5, 7, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xe2e8ff, 0.8);
  rim.position.set(6, 3, -6);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.55));
  const ppu = ortho ? 1 : 1080 / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)) * z); // px per unit at z = 0
  const render = () => {
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    ctx.clearRect(0, 0, 1920, 1080);
    ctx.drawImage(renderer.domElement, 0, 0);
  };
  return { THREE, renderer, scene, camera, ppu, render };
}

export function material(THREE, color, { rough = 0.34, clear = 0.6, env = 0.8 } = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: rough,
    metalness: 0,
    clearcoat: clear,
    clearcoatRoughness: 0.1,
    envMapIntensity: env,
  });
}

const BEVEL = { bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 8, curveSegments: 64 };

// One Bauhaus object centred on its own origin, about 1.6 units across.
// kinds: sphere, ring, cone, capsule, half, quarter, arch, cube, stack, eye
export function shape(THREE, kind, color, accent = C.bone) {
  const m = material(THREE, color);
  const extrude = (sh, depth = 0.42) => {
    const g = new THREE.ExtrudeGeometry(sh, { depth, ...BEVEL });
    g.center();
    return new THREE.Mesh(g, m);
  };
  const S = new THREE.Shape();
  switch (kind) {
    case "sphere":
      return new THREE.Mesh(new THREE.SphereGeometry(0.72, 64, 48), m);
    case "ring":
      return new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.24, 48, 120), m);
    case "cone":
      return new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.4, 72, 1), m);
    case "capsule":
      return new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.95, 16, 40), m);
    case "half":
      S.moveTo(0.9, 0);
      S.absarc(0, 0, 0.9, 0, Math.PI, false);
      S.lineTo(0.9, 0);
      return extrude(S);
    case "quarter":
      S.moveTo(0, 0);
      S.lineTo(1.0, 0);
      S.absarc(0, 0, 1.0, 0, Math.PI / 2, false);
      S.lineTo(0, 0);
      return extrude(S);
    case "arch":
      S.moveTo(0.95, 0);
      S.absarc(0, 0, 0.95, 0, Math.PI, false);
      S.lineTo(-0.45, 0);
      S.absarc(0, 0, 0.45, Math.PI, 0, true);
      S.lineTo(0.95, 0);
      return extrude(S, 0.4);
    case "cube": {
      const r = 0.16, w = 0.58;
      S.moveTo(-w + r, -w);
      S.lineTo(w - r, -w);
      S.quadraticCurveTo(w, -w, w, -w + r);
      S.lineTo(w, w - r);
      S.quadraticCurveTo(w, w, w - r, w);
      S.lineTo(-w + r, w);
      S.quadraticCurveTo(-w, w, -w, w - r);
      S.lineTo(-w, -w + r);
      S.quadraticCurveTo(-w, -w, -w + r, -w);
      return extrude(S, 0.95);
    }
    case "stack": {
      const g = new THREE.Group();
      const ma = material(THREE, accent);
      for (let i = 0; i < 4; i++) {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.18, 72), i % 2 ? ma : m);
        d.position.y = (i - 1.5) * 0.22;
        g.add(d);
      }
      return g;
    }
    case "eye": {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.17, 40, 110), m));
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 48, 32), material(THREE, accent)));
      return g;
    }
  }
  return new THREE.Mesh(new THREE.SphereGeometry(0.72, 48, 32), m);
}

// Extruded Inter Bold. Each letter sits in its own holder group pivoting on the letter's centre;
// letters run left to right from x = 0 with the baseline at y = 0. size = units per em.
export function text3d(THREE, str, { size = 2.5, depth = 0.55, front = C.bone, side = C.coral } = {}) {
  const mats = [material(THREE, front, { rough: 0.42, clear: 0.3 }), material(THREE, side, { rough: 0.38, clear: 0.5 })];
  const group = new THREE.Group();
  const letters = [];
  let x = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const gl = GLYPHS.glyphs[ch];
    if (!gl) {
      x += 0.28 * size;
      continue;
    }
    const sp = new THREE.ShapePath();
    for (const c of gl.cmds) {
      if (c[0] === "M") sp.moveTo(c[1] * size, c[2] * size);
      else if (c[0] === "L") sp.lineTo(c[1] * size, c[2] * size);
      else if (c[0] === "Q") sp.quadraticCurveTo(c[1] * size, c[2] * size, c[3] * size, c[4] * size);
      else if (c[0] === "C") sp.bezierCurveTo(c[1] * size, c[2] * size, c[3] * size, c[4] * size, c[5] * size, c[6] * size);
    }
    const geo = new THREE.ExtrudeGeometry(sp.toShapes(false), {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.02 * size,
      bevelSize: 0.012 * size,
      bevelSegments: 5,
      curveSegments: 20,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
    geo.translate(-cx, -cy, -depth / 2);
    const holder = new THREE.Group();
    holder.add(new THREE.Mesh(geo, mats));
    holder.position.set(x + cx, cy, 0);
    group.add(holder);
    letters.push({ holder, x: x + cx, y: cy, h: bb.max.y - bb.min.y });
    const next = str[i + 1];
    x += gl.adv * size + (next && GLYPHS.kern[ch + next] ? GLYPHS.kern[ch + next] * size : 0);
  }
  return { group, letters, width: x, cap: GLYPHS.capHeight * size };
}
