// Throwaway renderer (spec 0d): dots on a sphere, look-around only. For eyeballing the
// engine output, NOT a deliverable. It consumes renderer/data/inertial_sky.json produced
// by `npm run emit-sky` and knows nothing about the engine. Generate data first, e.g.:
//   npm run emit-sky                       (Sol vantage)
//   node --import tsx tools/emit_sky.ts --alpha-cen
import * as THREE from "three";

const hud = document.getElementById("hud");
const pickEl = document.getElementById("pick");
const errEl = document.getElementById("err");
const DEG = Math.PI / 180;
const SPHERE_R = 100;

// ICRS (ra, dec) -> unit direction. +x at (0h,0deg), +z at the north celestial pole.
function dir(raDeg, decDeg) {
  const ra = raDeg * DEG, dec = decDeg * DEG, cd = Math.cos(dec);
  return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
}

// BP-RP (or B-V proxy) -> rough RGB tint: blue (hot) through white to orange-red (cool).
function tint(bp_rp) {
  const t = Math.max(0, Math.min(1, (bp_rp + 0.4) / 2.2));
  return [0.6 + 0.4 * t, 0.7 + 0.1 * Math.sin(t * Math.PI), 1.0 - 0.5 * t];
}

async function main() {
  let data;
  try {
    const res = await fetch("./data/inertial_sky.json", { cache: "no-store" });
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    data = await res.json();
  } catch (e) {
    errEl.style.display = "grid";
    errEl.innerHTML =
      "No sky data found (renderer/data/inertial_sky.json).<br/>" +
      "Run <code>npm run emit-sky</code> first, then serve this folder over http.<br/><br/>" +
      "fetch error: " + e.message;
    return;
  }

  const stars = data.stars;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  let fov = 70;
  const camera = new THREE.PerspectiveCamera(fov, innerWidth / innerHeight, 0.1, 1000);

  // Build the point cloud.
  const positions = new Float32Array(stars.length * 3);
  const colors = new Float32Array(stars.length * 3);
  const sizes = new Float32Array(stars.length);
  const magForPick = [];
  stars.forEach((s, i) => {
    const d = dir(s.ra_deg, s.dec_deg);
    positions[i * 3] = d[0] * SPHERE_R;
    positions[i * 3 + 1] = d[1] * SPHERE_R;
    positions[i * 3 + 2] = d[2] * SPHERE_R;
    const c = tint(s.bp_rp ?? 0.6);
    // Brightness from magnitude: brighter (smaller mag) -> larger & whiter.
    const b = Math.max(0.15, Math.min(1, (6 - s.mag) / 8));
    colors[i * 3] = c[0] * (0.5 + 0.5 * b);
    colors[i * 3 + 1] = c[1] * (0.5 + 0.5 * b);
    colors[i * 3 + 2] = c[2] * (0.5 + 0.5 * b);
    sizes[i] = 6 + 26 * b;
    magForPick.push(s);
  });

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geom.setAttribute("psize", new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float psize; varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = psize * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = length(d);
        if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.0, r);
        gl_FragColor = vec4(vColor, a);
      }`,
    vertexColors: true,
  });
  scene.add(new THREE.Points(geom, mat));

  // Faint reference ring at the celestial equator, just for orientation.
  const eq = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 129 }, (_, i) => {
      const a = (i / 128) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * SPHERE_R, Math.sin(a) * SPHERE_R, 0);
    }),
  );
  scene.add(new THREE.LineLoop(eq, new THREE.LineBasicMaterial({ color: 0x18324a })));

  // --- look-around controller (drag to look, wheel to zoom FOV) ---
  let yaw = 0, pitch = 0, dragging = false, px = 0, py = 0;
  function applyLook() {
    pitch = Math.max(-1.4, Math.min(1.4, pitch));
    const cp = Math.cos(pitch);
    camera.lookAt(Math.cos(yaw) * cp, Math.sin(yaw) * cp, Math.sin(pitch));
  }
  renderer.domElement.addEventListener("pointerdown", (e) => {
    dragging = true; px = e.clientX; py = e.clientY;
  });
  addEventListener("pointerup", () => (dragging = false));
  addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yaw -= (e.clientX - px) * 0.0025;
    pitch += (e.clientY - py) * 0.0025;
    px = e.clientX; py = e.clientY;
    applyLook();
  });
  renderer.domElement.addEventListener("wheel", (e) => {
    fov = Math.max(8, Math.min(100, fov + Math.sign(e.deltaY) * 3));
    camera.fov = fov; camera.updateProjectionMatrix();
  }, { passive: true });
  applyLook();

  // --- hover readout (raycast against the point cloud) ---
  const ray = new THREE.Raycaster();
  ray.params.Points.threshold = 2.5;
  const mouse = new THREE.Vector2(2, 2);
  addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  });

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  hud.innerHTML =
    `<b>${data.label}</b><br/>` +
    `${data.star_count} stars · t = ${data.t_years_since_j2000} yr (J2000)<br/>` +
    `observer ${JSON.stringify(data.observer_pos_pc)} pc · FOV wheel-zoom · drag to look`;

  const pts = scene.children.find((o) => o.isPoints);
  function frame() {
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObject(pts, false)[0];
    if (hit) {
      const s = magForPick[hit.index];
      pickEl.textContent =
        `${s.name || s.id}  RA ${s.ra_deg.toFixed(2)}°  Dec ${s.dec_deg.toFixed(2)}°  ` +
        `V ${s.mag.toFixed(2)}  ${s.distance_pc.toFixed(2)} pc`;
    } else pickEl.textContent = "";
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
}

main();
