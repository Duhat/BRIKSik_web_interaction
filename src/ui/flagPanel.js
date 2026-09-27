import { DEFAULT_FLAG, decodeFlag, loadFlag, saveFlag } from '../shared/flagStore.js';
import { MessageType, post } from '../shared/characterChannel.js';

export function mountFlagPanel(container, channel) {
  container.innerHTML = `
    <h2>Флаг за Барсиком</h2>
    <p class="hint">Загрузите флаг спортсмена или баннер соревнования. Сначала проверьте предпросмотр, затем нажмите «На экран».</p>
    <label class="field">Изображение флага (PNG, JPG, WebP)
      <input id="flag-file" type="file" accept="image/png,image/jpeg,image/webp" />
    </label>
    <img id="flag-preview" class="flag-preview" alt="Предпросмотр выбранного флага" hidden />
    <p id="flag-name" class="hint">Флаг ещё не загружен</p>
    <div class="flag-settings">
      <label>Ширина полотна (0,5–30)<input id="flag-width" type="number"  step="0.1" /></label>
      <label>Высота центра<input id="flag-y" type="number" m step="0.1" /></label>
      <label>Смещение влево / вправо<input id="flag-x" type="number"  step="0.1" /></label>
      <label>Глубина за персонажем<input id="flag-z" type="number"  step="0.1" /></label>
    </div>
    <label class="row"><input id="flag-wave" type="checkbox" /> Колыхание полотна</label>
    <div class="stage-actions">
      <button id="flag-show" class="primary" type="button">На экран</button>
      <button id="flag-hide" class="secondary" type="button">Скрыть флаг</button>
    </div>
    <p id="flag-status" class="current" role="status" aria-live="polite"></p>
    <p class="hint">Пропорции изображения сохраняются. Флаг и настройки хранятся в этом браузере. Панель и дисплей открывайте по одному адресу в одном браузере.</p>`;
  const el = id => container.querySelector(`#flag-${id}`);
  let draft = null;
  let live = null;
  let previewUrl = null;
  let selection = 0;
  let pendingId = null;
  let ackTimer = null;
  const status = text => { el('status').textContent = text; };
  const busy = value => {
    container.querySelectorAll('button, input').forEach(input => { input.disabled = value; });
  }; 
  function preview(record) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = record?.blob ? URL.createObjectURL(record.blob) : null;
    el('preview').hidden = !previewUrl;
    if (previewUrl) el('preview').src = previewUrl;
    else el('preview').removeAttribute('src');
    el('name').textContent = record?.name ?? 'Флаг ещё не загружен';
  }
  function fill(settings = DEFAULT_FLAG) {
    for (const key of ['width', 'x', 'y', 'z']) el(key).value = settings[key];
    el('wave').checked = settings.wave;
  }
  function settings() {
    const result = { visible: true, wave: el('wave').checked };
    for (const key of ['width', 'x', 'y', 'z']) {
      if (!el(key).value || !el(key).reportValidity()) throw new Error('Проверьте размер и положение полотна.');
      result[key] = Number(el(key).value);
    }
    return result;
  }
  async function publish(visible) {
    try {
      // Hiding must never publish the operator's unreviewed draft.
      const source = visible ? draft : live;
      if (visible && !source?.blob) throw new Error('Сначала выберите изображение флага.');
      const record = { ...source, settings: visible ? settings() : { ...(source?.settings ?? DEFAULT_FLAG), visible: false } };
      busy(true);
      live = await saveFlag(record);
      pendingId = crypto.randomUUID();
      clearTimeout(ackTimer);
      post(channel, MessageType.FLAG_CHANGED, { requestId: pendingId });
      status('Сохранено. Ожидаем подтверждение дисплея…');
      ackTimer = setTimeout(() => status('Сохранено. Дисплей не подтвердил изменение; при открытии он загрузит сохранённый флаг.'), 4000);
    } catch (error) { status(error.message); }
    finally { busy(false); }
  }
  channel.addEventListener('message', event => {
    if (event.data?.type !== MessageType.FLAG_RESULT || event.data.requestId !== pendingId) return;
    clearTimeout(ackTimer);
    status(event.data.error ? `Ошибка дисплея: ${event.data.error}` : live?.settings.visible ? 'Флаг показан на дисплее.' : 'Флаг скрыт на дисплее.');
  });
  el('file').addEventListener('change', async () => {
    const file = el('file').files[0];
    if (!file) return;
    const id = ++selection;
    busy(true);
    try {
      const bitmap = await decodeFlag(file);
      bitmap.close();
      if (id !== selection) return;
      draft = { blob: file, name: file.name };
      preview(draft);
      status('Предпросмотр готов. Нажмите «На экран», чтобы заменить флаг за персонажем.');
    } catch (error) { status(error.message); }
    finally { busy(false); }
  });
  el('show').addEventListener('click', () => publish(true));
  el('hide').addEventListener('click', () => publish(false));
  fill();
  busy(true);
  loadFlag().then(record => {
    live = draft = record ?? null;
    fill(record?.settings ?? DEFAULT_FLAG);
    preview(record);
    status(record?.blob ? 'Сохранённый флаг загружен.' : 'Выберите флаг спортсмена или баннер соревнования.');
  }).catch(error => status(`Не удалось прочитать сохранённый флаг: ${error.message}`))
    .finally(() => busy(false));
}
