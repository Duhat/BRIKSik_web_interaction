// characters/jumpList.js

console.log('[MODULE] jumpList.js загружен');

// ------------------------------------------------------------
// СПИСОК ПРЫЖКОВ
// Замени имена файлов на реальные из твоей папки jumps/
// ------------------------------------------------------------

export const jumps = {
  Jump1: { path: 'models/briksik/briksisk_animations/jumps/Jump1.fbx', loop: false },
  Jump2: { path: 'models/briksik/briksisk_animations/jumps/Jump2.fbx', loop: false },
  Jump3: { path: 'models/briksik/briksisk_animations/jumps/Jump3.fbx', loop: false },
};

// ------------------------------------------------------------
// ВЫБОР СЛУЧАЙНОГО ПРЫЖКА
// ------------------------------------------------------------

export function getRandomJumpName() {
  const names = Object.keys(jumps);
  if (names.length === 0) return null;
  return names[Math.floor(Math.random() * names.length)];
}