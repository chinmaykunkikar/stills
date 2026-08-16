import type { SplatMesh } from "@sparkjsdev/spark";
import type { Vector3 } from "three";
import type { SceneEntry } from "./scenes";

const DEFAULT_SWEEP = 0.15;
const FETCH_TIMEOUT_MS = 30000;
const INIT_TIMEOUT_MS = 20000;
const BYTES_CACHE_LIMIT = 3;
const SMOOTHING = 8;
const DRIFT_X = 0.48;
const DRIFT_Y = 0.14;
const PROBE_POINTS = [
  [0.5, 0.5],
  [0.2, 0.2],
  [0.8, 0.2],
  [0.2, 0.8],
  [0.8, 0.8],
] as const;

type Viewer = {
  activate: (entry: SceneEntry, frame: HTMLElement, token: number) => Promise<boolean>;
  deactivate: () => void;
  pointTo: (nx: number, ny: number) => void;
  recenter: (ms: number) => Promise<void>;
};

let viewerPromise: Promise<Viewer> | null = null;
let viewerInstance: Viewer | null = null;
let sessionToken = 0;
let driftEnabled = false;
let pointerHeld = false;
let viewerBroken = false;

export function setSceneDrift(on: boolean): void {
  driftEnabled = on;
}

export function holdScenePointer(on: boolean): void {
  pointerHeld = on;
}

export function scenesRenderable(): boolean {
  return !viewerBroken;
}

function rejectAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
}

export async function activateScene(entry: SceneEntry, frame: HTMLElement): Promise<boolean> {
  if (viewerBroken) return false;
  const token = ++sessionToken;
  try {
    if (!viewerPromise) viewerPromise = createViewer();
    const viewer = await viewerPromise;
    if (token !== sessionToken) return false;
    return await viewer.activate(entry, frame, token);
  } catch (error) {
    console.error("scene could not be rendered, showing the photograph instead:", error);
    return false;
  }
}

export function deactivateScene(): void {
  sessionToken++;
  viewerInstance?.deactivate();
}

export function pointScene(nx: number, ny: number): void {
  viewerInstance?.pointTo(nx, ny);
}

export function tiltScene(nx: number, ny: number): void {
  if (pointerHeld) return;
  viewerInstance?.pointTo(nx, ny);
}

export function recenterScene(ms: number): Promise<void> {
  return viewerInstance ? viewerInstance.recenter(ms) : Promise.resolve();
}

