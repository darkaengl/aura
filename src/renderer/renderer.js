    // Helper: Extract visible, interactive elements for LLM context
    const extractScreenContextFromWebview = async () => {
      return await webview.executeJavaScript(`
        (() => {
          function isVisible(element) {
            if (!element) return false;
            if (element.nodeType !== Node.ELEMENT_NODE) return false;
            const style = window.getComputedStyle(element);
            return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          }
          function isInteractive(element) {
            const tag = element.tagName.toLowerCase();
            return (
              tag === 'button' ||
              tag === 'a' ||
              tag === 'input' ||
              tag === 'select' ||
              tag === 'textarea' ||
              (element.hasAttribute('role') && ['button','link','textbox','searchbox','menuitem'].includes(element.getAttribute('role')))
            );
          }
          function getElementInfo(element) {
            if (!isVisible(element) || !isInteractive(element)) return null;
            return {
              tag: element.tagName.toLowerCase(),
              id: element.id || undefined,
              class: element.className || undefined,
              name: element.getAttribute('name') || undefined,
              type: element.getAttribute('type') || undefined,
              value: element.value || undefined,
              placeholder: element.getAttribute('placeholder') || undefined,
              ariaLabel: element.getAttribute('aria-label') || undefined,
              role: element.getAttribute('role') || undefined,
              text: element.innerText ? element.innerText.trim() : undefined,
              href: element.getAttribute('href') || undefined
            };
          }
          const elements = Array.from(document.querySelectorAll('a,button,input,select,textarea,[role]'));
          const context = elements.map(getElementInfo).filter(Boolean);
          return context;
        })();
      `, true);
    };

    // Helper: Extract all visible text from the webview
    const extractVisibleTextFromWebview = async () => {
      return await webview.executeJavaScript(`
        (() => {
          function getVisibleText(element) {
            if (!element) return '';
            if (element.nodeType === Node.TEXT_NODE) {
              return element.textContent.trim();
            }
            if (element.nodeType !== Node.ELEMENT_NODE) return '';
            const style = window.getComputedStyle(element);
            if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
              return '';
            }
            let text = '';
            for (const child of element.childNodes) {
              text += getVisibleText(child) + ' ';
            }
            return text.trim();
          }
          return getVisibleText(document.body);
        })();
      `, true);
    };
import { initializeAccessibility } from '../shared/accessibility.js';
import { getTextExtractionScript } from '../shared/text-extraction.js';
import { createSimplificationPrompt, splitTextIntoChunks, createChunkPrompt, validateOptions, estimateProcessingTime } from '../shared/simplification-prompts.js';
import { marked } from '../../node_modules/marked/lib/marked.esm.js'; // Import marked library

