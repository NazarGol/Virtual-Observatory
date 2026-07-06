// The Three.js scene for the instrument: the relocated sky as fixed-pixel point stars, with
// pan (drag), FOV zoom (wide-field <-> telescopic), raycast hover/pick, a selection ring,
// and measurement geodesic arcs. It is a plain class (not react-three-fiber) so the React
// layer just feeds it engine output via setStars/setSelection/setOverlays. No astronomy
// happens here -- positions are inertial unit directions from @vobs/engine.
import * as THREE from "three";
import type { Vec3 } from "@vobs/engine";

export interface StarPoint {
  dir: Vec3;
  mag: number;
  bp_rp: number;
  /** distance from the observer, parsecs (Distance sensor). */
  dist?: number;
  /** proper-motion rate at this vantage, mas/yr (Proper-motion sensor). */
  pm?: number;
  /** 1 if this star is in a highlighted co-moving group (Proper-motion sensor ↔ analysis). */
  hl?: number;
}

/** Instrument sensors. Each is a transform from the SAME real catalog fields
 *  (magnitude, colour bp_rp, parallax distance, proper motion) to on-screen
 *  luminance + colour — no fabricated data, just a different response curve. */
export type Sensor = "visible" | "thermal" | "proper_motion" | "distance" | "photometric";
export const SENSORS: Sensor[] = ["visible", "thermal", "proper_motion", "distance", "photometric"];
const SENSOR_CODE: Record<Sensor, number> = { visible: 0, thermal: 1, proper_motion: 2, distance: 3, photometric: 4 };

export interface BodyMarker {
  dir: Vec3;
  name: string;
  kind: string;
  /** apparent angular diameter, degrees (a point below resolvability) */
  diamDeg: number;
  /** sunlit fraction 0..1 (moons render as phases; host/undefined = full) */
  illum?: number;
}

const R = 100;
const R2D = 180 / Math.PI;
const tint = (bp: number): [number, number, number] => {
  const t = Math.max(0, Math.min(1, ((bp ?? 0.6) + 0.4) / 2.2));
  return [0.62 + 0.38 * t, 0.72 + 0.12 * Math.sin(t * Math.PI), 1.0 - 0.45 * t];
};

// --- Sensor physics (scientifically grounded, not decorative) ---
// Effective temperature from Gaia colour (Ballesteros 2012, B−V form; bp_rp is close enough
// for a colour->temperature estimate). Clamped to a sane stellar range.
function teffFromBpRp(bp: number): number {
  const c = Math.max(-0.4, Math.min(3.5, bp ?? 0.6));
  const T = 4600 * (1 / (0.92 * c + 1.7) + 1 / (0.92 * c + 0.62));
  return Math.max(2500, Math.min(30000, T));
}
// Temperature emphasis (Sun-normalised, ~(T/Tsun)^2): the Thermal sensor answers "which
// stars are actually HOT?" -- hot O/B stars blaze, cool stars recede, so what dominates the
// frame flips versus the eye. Derived from the real colour->Teff estimate.
function tempWeight(bp: number): number {
  return Math.max(0.05, Math.min(15, (teffFromBpRp(bp) / 5772) ** 2));
}
// Brightness (Phase 5): the shader maps magnitude -> flux -> tone-mapped luminance so the
// ~100x naked-eye range isn't linear-crushed; a size floor keeps faint stars from vanishing
// sub-pixel; the brightest handful bloom. Exposure/gain is a live uniform.
const MAG_ZERO_DEFAULT = 4.2; // magnitude that sits at mid-brightness at exposure 0

function ringTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#7fe9ff";
  g.lineWidth = 5;
  g.beginPath();
  g.arc(32, 32, 24, 0, Math.PI * 2);
  g.stroke();
  return new THREE.CanvasTexture(c);
}

function sunTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,246,214,1)");
  grad.addColorStop(0.18, "rgba(255,214,120,0.85)");
  grad.addColorStop(0.5, "rgba(255,180,80,0.25)");
  grad.addColorStop(1, "rgba(255,170,70,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function discTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.62, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.82, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill();
  return new THREE.CanvasTexture(c);
}

