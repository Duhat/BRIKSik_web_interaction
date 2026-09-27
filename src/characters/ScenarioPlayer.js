import {
  getStageMark,
  resolveAnimationAlias
} from './stageMarks.js';

const TRAVEL_FADE = 1.05;
const STANCE_FADE = 0.95;

function moveDuration(from, to, durationMs, speed = 2.55) {
  if (Number(durationMs) > 0) {
    return Number(durationMs);
  }

  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  return Math.max(1400, (distance / speed) * 1000);
}

export class ScenarioPlayer {
  constructor(character, animations) {
    this.character = character;
    this.animations = animations;
    this.running = false;
    this.steps = [];
    this.index = 0;
    this.idleBetween = true;
    this.stay = false;
    this.error = null;
    this._timeout = null;
    this._waitResolve = null;
    this._waitingForFinish = false;
    this._finishResolve = null;
    this._playId = 0;
    this._phase = 'idle';
    this.onStateChange = null;

    this.character.onAnimationFinished((event) => {
      this._onAnimationFinished(event);
    });
  }

  play(scenario) {
    this.stop({ returnToIdle: false });

    this.steps = Array.isArray(scenario.steps) ? scenario.steps : [];
    this.idleBetween = scenario.idleBetween !== false;
    this.stay = scenario.stay === true;
    this.index = 0;
    this.error = null;
    this.running = this.steps.length > 0;
    this._playId += 1;
    const playId = this._playId;

    this.character.animationManager.autoIdleEnabled = false;
    this._notify();

    if (!this.running) {
      this.character.animationManager.autoIdleEnabled = true;
      this.character.resetToHome();
      this._notify();
      return;
    }

    this._run(playId);
  }

  stop({ returnToIdle = true } = {}) {
    this.running = false;
    this._waitingForFinish = false;
    const finishResolve = this._finishResolve;
    this._finishResolve = null;
    finishResolve?.();
    this._phase = 'idle';
    this.index = 0;
    this.steps = [];
    this._playId += 1;

    this.character.cancelMotion();
    this.character.animationManager.autoIdleEnabled = true;

    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }

    const waitResolve = this._waitResolve;
    this._waitResolve = null;
    waitResolve?.();

    if (returnToIdle) {
      this.character.resetToHome();
    }

