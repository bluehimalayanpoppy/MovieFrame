import { useEffect, useRef } from "react";
import * as THREE from "three";

// Full-screen 3D background: a cel-shaded torus knot with floating film frames.
// The knot uses MeshToonMaterial, the same cel-shading technique the classifier detects.
export default function Scene() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Scene, camera, renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 9;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Toon gradient: 3 hard brightness bands instead of smooth shading
    const bands = new Uint8Array([70, 150, 255]);
    const gradientMap = new THREE.DataTexture(bands, 3, 1, THREE.RedFormat);
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.needsUpdate = true;

    // Cel-shaded knot
    const knotGeo = new THREE.TorusKnotGeometry(1.4, 0.45, 180, 24);
    const knotMat = new THREE.MeshToonMaterial({ color: 0xf5c518, gradientMap });
    const knot = new THREE.Mesh(knotGeo, knotMat);
    scene.add(knot);

    // Ink outline: a slightly larger copy showing only its back faces
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x050608, side: THREE.BackSide });
    const outline = new THREE.Mesh(knotGeo, outlineMat);
    outline.scale.setScalar(1.035);
    knot.add(outline);

    // Floating film-frame outlines in the background
    const frameGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.6, 0.9));
    const frameMat = new THREE.LineBasicMaterial({ color: 0x9a9ca5, transparent: true, opacity: 0.3 });
    const frames = [];
    for (let i = 0; i < 16; i++) {
      const frame = new THREE.LineSegments(frameGeo, frameMat);
      frame.position.set(
        THREE.MathUtils.randFloatSpread(16),
        THREE.MathUtils.randFloatSpread(10),
        THREE.MathUtils.randFloat(-8, -2)
      );
      frame.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6);
      frame.userData.speed = THREE.MathUtils.randFloat(0.15, 0.4);
      scene.add(frame);
      frames.push(frame);
    }

    // Lighting
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(3, 4, 5);
    scene.add(sun, new THREE.AmbientLight(0xffffff, 0.35));

    // Keep the knot beside the content on wide screens, above it on narrow ones
    function layout() {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      const wide = camera.aspect > 1.2;
      knot.position.set(wide ? 3.4 : 0, wide ? 0.3 : 2.6, 0);
      knot.scale.setScalar(wide ? 1 : 0.7);
    }
    layout();
    window.addEventListener("resize", layout);

    // Gentle tilt toward the pointer
    const pointer = { x: 0, y: 0 };
    function onPointerMove(e) {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    }
    window.addEventListener("pointermove", onPointerMove);

    // Animation loop
    const clock = new THREE.Clock();
    let frameId;
    function animate() {
      const dt = clock.getDelta();
      const t = clock.elapsedTime;

      knot.rotation.x += dt * 0.25;
      knot.rotation.y += dt * 0.35;
      knot.position.y += Math.sin(t * 1.2) * 0.002;

      for (const frame of frames) {
        frame.position.y += dt * frame.userData.speed;
        frame.rotation.y += dt * 0.1;
        if (frame.position.y > 6) frame.position.y = -6; // wrap to bottom
      }

      camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.05;
      camera.position.y += (-pointer.y * 0.4 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }

    if (reduceMotion) {
      renderer.render(scene, camera); // single still frame
    } else {
      animate();
    }

    // Cleanup when the component unmounts
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", layout);
      window.removeEventListener("pointermove", onPointerMove);
      knotGeo.dispose();
      knotMat.dispose();
      outlineMat.dispose();
      frameGeo.dispose();
      frameMat.dispose();
      gradientMap.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="scene" aria-hidden="true" />;
}
