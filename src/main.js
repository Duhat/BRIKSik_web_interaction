// ============================================================
// MAIN
// ============================================================

console.log('');
console.log('======================================');
console.log('[MAIN] main.js запущен');
console.log('======================================');


// ============================================================
// IMPORTS
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { loadCharacter } from './loaders/loadCharacter.js';
import { loadAnimation, loadAnimationFromBuffer } from './loaders/loadAnimation.js';
import { CharacterController } from './characters/CharacterController.js';
import { loadSkybox } from './scene/loadSkybox.js';
import { createPlatform } from './scene/createPlatform.js';
import {
  animations,
  CHARACTER_MODEL_PATH,
  getAnimationLabel,
  listAvailableAnimations
} from './characters/animationList.js';
import { jumps, getRandomJumpName } from './characters/jumpList.js';
import { ScenarioPlayer } from './characters/ScenarioPlayer.js';
import {
  getCustomAnimation,
  listCustomAnimations,
  loadLoopOverrides,
  saveLoopOverride,
  setCustomAnimationLoop
} from './characters/AnimationLibrary.js';
import {
  MessageType,
  createCharacterChannel,
  post
} from './shared/characterChannel.js';

console.log('[MAIN] Все модули импортированы');


function setStatus(text) {
  console.log(`[STATUS] ${text}`);
}


// ============================================================
// SCENE
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101418);


// ============================================================
// CAMERA
// ============================================================

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  10000
);
camera.position.set(0, 2, 6);
camera.lookAt(0, 1, 0);


// ============================================================
// LIGHTS
// ============================================================

const ambientLight = new THREE.AmbientLight(0xffffff, 3);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 4);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(2048, 2048);
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 40;
directionalLight.shadow.camera.left = -8;
directionalLight.shadow.camera.right = 8;
directionalLight.shadow.camera.top = 8;
directionalLight.shadow.camera.bottom = -8;
directionalLight.shadow.bias = -0.0008;
scene.add(directionalLight);


// ============================================================
// PLATFORM
// ============================================================

const platform = createPlatform();
scene.add(platform);


// ============================================================
// SKYBOX
// ============================================================

const skyboxPromise = loadSkybox(
  scene,
  '/models/enviroment/roblox_skybox.glb'
).catch((error) => {
  console.error('[SKYBOX] Не удалось загрузить окружение', error);
});


// ============================================================
// RENDERER
// ============================================================

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);


// ============================================================
// CONTROLS (для отладки)
// ============================================================

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.5, 0);
controls.update();


// ============================================================
// CHARACTER STATE
// ============================================================

let character = null;
let scenarioPlayer = null;
const characterChannel = createCharacterChannel();

let isJumping = false;

// Плавность
const FADE_IN_ANIM = 0.35;   // вход в разовые
const FADE_IN_JUMP = 0.30;   // вход в прыжок
const FADE_TO_IDLE = 0.45;   // возврат в Idle
const FADE_IDLE_BASE = 0.35;

// После этих анимаций играем прыжок перед Idle
const JUMP_AFTER = new Set([
  'Dance',
  'Waving',
  'Rejected',
  'Sad',
  'VictoryIdle',
  'Neutral'
]);


// ============================================================
// CREATE CHARACTER
// ============================================================

