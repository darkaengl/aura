/**
 * Calculates the WCAG score based on the number of violations.
 * @param {number} violations - The number of accessibility violations found.
 * @param {number} totalChecks - The total number of checks performed by axe-core.
 * @returns {{score: string, color: string}}
 */
const calculateWcagScore = (violations, totalChecks) => {
  if (totalChecks === 0) {
    return { score: 'N/A', color: '#808080' }; // Grey for not applicable
  }

  const violationPercentage = (violations / totalChecks) * 100;
  let color;

  if (violationPercentage < 10) {
    color = '#FFD700'; // Gold
  } else if (violationPercentage < 30) {
    color = '#C0C0C0'; // Silver
  } else {
    color = '#CD7F32'; // Bronze
  }

  return { score: `${violationPercentage.toFixed(2)}%`, color: color };
};

window.onload = async () => {
  const urlInput = document.getElementById('url-input');
  const backBtn = document.getElementById('back-btn');
  const forwardBtn = document.getElementById('forward-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const webview = document.getElementById('webview');
  const wcagScoreLabel = document.getElementById('wcag-score-label');

  // Load axe-core script once
  let axeCoreScriptContent;
  try {
    axeCoreScriptContent = await window.fileAPI.readLocalFile('assets/axe.min.js');
  } catch (error) {
    console.error('Failed to load axe.min.js:', error);
    wcagScoreLabel.innerText = 'WCAG: Error';
    wcagScoreLabel.style.backgroundColor = 'red';
    return; // Stop execution if axe-core can't be loaded
  }

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

  // Update button states based on navigation history and run axe-core audit
  webview.addEventListener('did-finish-load', async () => {
    backBtn.disabled = !webview.canGoBack();
    forwardBtn.disabled = !webview.canGoForward();

    // Inject axe-core into the webview
    await webview.executeJavaScript(axeCoreScriptContent);

    // Run axe-core audit and get results
    const results = await webview.executeJavaScript(`
      (async () => {
        if (typeof axe === 'undefined') {
          return JSON.stringify({ violations: [], passes: [], incomplete: [], inapplicable: [] });
        }
        const result = await axe.run(document);
        return JSON.stringify(result);
      })();
    `);
    const axeResults = JSON.parse(results);

    const violations = axeResults.violations.length;
    const totalChecks = axeResults.passes.length + violations + axeResults.incomplete.length + axeResults.inapplicable.length;

    const { score, color } = calculateWcagScore(violations, totalChecks);
    wcagScoreLabel.innerText = `WCAG: ${score}`;
    wcagScoreLabel.style.backgroundColor = color;
  });

  webview.addEventListener('did-fail-load', (event) => {
    if (event.errorCode !== -3) { // -3 is ABORTED, which happens on new navigation
      console.error('Webview failed to load:', event.errorDescription);
      // Optionally, display an error message in the UI
    }
  });
};