// renderer.js
// Use the exposed API to make the call
const runOllama = async () => {
  try {
    const messages = [{ role: 'user', content: 'Why is the sky blue?' }];
    // The ollamaAPI object is now available on `window`
    const responseContent = await window.ollamaAPI.chat(messages);
    console.log('Response from Ollama:');
    // Assuming responseContent is a string or an object with a 'text' property
    const ollama_response = document.getElementById('ollama')
    ollama_response.innerText = responseContent; // Display the response in the info element

    // console.log(responseContent);
  } catch (error) {
    console.error('Failed to get response from Ollama:', error);
  }
};

//runOllama();

window.onload = () => {
  const urlInput = document.getElementById('url-input');
  const backBtn = document.getElementById('back-btn');
  const forwardBtn = document.getElementById('forward-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const webview = document.getElementById('webview');

  /**
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

  // Update the URL input when the webview navigates
  webview.addEventListener('did-navigate', () => {
    urlInput.value = webview.getURL();
  });

  // Update button states based on navigation history
  webview.addEventListener('did-finish-load', () => {
    backBtn.disabled = !webview.canGoBack();
    forwardBtn.disabled = !webview.canGoForward();
  });

  webview.addEventListener('did-fail-load', (event) => {
    if (event.errorCode !== -3) { // -3 is ABORTED, which happens on new navigation
      console.error('Webview failed to load:', event.errorDescription);
      // Optionally, display an.error message in the UI
    }
  });
};