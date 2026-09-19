import { AnimationManager, DEFAULT_FADE_DURATION } from './AnimationManager.js';

console.log('[MODULE] CharacterController.js загружен');

export class CharacterController {
  constructor(model) {
    this.model = model;
    this.animationManager = new AnimationManager(model);
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

  // ← теперь принимает fade
  idle(fadeDuration = DEFAULT_FADE_DURATION) {
    this.play('Idle', fadeDuration);
  }

  update(deltaTime) {
    this.animationManager.update(deltaTime);
  }

  onAnimationFinished(callback) {
    this.animationManager.onFinished(callback);
  }
}