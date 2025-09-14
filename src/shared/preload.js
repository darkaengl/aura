
const { contextBridge, ipcRenderer } = require('electron');

// LLM feature config + key resolution (guarded require to prevent preload crash if file missing)
let resolveApiKeyForFeature = () => '';
let getFeatureConfig = () => null;
try {
  const mod = require('../config/llm-config.js');
  resolveApiKeyForFeature = mod.resolveApiKeyForFeature || resolveApiKeyForFeature;
  getFeatureConfig = mod.getFeatureConfig || getFeatureConfig;
} catch (e) {
  console.warn('[preload] llm-config module not found or failed to load:', e.message);
}
const baseOpenAiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY || '';
contextBridge.exposeInMainWorld('secretsAPI', {
  getChatGptApiKey: () => baseOpenAiKey,
  getLLMKey: (feature) => {
    try { return resolveApiKeyForFeature(feature) || ''; } catch { return ''; }
  },
  getLLMConfig: (feature) => {
    try { return getFeatureConfig(feature); } catch { return null; }
  }
});

// Expose a safe, limited API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  navigateToUrl: async (url) => ipcRenderer.invoke('navigateToUrl', url),
  sendNavigate: (url) => ipcRenderer.send('navigate-from-homepage', url),
  onNavigateWebview: (callback) => ipcRenderer.on('navigate-webview', (event, url) => callback(url))
});

// Expose nodeBufferFrom for converting ArrayBuffer to Node.js Buffer
contextBridge.exposeInMainWorld('nodeBufferFrom', (arrayBuffer) => {
  return Buffer.from(arrayBuffer);
});

// Expose speechAPI for Google Speech-to-Text
contextBridge.exposeInMainWorld('speechAPI', {
  transcribeAudio: async (audioBuffer, sampleRate) => {
    return await ipcRenderer.invoke('transcribe-audio', audioBuffer, sampleRate);
  }
});

contextBridge.exposeInMainWorld('ollamaAPI', {
  chat: async (messages) => {
    return await ipcRenderer.invoke('ollama:chat', messages);
  },
  classifyIntent: async (userMessage) => {
    return await ipcRenderer.invoke('classify-intent', userMessage);
  }
});

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron
  // we can also expose variables, not just functions
});

contextBridge.exposeInMainWorld('fileAPI', {
  readLocalFile: async (filePath) => ipcRenderer.invoke('read-local-file', filePath)
});

contextBridge.exposeInMainWorld('textSimplificationAPI', {
  extractText: async (options) => {
    return await ipcRenderer.invoke('simplify:extract-text', options);
  },
  processText: async (textData, options) => {
    return await ipcRenderer.invoke('simplify:process-text', textData, options);
  },
  processPdfForSimplification: async (pdfArrayBuffer) => {
    return await ipcRenderer.invoke('process-pdf-for-simplification', pdfArrayBuffer);
  }
});

contextBridge.exposeInMainWorld('mainAPI', {
  saveDomLog: (domJson) => ipcRenderer.invoke('save-dom-log', domJson),
  saveLlmLog: (llmResponse) => ipcRenderer.invoke('save-llm-log', llmResponse)
});