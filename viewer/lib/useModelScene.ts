'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { createControls } from './controls';
import { frameObject } from './frame';
import { fetchScene, type Entry } from './scene';
import { cssColor, subscribeTheme } from './theme';

export type SceneCtx = { scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: TrackballControls; canvas: HTMLCanvasElement };

// A full-size viewer canvas (renderer, lights, free-rotation controls) that loads one machine.
// Pages built on it only add what they do to the loaded model.
export function useModelScene(modelPath: string | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctx = useRef<SceneCtx>(null!);
  const [holder, setHolder] = useState<THREE.Group | null>(null);
  const [roots, setRoots] = useState<Entry[]>([]);
  const [status, setStatus] = useState('Loading…');
  const [ready, setReady] = useState(false); // renderer exists

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(devicePixelRatio);
    renderer.localClippingEnabled = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cssColor('--canvas-bg'));
    const unsubscribeTheme = subscribeTheme(() => { scene.background = new THREE.Color(cssColor('--canvas-bg')); });
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1e6);
    const { controls, dispose: disposeControls } = createControls(camera, canvas);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404858, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(1, 1, 2);
    camera.add(sun);
    scene.add(camera);
    ctx.current = { scene, camera, controls, canvas };

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas.parentElement!;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      controls.handleResize();
      renderer.render(scene, camera);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas.parentElement!);
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    setReady(true);
    return () => { unsubscribeTheme(); observer.disconnect(); renderer.setAnimationLoop(null); disposeControls(); renderer.dispose(); };
  }, []);

  // Frames `target` (the whole machine by default) from `dir`, or from the default angle.
  const fit = useCallback((target?: THREE.Object3D | THREE.Box3, dir?: THREE.Vector3, up = new THREE.Vector3(0, 1, 0)) => {
    const { camera, controls, canvas, scene } = ctx.current;
    const obj = target ?? scene.children.find((c) => c.userData.up);
    if (!obj) return;
    camera.up.copy(up);
    const { center, radius } = frameObject(camera, obj, canvas.clientWidth / canvas.clientHeight, dir);
    controls.target.copy(center);
    controls.minDistance = radius * 0.05;
    controls.maxDistance = radius * 20;
    controls.update();
  }, []);

  useEffect(() => {
    if (!ready || !modelPath) return;
    let cancelled = false;
    setHolder(null);
    setRoots([]);
    (async () => {
      try {
        const scene = await fetchScene(modelPath, setStatus);
        if (cancelled) return;
        const t = ctx.current;
        t.scene.children.filter((c) => c.userData.up).forEach((c) => t.scene.remove(c));
        t.scene.add(scene.holder);
        fit(scene.holder);
        setRoots(scene.roots);
        setHolder(scene.holder);
        setStatus(scene.name);
      } catch (e) {
        if (!cancelled) setStatus(`Failed: ${(e as Error).message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [ready, modelPath, fit]);

  return { canvasRef, ctx, holder, roots, status, fit };
}
