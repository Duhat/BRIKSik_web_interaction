export class ScenarioPlayer {
  constructor(character, animations) {
    this.character = character;
    this.animations = animations;
    this.running = false;
    this.steps = [];
    this.index = 0;
    this.idleBetween = true;
    this._timeout = null;
    this._waitingForFinish = false;
    this._phase = 'idle';
    this.onStateChange = null;

    this.character.onAnimationFinished(() => {
      this._onAnimationFinished();
    });
  }

  play(scenario) {
    this.stop({ returnToIdle: false });

    this.steps = Array.isArray(scenario.steps) ? scenario.steps : [];
    this.idleBetween = scenario.idleBetween !== false;
    this.index = 0;
    this.running = this.steps.length > 0;

    this.character.animationManager.autoIdleEnabled = false;

    this._notify();

    if (!this.running) {
      this.character.animationManager.autoIdleEnabled = true;
      this.character.idle();
      this._notify();
      return;
    }

    this._playCurrentStep();
  }

  stop({ returnToIdle = true } = {}) {
    this.running = false;
    this._waitingForFinish = false;
    this._phase = 'idle';
    this.index = 0;
    this.steps = [];

    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }

    this.character.animationManager.autoIdleEnabled = true;

    if (returnToIdle) {
      this.character.idle();
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
      currentStep: step ?? null
    };
  }

  _playCurrentStep() {
    if (!this.running) {
      return;
    }

    if (this.index >= this.steps.length) {
      this.stop({ returnToIdle: true });
      return;
    }

    const step = this.steps[this.index];
    const name = step.animation;
    const config = this.animations[name];

    if (!config) {
      console.error(`[SCENARIO] Неизвестная анимация: ${name}`);
      this.index += 1;
      this._playCurrentStep();
      return;
    }

    this._phase = 'animation';
    this._waitingForFinish = true;
    this.character.play(name, undefined, { once: !config.loop });
    this._notify();

    if (config.loop) {
      const durationMs = Number(step.durationMs) > 0 ? Number(step.durationMs) : 2000;
      this._timeout = setTimeout(() => {
        this._waitingForFinish = false;
        this._afterStep();
      }, durationMs);
    }
  }

  _onAnimationFinished() {
    if (!this.running || !this._waitingForFinish) {
      return;
    }

    const step = this.steps[this.index];
    const config = step ? this.animations[step.animation] : null;

    if (config?.loop) {
      return;
    }

    this._waitingForFinish = false;
    this._afterStep();
  }

  _afterStep() {
    if (!this.running) {
      return;
    }

    const step = this.steps[this.index];
    const delayMs = Number(step?.delayMs) > 0 ? Number(step.delayMs) : 0;
    const isLast = this.index >= this.steps.length - 1;

    const finishAndAdvance = () => {
      this.index += 1;
      this._playCurrentStep();
    };

    if (this.idleBetween && !isLast) {
      this._phase = 'idle';
      this.character.idle();
      this._notify();

      this._timeout = setTimeout(finishAndAdvance, Math.max(delayMs, 250));
      return;
    }

    if (delayMs > 0) {
      this._phase = 'delay';
      this._notify();
      this._timeout = setTimeout(finishAndAdvance, delayMs);
      return;
    }

    finishAndAdvance();
  }

  _notify() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.getState());
    }
  }
}
