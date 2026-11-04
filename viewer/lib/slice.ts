import * as THREE from 'three';

// Clips every mesh under `root` with `plane` and paints the cut: back faces seen through the opening are
// drawn flat in `cap`, which reads as the solid cross-section. Returns a function that restores the materials.
export function applySlice(root: THREE.Object3D, plane: THREE.Plane, cap: THREE.Color) {
  const mats: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => {
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
  return () => mats.forEach((m) => { m.clippingPlanes = null; m.onBeforeCompile = () => {}; m.customProgramCacheKey = () => ''; m.needsUpdate = true; });
}

// Keeps points with n·p + c ≥ 0, where n is `axis` (0..2, signed by `flip`) and the plane sits `t` (0..1) along the box.
export function placePlane(plane: THREE.Plane, box: THREE.Box3, axis: number, t: number, flip: boolean) {
  const n = new THREE.Vector3().setComponent(axis, flip ? -1 : 1);
  const pos = box.min.getComponent(axis) + t * (box.max.getComponent(axis) - box.min.getComponent(axis));
  plane.normal.copy(n);
  plane.constant = -n.dot(new THREE.Vector3().setComponent(axis, pos));
}
