/**
 * Text extraction utilities for webview injection
 * This module provides functions to extract structured text content from web pages
 */

/**
 * Extracts text content from the current webpage
 * @param {Object} options - Extraction options
 * @param {string} options.mode - 'full' for entire page, 'selection' for selected text
 * @param {string} options.selector - Optional CSS selector to target specific elements
 * @returns {Object} Structured text data
 */
export const extractWebpageText = (options = {}) => {
  const { mode = 'full', selector = null } = options;
  
  try {
    let targetElement;
    
    if (mode === 'selection') {
      // Extract selected text
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        targetElement = range.commonAncestorContainer;
        if (targetElement.nodeType === Node.TEXT_NODE) {
          targetElement = targetElement.parentElement;
        }
      } else {
        return {
          error: true,
          message: 'No text selected'
        };
      }
    } else if (selector) {
      // Extract from specific selector
      targetElement = document.querySelector(selector);
      if (!targetElement) {
        return {
          error: true,
          message: `Element not found: ${selector}`
        };
      }
    } else {
      // Extract full page content
      targetElement = document.body || document.documentElement;
    }

    // Extract structured text content
    const extractedData = extractStructuredText(targetElement, mode === 'selection');
    
    // Add metadata
    extractedData.title = document.title || '';
    extractedData.url = window.location.href || '';
    extractedData.extractionTime = Date.now();
    extractedData.mode = mode;
    
    return extractedData;
    
  } catch (error) {
    console.error('Text extraction error:', error);
    return {
      error: true,
      message: `Extraction failed: ${error.message}`
    };
  }
};

/**
 * Extracts structured text from a DOM element
 * @param {Element} element - The DOM element to extract from
 * @param {boolean} selectionMode - Whether this is from a selection
 * @returns {Object} Structured text data
 */
const extractStructuredText = (element, selectionMode = false) => {
  const elements = [];
  let fullText = '';
  
  // Define element types we want to extract
  const textElements = selectionMode ? 
    [element] : 
    element.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, article, section, div, span');
  
  // If no structured elements found, fall back to text content
  if (textElements.length === 0) {
    const text = cleanText(element.textContent || '');
    return {
      text: text,
      wordCount: countWords(text),
      elements: [{
        type: 'paragraph',
        text: text
      }]
    };
  }
  
  // Process each element
  textElements.forEach(el => {
    const text = cleanText(el.textContent || '');
    
    // Skip empty elements or very short text
    if (text.length < 10) return;
    
    // Skip elements that are likely navigation, ads, or UI elements
    if (isUIElement(el)) return;
    
    const elementType = getElementType(el);
    
    elements.push({
      type: elementType,
      text: text,
      level: getHeadingLevel(el)
    });
    
    fullText += text + '\n\n';
  });
  
  // If no valid elements found, extract all text
  if (elements.length === 0) {
    const text = cleanText(element.textContent || '');
    fullText = text;
    elements.push({
      type: 'paragraph',
      text: text
    });
  }
  
  return {
    text: fullText.trim(),
    wordCount: countWords(fullText),
    elements: elements
  };
};

/**
 * Determines if an element is likely a UI element (nav, ads, etc.)
 * @param {Element} element - DOM element to check
 * @returns {boolean} True if likely a UI element
 */
const isUIElement = (element) => {
  const text = element.textContent || '';
  const className = element.className || '';
  const id = element.id || '';
  
  // Skip very short text
  if (text.length < 20) return true;
  
  // Skip elements with navigation/UI indicators
  const uiKeywords = ['nav', 'menu', 'header', 'footer', 'sidebar', 'ad', 'banner', 'popup', 'cookie', 'subscribe'];
  const combined = (className + ' ' + id).toLowerCase();
  
  return uiKeywords.some(keyword => combined.includes(keyword));
};

/**
 * Gets the semantic type of an element
 * @param {Element} element - DOM element
 * @returns {string} Element type
 */
const getElementType = (element) => {
  const tagName = element.tagName.toLowerCase();
  
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
    return 'heading';
  } else if (tagName === 'li') {
    return 'list-item';
  } else if (tagName === 'blockquote') {
    return 'quote';
  } else if (tagName === 'p') {
    return 'paragraph';
  } else {
    // For divs, spans, etc., try to infer from content
    const text = element.textContent || '';
    if (text.length > 200) {
      return 'paragraph';
    } else {
      return 'text';
    }
  }
};

/**
 * Gets heading level for heading elements
 * @param {Element} element - DOM element
 * @returns {number|undefined} Heading level (1-6) or undefined
 */
const getHeadingLevel = (element) => {
  const tagName = element.tagName.toLowerCase();
  const match = tagName.match(/^h([1-6])$/);
  return match ? parseInt(match[1]) : undefined;
};

