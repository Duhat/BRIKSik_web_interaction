const DB_NAME = 'briksik-display';
const DB_VERSION = 1;
const STORE = 'customAnimations';

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeRequest(mode, handler) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const request = handler(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export function listCustomAnimations() {
  return storeRequest('readonly', (store) => store.getAll()).then((records) =>
    (records ?? []).sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
  );
}

export function getCustomAnimation(id) {
  return storeRequest('readonly', (store) => store.get(id));
}

export function saveCustomAnimation(record) {
  return storeRequest('readwrite', (store) => store.put(record)).then(() => record);
}

export function deleteCustomAnimation(id) {
  return storeRequest('readwrite', (store) => store.delete(id));
}

export function makeCustomAnimationName(label, existingNames) {
  const slug =
    String(label)
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'Anim';

  const taken = new Set(existingNames);
  let name = `User_${slug}`;
  let index = 2;

  while (taken.has(name)) {
    name = `User_${slug}_${index}`;
    index += 1;
  }

  return name;
}

export function toAnimationCatalogEntry(record, custom = true) {
  return {
    name: record.name,
    label: record.label ?? record.name,
    loop: Boolean(record.loop),
    custom,
    id: record.id ?? null
  };
}

const LOOP_OVERRIDES_KEY = 'briksik-animation-loop';

export function loadLoopOverrides() {
  try {
    const raw = localStorage.getItem(LOOP_OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLoopOverride(name, loop) {
  const overrides = loadLoopOverrides();
  overrides[name] = Boolean(loop);
  localStorage.setItem(LOOP_OVERRIDES_KEY, JSON.stringify(overrides));
}

export function applyLoopOverrides(catalog) {
  const overrides = loadLoopOverrides();

  return catalog.map((item) =>
    Object.prototype.hasOwnProperty.call(overrides, item.name)
      ? { ...item, loop: Boolean(overrides[item.name]) }
      : item
  );
}

export async function setCustomAnimationLoop(id, loop) {
  const record = await getCustomAnimation(id);

  if (!record) {
    return null;
  }

  record.loop = Boolean(loop);
  return saveCustomAnimation(record);
}
