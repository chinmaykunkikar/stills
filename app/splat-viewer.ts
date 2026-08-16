import type { SplatMesh } from "@sparkjsdev/spark";

export type SceneEntry = {
  name: string;
  sog: string;
  thumb: string;
  aspect: number;
  focus: number;
  fov: number;
  caption: string;
};

const PARALLAX_METERS = 0.08;
const SMOOTHING = 8;
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
};

let viewerPromise: Promise<Viewer> | null = null;
let viewerInstance: Viewer | null = null;
let sessionToken = 0;

export async function activateScene(entry: SceneEntry, frame: HTMLElement): Promise<boolean> {
  const token = ++sessionToken;
  if (!viewerPromise) viewerPromise = createViewer();
  const viewer = await viewerPromise;
  if (token !== sessionToken) return false;
  return viewer.activate(entry, frame, token);
}

export function deactivateScene(): void {
  sessionToken++;
  viewerInstance?.deactivate();
}

export function pointScene(nx: number, ny: number): void {
  viewerInstance?.pointTo(nx, ny);
}

async function createViewer(): Promise<Viewer> {
  const [THREE, spark] = await Promise.all([import("three"), import("@sparkjsdev/spark")]);

  const scene3d = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 0.75, 0.01, 1000);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const sparkRenderer = new spark.SparkRenderer({ renderer });
  scene3d.add(sparkRenderer);

  const target = new THREE.Vector3(0, 0, -2.5);
  const desired = new THREE.Vector3(0, 0, 0);
  const bytesCache = new Map<string, ArrayBuffer>();
  const probePixel = new Uint8Array(4);
  let currentSplat: SplatMesh | null = null;
  let currentUrl: string | null = null;
  let active = false;
  let renderUntil = 0;
  let lastTime = 0;

  async function fetchSceneBytes(url: string): Promise<ArrayBuffer> {
    const cached = bytesCache.get(url);
    if (cached) return cached;
    const bytes = await (await fetch(url)).arrayBuffer();
    bytesCache.set(url, bytes);
    return bytes;
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
    camera.aspect = frame.clientWidth / frame.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(frame.clientWidth, frame.clientHeight, false);

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
    await currentSplat.initialized;
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
    renderUntil = performance.now() + 1000;
    return true;
  }

  function deactivate(): void {
    active = false;
  }

  function pointTo(nx: number, ny: number): void {
    desired.set(nx * PARALLAX_METERS, -ny * PARALLAX_METERS, 0);
    renderUntil = performance.now() + 300;
  }

  renderer.setAnimationLoop((time) => {
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    if (!active) return;
    const settling = camera.position.distanceTo(desired) > 0.0005;
    if (!settling && performance.now() > renderUntil) return;
    camera.position.lerp(desired, 1 - Math.exp(-SMOOTHING * dt));
    camera.lookAt(target);
    renderer.render(scene3d, camera);
  });

  const viewer: Viewer = { activate, deactivate, pointTo };
  viewerInstance = viewer;
  return viewer;
}