window.onload = async () => {
  const urlInput = document.getElementById('url-input');
  const backBtn = document.getElementById('back-btn');
  const forwardBtn = document.getElementById('forward-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const browserLogo = document.getElementById('browser-logo'); // New Browser Logo
  const webview = document.getElementById('webview');
  const wcagScoreLabel = document.getElementById('wcag-score-label');
  const accessibilityReport = document.getElementById('accessibility-report');
  const reportDetails = document.getElementById('report-details');
  const closeReportBtn = document.getElementById('close-report-btn');
  const downloadReportBtn = document.getElementById('download-report-btn');
  const simplifyBtn = document.getElementById('simplify-btn');

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
  const refreshSimplificationBtn = document.getElementById('refresh-simplification-btn');

  // PDF Upload to Simplify Functionality (moved inside modal context)
  const uploadPdfBtn = document.getElementById('upload-pdf-btn');
  const pdfUploadInput = document.getElementById('pdf-upload-input');

    // Chat interface elements (from aura)
    const micBtn = document.getElementById('mic-btn');
    const chatContainer = document.getElementById('chat-container');
    const closeChatBtn = document.getElementById('close-chat-btn');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const micChatBtn = document.getElementById('mic-chat-btn');

    // MediaRecorder for Speech-to-Text
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    // Show chat container when mic button is clicked
    if (micBtn && chatContainer) {
      micBtn.addEventListener('click', () => {
        chatContainer.classList.remove('hidden');
      });
    }

    // Hide chat container when close button is clicked
    if (closeChatBtn && chatContainer) {
      closeChatBtn.addEventListener('click', () => {
        chatContainer.classList.add('hidden');
      });
    }

    // Chat send button event
    if (chatSendBtn) {
      chatSendBtn.addEventListener('click', () => sendMessage());
    }

    // Chat input 'Enter' event
    if (chatInput) {
      chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          sendMessage();
        }
      });
    }

    // Mic chat button event for speech-to-text
    if (micChatBtn) {
      micChatBtn.addEventListener('click', async () => {
        if (isRecording) {
          mediaRecorder.stop();
          isRecording = false;
          micChatBtn.style.backgroundColor = '';
          console.log('Recording stopped.');
        } else {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
              audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
              const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
              const arrayBuffer = await audioBlob.arrayBuffer();
              const audioContext = new (window.AudioContext || window.webkitAudioContext)();
              const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);

              // Create WAV header
              const numberOfChannels = decodedAudio.numberOfChannels;
              const sampleRate = decodedAudio.sampleRate;
              const format = 1; // PCM
              const bitDepth = 16; // 16-bit
              const byteRate = sampleRate * numberOfChannels * bitDepth / 8;
              const blockAlign = numberOfChannels * bitDepth / 8;
              const dataSize = decodedAudio.length * numberOfChannels * bitDepth / 8;

              const buffer = new ArrayBuffer(44 + dataSize);
              const view = new DataView(buffer);

              // RIFF chunk descriptor
              writeString(view, 0, 'RIFF');
              view.setUint32(4, 36 + dataSize, true);
              writeString(view, 8, 'WAVE');
              // FMT sub-chunk
              writeString(view, 12, 'fmt ');
              view.setUint32(16, 16, true);
              view.setUint16(20, format, true);
              view.setUint16(22, numberOfChannels, true);
              view.setUint32(24, sampleRate, true);
              view.setUint32(28, byteRate, true);
              view.setUint16(32, blockAlign, true);
              view.setUint16(34, bitDepth, true);
              // data sub-chunk
              writeString(view, 36, 'data');
              view.setUint32(40, dataSize, true);

              // Write the PCM data
              floatTo16BitPCM(view, 44, decodedAudio.getChannelData(0));
              if (numberOfChannels === 2) {
                floatTo16BitPCM(view, 44, decodedAudio.getChannelData(1));
              }

              const wavAudioBuffer = window.nodeBufferFrom(buffer);

              console.log('Audio recorded, sending for transcription...');
              console.log('Detected sample rate:', sampleRate);

              try {
                const transcription = await window.speechAPI.transcribeAudio(wavAudioBuffer, sampleRate);
                chatInput.value = transcription;
                sendMessage();
              } catch (error) {
                console.error('Transcription error:', error);
                addMessage('Sorry, transcription failed. Please try again.', 'ai');
              }
            };

            mediaRecorder.start();
            isRecording = true;
            micChatBtn.style.backgroundColor = '#ff0000';
            console.log('Recording started.');
          } catch (error) {
            console.error('Error accessing microphone:', error);
            addMessage('Could not access microphone. Please ensure it\'s connected and permissions are granted.', 'ai');
          }
        }
      });
    }

    // Helper function to write string to DataView
    function writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    // Helper function to convert float to 16-bit PCM
    function floatTo16BitPCM(output, offset, input) {
      for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
    }

    // Add message to chat
    function addMessage(text, sender) {
      if (!chatMessages) return;
      const messageElement = document.createElement('div');
      messageElement.classList.add('chat-message', `${sender}-message`);
      messageElement.innerText = text;
      chatMessages.appendChild(messageElement);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Send message to AI
    async function sendMessage() {
      if (!chatInput || !chatMessages) return;
      const message = chatInput.value.trim();
      if (!message) return;

      addMessage(message, 'user');
      chatInput.value = '';

      try {
        // Classify intent first
        const intent = await window.ollamaAPI.classifyIntent(message);
        console.log('Intent classified as:', intent, 'for message:', message);

        if (intent === 'action') {
          // Extract visible screen context instead of DOM
          console.log('Extracting screen context...');
          const screenContext = await extractScreenContextFromWebview();
          console.log('Screen context extracted:', screenContext);

          if (screenContext) {
            console.log('Saving screen context to log file...');
            await window.mainAPI.saveDomLog(screenContext);
            console.log('Screen context saved to log file.');
          }

          // Prompt for high-level command (search_and_navigate)
          const navPrompt = `You are a browser assistant.\nGiven the user's command: "${message}", 
          generate a single high-level command object in JSON format.\nIf the command is to search or navigate to a topic, use:\n{\n  action: 'search_and_navigate',
          \n  topic: '<topic>'\n}\nIf the command is to click, fill, or interact, use:\n{\n  action: '<action>',\n  selector: '<selector>',\n  value: '<value>' // 
          if applicable\n}\nOnly output the JSON object, no extra text.
          `;
          console.log('Sending navPrompt to ChatGPT...');
          const chatGptApiKey = window.secretsAPI.getChatGptApiKey();
          const chatGptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${chatGptApiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: navPrompt }],
              temperature: 0.2
            })
          });
          const chatGptData = await chatGptResponse.json();
          const llmResponse = chatGptData.choices?.[0]?.message?.content || '';
          console.log('LLM response received:', llmResponse);
          await window.mainAPI.saveLlmLog(llmResponse);
          try {
            const commandObj = JSON.parse(llmResponse);
            if (commandObj.action === 'search_and_navigate') {
              addMessage('Executing command:', 'ai');
            } else {
              addMessage(`Executing command: ${JSON.stringify(commandObj)}`, 'ai');
            }
            // Execute search_and_navigate like aura-nav
            if (commandObj.action === 'search_and_navigate' && commandObj.topic) {
              console.log(`Searching and navigating to: ${commandObj.topic}`);
              const searchAndClickScript = `
                (() => {
                  const searchTerm = '${commandObj.topic.replace(/'/g,"\\'")}';
                  const searchVariations = [
                    searchTerm.toLowerCase(),
                    searchTerm.toLowerCase().replace(/\s+/g, ''),
                    ...searchTerm.toLowerCase().split(' '),
                  ];
                  if (searchTerm.toLowerCase().includes('vehicle') || searchTerm.toLowerCase().includes('vehical')) {
                    searchVariations.push('vrt', 'vehicle registration tax', 'motor tax');
                  }
                  if (searchTerm.toLowerCase().includes('tax')) {
                    searchVariations.push('vrt', 'taxation', 'revenue');
                  }
                  if (searchTerm.toLowerCase().includes('registration')) {
                    searchVariations.push('vrt', 'register', 'registration');
                  }
                  const clickableElements = document.querySelectorAll('a, button, [role="button"], [onclick]');
                  const clickableMatches = [];
                  clickableElements.forEach(element => {
                    if (element.offsetParent !== null) {
                      const text = element.textContent.toLowerCase();
                      const href = element.getAttribute('href') || '';
                      for (const variation of searchVariations) {
                        if (variation && (text.includes(variation) || href.toLowerCase().includes(variation))) {
                          const rect = element.getBoundingClientRect();
                          if (rect.height > 10 && rect.width > 50) {
                            clickableMatches.push({
                              element: element,
                              text: element.textContent.trim(),
                              href: href,
                              matchedTerm: variation,
                              relevanceScore: calculateRelevance(text + ' ' + href, searchVariations),
                              rect: rect
                            });
                            break;
                          }
                        }
                      }
                    }
                  });
                  clickableMatches.sort((a, b) => {
                    if (a.relevanceScore !== b.relevanceScore) {
                      return b.relevanceScore - a.relevanceScore;
                    }
                    return a.rect.top - b.rect.top;
                  });
                  if (clickableMatches.length > 0) {
                    const bestMatch = clickableMatches[0];
                    const originalStyle = bestMatch.element.style.cssText;
                    bestMatch.element.style.backgroundColor = '#00ff00';
                    bestMatch.element.style.transition = 'background-color 0.3s';
                    bestMatch.element.style.border = '2px solid #0066ff';
                    setTimeout(() => {
                      bestMatch.element.click();
                    }, 500);
                    return {
                      success: true,
                      found: true,
                      clicked: true,
                      text: bestMatch.text,
                      href: bestMatch.href,
                      matchedTerm: bestMatch.matchedTerm,
                      matches: clickableMatches.length
                    };
                  } else {
                    return {
                      success: true,
                      found: false,
                      clicked: false,
                      message: 'No clickable element found for topic',
                      searchedFor: searchVariations
                    };
                  }
                  function calculateRelevance(text, searchTerms) {
                    let score = 0;
                    for (const term of searchTerms) {
                      if (term && text.includes(term)) {
                        score += term.length;
                      }
                    }
                    return score;
                  }
                })();
              `;
              try {
                const result = await webview.executeJavaScript(searchAndClickScript, true);
                if (result.found && result.clicked) {
                  addMessage(`Navigating to "${result.matchedTerm}": ${result.text}${result.href ? ' → ' + result.href : ''}`, 'ai');
                } else {
                  addMessage(`Could not find clickable element for "${commandObj.topic}". Searched for: ${result.searchedFor.join(', ')}`, 'ai');
                }
              } catch (e) {
                console.error('Search and navigate error:', e);
                addMessage(`Error navigating to "${commandObj.topic}": ${e.message}`, 'ai');
              }
            }
          } catch (e) {
            addMessage(llmResponse, 'ai');
          }
        } else if (intent === 'question') {
          // Extract visible text from the webview
          addMessage('Let me look that up for you...', 'ai');
          // You may need to implement extractVisibleTextFromWebview for Aura-dev
          const pageText = await extractVisibleTextFromWebview();
          console.log('Extracted page text:', pageText);
          const prompt = `You are an AI assistant. The user is viewing a website and has asked: "${message}"\n\nHere is the visible text from the page:\n${pageText}\n\nPlease answer the user's question using only the information from the page. If the answer is not present, say so.`;
          const llmResponse = await window.ollamaAPI.chat([{ role: 'user', content: prompt }]);
          addMessage(llmResponse, 'ai');
          await window.mainAPI.saveLlmLog(llmResponse);
        } else {
          addMessage("Sorry, I couldn't understand your request.", 'ai');
        }
      } catch (error) {
        console.error('Error in sendMessage:', error);
        addMessage('Sorry, I encountered an error. Please try again later.', 'ai');
      }
    }

  uploadPdfBtn.addEventListener('click', () => {
    pdfUploadInput.click(); // Trigger the hidden file input click
  });

  pdfUploadInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      showStatus('Processing PDF for simplification...', 'loading');
      textSimplificationModal.style.display = 'flex'; // Open the simplification modal

      const reader = new FileReader();
      reader.onload = async (e) => {
        const arrayBuffer = e.target.result;
        try {
          // Send PDF data to main process for text extraction
          const textData = await window.textSimplificationAPI.processPdfForSimplification(arrayBuffer);
          currentTextData = textData; // Store for later use

          if (textData && textData.text) {
            originalTextDisplay.textContent = textData.text;
            originalWordCount.textContent = textData.wordCount.toLocaleString();
            showStatus(`Extracted ${textData.wordCount} words from PDF. Processing with Ollama...`, 'loading');

            const complexity = complexitySelect.value;
            const requestId = ++latestRequestId; // Generate new request ID for PDF processing
            const result = await processTextWithOllama(textData, { complexity }, requestId);

            if (requestId !== latestRequestId || result === null) {
              console.log(`[PDF Simplification] Discarding result for request ${requestId}. Newer request ${latestRequestId} exists or result was null.`);
              return;
            }

            updateTextDisplay(textData, result);
            showStatus(`PDF text simplified successfully! Reduced by ${result.wordReduction}% (${result.metadata.originalWordCount} → ${result.metadata.simplifiedWordCount} words)`, 'success');
          } else {
            throw new Error('No text could be extracted from the PDF.');
          }
        } catch (error) {
          console.error('Error processing PDF:', error);
          showStatus(`Error processing PDF: ${error.message}`, 'error');
          originalTextDisplay.textContent = '';
          simplifiedTextDisplay.textContent = '';
          originalWordCount.textContent = '0';
          simplifiedWordCount.textContent = '0';
          wordReduction.textContent = '0%';
        } finally {
          pdfUploadInput.value = ''; // Clear the input so the same file can be selected again
          setProcessingState(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      showStatus('Please select a valid PDF file.', 'error');
    }
  });

  /**
   * Replaces the original page text with simplified text or toggles back to original
   */
  const replacePageTextWithSimplified = async () => {
    try {
      if (isPageSimplified) {
        // Revert to original
        showStatus('Restoring original page text...', 'loading');
        if (pageContentState.length > 0 && pageContentState[0].originalHtml) {
          await webview.executeJavaScript(`document.body.innerHTML = ${JSON.stringify(pageContentState[0].originalHtml)};`);
        }
        isPageSimplified = false;
        replacePageText.textContent = 'Replace Page Text';
        showStatus('Original page text restored!', 'success');
      } else {
        // Simplify and replace
        const simplifiedText = simplifiedTextDisplay.textContent;
        if (!simplifiedText || simplifiedText.startsWith('Error:')) {
          showStatus('No simplified text to replace with', 'error');
          return;
        }

        showStatus('Replacing page text with simplified version...', 'loading');

        // Clear previous state
        pageContentState = [];

        // Store the entire original page HTML before replacing
        const originalPageHtml = await webview.executeJavaScript(`document.body.innerHTML;`);
        pageContentState = [{ originalHtml: originalPageHtml }]; // Store as a single item

        // Clear the entire page and inject simplified text
        await webview.executeJavaScript(`
          document.body.innerHTML = ${JSON.stringify(`
            <div style="max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6;">
              ${simplifiedTextDisplay.innerHTML}
            </div>
          `)};
        `);

        isPageSimplified = true;
        replacePageText.textContent = 'Show Original';
        showStatus('Page text replaced with simplified version!', 'success');
      }
    } catch (error) {
      console.error('Failed to replace page text:', error);
      showStatus(`Failed to replace text: ${error.message}`, 'error');
    }
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

  browserLogo.addEventListener('click', () => {
    window.location.href = 'homepage.html'; // Navigate to homepage.html when logo is clicked
  });

  // Handle navigation from main process (e.g., from homepage links)
  window.electronAPI.onNavigateWebview((url) => {
    webview.src = url;
    urlInput.value = url; // Update URL input as well
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
  let pageContentState = []; // Stores { originalHtml, simplifiedHtml, element }
  let isPageSimplified = false;
  let latestRequestId = 0;

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

      // const extractionResult = await webview.executeJavaScript(`
      //   (function() {
      //     // This function will be called to attempt the extraction
      //     const attemptExtraction = () => {
      //       const text = document.body.innerText.trim();
      //       if (text) {
      //         // If text is found, resolve the promise with the data
      //         return { success: true, data: text };
      //       }
      //       // If no text, return null to signal a retry
      //       return null;
      //     };

      //     // We'll use a Promise to handle the asynchronous waiting
      //     return new Promise((resolve, reject) => {
      //       const maxAttempts = 10; // 10 attempts * 500ms = 5 seconds total
      //       let attempt = 0;

      //       const intervalId = setInterval(() => {
      //         const result = attemptExtraction();
              
      //         if (result) {
      //           clearInterval(intervalId); // Stop polling
      //           resolve(JSON.stringify(result)); // Send the successful result back
      //         } else if (++attempt >= maxAttempts) {
      //           clearInterval(intervalId); // Stop polling after max attempts
      //           // Resolve with an error message
      //           resolve(JSON.stringify({ success: false, message: 'No text content found after 5 seconds.' }));
      //         }
      //     }, 500); // Check every 500 milliseconds
      //     });
      //   })();
      // `);
            
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
  const processTextWithOllama = async (textData, options, requestId) => {
    console.log(`[processTextWithOllama] Starting for request ID: ${requestId}`);
    try {
      const validatedOptions = validateOptions(options);
      const { text, title, url } = textData; // Destructure requestId from textData

      // Immediately check if this request is still valid
      if (requestId !== latestRequestId) {
        console.log(`[processTextWithOllama] Discarding request ${requestId} before processing. Newer request ${latestRequestId} exists.`);
        return null; // Discard this request early
      }
      
      // Estimate processing time and show to user
      const estimatedTime = estimateProcessingTime(textData.wordCount, validatedOptions.complexity);
      const estimatedSeconds = Math.ceil(estimatedTime / 1000);
      showStatus(`Simplifying text... (estimated ${estimatedSeconds}s)`, 'loading');
      
      // For very large texts, split into chunks
      if (text.length > 8000) {
        console.log(`[processTextWithOllama] Text length > 8000, calling processTextInChunks.`);
        return await processTextInChunks(textData, { ...validatedOptions, requestId }); // Pass requestId to processTextInChunks
      }
      
      // Process single text block
      const promptData = createSimplificationPrompt(text, {
        ...validatedOptions,
        title,
        url,
        wordCount: textData.wordCount
      });
      console.log(`[processTextWithOllama] Processing single text block for request ID: ${requestId}`);
      
      const result = await window.textSimplificationAPI.processText(textData, validatedOptions);
      console.log(`[processTextWithOllama] Result from textSimplificationAPI.processText (single block):`, result);
      
      if (result.error) {
        throw new Error(result.message);
      }

      // Check again after processing, in case a new request came in during the Ollama call
      if (requestId !== latestRequestId) {
        console.log(`[processTextWithOllama] Discarding result for request ${requestId} after processing. Newer request ${latestRequestId} exists.`);
        return null; // Return null or throw an error to indicate discard
      }
      
      // Return a structured result similar to processTextInChunks
      const finalResult = {
        original: textData.text,
        simplified: result.simplified, // Assuming result.simplified holds the simplified text
        complexity: validatedOptions.complexity,
        processingTime: Date.now(),
        model: 'llama3.2',
        wordReduction: parseFloat(((textData.wordCount - result.simplified.split(/\s+/).filter(word => word.length > 0).length) / textData.wordCount * 100).toFixed(1)),
        metadata: {
          originalWordCount: textData.wordCount,
          simplifiedWordCount: result.simplified.split(/\s+/).filter(word => word.length > 0).length,
          title: textData.title,
          url: textData.url,
          chunks: 1 // Indicate it was processed as a single chunk
        }
      };
      console.log(`[processTextWithOllama] Returning final result (single block):`, finalResult);
      return finalResult;
      
    } catch (error) {
      console.error('Text processing failed:', error);
      throw error;
    }
  };

  /**
   * Processes large text by splitting into chunks
   */
  const processTextInChunks = async (textData, options) => {
    console.log(`[processTextInChunks] Starting for request ID: ${options.requestId}`);
    const chunks = splitTextIntoChunks(textData.text, 3000);
    let combinedSimplifiedText = '';
    let currentSimplifiedWordCount = 0;
    const originalWordCount = textData.wordCount;
    const requestId = options.requestId; // Get requestId from options

    // Immediately check if this request is still valid
    if (requestId !== latestRequestId) {
      console.log(`[processTextInChunks] Discarding chunk processing for request ${requestId} before starting. Newer request ${latestRequestId} exists.`);
      return null; // Discard this request early
    }

    // Clear previous simplified text display
    simplifiedTextDisplay.textContent = '';
    simplifiedWordCount.textContent = '0';
    wordReduction.textContent = '0%';
    
    showStatus(`Processing ${chunks.length} text chunks...`, 'loading');
    
    for (let i = 0; i < chunks.length; i++) {
      // Check if this is still the latest request before processing each chunk
      if (requestId !== latestRequestId) {
        console.log(`[processTextInChunks] Discarding chunk processing for request ${requestId}. Newer request ${latestRequestId} exists.`);
        return null; // Discard the entire chunk processing
      }

      showStatus(`Processing chunk ${i + 1} of ${chunks.length}...`, 'loading');
      
      const chunkData = {
        text: chunks[i],
        title: textData.title,
        url: textData.url
      };
      
      const result = await window.textSimplificationAPI.processText(chunkData, options);
      console.log(`[processTextInChunks] Result for chunk ${i + 1} of ${chunks.length}:`, result);
      
      if (result.error) {
        throw new Error(`Chunk ${i + 1} failed: ${result.message}`);
      }
      
      // Append simplified chunk to display and combined text
      const simplifiedChunk = result.simplified;
      combinedSimplifiedText += (i > 0 ? '\n\n' : '') + simplifiedChunk;
      simplifiedTextDisplay.innerHTML = marked.parse(combinedSimplifiedText); // Update display after each chunk

      // Update word counts dynamically
      currentSimplifiedWordCount = combinedSimplifiedText.split(/\s+/).filter(word => word.length > 0).length;
      simplifiedWordCount.textContent = currentSimplifiedWordCount.toLocaleString();
      
      const currentWordReductionPercent = ((originalWordCount - currentSimplifiedWordCount) / originalWordCount * 100).toFixed(1);
      wordReduction.textContent = `${currentWordReductionPercent}%`;
    }
    
    // Final result object
    const finalResult = {
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
    console.log(`[processTextInChunks] Returning final result:`, finalResult);
    return finalResult;
  };

  /**
   * Updates the display with original and simplified text
   */
  const updateTextDisplay = (textData, simplificationResult) => {
    console.log(`[updateTextDisplay] Called with simplificationResult:`, simplificationResult);
    // Update original text panel
    originalTextDisplay.textContent = textData.text;
    originalWordCount.textContent = textData.wordCount.toLocaleString();
    
    // Update simplified text panel
    if (simplificationResult.error) {
      simplifiedTextDisplay.innerHTML = `<p style="color: red;">Error: ${simplificationResult.message}</p>`;
      simplifiedWordCount.textContent = '0';
      wordReduction.textContent = '0%';
    } else {
      console.log(`[updateTextDisplay] Updating simplifiedTextDisplay with:`, simplificationResult.simplified);
      simplifiedTextDisplay.innerHTML = marked.parse(simplificationResult.simplified);
      const currentSimplifiedWordCount = simplificationResult.simplified.split(/\s+/).filter(word => word.length > 0).length;
      simplifiedWordCount.textContent = currentSimplifiedWordCount.toLocaleString();
      const originalWordCount = textData.wordCount;
      const currentWordReductionPercent = ((originalWordCount - currentSimplifiedWordCount) / originalWordCount * 100).toFixed(1);
      wordReduction.textContent = `${currentWordReductionPercent}%`;
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
    
    const requestId = ++latestRequestId; // Generate a new request ID
    console.log(`[extractAndSimplifyText] Starting new request with ID: ${requestId}`);

    try {
      setProcessingState(true);
      clearStatus();
      
      // Extract text from page
      const textData = await extractPageText();
      currentTextData = textData;
      console.log(`[extractAndSimplifyText] Extracted textData:`, textData);

      // Display original text immediately
      originalTextDisplay.textContent = textData.text;
      originalWordCount.textContent = textData.wordCount.toLocaleString();
      
      showStatus(`Extracted ${textData.wordCount} words. Processing with Ollama...`, 'loading');
      
      // Get selected complexity level
      const complexity = complexitySelect.value;
      
      // Process with Ollama
      const result = await processTextWithOllama(textData, { complexity }, requestId);
      console.log(`[extractAndSimplifyText] Result from processTextWithOllama:`, result);
      
      // Only update UI if this is still the latest request and result is not null (i.e., not discarded)
      if (requestId !== latestRequestId || result === null) {
        console.log(`[extractAndSimplifyText] Discarding result for request ${requestId}. Newer request ${latestRequestId} exists or result was null.`);
        return;
      }

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

  refreshSimplificationBtn.addEventListener('click', () => {
    // Invalidate any ongoing simplification processes
    latestRequestId++;

    // Clear displayed text
    originalTextDisplay.textContent = '';
    simplifiedTextDisplay.textContent = '';

    // Reset word counts
    originalWordCount.textContent = '0';
    simplifiedWordCount.textContent = '0';
    wordReduction.textContent = '0%';

    // Clear status message
    clearStatus();

    // Reset currentTextData
    currentTextData = null;

    // Ensure buttons are re-enabled
    setProcessingState(false);

    // Reset replace page text button
    replacePageText.textContent = 'Replace Page Text';
    isPageSimplified = false;
  });

  // Close modal when clicking outside
  textSimplificationModal.addEventListener('click', (event) => {
    if (event.target === textSimplificationModal) {
      textSimplificationModal.style.display = 'none';
    }
  });
  // Call the Ollama model to read and simplify the CSS of the current page
  // TODO: prompt engineering for improved output
  simplifyBtn.addEventListener('click', () => {
    let newCSS = webview.executeJavaScript(`
      Array.from(document.styleSheets)
        .map(sheet => {
          try {
            return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
          } catch (e) {
            // Skip CORS-protected sheets
            return '';
          }
        })
        .filter(text => text.length)
        .join('\n')
      `).then(async cssText => {
        const messages = [{
          role: 'user',
          content: 'Respond only with valid CSS contained within triple backticks (e.g: ``` CSS_HERE ```). Optimise the following CSS, making the resulting page simplified and more readable. CSS: ' + cssText
        }];
        // const schema = { 
        //   'type': 'object', 
        //   'properties': { 
        //       'optimised_css': { 
        //           'type': 'string'
        //       } 
        //   }, 
        //   'required': ['optimised_css']
        // };
        // console.log(cssText);
        let llmResponse = await window.ollamaAPI.chat(messages);
        // console.log(llmResponse);
        // console.log('\n');
        // console.log(JSON.parse(llmResponse).optimised_css);
        // console.log(llmResponse.split("```")[1]);
        const escaped = llmResponse.split("```")[1].slice(4)
                                                   .replace(/\\/g, '\\')     // escape backslashes
                                                   .replace(/`/g, '\`')       // escape backticks
                                                   .replace(/\$/g, '\$');     // escape dollar signs if using ${}

        const script = `
          (function() {
            let style = document.getElementById('dynamic-style');
            if (!style) {
              style = document.createElement('style');
              style.id = 'dynamic-style';
              document.head.appendChild(style);
            }
            style.textContent = "${escaped}";
          })();
        `;

        return webview.executeJavaScript(script);
      });
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
}