    this._notify();
  }

  getState() {
    const step = this.steps[this.index];

    return {
      running: this.running,
      index: this.index,
      total: this.steps.length,
      phase: this._phase,
      error: this.error,
      currentStep: step ?? null
    };
  }

  async _run(playId) {
    while (this.running && this._playId === playId && this.index < this.steps.length) {
      const ok = await this._playCurrentStep(playId);

      if (!ok || this._playId !== playId || !this.running) {
        return;
      }

      await this._afterStep(playId);
      if (this._playId !== playId || !this.running) return;
      this.index += 1;
    }

    if (this._playId !== playId || !this.running) {
      return;
    }

    const last = this.steps[this.steps.length - 1];
    const stayOffstage = last?.type === 'exit';
    this.stop({ returnToIdle: !stayOffstage && !this.stay });
  }

  async _playCurrentStep(playId) {
    if (!this.running || this._playId !== playId) {
      return false;
    }

    const step = this.steps[this.index];
    const type = step.type ?? 'animation';

    if (type === 'enter' || type === 'move' || type === 'exit') {
      return this._playTravel(step, playId);
    }

    if (type === 'look') {
      return this._playLook(step, playId);
    }

    if (type === 'stance') {
      return this._playStance(step, playId);
    }

    return this._playAnimation(step, playId);
  }

  async _playTravel(step, playId) {
    const runName = resolveAnimationAlias(step.animation ?? '$run', this.animations);

    if (!runName || !this.character.hasAnimation(runName)) {
      this.error = 'Нужна анимация бега. Загрузите Mixamo Running / Jogging с циклом.';
      this.running = false;
      this._notify();
      return false;
    }

    const to = getStageMark(step.to ?? 'center');

    if (step.type === 'enter' || step.from) {
      const from = getStageMark(step.from ?? 'offLeft');
      this.character.placeAt(from.x, from.z);
      this.character.faceToward(to.x, to.z);
    } else {
      this.character.model.visible = true;
      const turned = await this.character.faceTowardSmooth(to.x, to.z, 480);
      if (turned?.cancelled || this._playId !== playId) {
        return false;
      }
    }

    this._phase = step.type === 'exit' ? 'exit' : 'enter';
    this.character.play(runName, TRAVEL_FADE, { once: false });
    this._notify();
    await this._wait(180);

    if (this._playId !== playId || !this.running) {
      return false;
    }

    const fromNow = {
      x: this.character.model.position.x,
      z: this.character.model.position.z
    };
    const duration = moveDuration(fromNow, to, step.durationMs);
    const movePromise = this.character.moveTo(to.x, to.z, duration, {
      faceMotion: false
    });

    if (step.type !== 'exit') {
      const windDown = Math.min(700, duration * 0.24);
      await this._wait(Math.max(0, duration - windDown));

      if (this._playId !== playId || !this.running) {
        return false;
      }

      const next = this.steps[this.index + 1];
      const settleName = next?.type === 'look'
        ? resolveAnimationAlias(next.animation ?? '$look', this.animations)
        : (this.animations.Neutral ? 'Neutral' : 'Idle');

      if (settleName && this.character.hasAnimation(settleName)) {
        this.character.play(settleName, TRAVEL_FADE);
      }
    }

    const result = await movePromise;

    if (result?.cancelled || this._playId !== playId) {
      return false;
    }

    if (step.type === 'exit') {
      this.character.model.visible = false;
      return true;
    }

    await this.character.face(this.character.home.rotY, 520);
    return this._playId === playId && this.running;
  }

  async _playLook(step, playId) {
    const name = resolveAnimationAlias(step.animation ?? '$look', this.animations);
    const durationMs = Number(step.durationMs) > 0 ? Number(step.durationMs) : 2800;

    this._phase = 'look';

    if (name && this.character.hasAnimation(name)) {
      if (this.character.animationManager.currentAnimation !== name) {
        const loop = Boolean(this.animations[name]?.loop);
        this.character.play(name, TRAVEL_FADE, { once: !loop });
      }
    } else if (this.character.animationManager.currentAnimation !== 'Idle') {
      this.character.idle(TRAVEL_FADE);
    }

    this._notify();

    const result = await this.character.lookAround(durationMs);

    if (result?.cancelled || this._playId !== playId) {
      return false;
    }

    await this.character.face(this.character.home.rotY, 420);
    return this._playId === playId && this.running;
  }

  async _playStance(step, playId) {
    const name = resolveAnimationAlias(step.animation ?? 'Neutral', this.animations)
      ?? (this.animations.Neutral ? 'Neutral' : 'Idle');

    this._phase = 'stance';

    if (name && this.character.hasAnimation(name)) {
      this.character.play(name, STANCE_FADE, { once: false });
    } else {
      this.character.idle(STANCE_FADE);
    }

    this._notify();
    await this._wait(Number(step.durationMs) > 0 ? Number(step.durationMs) : 450);
    return this._playId === playId && this.running;
  }

  async _playAnimation(step, playId) {
    const name = resolveAnimationAlias(step.animation, this.animations);
    const config = this.animations[name];

    if (!name || !config || !this.character.hasAnimation(name)) {
      console.error(`[SCENARIO] Неизвестная анимация: ${step.animation}`);
      return true;
    }

    this._phase = 'animation';
    this.character.play(name, TRAVEL_FADE, { once: !config.loop, restart: !config.loop });
    this._notify();

    if (config.loop) {
      const durationMs = Number(step.durationMs) > 0 ? Number(step.durationMs) : 2000;
      await this._wait(durationMs);
      return this._playId === playId && this.running;
    }

    await this._waitForAnimation();
    return this._playId === playId && this.running;
  }

  async _afterStep(playId) {
    if (!this.running || this._playId !== playId) {
      return;
    }

    const step = this.steps[this.index];
    const delayMs = Number(step?.delayMs) > 0 ? Number(step.delayMs) : 0;
    const isLast = this.index >= this.steps.length - 1;
    const type = step?.type ?? 'animation';

    if (this.idleBetween && !isLast && type === 'animation') {
      this._phase = 'idle';
      this.character.idle();
      this._notify();
      await this._wait(Math.max(delayMs, 250));
      return;
    }

    if (delayMs > 0) {
      this._phase = 'delay';
      this._notify();
      await this._wait(delayMs);
    }
  }

  _wait(ms) {
    return new Promise((resolve) => {
      if (this._timeout) {
        clearTimeout(this._timeout);
      }

      this._waitResolve = resolve;
      this._timeout = setTimeout(() => {
        this._timeout = null;
        this._waitResolve = null;
        resolve();
      }, ms);
    });
  }

  _waitForAnimation() {
    return new Promise((resolve) => {
      this._waitingForFinish = true;
      this._finishResolve = resolve;
    });
  }

  _onAnimationFinished(event) {
    if (!this.running || !this._waitingForFinish) {
      return;
    }

    const step = this.steps[this.index];
    const name = resolveAnimationAlias(step?.animation, this.animations);
    const config = name ? this.animations[name] : null;

    if (event?.action !== this.character.animationManager.actions[name]) return;

    if (config?.loop) {
      return;
    }

    this._waitingForFinish = false;
    const resolve = this._finishResolve;
    this._finishResolve = null;
    resolve?.();
  }

  _notify() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.getState());
    }
  }
}
