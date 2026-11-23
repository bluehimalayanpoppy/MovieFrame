import { useEffect, useRef } from "react";
import * as THREE from "three";

// Film stills that float alongside the path (files in frontend/public/backgrounds/)
const STILLS = [
  "/backgrounds/1.jpg",
  "/backgrounds/2.jpg",
  "/backgrounds/3.jpg",
  "/backgrounds/4.jpg",
  "/backgrounds/5.jpg",
];

const TILE = 120; // length of one hill tile; two tiles leapfrog to make the hills endless
const SPEED = 4; // how fast the hills roll toward the camera
const SKY = 0xdfe8e0; // fog color, matches the horizon so hills fade into the sky
const FEATHER = 0.22; // how far the still edges dissolve inward (0 to 0.5, bigger is softer)
const LOOK_X = 18; // how far the arrow keys swing the view left and right
const LOOK_Y = 7; // how far the arrow keys swing the view up and down

// Height of the ground at (x, z). Every wave in z repeats exactly once per tile,
// so the end of one tile lines up perfectly with the start of the next.
function groundHeight(x, z) {
  const k = (2 * Math.PI) / TILE;
  let h =
    1.4 * Math.sin(2 * k * z + x * 0.11) +
    0.8 * Math.sin(5 * k * z - x * 0.19) +
    0.45 * Math.sin(9 * k * z + x * 0.33);
  const side = Math.abs(x);
  if (side > 5) h += Math.min(((side - 5) / 10) ** 2 * 3, 14); // valley sides rise into hills
  return h;
}

