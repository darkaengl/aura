import { escapeHtml, calculateWcagScore } from '../shared/utils.js';

let currentAxeResults = null; // To store the latest axe-core results

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

export const initializeAccessibility = async (elements, webview) => {
  const { wcagScoreLabel, accessibilityReport, reportDetails, closeReportBtn, downloadReportBtn } = elements;

  let axeCoreScriptContent;
  try {
    axeCoreScriptContent = await window.fileAPI.readLocalFile('assets/axe.min.js');
  } catch (error) {
    console.error('Failed to load axe.min.js:', error);
    if (wcagScoreLabel) {
      wcagScoreLabel.innerText = 'WCAG: Error';
      wcagScoreLabel.style.backgroundColor = 'red';
    }
    return;
  }

  if (wcagScoreLabel) {
    wcagScoreLabel.addEventListener('click', () => {
      if (currentAxeResults) {
        reportDetails.innerHTML = formatAxeResults(currentAxeResults);
        accessibilityReport.style.display = 'flex';
      } else {
        alert('No accessibility report available yet. Please load a page first.');
      }
    });
  }

  if (closeReportBtn) {
    closeReportBtn.addEventListener('click', () => {
      accessibilityReport.style.display = 'none';
    });
  }

  if (downloadReportBtn) {
    downloadReportBtn.addEventListener('click', () => {
      if (currentAxeResults) {
        const url = new URL(webview.getURL());
        const filename = `axe-report-${url.hostname}-${Date.now()}.json`;
        downloadJsonReport(currentAxeResults, filename);
      } else {
        alert('No accessibility report available to download.');
      }
    });
  }

  if (webview) {
    webview.addEventListener('did-finish-load', async () => {
      await webview.executeJavaScript(axeCoreScriptContent);
      const results = await webview.executeJavaScript(`
        (async () => {
          if (typeof axe === 'undefined') {
            return JSON.stringify({ violations: [], passes: [], incomplete: [], inapplicable: [] });
          }
          const result = await axe.run(document);
          return JSON.stringify(result);
        })();
      `);
      currentAxeResults = JSON.parse(results);

      const violations = currentAxeResults.violations.length;
      const passes = currentAxeResults.passes.length;
      const totalChecks = passes + violations + currentAxeResults.incomplete.length + currentAxeResults.inapplicable.length;

      const { score, color } = calculateWcagScore(passes, totalChecks);
      if (wcagScoreLabel) {
        wcagScoreLabel.innerText = `WCAG: ${score}`;
        wcagScoreLabel.style.backgroundColor = color;
      }
    });

    webview.addEventListener('did-fail-load', (event) => {
      if (event.errorCode !== -3) { // -3 is ABORTED, which happens on new navigation
        console.error('Webview failed to load:', event.errorDescription);
        // Optionally, display an error message in the UI
      }
    });
  }
};