import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

export async function loadSkybox(scene, path) {
  const gltf = await loader.loadAsync(path);
  const skybox = gltf.scene;

  skybox.traverse((object) => {
    if (!object.isMesh) {
      return;
    }

    const maps = {
      map: object.material.map,
      color: object.material.color
    };

    object.material = new THREE.MeshBasicMaterial({
      map: maps.map ?? null,
      color: maps.map ? 0xffffff : (maps.color ?? 0xffffff),
      side: THREE.DoubleSide,
      depthWrite: false
    });

    object.renderOrder = -1;
    object.frustumCulled = false;
    object.castShadow = false;
    object.receiveShadow = false;
  });

  skybox.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(skybox);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  skybox.position.sub(center);

  const maxSize = Math.max(size.x, size.y, size.z);
  if (maxSize > 0 && maxSize < 80) {
    skybox.scale.multiplyScalar(200 / maxSize);
  }

  scene.add(skybox);
  scene.background = null;

  return skybox;
}
