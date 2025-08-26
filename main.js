const { app, BrowserWindow, ipcMain } = require('electron/main')
const path = require('node:path')
const fs = require('node:fs/promises'); // Import Node.js file system promises API

ipcMain.handle('read-local-file', async (event, filePath) => {
  try {
    const absolutePath = path.join(__dirname, filePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    return content;
  } catch (error) {
    console.error(`Failed to read local file ${filePath}:`, error);
    throw new Error(`Failed to read local file: ${error.message}`);
  }
});


ipcMain.handle('ollama:chat', async (event, messages) => {
  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.2', // You can make this configurable or choose a default
        messages: messages,
        stream: false, // We want the full response at once
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return data.message.content; // Assuming the response structure
  } catch (error) {
    console.error('Error communicating with Ollama:', error);
    return `Error: Could not connect to Ollama. Is it running? (${error.message})`;
  }
});

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true, // Enable webview tag
      contextIsolation: true, // Isolate context to enhance security
      nodeIntegration: false // Keep nodeIntegration false for security
    }
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})