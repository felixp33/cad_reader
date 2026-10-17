'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Entry } from './TreeNode';

const MIN_W = 260, MIN_H = 200, MAX_W = 900, MAX_H = 800;

// Small overlay with its own renderer showing a single part/sub-assembly on its own.
export default function IsolatedView({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 380, h: 320 });
  const resetRef = useRef<() => void>(() => {});
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

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

    holder.updateMatrixWorld(true); // world matrices are stale until the first render
    const box = new THREE.Box3().setFromObject(holder);
    const diag = Math.max(box.getSize(new THREE.Vector3()).length(), 1e-3);
    const center = box.getCenter(new THREE.Vector3());
    camera.near = diag / 1000;
    camera.far = diag * 20;
    camera.updateProjectionMatrix();
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.zoomToCursor = true; // wheel zooms towards the pointer
    controls.minDistance = diag * 0.02;
    controls.maxDistance = diag * 10;

    // Frame the whole part again.
    const reset = () => {
      camera.position.copy(center).add(new THREE.Vector3(1, 0.8, 1.2).normalize().multiplyScalar(diag * 1.2));
      controls.target.copy(center);
      controls.update();
    };
    reset();
    resetRef.current = reset;

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
    });
    ro.observe(canvas);

    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
    return () => { canvas.removeEventListener('dblclick', onDouble); ro.disconnect(); renderer.setAnimationLoop(null); controls.dispose(); renderer.dispose(); };
  }, [entry]);

  const host = () => canvasRef.current!.closest('main')!;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  // Starts at the top-right of the 3D area.
  useEffect(() => {
    setPos({ x: Math.max(0, host().clientWidth - size.w - 10), y: 52 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pointer-drag helper: calls onMove with the delta from where the drag started.
  const drag = (e: React.PointerEvent, onMove: (dx: number, dy: number) => void) => {
    e.preventDefault();
    const { clientX: x0, clientY: y0 } = e;
    const move = (ev: PointerEvent) => onMove(ev.clientX - x0, ev.clientY - y0);
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  };

  const startMove = (e: React.PointerEvent) => {
    if (!pos || (e.target as HTMLElement).closest('button')) return;
    const { x, y } = pos;
    const { clientWidth: hw, clientHeight: hh } = host();
    drag(e, (dx, dy) => setPos({ x: clamp(x + dx, 0, hw - size.w), y: clamp(y + dy, 0, hh - size.h) }));
  };

  // Grows right/down from the fixed top-left corner, up to the limits or the edge of the 3D area.
  const startResize = (e: React.PointerEvent) => {
    if (!pos) return;
    const { w, h } = size;
    const { clientWidth: hw, clientHeight: hh } = host();
    const maxW = Math.min(MAX_W, hw - pos.x), maxH = Math.min(MAX_H, hh - pos.y);
    drag(e, (dx, dy) => setSize({ w: clamp(w + dx, MIN_W, maxW), h: clamp(h + dy, MIN_H, maxH) }));
  };

  return (
    <div className="iso" style={{ width: size.w, height: size.h, left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
      <div className="iso-head" onPointerDown={startMove}>
        <span className="iso-title">{entry.name}</span>
        <span className="iso-actions">
          <button onClick={() => resetRef.current()} title="Recenter and fit (double-click also recenters)">⌖</button>
          <button onClick={onClose}>✕</button>
        </span>
      </div>
      <canvas ref={canvasRef} />
      <div className="iso-resize" onPointerDown={startResize} title="Drag to resize" />
    </div>
  );
}
