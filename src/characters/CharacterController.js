import { AnimationManager, DEFAULT_FADE_DURATION } from './AnimationManager.js';

console.log('[MODULE] CharacterController.js загружен');

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeLoco(t, k = 0.16) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < k) {
    const u = t / k;
    return (k * u * u / 2) / (1 - k);
  }
  if (t > 1 - k) {
    const u = (1 - t) / k;
    return 1 - (k * u * u / 2) / (1 - k);
  }
  return (t - k / 2) / (1 - k);
}

function easeTween(t, easing) {
  if (easing === 'linear') return t;
  if (easing === 'loco') return easeLoco(t);
  return easeInOutCubic(t);
}

export class CharacterController {
  constructor(model) {
    this.model = model;
    this.animationManager = new AnimationManager(model);
    this.home = {
      x: model.position.x,
      y: model.position.y,
      z: model.position.z,
      rotY: model.rotation.y
    };
    this._tween = null;
  }

  addAnimation(name, clip, loop = true) {
    this.animationManager.addAnimation(name, clip, loop);
  }

  removeAnimation(name) {
    this.animationManager.removeAnimation(name);
  }

  setLoop(name, loop) {
    this.animationManager.setLoop(name, loop);
  }

  play(name, fadeDuration = DEFAULT_FADE_DURATION, options = {}) {
    this.animationManager.play(name, fadeDuration, options);
  }

  idle(fadeDuration = DEFAULT_FADE_DURATION) {
    this.play('Idle', fadeDuration);
  }

  hasAnimation(name) {
    return Boolean(name && this.animationManager.actions[name]);
  }

  cancelMotion() {
    const tween = this._tween;
    this._tween = null;

    if (tween?.resolve) {
      tween.resolve({ cancelled: true });
    }
  }

  placeAt(x, z, rotY) {
    this.model.visible = true;
    this.model.position.x = x;
    this.model.position.y = this.home.y;
    this.model.position.z = z;

    if (typeof rotY === 'number') {
      this.model.rotation.y = rotY;
    }
  }

  faceToward(x, z) {
    const dx = x - this.model.position.x;
    const dz = z - this.model.position.z;

    if (Math.abs(dx) + Math.abs(dz) > 0.0001) {
      this.model.rotation.y = Math.atan2(dx, dz);
    }
  }

  resetToHome({ playIdle = true, fadeDuration = DEFAULT_FADE_DURATION } = {}) {
    this.cancelMotion();
    this.model.visible = true;
    this.placeAt(this.home.x, this.home.z, this.home.rotY);

    if (playIdle) {
      this.idle(fadeDuration);
    }
  }

  moveTo(x, z, durationMs, { faceMotion = true, easing = 'loco' } = {}) {
    this.cancelMotion();

    const from = {
      x: this.model.position.x,
      z: this.model.position.z
    };

    if (faceMotion) {
      this.faceToward(x, z);
    }

    return this._startTween({
      kind: 'move',
      duration: Math.max(0.2, durationMs / 1000),
      easing,
      apply(t) {
        this.model.position.x = from.x + (x - from.x) * t;
        this.model.position.z = from.z + (z - from.z) * t;
        this.model.position.y = this.home.y;
      }
    });
  }

  lookAround(durationMs) {
    this.cancelMotion();

    const base = this.model.rotation.y;
    const sweep = 0.62;

    return this._startTween({
      kind: 'look',
      duration: Math.max(0.8, durationMs / 1000),
      easing: 'linear',
      apply(t) {
        let yaw = base;

        if (t < 0.32) {
          yaw = base - sweep * easeInOutCubic(t / 0.32);
        } else if (t < 0.72) {
          yaw = base - sweep + sweep * 2 * easeInOutCubic((t - 0.32) / 0.4);
        } else {
          yaw = base + sweep - sweep * easeInOutCubic((t - 0.72) / 0.28);
        }

        this.model.rotation.y = yaw;
      }
    });
  }

  face(rotY, durationMs = 350) {
    this.cancelMotion();

    const from = this.model.rotation.y;
    let delta = rotY - from;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));

    return this._startTween({
      kind: 'face',
      duration: Math.max(0.12, durationMs / 1000),
      easing: 'cubic',
      apply(t) {
        this.model.rotation.y = from + delta * t;
      }
    });
  }

  faceTowardSmooth(x, z, durationMs = 420) {
    const dx = x - this.model.position.x;
    const dz = z - this.model.position.z;

    if (Math.abs(dx) + Math.abs(dz) < 0.0001) {
      return Promise.resolve({ cancelled: false });
    }

    return this.face(Math.atan2(dx, dz), durationMs);
  }

  _startTween({ kind, duration, apply, easing = 'cubic' }) {
    return new Promise((resolve) => {
      this._tween = {
        kind,
        duration,
        elapsed: 0,
        easing,
        apply,
        resolve
      };
    });
  }

  update(deltaTime) {
    this.animationManager.update(deltaTime);

    if (!this._tween) {
      return;
    }

    this._tween.elapsed += deltaTime;
    const t = Math.min(1, this._tween.elapsed / this._tween.duration);
    this._tween.apply.call(this, easeTween(t, this._tween.easing));

    if (t >= 1) {
      const { resolve } = this._tween;
      this._tween = null;
      resolve({ cancelled: false });
    }
  }

  onAnimationFinished(callback) {
    this.animationManager.onFinished(callback);
  }
}
