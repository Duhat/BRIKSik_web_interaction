import * as THREE from 'three';
import { decodeFlag, normalizeFlagSettings } from '../shared/flagStore.js';

export function createFlag(scene) {
  const geometry = new THREE.PlaneGeometry(1, 1, 40, 24);
  // Unlit material preserves the uploaded flag's colours under the stage lights.
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'StageFlag';
  mesh.visible = false;
  scene.add(mesh);
  let settings = normalizeFlagSettings();
  let bitmap = null;
  let revision = 0;
  let elapsed = 0;

  function configure() {
    mesh.visible = Boolean(bitmap && settings.visible);
    mesh.position.set(settings.x, settings.y, settings.z);
    mesh.scale.set(settings.width, bitmap ? settings.width * bitmap.height / bitmap.width : 1, 1);
  }

  return {
    mesh,
    async apply(record) {
      const id = ++revision;
      const next = record?.blob ? await decodeFlag(record.blob) : null;
      if (id !== revision) { next?.close(); return; }
      const texture = next ? new THREE.Texture(next) : null;
      if (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
      }
      material.map?.dispose();
      bitmap?.close();
      bitmap = next;
      material.map = texture;
      material.needsUpdate = true;
      settings = normalizeFlagSettings(record?.settings);
      configure();
    },
    update(delta) {
      if (!mesh.visible) return;
      elapsed += Math.min(delta, 0.05);
      const positions = geometry.attributes.position;
      const uv = geometry.attributes.uv;
      for (let i = 0; i < positions.count; i++) {
        // Use undeformed UV coordinates so the movement never accumulates drift.
        const x = uv.getX(i) - 0.5, y = uv.getY(i) - 0.5;
        const freeEdge = settings.wave ? 0.5 - y : 0;
        const phase = x * 9 + elapsed * 2.2 + y * 2;
        const ripple = Math.sin(phase);
        // A fixed top edge and a moving hem make the cloth visible head-on too.
        positions.setXYZ(i,
          x + Math.sin(phase * 0.7) * 0.018 * freeEdge,
          y + ripple * 0.022 * freeEdge,
          settings.wave ? (ripple * 0.22 + Math.sin(x * 17 - elapsed * 3.1 + y * 4) * 0.06) * freeEdge : 0
        );
      }
      positions.needsUpdate = true;
      geometry.computeBoundingSphere();
    },
    dispose() {
      revision++;
      scene.remove(mesh);
      material.map?.dispose();
      bitmap?.close();
      geometry.dispose();
      material.dispose();
    }
  };
}
