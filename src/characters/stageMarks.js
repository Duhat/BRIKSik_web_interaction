export const STAGE_MARKS = {
  center: { x: 0, z: 0 },
  offLeft: { x: -8.4, z: 0 },
  offRight: { x: 8.4, z: 0 }
};

const RUN_RE = /run|jog|sprint|dash|бег/i;
const LOOK_RE = /look|search|осмотр|озира/i;

export function getStageMark(name) {
  if (!name) {
    return { ...STAGE_MARKS.center };
  }

  if (typeof name === 'object') {
    return { x: Number(name.x) || 0, z: Number(name.z) || 0 };
  }

  return { ...(STAGE_MARKS[name] ?? STAGE_MARKS.center) };
}

export function findNamedAnimation(animations, pattern) {
  return Object.entries(animations).find(([name, config]) => {
    if (name.startsWith('Jump')) {
      return false;
    }

    return pattern.test(name) || pattern.test(config?.label ?? '');
  })?.[0] ?? null;
}

export function findRunAnimation(animations) {
  return findNamedAnimation(animations, RUN_RE);
}

export function findLookAnimation(animations) {
  return findNamedAnimation(animations, LOOK_RE);
}

export function resolveAnimationAlias(name, animations) {
  if (name === '$run') {
    return findRunAnimation(animations);
  }

  if (name === '$look') {
    return findLookAnimation(animations) ?? (animations.Neutral ? 'Neutral' : 'Idle');
  }

  return name;
}

export function buildEntranceScenario() {
  return {
    id: 'preset-entrance',
    name: 'Вход',
    idleBetween: false,
    stay: true,
    preset: 'entrance',
    steps: [
      { type: 'enter', from: 'offLeft', to: 'center', animation: '$run' },
      { type: 'look', animation: '$look', durationMs: 3200 },
      { type: 'animation', animation: 'Waving' },
      { type: 'stance', animation: 'Neutral' }
    ]
  };
}

export function buildExitScenario() {
  return {
    id: 'preset-exit',
    name: 'Уход',
    idleBetween: false,
    stay: true,
    preset: 'exit',
    steps: [
      { type: 'exit', to: 'offRight', animation: '$run' }
    ]
  };
}

export function isRunLikeFile(fileName = '', label = '') {
  return RUN_RE.test(fileName) || RUN_RE.test(label);
}
