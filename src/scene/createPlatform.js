import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createPlatform({
  size = 4.4,
  height = 0.16,
  y = 0
} = {}) {
  const platform = new THREE.Group();
  platform.name = 'Platform';

  const baseHeight = height * 1.35;
  const deckInset = 0.18;
  const inner = size - deckInset;
  const lineWidth = 0.08;
  const matHeight = 0.02;
  const matY = y - 0.009;
  const sideWidth = inner / 2 - lineWidth / 2;
  const sideOffset = sideWidth / 2 + lineWidth / 2;

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x6b4a2e,
    roughness: 0.78,
    metalness: 0.04
  });

  const base = new THREE.Mesh(
    new RoundedBoxGeometry(size + 0.22, baseHeight, size + 0.22, 3, 0.05),
    new THREE.MeshStandardMaterial({
      color: 0x3a2818,
      roughness: 0.86,
      metalness: 0.06
    })
  );
  base.position.y = y - height / 2 - baseHeight * 0.28;
  base.castShadow = true;
  base.receiveShadow = true;

  const deck = new THREE.Mesh(
    new RoundedBoxGeometry(size, height, size, 4, 0.06),
    woodMaterial
  );
  deck.position.y = y - height / 2;
  deck.castShadow = true;
  deck.receiveShadow = true;

  const blueMat = new THREE.Mesh(
    new THREE.BoxGeometry(sideWidth, matHeight, inner),
    new THREE.MeshStandardMaterial({
      color: 0x1e4ea8,
      roughness: 0.9,
      metalness: 0.02
    })
  );
  blueMat.position.set(-sideOffset, matY, 0);
  blueMat.receiveShadow = true;

  const redMat = new THREE.Mesh(
    new THREE.BoxGeometry(sideWidth, matHeight, inner),
    new THREE.MeshStandardMaterial({
      color: 0xc62828,
      roughness: 0.9,
      metalness: 0.02
    })
  );
  redMat.position.set(sideOffset, matY, 0);
  redMat.receiveShadow = true;

  const centerLine = new THREE.Mesh(
    new THREE.BoxGeometry(lineWidth, matHeight + 0.003, inner),
    new THREE.MeshStandardMaterial({
      color: 0xf4f1e8,
      roughness: 0.62,
      metalness: 0.04
    })
  );
  centerLine.position.set(0, matY + 0.001, 0);
  centerLine.receiveShadow = true;

  const rimThickness = 0.04;
  const rimHeight = 0.03;
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a6239,
    roughness: 0.7,
    metalness: 0.08
  });

  const rimZ = new THREE.BoxGeometry(inner + rimThickness * 2, rimHeight, rimThickness);
  const rimX = new THREE.BoxGeometry(rimThickness, rimHeight, inner);

  const rimFront = new THREE.Mesh(rimZ, rimMaterial);
  const rimBack = new THREE.Mesh(rimZ, rimMaterial);
  const rimLeft = new THREE.Mesh(rimX, rimMaterial);
  const rimRight = new THREE.Mesh(rimX, rimMaterial);

  const rimOffset = inner / 2 + rimThickness / 2;

  rimFront.position.set(0, y - 0.002, rimOffset);
  rimBack.position.set(0, y - 0.002, -rimOffset);
  rimLeft.position.set(-rimOffset, y - 0.002, 0);
  rimRight.position.set(rimOffset, y - 0.002, 0);

  const meshes = [
    base,
    deck,
    blueMat,
    redMat,
    centerLine,
    rimFront,
    rimBack,
    rimLeft,
    rimRight
  ];

  for (const mesh of meshes) {
    mesh.castShadow = mesh !== blueMat && mesh !== redMat && mesh !== centerLine;
    mesh.receiveShadow = true;
  }

  platform.add(...meshes);

  return platform;
}
