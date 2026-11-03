'use client';

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { cssColor } from '@/lib/theme';
import { useModelPick } from '@/lib/useModelPick';
import { useModelScene } from '@/lib/useModelScene';
import Toggle from './Toggle';
import { StageLoading } from './Skeleton';
import TopBar from './TopBar';

const AXES = [
  { id: 0, label: 'X', hint: 'length' },
  { id: 1, label: 'Y', hint: 'height' },
  { id: 2, label: 'Z', hint: 'depth' },
] as const;

// Cut surfaces: back faces seen through the cut are painted flat, which reads as the solid section.
function paintCuts(holder: THREE.Object3D, plane: THREE.Plane, cap: THREE.Color) {
  const mats: THREE.MeshStandardMaterial[] = [];
  holder.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.clippingPlanes = [plane];
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>\n if (!gl_FrontFacing) gl_FragColor = vec4(${cap.r.toFixed(3)}, ${cap.g.toFixed(3)}, ${cap.b.toFixed(3)}, 1.0);`,
      );
    };
    mat.customProgramCacheKey = () => 'section-cap';
    mat.needsUpdate = true;
    mats.push(mat);
  });
  return mats;
}

// Cross-section ("Querschnitt") of a machine: a movable clipping plane along one axis.
export default function Section() {
  const { models, model, setModel } = useModelPick();
  const { canvasRef, holder, status, fit } = useModelScene(model);
  const [axis, setAxis] = useState(0);
  const [t, setT] = useState(0.5); // position along the axis, 0..1 of the machine's extent
  const [flip, setFlip] = useState(false);
  const [cut, setCut] = useState(true);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), []);
  const box = useMemo(() => (holder ? (holder.updateMatrixWorld(true), new THREE.Box3().setFromObject(holder)) : null), [holder]);

  useEffect(() => {
    if (!holder) return;
    const mats = paintCuts(holder, plane, new THREE.Color(cssColor('--accent')));
    return () => mats.forEach((m) => { m.clippingPlanes = null; m.onBeforeCompile = () => {}; m.needsUpdate = true; });
  }, [holder, plane]);

  // Keep points with n·p + c ≥ 0. Disabled = a plane far behind everything.
  useEffect(() => {
    if (!box) return;
    const n = new THREE.Vector3().setComponent(axis, flip ? -1 : 1);
    const pos = box.min.getComponent(axis) + t * (box.max.getComponent(axis) - box.min.getComponent(axis));
    plane.normal.copy(n);
    plane.constant = cut ? -n.dot(new THREE.Vector3().setComponent(axis, pos)) : 1e9;
  }, [box, axis, t, flip, cut, plane]);

  // Look straight at the cut face: from the side that was removed.
  const faceCut = () => {
    if (!box) return;
    const dir = new THREE.Vector3().setComponent(axis, flip ? 1 : -1);
    fit(holder!, dir, axis === 1 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0));
  };

  return (
    <div className="stage">
      <TopBar actions={<Toggle label="Cut" checked={cut} onChange={setCut} />}>
        <h1 className="topbar-title">Slice</h1>
        <select value={model ?? ''} onChange={(e) => setModel(e.target.value)} aria-label="Machine">
          {models.map((m) => <option key={m.path} value={m.path}>{m.path.split('/').pop()}</option>)}
        </select>
      </TopBar>
      <aside className="stage-side">
        <h2>Cutting plane</h2>
        <div className="setting">
          <span>Axis</span>
          <div className="segmented" role="group" aria-label="Cut axis">
            {AXES.map((a) => <button key={a.id} title={a.hint} aria-pressed={axis === a.id} onClick={() => setAxis(a.id)}>{a.label}</button>)}
          </div>
        </div>
        <label className="slider">
          <span>Position <b>{Math.round(t * 100)}%</b></span>
          <input type="range" min={0} max={1000} value={Math.round(t * 1000)} onChange={(e) => setT(+e.target.value / 1000)} disabled={!cut} />
        </label>
        <div className="stage-buttons">
          <button className="btn" onClick={() => setFlip((f) => !f)} disabled={!cut}>Flip side</button>
          <button className="btn" onClick={faceCut} disabled={!cut || !box}>Face the cut</button>
          <button className="btn" onClick={() => fit(holder ?? undefined)} disabled={!box}>Reset view</button>
        </div>
        <p className="stage-help">Drag to rotate, scroll to zoom. The red areas are where the plane cuts through material.</p>
      </aside>
      <main className="stage-main">
        <canvas ref={canvasRef} />
        {!holder && <StageLoading />}
        <div className="status">{status}</div>
      </main>
    </div>
  );
}
