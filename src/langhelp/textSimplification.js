import {
    getTextExtractionScript
} from '../shared/text-extraction.js';
import {
    showStatus,
    clearStatus,
    copyToClipboard
} from '../shared/utils.js';
import {
    processTextWithOllama
} from './ollamaHandler.js';
import {
    getOpenAIChatCompletion
} from '../helpers/openai.js';
import {
    countWords
} from '../shared/simplification-prompts.js'; // New import
import {
    marked
} from '../../node_modules/marked/lib/marked.esm.js';

/**
 * Updates button states during processing
 */
export const setProcessingState = (processing, {
    simplifyPageBtn,
    simplifyTextBtn,
    simplifyParagraphsInPlaceBtn
}) => {
    simplifyPageBtn.disabled = processing;
    simplifyTextBtn.disabled = processing;
    if (simplifyParagraphsInPlaceBtn) {
        simplifyParagraphsInPlaceBtn.disabled = processing;
    }

    if (processing) {
        simplifyPageBtn.textContent = 'Processing...';
        simplifyPageBtn.classList.add('loading');
    } else {
        simplifyPageBtn.textContent = 'Simplify Page';
        simplifyPageBtn.classList.remove('loading');
    }
};

/**
 * Extracts text from the current webview page
 */
export const extractPageText = async (webview, simplificationStatus) => {
    try {
        showStatus(simplificationStatus, 'Extracting text from page...', 'loading');

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
 * Updates the display with original and simplified text
 */
export const updateTextDisplay = (textData, simplificationResult, {
    simplifiedTextDisplay,
    copySimplifiedText,
    replacePageText
}) => {
    console.log(`[updateTextDisplay] Called with simplificationResult:`, simplificationResult);
    // Update simplified text panel
    if (simplificationResult.error) {
        simplifiedTextDisplay.innerHTML = `<p style="color: red;">Error: ${simplificationResult.message}</p>`;
    } else {
        console.log(`[updateTextDisplay] Updating simplifiedTextDisplay with:`, simplificationResult.simplified);
        simplifiedTextDisplay.innerHTML = marked.parse(simplificationResult.simplified);
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
 * Processes text with OpenAI for simplification.
 * @param {Object} textData - The extracted text data.
 * @param {Object} options - Options for simplification (e.g., complexity).
 * @returns {Object} - The simplification result.
 */
const processTextWithOpenAI = async (textData, { complexity }) => {
    const prompt = `Simplify the following text to a ${complexity} level. Ensure the output is well-structured with appropriate headings and subheadings (using Markdown), and avoid over-condensing the content. Maintain the original meaning and important details. Provide only the simplified text, without any conversational filler or extra explanations.

    Complexity levels:
    - simple: Elementary vocabulary and sentence structure.
    - moderate: Common vocabulary and clear sentence structure.
    - advanced: Clear but detailed, suitable for a general audience.

    Original Text:
    ${textData.text}
    `;

    try {
        const simplifiedText = await getOpenAIChatCompletion(prompt);
        if (!simplifiedText) {
            throw new Error('OpenAI returned an empty response.');
        }

        const originalWordCount = textData.wordCount;
        const simplifiedWordCount = simplifiedText.split(/\s+/).filter(word => word.length > 0).length;
        const wordReduction = originalWordCount > 0 ? ((originalWordCount - simplifiedWordCount) / originalWordCount * 100).toFixed(1) : 0;

        return {
            simplified: simplifiedText,
            wordReduction: wordReduction,
            metadata: {
                originalWordCount: originalWordCount,
                simplifiedWordCount: simplifiedWordCount,
                complexity: complexity,
                model: 'OpenAI'
            }
        };
    } catch (error) {
        console.error('Error processing text with OpenAI:', error);
        throw new Error(`OpenAI simplification failed: ${error.message}`);
    }
};

export const extractText = async (deps) => {
    const {
        isProcessingRef,
        setProcessingState,
        clearStatus,
        extractPageText,
        currentTextDataRef,
        simplificationStatus,
        webview,
        simplifyPageBtn
    } = deps;

    if (isProcessingRef.current) return;

    try {
        setProcessingState(true, {
            simplifyPageBtn: deps.simplifyPageBtn,
            simplifyTextBtn: deps.simplifyTextBtn
        });
        clearStatus(simplificationStatus);

        // Extract text from page
        const textData = await extractPageText(webview, simplificationStatus);
        currentTextDataRef.current = textData;

        showStatus(simplificationStatus, `Extracted ${textData.wordCount} words. Ready to simplify.`,
            'success');

    } catch (error) {
        console.error('Text extraction failed:', error);
        showStatus(simplificationStatus, `Error: ${error.message}`, 'error');
    } finally {
        setProcessingState(false, {
            simplifyPageBtn: deps.simplifyPageBtn,
            simplifyTextBtn: deps.simplifyTextBtn
        });
    }
};

export const simplifyText = async (deps) => {
    const {
        isProcessingRef,
        latestRequestIdRef,
        setProcessingState,
        clearStatus,
        currentTextDataRef,
        simplificationStatus,
        complexitySelect,
        processTextWithOllama,
        updateTextDisplay,
        simplifiedTextDisplay,
        copySimplifiedText,
        replacePageText,
        useOpenAI // New dependency
    } = deps;

    if (isProcessingRef.current) return;

    const requestId = ++latestRequestIdRef.current; // Generate a new request ID

    try {
        setProcessingState(true, {
            simplifyPageBtn: deps.simplifyPageBtn,
            simplifyTextBtn: deps.simplifyTextBtn
        });
        clearStatus(simplificationStatus);

        const textData = currentTextDataRef.current;
        const complexity = complexitySelect.value;
        let result = null;
        let modelUsed = '';

        if (useOpenAI) {
            
            try {
                result = await processTextWithOpenAI(textData, { complexity, feature: 'simplification' });
                modelUsed = 'OpenAI';
            } catch (openaiError) {
                console.warn('OpenAI simplification failed, falling back to Ollama:', openaiError);
                showStatus(simplificationStatus, `OpenAI failed, falling back to Ollama...`, 'loading');
                // Fallback to Ollama
                result = await processTextWithOllama(textData, {
                    complexity
                }, requestId, {
                    latestRequestIdRef,
                    simplificationStatus,
                    simplifiedTextDisplay
                }, true); // forceNoChunking = true
                modelUsed = 'Ollama';
            }
        } else {
            showStatus(simplificationStatus, `Processing with Ollama...`, 'loading');
            result = await processTextWithOllama(textData, {
                complexity
            }, requestId, {
                latestRequestIdRef,
                simplificationStatus,
                simplifiedTextDisplay
            });
            modelUsed = 'Ollama';
        }

        // Only update UI if this is still the latest request and result is not null (i.e., not discarded)
        if (requestId !== latestRequestIdRef.current || result === null) {
            return;
        }

        // Update display
        updateTextDisplay(textData, result, {
            simplifiedTextDisplay,
            copySimplifiedText,
            replacePageText
        });

        

    } catch (error) {
        console.error('Text simplification failed:', error);
        showStatus(simplificationStatus, `Error: ${error.message}`, 'error');

        // Show partial results if we have extracted text
        if (currentTextDataRef.current) {
            updateTextDisplay(currentTextDataRef.current, {
                error: true,
                message: error.message
            }, {
                simplifiedTextDisplay,
                copySimplifiedText,
                replacePageText
            });
        }
    } finally {
        setProcessingState(false, {
            simplifyPageBtn: deps.simplifyPageBtn,
            simplifyTextBtn: deps.simplifyTextBtn
        });
    }
};

export const replacePageTextWithSimplified = async (deps) => {
    const {
        isPageSimplifiedRef,
        pageContentStateRef,
        simplificationStatus,
        webview,
        simplifiedTextDisplay,
        replacePageText
    } = deps;
    try {
        if (isPageSimplifiedRef.current) {
            // Revert to original
            showStatus(simplificationStatus, 'Restoring original page...', 'loading');
            if (pageContentStateRef.current.length > 0 && pageContentStateRef.current[0].originalUrl) {
                webview.loadURL(pageContentStateRef.current[0].originalUrl);
            } else {
                // Fallback to restoring HTML if URL is not available (shouldn't happen if logic is correct)
                await webview.executeJavaScript(
                    `document.body.innerHTML = ${JSON.stringify(pageContentStateRef.current[0].originalHtml)};`
                );
            }
            isPageSimplifiedRef.current = false;
            replacePageText.textContent = 'Replace Page Text';
            showStatus(simplificationStatus, 'Original page restored!', 'success');
        } else {
            // Simplify and replace
            const simplifiedText = simplifiedTextDisplay.textContent;
            if (!simplifiedText || simplifiedText.startsWith('Error:')) {
                showStatus(simplificationStatus, 'No simplified text to replace with', 'error');
                return;
            }

            showStatus(simplificationStatus, 'Replacing page text with simplified version...', 'loading');

            // Clear previous state
            pageContentStateRef.current = [];

            // Store the entire original page HTML and URL before replacing
            const originalPageHtml = await webview.executeJavaScript(`document.body.innerHTML;`);
            const originalPageUrl = webview.getURL(); // Get the current URL
            pageContentStateRef.current = [{
                originalHtml: originalPageHtml,
                originalUrl: originalPageUrl
            }]; // Store HTML and URL

            // Clear the entire page and inject simplified text
            await webview.executeJavaScript(`
          document.body.innerHTML = ${JSON.stringify(`
            <div style="max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6;">
              ${simplifiedTextDisplay.innerHTML}
            </div>
          `)};
        `);

            isPageSimplifiedRef.current = true;
            replacePageText.textContent = 'Show Original';
            
        }
    } catch (error) {
        console.error('Failed to replace page text:', error);
        showStatus(simplificationStatus, `Failed to replace text: ${error.message}`, 'error');
    }
};

export const refreshSimplification = (deps) => {
    const {
        latestRequestIdRef,
        simplifiedTextDisplay,
        clearStatus,
        currentTextDataRef,
        setProcessingState,
        replacePageText,
        isPageSimplifiedRef,
        extractTextBtn,
        simplifyTextBtn
    } = deps;

    // Invalidate any ongoing simplification processes
    latestRequestIdRef.current++;

    // Clear displayed text
    simplifiedTextDisplay.textContent = '';

    // Clear status message
    clearStatus(simplificationStatus);

    // Reset currentTextData
    currentTextDataRef.current = null;

    // Ensure buttons are re-enabled
    setProcessingState(false, {
        extractTextBtn,
        simplifyTextBtn
    });

    // Reset replace page text button
    replacePageText.textContent = 'Replace Page Text';
    isPageSimplifiedRef.current = false;
};

export const simplifyParagraphsInPlace = async (deps) => {
    const {
        isProcessingRef,
        setProcessingState,
        simplificationStatus,
        complexitySelect,
        webview,
        useOpenAI,
        simplifyPageBtn,
        simplifyTextBtn,
        simplifyParagraphsInPlaceBtn // New dependency
    } = deps;

    if (isProcessingRef.current) return;

    try {
        setProcessingState(true, {
            simplifyPageBtn,
            simplifyTextBtn,
            simplifyParagraphsInPlaceBtn // Disable this button too
        });
        showStatus(simplificationStatus, 'Extracting paragraphs for in-place simplification...', 'loading');

        // 1. Get all <p> tags from the webview
        const paragraphData = await webview.executeJavaScript(`
            (function() {
                const paragraphs = Array.from(document.querySelectorAll('p'));
                const visibleParagraphs = paragraphs.filter(p => {
                    const style = window.getComputedStyle(p);
                    return style.display !== 'none' && style.visibility !== 'hidden' && p.offsetHeight > 0 && p.offsetWidth > 0;
                });
                return visibleParagraphs.map((p, index) => {
                    const id = 'aura-p-' + index;
                    p.id = id; // Set the ID on the DOM element
                    return {
                        id: id,
                        originalText: p.textContent,
                        originalHtml: p.innerHTML
                    };
                });
            })();
        `);

        if (!paragraphData || paragraphData.length === 0) {
            showStatus(simplificationStatus, 'No paragraphs found on the page.', 'error');
            return;
        }

        const complexity = complexitySelect.value;
        let simplifiedParagraphs = [];

        for (let i = 0; i < paragraphData.length; i++) {
            const { id, originalText } = paragraphData[i];
            const wordCount = countWords(originalText);

            if (wordCount < 50) {
                console.log(`Skipping simplification for paragraph ${i + 1} (less than 50 words).`);
                simplifiedParagraphs.push({ id, simplifiedText: originalText });
                continue; // Skip to the next paragraph
            }

            showStatus(simplificationStatus, `Simplifying paragraph ${i + 1} of ${paragraphData.length}...`, 'loading');

            let simplifiedText = '';
            try {
                if (useOpenAI) {
                    const result = await processTextWithOpenAI({ text: originalText }, { complexity, feature: 'simplification' });
                    simplifiedText = result.simplified;
                } else {
                    // For Ollama, we need to mock the requestId and other deps for processTextWithOllama
                    // Since we are simplifying in place, we don't need to update the modal display
                    // We will pass dummy values for latestRequestIdRef, simplifiedTextDisplay, etc.
                    const dummyDeps = {
                        latestRequestIdRef: { current: 0 },
                        simplificationStatus: null, // Not used for status updates in this context
                        simplifiedTextDisplay: null,
                        simplifiedWordCount: null,
                        wordReduction: null
                    };
                    const result = await processTextWithOllama({ text: originalText }, { complexity }, 0, dummyDeps, true); // forceNoChunking = true
                    simplifiedText = result.simplified;
                }
                simplifiedParagraphs.push({ id, simplifiedText });
            } catch (error) {
                console.error(`Failed to simplify paragraph ${id}:`, error);
                simplifiedParagraphs.push({ id, simplifiedText: originalText }); // Keep original if simplification fails
                showStatus(simplificationStatus, `Failed to simplify paragraph ${i + 1}. Keeping original.`, 'error');
            }
        }

        showStatus(simplificationStatus, 'Replacing paragraphs on page...', 'loading');

        // 3. Replace original <p> tags with simplified versions in the webview
        const replacementScript = `
            (function() {
                const paragraphs = Array.from(document.querySelectorAll('p'));
                const simplifiedData = ${JSON.stringify(simplifiedParagraphs)};
                
                simplifiedData.forEach(data => {
                    const p = paragraphs.find(p => p.id === data.id); // Find by assigned ID
                    if (p) {
                        p.innerHTML = data.simplifiedText;
                    }
                });
            })();
        `;
        await webview.executeJavaScript(replacementScript);

        showStatus(simplificationStatus, 'Paragraphs simplified in place!', 'success');

    } catch (error) {
        console.error('In-place paragraph simplification failed:', error);
        showStatus(simplificationStatus, `Error: ${error.message}`, 'error');
    } finally {
        setProcessingState(false, {
            simplifyPageBtn,
            simplifyTextBtn,
            simplifyParagraphsInPlaceBtn
        });
    }
};