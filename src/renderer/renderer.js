import { initializeAccessibility } from '../shared/accessibility.js';
import { getTextExtractionScript } from '../shared/text-extraction.js';
import { createSimplificationPrompt, splitTextIntoChunks, createChunkPrompt, validateOptions, estimateProcessingTime } from '../shared/simplification-prompts.js';

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

  // Text Simplification Elements
  const simplifyTextBtn = document.getElementById('simplify-text-btn');
  const textSimplificationModal = document.getElementById('text-simplification-modal');
  const closeSimplificationBtn = document.getElementById('close-simplification-btn');
  const complexitySelect = document.getElementById('complexity-select');
  const extractTextBtn = document.getElementById('extract-text-btn');
  const simplificationStatus = document.getElementById('simplification-status');
  const originalTextDisplay = document.getElementById('original-text-display');
  const simplifiedTextDisplay = document.getElementById('simplified-text-display');
  const originalWordCount = document.getElementById('original-word-count');
  const simplifiedWordCount = document.getElementById('simplified-word-count');
  const wordReduction = document.getElementById('word-reduction');
  const copySimplifiedText = document.getElementById('copy-simplified-text');
  const replacePageText = document.getElementById('replace-page-text');

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

  // Text Simplification Functionality
  let currentTextData = null;
  let isProcessing = false;

  /**
   * Shows a status message with appropriate styling
   */
  const showStatus = (message, type = 'info') => {
    simplificationStatus.textContent = message;
    simplificationStatus.className = `status-message ${type}`;
  };

  /**
   * Clears the status message
   */
  const clearStatus = () => {
    simplificationStatus.textContent = '';
    simplificationStatus.className = 'status-message';
  };

  /**
   * Updates button states during processing
   */
  const setProcessingState = (processing) => {
    isProcessing = processing;
    extractTextBtn.disabled = processing;
    simplifyTextBtn.disabled = processing;
    
    if (processing) {
      extractTextBtn.textContent = 'Processing...';
      simplifyTextBtn.classList.add('loading');
    } else {
      extractTextBtn.textContent = 'Extract & Simplify Text';
      simplifyTextBtn.classList.remove('loading');
    }
  };

  /**
   * Extracts text from the current webview page
   */
  const extractPageText = async () => {
    try {
      showStatus('Extracting text from page...', 'loading');
      
      // Inject text extraction script into webview
      const scriptResult = await webview.executeJavaScript(getTextExtractionScript());
      console.log('Text extraction script loaded:', scriptResult);
      
      // Extract the text using the injected function
      const extractionResult = await webview.executeJavaScript(`
        (function() {
          try {
            return JSON.stringify(extractWebpageText({ mode: 'full' }));
          } catch (error) {
            return JSON.stringify({ error: true, message: error.message });
          }
        })();
      `);
      
      const textData = JSON.parse(extractionResult);
      
      if (textData.error) {
        throw new Error(textData.message);
      }
      
      if (!textData.text || textData.text.trim().length === 0) {
        throw new Error('No text content found on this page');
      }
      
      return textData;
      
    } catch (error) {
      console.error('Text extraction failed:', error);
      throw new Error(`Failed to extract text: ${error.message}`);
    }
  };

  /**
   * Processes text through Ollama for simplification
   */
  const processTextWithOllama = async (textData, options) => {
    try {
      const validatedOptions = validateOptions(options);
      const { text, title, url } = textData;
      
      // Estimate processing time and show to user
      const estimatedTime = estimateProcessingTime(textData.wordCount, validatedOptions.complexity);
      const estimatedSeconds = Math.ceil(estimatedTime / 1000);
      showStatus(`Simplifying text... (estimated ${estimatedSeconds}s)`, 'loading');
      
      // For very large texts, split into chunks
      if (text.length > 8000) {
        return await processTextInChunks(textData, validatedOptions);
      }
      
      // Process single text block
      const promptData = createSimplificationPrompt(text, {
        ...validatedOptions,
        title,
        url,
        wordCount: textData.wordCount
      });
      
      const result = await window.textSimplificationAPI.processText(textData, validatedOptions);
      
      if (result.error) {
        throw new Error(result.message);
      }
      
      return result;
      
    } catch (error) {
      console.error('Text processing failed:', error);
      throw error;
    }
  };

  /**
   * Processes large text by splitting into chunks
   */
  const processTextInChunks = async (textData, options) => {
    const chunks = splitTextIntoChunks(textData.text, 3000);
    let combinedSimplifiedText = '';
    let currentSimplifiedWordCount = 0;
    const originalWordCount = textData.wordCount;

    // Clear previous simplified text display
    simplifiedTextDisplay.textContent = '';
    simplifiedWordCount.textContent = '0';
    wordReduction.textContent = '0%';
    
    showStatus(`Processing ${chunks.length} text chunks...`, 'loading');
    
    for (let i = 0; i < chunks.length; i++) {
      showStatus(`Processing chunk ${i + 1} of ${chunks.length}...`, 'loading');
      
      const chunkData = {
        text: chunks[i],
        title: textData.title,
        url: textData.url
      };
      
      const result = await window.textSimplificationAPI.processText(chunkData, options);
      
      if (result.error) {
        throw new Error(`Chunk ${i + 1} failed: ${result.message}`);
      }
      
      // Append simplified chunk to display and combined text
      const simplifiedChunk = result.simplified;
      combinedSimplifiedText += (i > 0 ? '\n\n' : '') + simplifiedChunk;
      simplifiedTextDisplay.textContent = combinedSimplifiedText;

      // Update word counts dynamically
      currentSimplifiedWordCount = combinedSimplifiedText.split(/\s+/).filter(word => word.length > 0).length;
      simplifiedWordCount.textContent = currentSimplifiedWordCount.toLocaleString();
      
      const currentWordReductionPercent = ((originalWordCount - currentSimplifiedWordCount) / originalWordCount * 100).toFixed(1);
      wordReduction.textContent = `${currentWordReductionPercent}%`;
    }
    
    // Final result object
    return {
      original: textData.text,
      simplified: combinedSimplifiedText,
      complexity: options.complexity,
      processingTime: Date.now(),
      model: 'llama3.2',
      wordReduction: parseFloat(((originalWordCount - currentSimplifiedWordCount) / originalWordCount * 100).toFixed(1)),
      metadata: {
        originalWordCount,
        simplifiedWordCount: currentSimplifiedWordCount,
        title: textData.title,
        url: textData.url,
        chunks: chunks.length
      }
    };
  };

  /**
   * Updates the display with original and simplified text
   */
  const updateTextDisplay = (textData, simplificationResult) => {
    // Update original text panel
    originalTextDisplay.textContent = textData.text;
    originalWordCount.textContent = textData.wordCount.toLocaleString();
    
    // Update simplified text panel
    if (simplificationResult.error) {
      simplifiedTextDisplay.textContent = `Error: ${simplificationResult.message}`;
      simplifiedWordCount.textContent = '0';
      wordReduction.textContent = '0%';
    } else {
      simplifiedTextDisplay.textContent = simplificationResult.simplified;
      simplifiedWordCount.textContent = simplificationResult.metadata.simplifiedWordCount.toLocaleString();
      wordReduction.textContent = `${simplificationResult.wordReduction}%`;
    }
    
    // Enable/disable action buttons
    copySimplifiedText.disabled = simplificationResult.error;
    replacePageText.disabled = simplificationResult.error;
    
    // Reset replace button text if it was previously used
    if (replacePageText.textContent === 'Text Replaced') {
      replacePageText.textContent = 'Replace Page Text';
    }
  };

  /**
   * Main function to extract and simplify text
   */
  const extractAndSimplifyText = async () => {
    if (isProcessing) return;
    
    try {
      setProcessingState(true);
      clearStatus();
      
      // Extract text from page
      const textData = await extractPageText();
      currentTextData = textData;
      
      showStatus(`Extracted ${textData.wordCount} words. Processing with Ollama...`, 'loading');
      
      // Get selected complexity level
      const complexity = complexitySelect.value;
      
      // Process with Ollama
      const result = await processTextWithOllama(textData, { complexity });
      
      // Update display
      updateTextDisplay(textData, result);
      
      showStatus(`Text simplified successfully! Reduced by ${result.wordReduction}% (${result.metadata.originalWordCount} → ${result.metadata.simplifiedWordCount} words)`, 'success');
      
    } catch (error) {
      console.error('Text simplification failed:', error);
      showStatus(`Error: ${error.message}`, 'error');
      
      // Show partial results if we have extracted text
      if (currentTextData) {
        updateTextDisplay(currentTextData, { error: true, message: error.message });
      }
    } finally {
      setProcessingState(false);
    }
  };

  /**
   * Copies simplified text to clipboard
   */
  const copyToClipboard = async () => {
    try {
      const text = simplifiedTextDisplay.textContent;
      if (!text || text.startsWith('Error:')) {
        showStatus('No simplified text to copy', 'error');
        return;
      }
      
      await navigator.clipboard.writeText(text);
      showStatus('Simplified text copied to clipboard!', 'success');
      
      // Clear success message after 2 seconds
      setTimeout(() => {
        if (simplificationStatus.textContent.includes('copied')) {
          clearStatus();
        }
      }, 2000);
      
    } catch (error) {
      console.error('Failed to copy text:', error);
      showStatus('Failed to copy text to clipboard', 'error');
    }
  };

  /**
   * Replaces the original page text with simplified text
   */
  const replacePageTextWithSimplified = async () => {
    try {
      const simplifiedText = simplifiedTextDisplay.textContent;
      if (!simplifiedText || simplifiedText.startsWith('Error:')) {
        showStatus('No simplified text to replace with', 'error');
        return;
      }

      if (!currentTextData || !currentTextData.elements) {
        showStatus('No original text structure available for replacement', 'error');
        return;
      }

      showStatus('Replacing page text with simplified version...', 'loading');

      // Create replacement script that will modify the page content
      const replacementScript = `
        (function() {
          try {
            const simplifiedText = ${JSON.stringify(simplifiedText)};
            
            // Create a simple replacement by targeting main content areas
            const contentSelectors = [
              'main', 'article', '[role="main"]', '.content', '#content',
              '.post-content', '.entry-content', '.article-content'
            ];
            
            let replaced = false;
            
            // Try to find and replace main content area
            for (const selector of contentSelectors) {
              const element = document.querySelector(selector);
              if (element) {
                // Create a new div with simplified text
                const newContent = document.createElement('div');
                newContent.style.cssText = 'line-height: 1.6; font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;';
                
                // Split simplified text into paragraphs and create proper structure
                const paragraphs = simplifiedText.split('\\n\\n').filter(p => p.trim());
                paragraphs.forEach(paragraph => {
                  const p = document.createElement('p');
                  p.style.cssText = 'margin-bottom: 16px; font-size: 16px;';
                  p.textContent = paragraph.trim();
                  newContent.appendChild(p);
                });
                
                // Add header indicating this is simplified
                const header = document.createElement('div');
                header.style.cssText = 'background: #e8f5e8; border: 1px solid #4caf50; border-radius: 4px; padding: 12px; margin-bottom: 20px; font-weight: bold; color: #2e7d32;';
                header.textContent = '📝 This page content has been simplified for easier reading';
                newContent.insertBefore(header, newContent.firstChild);
                
                // Replace the content
                element.innerHTML = '';
                element.appendChild(newContent);
                replaced = true;
                break;
              }
            }
            
            // Fallback: replace body content if no main content area found
            if (!replaced) {
              // Find paragraphs and replace them
              const paragraphs = document.querySelectorAll('p, div');
              const textParagraphs = simplifiedText.split('\\n\\n').filter(p => p.trim());
              let textIndex = 0;
              
              paragraphs.forEach(p => {
                if (p.textContent.trim().length > 50 && textIndex < textParagraphs.length) {
                  p.textContent = textParagraphs[textIndex];
                  p.style.cssText = 'line-height: 1.6; margin-bottom: 16px; font-size: 16px;';
                  textIndex++;
                }
              });
              
              replaced = textIndex > 0;
            }
            
            return JSON.stringify({ success: replaced, message: replaced ? 'Text replaced successfully' : 'Could not find suitable content to replace' });
            
          } catch (error) {
            return JSON.stringify({ success: false, message: error.message });
          }
        })();
      `;

      const result = await webview.executeJavaScript(replacementScript);
      const replacementResult = JSON.parse(result);

      if (replacementResult.success) {
        showStatus('Page text replaced with simplified version!', 'success');
        replacePageText.disabled = true;
        replacePageText.textContent = 'Text Replaced';
      } else {
        throw new Error(replacementResult.message);
      }

    } catch (error) {
      console.error('Failed to replace page text:', error);
      showStatus(`Failed to replace text: ${error.message}`, 'error');
    }
  };

  // Event Listeners for Text Simplification
  simplifyTextBtn.addEventListener('click', () => {
    textSimplificationModal.style.display = 'flex';
  });

  closeSimplificationBtn.addEventListener('click', () => {
    textSimplificationModal.style.display = 'none';
  });

  extractTextBtn.addEventListener('click', extractAndSimplifyText);

  copySimplifiedText.addEventListener('click', copyToClipboard);

  replacePageText.addEventListener('click', replacePageTextWithSimplified);

  // Close modal when clicking outside
  textSimplificationModal.addEventListener('click', (event) => {
    if (event.target === textSimplificationModal) {
      textSimplificationModal.style.display = 'none';
    }
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
