const TILT_RANGE_DEG = 18;
const TILT_DEADZONE = 0.012;
const BASELINE_DECAY = 0.0008;

type TiltHandler = (nx: number, ny: number) => void;

type OrientationPermissionApi = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

let granted = false;
let pending: Promise<boolean> | null = null;

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

async function requestAccess(): Promise<boolean> {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return false;
  const api = window.DeviceOrientationEvent as OrientationPermissionApi;
  if (typeof api.requestPermission !== "function") return true;
  try {
    return (await api.requestPermission()) === "granted";
  } catch (error) {
    console.error("device orientation permission failed:", error);
    return false;
  }
}

export function ensureTiltAccess(): Promise<boolean> {
  if (granted) return Promise.resolve(true);
  if (!pending) {
    pending = requestAccess().then((ok) => {
      granted = ok;
      pending = null;
      return ok;
    });
  }
  return pending;
}

function startTilt(onTilt: TiltHandler): () => void {
  let baseBeta = 0;
  let baseGamma = 0;
  let ready = false;
  let lastX = 0;
  let lastY = 0;

  const handle = (event: DeviceOrientationEvent) => {
    const { beta, gamma } = event;
    if (beta === null || gamma === null) return;
    if (!ready) {
      baseBeta = beta;
      baseGamma = gamma;
      ready = true;
      return;
    }
    baseBeta += (beta - baseBeta) * BASELINE_DECAY;
    baseGamma += (gamma - baseGamma) * BASELINE_DECAY;

    const angle = ((window.screen.orientation?.angle ?? 0) * Math.PI) / 180;
    const dx = (gamma - baseGamma) / TILT_RANGE_DEG;
    const dy = (beta - baseBeta) / TILT_RANGE_DEG;
    const nx = clamp(dx * Math.cos(angle) + dy * Math.sin(angle));
    const ny = clamp(dy * Math.cos(angle) - dx * Math.sin(angle));

    if (Math.abs(nx - lastX) < TILT_DEADZONE && Math.abs(ny - lastY) < TILT_DEADZONE) return;
    lastX = nx;
    lastY = ny;
    onTilt(nx, ny);
  };

  window.addEventListener("deviceorientation", handle);
  return () => window.removeEventListener("deviceorientation", handle);
}

export function attachTilt(onTilt: TiltHandler): () => void {
  let stop: (() => void) | null = null;
  let disposed = false;

  const tryAccess = () => {
    ensureTiltAccess()
      .then((ok) => {
        if (!ok || disposed || stop) return;
        window.removeEventListener("pointerdown", tryAccess);
        stop = startTilt(onTilt);
      })
      .catch((error) => console.error("device orientation unavailable:", error));
  };

  tryAccess();
  window.addEventListener("pointerdown", tryAccess);

  return () => {
    disposed = true;
    window.removeEventListener("pointerdown", tryAccess);
    stop?.();
  };
}
