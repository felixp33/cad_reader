import * as THREE from 'three';
import { frameObject } from './frame';

// Renders a one-off preview image of a loaded model.
export async function renderThumbnail(model: THREE.Object3D, width = 480, height = 320): Promise<Blob> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1e25);
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1e6);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404858, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(1, 1, 2);
  camera.add(sun);
  scene.add(camera, model);
  frameObject(camera, model, width / height);
  renderer.render(scene, camera);
  const blob = await new Promise<Blob>((resolve, reject) =>
    renderer.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
  scene.remove(model); // caller owns the model; only free the renderer
  renderer.dispose();
  renderer.forceContextLoss();
  return blob;
}