// Three hard brightness bands: the cel-shaded look
function toonGradient() {
  const tex = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// Borderless still: the image alpha fades to zero toward every edge,
// so it dissolves into the scene instead of sitting in a frame.
function stillMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      opacity: { value: 0 }, // driven per frame by distance
      ready: { value: 0 }, // flips to 1 once the image has loaded
      feather: { value: FEATHER },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float opacity;
      uniform float ready;
      uniform float feather;
      varying vec2 vUv;
      void main() {
        vec2 d = min(vUv, 1.0 - vUv); // distance to the nearest edge on each axis
        float edge = smoothstep(0.0, feather, d.x) * smoothstep(0.0, feather, d.y);
        vec4 c = texture2D(map, vUv);
        gl_FragColor = vec4(c.rgb, edge * opacity * ready);
        #include <colorspace_fragment>
      }
    `,
  });
}

// Stills fade in far away and fade out as they pass the camera
function fadeFor(z) {
  const fadeIn = THREE.MathUtils.smoothstep(z, -95, -50);
  const fadeOut = 1 - THREE.MathUtils.smoothstep(z, -4, 5);
  return fadeIn * fadeOut;
}

export default function Scene() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(SKY, 20, 110);

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 300);
    camera.position.set(0, 6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const gradientMap = toonGradient();

    // Lighting: warm sun plus soft sky light
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(-20, 30, -10);
    scene.add(sun, new THREE.HemisphereLight(0xcfe6f5, 0x6f8f4e, 0.9));

    // Shared geometry and materials, reused by every tile, tree and cloud
    const groundGeo = new THREE.PlaneGeometry(TILE, TILE, 120, 120);
    groundGeo.rotateX(-Math.PI / 2);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshToonMaterial({ color: 0x8dbf6a, gradientMap });
    const canopyGeo = new THREE.ConeGeometry(1.3, 3.6, 8);
    const canopyMat = new THREE.MeshToonMaterial({ color: 0x3f7a4a, gradientMap });
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 1.2, 6);
    const trunkMat = new THREE.MeshToonMaterial({ color: 0x6b4a32, gradientMap });
    const puffGeo = new THREE.SphereGeometry(1, 16, 12);
    const cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap });

    // Two hill tiles, each with its own scattered trees
    const tiles = [0, 1].map((n) => {
      const tile = new THREE.Group();
      tile.add(new THREE.Mesh(groundGeo, groundMat));

      for (let t = 0; t < 40; t++) {
        const x = (Math.random() < 0.5 ? -1 : 1) * THREE.MathUtils.randFloat(9, 40);
        const z = THREE.MathUtils.randFloatSpread(TILE);
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 0.6;
        const canopy = new THREE.Mesh(canopyGeo, canopyMat);
        canopy.position.y = 2.8;
        tree.add(trunk, canopy);
        tree.position.set(x, groundHeight(x, z) - 0.2, z);
        tree.scale.setScalar(THREE.MathUtils.randFloat(0.7, 1.3));
        tile.add(tree);
      }

      tile.position.z = -n * TILE;
      scene.add(tile);
      return tile;
    });

    // Puffy clouds drifting overhead
    const clouds = [];
    for (let c = 0; c < 7; c++) {
      const cloud = new THREE.Group();
      for (let p = 0; p < 4; p++) {
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(p * 1.6 - 2.4, Math.random() * 0.8, Math.random() * 1.2);
        puff.scale.setScalar(THREE.MathUtils.randFloat(1.2, 2.2));
        cloud.add(puff);
      }
      cloud.position.set(
        THREE.MathUtils.randFloatSpread(90),
        THREE.MathUtils.randFloat(22, 32),
        THREE.MathUtils.randFloat(-150, -30)
      );
      scene.add(cloud);
      clouds.push(cloud);
    }

    // Film stills floating along both sides of the path, no frame, soft edges
    const loader = new THREE.TextureLoader();
    const photoGeo = new THREE.PlaneGeometry(6.7, 3.76);
    const photoMats = [];
    const stills = STILLS.map((src, i) => {
      const photoMat = stillMaterial(null);
      const texture = loader.load(src, () => {
        photoMat.uniforms.ready.value = 1;
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      photoMat.uniforms.map.value = texture;
      photoMats.push(photoMat);

      const still = new THREE.Mesh(photoGeo, photoMat);
      const side = i % 2 ? 1 : -1;
      still.position.set(
        side * THREE.MathUtils.randFloat(5.5, 7),
        THREE.MathUtils.randFloat(5.5, 6.8),
        -12 - i * 20
      );
      still.rotation.y = -side * 0.35; // angle toward the middle of the path
      still.userData.baseY = still.position.y;
      still.userData.phase = Math.random() * Math.PI * 2;
      photoMat.uniforms.opacity.value = fadeFor(still.position.z);
      scene.add(still);
      return still;
    });

    function layout() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", layout);

    // Gentle camera sway toward the pointer
    const pointer = { x: 0, y: 0 };
    function onPointerMove(e) {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener("pointermove", onPointerMove);

    // Arrow keys swing the view while held, then ease back to center on release
    const keys = {};
    function onKeyDown(e) {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.startsWith("Arrow")) {
        keys[e.key] = true;
        e.preventDefault(); // stops the page from scrolling
      }
    }
    function onKeyUp(e) {
      delete keys[e.key];
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const look = { x: 0, y: 0 }; // current swing, eased toward the held keys
    const aim = new THREE.Vector3(0, 3.5, -40);
    const clock = new THREE.Clock();
    let frameId;

    function animate() {
      const dt = Math.min(clock.getDelta(), 0.05); // cap so a background tab doesn't jump
      const t = clock.elapsedTime;

      // Roll the hills toward the camera; a tile that passes behind jumps to the front
      for (const tile of tiles) {
        tile.position.z += SPEED * dt;
        if (tile.position.z - TILE / 2 > 10) tile.position.z -= TILE * 2;
      }

      for (const cloud of clouds) {
        cloud.position.z += SPEED * 0.25 * dt;
        if (cloud.position.z > 20) cloud.position.z = -150;
      }

      // Stills drift past slightly faster than the ground, bob gently and fade by distance
      for (const still of stills) {
        still.position.z += SPEED * 1.15 * dt;
        still.position.y = still.userData.baseY + Math.sin(t * 0.8 + still.userData.phase) * 0.25;
        if (still.position.z > 6) still.position.z -= 100;
        still.material.uniforms.opacity.value = fadeFor(still.position.z);
      }

      // Arrow keys set where the view wants to point, the swing eases toward it
      const wantX = ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * LOOK_X;
      const wantY = ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * LOOK_Y;