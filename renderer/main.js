// Throwaway inertial-sphere renderer (spec 0d): stand inside the relocated sky and look
// around. NOT a deliverable -- it exists only to eyeball whether the field reads as a real
// sky. It consumes renderer/data/inertial_sky.json from tools/emit_sky.ts (each star's ICRS
// position + velocity at J2000) and propagates rectilinearly in-browser so you can scrub
// proper motion. Stars are drawn as FIXED screen-pixel points with brightness from
// magnitude (a star is a point source -- size must not scale with zoom). Generate data:
//   npm run emit-sky                                              (our own sky)
//   node --import tsx tools/emit_sky.ts --alpha-cen --catalog catalog/local_volume_300pc.json
import * as THREE from "three";

const R = 100;                     // sphere radius (all stars live on it; only direction matters)
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const $ = (id) => document.getElementById(id);

function tint(bp_rp) {
  const t = Math.max(0, Math.min(1, ((bp_rp ?? 0.6) + 0.4) / 2.2));
  return [0.62 + 0.38 * t, 0.72 + 0.12 * Math.sin(t * Math.PI), 1.0 - 0.45 * t];
}
// magnitude -> luminance in [0.05, 1] (brighter star = brighter pixel, not bigger).
const lumOf = (mag) => Math.max(0.05, Math.min(1, Math.pow((7.5 - mag) / 9.0, 1.6)));
// fixed screen-pixel size; only the few brightest get a small bloom.
const sizeOf = (mag) => 1.7 + Math.max(0, 2.2 - mag) * 1.15;

