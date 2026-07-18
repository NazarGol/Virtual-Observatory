// The Three.js scene for the instrument (Phase 6R: the PLOTTED sky). The relocated real sky
// drawn as a stipple chart — cartography, not a planetarium: stars are discrete ink classes
// (dots -> dotted-ring glyphs) from the plot.ts seam, the Milky Way is a dot-density field,
// user lines are dotted ink. Pan (drag), FOV zoom, raycast hover/pick unchanged. No
// astronomy happens here -- positions are inertial unit directions from @vobs/engine.
import * as THREE from "three";
import type { Vec3 } from "@vobs/engine";
import { magClass, ringedRanks } from "../plot";

export interface StarPoint {
  dir: Vec3;
  mag: number;
}

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


// --- ink plates (Phase 6R, multi-pen plotter logic: semantic, never decorative) ---
export const INK = { white: "#f2efe6", gold: "#f0dc84", blush: "#f0c8a8", signal: "#f01428" } as const;
export const INK_HEX = { gold: 0xf0dc84, blush: 0xf0c8a8, dimgold: 0x8a7d4a, signal: 0xf01428 } as const;

/** Dotted circle helper for canvas glyphs. */
function dottedCircle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, dotR: number, color: string): void {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, dotR, 0, Math.PI * 2); g.fill();
  }
}

/** The host star: the largest concentric dotted-ring glyph, unmistakable, GOLD plate. */
function hostGlyphTexture(): THREE.Texture {
  const S = 128, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = INK.gold;
  g.beginPath(); g.arc(S / 2, S / 2, 5, 0, Math.PI * 2); g.fill();
  dottedCircle(g, S / 2, S / 2, 16, 10, 1.8, INK.gold);
  dottedCircle(g, S / 2, S / 2, 30, 16, 1.8, INK.gold);
  dottedCircle(g, S / 2, S / 2, 45, 24, 1.8, INK.gold);
  dottedCircle(g, S / 2, S / 2, 60, 32, 1.6, INK.gold);
  return new THREE.CanvasTexture(c);
}

