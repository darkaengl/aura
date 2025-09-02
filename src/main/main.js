const { app, BrowserWindow, ipcMain } = require('electron/main')
const path = require('node:path')
const fs = require('node:fs/promises'); // Import Node.js file system promises API
const { spawn } = require('child_process');


app.setName('Aura');

// IPC handler to classify user input as 'question' or 'action' using LLM
ipcMain.handle('classify-intent', async (event, userMessage) => {
  const systemPrompt = `You are an intent classifier for a browser assistant. Given a user message, respond with only 'question' if the user is asking for information, or 'action' if the user is asking to perform an action on the website. Do not explain your answer.`;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];
  try {
    // Directly spawn Ollama for classification
    return await new Promise((resolve, reject) => {
      const input = messages.map(m => `${m.role}: ${m.content}`).join('\n');
      const child = spawn('ollama', ['run', 'mistral:7b-instruct-v0.2-q4_0']);
      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      child.stderr.on('data', (data) => {
        console.error('Ollama stderr:', data.toString());
      });
      child.on('close', (code) => {
        const cleanedOutput = output.replace(/^Thinking\.{3}.*?\.\.\.done thinking\.\n*/s, '');
        const intent = (cleanedOutput || '').trim().toLowerCase();
        if (intent === 'question' || intent === 'action') {
          resolve(intent);
        } else if (intent.includes('question')) {
          resolve('question');
        } else if (intent.includes('action')) {
          resolve('action');
        } else {
          resolve('unknown');
        }
      });
      child.stdin.write(input + '\n');
      child.stdin.end();
    });
  } catch (error) {
    console.error('Intent classification failed:', error);
    return 'unknown';
  }
});

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
  console.log('ollama:chat handler called');
  return new Promise((resolve, reject) => {
    const input = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    console.log('Input to Ollama length:', input.length);
    const child = spawn('ollama', ['run', 'mistral:7b-instruct-v0.2-q4_0']);

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      console.error('Ollama stderr:', data.toString());
    });

    child.on('close', (code) => {
      console.log(`Ollama process closed with code ${code}`);
      // Remove the "thinking" part of the output.
      const cleanedOutput = output.replace(/^Thinking\.\.\..*?\.\.\.done thinking\.\n*/s, '');
      console.log('Cleaned Ollama output length:', cleanedOutput.length);
      resolve(cleanedOutput);
    });

    child.stdin.write(input + '\n');
    child.stdin.end();
  });
});

ipcMain.handle('save-dom-log', async (event, domJson) => {
  console.log('save-dom-log handler called in main');
  try {
    const logPath = path.join(__dirname, '..', '..', 'dom-log.json');
    await fs.writeFile(logPath, JSON.stringify(domJson, null, 2));
    console.log(`DOM log saved to ${logPath}`);
    return { success: true, path: logPath };
  } catch (error) {
    console.error('Failed to save DOM log:', error);
    throw new Error(`Failed to save DOM log: ${error.message}`);
  }
});

ipcMain.handle('save-llm-log', async (event, llmResponse) => {
  console.log('save-llm-log handler called in main');
  try {
    const logPath = path.join(__dirname, '..', '..', 'llm-log.json');
    await fs.writeFile(logPath, JSON.stringify(llmResponse, null, 2));
    console.log(`LLM log saved to ${logPath}`);
    return { success: true, path: logPath };
  } catch (error) {
    console.error('Failed to save LLM log:', error);
    throw new Error(`Failed to save LLM log: ${error.message}`);
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