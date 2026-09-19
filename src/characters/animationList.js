console.log('[MODULE] animationList.js загружен');

const CHARACTER_DIR = '/models/briksik/briksisk_animations';

export const CHARACTER_MODEL_PATH = `${CHARACTER_DIR}/Defoult.fbx`;

export const animations = {
  Idle: {
    path: `${CHARACTER_DIR}/Breathing Idle (1).fbx`,
    loop: true,
    label: 'Покой'
  },

  Neutral: {
    path: `${CHARACTER_DIR}/Neutral Idle.fbx`,
    loop: true,
    label: 'Стойка'
  },

  Waving: {
    path: `${CHARACTER_DIR}/Waving Gesture.fbx`,
    loop: false,
    label: 'Приветствие'
  },

  Rejected: {
    path: `${CHARACTER_DIR}/Rejected.fbx`,
    loop: false,
    label: 'Отказ'
  },

  VictoryIdle: {
    path: `${CHARACTER_DIR}/Happy Idle.fbx`,
    loop: false,
    label: 'Радость'
  },

  Sad: {
    path: `${CHARACTER_DIR}/Sad Idle (1).fbx`,
    loop: false,
    label: 'Грусть'
  },

  Dance: {
    path: `${CHARACTER_DIR}/Wave Hip Hop Dance (2).fbx`,
    loop: false,
    label: 'Танец'
  }
};

export const animationNames = Object.keys(animations);

export function getAnimationNames() {
  return Object.keys(animations);
}

export function getAnimationLabel(name) {
  return animations[name]?.label ?? name;
}

export function listAvailableAnimations() {
  return Object.entries(animations).map(([name, config]) => ({
    name,
    label: config.label ?? name,
    loop: Boolean(config.loop),
    custom: Boolean(config.custom),
    id: config.id ?? null
  }));
}

console.log(
  '[MODULE] Доступные анимации:',
  animationNames
);
