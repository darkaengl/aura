const { contextBridge, ipcRenderer } = require('electron');
console.log('Preload script loaded.');

// Expose a safe, limited API to the renderer process
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

contextBridge.exposeInMainWorld('speechAPI', {
  transcribeAudio: async (audioBuffer, sampleRate) => ipcRenderer.invoke('transcribe-audio', audioBuffer, sampleRate)
});

contextBridge.exposeInMainWorld('nodeBufferFrom', Buffer.from);