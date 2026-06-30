// Throwaway horizon (alt/az dome) renderer for Phase 1: the relocated sky rising and
// setting over a local horizon, with continuous time scrubbing. It consumes the INERTIAL
// sky from tools/emit_horizontal.ts and applies Stage 2 (the planet's rotation) itself as
// the slider moves -- the cheap path, never re-running Stage 1. The Stage-2 math below is a
// deliberate small MIRROR of packages/engine/src/horizontal.ts (the engine stays
// render-free); it is validated there, not here. Generate data first:
//   npm run emit-horizon            (curated sky)
//   node --import tsx tools/emit_horizontal.ts --catalog catalog/local_volume_300pc.json
import * as THREE from "three";

const D2R = Math.PI / 180;
const SECONDS_PER_JULIAN_YEAR = 31_557_600;
const R = 100;
const $ = (id) => document.getElementById(id);

// --- tiny vec helpers (renderer-local) ---
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const n = norm(a); return [a[0]/n, a[1]/n, a[2]/n]; };
const raDecToVec = (ra, dec) => {
  const cd = Math.cos(dec*D2R);
  return [cd*Math.cos(ra*D2R), cd*Math.sin(ra*D2R), Math.sin(dec*D2R)];
};

function tint(bp_rp) {
  const t = Math.max(0, Math.min(1, (bp_rp + 0.4) / 2.2));
  return [0.6 + 0.4*t, 0.7 + 0.1*Math.sin(t*Math.PI), 1.0 - 0.5*t];
}

// Mirror of horizontal.ts: build the fixed equatorial basis + observer trig, return a
// projector dir_icrs -> {east, north, up}.
function makeProjector(orientation, observer, tYears) {
  const z = raDecToVec(orientation.northPoleRaDeg, orientation.northPoleDecDeg);
  const node = cross([0,0,1], z);
  const ex = norm(node) < 1e-9 ? [1,0,0] : unit(node);
  const ey = cross(z, ex);
  const ez = z;
  const periodYears = orientation.rotationPeriodSeconds / SECONDS_PER_JULIAN_YEAR;
  const ang = (2*Math.PI*tYears)/periodYears + observer.lonDeg*D2R;
  const c = Math.cos(ang), s = Math.sin(ang);
  const phi = observer.latDeg*D2R, cphi = Math.cos(phi), sphi = Math.sin(phi);
  return (d) => {
    const eqx = dot(d, ex), eqy = dot(d, ey), eqz = dot(d, ez);
    const bx = c*eqx + s*eqy, by = -s*eqx + c*eqy, bz = eqz;
    return { east: by, north: -bx*sphi + bz*cphi, up: bx*cphi + bz*sphi };
  };
}
// (east, north, up) -> three.js position (y up, looking -z = North), on the dome of radius R.
const domePos = (e, n, u) => [e*R, u*R, -n*R];

function textSprite(text, color) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = color; g.font = "bold 44px ui-monospace, monospace";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 64, 32);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  sp.scale.set(10, 5, 1);
  return sp;
}