/**
 * Cleans and normalizes text content
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
const cleanText = (text) => {
  return text
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/\n\s*\n/g, '\n') // Remove excessive line breaks
    .trim();
};

/**
 * Counts words in text
 * @param {string} text - Text to count
 * @returns {number} Word count
 */
const countWords = (text) => {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
};

/**
 * Gets the text extraction script as a string for injection
 * This returns the complete script that can be injected into a webview
 * @returns {string} Injectable JavaScript code
 */
export const getTextExtractionScript = () => {
  return `
(function() {
  // All functions are defined inline to avoid reference issues
  
  const cleanText = (text) => {
    return text
      .replace(/\\s+/g, ' ')  // Normalize whitespace
      .replace(/\\n\\s*\\n/g, '\\n') // Remove excessive line breaks
      .trim();
  };
  
  const countWords = (text) => {
    return text.trim() ? text.trim().split(/\\s+/).length : 0;
  };
  
  const getHeadingLevel = (element) => {
    const tagName = element.tagName.toLowerCase();
    const match = tagName.match(/^h([1-6])$/);
    return match ? parseInt(match[1]) : undefined;
  };
  
  const getElementType = (element) => {
    const tagName = element.tagName.toLowerCase();
    
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      return 'heading';
    } else if (tagName === 'li') {
      return 'list-item';
    } else if (tagName === 'blockquote') {
      return 'quote';
    } else if (tagName === 'p') {
      return 'paragraph';
    } else {
      // For divs, spans, etc., try to infer from content
      const text = element.textContent || '';
      if (text.length > 200) {
        return 'paragraph';
      } else {
        return 'text';
      }
    }
  };
  
  const isUIElement = (element) => {
    const text = element.textContent || '';
    const className = element.className || '';
    const id = element.id || '';
    
    // Skip very short text
    if (text.length < 20) return true;
    
    // Skip elements with navigation/UI indicators
    const uiKeywords = ['nav', 'menu', 'header', 'footer', 'sidebar', 'ad', 'banner', 'popup', 'cookie', 'subscribe'];
    const combined = (className + ' ' + id).toLowerCase();
    
    return uiKeywords.some(keyword => combined.includes(keyword));
  };
  
  const extractStructuredText = (element, selectionMode = false) => {
    const elements = [];
    let fullText = '';
    
    // Define element types we want to extract
    const textElements = selectionMode ? 
      [element] : 
      element.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, article, section, div, span');
    
    // If no structured elements found, fall back to text content
    if (textElements.length === 0) {
      const text = cleanText(element.textContent || '');
      return {
        text: text,
        wordCount: countWords(text),
        elements: [{
          type: 'paragraph',
          text: text
        }]
      };
    }
    
    // Process each element
    textElements.forEach(el => {
      const text = cleanText(el.textContent || '');
      
      // Skip empty elements or very short text
      if (text.length < 10) return;
      
      // Skip elements that are likely navigation, ads, or UI elements
      if (isUIElement(el)) return;
      
      const elementType = getElementType(el);
      
      elements.push({
        type: elementType,
        text: text,
        level: getHeadingLevel(el)
      });
      
      fullText += text + '\\n\\n';
    });
    
    // If no valid elements found, extract all text
    if (elements.length === 0) {
      const text = cleanText(element.textContent || '');
      fullText = text;
      elements.push({
        type: 'paragraph',
        text: text
      });
    }
    
    return {
      text: fullText.trim(),
      wordCount: countWords(fullText),
      elements: elements
    };
  };
  
  const extractWebpageText = (options = {}) => {
    const { mode = 'full', selector = null } = options;
    
    try {
      let targetElement;
      
      if (mode === 'selection') {
        // Extract selected text
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          targetElement = range.commonAncestorContainer;
          if (targetElement.nodeType === Node.TEXT_NODE) {
            targetElement = targetElement.parentElement;
          }
        } else {
          return {
            error: true,
            message: 'No text selected'
          };
        }
      } else if (selector) {
        // Extract from specific selector
        targetElement = document.querySelector(selector);
        if (!targetElement) {
          return {
            error: true,
            message: 'Element not found: ' + selector
          };
        }
      } else {
        // Extract full page content
        targetElement = document.body || document.documentElement;
      }

      // Extract structured text content
      const extractedData = extractStructuredText(targetElement, mode === 'selection');
      
      // Add metadata
      extractedData.title = document.title || '';
      extractedData.url = window.location.href || '';
      extractedData.extractionTime = Date.now();
      extractedData.mode = mode;
      
      return extractedData;
      
    } catch (error) {
      console.error('Text extraction error:', error);
      return {
        error: true,
        message: 'Extraction failed: ' + error.message
      };
    }
  };
  
  // Make the function available globally in the webview context
  window.extractWebpageText = extractWebpageText;
  
  return 'Text extraction script loaded successfully';
})();
`;
};