import * as THREE from 'three';

const VIEW_DIR = new THREE.Vector3(1, 0.8, 1.2).normalize();

// Positions the camera so the whole object fits in view for the given aspect ratio.
// `viewDir` is the direction from the object towards the camera. Returns the point to orbit around and the bounding radius.
export function frameObject(camera: THREE.PerspectiveCamera, object: THREE.Object3D, aspect: number, viewDir: THREE.Vector3 = VIEW_DIR) {
  object.updateMatrixWorld(true); // world matrices are stale until the first render
  const sphere = new THREE.Box3().setFromObject(object).getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 1e-3);
  const halfV = THREE.MathUtils.degToRad(camera.fov) / 2;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  const dist = (radius / Math.sin(Math.min(halfV, halfH))) * 1.1; // 10% margin
  camera.aspect = aspect;
  camera.near = radius / 100;
  camera.far = radius * 40;
  camera.updateProjectionMatrix();
  camera.position.copy(sphere.center).addScaledVector(viewDir, dist);
  camera.lookAt(sphere.center);
  return { center: sphere.center, radius, dist };
}
