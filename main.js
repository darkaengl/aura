// main.js
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const playwright = require('playwright');

// const fetch = require('node-fetch');

const createWindow = async () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 1000,
    webPreferences: {
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
      // THIS IS THE FIX FOR THE ERR_ABORTED ERROR
      webSecurity: false 
    }
  })

  win.loadFile('index.html')


  // win.loadURL('https://en.wikipedia.org/wiki/Electron_(software_framework)');

  // win.webContents.once('did-finish-load', () => {
  //   // Modify Wikipedia layout
  //   win.webContents.executeJavaScript(`
  //     // Example 1: Hide the left sidebar
  //     document.getElementById('mw-panel')?.remove();

  //     // Example 2: Expand content width
  //     const content = document.getElementById('content');
  //     if (content) {
  //       content.style.marginLeft = '20px';
  //       content.style.maxWidth = 'none';
  //       content.style.width = '95%';
  //     }

  //     // Example 3: Change background and text color
  //     document.body.style.backgroundColor = '#1e1e1e';
  //     document.body.style.color = '#f1f1f1';
  //     document.querySelectorAll('a').forEach(a => a.style.color = '#8ab4f8');
  //   `);
  // });

  //////////////////////////////////////////////////////////////////////////////////////
  // Launch a Playwright browser instance (Chromium in this case)
  // browser = await playwright.chromium.launch({
  //   headless: false,  // Show browser window, false if you want to see it
  //   slowMo: 50        // Optional, adds delay to make actions visible
  // });

  // // Create a new page for Playwright to interact with
  // page = await browser.newPage();

  // // Load a URL into the Playwright-controlled page (Wikipedia in this case)
  // await page.goto('https://en.wikipedia.org/wiki/Electron_(software_framework)');

  // // Create the Electron window
  // win = new BrowserWindow({
  //   width: 1000,
  //   height: 800,
  //   webPreferences: {
  //     nodeIntegration: false,
  //     contextIsolation: true,
  //   },
  // });

  // // Load your own custom HTML or a different URL in the Electron window
  // win.loadFile('index.html');






  //////////////////////////////////////////////////////////////////////////////////////
  

  // ✅ Open DevTools by default
  // win.webContents.openDevTools();
}

app.on('ready', async () => {
  await createWindow()


  // Listen for the 'ollama:chat' event from the renderer
  ipcMain.handle('ollama:chat', async (event, messages) => {
    console.log('ollama:chat handler called with:', messages); // <--- Add this
  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2',
        messages: messages,
        stream: true, // ensure streaming is enabled
      }),
    });

    let result = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      // Ollama streams JSON lines, so split and parse each line
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message && json.message.content) {
            result += json.message.content;
          }
        } catch (e) {
          // Ignore lines that aren't valid JSON
        }
      }
    }
    
    console.log(result); // Log the final result
    // Return the complete result to the renderer
    return result;
  } catch (error) {
    // console.error('Ollama chat failed:', error);
    return 'Error: Could not connect to Ollama.';
  }
});

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})