async function main() {
  let data;
  try {
    const res = await fetch("./data/inertial_sky.json", { cache: "no-store" });
    if (!res.ok) throw new Error(res.status + " " + res.statusText);
    data = await res.json();
  } catch (e) {
    $("err").style.display = "grid";
    $("err").innerHTML = "No sky data (renderer/data/inertial_sky.json).<br/>Run " +
      "<code>npm run emit-sky</code> then serve this folder over http.<br/><br/>" + e.message;
    return;
  }

  const stars = data.stars;
  const N = stars.length;
  // unpack to flat typed arrays for fast per-frame propagation.
  const d0 = new Float64Array(N * 3), vel = new Float64Array(N * 3);
  const magRef = new Float64Array(N), dRef = new Float64Array(N);
  const baseTint = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const s = stars[i];
    d0[i*3]=s.d0[0]; d0[i*3+1]=s.d0[1]; d0[i*3+2]=s.d0[2];
    vel[i*3]=s.v[0]; vel[i*3+1]=s.v[1]; vel[i*3+2]=s.v[2];
    magRef[i]=s.mag_ref; dRef[i]=s.d_ref_pc;
    const c = tint(s.bp_rp); baseTint[i*3]=c[0]; baseTint[i*3+1]=c[1]; baseTint[i*3+2]=c[2];
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  let fov = 70;
  const camera = new THREE.PerspectiveCamera(fov, innerWidth/innerHeight, 0.1, 1000);

  const positions = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const sizes = new Float32Array(N);
  const curMag = new Float32Array(N);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geom.setAttribute("psize", new THREE.BufferAttribute(sizes, 1));

  // Fixed pixel size: gl_PointSize is in device pixels and does NOT divide by depth, so a
  // star stays the same crisp size whatever the zoom; magnitude lives in the color.
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uDpr: { value: Math.min(devicePixelRatio, 2) } },
    vertexShader: `attribute float psize; varying vec3 vC; uniform float uDpr;
      void main(){ vC = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = psize * uDpr; }`,
    fragmentShader: `varying vec3 vC;
      void main(){ vec2 d = gl_PointCoord - vec2(0.5); float r = length(d);
        if (r > 0.5) discard;
        float core = smoothstep(0.5, 0.06, r);   // tight bright core + faint edge
        gl_FragColor = vec4(vC, core); }`,
  });
  const points = new THREE.Points(geom, mat);
  points.frustumCulled = false;
  scene.add(points);

  // Faint celestial-equator ring for orientation.
  const eq = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 161 }, (_, i) => { const a = (i/160)*Math.PI*2;
      return new THREE.Vector3(Math.cos(a)*R, Math.sin(a)*R, 0); }));
  scene.add(new THREE.LineLoop(eq, new THREE.LineBasicMaterial({ color: 0x14233a })));

  // --- propagate to time t (years since J2000) and refresh buffers ---
  function setTime(tYears) {
    for (let i = 0; i < N; i++) {
      const dx = d0[i*3] + vel[i*3]*tYears;
      const dy = d0[i*3+1] + vel[i*3+1]*tYears;
      const dz = d0[i*3+2] + vel[i*3+2]*tYears;
      const dist = Math.hypot(dx, dy, dz) || 1e-9;
      positions[i*3]   = dx/dist*R;
      positions[i*3+1] = dy/dist*R;
      positions[i*3+2] = dz/dist*R;
      const mag = magRef[i] + 5*Math.log10(dist / dRef[i]);
      curMag[i] = mag;
      const lum = lumOf(mag);
      colors[i*3]=baseTint[i*3]*lum; colors[i*3+1]=baseTint[i*3+1]*lum; colors[i*3+2]=baseTint[i*3+2]*lum;
      sizes[i] = sizeOf(mag);
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    geom.attributes.psize.needsUpdate = true;
    const yr = tYears.toLocaleString(undefined, { maximumFractionDigits: 0 });
    $("clock").textContent = `t = ${yr} yr`;
    $("hud").innerHTML = `<b>${data.label}</b><br/>${N} stars · drag to look · scroll = zoom · ` +
      `slider = proper motion (J2000 + t)`;
  }

  // --- look-around (drag) + FOV zoom (wheel). Camera sits at the centre. ---
  let yaw = 0, pitch = 0, dragging = false, px = 0, py = 0;
  const applyLook = () => { pitch = Math.max(-1.45, Math.min(1.45, pitch));
    const cp = Math.cos(pitch); camera.lookAt(Math.cos(yaw)*cp, Math.sin(pitch), Math.sin(yaw)*cp); };
  renderer.domElement.addEventListener("pointerdown", (e)=>{dragging=true;px=e.clientX;py=e.clientY;});
  addEventListener("pointerup", ()=>dragging=false);
  addEventListener("pointermove", (e)=>{ if(!dragging) return;
    yaw -= (e.clientX-px)*0.0026; pitch += (e.clientY-py)*0.0026; px=e.clientX; py=e.clientY; applyLook(); });
  renderer.domElement.addEventListener("wheel", (e)=>{ fov=Math.max(2.5, Math.min(100, fov+Math.sign(e.deltaY)*3));
    camera.fov=fov; camera.updateProjectionMatrix(); }, { passive: true });
  applyLook();
  addEventListener("resize", ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); });

  // --- hover readout ---
  const ray = new THREE.Raycaster(); ray.params.Points.threshold = 1.6;
  const mouse = new THREE.Vector2(2, 2);
  addEventListener("pointermove", (e)=>{ mouse.x=(e.clientX/innerWidth)*2-1; mouse.y=-(e.clientY/innerHeight)*2+1; });

  // --- time controls ---
  const slider = $("time"), scaleSel = $("scale");
  const tOf = () => (Number(slider.value)/1000) * Number(scaleSel.value);
  slider.addEventListener("input", ()=> setTime(tOf()));
  scaleSel.addEventListener("change", ()=> setTime(tOf()));
  $("reset").addEventListener("click", ()=>{ slider.value=0; setTime(0); });
  let playing=false, last=0;
  $("play").addEventListener("click", ()=>{ playing=!playing; $("play").textContent=playing?"❚❚ pause":"▶ play"; });
  setTime(0);

  function frame(now) {
    if (playing) { if (last) { let v=Number(slider.value)+(now-last)*0.04; if(v>1000)v=0; slider.value=v; setTime(tOf()); } last=now; }
    else last = 0;
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObject(points, false)[0];
    if (hit) { const s = stars[hit.index]; const i = hit.index;
      const dir = [positions[i*3], positions[i*3+1], positions[i*3+2]];
      const ra = ((Math.atan2(dir[1], dir[0])*R2D)+360)%360, dec = Math.asin(dir[2]/R)*R2D;
      const dist = Math.hypot(d0[i*3]+vel[i*3]*tOf(), d0[i*3+1]+vel[i*3+1]*tOf(), d0[i*3+2]+vel[i*3+2]*tOf());
      $("pick").textContent = `${s.name || s.id}  ·  RA ${ra.toFixed(1)}°  Dec ${dec.toFixed(1)}°  ·  ` +
        `V ${curMag[i].toFixed(2)}  ·  ${dist.toFixed(1)} pc`;
    } else $("pick").textContent = "";
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
