// acknowledgmentHandler.js
// Scans current webview page for acknowledgment / terms / consent checkboxes and checks them.
// Modular extraction of logic from original aura inline renderer implementation.

/**
 * Perform acknowledgment checkbox scanning and auto-check.
 * @param {Electron.WebviewTag} webview - The target webview.
 * @returns {Promise<{success:boolean, acknowledged:Array<{label:string, checked:boolean}>, error?:string}>}
 */
export async function performAcknowledgment(webview) {
  if (!webview) {
    return { success: false, acknowledged: [], error: 'No webview provided' };
  }

  const script = `(() => {
      try {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  const acknowledgedCheckboxes = [];
  const acknowledgmentKeywords = ['acknowledge','accept','agree','confirm','terms','conditions','privacy','consent']; // kept for backward compat; runtime import not available inside executeJavaScript sandbox

        checkboxes.forEach(checkbox => {
          if (checkbox.offsetParent !== null && !checkbox.disabled) { // Visible & enabled
            const label = (checkbox.labels && checkbox.labels[0] && checkbox.labels[0].textContent) ||
                          (checkbox.nextElementSibling && checkbox.nextElementSibling.textContent) ||
                          (checkbox.parentElement && checkbox.parentElement.textContent) || '';
            const labelLower = label.toLowerCase();
            if (acknowledgmentKeywords.some(k => labelLower.includes(k))) {
              if (!checkbox.checked) {
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                const parent = checkbox.parentElement || checkbox;
                const originalStyle = parent.style.cssText;
                parent.style.backgroundColor = '#90EE90'; // match HIGHLIGHT.AGREEMENT
                parent.style.transition = 'background-color 0.3s';
                setTimeout(() => {
                  parent.style.backgroundColor = '';
                  setTimeout(() => { parent.style.cssText = originalStyle; }, 300);
                }, 1000);
              }
              acknowledgedCheckboxes.push({ label: label.trim(), checked: true });
            }
          }
        });
        return { success: true, acknowledged: acknowledgedCheckboxes };
      } catch (e) {
        return { success: false, acknowledged: [], error: e.message };
      }
    })();`;

  try {
    const result = await webview.executeJavaScript(script, true);
    if (!result || result.success === false) {
      return { success: false, acknowledged: [], error: result && result.error ? result.error : 'Unknown error' };
    }
    return result;
  } catch (err) {
    return { success: false, acknowledged: [], error: err.message };
  }
}

/**
 * Simple phrase matcher to detect agreement voice commands.
 * @param {string} text
 * @returns {boolean}
 */
export function isAgreementPhrase(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return ['i agree','i accept','i acknowledge','agree to terms','accept terms','agree and continue','accept and continue','agree to the terms','accept the terms'].some(p => t.includes(p));
}
