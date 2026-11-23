import { useEffect, useRef } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// stills in frontend/public/backgrounds/
const STILLS = [
  "/backgrounds/1.jpg",
  "/backgrounds/2.jpg",
  "/backgrounds/3.jpg",
  "/backgrounds/4.jpg",
  "/backgrounds/5.jpg",
];

const TILE = 120; // length of one hill tile
const SPEED = 4; // hill speed toward the camera
const SKY = 0xdfe8e0; // fog color, matches the horizon
const FEATHER = 0.3; // edge fade width, 0 to 0.5
const STILL_W = 24; // still size, big enough to nearly fill the screen
const STILL_H = 13.5;
const STILL_GAP = 16; // depth between stills, small so they overlap
const WRAP = STILLS.length * STILL_GAP; // distance before a still loops to the back
const LOOK_X = 18; // arrow key swing, left and right
const LOOK_Y = 7; // arrow key swing, up and down

// ground height at (x, z), repeats every tile so tiles join seamlessly
function groundHeight(x, z) {
  const k = (2 * Math.PI) / TILE;
  let h =
    1.4 * Math.sin(2 * k * z + x * 0.11) +
    0.8 * Math.sin(5 * k * z - x * 0.19) +
    0.45 * Math.sin(9 * k * z + x * 0.33);
  const side = Math.abs(x);
  if (side > 5) h += Math.min(((side - 5) / 10) ** 2 * 3, 14); // raise the valley sides
  return h;
}

// three hard brightness bands for the cel shaded look
function toonGradient() {
  const tex = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

// tall twisting trunk, the bend point at the top is saved for placing foliage
function makeTrunk(seed) {
  const geo = new THREE.CylinderGeometry(0.16, 0.34, 6, 7, 10, true);
  geo.translate(0, 3, 0); // base sits at y = 0
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / 6;
    p.setX(i, p.getX(i) + Math.sin(t * 3 + seed) * 0.55 * t);
    p.setZ(i, p.getZ(i) + Math.cos(t * 2.4 + seed) * 0.4 * t);
  }
  geo.computeVertexNormals();
  geo.userData.top = new THREE.Vector3(Math.sin(3 + seed) * 0.55, 6, Math.cos(2.4 + seed) * 0.4);
  return geo;
}

// lumpy smooth blob used as a leaf clump
function makeClump(seed) {
  let geo = new THREE.IcosahedronGeometry(1, 2);
  geo.deleteAttribute("normal");
  geo.deleteAttribute("uv");
  geo = mergeVertices(geo); // shared vertices give smooth shading
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const f = 1 + 0.2 * Math.sin(x * 4 + seed) * Math.cos(y * 3 + seed * 1.3) * Math.sin(z * 5 + seed);
    p.setXYZ(i, x * f, y * f, z * f);
  }
  geo.computeVertexNormals();
  return geo;
}