/** Sibling planets: a dim gold diamond marker. */
function siblingGlyphTexture(): THREE.Texture {
  const S = 48, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.strokeStyle = INK.gold; g.globalAlpha = 0.55; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(S / 2, 6); g.lineTo(S - 6, S / 2); g.lineTo(S / 2, S - 6); g.lineTo(6, S / 2); g.closePath();
  g.stroke();
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
  private rawMw: { dir: Vec3 }[] = [];
  private selGroup = new THREE.Group();
  private overlayGroup = new THREE.Group();
  private figureGroup = new THREE.Group();
  private labelGroup = new THREE.Group();
  private sunGroup = new THREE.Group();
  private bodyGroup = new THREE.Group();
  private pathGroup = new THREE.Group();  // crawling orbital tracks (Phase 6R)
  private rawPaths: { pts: Vec3[]; color: number; periodYears: number }[] = [];
  // per-path crawl state: projected polyline + a reusable dot buffer marched in loop()
  private crawls: { proj: ([number, number, number] | null)[]; period: number; points: THREE.Points; buf: Float32Array }[] = [];
  private plotTimeYears = 0;
  private groundGroup = new THREE.Group(); // dome ground (B8; twilight glow removed in 6R)
  private hostTex = hostGlyphTexture();
  private sibTex = siblingGlyphTexture();
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
    this.renderer.setClearColor(0x000000, 1); // the plot's ground is pure black
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(this.fov, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
    this.orthoCam.position.set(0, 0, 1);
    this.orthoCam.lookAt(0, 0, 0);
    this.scene.add(this.selGroup, this.overlayGroup, this.figureGroup, this.labelGroup, this.sunGroup, this.bodyGroup, this.pathGroup, this.groundGroup);

    // faint dotted celestial-equator ring for orientation (gnomonic only) — chart ink
    const eq = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 161 }, (_, i) => {
        const a = (i / 160) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0);
      }),
    );
    this.eqLine = new THREE.LineLoop(eq, new THREE.LineDashedMaterial({
      color: 0xffffff, transparent: true, opacity: 0.14, dashSize: 0.8, gapSize: 1.6 }));
    this.eqLine.computeLineDistances();
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
    if (!this.geom) {
      this.geom = new THREE.BufferGeometry();
      // The plotted-star shader: DISCRETE ink classes (from plot.ts, computed CPU-side), all
      // white ink, no glow/bloom/tone-map. Faint-to-mid classes are stepped dots; class 4 is
      // a dot with one fine dotted ring; the ~20 brightest are concentric dotted-ring glyphs
      // that counter-rotate very slowly (the reference's ringed nodes).
      this.starMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.NormalBlending,
        uniforms: { uDpr: { value: this.dpr }, uTime: { value: 0 } },
        vertexShader: `
          attribute float vis; attribute float cls; attribute float rank; attribute float seed;
          uniform float uDpr;
          varying float vCls; varying float vRank; varying float vSeed;
          void main(){
            vCls = cls; vRank = rank; vSeed = seed;
            float ps =
              rank > 0.5 ? mix(46.0, 26.0, clamp((rank - 1.0) / 19.0, 0.0, 1.0)) :
              cls > 3.5 ? 16.0 :
              cls > 2.5 ? 5.4 :
              cls > 1.5 ? 3.8 :
              cls > 0.5 ? 2.6 : 1.7;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = ps * uDpr * vis;  // vis=0 hides off-view points
          }`,
        fragmentShader: `
          varying float vCls; varying float vRank; varying float vSeed;
          uniform float uTime;
          float ringInk(vec2 q, float r0, float w, float n, float phase){
            float radial = 1.0 - smoothstep(w * 0.5, w, abs(length(q) - r0));
            float f = abs(fract((atan(q.y, q.x) + phase) * n * 0.15915494) - 0.5);
            return radial * (1.0 - smoothstep(0.16, 0.30, f));
          }
          void main(){
            vec2 q = gl_PointCoord - vec2(0.5);
            float r = length(q);
            float ink;
            if (vRank > 0.5) {          // ringed node: core + counter-rotating dotted rings
              float rot = (mod(vRank, 2.0) * 2.0 - 1.0) * (0.05 + 0.10 * fract(vSeed * 7.31));
              float ph = vSeed * 6.2832 + uTime * rot;
              ink = 1.0 - smoothstep(0.055, 0.085, r);
              ink = max(ink, ringInk(q, 0.17, 0.055, 9.0, ph));
              ink = max(ink, ringInk(q, 0.30, 0.055, 15.0, -ph * 0.7));
              if (vRank < 7.5) ink = max(ink, ringInk(q, 0.43, 0.055, 21.0, ph * 0.5));
            } else if (vCls > 3.5) {    // bright: dot + one fine dotted ring
              ink = 1.0 - smoothstep(0.10, 0.15, r);
              ink = max(ink, ringInk(q, 0.34, 0.06, 11.0, vSeed * 6.2832));
            } else {                    // stipple dot
              ink = 1.0 - smoothstep(0.34, 0.48, r);
            }
            float a = ink * (vCls < 0.5 && vRank < 0.5 ? 0.72 : 0.95);
            if (a < 0.02) discard;
            gl_FragColor = vec4(vec3(0.96), a);
          }`,
      });
      this.points = new THREE.Points(this.geom, this.starMat);
      this.points.frustumCulled = false;
      this.scene.add(this.points);
    }
    this.applyClasses();
    this.layoutStars();
  }

  /** Re-derive each star's discrete ink class (plot.ts seam) at the current plate depth. */
  private applyClasses(): void {
    if (!this.geom) return;
    const N = this.rawStars.length;
    const cls = new Float32Array(N), rank = new Float32Array(N), seed = new Float32Array(N);
    const ranks = ringedRanks(this.rawStars.map((s) => s.mag));
    for (let i = 0; i < N; i++) {
      cls[i] = magClass(this.rawStars[i]!.mag, this.exposure);
      rank[i] = ranks.get(i) ?? 0;
      seed[i] = (Math.sin(i * 127.1) * 43758.5453) % 1;
    }
    this.geom.setAttribute("cls", new THREE.BufferAttribute(cls, 1));
    this.geom.setAttribute("rank", new THREE.BufferAttribute(rank, 1));
    this.geom.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
  }

  /** The host star's position + glare radius. Photographic glow is gone (Phase 6R): glare is
   *  now CHART NOTATION — a faint gold dotted circle of the glare radius around the host. */
  private glareRadiusDeg = 14;
  setSun(dirIcrs: Vec3 | null, radiusDeg: number): void {
    this.rawSunDir = dirIcrs;
    this.glareRadiusDeg = radiusDeg;
    this.layoutSun();
    this.layoutGround();
  }

  private layoutSun(): void {
    this.sunGroup.clear();
    if (!this.rawSunDir) return;
    // the glare radius as a small-circle of directions around the host, projected per-mode
    const s = this.rawSunDir;
    const up: Vec3 = Math.abs(s[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const e1: Vec3 = [s[1] * up[2] - s[2] * up[1], s[2] * up[0] - s[0] * up[2], s[0] * up[1] - s[1] * up[0]];
    const n1 = Math.hypot(...e1) || 1; e1[0] /= n1; e1[1] /= n1; e1[2] /= n1;
    const e2: Vec3 = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const rad = (this.glareRadiusDeg * Math.PI) / 180, cr = Math.cos(rad), sr = Math.sin(rad);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const d: Vec3 = [
        cr * s[0] + sr * (Math.cos(a) * e1[0] + Math.sin(a) * e2[0]),
        cr * s[1] + sr * (Math.cos(a) * e1[1] + Math.sin(a) * e2[1]),
        cr * s[2] + sr * (Math.cos(a) * e1[2] + Math.sin(a) * e2[2]),
      ];
      const p = this.projectScene(d);
      if (!p) { if (pts.length >= 2) this.flushGlare(pts); pts.length = 0; continue; }
      pts.push(new THREE.Vector3(p[0], p[1], p[2]));
    }
    if (pts.length >= 2) this.flushGlare(pts);
  }

  private flushGlare(pts: THREE.Vector3[]): void {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([...pts]),
      new THREE.LineDashedMaterial({ color: INK_HEX.gold, transparent: true, opacity: 0.3, dashSize: 0.7, gapSize: 1.4 }));
    line.computeLineDistances();
    this.sunGroup.add(line);
  }

  /** Dome ground: black beyond the horizon and a hard horizon line (chart chrome). The
   *  photographic twilight glow is removed (Phase 6R: atmosphere-lite is out). */
  private layoutGround(): void {
    this.groundGroup.clear();
    if (this.mode !== "dome") { this.groundGroup.visible = false; return; }
    this.groundGroup.visible = true;
    // mask the below-horizon corners in pure ground-black
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(R * 1.002, R * 2.8, 120),
      new THREE.MeshBasicMaterial({ color: 0x000000, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.set(0, 0, -0.5); ring.renderOrder = -1;
    this.groundGroup.add(ring);
    // the hard horizon line
    const hz = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, i) => {
        const a = (i / 128) * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0);
      })),
      new THREE.LineBasicMaterial({ color: 0xf0ece1, transparent: true, opacity: 0.6 }));
    hz.renderOrder = 0;
    this.groundGroup.add(hz);
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
    const perRad = this.mode === "gnomonic" ? R : this.mode === "fisheye" ? R / this.fisheyeMax : R / (Math.PI / 2);
    for (const b of this.rawBodies) {
      const p = this.projectScene(b.dir);
      if (!p) continue;
      const theta = (b.diamDeg * Math.PI) / 180; // true angular diameter, radians
      if (b.kind === "host_star") {
        // the largest concentric-ring glyph, unmistakable, GOLD
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.hostTex, transparent: true, depthWrite: false }));
        sp.position.set(p[0], p[1], p[2]);
        sp.scale.setScalar(Math.max(26, Math.min(60, theta * perRad * 3)));
        this.bodyGroup.add(sp);
      } else if (b.kind === "moon") {
        // dotted-circle glyph sized by angular-size CLASS, phase drawn diagrammatically (BLUSH)
        const sizeClass = b.diamDeg > 0.4 ? 24 : b.diamDeg > 0.15 ? 19 : b.diamDeg > 0.05 ? 14.5 : 11;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.phaseTexture(Math.round((b.illum ?? 1) * 20)), transparent: true, depthWrite: false }));
        sprite.position.set(p[0], p[1], p[2]);
        sprite.scale.setScalar(sizeClass);
        this.bodyGroup.add(sprite);
        this.moonPhases.push({ sprite, dir: b.dir, sunDir: hostDir });
      } else {
        // sibling planet: dim gold diamond marker
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.sibTex, transparent: true, depthWrite: false }));
        sp.position.set(p[0], p[1], p[2]);
        sp.scale.setScalar(7.5);
        this.bodyGroup.add(sp);
      }
      const lab = makeTextSprite(b.name.toUpperCase(), b.kind === "host_star" ? INK.gold : b.kind === "moon" ? INK.blush : "#a99a66");
      lab.position.set(p[0], p[1], p[2]);
      this.bodyGroup.add(lab);
    }
  }

  /** Diagrammatic moon-phase glyph (BLUSH plate): a dotted circle with the illuminated
   *  fraction as a filled lune anchored lit-side +x — chart notation, not a lit 3D ball.
   *  Cached per 5% bucket; the sprite is rotated so the lit side faces the host. */
  private phaseTexture(bucket: number): THREE.Texture {
    const cached = this.phaseTexCache.get(bucket);
    if (cached) return cached;
    const frac = Math.max(0, Math.min(1, bucket / 20));
    const S = 96, c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    const cx = S / 2, cy = S / 2, rad = S / 2 - 8;
    dottedCircle(g, cx, cy, rad, 18, 2.1, INK.blush);
    if (frac > 0.02) {
      g.fillStyle = INK.blush; g.globalAlpha = 0.62;
      g.beginPath();
      g.arc(cx, cy, rad - 5, -Math.PI / 2, Math.PI / 2, false);   // sun-facing (+x) limb
      const rx = (rad - 5) * (1 - 2 * frac);                      // terminator ellipse (signed)
      g.ellipse(cx, cy, Math.abs(rx), rad - 5, 0, Math.PI / 2, -Math.PI / 2, rx > 0);
      g.fill();
      g.globalAlpha = 1;
    }
    const tex = new THREE.CanvasTexture(c);
    this.phaseTexCache.set(bucket, tex);
    return tex;
  }

  /** Crawling orbital tracks (Phase 6R): each body's path over ONE of its own periods,
   *  sampled evenly in time, drawn as MARCHING DOTS whose crawl speed is the body's TRUE
   *  angular rate (the reference's marching-dots language driven by real dynamics). */
  setPaths(paths: { pts: Vec3[]; color: number; periodYears: number }[]): void {
    this.rawPaths = paths;
    this.pathGroup.clear();
    this.crawls = [];
    const M = 48; // marching dots per path
    for (const path of paths) {
      const buf = new Float32Array(M * 3);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(buf, 3));
      const points = new THREE.Points(geom, new THREE.PointsMaterial({
        color: path.color, size: 2.6 * this.dpr, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false }));
      points.frustumCulled = false;
      this.pathGroup.add(points);
      this.crawls.push({ proj: [], period: Math.max(path.periodYears, 1e-9), points, buf });
    }
    this.layoutPaths();
  }

  /** Reproject each path's polyline for the active projection (crawl positions are then
   *  interpolated from it every frame in loop()). */
  private layoutPaths(): void {
    for (let k = 0; k < this.crawls.length; k++) {
      this.crawls[k]!.proj = this.rawPaths[k]!.pts.map((d) => this.projectScene(d));
    }
  }

  /** The sim time that drives the crawl phase (the body's true angular rate). */
  setPlotTime(tYears: number): void { this.plotTimeYears = tYears; }

  private marchCrawls(): void {
    const M = 48;
    for (const c of this.crawls) {
      const N = c.proj.length - 1;
      if (N < 1) continue;
      const frac = ((this.plotTimeYears / c.period) % 1 + 1) % 1;
      const pos = c.buf;
      for (let k = 0; k < M; k++) {
        const u = (k / M + frac) % 1;
        const x = u * N, i0 = Math.floor(x), t = x - i0;
        const a = c.proj[i0], b = c.proj[Math.min(i0 + 1, N)];
        if (!a || !b) { pos[k * 3] = 1e6; pos[k * 3 + 1] = 0; pos[k * 3 + 2] = 0; continue; }
        pos[k * 3] = a[0] + (b[0] - a[0]) * t;
        pos[k * 3 + 1] = a[1] + (b[1] - a[1]) * t;
        pos[k * 3 + 2] = a[2] + (b[2] - a[2]) * t;
      }
      (c.points.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
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

  /** Plate depth (stops): shifts the class thresholds — a deeper plate promotes stars a
   *  class up. Re-classes on the CPU (rare: slider moves only). */
  setExposure(stops: number): void {
    this.exposure = stops;
    this.applyClasses();
  }
  getExposure(): number { return this.exposure; }

  /** Milky Way as a stipple density field: every dot the same small white ink; the structure
   *  is carried entirely by dot density (milkyWayStipple). Projected like stars, so it works
   *  in every projection and moves with the vantage. Empty array hides it. */
  setMilkyWayPoints(pts: { dir: Vec3 }[]): void {
    this.rawMw = pts;
    if (!this.mwPoints) {
      this.mwGeom = new THREE.BufferGeometry();
      const mat = new THREE.PointsMaterial({
        color: 0xffffff, size: 1.6 * this.dpr, sizeAttenuation: false,
        transparent: true, opacity: 0.4, depthWrite: false,
      });
      this.mwPoints = new THREE.Points(this.mwGeom, mat);
      this.mwPoints.frustumCulled = false;
      this.mwPoints.renderOrder = -2;
      this.scene.add(this.mwPoints);
    }
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

  /** Selection rings SELF-DRAW: 16 red dots assemble around the star over ~0.45s (nothing
   *  pops), then breathe at low amplitude. Births survive relayout (pan/time) so the draw-in
   *  only replays when the selection itself changes. */
  private selBirths: number[] = [];
  setSelection(dirs: Vec3[]): void {
    const changed = dirs.length !== this.rawSel.length;
    this.rawSel = dirs;
    if (changed) this.selBirths = dirs.map(() => performance.now());
    this.selGroup.clear();
    const base = this.mode === "gnomonic" ? 3.4 : 2.9;
    dirs.forEach((d, i) => {
      const p = this.projectScene(d);
      if (!p) return;
      const NPTS = 16;
      const arr = new Float32Array(NPTS * 3);
      for (let k = 0; k < NPTS; k++) {
        const a = (k / NPTS) * Math.PI * 2;
        arr[k * 3] = Math.cos(a) * base; arr[k * 3 + 1] = Math.sin(a) * base; arr[k * 3 + 2] = 0;
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      const pts = new THREE.Points(geom, new THREE.PointsMaterial({
        color: INK_HEX.signal, size: 2.6 * this.dpr, sizeAttenuation: false, transparent: true, opacity: 0.95, depthWrite: false }));
      pts.position.set(p[0], p[1], p[2]);
      pts.userData.birth = this.selBirths[i] ?? performance.now();
      pts.frustumCulled = false;
      this.selGroup.add(pts);
    });
  }

  private projArc(arc: Vec3[]): THREE.Vector3[] | null {
    const out: THREE.Vector3[] = [];
    for (const d of arc) { const p = this.projectScene(d); if (!p) return null; out.push(new THREE.Vector3(p[0], p[1], p[2])); }
    return out;
  }

  /** Measurement overlays: dotted white ink (a geodesic arc per polyline). */
  setOverlays(arcs: Vec3[][]): void {
    this.rawOverlays = arcs;
    this.overlayGroup.clear();
    for (const arc of arcs) {
      const pts = this.projArc(arc);
      if (pts) this.overlayGroup.add(dottedLine(pts, 0.8));
    }
  }

  /** User constellations / figures: dotted white ink, slightly quieter than measurements. */
  setFigures(arcs: Vec3[][]): void {
    this.rawFigures = arcs;
    this.figureGroup.clear();
    for (const arc of arcs) {
      const pts = this.projArc(arc);
      if (pts) this.figureGroup.add(dottedLine(pts, 0.6));
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
    if (this.starMat) this.starMat.uniforms.uTime!.value = performance.now() / 1000; // ring rotation
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
    // selection rings: self-draw dot-by-dot, then breathe at low amplitude
    if (this.selGroup.children.length) {
      const now = performance.now();
      const k = 1 + 0.08 * Math.sin(now * 0.004);
      for (const c of this.selGroup.children) {
        const born = (c.userData.birth as number) ?? now;
        const reveal = Math.min(1, (now - born) / 450);
        ((c as THREE.Points).geometry as THREE.BufferGeometry).setDrawRange(0, Math.max(1, Math.floor(16 * reveal)));
        c.scale.setScalar(k);
      }
    }
    // orbital tracks: marching dots at each body's true angular rate
    this.marchCrawls();
    this.renderer.render(this.scene, cam);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

/** A dotted-ink polyline (the chart's line language). */
function dottedLine(pts: THREE.Vector3[], opacity: number): THREE.Line {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity, dashSize: 0.55, gapSize: 1.0 }));
  line.computeLineDistances();
  return line;
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
