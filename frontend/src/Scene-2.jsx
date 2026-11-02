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

    // Framed film stills floating along both sides of the path
    const loader = new THREE.TextureLoader();
    const frameGeo = new THREE.PlaneGeometry(6.7, 3.76);
    const photoGeo = new THREE.PlaneGeometry(6.4, 3.46);
    const frameMat = new THREE.MeshBasicMaterial({ color: 0xf6f1e7 });
    const photoMats = [];
    const stills = STILLS.map((src, i) => {
      const texture = loader.load(src);
      texture.colorSpace = THREE.SRGBColorSpace;
      const photoMat = new THREE.MeshBasicMaterial({ map: texture });
      photoMats.push(photoMat);

      const still = new THREE.Group();
      const frame = new THREE.Mesh(frameGeo, frameMat);
      const photo = new THREE.Mesh(photoGeo, photoMat);
      photo.position.z = 0.02; // just in front of the frame
      still.add(frame, photo);

      const side = i % 2 ? 1 : -1;
      still.position.set(
        side * THREE.MathUtils.randFloat(5.5, 7),
        THREE.MathUtils.randFloat(5.5, 6.8),
        -12 - i * 20
      );
      still.rotation.y = -side * 0.35; // angle toward the middle of the path
      still.userData.baseY = still.position.y;
      still.userData.phase = Math.random() * Math.PI * 2;
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

    const target = new THREE.Vector3(0, 3.5, -40);
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

      // Stills drift past slightly faster than the ground and bob gently
      for (const still of stills) {
        still.position.z += SPEED * 1.15 * dt;
        still.position.y = still.userData.baseY + Math.sin(t * 0.8 + still.userData.phase) * 0.25;
        if (still.position.z > 6) still.position.z -= 100;
      }

      camera.position.x += (pointer.x * 1.2 - camera.position.x) * 0.04;
      camera.position.y += (6 - pointer.y * 0.6 - camera.position.y) * 0.04;
      camera.lookAt(target);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }

    if (reduceMotion) {
      camera.lookAt(target);
      // draw once the textures arrive, then hold still
      THREE.DefaultLoadingManager.onLoad = () => renderer.render(scene, camera);
      renderer.render(scene, camera);
    } else {
      animate();
    }

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", layout);
      window.removeEventListener("pointermove", onPointerMove);
      [groundGeo, canopyGeo, trunkGeo, puffGeo, frameGeo, photoGeo].forEach((g) => g.dispose());
      [groundMat, canopyMat, trunkMat, cloudMat, frameMat].forEach((m) => m.dispose());
      photoMats.forEach((m) => {
        m.map.dispose();
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
