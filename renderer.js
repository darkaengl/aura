/**
 * Calculates the WCAG score based on the number of passes and total checks.
 * @param {number} passes - The number of accessibility checks that passed.
 * @param {number} totalChecks - The total number of checks performed by axe-core.
 * @returns {{score: string, color: string}}
 */
const calculateWcagScore = (passes, totalChecks) => {
  if (totalChecks === 0) {
    return { score: 'N/A', color: '#808080' }; // Grey for not applicable
  }

  const successRatio = (passes / totalChecks) * 100;
  let color;

  if (successRatio >= 90) {
    color = '#FFD700'; // Gold
  } else if (successRatio >= 70) {
    color = '#C0C0C0'; // Silver
  } else {
    color = '#CD7F32'; // Bronze
  }

  return { score: `${successRatio.toFixed(2)}%`, color: color };
};

window.onload = async () => {
  const urlInput = document.getElementById('url-input');
  const backBtn = document.getElementById('back-btn');
  const forwardBtn = document.getElementById('forward-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const webview = document.getElementById('webview');
  const wcagScoreLabel = document.getElementById('wcag-score-label');
  const accessibilityReport = document.getElementById('accessibility-report');
  const accessibilityReportContent = document.getElementById('accessibility-report-content');
  const reportDetails = document.getElementById('report-details');
  const closeReportBtn = document.getElementById('close-report-btn');
  const downloadReportBtn = document.getElementById('download-report-btn');

  let currentAxeResults = null; // To store the latest axe-core results

  // Helper function to HTML-escape strings
  const escapeHtml = (unsafe) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Function to download JSON report
  const downloadJsonReport = (data, filename) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
   * Formats axe-core results into a readable HTML string.
   * @param {object} results - The axe-core results object.
   * @returns {string} HTML string of the report.
   */
  const formatAxeResults = (results) => {
    let html = '';

    const appendSection = (title, items) => {
      let totalDisplayableNodes = 0;
      const itemsWithDisplayableNodes = items.map(item => {
        if (item.nodes) {
          const filteredNodes = item.nodes.filter(node => node.impact && node.impact !== 'N/A');
          if (filteredNodes.length > 0) {
            totalDisplayableNodes += filteredNodes.length;
            return { ...item, nodes: filteredNodes };
          }
        }
        return null;
      }).filter(item => item !== null);

      if (totalDisplayableNodes > 0) {
        html += `<h3>${title} (${totalDisplayableNodes} elements across ${itemsWithDisplayableNodes.length} rules)</h3>`;
        html += `<ul>`;
        itemsWithDisplayableNodes.forEach(item => {
          html += `<li><strong>${item.id}:</strong> ${item.description} (<a href="${item.helpUrl}" target="_blank">Learn more</a>)`;
          if (item.nodes && item.nodes.length > 0) {
            html += `<ul>`;
            item.nodes.forEach(node => {
              html += `<li>
                <strong>Element:</strong> ${escapeHtml(node.html)}<br>
                <strong>Impact:</strong> ${node.impact}<br>
                <strong>Messages:</strong> ${node.failureSummary || 'N/A'}
              </li>`;
            });
            html += `</ul>`;
          }
          html += `</li>`;
        });
        html += `</ul>`;
      }
    };

    appendSection('Violations', results.violations);
    appendSection('Passes', results.passes);
    appendSection('Incomplete', results.incomplete);
    appendSection('Inapplicable', results.inapplicable);

    if (html === '') {
      html = '<p>No accessibility issues found or all checks were inapplicable.</p>';
    }
    return html;
  };

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

  // Event listener for WCAG score label click to show report
  wcagScoreLabel.addEventListener('click', () => {
    if (currentAxeResults) {
      reportDetails.innerHTML = formatAxeResults(currentAxeResults);
      accessibilityReport.style.display = 'flex'; // Show the modal
    } else {
      alert('No accessibility report available yet. Please load a page first.');
    }
  });

  // Event listener for closing the report
  closeReportBtn.addEventListener('click', () => {
    accessibilityReport.style.display = 'none'; // Hide the modal
  });

  // Event listener for downloading the report
  downloadReportBtn.addEventListener('click', () => {
    if (currentAxeResults) {
      const url = new URL(webview.getURL());
      const filename = `axe-report-${url.hostname}-${Date.now()}.json`;
      downloadJsonReport(currentAxeResults, filename);
    } else {
      alert('No accessibility report available to download.');
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
    currentAxeResults = JSON.parse(results); // Store the results

    const violations = currentAxeResults.violations.length;
    const passes = currentAxeResults.passes.length;
    const totalChecks = passes + violations + currentAxeResults.incomplete.length + currentAxeResults.inapplicable.length;

    const { score, color } = calculateWcagScore(passes, totalChecks);
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