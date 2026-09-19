import './ui/control.css';
import { loadAnimationFromBuffer } from './loaders/loadAnimation.js';
import { animations, getAnimationLabel } from './characters/animationList.js';
import {
  deleteCustomAnimation,
  listCustomAnimations,
  makeCustomAnimationName,
  saveCustomAnimation,
  saveLoopOverride,
  setCustomAnimationLoop,
  applyLoopOverrides,
  toAnimationCatalogEntry
} from './characters/AnimationLibrary.js';
import {
  createScenarioId,
  deleteScenario,
  loadScenarios,
  upsertScenario
} from './characters/ScenarioStore.js';
import {
  MessageType,
  createCharacterChannel,
  post
} from './shared/characterChannel.js';

const channel = createCharacterChannel();

const state = {
  connected: false,
  currentAnimation: '—',
  scenario: null,
  scenarios: loadScenarios(),
  draft: emptyDraft(),
  catalog: builtinCatalog(),
  uploadBusy: false,
  uploadMessage: '',
  pendingFile: null
};

let lastPong = 0;

function builtinCatalog() {
  return Object.entries(animations)
    .filter(([, config]) => !config.custom)
    .map(([name, config]) => ({
      name,
      label: config.label ?? name,
      loop: Boolean(config.loop),
      custom: false,
      id: null
    }));
}

function catalogNames() {
  return state.catalog.map((item) => item.name);
}

function catalogLabel(name) {
  return state.catalog.find((item) => item.name === name)?.label ?? getAnimationLabel(name);
}

function emptyDraft(existing = null) {
  return {
    id: existing?.id ?? createScenarioId(),
    name: existing?.name ?? '',
    idleBetween: existing?.idleBetween !== false,
    steps: existing?.steps?.map((step) => ({ ...step })) ?? []
  };
}

function sendPlay(name) {
  const item = state.catalog.find((row) => row.name === name);
  post(channel, MessageType.PLAY, {
    name,
    loop: Boolean(item?.loop)
  });
}

function sendIdle() {
  post(channel, MessageType.IDLE);
}

function sendScenario(scenario) {
  post(channel, MessageType.PLAY_SCENARIO, { scenario });
}

function sendStop() {
  post(channel, MessageType.STOP_SCENARIO);
}

function renderApp() {
  document.body.innerHTML = `
    <div class="page">
      <div class="header">
        <div>
          <h1>Управление персонажем</h1>
          <p class="subtitle">Кнопки анимаций и сценарии отправляются на экран с моделью.</p>
          <a class="link" href="/" target="_blank" rel="noreferrer">Открыть экран персонажа</a>
        </div>
        <div id="connection-status" class="status">
          <span class="status-dot"></span>
          <span id="connection-text">Подключение...</span>
        </div>
      </div>
      <div class="grid">
        <section class="panel">
          <h2>Анимации</h2>
          <div class="upload" id="upload-zone">
            <p class="hint">Загрузите FBX — после добавления появится новая кнопка.</p>
            <div class="field">
              <label for="anim-label">Название кнопки</label>
              <input id="anim-label" placeholder="Например: Бросок" />
            </div>
            <label class="row">
              <input id="anim-loop" type="checkbox" />
              Зациклить анимацию
            </label>
            <div class="row">
              <input id="anim-file" type="file" accept=".fbx" />
              <button class="primary" type="button" id="add-animation">Добавить FBX</button>
            </div>
            <p class="hint" id="upload-file-name"></p>
            <p class="current" id="upload-message"></p>
          </div>
          <p class="hint">Цикл — повторять. «1 раз» — сыграть до конца и вернуться в покой. Режим можно менять у каждой кнопки.</p>
          <div class="buttons" id="animation-buttons"></div>
          <p class="current" id="scenario-status">Сценарий не запущен</p>
          <div class="row">
            <button class="secondary" type="button" id="idle-btn">В покой</button>
            <button class="danger" type="button" id="stop-btn">Стоп сценария</button>
          </div>
        </section>
        <section class="panel">
          <h2>Редактор сценария</h2>
          <div class="field">
            <label for="scenario-name">Название</label>
            <input id="scenario-name" placeholder="Приветствие и танец" />
          </div>
          <label class="row">
            <input id="idle-between" type="checkbox" checked />
            Возвращаться в покой между шагами
          </label>
          <div class="steps" id="steps"></div>
          <div class="row">
            <button class="secondary" type="button" id="add-step">Добавить шаг</button>
            <button class="primary" type="button" id="save-scenario">Сохранить сценарий</button>
            <button type="button" id="clear-scenario">Очистить</button>
          </div>
        </section>
        <section class="panel">
          <h2>Сохранённые сценарии</h2>
          <div class="scenario-list" id="scenario-list"></div>
        </section>
      </div>
    </div>
  `;

  document.getElementById('idle-btn').addEventListener('click', sendIdle);
  document.getElementById('stop-btn').addEventListener('click', sendStop);
  document.getElementById('add-step').addEventListener('click', () => {
    syncDraftFromForm();
    state.draft.steps.push({
      animation: catalogNames().find((name) => name !== 'Idle') ?? catalogNames()[0],
      delayMs: 400,
      durationMs: 2000
    });
    renderSteps();
  });
  document.getElementById('save-scenario').addEventListener('click', saveDraft);
  document.getElementById('clear-scenario').addEventListener('click', () => {
    state.draft = emptyDraft();
    fillEditor();
    renderSteps();
  });
  document.getElementById('add-animation').addEventListener('click', addUploadedAnimation);
  document.getElementById('anim-file').addEventListener('change', (event) => {
    const file = event.target.files?.[0] ?? null;
    setPendingFile(file);
  });

  bindUploadZone(document.getElementById('upload-zone'));

  renderAnimationButtons();
  fillEditor();
  renderSteps();
  renderScenarioList();
  updateStatus();
  updateUploadStatus();
}

