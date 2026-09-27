import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { AnimationManager } from '../src/characters/AnimationManager.js';
import { CharacterController } from '../src/characters/CharacterController.js';
import { ScenarioPlayer } from '../src/characters/ScenarioPlayer.js';

function fixture() {
  const model = new THREE.Object3D();
  const manager = new AnimationManager(model);
  manager.autoIdleEnabled = false;
  for (const [name, value] of [['A', 2], ['B', 8], ['C', -4]]) {
    manager.addAnimation(name, new THREE.AnimationClip(name, 2, [
      new THREE.NumberKeyframeTrack('.position[x]', [0, 2], [value, value])
    ]));
  }
  manager.play('A', 0.1);
  manager.update(0.1);
  return { model, manager };
}

test('new clip starts at zero weight, with a continuous interrupted blend', () => {
  const { model, manager } = fixture();
  manager.play('B', 1);
  manager.update(0);
  assert.equal(model.position.x, 2);
  manager.update(0.5);
  assert.equal(model.position.x, 5);
  manager.play('C', 1);
  manager.update(0);
  assert.equal(model.position.x, 5);
  manager.update(1);
  assert.equal(model.position.x, -4);
});

test('selecting the same running clip preserves phase and pose', () => {
  const { manager, model } = fixture();
  const time = manager.actions.A.time;
  manager.play('A');
  manager.update(0);
  assert.equal(manager.actions.A.time, time);
  assert.equal(model.position.x, 2);
});

test('returning to an outgoing clip preserves its weight and phase', () => {
  const { manager, model } = fixture();
  manager.play('B', 1);
  manager.update(0.3);
  const position = model.position.x;
  const time = manager.actions.A.time;
  manager.play('A', 1);
  manager.update(0);
  assert.equal(model.position.x, position);
  assert.equal(manager.actions.A.time, time);
  manager.update(1);
  assert.equal(model.position.x, 2);
});

test('replaying a finished clip fades from its final pose and frees the old action', () => {
  const model = new THREE.Object3D();
  const manager = new AnimationManager(model);
  manager.autoIdleEnabled = false;
  manager.addAnimation('Once', new THREE.AnimationClip('Once', 1, [
    new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 10])
  ]), false);
  manager.play('Once', 0.1);
  manager.update(1);
  assert.equal(model.position.x, 10);
  manager.play('Once', 0.5);
  manager.update(0);
  assert.equal(model.position.x, 10);
  manager.update(0.5);
  assert.equal(manager._retiringActions.size, 0);
  assert.equal(manager.mixer._actions.length, 1);
});

test('travel velocity is continuous at acceleration and braking boundaries', () => {
  const controller = new CharacterController(new THREE.Object3D());
  function position(t) {
    controller.placeAt(0, 0);
    controller.moveTo(1, 0, 1000, { faceMotion: false });
    controller.update(t);
    return controller.model.position.x;
  }
  const h = 0.00001;
  for (const t of [0.16, 0.84]) {
    const left = (position(t) - position(t - h)) / h;
    const right = (position(t + h) - position(t)) / h;
    assert.ok(Math.abs(left - right) < 0.001);
  }
});

test('an outgoing animation cannot finish the current scenario step', async () => {
  const controller = new CharacterController(new THREE.Object3D());
  const player = new ScenarioPlayer(controller, { A: { loop: false } });
  const expected = {};
  controller.animationManager.actions.A = expected;
  player.running = true;
  player.steps = [{ animation: 'A' }];
  let finished = false;
  const wait = player._waitForAnimation().then(() => { finished = true; });
  player._onAnimationFinished({ action: {} });
  await Promise.resolve();
  assert.equal(finished, false);
  player._onAnimationFinished({ action: expected });
  await wait;
  assert.equal(finished, true);
});

test('a cancelled scenario cannot advance a replacement scenario', async () => {
  const controller = new CharacterController(new THREE.Object3D());
  const player = new ScenarioPlayer(controller, {});
  let release;
  player._playCurrentStep = async () => true;
  player._afterStep = () => new Promise(resolve => { release = resolve; });
  player.running = true;
  player.steps = [{}, {}];
  player._playId = 1;
  const run = player._run(1);
  await Promise.resolve();
  player.stop({ returnToIdle: false });
  player.running = true;
  player.steps = [{}, {}];
  release();
  await run;
  assert.equal(player.index, 0);
});
