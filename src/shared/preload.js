const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, limited API to the renderer process

contextBridge.exposeInMainWorld('gptAPI', {
  chat: async (messages) => {
    return await ipcRenderer.invoke('gpt:chat', messages);
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

// Listen for messages from the main process and forward them to the webview
ipcRenderer.on('run-accessibility-audit', () => {
  // This is a placeholder. The actual audit is now triggered from the renderer.
});

// Forward accessibility audit results from the webview to the renderer
window.addEventListener('message', event => {
  if (event.source === window && event.data.type === 'accessibility-audit-results') {
    ipcRenderer.sendToHost('accessibility-audit-results', event.data.results);
  }
});



// Expose a new API for the main process
contextBridge.exposeInMainWorld('mainAPI', {
  saveDomLog: (domJson) => ipcRenderer.invoke('save-dom-log', domJson),
  saveLlmLog: (llmResponse) => ipcRenderer.invoke('save-llm-log', llmResponse)
});
