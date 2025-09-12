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
        return {
            score: 'N/A',
            color: '#808080'
        }; // Grey for not applicable
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

    return {
        score: `${successRatio.toFixed(2)}%`,
        color: color
    };
};

/**
 * Shows a status message with appropriate styling
 * @param {HTMLElement} simplificationStatus - The DOM element to display the status.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message (e.g., 'info', 'loading', 'success', 'error').
 */
export const showStatus = (simplificationStatus, message, type = 'info') => {
    simplificationStatus.textContent = message;
    simplificationStatus.className = `status-message ${type}`;
};

/**
 * Clears the status message
 * @param {HTMLElement} simplificationStatus - The DOM element displaying the status.
 */
export const clearStatus = (simplificationStatus) => {
    simplificationStatus.textContent = '';
    simplificationStatus.className = 'status-message';
};

/**
 * Copies simplified text to clipboard
 * @param {HTMLElement} simplifiedTextDisplay - The DOM element containing the simplified text.
 * @param {HTMLElement} simplificationStatus - The DOM element to display the status.
 */
export const copyToClipboard = async (simplifiedTextDisplay, simplificationStatus) => {
    try {
        const text = simplifiedTextDisplay.textContent;
        if (!text || text.startsWith('Error:')) {
            showStatus(simplificationStatus, 'No simplified text to copy', 'error');
            return;
        }

        await navigator.clipboard.writeText(text);
        showStatus(simplificationStatus, 'Simplified text copied to clipboard!', 'success');

        // Clear success message after 2 seconds
        setTimeout(() => {
            if (simplificationStatus.textContent.includes('copied')) {
                clearStatus(simplificationStatus);
            }
        }, 2000);

    } catch (error) {
        console.error('Failed to copy text:', error);
        showStatus(simplificationStatus, 'Failed to copy text to clipboard', 'error');
    }
};