async function createCharacter() {

  console.log('');
  console.log('======================================');
  console.log('[APP] CREATE CHARACTER');
  console.log('======================================');

  setStatus('Загружаем персонажа...');

  await skyboxPromise;

  // ----------------------------------------------------------
  // LOAD MODEL
  // ----------------------------------------------------------
  console.log(`[MODEL] Загрузка ${CHARACTER_MODEL_PATH}`);
  const model = await loadCharacter(CHARACTER_MODEL_PATH);
  console.log('[MODEL] Загружено:', model);

  // ----------------------------------------------------------
  // MESH / BONE + fix materials
  // ----------------------------------------------------------
  let meshCount = 0;
  let boneCount = 0;

  model.traverse((object) => {
    if (object.isMesh) {
      meshCount++;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;

      const mats = Array.isArray(object.material) ? object.material : [object.material];
      for (const m of mats) {
        if (!m) continue;
        m.visible = true;
        m.transparent = false;
        m.opacity = 1;
        m.side = THREE.DoubleSide;
        m.needsUpdate = true;
      }
    }
    if (object.isBone) boneCount++;
  });

  console.log(`[MODEL] Mesh count: ${meshCount}`);
  console.log(`[MODEL] Bone count: ${boneCount}`);

  // ----------------------------------------------------------
  // TRANSFORM: scale → Box3 → position
  // ----------------------------------------------------------

  // 1) scale
  const boxBefore = new THREE.Box3().setFromObject(model);
  const sizeBefore = new THREE.Vector3();
  boxBefore.getSize(sizeBefore);

  const maxSize = Math.max(sizeBefore.x, sizeBefore.y, sizeBefore.z);

  if (maxSize > 0 && isFinite(maxSize)) {
    const s = 3 / maxSize;
    model.scale.set(s, s, s);
    console.log('[MODEL] Auto scale:', s);
  } else {
    console.warn('[MODEL] Не удалось определить размер. maxSize =', maxSize);
  }

  // 2) Box3 после скейла
  model.updateMatrixWorld(true);
  const boxAfter = new THREE.Box3().setFromObject(model);
  const centerAfter = new THREE.Vector3();
  boxAfter.getCenter(centerAfter);

  // 3) position
  model.position.x -= centerAfter.x;
  model.position.z -= centerAfter.z;
  model.position.y -= boxAfter.min.y;
  model.updateMatrixWorld(true);

  // 4) финальный Box3 (для логов)
  const finalBox = new THREE.Box3().setFromObject(model);
  const finalCenter = new THREE.Vector3();
  finalBox.getCenter(finalCenter);
  console.log('[MODEL] Final center:', finalCenter);

  scene.add(model);

  // Камера под модель
  const height = 3;
  camera.position.set(0, height * 0.55, height * 2.5);
  camera.lookAt(0, height * 0.5, 0);
  if (controls) {
    controls.target.set(0, height * 0.5, 0);
    controls.update();
  }

  // ----------------------------------------------------------
  // CharacterController
  // ----------------------------------------------------------
  console.log('[CHARACTER] Создаём CharacterController...');
  character = new CharacterController(model);

  // ----------------------------------------------------------
  // LOAD ANIMATIONS
  // ----------------------------------------------------------
  for (const [name, config] of Object.entries(animations)) {
    try {
      const clip = await loadAnimation(config.path);
      character.addAnimation(name, clip, config.loop);
      console.log(`[ANIMATION] ${name}: загружена (loop=${config.loop})`);
    } catch (error) {
      console.error(`[ANIMATION] ОШИБКА ${name}`, error);
      throw error;
    }
  }

  // ----------------------------------------------------------
  // LOAD JUMPS
  // ----------------------------------------------------------
  console.log('');
  console.log('======================================');
  console.log('[JUMPS] ЗАГРУЖАЕМ ПРЫЖКИ');
  console.log('======================================');

  for (const [name, config] of Object.entries(jumps)) {
    try {
      const clip = await loadAnimation(config.path);
      character.addAnimation(name, clip, false);
      console.log(`[JUMP] ${name} загружен (${clip.duration.toFixed(2)}s)`);
    } catch (err) {
      console.error(`[JUMP] Ошибка загрузки ${name}`, err);
    }
  }

  await loadCustomAnimations();
  applyStoredLoopSettings();

  // ----------------------------------------------------------
  // Jump-chain: разовая → прыжок → Idle
  // ----------------------------------------------------------
  attachJumpChain();

  // ----------------------------------------------------------
  // START
  // ----------------------------------------------------------
  character.idle(FADE_IDLE_BASE);

  scenarioPlayer = new ScenarioPlayer(character, animations);
  scenarioPlayer.onStateChange = broadcastCharacterState;
  character.animationManager.onPlay = broadcastCharacterState;

  post(characterChannel, MessageType.READY);
  broadcastCharacterState();

  setStatus('Готово. Управление: /control.html');
}


// ============================================================
// JUMP CHAIN
// ============================================================

function attachJumpChain() {
  // Твой AnimationManager.onFinished уже подписывает на mixer.finished.
  // Мы добавляем СВОЙ обработчик — он вызовется ПОСЛЕ setupAutoIdle.
  character.onAnimationFinished((event) => {
    const finishedAction = event.action;
    const actions = character.animationManager.actions;

    const finishedName = Object.keys(actions)
      .find(n => actions[n] === finishedAction);

    if (!finishedName) return;

    const isJump = !!jumps[finishedName];

    console.log(`[CHAIN] Finished: ${finishedName} | isJump=${isJump} | isJumping=${isJumping} | autoIdle=${character.animationManager.autoIdleEnabled}`);

    // ---- 1) Закончился прыжок → Idle ----
    if (isJump && isJumping) {
      console.log('[CHAIN] Прыжок завершён → Idle');
      isJumping = false;

      // Включаем autoIdle обратно, чтобы дальше работал стандартный механизм
      character.animationManager.autoIdleEnabled = true;

      // Плавный возврат
      character.idle(FADE_TO_IDLE);
      broadcastCharacterState();
      return;
    }

    // ---- 2) Закончилась разовая анимация → прыжок ----
    if (JUMP_AFTER.has(finishedName) && !isJumping) {
      // setupAutoIdle уже мог выключить/включить Idle,
      // но т.к. autoIdleEnabled=false в момент завершения, он пропустил.
      console.log(`[CHAIN] "${finishedName}" → запускаем прыжок`);
      startRandomJump();
      return;
    }
  });
}