export class StarField {
  onHover?: (index: number | null) => void;
  onPick?: (index: number | null) => void;
  onView?: (fovDeg: number) => void;

  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private points?: THREE.Points;
  private geom?: THREE.BufferGeometry;
  private starMat?: THREE.ShaderMaterial;
  private exposure = 0;
  private mwPoints?: THREE.Points;
  private mwGeom?: THREE.BufferGeometry;
  private rawMw: { dir: Vec3; brightness: number }[] = [];
  private selGroup = new THREE.Group();
  private overlayGroup = new THREE.Group();
  private figureGroup = new THREE.Group();
  private labelGroup = new THREE.Group();
  private sunGroup = new THREE.Group();
  private bodyGroup = new THREE.Group();
  private pathGroup = new THREE.Group();  // body trails / orbital tracks (B4)
  private rawPaths: { pts: Vec3[]; color: number; ticks?: Vec3[] }[] = [];
  private groundGroup = new THREE.Group(); // dome ground + twilight (B8)
  private sensor: Sensor = "visible";
  private ringTex = ringTexture();
  private sunTex = sunTexture();
  private discTex = discTexture();
  private phaseTexCache = new Map<number, THREE.Texture>();
  private moonPhases: { sprite: THREE.Sprite; dir: Vec3; sunDir: Vec3 | null }[] = [];
  private rawSunDir: Vec3 | null = null;
  private rawBodies: BodyMarker[] = [];

  private yaw = 0;
  private pitch = 0;
  private fov = 60;
  private dragging = false;
  private moved = 0;
  private px = 0;
  private py = 0;
  private mouse = new THREE.Vector2(2, 2);
  private ray = new THREE.Raycaster();
  private hoverIndex: number | null = null;
  private raf = 0;
  private dpr: number;

