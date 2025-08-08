// renderer.js
const information = document.getElementById('info')
information.innerText = `This app is using Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`


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

runOllama();

window.onload = () => {
  const urlInput = document.getElementById('url-input');
  const navigateBtn = document.getElementById('navigate-btn');
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

  // Add event listener for the 'Go' button click
  navigateBtn.addEventListener('click', navigate);

  // Add event listener for the 'Enter' key press in the input field
  urlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      navigate();
    }
  });

  // Optional: Add an event listener to keep the address bar in sync with the current URL
  webview.addEventListener('did-finish-load', (event) => {
    // Check if the webview actually loaded a valid URL
    if (webview.getURL() !== 'about:blank') {
      urlInput.value = webview.getURL();
    }
  });
};