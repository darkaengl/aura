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

  // Chat interface elements
  const chatContainer = document.getElementById('chat-container');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');

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

  const sendMessage = async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    chatInput.value = '';

    try {
      // We are reusing the ollamaAPI that was already set up.
      const response = await window.ollamaAPI.chat([{ role: 'user', content: message }]);
      addMessage(response, 'ai');
    } catch (error) {
      console.error('Error communicating with Ollama:', error);
      addMessage('Sorry, I am having trouble connecting to the AI. Please try again later.', 'ai');
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