  // projection (Phase 5 item 2). gnomonic = the perspective path (unchanged); fisheye/dome
  // reproject unit directions into a 2D disc rendered by an orthographic camera.
  private mode: "gnomonic" | "fisheye" | "dome" = "gnomonic";
  private orthoCam!: THREE.OrthographicCamera;
  private ortho2DZoom = 1;
  private eqLine?: THREE.LineLoop;
  private Lv: Vec3 = [1, 0, 0]; private Rv: Vec3 = [0, 0, -1]; private Uv: Vec3 = [0, 1, 0];
  private enuE: Vec3 = [0, 1, 0]; private enuN: Vec3 = [0, 0, 1]; private enuU: Vec3 = [1, 0, 0];
  private fisheyeMax = 2.55; // radians shown from the view centre (~146 deg)
  private rawStars: StarPoint[] = [];
  private rawOverlays: Vec3[][] = [];
  private rawFigures: Vec3[][] = [];
  private rawLabels: { dir: Vec3; text: string }[] = [];
  private rawSel: Vec3[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.dpr = Math.min(devicePixelRatio, 2);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(this.fov, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
    this.orthoCam.position.set(0, 0, 1);
    this.orthoCam.lookAt(0, 0, 0);
    this.scene.add(this.selGroup, this.overlayGroup, this.figureGroup, this.labelGroup, this.sunGroup, this.bodyGroup, this.pathGroup, this.groundGroup);

    // faint celestial-equator ring for orientation (gnomonic only)
    const eq = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 161 }, (_, i) => {
        const a = (i / 160) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0);
      }),
    );
    this.eqLine = new THREE.LineLoop(eq, new THREE.LineBasicMaterial({ color: 0x12233a }));
    this.scene.add(this.eqLine);

    this.updateOrtho();
    this.updateViewBasis(); // init the fisheye basis up front so it's never stale on entry
    this.applyLook();
    this.bind();
    this.loop();
  }

  private activeCam(): THREE.Camera { return this.mode === "gnomonic" ? this.camera : this.orthoCam; }

  private updateOrtho(): void {
    const aspect = this.container.clientWidth / this.container.clientHeight || 1;
    const half = (1.15 * R) / this.ortho2DZoom;
    this.orthoCam.left = -half * aspect; this.orthoCam.right = half * aspect;
    this.orthoCam.top = half; this.orthoCam.bottom = -half;
    this.orthoCam.updateProjectionMatrix();
  }

  private updateViewBasis(): void {
    const cp = Math.cos(this.pitch);
    const L: Vec3 = [Math.cos(this.yaw) * cp, Math.sin(this.pitch), Math.sin(this.yaw) * cp];
    let rx = L[2], ry = 0, rz = -L[0]; // cross(L, worldUp=[0,1,0]) -> right
    const rn = Math.hypot(rx, ry, rz) || 1e-9; rx /= rn; ry /= rn; rz /= rn;
    const R2: Vec3 = [rx, ry, rz];
    const U2: Vec3 = [R2[1] * L[2] - R2[2] * L[1], R2[2] * L[0] - R2[0] * L[2], R2[0] * L[1] - R2[1] * L[0]]; // cross(right, L)
    this.Lv = L; this.Rv = R2; this.Uv = U2;
  }

  /** Scene-space position of a unit direction under the active projection (null = off-view). */
  private projectScene(d: Vec3): [number, number, number] | null {
    if (this.mode === "gnomonic") return [d[0] * R, d[1] * R, d[2] * R];
    if (this.mode === "fisheye") {
      const fwd = d[0] * this.Lv[0] + d[1] * this.Lv[1] + d[2] * this.Lv[2];
      const theta = Math.acos(Math.max(-1, Math.min(1, fwd)));
      if (theta > this.fisheyeMax) return null;
      const rx = d[0] * this.Rv[0] + d[1] * this.Rv[1] + d[2] * this.Rv[2];
      const ry = d[0] * this.Uv[0] + d[1] * this.Uv[1] + d[2] * this.Uv[2];
      const rn = Math.hypot(rx, ry) || 1e-9;
      const rr = theta / this.fisheyeMax; // equidistant
      return [(rx / rn) * rr * R, (ry / rn) * rr * R, 0];
    }
    // dome: alt/az, zenith at centre, horizon at the edge circle
    const alt = Math.asin(Math.max(-1, Math.min(1, d[0] * this.enuU[0] + d[1] * this.enuU[1] + d[2] * this.enuU[2])));
    if (alt < -0.02) return null;
    const east = d[0] * this.enuE[0] + d[1] * this.enuE[1] + d[2] * this.enuE[2];
    const north = d[0] * this.enuN[0] + d[1] * this.enuN[1] + d[2] * this.enuN[2];
    const az = Math.atan2(east, north);
    const rr = 1 - alt / (Math.PI / 2);
    return [Math.sin(az) * rr * R, Math.cos(az) * rr * R, 0];
  }

  /** Reposition all geometry under the active projection (for fisheye/dome pans + data). */
  private relayout(): void {
    if (this.geom) this.layoutStars();
    this.layoutMilkyWay();
    this.setOverlays(this.rawOverlays);
    this.setFigures(this.rawFigures);
    this.setLabels(this.rawLabels);
    this.setSelection(this.rawSel);
    this.layoutSun();
    this.layoutBodies();
    this.layoutPaths();
    this.layoutGround();
  }

  setProjection(mode: "gnomonic" | "fisheye" | "dome"): void {
    this.mode = mode;
    if (this.eqLine) this.eqLine.visible = mode === "gnomonic";
    this.updateViewBasis();
    this.updateOrtho();
    this.relayout();
    this.onView?.(this.fov);
  }
  getProjection(): "gnomonic" | "fisheye" | "dome" { return this.mode; }

  /** East/North/Up (ICRS) for the dome projection; call on time/observer change. */
  setHorizonBasis(east: Vec3, north: Vec3, up: Vec3): void {
    this.enuE = east; this.enuN = north; this.enuU = up;
    if (this.mode === "dome") this.relayout();
  }

  private bind(): void {
    const el = this.renderer.domElement;
    el.addEventListener("pointerdown", (e) => { this.dragging = true; this.moved = 0; this.px = e.clientX; this.py = e.clientY; });
    window.addEventListener("pointerup", () => {
      if (this.dragging && this.moved < 5) this.onPick?.(this.hoverIndex);
      this.dragging = false;
    });
    window.addEventListener("pointermove", (e) => {
      this.mouse.x = ((e.clientX - el.getBoundingClientRect().left) / el.clientWidth) * 2 - 1;
      this.mouse.y = -((e.clientY - el.getBoundingClientRect().top) / el.clientHeight) * 2 + 1;
      if (!this.dragging) return;
      const dx = e.clientX - this.px, dy = e.clientY - this.py;
      this.moved += Math.abs(dx) + Math.abs(dy);
      const k = (this.fov / 60) * 0.0026; // pan slower when zoomed in
      this.yaw -= dx * k; this.pitch += dy * k; this.px = e.clientX; this.py = e.clientY;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
      if (this.mode === "gnomonic") this.applyLook();
      else if (this.mode === "fisheye") { this.updateViewBasis(); this.relayout(); }
      // dome is fixed to the local alt/az frame -- pan does not apply
    });
    el.addEventListener("wheel", (e) => { this.setFov(this.fov * (e.deltaY > 0 ? 1.1 : 1 / 1.1)); }, { passive: true });
  }

  private applyLook(): void {
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    const cp = Math.cos(this.pitch);
    this.camera.lookAt(Math.cos(this.yaw) * cp, Math.sin(this.pitch), Math.sin(this.yaw) * cp);
  }

  setFov(fovDeg: number): void {
    this.fov = Math.max(0.5, Math.min(120, fovDeg));
    if (this.mode === "gnomonic") { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
    else { this.ortho2DZoom = 60 / this.fov; this.updateOrtho(); }
    this.onView?.(this.fov);
  }
  getFov(): number { return this.fov; }

  setStars(stars: StarPoint[]): void {
    this.rawStars = stars;
    const N = stars.length;
    const tnt = new Float32Array(N * 3), mag = new Float32Array(N), dir = new Float32Array(N * 3);
    const bprp = new Float32Array(N), dst = new Float32Array(N), pm = new Float32Array(N), tw = new Float32Array(N), grp = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const s = stars[i];
      const c = tint(s.bp_rp);
      tnt[i * 3] = c[0]; tnt[i * 3 + 1] = c[1]; tnt[i * 3 + 2] = c[2];
      mag[i] = s.mag;
      bprp[i] = s.bp_rp ?? 0.6; dst[i] = s.dist ?? 10; pm[i] = s.pm ?? 0; tw[i] = tempWeight(s.bp_rp); grp[i] = s.hl ?? 0;
      dir[i * 3] = s.dir[0]; dir[i * 3 + 1] = s.dir[1]; dir[i * 3 + 2] = s.dir[2];
    }
    if (!this.geom) {
      this.geom = new THREE.BufferGeometry();
      this.starMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: {
          uDpr: { value: this.dpr }, uExposure: { value: this.exposure }, uZero: { value: MAG_ZERO_DEFAULT },
          uSunDir: { value: new THREE.Vector3(1, 0, 0) }, uSunCos: { value: 2 }, uSunOn: { value: 0 },
          uSensor: { value: SENSOR_CODE[this.sensor] },
          uPmRef: { value: 180.0 },        // mas/yr that reads as full-scale on the PM sensor
          uDistNear: { value: 0.0 }, uDistFar: { value: 8.5 }, // log2(pc) ramp ends for Distance
        },
        vertexShader: `
          attribute vec3 tint; attribute float mag; attribute float vis; attribute vec3 dir;
          attribute float bprp; attribute float dist; attribute float pmr; attribute float tw; attribute float grp;
          uniform float uDpr, uExposure, uZero;
          uniform vec3 uSunDir; uniform float uSunCos, uSunOn;
          uniform int uSensor; uniform float uPmRef, uDistNear, uDistFar;
          varying vec3 vC; varying float vBloom;
          // temperature false-colour from Gaia colour (blue-white hot -> deep red cool)
          vec3 thermalPalette(float c){
            float t = clamp((c + 0.3) / 3.3, 0.0, 1.0);
            vec3 hot = vec3(0.74, 0.85, 1.0), mid = vec3(1.0, 0.95, 0.74), cool = vec3(1.0, 0.40, 0.22);
            return t < 0.5 ? mix(hot, mid, t * 2.0) : mix(mid, cool, (t - 0.5) * 2.0);
          }
          void main(){
            float flux = pow(2.512, (uZero + uExposure) - mag);   // relative flux (huge range)
            float reinh = flux / (flux + 1.0);                     // Reinhard tone-map -> [0,1)
            float wash = uSunOn * smoothstep(uSunCos - 0.06, uSunCos + 0.02, dot(dir, uSunDir));
            float lum; vec3 col; float sizeBoost = 1.0;
            if (uSensor == 1) {                 // TEMPERATURE: hot stars blaze, cool recede
              float f = flux * tw;              // tw ~ (Teff/Tsun)^2 (CPU-side, from real colour)
              lum = (f / (f + 1.0)) * (1.0 - 0.5 * wash);
              col = thermalPalette(bprp) * clamp(lum * 1.25, 0.05, 1.0);
            } else if (uSensor == 2) {          // PROPER MOTION: movers blaze; co-movers highlighted
              float pf = pow(clamp(pmr / uPmRef, 0.0, 1.0), 0.5);
              lum = reinh * (0.08 + 0.92 * pf) * (1.0 - 0.4 * wash); // slow stars nearly vanish
              col = mix(vec3(0.13, 0.16, 0.25), vec3(1.0, 0.42, 0.92), pf);
              if (grp > 0.5) { col = vec3(0.40, 1.0, 0.72); lum = max(lum, 0.7); } // analysis co-moving group
              col *= clamp(0.30 + lum, 0.12, 1.0);
              sizeBoost = 1.0 + 2.6 * pf + (grp > 0.5 ? 1.8 : 0.0);
            } else if (uSensor == 3) {          // DISTANCE: near big+warm, far small+cool
              float df = clamp((log2(dist + 1.0) - uDistNear) / (uDistFar - uDistNear), 0.0, 1.0);
              lum = reinh * (0.15 + 0.85 * (1.0 - df)) * (1.0 - 0.4 * wash);
              col = mix(vec3(1.0, 0.5, 0.30), vec3(0.36, 0.60, 1.0), df) * clamp(0.30 + lum, 0.14, 1.0);
              sizeBoost = 1.0 + 3.0 * (1.0 - df); // near stars dramatically larger
            } else if (uSensor == 4) {          // PHOTOMETRIC: linear detector, response ∝ flux
              lum = clamp(flux * 1.4, 0.0, 1.0) * (1.0 - 0.5 * wash); // no perceptual compression
              col = vec3(0.72, 0.88, 0.82) * clamp(lum + 0.03, 0.03, 1.0);
            } else {                            // VISIBLE: perceptual, true colour (default)
              lum = reinh * (1.0 - 0.98 * wash);
              col = tint * clamp(lum * 1.15, 0.045, 1.0);
            }
            vBloom = smoothstep(0.86, 1.0, lum);
            vC = col;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = (1.4 + 2.4 * lum + 3.4 * vBloom) * sizeBoost * uDpr * vis; // vis=0 hides off-view
          }`,
        fragmentShader: `
          varying vec3 vC; varying float vBloom;
          void main(){
            vec2 d = gl_PointCoord - vec2(0.5); float r = length(d);
            if (r > 0.5) discard;
            float core = smoothstep(0.5, 0.06, r);
            float halo = vBloom * smoothstep(0.5, 0.0, r) * 0.6;   // soft glow only on bright stars
            gl_FragColor = vec4(vC, core + halo);
          }`,
      });
      this.points = new THREE.Points(this.geom, this.starMat);
      this.points.frustumCulled = false;
      this.scene.add(this.points);
    }
    this.geom.setAttribute("tint", new THREE.BufferAttribute(tnt, 3));
    this.geom.setAttribute("mag", new THREE.BufferAttribute(mag, 1));
    this.geom.setAttribute("dir", new THREE.BufferAttribute(dir, 3));
    this.geom.setAttribute("bprp", new THREE.BufferAttribute(bprp, 1));
    this.geom.setAttribute("dist", new THREE.BufferAttribute(dst, 1));
    this.geom.setAttribute("pmr", new THREE.BufferAttribute(pm, 1));
    this.geom.setAttribute("tw", new THREE.BufferAttribute(tw, 1));
    this.geom.setAttribute("grp", new THREE.BufferAttribute(grp, 1));
    this.layoutStars();
  }

  /** Switch instrument sensor (response curve). Positions are unchanged; only the
   *  per-star luminance/colour transform in the shader changes. */
  setSensor(sensor: Sensor): void {
    this.sensor = sensor;
    if (this.starMat) this.starMat.uniforms.uSensor!.value = SENSOR_CODE[sensor];
  }
  getSensor(): Sensor { return this.sensor; }

  /** Host-star glare: wash out stars within radiusDeg of the sun when it is up (dir set). */
  setSun(dirIcrs: Vec3 | null, radiusDeg: number): void {
    this.rawSunDir = dirIcrs;
    if (this.starMat) {
      this.starMat.uniforms.uSunOn!.value = dirIcrs ? 1 : 0;
      if (dirIcrs) {
        const n = Math.hypot(dirIcrs[0], dirIcrs[1], dirIcrs[2]) || 1;
        this.starMat.uniforms.uSunDir!.value.set(dirIcrs[0] / n, dirIcrs[1] / n, dirIcrs[2] / n);
        this.starMat.uniforms.uSunCos!.value = Math.cos((radiusDeg * Math.PI) / 180);
      }
    }
    this.layoutSun();
    this.layoutGround();
  }

  private layoutSun(): void {
    this.sunGroup.clear();
    if (!this.rawSunDir) return;
    const p = this.projectScene(this.rawSunDir);
    if (!p) return;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sunTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.position.set(p[0], p[1], p[2]);
    sp.scale.setScalar(this.mode === "gnomonic" ? 26 : 20);
    this.sunGroup.add(sp);
  }

  /** Dome ground (B8): the terrain beyond the horizon, a horizon line, and a warm twilight
   *  glow at the host star's azimuth when it sits near the horizon. Dome projection only —
   *  it grounds the all-sky view as "standing on a world" rather than a floating star chart. */
  private layoutGround(): void {
    this.groundGroup.clear();
    if (this.mode !== "dome") { this.groundGroup.visible = false; return; }
    this.groundGroup.visible = true;
    // terrain: a warm-charcoal annulus filling the below-horizon corners
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(R * 1.002, R * 2.8, 120),
      new THREE.MeshBasicMaterial({ color: 0x15110b, transparent: true, opacity: 0.94, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.set(0, 0, -0.5); ring.renderOrder = -1;
    this.groundGroup.add(ring);
    // the horizon line itself
    const hz = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0);
      })),
      new THREE.LineBasicMaterial({ color: 0x4a4336 }));
    hz.renderOrder = 0;
    this.groundGroup.add(hz);
    // twilight glow at the sun's azimuth, strongest as it crosses the horizon
    if (this.rawSunDir) {
      const s = this.rawSunDir;
      const up = s[0] * this.enuU[0] + s[1] * this.enuU[1] + s[2] * this.enuU[2];
      const altDeg = Math.asin(Math.max(-1, Math.min(1, up))) * R2D;
      const ss = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      const tw = ss(-18, -2, altDeg) * (1 - ss(6, 14, altDeg));
      if (tw > 0.01) {
        const east = s[0] * this.enuE[0] + s[1] * this.enuE[1] + s[2] * this.enuE[2];
        const north = s[0] * this.enuN[0] + s[1] * this.enuN[1] + s[2] * this.enuN[2];
        const az = Math.atan2(east, north);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.sunTex, color: 0xffab5c, transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending, opacity: 0.55 * tw }));
        glow.position.set(Math.sin(az) * R, Math.cos(az) * R, 0.2);
        glow.center.set(0.5, 0.32); // bias the glow up into the sky, not the ground
        glow.scale.setScalar(95);
        this.groundGroup.add(glow);
      }
    }
  }

  /** Host star, moons, sibling planets -- drawn in every projection at their correct angular
   *  size (a point below resolvability), each labelled. */
  setBodies(bodies: BodyMarker[]): void {
    this.rawBodies = bodies;
    this.layoutBodies();
  }

  private layoutBodies(): void {
    this.bodyGroup.clear();
    this.moonPhases = [];
    const host = this.rawBodies.find((b) => b.kind === "host_star");
    const hostDir = host ? host.dir : this.rawSunDir;
    for (const b of this.rawBodies) {
      const p = this.projectScene(b.dir);
      if (!p) continue;
      const theta = (b.diamDeg * Math.PI) / 180; // angular diameter, radians
      const perRad = this.mode === "gnomonic" ? R : this.mode === "fisheye" ? R / this.fisheyeMax : R / (Math.PI / 2);
      const size = Math.max(1.3, Math.min(45, theta * perRad)); // floor = a visible point
      if (b.kind === "moon" && b.illum != null) {
        // moon rendered as a lit phase; its terminator is oriented toward the host each frame
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.phaseTexture(Math.round(b.illum * 20)), transparent: true, depthWrite: false }));
        sprite.position.set(p[0], p[1], p[2]);
        sprite.scale.setScalar(Math.max(3.5, size));
        this.bodyGroup.add(sprite);
        this.moonPhases.push({ sprite, dir: b.dir, sunDir: hostDir });
      } else {
        const color = b.kind === "host_star" ? 0xffe08a : b.kind === "moon" ? 0xd6dbe2 : 0x9fc0ff;
        const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.discTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        disc.position.set(p[0], p[1], p[2]);
        disc.scale.setScalar(size);
        this.bodyGroup.add(disc);
      }
      const lab = makeTextSprite(b.name, b.kind === "host_star" ? "#ffe08a" : "#c8d2e0");
      lab.position.set(p[0], p[1], p[2]);
      this.bodyGroup.add(lab);
    }
  }

  /** Canonical moon-phase disc (lit hemisphere toward +x), cached per 5%% illumination
   *  bucket; the sprite is rotated at render time so the lit side faces the host star. */
  private phaseTexture(bucket: number): THREE.Texture {
    const cached = this.phaseTexCache.get(bucket);
    if (cached) return cached;
    const frac = Math.max(0, Math.min(1, bucket / 20));
    const S = 64, c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const cx = S / 2, cy = S / 2, rad = S / 2 - 2;
    g.fillStyle = "rgba(150,160,178,0.13)"; // dark side, faint (earthshine)
    g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(226,230,238,1)";    // sunlit side
    g.beginPath();
    g.arc(cx, cy, rad, -Math.PI / 2, Math.PI / 2, false); // the sun-facing (right) limb
    const rx = rad * (1 - 2 * frac);                       // terminator ellipse (signed)
    g.ellipse(cx, cy, Math.abs(rx), rad, 0, Math.PI / 2, -Math.PI / 2, rx > 0);
    g.fill();
    const tex = new THREE.CanvasTexture(c);
    this.phaseTexCache.set(bucket, tex);
    return tex;
  }

  /** On-sky tracks for bodies (B4): where each body travels over a span. Each polyline is
   *  projected point-by-point and broken into visible segments so it clips cleanly in
   *  fisheye/dome. Dim, drawn behind the body discs. */
  setPaths(paths: { pts: Vec3[]; color: number; ticks?: Vec3[] }[]): void {
    this.rawPaths = paths;
    this.layoutPaths();
  }

  private layoutPaths(): void {
    this.pathGroup.clear();
    for (const path of this.rawPaths) {
      const mat = new THREE.LineBasicMaterial({ color: path.color, transparent: true, opacity: 0.5 });
      let seg: THREE.Vector3[] = [];
      const flush = () => {
        if (seg.length >= 2) this.pathGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(seg), mat));
        seg = [];
      };
      for (const d of path.pts) {
        const p = this.projectScene(d);
        if (p) seg.push(new THREE.Vector3(p[0], p[1], p[2]));
        else flush();
      }
      flush();
      // even-time tick marks: their spacing reads as speed (bunched = slow, spread = fast)
      if (path.ticks && path.ticks.length) {
        const pts: number[] = [];
        for (const d of path.ticks) { const p = this.projectScene(d); if (p) pts.push(p[0], p[1], p[2]); }
        if (pts.length) {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
          this.pathGroup.add(new THREE.Points(g, new THREE.PointsMaterial({ color: path.color, size: 3.2 * this.dpr, sizeAttenuation: false, transparent: true, opacity: 0.85 })));
        }
      }
    }
  }

  private layoutStars(): void {
    if (!this.geom) return;
    const N = this.rawStars.length;
    const pos = new Float32Array(N * 3), vis = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const p = this.projectScene(this.rawStars[i]!.dir);
      if (p) { pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; vis[i] = 1; }
      else { pos[i * 3] = 1e6; vis[i] = 0; }
    }
    this.geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.geom.setAttribute("vis", new THREE.BufferAttribute(vis, 1));
    this.geom.attributes.position.needsUpdate = true;
  }

  /** Live exposure/gain (stops): shifts the magnitude that reads as mid-brightness. */
  setExposure(stops: number): void {
    this.exposure = stops;
    if (this.starMat) this.starMat.uniforms.uExposure!.value = stops;
  }
  getExposure(): number { return this.exposure; }

  /** Milky Way as a structured point cloud (directions + brightness). Projected like stars,
   *  so it renders in every projection and moves with the vantage. Empty array hides it. */
  setMilkyWayPoints(pts: { dir: Vec3; brightness: number }[]): void {
    this.rawMw = pts;
    if (!this.mwPoints) {
      this.mwGeom = new THREE.BufferGeometry();
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uDpr: { value: this.dpr } },
        vertexShader: `attribute float b; varying float vB; uniform float uDpr;
          void main(){ vB = b; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = 2.4 * uDpr; }`,
        fragmentShader: `varying float vB; void main(){ vec2 d = gl_PointCoord - vec2(0.5);
          if (length(d) > 0.5) discard;
          gl_FragColor = vec4(vec3(0.40, 0.44, 0.58) * vB, 0.5 * vB); }`,
      });
      this.mwPoints = new THREE.Points(this.mwGeom, mat);
      this.mwPoints.frustumCulled = false;
      this.mwPoints.renderOrder = -2;
      this.scene.add(this.mwPoints);
    }
    const bb = new Float32Array(pts.length);
    for (let i = 0; i < pts.length; i++) bb[i] = pts[i]!.brightness;
    this.mwGeom!.setAttribute("b", new THREE.BufferAttribute(bb, 1));
    this.mwPoints!.visible = pts.length > 0;
    this.layoutMilkyWay();
  }

  private layoutMilkyWay(): void {
    if (!this.mwGeom) return;
    const N = this.rawMw.length;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const p = this.projectScene(this.rawMw[i]!.dir);
      if (p) { pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2]; }
      else pos[i * 3] = 1e6;
    }
    this.mwGeom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.mwGeom.attributes.position.needsUpdate = true;
  }

  setSelection(dirs: Vec3[]): void {
    this.rawSel = dirs;
    this.selGroup.clear();
    for (const d of dirs) {
      const p = this.projectScene(d);
      if (!p) continue;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ringTex, transparent: true, depthWrite: false }));
      sp.position.set(p[0], p[1], p[2]);
      const base = this.mode === "gnomonic" ? 6 : 5;
      sp.userData.base = base; sp.scale.setScalar(base);
      this.selGroup.add(sp);
    }
  }

  private projArc(arc: Vec3[]): THREE.Vector3[] | null {
    const out: THREE.Vector3[] = [];
    for (const d of arc) { const p = this.projectScene(d); if (!p) return null; out.push(new THREE.Vector3(p[0], p[1], p[2])); }
    return out;
  }

  /** Each overlay is a polyline of inertial unit directions (a geodesic arc). */
  setOverlays(arcs: Vec3[][]): void {
    this.rawOverlays = arcs;
    this.overlayGroup.clear();
    for (const arc of arcs) {
      const pts = this.projArc(arc);
      if (pts) this.overlayGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8fe3ff })));
    }
  }

  /** Annotation figure edges (constellations / sketches), drawn warm to distinguish them. */
  setFigures(arcs: Vec3[][]): void {
    this.rawFigures = arcs;
    this.figureGroup.clear();
    for (const arc of arcs) {
      const pts = this.projArc(arc);
      if (pts) this.figureGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffcf6b })));
    }
  }

  /** Text labels pinned to inertial directions (anchored to objects by the React layer). */
  setLabels(labels: { dir: Vec3; text: string }[]): void {
    this.rawLabels = labels;
    this.labelGroup.clear();
    for (const l of labels) {
      const p = this.projectScene(l.dir);
      if (!p) continue;
      const sp = makeTextSprite(l.text);
      sp.position.set(p[0], p[1], p[2]);
      this.labelGroup.add(sp);
    }
  }

  resize(): void {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.updateOrtho();
    this.renderer.setSize(w, h);
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    const cam = this.activeCam();
    if (this.points) {
      this.ray.params.Points!.threshold = this.mode === "gnomonic"
        ? (this.fov / 60) * 1.4
        : ((1.15 * R) / this.ortho2DZoom) * 0.02; // world-unit threshold in the 2D ortho frame
      this.ray.setFromCamera(this.mouse, cam);
      const hit = this.ray.intersectObject(this.points, false)[0];
      const idx = hit ? hit.index ?? null : null;
      if (idx !== this.hoverIndex) { this.hoverIndex = idx; this.onHover?.(idx); }
    }
    // orient each moon's phase so its lit limb faces the host star, in screen space
    if (this.moonPhases.length) {
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      for (const mp of this.moonPhases) {
        if (!mp.sunDir) continue;
        const m = this.projectScene(mp.dir), s = this.projectScene(mp.sunDir);
        if (!m || !s) continue;
        const dx = s[0] - m[0], dy = s[1] - m[1], dz = s[2] - m[2];
        (mp.sprite.material as THREE.SpriteMaterial).rotation =
          Math.atan2(dx * up.x + dy * up.y + dz * up.z, dx * right.x + dy * right.y + dz * right.z);
      }
    }
    // gentle breathing pulse on selection rings (subtle motion, no bounce)
    if (this.selGroup.children.length) {
      const k = 1 + 0.11 * Math.sin(performance.now() * 0.005);
      for (const c of this.selGroup.children) c.scale.setScalar(((c.userData.base as number) || 6) * k);
    }
    this.renderer.render(this.scene, cam);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function makeTextSprite(text: string, color = "#ffe1a3"): THREE.Sprite {
  const font = 26, pad = 7;
  const meas = document.createElement("canvas").getContext("2d")!;
  meas.font = `${font}px ui-monospace, monospace`;
  const w = Math.ceil(meas.measureText(text).width) + pad * 2;
  const c = document.createElement("canvas");
  c.width = w; c.height = font + pad * 2;
  const g = c.getContext("2d")!;
  g.font = `${font}px ui-monospace, monospace`;
  g.fillStyle = color; g.textBaseline = "middle"; g.textAlign = "left";
  g.shadowColor = "#000"; g.shadowBlur = 4;
  g.fillText(text, pad, c.height / 2);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.center.set(-0.05, 0.5); // sit just to the right of the anchor
  sp.scale.set((c.width / c.height) * 3.4, 3.4, 1);
  return sp;
}

/** Geodesic (great-circle) arc between two unit directions, as N+1 sampled unit vectors. */
export function geodesicArc(a: Vec3, b: Vec3, n = 48): Vec3[] {
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  const out: Vec3[] = [];
  if (omega < 1e-6) return [a, b];
  const so = Math.sin(omega);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s0 = Math.sin((1 - t) * omega) / so, s1 = Math.sin(t * omega) / so;
    const v: Vec3 = [a[0] * s0 + b[0] * s1, a[1] * s0 + b[1] * s1, a[2] * s0 + b[2] * s1];
    const len = Math.hypot(v[0], v[1], v[2]);
    out.push([v[0] / len, v[1] / len, v[2] / len]);
  }
  return out;
}

export { R2D };
