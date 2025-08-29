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
  const simplifyBtn = document.getElementById('simplify-btn');

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

  // Call the Ollama model to read and simplify the CSS of the current page
  // TODO: prompt engineering for improved output
  simplifyBtn.addEventListener('click', () => {
    let newCSS = webview.executeJavaScript(`
      Array.from(document.styleSheets)
        .map(sheet => {
          try {
            return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\\n');
          } catch (e) {
            // Skip CORS-protected sheets
            return '';
          }
        })
        .filter(text => text.length)
        .join('\\n')
      `).then(async cssText => {
        const messages = [{
          role: 'user',
          content: 'Respond only with valid CSS contained within triple backticks (e.g: ``` CSS_HERE ```). Optimise the following CSS, making the resulting page simplified and more readable. CSS: ' + cssText
        }];
        // const schema = { 
        //   'type': 'object', 
        //   'properties': { 
        //       'optimised_css': { 
        //           'type': 'string'
        //       } 
        //   }, 
        //   'required': ['optimised_css']
        // };
        // console.log(cssText);
        let llmResponse = await window.ollamaAPI.chat(messages);
        // console.log(llmResponse);
        // console.log('\n');
        // console.log(JSON.parse(llmResponse).optimised_css);
        // console.log(llmResponse.split("```")[1]);
        const escaped = llmResponse.split("```")[1].slice(4)
                                                   .replace(/\\/g, '\\\\')     // escape backslashes
                                                   .replace(/`/g, '\\`')       // escape backticks
                                                   .replace(/\$/g, '\\$');     // escape dollar signs if using ${}

        const script = `
          (function() {
            let style = document.getElementById('dynamic-style');
            if (!style) {
              style = document.createElement('style');
              style.id = 'dynamic-style';
              document.head.appendChild(style);
            }
            style.textContent = \`${escaped}\`;
          })();
        `;

        return webview.executeJavaScript(script);
      });
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