function startRandomJump() {
  if (isJumping) return;

  const jumpNames = Object.keys(jumps);
  if (jumpNames.length === 0) {
    character.idle(FADE_TO_IDLE);
    return;
  }

  isJumping = true;

  // Важно: выключаем autoIdle, чтобы setupAutoIdle не перебил
  character.animationManager.autoIdleEnabled = false;

  const jumpName = getRandomJumpName();
  console.log(`[CHAIN] Играем: ${jumpName}`);

  character.play(jumpName, FADE_IN_JUMP, { once: true });
  broadcastCharacterState();
}


// ============================================================
// KEYBOARD
// ============================================================

window.addEventListener('keydown', (event) => {

  if (!character) return;

  const key = event.key.toLowerCase();
  const animationKeys = new Set(['i', 'w', 'r', 'v', 'j', 'd', 'n', 'escape']);

  if (animationKeys.has(key)) {
    if (scenarioPlayer) scenarioPlayer.stop({ returnToIdle: false });

    if (isJumping) {
      console.log('[CHAIN] Прерван пользователем');
      isJumping = false;
    }

    // Сбрасываем autoIdle, дальше сами решаем
    character.animationManager.autoIdleEnabled = true;
  }

  console.log(`[INPUT] Key: ${key}`);

  if (key === 'i') {
    character.play('Idle', FADE_IN_ANIM);
    setStatus(getAnimationLabel('Idle'));
  }

  if (key === 'w') {
    character.animationManager.autoIdleEnabled = false;   // ждём finish → прыжок
    character.play('Waving', FADE_IN_ANIM);
    setStatus(getAnimationLabel('Waving'));
  }

  if (key === 'r') {
    character.animationManager.autoIdleEnabled = false;
    character.play('Rejected', FADE_IN_ANIM);
    setStatus(getAnimationLabel('Rejected'));
  }

  if (key === 'v') {
    character.animationManager.autoIdleEnabled = false;
    character.play('VictoryIdle', FADE_IN_ANIM);
    setStatus(getAnimationLabel('VictoryIdle'));
  }

  if (key === 'j') {
    character.animationManager.autoIdleEnabled = false;
    character.play('Sad', FADE_IN_ANIM);
    setStatus(getAnimationLabel('Sad'));
  }

  if (key === 'n') {
    character.animationManager.autoIdleEnabled = false;
    character.play('Neutral', FADE_IN_ANIM);
    setStatus(getAnimationLabel('Neutral'));
  }

  if (key === 'd') {
    character.animationManager.autoIdleEnabled = false;
    character.play('Dance', FADE_IN_ANIM);
    setStatus(getAnimationLabel('Dance'));
  }

  if (key === 'escape') {
    isJumping = false;
    character.animationManager.autoIdleEnabled = true;
    character.idle(FADE_IDLE_BASE);
    setStatus(getAnimationLabel('Idle'));
  }
});


// ============================================================
// CLOCK / RENDER LOOP
// ============================================================

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (character) character.update(delta);
  if (controls) controls.update();

  renderer.render(scene, camera);
}

animate();


// ============================================================
// RESIZE
// ============================================================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});


// ============================================================
// CHANNEL STATE / helpers
// ============================================================

function broadcastCharacterState() {
  if (!character) return;

  post(characterChannel, MessageType.STATE, {
    ready: true,
    currentAnimation: character.animationManager.currentAnimation,
    scenario: scenarioPlayer ? scenarioPlayer.getState() : null,
    availableAnimations: listAvailableAnimations()
  });
}

function resolveLoop(name, fallback) {
  const overrides = loadLoopOverrides();
  if (Object.prototype.hasOwnProperty.call(overrides, name)) {
    return Boolean(overrides[name]);
  }
  return Boolean(fallback);
}

function applyStoredLoopSettings() {
  if (!character) return;

  for (const name of Object.keys(character.animationManager.actions)) {
    if (jumps[name]) continue;   // прыжки всегда once
    const fallback = animations[name]?.loop ?? false;
    const loop = resolveLoop(name, fallback);

    if (animations[name]) animations[name].loop = loop;
    character.setLoop(name, loop);
  }
}