async function main() {
  let data;
  try {
    const res = await fetch("./data/horizontal_sky.json", { cache: "no-store" });
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    data = await res.json();
  } catch (e) {
    $("err").style.display = "grid";
    $("err").innerHTML = "No data (renderer/data/horizontal_sky.json).<br/>Run " +
      "<code>npm run emit-horizon</code> then serve this folder over http.<br/><br/>" + e.message;
    return;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, innerWidth/innerHeight, 0.1, 1000);

  // Stars: positions updated each time-step; base colors precomputed.
  const stars = data.inertial;
  const N = stars.length;
  const positions = new Float32Array(N*3);
  const colors = new Float32Array(N*3);
  const sizes = new Float32Array(N);
  // Stars are point sources: fixed screen-pixel size, brightness from magnitude (mag is
  // fixed here -- Stage 2 rotation doesn't change distance -- so luminance is precomputed).
  const lumOf = (mag) => Math.max(0.05, Math.min(1, Math.pow((7.5 - mag) / 9.0, 1.6)));
  const sizeOf = (mag) => 1.7 + Math.max(0, 2.2 - mag) * 1.15;
  const baseColor = stars.map((s) => { const c = tint(s.bp_rp ?? 0.6), l = lumOf(s.mag);
    return [c[0]*l, c[1]*l, c[2]*l]; });
  stars.forEach((_, i) => { sizes[i] = sizeOf(stars[i].mag); });

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geom.setAttribute("psize", new THREE.BufferAttribute(sizes, 1));
  const dpr = Math.min(devicePixelRatio, 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uDpr: { value: dpr } },
    vertexShader: `attribute float psize; varying vec3 vC; uniform float uDpr; void main(){ vC=color;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize=psize*uDpr; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 d=gl_PointCoord-vec2(0.5);
      float r=length(d); if(r>0.5) discard; gl_FragColor=vec4(vC, smoothstep(0.5,0.06,r)); }`,
  });
  scene.add(new THREE.Points(geom, mat));

  // Bodies (host star, moon) as labelled markers.
  const bodyMarkers = (data.bodies || []).map((b) => {
    const color = b.kind === "host_star" ? "#ffd86b" : "#cfd6e0";
    const sp = textSprite(b.kind === "host_star" ? "☉" : "☽", color);
    scene.add(sp);
    return { b, sp };
  });

  // Horizon ring + cardinal labels + zenith.
  const ring = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 129 }, (_, i) => {
      const a = (i/128)*Math.PI*2;
      return new THREE.Vector3(Math.cos(a)*R, 0, Math.sin(a)*R);
    }));
  scene.add(new THREE.LineLoop(ring, new THREE.LineBasicMaterial({ color: 0x2a4a6a })));
  const card = [["N",0,0,-R,"#ff7a7a"],["E",R,0,0,"#7adcff"],["S",0,0,R,"#9aa4b8"],["W",-R,0,0,"#9aa4b8"]];
  for (const [t,x,y,z,col] of card) { const sp = textSprite(t,col); sp.position.set(x,y,z); scene.add(sp); }
  const zenith = textSprite("zenith", "#5b6b8c"); zenith.position.set(0, R, 0); zenith.scale.set(14,7,1);
  scene.add(zenith);

  // Look-around (drag), default facing North, tilted up.
  let yaw = Math.PI, pitch = 0.35, dragging = false, px = 0, py = 0;
  const applyLook = () => {
    pitch = Math.max(-1.3, Math.min(1.3, pitch));
    camera.lookAt(Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw)*Math.cos(pitch));
  };
  renderer.domElement.addEventListener("pointerdown", (e)=>{dragging=true;px=e.clientX;py=e.clientY;});
  addEventListener("pointerup", ()=>dragging=false);
  addEventListener("pointermove", (e)=>{ if(!dragging) return;
    yaw -= (e.clientX-px)*0.003; pitch += (e.clientY-py)*0.003; px=e.clientX; py=e.clientY; applyLook(); });
  applyLook();
  addEventListener("resize", ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); });

  // --- time scrubbing: slider 0..1440 over one sidereal day ---
  const periodSec = data.orientation.rotationPeriodSeconds;
  const epoch = data.epoch_years_since_j2000;
  let aboveCount = 0;
  function setTime(minutesOfDay) {
    const tSec = (minutesOfDay/1440)*periodSec;
    const tYears = epoch + tSec/SECONDS_PER_JULIAN_YEAR;
    const proj = makeProjector(data.orientation, data.observer, tYears);
    aboveCount = 0;
    for (let i = 0; i < N; i++) {
      const { east, north, up } = proj(stars[i].dir);
      const p = domePos(east, north, up);
      positions[i*3]=p[0]; positions[i*3+1]=p[1]; positions[i*3+2]=p[2];
      const vis = up > 0 ? 1 : 0;             // cull below the horizon (additive: zero contributes nothing)
      if (up > 0) aboveCount++;
      colors[i*3]=baseColor[i][0]*vis; colors[i*3+1]=baseColor[i][1]*vis; colors[i*3+2]=baseColor[i][2]*vis;
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    for (const { b, sp } of bodyMarkers) {
      const { east, north, up } = proj(b.dir);
      const p = domePos(east, north, up);
      sp.position.set(p[0], p[1], p[2]);
      sp.visible = up > -0.02;
    }
    const hh = String(Math.floor(minutesOfDay/60)).padStart(2,"0");
    const mm = String(Math.floor(minutesOfDay%60)).padStart(2,"0");
    $("clock").textContent = `${hh}:${mm} sid`;
    $("hud").innerHTML = `<b>${data.world}</b> &middot; lat ${data.observer.latDeg}° &middot; ` +
      `${data.star_count} stars, ${aboveCount} above horizon<br/>` +
      `inertial epoch ${epoch} yr (J2000) &middot; drag to look &middot; slider = sidereal day`;
  }

  const slider = $("time");
  slider.addEventListener("input", () => setTime(Number(slider.value)));
  let playing = false, last = 0;
  $("play").addEventListener("click", () => {
    playing = !playing; $("play").textContent = playing ? "❚❚ pause" : "▶ play";
  });
  setTime(0);

  function frame(now) {
    if (playing) {
      if (last) { let v = Number(slider.value) + (now-last)*0.06; if (v>1440) v-=1440; slider.value=v; setTime(v); }
      last = now;
    } else last = 0;
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
