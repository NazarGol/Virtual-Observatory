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
}

const R = 100;
const R2D = 180 / Math.PI;
const tint = (bp: number): [number, number, number] => {
  const t = Math.max(0, Math.min(1, ((bp ?? 0.6) + 0.4) / 2.2));
  return [0.62 + 0.38 * t, 0.72 + 0.12 * Math.sin(t * Math.PI), 1.0 - 0.45 * t];
};
const lumOf = (m: number) => Math.max(0.06, Math.min(1, Math.pow((7.5 - m) / 9.0, 1.6)));
const sizeOf = (m: number) => 1.8 + Math.max(0, 2.2 - m) * 1.2;

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
  private selGroup = new THREE.Group();
  private overlayGroup = new THREE.Group();
  private figureGroup = new THREE.Group();
  private labelGroup = new THREE.Group();
  private ringTex = ringTexture();

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

  constructor(container: HTMLElement) {
    this.container = container;
    this.dpr = Math.min(devicePixelRatio, 2);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(this.fov, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.scene.add(this.selGroup, this.overlayGroup, this.figureGroup, this.labelGroup);

    // faint celestial-equator ring for orientation
    const eq = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 161 }, (_, i) => {
        const a = (i / 160) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, 0);
      }),
    );
    this.scene.add(new THREE.LineLoop(eq, new THREE.LineBasicMaterial({ color: 0x12233a })));

    this.applyLook();
    this.bind();
    this.loop();
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
      this.applyLook();
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
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    this.onView?.(this.fov);
  }
  getFov(): number { return this.fov; }

  setStars(stars: StarPoint[]): void {
    const N = stars.length;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), sz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const s = stars[i];
      pos[i * 3] = s.dir[0] * R; pos[i * 3 + 1] = s.dir[1] * R; pos[i * 3 + 2] = s.dir[2] * R;
      const c = tint(s.bp_rp), l = lumOf(s.mag);
      col[i * 3] = c[0] * l; col[i * 3 + 1] = c[1] * l; col[i * 3 + 2] = c[2] * l;
      sz[i] = sizeOf(s.mag);
    }
    if (!this.geom) {
      this.geom = new THREE.BufferGeometry();
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
        uniforms: { uDpr: { value: this.dpr } },
        vertexShader: `attribute float psize; varying vec3 vC; uniform float uDpr; void main(){ vC=color;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize=psize*uDpr; }`,
        fragmentShader: `varying vec3 vC; void main(){ vec2 d=gl_PointCoord-vec2(0.5);
          float r=length(d); if(r>0.5) discard; gl_FragColor=vec4(vC, smoothstep(0.5,0.06,r)); }`,
      });
      this.points = new THREE.Points(this.geom, mat);
      this.points.frustumCulled = false;
      this.scene.add(this.points);
    }
    this.geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.geom.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.geom.setAttribute("psize", new THREE.BufferAttribute(sz, 1));
    this.geom.attributes.position.needsUpdate = true;
  }

  setSelection(dirs: Vec3[]): void {
    this.selGroup.clear();
    for (const d of dirs) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ringTex, transparent: true, depthWrite: false }));
      sp.position.set(d[0] * R, d[1] * R, d[2] * R);
      sp.scale.setScalar(6);
      this.selGroup.add(sp);
    }
  }

  /** Each overlay is a polyline of inertial unit directions (a geodesic arc). */
  setOverlays(arcs: Vec3[][]): void {
    this.overlayGroup.clear();
    for (const arc of arcs) {
      const g = new THREE.BufferGeometry().setFromPoints(arc.map((d) => new THREE.Vector3(d[0] * R, d[1] * R, d[2] * R)));
      this.overlayGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x8fe3ff })));
    }
  }

  /** Annotation figure edges (constellations / sketches), drawn warm to distinguish them. */
  setFigures(arcs: Vec3[][]): void {
    this.figureGroup.clear();
    for (const arc of arcs) {
      const g = new THREE.BufferGeometry().setFromPoints(arc.map((d) => new THREE.Vector3(d[0] * R, d[1] * R, d[2] * R)));
      this.figureGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffcf6b })));
    }
  }

  /** Text labels pinned to inertial directions (anchored to objects by the React layer). */
  setLabels(labels: { dir: Vec3; text: string }[]): void {
    this.labelGroup.clear();
    for (const l of labels) this.labelGroup.add(makeTextSprite(l.text, l.dir));
  }

  resize(): void {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (this.points) {
      // tighter pick threshold when zoomed in (telescopic)
      this.ray.params.Points!.threshold = (this.fov / 60) * 1.4;
      this.ray.setFromCamera(this.mouse, this.camera);
      const hit = this.ray.intersectObject(this.points, false)[0];
      const idx = hit ? hit.index ?? null : null;
      if (idx !== this.hoverIndex) { this.hoverIndex = idx; this.onHover?.(idx); }
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

const R_LABEL = 100;
function makeTextSprite(text: string, dir: Vec3, color = "#ffe1a3"): THREE.Sprite {
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
  sp.position.set(dir[0] * R_LABEL, dir[1] * R_LABEL, dir[2] * R_LABEL);
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
