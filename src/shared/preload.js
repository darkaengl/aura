const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, limited API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  navigateToUrl: async (url) => ipcRenderer.invoke('navigateToUrl', url),
  onNavigateWebview: (callback) => ipcRenderer.on('navigate-webview', (event, url) => callback(url))
});

contextBridge.exposeInMainWorld('ollamaAPI', {
  chat: async (messages) => {
    return await ipcRenderer.invoke('ollama:chat', messages);
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