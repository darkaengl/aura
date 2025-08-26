
/**
 * Helper function to HTML-escape strings
 * @param {string} unsafe - The string to escape.
 * @returns {string} The HTML-escaped string.
 */
export const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Calculates the WCAG score based on the number of passes and total checks.
 * @param {number} passes - The number of accessibility checks that passed.
 * @param {number} totalChecks - The total number of checks performed by axe-core.
 * @returns {{score: string, color: string}}
 */
export const calculateWcagScore = (passes, totalChecks) => {
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