async function createViewer(): Promise<Viewer> {
  const [THREE, spark] = await Promise.all([import("three"), import("@sparkjsdev/spark")]);

  const scene3d = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 0.75, 0.01, 1000);
  let renderer: InstanceType<typeof THREE.WebGLRenderer>;
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
  } catch (error) {
    viewerBroken = true;
    throw error;
  }
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    viewerBroken = true;
    active = false;
    renderer.domElement.remove();
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const sparkRenderer = new spark.SparkRenderer({ renderer });
  scene3d.add(sparkRenderer);

  const target = new THREE.Vector3(0, 0, -2.5);
  const desired = new THREE.Vector3(0, 0, 0);
  const ORIGIN = new THREE.Vector3(0, 0, 0);
  const bytesCache = new Map<string, ArrayBuffer>();
  const probePixel = new Uint8Array(4);
  let currentSplat: SplatMesh | null = null;
  let currentUrl: string | null = null;
  let parallax = 0.08;
  let settle: { start: number; ms: number; from: Vector3; finish: () => void } | null = null;
  let active = false;
  let liveStart = 0;
  let renderUntil = 0;
  let lastTime = 0;

  async function fetchSceneBytes(url: string): Promise<ArrayBuffer> {
    const cached = bytesCache.get(url);
    if (cached) return cached;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`${url} responded ${response.status}`);
      const bytes = await response.arrayBuffer();
      bytesCache.set(url, bytes);
      while (bytesCache.size > BYTES_CACHE_LIMIT) {
        const oldest = bytesCache.keys().next();
        if (oldest.done) break;
        bytesCache.delete(oldest.value);
      }
      return bytes;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function clearScene(): void {
    if (!currentSplat) return;
    scene3d.remove(currentSplat);
    currentSplat.dispose();
    currentSplat = null;
    currentUrl = null;
    sparkRenderer.clearSplats();
  }

  function canvasCovered(): boolean {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    for (const [px, py] of PROBE_POINTS) {
      gl.readPixels((w * px) | 0, (h * py) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probePixel);
      if (probePixel[3] < 250) return false;
    }
    return true;
  }

  async function activate(entry: SceneEntry, frame: HTMLElement, token: number): Promise<boolean> {
    const canvas = renderer.domElement;
    if (canvas.parentElement !== frame) {
      canvas.style.transition = "none";
      frame.appendChild(canvas);
      void canvas.offsetWidth;
      canvas.style.transition = "";
    }

    camera.fov = entry.fov || 60;
    parallax = Math.min(
      ((entry.sweep ?? DEFAULT_SWEEP) / 2) * entry.focus * Math.tan((camera.fov * Math.PI) / 360),
      entry.maxParallax,
    );
    camera.aspect = frame.clientWidth / frame.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(frame.clientWidth, frame.clientHeight, false);

    try {
      if (currentUrl !== entry.sog) {
        const bytes = await fetchSceneBytes(entry.sog);
        if (token !== sessionToken) return false;
        clearScene();
        const splat = new spark.SplatMesh({ fileBytes: bytes.slice(0), fileName: "scene.sog" });
        splat.quaternion.set(1, 0, 0, 0);
        currentSplat = splat;
        currentUrl = entry.sog;
        scene3d.add(splat);
      }
      if (!currentSplat) return false;
      await Promise.race([currentSplat.initialized, rejectAfter(INIT_TIMEOUT_MS)]);
    } catch (error) {
      clearScene();
      canvas.remove();
      throw error;
    }
    if (token !== sessionToken) return false;

    target.set(0, 0, -(entry.focus || 2.5));
    desired.set(0, 0, 0);
    camera.position.set(0, 0, 0);
    camera.lookAt(target);

    for (let attempt = 0; attempt < 60; attempt++) {
      renderer.render(scene3d, camera);
      if (canvasCovered()) break;
      await new Promise(requestAnimationFrame);
      if (token !== sessionToken) return false;
    }

    active = true;
    liveStart = performance.now();
    renderUntil = liveStart + 1000;
    return true;
  }

  function deactivate(): void {
    active = false;
    settle?.finish();
    settle = null;
  }

  function recenter(ms: number): Promise<void> {
    if (!active || camera.position.lengthSq() === 0) return Promise.resolve();
    settle?.finish();
    return new Promise((resolve) => {
      settle = { start: performance.now(), ms, from: camera.position.clone(), finish: resolve };
      renderUntil = performance.now() + ms + 60;
    });
  }

  function pointTo(nx: number, ny: number): void {
    desired.set(nx * parallax, -ny * parallax, 0);
    renderUntil = performance.now() + 300;
  }

  renderer.setAnimationLoop((time) => {
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    if (!active) return;
    if (settle) {
      const progress = Math.min((time - settle.start) / settle.ms, 1);
      camera.position.lerpVectors(settle.from, ORIGIN, 1 - Math.pow(1 - progress, 3));
      camera.lookAt(target);
      renderer.render(scene3d, camera);
      if (progress < 1) return;
      const finish = settle.finish;
      settle = null;
      desired.set(0, 0, 0);
      finish();
      return;
    }
    const drifting = driftEnabled && !pointerHeld;
    if (drifting) {
      const elapsed = time - liveStart;
      desired.set(
        DRIFT_X * Math.sin(0.00072 * elapsed) * parallax,
        DRIFT_Y * Math.sin(0.00043 * elapsed + 0.8) * parallax,
        0,
      );
    }
    const settling = camera.position.distanceTo(desired) > parallax * 0.006;
    if (!drifting && !settling && performance.now() > renderUntil) return;
    camera.position.lerp(desired, 1 - Math.exp(-SMOOTHING * dt));
    camera.lookAt(target);
    renderer.render(scene3d, camera);
  });

  const viewer: Viewer = { activate, deactivate, pointTo, recenter };
  viewerInstance = viewer;
  return viewer;
}
