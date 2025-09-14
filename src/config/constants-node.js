// CommonJS version of constants for Electron main process.
// Mirrors values from constants.js (ESM used in renderer/bundled context).

module.exports = {
  MODELS: {
    CLASSIFIER: 'mistral:7b-instruct-v0.2-q4_0',
    CHAT: 'llama3.2',
    OPENAI_DEFAULT: 'gpt-3.5-turbo'
  }
};
