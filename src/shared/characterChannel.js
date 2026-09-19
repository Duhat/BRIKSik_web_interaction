export const CHARACTER_CHANNEL_NAME = 'briksik-character';

export const MessageType = {
  HELLO: 'hello',
  READY: 'ready',
  PING: 'ping',
  PONG: 'pong',
  PLAY: 'play',
  IDLE: 'idle',
  STOP_SCENARIO: 'stop-scenario',
  PLAY_SCENARIO: 'play-scenario',
  ADD_ANIMATION: 'add-animation',
  REMOVE_ANIMATION: 'remove-animation',
  SET_LOOP: 'set-loop',
  STATE: 'state'
};

export function createCharacterChannel() {
  return new BroadcastChannel(CHARACTER_CHANNEL_NAME);
}

export function post(channel, type, payload = {}) {
  channel.postMessage({ type, ...payload });
}
