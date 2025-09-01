const { app, BrowserWindow, ipcMain } = require('electron/main')
const path = require('node:path')
const fs = require('node:fs/promises'); // Import Node.js file system promises API
const speech = require('@google-cloud/speech'); // Import Google Cloud Speech-to-Text library

app.setName('Aura');

ipcMain.handle('read-local-file', async (event, filePath) => {
  try {
    const absolutePath = path.join(__dirname, '../../', filePath);
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

// Google Cloud Speech-to-Text IPC handler
const speechClient = new speech.SpeechClient({
  keyFilename: path.join(__dirname, '../../google-cloud-key.json') // IMPORTANT: Replace with your actual key file path
});

ipcMain.handle('transcribe-audio', async (event, audioBuffer, sampleRate) => {
  try {
    const nodeBuffer = Buffer.from(audioBuffer);

    const audio = {
      content: nodeBuffer.toString('base64'),
    };
    const config = {
      encoding: 'LINEAR16', // Changed to LINEAR16 for WAV
      sampleRateHertz: sampleRate, // Use the dynamic sample rate
      languageCode: 'en-US', // Or your desired language
    };
    const request = {
      audio: audio,
      config: config,
    };

    const [response] = await speechClient.recognize(request);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');
    return transcription;
  } catch (error) {
    console.error('Google Cloud Speech-to-Text error:', error);
    throw new Error(`Speech-to-Text failed: ${error.message}`);
  }
});


const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Aura',
    webPreferences: {
      preload: path.join(__dirname, '../shared/preload.js'),
      webviewTag: true, // Enable webview tag
      contextIsolation: true, // Isolate context to enhance security
      nodeIntegration: false // Keep nodeIntegration false for security
    }
  })

  win.loadFile('index.html');
  win.setTitle('Aura Browser');
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
