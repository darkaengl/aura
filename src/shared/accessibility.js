import { escapeHtml, calculateWcagScore } from './utils.js';

let currentAxeResults = null; // To store the latest axe-core results
let wcagScoreLabel = null;
let accessibilityReport = null;
let reportDetails = null;
let closeReportBtn = null;
let downloadReportBtn = null;
let webview = null;
export let wcagViolations = null;

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


const processViolations = (failures) => {
  let result = '';
  let totalDisplayableNodes = 0;
  const itemsWithDisplayableNodes = failures.map(item => {
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
    itemsWithDisplayableNodes.forEach(item => {
      result += `${item.id}: ${item.description}\n`;
      if (item.nodes && item.nodes.length > 0) {
        item.nodes.forEach(node => {
          result += result.includes(node.failureSummary) ? '' : ('\n' + node.failureSummary)
        });
      }
    });
  }

  return result;
}

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

export const initializeAccessibility = async (elements, webviewInstance) => {
  wcagScoreLabel = elements.wcagScoreLabel;
  accessibilityReport = elements.accessibilityReport;
  reportDetails = elements.reportDetails;
  closeReportBtn = elements.closeReportBtn;
  downloadReportBtn = elements.downloadReportBtn;
  webview = webviewInstance;

  // Load axe-core script once
  let axeCoreScriptContent;
  try {
    axeCoreScriptContent = await window.fileAPI.readLocalFile('assets/axe.min.js');
  } catch (error) {
    console.error('Failed to load axe.min.js:', error);
    if (wcagScoreLabel) {
      wcagScoreLabel.innerText = 'WCAG: Error';
      wcagScoreLabel.style.backgroundColor = 'red';
    }
    return; // Stop execution if axe-core can't be loaded
  }

  // Event listener for WCAG score label click to show report
  if (wcagScoreLabel) {
    wcagScoreLabel.addEventListener('click', () => {
      if (currentAxeResults) {
        // Add WCAG scoring criteria context at the top
        const scoringContext = `
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #2196F3;">
            <h3 style="margin-top: 0; color: #2196F3;">WCAG Scoring Criteria</h3>
            <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 15px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 20px; height: 20px; background-color: #FFD700; border-radius: 3px;"></div>
                <span><strong>Gold:</strong> ≥90% success rate</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 20px; height: 20px; background-color: #C0C0C0; border-radius: 3px;"></div>
                <span><strong>Silver:</strong> 70-89% success rate</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 20px; height: 20px; background-color: #CD7F32; border-radius: 3px;"></div>
                <span><strong>Bronze:</strong> &lt;70% success rate</span>
              </div>
            </div>
            
            <div style="background-color: #ffffff; padding: 12px; border-radius: 4px; border: 1px solid #e0e0e0;">
              <h4 style="margin-top: 0; margin-bottom: 10px; color: #333;">Score Interpretation:</h4>
              <p style="margin: 5px 0; font-size: 0.9em;">A typical score scale is 0-100, with higher numbers indicating better adherence to guidelines.</p>
              
              <div style="display: grid; gap: 8px; margin-top: 10px;">
                <div style="padding: 6px 10px; background-color: #ffebee; border-left: 3px solid #f44336; border-radius: 3px;">
                  <strong style="color: #c62828;">Poor Accessibility (0-49):</strong> Major barriers exist, and the site may be largely unusable.
                </div>
                <div style="padding: 6px 10px; background-color: #fff3e0; border-left: 3px solid #ff9800; border-radius: 3px;">
                  <strong style="color: #e65100;">Needs Improvement (50-69):</strong> Significant obstacles to usability remain.
                </div>
                <div style="padding: 6px 10px; background-color: #fff8e1; border-left: 3px solid #ffc107; border-radius: 3px;">
                  <strong style="color: #f57f17;">Fair Accessibility (70-89):</strong> Many key issues are resolved, but some inclusivity issues persist.
                </div>
                <div style="padding: 6px 10px; background-color: #e8f5e8; border-left: 3px solid #4caf50; border-radius: 3px;">
                  <strong style="color: #2e7d32;">Highly Accessible (90-95):</strong> Many common issues are addressed, but manual review is still needed for full verification.
                </div>
                <div style="padding: 6px 10px; background-color: #e3f2fd; border-left: 3px solid #2196f3; border-radius: 3px;">
                  <strong style="color: #1565c0;">Fully Compliant (100):</strong> All issues have been resolved, and manual checks have verified compliance.
                </div>
              </div>
            </div>
            
            <p style="margin-bottom: 0; margin-top: 12px; font-size: 0.9em; color: #666;">
              <strong>Calculation:</strong> Success rate = (Passed checks ÷ Total checks) × 100%
            </p>
            
            <div style="margin-top: 15px; padding: 10px; background-color: #e3f2fd; border-radius: 4px; border: 1px solid #2196f3;">
              <p style="margin: 0; font-size: 0.9em; color: #1565c0;">
                <strong>Want to learn more?</strong> 
                <a href="https://www.w3.org/WAI/standards-guidelines/wcag/wcag3-intro/" target="_blank" style="color: #1565c0; text-decoration: underline;">
                  Visit the W3C WCAG Guidelines
                </a>
              </p>
            </div>
          </div>
        `;
        
        reportDetails.innerHTML = scoringContext + formatAxeResults(currentAxeResults);
        accessibilityReport.style.display = 'flex'; // Show the modal
      } else {
        alert('No accessibility report available yet. Please load a page first.');
      }
    });
  }

  // Event listener for closing the report
  if (closeReportBtn) {
    closeReportBtn.addEventListener('click', () => {
      accessibilityReport.style.display = 'none'; // Hide the modal
    });
  }

  // Event listener for downloading the report
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

  // Webview did-finish-load event to run axe-core audit
  if (webview) {
    webview.addEventListener('did-finish-load', async () => {
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
      if (wcagScoreLabel) {
        wcagScoreLabel.innerText = `WCAG: ${score}`;
        wcagScoreLabel.style.backgroundColor = color;
      }

      // Populate Violation text for CSS-optimisation prompt
      wcagViolations = processViolations(currentAxeResults.violations);
    });
  }
};
