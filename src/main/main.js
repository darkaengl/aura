require('dotenv').config();
const { app, BrowserWindow, ipcMain } = require('electron/main')
const path = require('node:path')
const fs = require('node:fs/promises'); // Import Node.js file system promises API
const { spawn } = require('child_process');
// Use a CommonJS-specific constants file to avoid ESM syntax issues in main process
const { MODELS } = require('../config/constants-node.js');
// Inline lightweight logger (CommonJS friendly) - avoids ESM import friction
const logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const _levels = ['error','warn','info','debug'];
const _lvlIndex = _levels.includes(logLevel) ? _levels.indexOf(logLevel) : 2;
function log(level, ...args){ const idx = _levels.indexOf(level); if(idx <= _lvlIndex){ console[level === 'debug' ? 'log' : level](`[MAIN ${level.toUpperCase()}]`, ...args);} }
const pdfParse = require('pdf-parse');

app.setName('Aura');

// IPC handler to classify user input as 'question' or 'action' using LLM
ipcMain.handle('classify-intent', async (event, userMessage) => {
  const systemPrompt = `You are an intent classifier for a browser assistant. 
  Given a user message, respond with only 'question' if the user is asking for information, 
  or 'action' if the user is asking to perform an action on the website. 
  Do not explain your answer.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];
  try {
    // Directly spawn Ollama for classification
    return await new Promise((resolve, reject) => {
      const input = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  const child = spawn('ollama', ['run', MODELS.CLASSIFIER]);
      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      child.stderr.on('data', (data) => { log('warn','classify-intent stderr:', data.toString()); });
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
  log('error','Intent classification failed:', error);
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
  try {
  const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
  model: MODELS.CHAT, // centralized constant
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
  log('error','Error communicating with Ollama:', error);
    return `Error: Could not connect to Ollama. Is it running? (${error.message})`;
  }
});


// Alternative handler using spawn for direct Ollama CLI
ipcMain.handle('ollama:chat:spawn', async (event, messages) => {
  log('debug','ollama:chat:spawn handler called');
  return new Promise((resolve, reject) => {
    const input = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  log('debug','Input to Ollama length:', input.length);
  const child = spawn('ollama', ['run', MODELS.CLASSIFIER]);

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
  log('warn','Ollama stderr:', data.toString());
    });

    child.on('close', (code) => {
  log('debug',`Ollama process closed with code ${code}`);
      // Remove the "thinking" part of the output.
      const cleanedOutput = output.replace(/^Thinking\.\.\..*?\.\.\.done thinking\.\n*/s, '');
  log('debug','Cleaned Ollama output length:', cleanedOutput.length);
      resolve(cleanedOutput);
    });

    child.stdin.write(input + '\n');
    child.stdin.end();
  });
});




ipcMain.handle('save-dom-log', async (event, domJson) => {
  log('debug','save-dom-log handler called');
  try {
    const logPath = path.join(__dirname, '..', '..', 'dom-log.json');
    await fs.writeFile(logPath, JSON.stringify(domJson, null, 2));
  log('info',`DOM log saved to ${logPath}`);
    return { success: true, path: logPath };
  } catch (error) {
  log('error','Failed to save DOM log:', error);
    throw new Error(`Failed to save DOM log: ${error.message}`);
  }
});

ipcMain.handle('save-llm-log', async (event, llmResponse) => {
  log('debug','save-llm-log handler called');
  try {
    const logPath = path.join(__dirname, '..', '..', 'llm-log.json');
    await fs.writeFile(logPath, JSON.stringify(llmResponse, null, 2));
  log('info',`LLM log saved to ${logPath}`);
    return { success: true, path: logPath };
  } catch (error) {
  log('error','Failed to save LLM log:', error);
    throw new Error(`Failed to save LLM log: ${error.message}`);
  }
});
ipcMain.handle('simplify:extract-text', async (event, options) => {
  try {
    // This handler will be called by renderer to extract text from webview
    // The actual extraction happens in renderer by injecting JavaScript into webview
    // This handler exists for future expansion or server-side processing if needed
    return { success: true, message: 'Text extraction initiated' };
  } catch (error) {
  log('error','Error in text extraction handler:', error);
    throw new Error(`Text extraction failed: ${error.message}`);
  }
});

ipcMain.handle('simplify:process-text', async (event, textData, options = {}) => {
  try {
    const { text, title = '', url = '' } = textData;
    const { complexity = 'simple', preserveFormatting = false } = options;


    // Create context-aware prompt for text simplification
    const systemPrompt = `You are an expert at simplifying complex text while preserving meaning. 
Your goal is to make content more accessible and easier to understand.

Simplification level: ${complexity}
- simple: Use elementary vocabulary, short sentences, avoid jargon
- moderate: Use common vocabulary, moderate sentence length, explain technical terms
- advanced: Maintain some complexity but improve clarity and flow

Guidelines:
- Preserve the main ideas and important details
- Use simpler words when possible
- Break long sentences into shorter ones
- Explain complex concepts clearly
- Maintain the logical flow of information
- Your output MUST be ONLY the simplified content. Do NOT include any conversational filler, introductory phrases, self-referential statements, or any text other than the simplified content itself.
- Format the simplified content using Markdown.
${preserveFormatting ? '- Keep basic formatting like headings and paragraphs' : '- Focus on content, formatting will be handled separately'}`;

    const userPrompt = `Page Title: ${title}
Source URL: ${url}

Please simplify the following text:

${text}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.2',
        messages: messages,
        stream: false,
      }),
    });

    if (!response.ok) {
  throw new Error(`Ollama API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const simplified = data.message.content;

    // Calculate processing metrics
    const originalWordCount = text.split(/\s+/).length;
    const simplifiedWordCount = simplified.split(/\s+/).length;
    const wordReduction = ((originalWordCount - simplifiedWordCount) / originalWordCount * 100).toFixed(1);

    return {
      original: text,
      simplified: simplified,
      complexity: complexity,
      processingTime: Date.now(),
      model: 'llama3.2',
      wordReduction: parseFloat(wordReduction),
      metadata: {
        originalWordCount,
        simplifiedWordCount,
        title,
        url
      }
    };

  } catch (error) {
  log('error','Error processing text with Ollama:', error);
    return {
      error: true,
      message: `Could not simplify text. Is Ollama running? (${error.message})`,
      original: textData.text || ''
    };
  }
});

// New IPC handler for PDF processing
ipcMain.handle('process-pdf-for-simplification', async (event, pdfArrayBuffer) => {
  try {
    const data = await pdfParse(pdfArrayBuffer);
    const text = data.text;
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
    return { text, wordCount, title: 'PDF Document', url: 'file://pdf-upload' };
  } catch (error) {
  log('error','Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
});

// Google Cloud Speech-to-Text IPC handler
const speech = require('@google-cloud/speech');
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
  log('error','Google Cloud Speech-to-Text error:', error);
    throw new Error(`Speech-to-Text failed: ${error.message}`);
  }
});

ipcMain.handle('navigateToUrl', (event, url) => {
  if (mainWindow) {
    // Load index.html first if it's not already loaded
    if (mainWindow.webContents.getURL().includes('homepage.html')) {
      mainWindow.loadFile('index.html').then(() => {
        // Once index.html is loaded, send the URL to its renderer
        mainWindow.webContents.send('navigate-webview', url);
      });
    } else {
      // If index.html is already loaded, just send the URL
      mainWindow.webContents.send('navigate-webview', url);
    }
  }
});

ipcMain.on('navigate-from-homepage', (event, url) => {
  if (mainWindow) {
    if (mainWindow.webContents.getURL().includes('homepage.html')) {
      mainWindow.loadFile('index.html').then(() => {
        mainWindow.webContents.send('navigate-webview', url);
      });
    } else {
      mainWindow.webContents.send('navigate-webview', url);
    }
  }
});




let mainWindow; // Declare mainWindow globally

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Aura',
    icon: path.join(__dirname, '../../assets/brand/IMG_3414.png'), // Set the application icon
    webPreferences: {
      preload: path.join(__dirname, '../shared/preload.js'),
      additionalArguments: [`--configPath=${path.join(__dirname, '../config')}`],
      webviewTag: true, // Enable webview tag
      contextIsolation: true, // Isolate context to enhance security
      nodeIntegration: false, // Keep nodeIntegration false for security
      sandbox: false // Disable sandbox for broader API access
    }
  })

  mainWindow.loadFile('homepage.html');
  mainWindow.setTitle('Aura Browser');
  mainWindow.focus(); // Add this line

  // Uncomment to enable DevTools for debugging
  // mainWindow.webContents.openDevTools();
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