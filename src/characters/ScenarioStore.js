const STORAGE_KEY = 'briksik-scenarios';

export function loadScenarios() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('[SCENARIOS] Не удалось прочитать сценарии', error);
    return [];
  }
}

export function saveScenarios(scenarios) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}

export function upsertScenario(scenario) {
  const scenarios = loadScenarios();
  const index = scenarios.findIndex((item) => item.id === scenario.id);

  if (index >= 0) {
    scenarios[index] = scenario;
  } else {
    scenarios.push(scenario);
  }

  saveScenarios(scenarios);
  return scenarios;
}

export function deleteScenario(id) {
  const scenarios = loadScenarios().filter((item) => item.id !== id);
  saveScenarios(scenarios);
  return scenarios;
}

export function createScenarioId() {
  return `scenario-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
