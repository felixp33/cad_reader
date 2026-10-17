'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { frameObject } from '@/lib/frame';
import type { Entry } from '@/lib/scene';

// A canvas with its own renderer showing a single part/sub-assembly on its own.
// Wheel zooms to the cursor, double-click recenters; `resetRef` re-frames the whole part.
export default function PartCanvas({ entry, resetRef }: { entry: Entry; resetRef?: React.MutableRefObject<() => void> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1e25);
    const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.1, 1e6);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404858, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(1, 1, 2);
    camera.add(sun);
    scene.add(camera);

    // Clone shares geometry; drop the instance's own placement so the part sits at the origin.
    const clone = entry.group.clone(true);
    clone.visible = true;
    clone.matrix.identity();
    const holder = new THREE.Group();
    holder.rotation.x = -Math.PI / 2; // STEP is Z-up
    holder.add(clone);
    scene.add(holder);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.zoomToCursor = true; // wheel zooms towards the pointer

    // Frame the whole part again, for the canvas' current aspect ratio.
    const reset = () => {
      const aspect = canvas.clientWidth && canvas.clientHeight ? canvas.clientWidth / canvas.clientHeight : camera.aspect;
      const { center, radius } = frameObject(camera, holder, aspect);
      controls.target.copy(center);
      controls.minDistance = radius * 0.05;
      controls.maxDistance = radius * 20;
      controls.update();
    };
    reset();
    if (resetRef) resetRef.current = reset;
    // Until the user moves the camera, keep the part framed as the layout settles / the canvas resizes.
    let interacted = false;
    controls.addEventListener('start', () => { interacted = true; });

    // Double-click recenters the orbit on the clicked point (or re-frames the part if nothing is hit).
    const ray = new THREE.Raycaster();
    const onDouble = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObject(holder, true)[0];
      if (hit) { controls.target.copy(hit.point); controls.update(); } else reset();
    };
    canvas.addEventListener('dblclick', onDouble);

    const ro = new ResizeObserver(() => {
      if (!canvas.clientWidth || !canvas.clientHeight) return;
      renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      if (!interacted) reset();
    });
    ro.observe(canvas);

    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    return () => { canvas.removeEventListener('dblclick', onDouble); ro.disconnect(); renderer.setAnimationLoop(null); controls.dispose(); renderer.dispose(); };
  }, [entry, resetRef]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
}