function bindUploadZone(zone) {
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('dragover');
    const file = [...(event.dataTransfer?.files ?? [])].find((item) =>
      item.name.toLowerCase().endsWith('.fbx')
    );
    if (file) {
      setPendingFile(file);
    } else {
      state.uploadMessage = 'Нужен файл в формате FBX.';
      updateUploadStatus();
    }
  });
}

function setPendingFile(file) {
  state.pendingFile = file;
  const name = document.getElementById('upload-file-name');
  if (name) {
    name.textContent = file ? `Файл: ${file.name}` : '';
  }

  const labelInput = document.getElementById('anim-label');
  if (file && labelInput && !labelInput.value.trim()) {
    labelInput.value = file.name.replace(/\.fbx$/i, '');
  }
}

function renderAnimationButtons() {
  const container = document.getElementById('animation-buttons');
  container.innerHTML = '';

  for (const item of state.catalog) {
    const chip = document.createElement('div');
    chip.className = item.custom ? 'anim-chip custom' : 'anim-chip';

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.animation = item.name;
    button.textContent = item.label;
    button.addEventListener('click', () => sendPlay(item.name));

    const actions = document.createElement('div');
    actions.className = 'anim-chip-actions';

    const loopToggle = document.createElement('button');
    loopToggle.type = 'button';
    loopToggle.className = item.loop ? 'loop-toggle active' : 'loop-toggle';
    loopToggle.textContent = item.loop ? 'Цикл' : '1 раз';
    loopToggle.title = item.loop
      ? 'Сейчас зациклена. Нажмите, чтобы сыграть один раз.'
      : 'Сейчас один раз. Нажмите, чтобы зациклить.';
    loopToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleLoop(item);
    });
    actions.append(loopToggle);

    if (item.custom) {
      const remove = document.createElement('button');
      remove.className = 'danger icon';
      remove.type = 'button';
      remove.title = 'Удалить анимацию';
      remove.textContent = '×';
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        removeUploadedAnimation(item);
      });
      actions.append(remove);
    }

    chip.append(button, actions);
    container.append(chip);
  }
}

async function toggleLoop(item) {
  const name = item.name;
  const entry = state.catalog.find((row) => row.name === name);

  if (!entry) {
    return;
  }

  const loop = !entry.loop;
  entry.loop = loop;
  saveLoopOverride(name, loop);
  post(channel, MessageType.SET_LOOP, { name, loop });
  renderAnimationButtons();
  renderSteps();
  updateStatus();

  if (entry.custom && entry.id) {
    await setCustomAnimationLoop(entry.id, loop);
  }
}

function fillEditor() {
  document.getElementById('scenario-name').value = state.draft.name;
  document.getElementById('idle-between').checked = state.draft.idleBetween;
}

function syncDraftFromForm() {
  state.draft.name = document.getElementById('scenario-name').value;
  state.draft.idleBetween = document.getElementById('idle-between').checked;
}

