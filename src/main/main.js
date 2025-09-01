const { app, BrowserWindow, ipcMain } = require('electron/main')
const path = require('node:path')
const fs = require('node:fs/promises'); // Import Node.js file system promises API

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

ipcMain.handle('simplify:extract-text', async (event, options) => {
  try {
    // This handler will be called by renderer to extract text from webview
    // The actual extraction happens in renderer by injecting JavaScript into webview
    // This handler exists for future expansion or server-side processing if needed
    return { success: true, message: 'Text extraction initiated' };
  } catch (error) {
    console.error('Error in text extraction handler:', error);
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
    console.error('Error processing text with Ollama:', error);
    return {
      error: true,
      message: `Could not simplify text. Is Ollama running? (${error.message})`,
      original: textData.text || ''
    };
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
  
  // Uncomment to enable DevTools for debugging
  // win.webContents.openDevTools();
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