import * as THREE from 'three';

// Baked against Defoult.fbx's original UVs; skinning carries every detail with the mesh.
export async function applyBarsAppearance(model, renderer) {
  const texture = await new THREE.TextureLoader().loadAsync('/textures/briksik-complete-albedo.png');
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const previousMaterials = new Set();
  model.traverse(object => {
    if (!object.isMesh || !object.geometry.attributes.uv) return;
    const previous = Array.isArray(object.material) ? object.material : [object.material];
    previous.forEach(material => { if (material) previousMaterials.add(material); });
    object.material = new THREE.MeshStandardMaterial({
      name: 'Briksik complete reference texture',
      map: texture,
      roughness: 0.83,
      metalness: 0,
      side: THREE.DoubleSide,
    });
  });
  previousMaterials.forEach(material => material.dispose());
}
