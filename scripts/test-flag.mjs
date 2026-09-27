import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFlag } from '../src/scene/createFlag.js';
import { normalizeFlagSettings, decodeFlag } from '../src/shared/flagStore.js';

test('settings keep the banner behind the character and reject nonfinite sizes', () => {
  const settings = normalizeFlagSettings({ z: 3, width: Infinity, x: 100 });
  assert.equal(settings.z, -0.6);
  assert.equal(settings.width, 5);
  assert.equal(settings.x, 5);
  assert.equal(normalizeFlagSettings({ width: 25 }).width, 25);
  assert.equal(normalizeFlagSettings({ width: 0.5 }).width, 0.5);
});

test('unsupported and oversized files are rejected before decoding', async () => {
  await assert.rejects(decodeFlag(new Blob(['bad'], { type: 'image/svg+xml' })), /PNG/);
  await assert.rejects(decodeFlag(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/png' })), /10 МБ/);
});

test('banner preserves aspect ratio, supports hiding, and disposes old images', async t => {
  let closed = 0;
  const original = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => ({ width: 600, height: 400, close() { closed++; } });
  t.after(() => { if (original) globalThis.createImageBitmap = original; else delete globalThis.createImageBitmap; });
  const scene = new THREE.Scene();
  const flag = createFlag(scene);
  const blob = new Blob(['fixture'], { type: 'image/png' });
  await flag.apply({ blob, settings: { width: 6, wave: false } });
  assert.equal(flag.mesh.scale.y, 4);
  assert.equal(flag.mesh.visible, true);
  flag.update(0.016);
  assert.equal(flag.mesh.geometry.attributes.position.getZ(30), 0);
  await flag.apply({ blob, settings: { visible: false } });
  assert.equal(flag.mesh.visible, false);
  assert.equal(closed, 1);
  flag.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(closed, 2);
});
