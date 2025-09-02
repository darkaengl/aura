import { initializeAccessibility } from '../shared/accessibility.js';

window.onload = async () => {
  const urlInput = document.getElementById('url-input');
  const backBtn = document.getElementById('back-btn');
  const forwardBtn = document.getElementById('forward-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const webview = document.getElementById('webview');
  const wcagScoreLabel = document.getElementById('wcag-score-label');
  const accessibilityReport = document.getElementById('accessibility-report');
  const reportDetails = document.getElementById('report-details');
  const closeReportBtn = document.getElementById('close-report-btn');
  const downloadReportBtn = document.getElementById('download-report-btn');
  const micBtn = document.getElementById('mic-btn');
  const inspectWebviewBtn = document.getElementById('inspect-webview-btn');

  // Chat interface elements
  const chatContainer = document.getElementById('chat-container');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const micChatBtn = document.getElementById('mic-chat-btn');

  // Speech Recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  console.log('SpeechRecognition initialized.');
  recognition.continuous = false; // Listen for a single utterance
  recognition.lang = 'en-US';

  let isListening = false;

  micChatBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
      isListening = false;
      micChatBtn.style.backgroundColor = ''; // Reset button color
      console.log('Speech recognition stopped.');
    } else {
      recognition.start();
      isListening = true;
      micChatBtn.style.backgroundColor = '#ff0000'; // Change button color to red when listening
      console.log('Speech recognition started.');
    }
  });

  recognition.onresult = (event) => {
    console.log('Speech recognition result received.', event);
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    sendMessage(); // Send the message after speech input
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error, event);
    isListening = false;
    micChatBtn.style.backgroundColor = ''; // Reset button color
    addMessage('Speech recognition failed. Please try again.', 'ai');
  };

  recognition.onend = () => {
    console.log('Speech recognition ended.');
    isListening = false;
    micChatBtn.style.backgroundColor = ''; // Reset button color
  };

  /**``
   * Navigates the webview to the URL in the input field.
   */
  const navigate = () => {
    let url = urlInput.value.trim();
    if (url) {
      // Prepend 'https://' if the protocol is missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      webview.src = url;
    }
  };

  // Add event listeners for navigation buttons
  backBtn.addEventListener('click', () => {
    if (webview.canGoBack()) {
      webview.goBack();
    }
  });
  forwardBtn.addEventListener('click', () => {
    if (webview.canGoForward()) {
      webview.goForward();
    }
  });
  refreshBtn.addEventListener('click', () => {
    webview.reload();
  });

  // Add event listener for the 'Enter' key press in the input field
  urlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      navigate();
    }
  });

  micBtn.addEventListener('click', () => {
    chatContainer.classList.remove('hidden');
  });

  inspectWebviewBtn.addEventListener('click', () => {
    webview.openDevTools();
  });

  closeChatBtn.addEventListener('click', () => {
    chatContainer.classList.add('hidden');
  });

  chatSendBtn.addEventListener('click', () => sendMessage());

  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      sendMessage();
    }
  });

  const addMessage = (text, sender) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `${sender}-message`);
    messageElement.innerText = text;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to the bottom
  };

  const getDomFromWebview = () => {
    console.log('getDomFromWebview called');
    return new Promise((resolve) => {
      const listener = (event) => {
        console.log('ipc-message received from webview:', event.channel);
        if (event.channel === 'dom-extracted') {
          console.log('dom-extracted event received', event.args[0]);
          webview.removeEventListener('ipc-message', listener);
          resolve(event.args[0]);
        }
      };
      webview.addEventListener('ipc-message', listener);
      console.log('Sending extract-dom to webview');
      webview.send('extract-dom');
    });
  };

  const getCommandScript = (command) => {
    switch (command.action) {
      case 'click':
        return `element.click();`;
      case 'fill':
        const escapedText = command.text.replace(/'/g, "'");
        return `element.value = '${escapedText}';`;
      case 'scroll':
        if (command.selector) {
          return `element.scrollTop += ${command.direction === 'up' ? -100 : 100};`;
        } else {
          return `window.scrollBy(0, ${command.direction === 'up' ? -100 : 100});`;
        }
      case 'select':
        return `element.value = '${command.value}';`;
      case 'hover':
        return `element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));`;
      default:
        return '';
    }
  };

  const executeCommands = async (commands) => {
    for (const command of commands) {
      console.log(`Executing command:`, command);

      if (command.action === 'goto') {
        webview.loadURL(command.url);
        continue;
      }

      if (command.action === 'wait') {
        await new Promise(resolve => setTimeout(resolve, command.milliseconds));
        continue;
      }

      const escapedSelector = command.selector ? command.selector.replace(/'/g, "'") : '';

      const script = `
        (() => {
          try {
            const element = document.querySelector('${escapedSelector}');
            if (!element) {
              return { success: false, error: 'Element with selector \'${escapedSelector}\' not found' };
            }
            ${getCommandScript(command)}
            return { success: true };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `;

      try {
        const result = await webview.executeJavaScript(script, true);
        if (result && !result.success) {
          const errorMessage = `Error executing command: ${result.error}`;
          console.error(errorMessage);
          addMessage(errorMessage, 'ai');
        }
      } catch (e) {
        console.error('Error executing script in webview:', e);
        addMessage(`Error executing script: ${e.message}`, 'ai');
      }
    }
  };

  const extractVisibleTextFromWebview = async () => {
    // This script extracts all visible text from the page
    return await webview.executeJavaScript(`
      (() => {
        function getVisibleText(element) {
          if (!element) return '';
          if (element.nodeType === Node.TEXT_NODE) {
            return element.textContent.trim();
          }
          if (element.nodeType !== Node.ELEMENT_NODE) return '';
          const style = window.getComputedStyle(element);
          if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
            return '';
          }
          let text = '';
          for (const child of element.childNodes) {
            text += getVisibleText(child) + ' ';
          }
          return text.trim();
        }
        return getVisibleText(document.body);
      })();
    `, true);
  };

  const extractScreenContextFromWebview = async () => {
    // Extract a flat list of visible, interactive elements for LLM context
    return await webview.executeJavaScript(`
      (() => {
        function isVisible(element) {
          if (!element) return false;
          if (element.nodeType !== Node.ELEMENT_NODE) return false;
          const style = window.getComputedStyle(element);
          return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        }
        function isInteractive(element) {
          const tag = element.tagName.toLowerCase();
          return (
            tag === 'button' ||
            tag === 'a' ||
            tag === 'input' ||
            tag === 'select' ||
            tag === 'textarea' ||
            element.hasAttribute('role') && ['button','link','textbox','searchbox','menuitem'].includes(element.getAttribute('role'))
          );
        }
        function getElementInfo(element) {
          if (!isVisible(element) || !isInteractive(element)) return null;
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || undefined,
            class: element.className || undefined,
            name: element.getAttribute('name') || undefined,
            role: element.getAttribute('role') || undefined,
            ariaLabel: element.getAttribute('aria-label') || undefined,
            placeholder: element.getAttribute('placeholder') || undefined,
            text: element.innerText ? element.innerText.trim() : undefined,
            type: element.getAttribute('type') || undefined,
            href: element.getAttribute('href') || undefined
          };
        }
        function walk(element, result) {
          if (!element) return;
          if (element.nodeType === Node.ELEMENT_NODE) {
            const info = getElementInfo(element);
            if (info) result.push(info);
            for (const child of element.children) {
              walk(child, result);
            }
          }
        }
        const result = [];
        walk(document.body, result);
        return result;
      })();
    `, true);
  };

  const sendMessage = async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    chatInput.value = '';

    try {
      // Classify intent first
      const intent = await window.ollamaAPI.classifyIntent(message);
      console.log('Intent classified as:', intent, 'for message:', message);

      if (intent === 'action') {
        // Extract visible screen context instead of DOM
        console.log('Extracting screen context...');
        const screenContext = await extractScreenContextFromWebview();
        console.log('Screen context extracted:', screenContext);

        if (screenContext) {
          console.log('Saving screen context to log file...');
          await window.mainAPI.saveDomLog(screenContext);
          console.log('Screen context saved to log file.');
        }

        const messageWithContext = `
You are an AI assistant that helps users interact with a web page.
The user has given you a command: "${message}"

The user is currently on a page with the following visible, interactive elements (flat JSON list):
${JSON.stringify(screenContext, null, 2)}

Your task is to generate a sequence of commands to be executed on the page to fulfill the user's request.
The commands should be in a JSON array format. Each object in the array should have an "action" property and other properties depending on the action.

IMPORTANT:
- Only use URLs, selectors, and actions that are present in the provided context. Do NOT invent, guess, or hallucinate any links, selectors, or actions.
- When the user wants to visit or sign in to a page, look for the most relevant link or button in the context by matching its visible text, href, or other attributes.
- For navigation, always use the "goto" action with the "url" property set to the correct absolute or relative href from the context. Do NOT use relative URLs unless no absolute URL is available. Do NOT use "click" for navigation to external sites.
- When matching by text, use partial/substring matching, ignore case and extra whitespace, and select the closest match to the user's phrase.
- For clicking buttons or links on the current page, use "click" with the correct selector (by text, id, class, etc.).
- Always prefer exact or closest matches for text, href, or aria-label when selecting elements.
- If no matching element is found in the context, respond with an empty array: []

The available actions are:
- "goto": navigates to a new URL. Requires a "url" property.
- "click": clicks on an element. Requires a "selector" property (a standard CSS selector that matches the element in the context).
- "fill": types text into an input field. Requires a "selector" property and a "text" property.
- "scroll": scrolls an element or the window. Requires a "direction" property ('up' or 'down') and an optional "selector" property.
- "select": selects an option in a dropdown menu. Requires a "selector" property and a "value" property.
- "hover": hovers the mouse over an element. Requires a "selector" property.

Examples:
User command: "go to vehicle registration tax"
Context contains:
  { "tag": "a", "class": "tile", "text": "Vehicle Registration Tax (VRT)\n\nImporting a vehicle, calculating and paying VRT, reliefs, exemptions, appeals and vehicle conversions.", "href": "/en/vrt/index.aspx" }
Generated commands:
[
  {
    "action": "goto",
    "url": "/en/vrt/index.aspx"
  }
]

User command: "go to my account sign in page"
Context contains:
  { "tag": "a", "text": "myAccount", "href": "https://www.ros.ie/myaccount-web/sign_in.html?execution=e1s1&lang=en" }
Generated commands:
[
  {
    "action": "goto",
    "url": "https://www.ros.ie/myaccount-web/sign_in.html?execution=e1s1&lang=en"
  }
]

User command: "click the Search button"
Context contains:
  { "tag": "button", "id": "btnSearch", "text": "Search" }
Generated commands:
[
  {
    "action": "click",
    "selector": "#btnSearch"
  }
]

User command: "fill the search box with 'Ireland'"
Context contains:
  { "tag": "input", "id": "searchInput", "placeholder": "Search" }
Generated commands:
[
  {
    "action": "fill",
    "selector": "#searchInput",
    "text": "Ireland"
  }
]

Please generate the JSON array of commands. Provide only the JSON array, with no other text before or after it.
`;
        console.log('Sending message to LLM with context...');
        const llmResponse = await window.ollamaAPI.chat([{ role: 'user', content: messageWithContext }]);
        console.log('LLM response received:', llmResponse);
        await window.mainAPI.saveLlmLog(llmResponse);
        try {
          const commands = JSON.parse(llmResponse);
          addMessage("Executing the steps...", 'ai');
          await executeCommands(commands);
          addMessage("Done.", 'ai');
        } catch (e) {
          addMessage(llmResponse, 'ai');
        }
      } else if (intent === 'question') {
        // Extract visible text from the webview
        addMessage('Let me look that up for you...', 'ai');
        const pageText = await extractVisibleTextFromWebview();
        console.log('Extracted page text:', pageText);
        const prompt = `You are an AI assistant. The user is viewing a website and has asked: "${message}"\n\nHere is the visible text from the page:\n${pageText}\n\nPlease answer the user's question using only the information from the page. If the answer is not present, say so.`;
        const llmResponse = await window.ollamaAPI.chat([{ role: 'user', content: prompt }]);
        addMessage(llmResponse, 'ai');
        await window.mainAPI.saveLlmLog(llmResponse);
      } else {
        addMessage("Sorry, I couldn't understand your request.", 'ai');
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      addMessage('Sorry, I encountered an error. Please try again later.', 'ai');
    }
  };

  // Update the URL input when the webview navigates
  webview.addEventListener('did-navigate', () => {
    urlInput.value = webview.getURL();
  });

  // Initialize accessibility features
  initializeAccessibility({
    wcagScoreLabel,
    accessibilityReport,
    reportDetails,
    closeReportBtn,
    downloadReportBtn
  }, webview);

  webview.addEventListener('did-fail-load', (event) => {
    if (event.errorCode !== -3) { // -3 is ABORTED, which happens on new navigation
      console.error('Webview failed to load:', event.errorDescription);
      // Optionally, display an error message in the UI
    }
  });
};
