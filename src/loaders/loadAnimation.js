console.log('[MODULE] loadAnimation.js загружен');

import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

console.log('[MODULE] FBXLoader импортирован для анимаций');

const loader = new FBXLoader();

console.log('[MODULE] loadAnimation.js готов');

const MIN_MATCHING_TRACKS = 12;

function collectNodeNames(model) {
  const names = new Set();

  model.traverse((node) => {
    if (node.name) {
      names.add(node.name);
    }
  });

  return names;
}

function findHips(model) {
  let hips = null;

  model.traverse((node) => {
    if (hips || !node.isBone) {
      return;
    }

    if (/hips$/i.test(node.name)) {
      hips = node;
    }
  });

  return hips;
}

export function clipFitsModel(clip, model) {
  if (!clip?.tracks?.length) {
    return false;
  }

  const names = collectNodeNames(model);
  const matching = clip.tracks.filter((track) => names.has(track.name.split('.')[0]));

  return matching.length >= MIN_MATCHING_TRACKS;
}

export function retargetClipToModel(clip, model) {
  const names = collectNodeNames(model);
  clip.tracks = clip.tracks.filter((track) => names.has(track.name.split('.')[0]));

  const hips = findHips(model);
  const hipsTrack = clip.tracks.find((track) => /\.position$/i.test(track.name) && /hips/i.test(track.name));

  if (!hips || !hipsTrack || hipsTrack.values.length < 3) {
    return clip;
  }

  const rest = hips.position;
  const firstX = hipsTrack.values[0];
  const firstY = hipsTrack.values[1];
  const firstZ = hipsTrack.values[2];
  const unitScale = Math.abs(firstY) > 2 ? 0.01 : 1;

  for (let i = 0; i < hipsTrack.values.length; i += 3) {
    hipsTrack.values[i] = rest.x + (hipsTrack.values[i] - firstX) * unitScale;
    hipsTrack.values[i + 1] = rest.y + (hipsTrack.values[i + 1] - firstY) * unitScale;
    hipsTrack.values[i + 2] = rest.z + (hipsTrack.values[i + 2] - firstZ) * unitScale;
  }

  return clip;
}

export function prepareClipForModel(clip, model) {
  if (!clipFitsModel(clip, model)) {
    return null;
  }

  return retargetClipToModel(clip, model);
}

export function loadAnimation(path) {
  console.log(`[LOAD ANIMATION] Начинаем загрузку: ${path}`);

  return new Promise((resolve, reject) => {
    loader.load(
      encodeURI(path),
      (fbx) => {
        console.log(`[LOAD ANIMATION] FBX загружен: ${path}`);

        if (!fbx.animations || fbx.animations.length === 0) {
          console.error(`[LOAD ANIMATION] В файле нет анимации: ${path}`);
          reject(new Error(`В файле ${path} не найдена анимация`));
          return;
        }

        console.log(`[LOAD ANIMATION] Найдено анимаций: ${fbx.animations.length}`);
        console.log(`[LOAD ANIMATION] Используем clip: ${fbx.animations[0].name}`);

        resolve(fbx.animations[0]);
      },
      (progress) => {
        if (progress.total > 0) {
          const percent = (progress.loaded / progress.total) * 100;
          console.log(`[LOAD ANIMATION] ${percent.toFixed(1)}%`);
        }
      },
      (error) => {
        console.error(`[LOAD ANIMATION] ОШИБКА: ${path}`, error);
        reject(error);
      }
    );
  });
}

export function loadAnimationFromBuffer(buffer, fileName = 'upload.fbx') {
  console.log(`[LOAD ANIMATION] Разбираем FBX из памяти: ${fileName}`);

  const data =
    buffer instanceof ArrayBuffer
      ? buffer
      : ArrayBuffer.isView(buffer)
        ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        : buffer;

  const fbx = loader.parse(data, '');

  if (!fbx.animations || fbx.animations.length === 0) {
    throw new Error(`В файле ${fileName} не найдена анимация`);
  }

  console.log(
    `[LOAD ANIMATION] Найдено анимаций: ${fbx.animations.length}, clip: ${fbx.animations[0].name}`
  );

  return fbx.animations[0];
}