function renderSteps() {
  const container = document.getElementById('steps');
  container.innerHTML = '';
  const names = catalogNames();

  state.draft.steps.forEach((step, index) => {
    const row = document.createElement('div');
    row.className = 'step';

    const number = document.createElement('span');
    number.textContent = String(index + 1);

    const select = document.createElement('select');
    for (const item of state.catalog) {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.label;
      option.selected = item.name === step.animation;
      select.append(option);
    }

    if (step.animation && !names.includes(step.animation)) {
      const option = document.createElement('option');
      option.value = step.animation;
      option.textContent = `${step.animation} (нет файла)`;
      option.selected = true;
      select.prepend(option);
    }

    select.addEventListener('change', () => {
      step.animation = select.value;
      renderSteps();
    });

    const config = state.catalog.find((item) => item.name === step.animation);
    let durationControl;
    if (config?.loop) {
      durationControl = document.createElement('input');
      durationControl.type = 'number';
      durationControl.min = '200';
      durationControl.step = '100';
      durationControl.value = String(step.durationMs ?? 2000);
      durationControl.title = 'Длительность loop-анимации, мс';
      durationControl.addEventListener('input', () => {
        step.durationMs = Number(durationControl.value);
      });
    } else {
      durationControl = document.createElement('span');
      durationControl.className = 'hint';
      durationControl.textContent = 'до конца';
    }

    const delay = document.createElement('input');
    delay.type = 'number';
    delay.min = '0';
    delay.step = '100';
    delay.value = String(step.delayMs ?? 0);
    delay.title = 'Пауза после шага, мс';
    delay.addEventListener('input', () => {
      step.delayMs = Number(delay.value);
    });

    const remove = document.createElement('button');
    remove.className = 'danger';
    remove.type = 'button';
    remove.textContent = 'Удалить';
    remove.addEventListener('click', () => {
      state.draft.steps.splice(index, 1);
      renderSteps();
    });

    row.append(number, select, durationControl, delay, remove);
    container.append(row);
  });
}

function renderScenarioList() {
  const container = document.getElementById('scenario-list');
  container.innerHTML = '';

  if (state.scenarios.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'Пока нет сохранённых сценариев.';
    container.append(empty);
    return;
  }

  for (const scenario of state.scenarios) {
    const item = document.createElement('div');
    item.className = 'scenario-item';

    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = scenario.name || 'Без названия';
    const meta = document.createElement('div');
    meta.className = 'hint';
    meta.textContent = `${scenario.steps.length} шаг(ов)`;
    info.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'row';

    const play = document.createElement('button');
    play.className = 'primary';
    play.type = 'button';
    play.textContent = 'Играть';
    play.addEventListener('click', () => sendScenario(scenario));

    const edit = document.createElement('button');
    edit.className = 'secondary';
    edit.type = 'button';
    edit.textContent = 'Изменить';
    edit.addEventListener('click', () => {
      state.draft = emptyDraft(scenario);
      fillEditor();
      renderSteps();
    });

    const remove = document.createElement('button');
    remove.className = 'danger';
    remove.type = 'button';
    remove.textContent = 'Удалить';
    remove.addEventListener('click', () => {
      state.scenarios = deleteScenario(scenario.id);
      if (state.draft.id === scenario.id) {
        state.draft = emptyDraft();
        fillEditor();
        renderSteps();
      }
      renderScenarioList();
    });

    actions.append(play, edit, remove);
    item.append(info, actions);
    container.append(item);
  }
}

function saveDraft() {
  syncDraftFromForm();

  if (!state.draft.name.trim()) {
    state.draft.name = 'Сценарий без названия';
    document.getElementById('scenario-name').value = state.draft.name;
  }

  if (state.draft.steps.length === 0) {
    window.alert('Добавьте хотя бы один шаг.');
    return;
  }

  state.scenarios = upsertScenario({
    ...state.draft,
    name: state.draft.name.trim()
  });

  renderScenarioList();
}

function updateUploadStatus() {
  const message = document.getElementById('upload-message');
  const addButton = document.getElementById('add-animation');
  if (message) {
    message.textContent = state.uploadMessage;
  }
  if (addButton) {
    addButton.disabled = state.uploadBusy;
    addButton.textContent = state.uploadBusy ? 'Добавляем...' : 'Добавить FBX';
  }
}

