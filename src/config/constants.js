// Centralized constants for models, phrases, styling, timing.
// Non-breaking introduction. Existing code will be incrementally migrated.

export const MODELS = {
  CLASSIFIER: 'mistral:7b-instruct-v0.2-q4_0',
  CHAT: 'llama3.2',
  OPENAI_DEFAULT: 'gpt-3.5-turbo'
};

export const WAKE_WORD = 'browser';

export const STOP_PHRASES = [
  'stop executing commands',
  'stop listening',
  'stop recording',
  'stop aura',
  'exit continuous mode',
  "that's all",
  'thank you aura',
  'goodbye aura',
  'end session',
  'stop'
];

export const AGREEMENT_KEYWORDS = [
  'acknowledge','accept','agree','confirm','terms','conditions','privacy','consent'
];

export const HIGHLIGHT = {
  CLICK: '#ff9800',
  FILL: '#4caf50',
  SELECT: '#2196f3',
  AGREEMENT: '#90EE90'
};

export const RECORDING_LIMITS = {
  SILENCE_DB_THRESHOLD: -50,
  SILENCE_DURATION_MS: 2000,
  MAX_RECORDING_MS: 15000
};

export const COMMANDS_SUPPORTED = [
  'search_and_navigate',
  'agree_and_start_form',
  'start_form_filling',
  'click','fill','select'
];

// Utility guard for future validation.
export function isSupportedCommand(action){
  return COMMANDS_SUPPORTED.includes(action);
}

// CommonJS compatibility (so accidental require doesn't explode)
// cjs consumers should prefer constants-node.js but this guards against mistakes.
// eslint-disable-next-line no-undef
if (typeof module !== 'undefined') {
  // eslint-disable-next-line no-undef
  module.exports = { MODELS, WAKE_WORD, STOP_PHRASES, AGREEMENT_KEYWORDS, HIGHLIGHT, RECORDING_LIMITS, COMMANDS_SUPPORTED, isSupportedCommand };
}