// still material with no frame, alpha fades out toward every edge
function stillMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      opacity: { value: 0 }, // set per frame by distance
      ready: { value: 0 }, // 1 once the image has loaded
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
        vec2 d = min(vUv, 1.0 - vUv); // distance to the nearest edge per axis
        float edge = smoothstep(0.0, feather, d.x) * smoothstep(0.0, feather, d.y);
        vec4 c = texture2D(map, vUv);
        gl_FragColor = vec4(c.rgb, edge * opacity * ready);
        #include <colorspace_fragment>
      }
    `,
  });
}

// fade in from far away, fade out before reaching the camera
function fadeFor(z) {
  const fadeIn = THREE.MathUtils.smoothstep(z, -76, -42);
  const fadeOut = 1 - THREE.MathUtils.smoothstep(z, -10, 0);
  return 0.92 * fadeIn * fadeOut; // under 1 so hills stay faintly visible behind
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

    // warm sun plus soft sky light
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(-20, 30, -10);
    scene.add(sun, new THREE.HemisphereLight(0xcfe6f5, 0x6f8f4e, 0.9));

    // shared geometry and materials
    const groundGeo = new THREE.PlaneGeometry(TILE, TILE, 120, 120);
    groundGeo.rotateX(-Math.PI / 2);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshToonMaterial({ color: 0x8dbf6a, gradientMap });
    const trunkMat = new THREE.MeshToonMaterial({ color: 0x3d2c24, gradientMap, side: THREE.DoubleSide });
    const trunkGeos = [0, 2, 4].map(makeTrunk);
    const clumpGeos = [1, 3, 5].map(makeClump);
    // leaf colors from shaded to sunlit, higher clumps use the lighter ones
    const leafMats = [0x2f6b3f, 0x4a8a45, 0x86bd52].map(
      (color) => new THREE.MeshToonMaterial({ color, gradientMap })
    );
    const puffGeo = new THREE.SphereGeometry(1, 16, 12);
    const cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap });

    // one tree: twisted dark trunk with a layered crown of leaf clumps
    function makeTree() {
      const tree = new THREE.Group();
      const trunkGeo = trunkGeos[Math.floor(Math.random() * trunkGeos.length)];
      tree.add(new THREE.Mesh(trunkGeo, trunkMat));

      const top = trunkGeo.userData.top;
      for (let k = 0; k < 7; k++) {
        const h = 4.4 + Math.random() * 3;
        const shade = Math.min(2, Math.floor(((h - 4.4) / 3) * 3 + Math.random() * 0.6));
        const clump = new THREE.Mesh(clumpGeos[Math.floor(Math.random() * clumpGeos.length)], leafMats[shade]);
        clump.position.set(
          top.x + THREE.MathUtils.randFloatSpread(3),
          h,
          top.z + THREE.MathUtils.randFloatSpread(3)
        );
        clump.scale.setScalar(THREE.MathUtils.randFloat(1.3, 2.3));
        clump.scale.y *= 0.85;
        tree.add(clump);
      }
      return tree;
    }

    // two hill tiles with random trees
    const tiles = [0, 1].map((n) => {
      const tile = new THREE.Group();
      tile.add(new THREE.Mesh(groundGeo, groundMat));

      for (let t = 0; t < 44; t++) {
        const x = (Math.random() < 0.5 ? -1 : 1) * THREE.MathUtils.randFloat(7, 40);
        const z = THREE.MathUtils.randFloatSpread(TILE);
        const tree = makeTree();
        tree.position.set(x, groundHeight(x, z) - 0.3, z);
        tree.scale.setScalar(THREE.MathUtils.randFloat(0.9, 1.7));
        tile.add(tree);
      }

      tile.position.z = -n * TILE;
      scene.add(tile);
      return tile;
    });

    // clouds drifting overhead
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

    // big overlapping stills, trees in front of them cover parts of the image
    const loader = new THREE.TextureLoader();
    const photoGeo = new THREE.PlaneGeometry(STILL_W, STILL_H);
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
        side * THREE.MathUtils.randFloat(3, 8),
        THREE.MathUtils.randFloat(7.5, 8.5),
        -14 - i * STILL_GAP
      );
      still.rotation.y = -side * 0.2; // angled slightly toward the path
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

    // camera sways toward the pointer
    const pointer = { x: 0, y: 0 };
    function onPointerMove(e) {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener("pointermove", onPointerMove);

    // arrow keys swing the view while held, then ease back
    const keys = {};
    function onKeyDown(e) {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.startsWith("Arrow")) {
        keys[e.key] = true;
        e.preventDefault(); // blocks page scrolling
      }
    }
    function onKeyUp(e) {
      delete keys[e.key];
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const look = { x: 0, y: 0 }; // current swing
    const aim = new THREE.Vector3(0, 3.5, -40);
    const clock = new THREE.Clock();
    let frameId;

    function animate() {
      const dt = Math.min(clock.getDelta(), 0.05); // capped so background tabs don't jump
      const t = clock.elapsedTime;

      // hills roll forward, a tile behind the camera jumps to the front
      for (const tile of tiles) {
        tile.position.z += SPEED * dt;
        if (tile.position.z - TILE / 2 > 10) tile.position.z -= TILE * 2;
      }

      for (const cloud of clouds) {
        cloud.position.z += SPEED * 0.25 * dt;
        if (cloud.position.z > 20) cloud.position.z = -150;
      }

      // stills drift, bob and fade by distance
      for (const still of stills) {
        still.position.z += SPEED * 1.15 * dt;
        still.position.y = still.userData.baseY + Math.sin(t * 0.8 + still.userData.phase) * 0.25;
        if (still.position.z > 4) still.position.z -= WRAP;
        still.material.uniforms.opacity.value = fadeFor(still.position.z);
      }

      // held keys set the target, the swing eases toward it
      const wantX = ((keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0)) * LOOK_X;
      const wantY = ((keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0)) * LOOK_Y;
      look.x += (wantX - look.x) * 0.05;
      look.y += (wantY - look.y) * 0.05;
      aim.set(look.x, 3.5 + look.y, -40);

      camera.position.x += (pointer.x * 1.2 - camera.position.x) * 0.04;
      camera.position.y += (6 - pointer.y * 0.6 - camera.position.y) * 0.04;
      camera.lookAt(aim);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }

    if (reduceMotion) {
      camera.lookAt(aim);
      // render once textures load, then hold still
      THREE.DefaultLoadingManager.onLoad = () => renderer.render(scene, camera);
      renderer.render(scene, camera);
    } else {
      animate();
    }

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", layout);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      [groundGeo, puffGeo, photoGeo, ...trunkGeos, ...clumpGeos].forEach((g) => g.dispose());
      [groundMat, trunkMat, cloudMat, ...leafMats].forEach((m) => m.dispose());
      photoMats.forEach((m) => {
        m.uniforms.map.value.dispose();
        m.dispose();
      });
      gradientMap.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="scene" aria-hidden="true">
      <div ref={mountRef} className="scene-canvas" />
      <div className="scene-shade" />
      <p className="scene-credit">Stills © Studio Ghibli</p>
    </div>
  );
}