async function addUploadedAnimation() {
  if (state.uploadBusy) {
    return;
  }

  const file = state.pendingFile ?? document.getElementById('anim-file').files?.[0];
  const labelInput = document.getElementById('anim-label');
  const loopInput = document.getElementById('anim-loop');

  if (!file) {
    state.uploadMessage = 'Выберите FBX-файл.';
    updateUploadStatus();
    return;
  }

  if (!file.name.toLowerCase().endsWith('.fbx')) {
    state.uploadMessage = 'Поддерживается только формат FBX.';
    updateUploadStatus();
    return;
  }

  const label = labelInput.value.trim() || file.name.replace(/\.fbx$/i, '');
  const name = makeCustomAnimationName(label, catalogNames());

  state.uploadBusy = true;
  state.uploadMessage = 'Читаем файл...';
  updateUploadStatus();

  try {
    const buffer = await file.arrayBuffer();
    loadAnimationFromBuffer(buffer, file.name);

    const record = await saveCustomAnimation({
      id: crypto.randomUUID(),
      name,
      label,
      loop: Boolean(loopInput.checked),
      fileName: file.name,
      buffer,
      createdAt: Date.now()
    });

    state.catalog = [...state.catalog, toAnimationCatalogEntry(record)];
    saveLoopOverride(record.name, record.loop);
    post(channel, MessageType.ADD_ANIMATION, { id: record.id, name: record.name });

    state.pendingFile = null;
    document.getElementById('anim-file').value = '';
    labelInput.value = '';
    loopInput.checked = false;
    document.getElementById('upload-file-name').textContent = '';
    state.uploadMessage = `Добавлено: ${label}`;

    renderAnimationButtons();
    renderSteps();
    updateStatus();
  } catch (error) {
    console.error(error);
    state.uploadMessage = 'Не удалось добавить анимацию. Проверьте, что в FBX есть клип.';
  } finally {
    state.uploadBusy = false;
    updateUploadStatus();
  }
}

async function removeUploadedAnimation(item) {
  if (!item?.custom) {
    return;
  }

  if (item.id) {
    await deleteCustomAnimation(item.id);
  }

  state.catalog = state.catalog.filter((entry) => entry.name !== item.name);
  post(channel, MessageType.REMOVE_ANIMATION, { name: item.name, id: item.id });

  state.draft.steps = state.draft.steps.filter((step) => step.animation !== item.name);
  renderAnimationButtons();
  renderSteps();
  updateStatus();
}

function updateStatus() {
  const status = document.getElementById('connection-status');
  const text = document.getElementById('connection-text');
  const scenarioStatus = document.getElementById('scenario-status');

  if (!status || !text || !scenarioStatus) {
    return;
  }

  status.className = state.connected ? 'status online' : 'status';
  text.textContent = state.connected
    ? `Дисплей на связи · сейчас: ${catalogLabel(state.currentAnimation)}`
    : 'Дисплей не найден. Откройте страницу персонажа в другой вкладке.';

  scenarioStatus.textContent = state.scenario?.running
    ? `Сценарий: шаг ${state.scenario.index + 1} из ${state.scenario.total}`
    : 'Сценарий не запущен';

  for (const button of document.querySelectorAll('#animation-buttons button[data-animation]')) {
    button.classList.toggle('active', button.dataset.animation === state.currentAnimation);
  }
}

function catalogSignature(catalog) {
  return catalog
    .map((item) => `${item.name}:${item.label}:${item.loop ? 1 : 0}:${item.custom ? 1 : 0}:${item.id ?? ''}`)
    .join('|');
}

function applyRemoteCatalog(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return;
  }

  const remoteNames = new Set(list.map((item) => item.name));
  const pendingCustom = state.catalog.filter(
    (item) => item.custom && item.id && !remoteNames.has(item.name)
  );

  const localIds = new Map(
    state.catalog.filter((item) => item.id).map((item) => [item.name, item.id])
  );

  const nextCatalog = applyLoopOverrides([
    ...list.map((item) => ({
      name: item.name,
      label: item.label ?? item.name,
      loop: Boolean(item.loop),
      custom: Boolean(item.custom),
      id: item.id ?? localIds.get(item.name) ?? null
    })),
    ...pendingCustom
  ]);

  if (catalogSignature(nextCatalog) === catalogSignature(state.catalog)) {
    return;
  }

  state.catalog = nextCatalog;
  renderAnimationButtons();
  renderSteps();
}

channel.addEventListener('message', (event) => {
  const data = event.data ?? {};

  if (
    data.type === MessageType.PONG ||
    data.type === MessageType.READY ||
    data.type === MessageType.STATE
  ) {
    lastPong = Date.now();
    state.connected = true;
  }

  if (data.type === MessageType.STATE) {
    state.currentAnimation = data.currentAnimation ?? '—';
    state.scenario = data.scenario ?? null;
    applyRemoteCatalog(data.availableAnimations);
  }

  updateStatus();
});

setInterval(() => {
  post(channel, MessageType.PING);
  const connected = Date.now() - lastPong < 2500;
  if (connected !== state.connected) {
    state.connected = connected;
    updateStatus();
  }
}, 800);

async function start() {
  const saved = await listCustomAnimations();
  state.catalog = applyLoopOverrides([
    ...builtinCatalog(),
    ...saved.map((record) => toAnimationCatalogEntry(record))
  ]);
  renderApp();
  post(channel, MessageType.HELLO);
}

start();
