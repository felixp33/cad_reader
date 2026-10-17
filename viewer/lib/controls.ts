import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';

// Free rotation about all axes (no fixed "up", no pole limits). Drag rotates/pans; trackpad gestures are handled in onWheel.
export function createControls(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
  const controls = new TrackballControls(camera, canvas);
  controls.rotateSpeed = 3;
  controls.panSpeed = 0.8;
  controls.dynamicDampingFactor = 0.15;
  controls.keys = ['', '', '']; // no A/S/D mode keys (they'd fire while typing in inputs)
  controls.noZoom = true; // replaced by the cursor-aware zoom below

  const ray = new THREE.Raycaster();
  const right = new THREE.Vector3(), up = new THREE.Vector3();

  const zoomAt = (e: WheelEvent) => {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    // Point under the cursor, on the plane through the orbit target that faces the camera.
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), controls.target);
    const p = ray.ray.intersectPlane(plane, new THREE.Vector3());
    if (!p) return;
    const dist = camera.position.distanceTo(controls.target);
    const delta = THREE.MathUtils.clamp(e.deltaY, -40, 40); // pinch sends small deltas, a mouse wheel large ones
    const next = THREE.MathUtils.clamp(dist * Math.exp(delta * 0.01), controls.minDistance, controls.maxDistance);
    const f = next / dist;
    camera.position.sub(p).multiplyScalar(f).add(p);
    controls.target.sub(p).multiplyScalar(f).add(p);
  };

  // Free rotation around the target about the camera's own screen axes.
  const rotate = (dx: number, dy: number) => {
    camera.updateMatrixWorld();
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const q = new THREE.Quaternion().setFromAxisAngle(up, -dx * 0.006).multiply(new THREE.Quaternion().setFromAxisAngle(right, -dy * 0.006));
    camera.position.sub(controls.target).applyQuaternion(q).add(controls.target);
    camera.up.applyQuaternion(q);
    camera.lookAt(controls.target);
  };

  const pan = (dx: number, dy: number) => {
    camera.updateMatrixWorld();
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    const k = camera.position.distanceTo(controls.target) * 0.0012;
    const move = right.multiplyScalar(dx * k).addScaledVector(up, -dy * k);
    camera.position.add(move);
    controls.target.add(move);
  };

  // MacBook trackpad: two-finger scroll rotates, pinch zooms (the browser reports it as ctrl+wheel),
  // Option + two-finger scroll pans. A mouse wheel with Ctrl/⌘ held also zooms.
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    controls.dispatchEvent({ type: 'start' }); // lets listeners know the user took over the camera
    if (e.ctrlKey || e.metaKey) zoomAt(e);
    else if (e.altKey) pan(e.deltaX, e.deltaY);
    else rotate(e.deltaX, e.deltaY);
  };
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return { controls, dispose: () => { canvas.removeEventListener('wheel', onWheel); controls.dispose(); } };
}
