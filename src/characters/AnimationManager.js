import * as THREE from 'three';

console.log('[MODULE] AnimationManager.js загружен');

export const DEFAULT_FADE_DURATION = 0.65;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class AnimationManager {
  constructor(model) {
    console.log('[ANIMATION MANAGER] Создание AnimationManager');

    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    this.currentAction = null;
    this.currentAnimation = null;
    this.animationSettings = {};
    this.autoIdleEnabled = true;
    this.onPlay = null;
    this._blend = null;

    this.setupAutoIdle();

    console.log('[ANIMATION MANAGER] AnimationManager готов');
  }

  addAnimation(name, clip, loop = true) {
    console.log(`[ANIMATION MANAGER] Добавляем анимацию: ${name}`);

    if (this.actions[name]) {
      this.removeAnimation(name);
    }

    const action = this.mixer.clipAction(clip);

    this.animationSettings[name] = { loop };

    this.applyLoopMode(action, loop);

    this.actions[name] = action;

    console.log(`[ANIMATION MANAGER] Анимация "${name}" добавлена, loop = ${loop}`);
  }

  removeAnimation(name) {
    const action = this.actions[name];

    if (!action) {
      return;
    }

    if (this._blend?.to === action) {
      this._blend = null;
    }

    if (this._blend?.from) {
      this._blend.from = this._blend.from.filter((item) => item.action !== action);
    }

    if (this.currentAction === action) {
      this.currentAction = null;
      this.currentAnimation = null;
    }

    action.stop();
    action.setEffectiveWeight(0);
    this.mixer.uncacheAction(action);
    delete this.actions[name];
    delete this.animationSettings[name];
  }

  applyLoopMode(action, loop) {
    if (!action) {
      return;
    }

    if (loop) {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    } else {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
  }

  setLoop(name, loop) {
    const enabled = Boolean(loop);
    this.animationSettings[name] = {
      ...(this.animationSettings[name] ?? {}),
      loop: enabled
    };
    this.applyLoopMode(this.actions[name], enabled);
  }

  play(name, fadeDuration = DEFAULT_FADE_DURATION, options = {}) {
    console.log(`[ANIMATION MANAGER] play("${name}")`);

    const nextAction = this.actions[name];

    if (!nextAction) {
      console.error(`[ANIMATION MANAGER] Анимация "${name}" НЕ найдена`);
      return;
    }

    const settings = this.animationSettings[name] ?? { loop: true };
    const loop = options.once === true
      ? false
      : options.once === false
        ? true
        : Boolean(settings.loop);

    this.applyLoopMode(nextAction, loop);
    this._beginBlend(nextAction, fadeDuration, loop);

    this.currentAction = nextAction;
    this.currentAnimation = name;

    if (typeof this.onPlay === 'function') {
      this.onPlay(name);
    }

    console.log(`[ANIMATION MANAGER] Сейчас играет: ${name}`);
  }

  _beginBlend(nextAction, fadeDuration, loop) {
    const duration = Math.max(0.05, fadeDuration);
    const from = [];

    for (const action of Object.values(this.actions)) {
      const weight = action.getEffectiveWeight();

      if (action === nextAction) {
        continue;
      }

      if (weight > 0.001 || action.isRunning()) {
        from.push({ action, startWeight: weight });
      }
    }

    const restarting = this.currentAction === nextAction;
    const startWeight = restarting ? 0 : nextAction.getEffectiveWeight();

    nextAction.enabled = true;
    nextAction.paused = false;
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(startWeight);
    this.applyLoopMode(nextAction, loop);
    nextAction.play();

    this._blend = {
      from,
      to: nextAction,
      toStartWeight: startWeight,
      duration,
      elapsed: 0
    };
  }

  update(deltaTime) {
    if (this._blend) {
      this._blend.elapsed += deltaTime;
      const t = Math.min(1, this._blend.elapsed / this._blend.duration);
      const eased = easeInOutCubic(t);

      for (const { action, startWeight } of this._blend.from) {
        action.setEffectiveWeight(startWeight * (1 - eased));
      }

      const toStart = this._blend.toStartWeight;
      this._blend.to.setEffectiveWeight(toStart + (1 - toStart) * eased);

      if (t >= 1) {
        for (const { action } of this._blend.from) {
          action.stop();
          action.setEffectiveWeight(0);
        }

        this._blend.to.setEffectiveWeight(1);
        this._blend = null;
      }
    }

    this.mixer.update(deltaTime);
  }

  onFinished(callback) {
    this.mixer.addEventListener('finished', callback);
  }

  setupAutoIdle() {
    this.mixer.addEventListener('finished', (event) => {
      const finishedAction = event.action;
      let finishedAnimationName = null;

      for (const [name, action] of Object.entries(this.actions)) {
        if (action === finishedAction) {
          finishedAnimationName = name;
          break;
        }
      }

      if (!finishedAnimationName) {
        return;
      }

      if (finishedAnimationName === 'Idle') {
        return;
      }

      if (!this.autoIdleEnabled) {
        return;
      }

      if (this.currentAction !== finishedAction) {
        return;
      }

      if (this.animationSettings[finishedAnimationName]?.loop) {
        finishedAction.paused = false;
        finishedAction.enabled = true;
        this.applyLoopMode(finishedAction, true);
        finishedAction.play();
        return;
      }

      if (this.actions.Idle) {
        console.log(
          `[ANIMATION MANAGER] "${finishedAnimationName}" закончилась → Idle`
        );
        this.play('Idle');
      }
    });
  }
}