async function registerCustomRecord(record) {
  if (!character || !record?.name || !record.buffer) return false;

  const loop = resolveLoop(record.name, record.loop);

  if (character.animationManager.actions[record.name]) {
    animations[record.name] = {
      loop,
      label: record.label ?? record.name,
      custom: true,
      id: record.id
    };
    character.setLoop(record.name, loop);
    return true;
  }

  try {
    const clip = loadAnimationFromBuffer(record.buffer, record.fileName ?? record.name);
    character.addAnimation(record.name, clip, loop);
    animations[record.name] = {
      loop,
      label: record.label ?? record.name,
      custom: true,
      id: record.id
    };
    return true;
  } catch (error) {
    console.error(`[ANIMATION] Не удалось добавить ${record.name}`, error);
    return false;
  }
}

async function loadCustomAnimations() {
  const records = await listCustomAnimations();
  for (const record of records) {
    await registerCustomRecord(record);
  }
}

async function handleSetLoop(name, loop) {
  if (!character || !name || !animations[name]) return;

  const enabled = Boolean(loop);
  animations[name].loop = enabled;
  character.setLoop(name, enabled);
  saveLoopOverride(name, enabled);

  if (animations[name].custom && animations[name].id) {
    await setCustomAnimationLoop(animations[name].id, enabled);
  }

  broadcastCharacterState();
}

async function handleAddAnimation(id) {
  if (!character || !id) return;

  const record = await getCustomAnimation(id);
  if (!record) return;

  await registerCustomRecord(record);
  broadcastCharacterState();
}

async function handleRemoveAnimation(name) {
  if (!character || !name || !animations[name]?.custom) return;

  if (character.animationManager.currentAnimation === name) {
    character.idle(FADE_IDLE_BASE);
  }

  character.removeAnimation(name);
  delete animations[name];
  broadcastCharacterState();
}

function playFromControl(name, loop) {
  if (!character) return;

  if (scenarioPlayer) scenarioPlayer.stop({ returnToIdle: false });

  const isOnce = (typeof loop === 'boolean')
    ? !loop
    : !Boolean(animations[name]?.loop);

  if (animations[name]) animations[name].loop = !isOnce;

  character.setLoop(name, !isOnce);

  // Если разовая из JUMP_AFTER — ждём finish → прыжок
  if (isOnce && JUMP_AFTER.has(name)) {
    character.animationManager.autoIdleEnabled = false;
  } else {
    character.animationManager.autoIdleEnabled = true;
  }

  character.play(name, FADE_IN_ANIM, { once: isOnce });
  setStatus(`${getAnimationLabel(name)}`);
}

characterChannel.addEventListener('message', (event) => {
  const data = event.data ?? {};

  if (data.type === MessageType.HELLO || data.type === MessageType.PING) {
    post(characterChannel, MessageType.PONG);
    broadcastCharacterState();
    return;
  }

  if (!character) return;

  if (data.type === MessageType.PLAY && data.name) {
    playFromControl(data.name, data.loop);
    return;
  }

  if (data.type === MessageType.IDLE) {
    isJumping = false;
    character.animationManager.autoIdleEnabled = true;

    if (scenarioPlayer) scenarioPlayer.stop();
    else character.idle(FADE_IDLE_BASE);

    setStatus(getAnimationLabel('Idle'));
    return;
  }

  if (data.type === MessageType.PLAY_SCENARIO && data.scenario) {
    scenarioPlayer?.play(data.scenario);
    setStatus(`Сценарий: ${data.scenario.name || 'без названия'}`);
    return;
  }

  if (data.type === MessageType.SET_LOOP && data.name) {
    handleSetLoop(data.name, data.loop);
    return;
  }

  if (data.type === MessageType.ADD_ANIMATION && data.id) {
    handleAddAnimation(data.id);
    return;
  }

  if (data.type === MessageType.REMOVE_ANIMATION && data.name) {
    handleRemoveAnimation(data.name);
    return;
  }

  if (data.type === MessageType.STOP_SCENARIO) {
    scenarioPlayer?.stop();
    setStatus(getAnimationLabel('Idle'));
  }
});


// ============================================================
// START
// ============================================================

console.log('[APP] Запускаем createCharacter()');

createCharacter().catch((error) => {
  console.error('[APP] КРИТИЧЕСКАЯ ОШИБКА', error);
  setStatus('ОШИБКА ЗАПУСКА\nОткрой Console (F12)');
});