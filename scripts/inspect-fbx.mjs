import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

globalThis.self = globalThis;

const path = process.argv[2];
const buffer = readFileSync(path);
const loader = new FBXLoader();
const model = loader.parse(buffer.buffer.slice(
  buffer.byteOffset,
  buffer.byteOffset + buffer.byteLength
), '');

const lines = [];
const log = (msg) => lines.push(typeof msg === 'string' ? msg : JSON.stringify(msg));

log(`name=${model.name} type=${model.type} children=${model.children.length}`);
log(`scale=${JSON.stringify(model.scale.toArray())} pos=${JSON.stringify(model.position.toArray())}`);
log(`anims=${model.animations?.length ?? 0}`);

model.updateMatrixWorld(true);

let meshes = 0;
let bones = 0;
model.traverse((obj) => {
  if (obj.isBone) bones++;
  if (obj.isMesh) {
    meshes++;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const geom = obj.geometry;
    const pos = geom?.attributes?.position;
    geom?.computeBoundingBox();
    const bb = geom?.boundingBox;
    const size = bb ? bb.getSize(new THREE.Vector3()) : null;
    log({
      mesh: obj.name,
      type: obj.type,
      visible: obj.visible,
      frustumCulled: obj.frustumCulled,
      isSkinned: Boolean(obj.isSkinnedMesh),
      verts: pos?.count ?? 0,
      geomSize: size?.toArray() ?? null,
      bindMode: obj.bindMode,
      skeletonBones: obj.skeleton?.bones?.length ?? 0,
      materials: mats.map((m) => ({
        type: m?.type,
        name: m?.name,
        color: m?.color?.getHexString?.(),
        opacity: m?.opacity,
        transparent: m?.transparent,
        side: m?.side,
        visible: m?.visible,
        map: Boolean(m?.map),
        alphaMap: Boolean(m?.alphaMap)
      }))
    });
  }
});

const box = new THREE.Box3().setFromObject(model);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());
log(`meshes=${meshes} bones=${bones}`);
log(`worldSize=${JSON.stringify(size.toArray())} worldCenter=${JSON.stringify(center.toArray())}`);
log(`boxEmpty=${box.isEmpty()} min=${JSON.stringify(box.min.toArray())} max=${JSON.stringify(box.max.toArray())}`);

if (model.animations?.[0]) {
  const clip = model.animations[0];
  log(`clip0=${clip.name} duration=${clip.duration} tracks=${clip.tracks.length}`);
  log(clip.tracks.slice(0, 8).map((t) => t.name));
}

writeFileSync(process.argv[3], lines.join('\n'));
console.log('wrote', process.argv[3]);
