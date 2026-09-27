export const DEFAULT_FLAG = Object.freeze({ visible: true, width: 5, x: 0, y: 2.5, z: -1.8, wave: true });

export function normalizeFlagSettings(value = {}) {
  const number = (key, min, max) => {
    const n = Number(value[key] ?? DEFAULT_FLAG[key]);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : DEFAULT_FLAG[key];
  };
  return {
    visible: value.visible !== false, wave: value.wave !== false,
    width: number('width', 0.5, 30), x: number('x', -5, 5),
    y: number('y', 0.5, 6), z: number('z', -6, -0.6)
  };
}

// Separate database: no migration or locking of the existing animation library.
function requestFlag(mode, record) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('briksik-stage', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('settings');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('settings', mode);
      const store = tx.objectStore('settings');
      const request = mode === 'readonly' ? store.get('flag') : store.put(record, 'flag');
      tx.oncomplete = () => { db.close(); resolve(mode === 'readonly' ? request.result : record); };
      tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Не удалось сохранить флаг')); };
      tx.onerror = () => {}; // onabort reports the final transaction failure.
    };
  });
}

export const loadFlag = () => requestFlag('readonly');
export const saveFlag = record => requestFlag('readwrite', {
  ...record, settings: normalizeFlagSettings(record.settings)
});

export async function decodeFlag(blob) {
  if (!(blob instanceof Blob) || !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) {
    throw new Error('Выберите изображение PNG, JPG или WebP.');
  }
  if (blob.size > 10 * 1024 * 1024) throw new Error('Размер файла должен быть не больше 10 МБ.');
  let bitmap;
  try { bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none' }); }
  catch { throw new Error('Не удалось прочитать изображение. Выберите другой файл.'); }
  if (bitmap.width > 4096 || bitmap.height > 4096) {
    bitmap.close();
    throw new Error('Уменьшите изображение до 4096 пикселей по каждой стороне.');
  }
  return bitmap;
}
