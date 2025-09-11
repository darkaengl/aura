import { initializeAccessibility } from '../shared/accessibility.js';

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
  const micBtn = document.getElementById('mic-btn');

  // Chat interface elements
  const chatContainer = document.getElementById('chat-container');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const micChatBtn = document.getElementById('mic-chat-btn');

  // Form filling state
  let isFillingForm = false;
  let currentFormFields = [];
  let currentFieldIndex = 0;

  // Speech Recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  console.log('SpeechRecognition initialized.');
  recognition.continuous = false; // Listen for a single utterance
  recognition.lang = 'en-US';

  let isListening = false;

  micChatBtn.addEventListener('click', () => {
    if (isListening) {
      recognition.stop();
      isListening = false;
      micChatBtn.style.backgroundColor = ''; // Reset button color
      console.log('Speech recognition stopped.');
    } else {
      recognition.start();
      isListening = true;
      micChatBtn.style.backgroundColor = '#ff0000'; // Change button color to red when listening
      console.log('Speech recognition started.');
    }
  });

  recognition.onresult = (event) => {
    console.log('Speech recognition result received.', event);
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
    sendMessage(); // Send the message after speech input
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error, event);
    isListening = false;
    micChatBtn.style.backgroundColor = ''; // Reset button color
    addMessage('Speech recognition failed. Please try again.', 'ai');
  };

  recognition.onend = () => {
    console.log('Speech recognition ended.');
    isListening = false;
    micChatBtn.style.backgroundColor = ''; // Reset button color
  };

  /**``
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

  micBtn.addEventListener('click', () => {
    chatContainer.classList.remove('hidden');
  });

  closeChatBtn.addEventListener('click', () => {
    chatContainer.classList.add('hidden');
  });

  chatSendBtn.addEventListener('click', () => sendMessage());

  chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      sendMessage();
    }
  });

  const addMessage = (text, sender) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `${sender}-message`);
    messageElement.innerText = text;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to the bottom
  };

  // Function to analyze current page and suggest next actions using LLM
  const suggestNextActions = async (completedActions = []) => {
    try {
      addMessage('🤔 Analyzing page content to suggest next steps...', 'ai');
      
      // Extract DOM structure and content for LLM analysis
      const domContext = await webview.executeJavaScript(`
        (() => {
          // Function to extract meaningful content from elements
          const extractElementInfo = (element, depth = 0) => {
            if (depth > 3) return null; // Limit recursion depth
            if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
            
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            
            // Skip hidden elements
            if (style.display === 'none' || style.visibility === 'hidden' || 
                rect.width === 0 || rect.height === 0) return null;
            
            const tagName = element.tagName.toLowerCase();
            const text = element.textContent?.trim() || '';
            
            // Focus on interactive and content elements
            const isInteractive = ['a', 'button', 'input', 'select', 'textarea', 'form'].includes(tagName) ||
                                 element.hasAttribute('onclick') || element.getAttribute('role') === 'button';
            
            const isContentElement = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'section', 'article', 'main'].includes(tagName);
            
            if (!isInteractive && !isContentElement) return null;
            
            const elementInfo = {
              tag: tagName,
              text: text.length > 200 ? text.substring(0, 200) + '...' : text,
              id: element.id || undefined,
              class: element.className || undefined,
              href: element.getAttribute('href') || undefined,
              type: element.getAttribute('type') || undefined,
              placeholder: element.getAttribute('placeholder') || undefined,
              value: element.value || undefined,
              role: element.getAttribute('role') || undefined,
              ariaLabel: element.getAttribute('aria-label') || undefined,
              isInteractive,
              position: {
                top: Math.round(rect.top),
                left: Math.round(rect.left),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              }
            };
            
            // Only include if it has meaningful content or is interactive
            if ((text.length > 0 && text.length < 1000) || isInteractive) {
              return elementInfo;
            }
            
            return null;
          };
          
          // Get page metadata
          const pageInfo = {
            url: window.location.href,
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
            headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim()).filter(Boolean)
          };
          
          // Extract all meaningful elements
          const allElements = [];
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            null,
            false
          );
          
          let node;
          while (node = walker.nextNode()) {
            const elementInfo = extractElementInfo(node);
            if (elementInfo) {
              allElements.push(elementInfo);
            }
          }
          
          // Sort by position (top to bottom, left to right) and filter
          const sortedElements = allElements
            .sort((a, b) => {
              if (Math.abs(a.position.top - b.position.top) > 50) {
                return a.position.top - b.position.top;
              }
              return a.position.left - b.position.left;
            })
            .slice(0, 20); // Limit to top 20 elements to avoid token limit
          
          return {
            pageInfo,
            elements: sortedElements
          };
        })();
      `, true);
      
      // Create LLM prompt for DOM analysis
      const actionContext = completedActions.length > 0 ? 
        `\nRecent actions completed: ${completedActions.join(', ')}` : '';
      
      const domAnalysisPrompt = `You are a web page analyst tasked with identifying the most relevant next actions a user might want to take on this page.

PAGE INFORMATION:
URL: ${domContext.pageInfo.url}
Title: ${domContext.pageInfo.title}
Description: ${domContext.pageInfo.description}
Main Headings: ${domContext.pageInfo.headings.join(', ')}${actionContext}

DOM ELEMENTS (in order of appearance):
${domContext.elements.map((el, idx) => {
  let elementDesc = `${idx + 1}. <${el.tag}>`;
  if (el.id) elementDesc += ` id="${el.id}"`;
  if (el.class) elementDesc += ` class="${el.class}"`;
  if (el.type) elementDesc += ` type="${el.type}"`;
  if (el.href) elementDesc += ` href="${el.href}"`;
  if (el.placeholder) elementDesc += ` placeholder="${el.placeholder}"`;
  if (el.role) elementDesc += ` role="${el.role}"`;
  if (el.ariaLabel) elementDesc += ` aria-label="${el.ariaLabel}"`;
  elementDesc += ` interactive:${el.isInteractive}`;
  if (el.text) elementDesc += `\n   Text: "${el.text}"`;
  return elementDesc;
}).join('\n')}

TASK: Analyze this DOM structure and identify the 2-3 most important and relevant actions a user would likely want to take on this page. Consider:

1. The page's primary purpose based on URL, title, and headings
2. The most prominent and important interactive elements
3. The logical workflow a user would follow on this page
4. Actions that align with the page's main content and functionality

Ignore generic navigation elements like "login", "sign up", "search" unless they are the main purpose of the page.

Focus on actions that help users accomplish the primary task this page is designed for.

Provide exactly 2 actionable suggestions in this format:

💡 **Next Steps:**
1. [First specific action based on actual page elements]
2. [Second specific action based on actual page elements]

Make sure each suggestion references specific elements or content from the DOM analysis above.`;

      const response = await window.gptAPI.chat([{ role: 'user', content: domAnalysisPrompt }]);
      addMessage(response, 'ai');
      
    } catch (error) {
      console.error('Error generating LLM-based next action suggestions:', error);
      // Fallback suggestions
      addMessage(`💡 **Next Steps:**\n1. You can continue exploring the page by asking me to look for specific content or navigate to other sections.\n2. If you see forms or interactive elements, I can help you fill them out or interact with them.`, 'ai');
    }
  };

  // Helper function to get human-readable command descriptions
  const getCommandDescription = (command) => {
    switch (command.action) {
      case 'goto':
        return `🌐 Navigating to: ${command.url}`;
      case 'click':
        return `👆 Clicking element: ${command.selector}`;
      case 'fill':
        return `✏️ Filling field "${command.selector}" with: "${command.text}"`;
      case 'scroll':
        return `📜 Scrolling ${command.direction}${command.amount ? ` by ${command.amount}px` : ''}`;
      case 'search':
        return `🔍 Searching for: "${command.query}"`;
      case 'search_content':
        return `🔍 Looking for content: "${command.topic}"`;
      case 'search_and_navigate':
        return `🔍➡️ Finding and navigating to: "${command.topic}"`;
      case 'select':
        return `📋 Selecting option "${command.value}" in: ${command.selector}`;
      case 'hover':
        return `🖱️ Hovering over: ${command.selector}`;
      case 'wait':
        return `⏳ Waiting ${command.milliseconds}ms`;
      case 'agree_and_start_form':
        return `✅ Agreeing to terms and starting form`;
      case 'start_form_filling':
        return `📝 Starting form filling process`;
      case 'traverse':
        return `🚶 Traversing through: ${command.text}`;
      case 'follow-link':
        return `🔗 Following link: ${command.text}`;
      default:
        return `⚡ Executing: ${command.action}`;
    }
  };

  // Helper function to show visual command indicator
  const showCommandIndicator = (command, stepNumber) => {
    // Create a floating indicator on the page
    const indicatorScript = `
      (() => {
        try {
          // Remove any existing indicators
          const existingIndicators = document.querySelectorAll('.aura-command-indicator');
          existingIndicators.forEach(ind => ind.remove());
          
          // Create new indicator
          const indicator = document.createElement('div');
          indicator.className = 'aura-command-indicator';
          indicator.style.cssText = \`
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-family: Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            border: 2px solid rgba(255,255,255,0.2);
            backdrop-filter: blur(10px);
            animation: slideInRight 0.3s ease-out;
          \`;
          
          // Add CSS animation
          if (!document.querySelector('#aura-animations')) {
            const style = document.createElement('style');
            style.id = 'aura-animations';
            style.textContent = \`
              @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
              @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
              }
              .aura-command-indicator.fade-out {
                animation: fadeOut 0.3s ease-out forwards;
              }
            \`;
            document.head.appendChild(style);
          }
          
          const actionEmojis = {
            'goto': '🌐',
            'click': '👆',
            'fill': '✏️',
            'scroll': '📜',
            'search': '🔍',
            'search_content': '🔍',
            'search_and_navigate': '🔍➡️',
            'select': '📋',
            'hover': '🖱️',
            'wait': '⏳',
            'agree_and_start_form': '✅',
            'start_form_filling': '📝'
          };
          
          const emoji = actionEmojis['${command.action}'] || '⚡';
          indicator.innerHTML = \`\${emoji} Step ${stepNumber}: ${command.action}\`;
          
          document.body.appendChild(indicator);
          
          // Remove indicator after 3 seconds
          setTimeout(() => {
            indicator.classList.add('fade-out');
            setTimeout(() => {
              if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
              }
            }, 300);
          }, 3000);
          
          return { success: true };
        } catch (e) {
          console.error('Indicator error:', e);
          return { success: false, error: e.message };
        }
      })();
    `;
    
    try {
      webview.executeJavaScript(indicatorScript, true);
    } catch (e) {
      console.error('Failed to show command indicator:', e);
    }
  };

  const getDomFromWebview = () => {
    console.log('getDomFromWebview called');
    return new Promise((resolve) => {
      const listener = (event) => {
        console.log('ipc-message received from webview:', event.channel);
        if (event.channel === 'dom-extracted') {
          console.log('dom-extracted event received', event.args[0]);
          webview.removeEventListener('ipc-message', listener);
          resolve(event.args[0]);
        }
      };
      webview.addEventListener('ipc-message', listener);
      console.log('Sending extract-dom to webview');
      webview.send('extract-dom');
    });
  };

  const getCommandScript = (command) => {
    switch (command.action) {
      case 'click':
        return `element.click();`;
      case 'fill':
        const escapedText = command.text.replace(/'/g, "'");
        return `element.value = '${escapedText}';`;
      case 'scroll':
        if (command.selector) {
          return `element.scrollTop += ${command.direction === 'up' ? -(command.amount || 100) : (command.amount || 100)};`;
        } else {
          return `window.scrollBy(0, ${command.direction === 'up' ? -(command.amount || 100) : (command.amount || 100)});`;
        }
        case 'search':
          // Simulate entering text in a search box and submitting
          return `if (element) { element.value = '${command.query}'; element.form && element.form.submit && element.form.submit(); }`;
        case 'traverse':
          // Traverse links by clicking them, handled in executeCommands
          return '';
        case 'follow-link':
          // Click the link to follow
          return `element.click();`;
      case 'select':
        return `element.value = '${command.value}';`;
      case 'hover':
        return `element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));`;
      default:
        return '';
    }
  };

  const executeCommands = async (commands) => {
    addMessage(`📋 Executing ${commands.length} command(s)...`, 'ai');
    
    // Track the types of actions performed for better suggestions
    const actionTypes = new Set();
    let executionFailed = false;
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(`Executing command ${i + 1}/${commands.length}:`, command);
      
      // Track action types
      actionTypes.add(command.action);
      
      // Add visual representation of the command
      const commandDescription = getCommandDescription(command);
      addMessage(`${i + 1}. ${commandDescription}`, 'ai');
      
      // Add visual indicator to the UI
      showCommandIndicator(command, i + 1);

      if (command.action === 'goto') {
        webview.loadURL(command.url);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for navigation
        continue;
      }

      if (command.action === 'wait') {
        addMessage(`⏳ Waiting ${command.milliseconds}ms...`, 'ai');
        await new Promise(resolve => setTimeout(resolve, command.milliseconds));
        continue;
      }

      if (command.action === 'search_content') {
        // Actually search for the topic in the DOM and scroll to it
        console.log(`Searching for topic: ${command.topic}`);
        addMessage(`🔍 Searching for "${command.topic}" on the page...`, 'ai');
        
        const searchScript = `
          (() => {
            const searchTerm = '${command.topic}';
            
            // Create multiple search variations for better matching
            const searchVariations = [
              searchTerm.toLowerCase(),
              searchTerm.toLowerCase().replace(/\s+/g, ''), // remove spaces
              ...searchTerm.toLowerCase().split(' '), // individual words
            ];
            
            // Add common abbreviations and variations
            if (searchTerm.toLowerCase().includes('vehicle') || searchTerm.toLowerCase().includes('vehical')) {
              searchVariations.push('vrt', 'vehicle registration tax', 'motor tax');
            }
            if (searchTerm.toLowerCase().includes('tax')) {
              searchVariations.push('vrt', 'taxation', 'revenue');
            }
            if (searchTerm.toLowerCase().includes('registration')) {
              searchVariations.push('vrt', 'register', 'registration');
            }
            
            console.log('Search variations:', searchVariations);
            
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );
            
            const matches = [];
            let node;
            
            while (node = walker.nextNode()) {
              const nodeText = node.nodeValue.toLowerCase();
              
              // Check if any search variation matches
              for (const variation of searchVariations) {
                if (variation && nodeText.includes(variation)) {
                  const element = node.parentElement;
                  if (element && element.offsetParent !== null) { // Check if visible
                    // Check if it's a meaningful element (not just navigation or tiny text)
                    const rect = element.getBoundingClientRect();
                    if (rect.height > 20 && rect.width > 100) {
                      matches.push({
                        element: element,
                        text: node.nodeValue.trim(),
                        rect: rect,
                        matchedTerm: variation,
                        relevanceScore: calculateRelevance(nodeText, searchVariations)
                      });
                      break; // Don't add same element multiple times
                    }
                  }
                }
              }
            }
            
            // Sort by relevance (longer matches first, then by position on page)
            matches.sort((a, b) => {
              if (a.relevanceScore !== b.relevanceScore) {
                return b.relevanceScore - a.relevanceScore;
              }
              return a.rect.top - b.rect.top; // Earlier on page wins
            });
            
            if (matches.length > 0) {
              // Scroll to the best match
              const bestMatch = matches[0];
              bestMatch.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Highlight the found element temporarily
              const originalStyle = bestMatch.element.style.cssText;
              bestMatch.element.style.backgroundColor = '#ffff00';
              bestMatch.element.style.transition = 'background-color 0.3s';
              bestMatch.element.style.border = '2px solid #ff6600';
              
              setTimeout(() => {
                bestMatch.element.style.backgroundColor = '';
                bestMatch.element.style.border = '';
                setTimeout(() => {
                  bestMatch.element.style.cssText = originalStyle;
                }, 300);
              }, 3000);
              
              return { 
                success: true, 
                found: true, 
                text: bestMatch.text,
                matchedTerm: bestMatch.matchedTerm,
                matches: matches.length,
                allMatches: matches.slice(0, 3).map(m => m.text.substring(0, 50))
              };
            } else {
              return { 
                success: true, 
                found: false, 
                message: 'Topic not found on page',
                searchedFor: searchVariations
              };
            }
            
            // Helper function to calculate relevance
            function calculateRelevance(text, searchTerms) {
              let score = 0;
              for (const term of searchTerms) {
                if (term && text.includes(term)) {
                  score += term.length; // Longer matches get higher score
                }
              }
              return score;
            }
          })();
        `;
        
        try {
          const result = await webview.executeJavaScript(searchScript, true);
          if (result.found) {
            addMessage(`✅ Found "${result.matchedTerm}": ${result.text.substring(0, 100)}... (${result.matches} total matches)`, 'ai');
          } else {
            addMessage(`❌ Topic "${command.topic}" not found. Searched for: ${result.searchedFor.join(', ')}`, 'ai');
            executionFailed = true;
            break;
          }
        } catch (e) {
          console.error('Search content error:', e);
          addMessage(`❌ Error searching for "${command.topic}": ${e.message}`, 'ai');
          executionFailed = true;
          break;
        }
        continue;
      }

      if (command.action === 'search_and_navigate') {
        // Search for the topic and click on it to navigate
        console.log(`Searching and navigating to: ${command.topic}`);
        addMessage(`🔍➡️ Finding and clicking "${command.topic}"...`, 'ai');
        
        const searchAndClickScript = `
          (() => {
            const searchTerm = '${command.topic}';
            
            // Create multiple search variations for better matching
            const searchVariations = [
              searchTerm.toLowerCase(),
              searchTerm.toLowerCase().replace(/\s+/g, ''), // remove spaces
              ...searchTerm.toLowerCase().split(' '), // individual words
            ];
            
            // Add common abbreviations and variations
            if (searchTerm.toLowerCase().includes('vehicle') || searchTerm.toLowerCase().includes('vehical')) {
              searchVariations.push('vrt', 'vehicle registration tax', 'motor tax');
            }
            if (searchTerm.toLowerCase().includes('tax')) {
              searchVariations.push('vrt', 'taxation', 'revenue');
            }
            if (searchTerm.toLowerCase().includes('registration')) {
              searchVariations.push('vrt', 'register', 'registration');
            }
            
            // First, look for clickable elements (links, buttons)
            const clickableElements = document.querySelectorAll('a, button, [role="button"], [onclick]');
            const clickableMatches = [];
            
            clickableElements.forEach(element => {
              if (element.offsetParent !== null) { // Check if visible
                const text = element.textContent.toLowerCase();
                const href = element.getAttribute('href') || '';
                
                for (const variation of searchVariations) {
                  if (variation && (text.includes(variation) || href.toLowerCase().includes(variation))) {
                    const rect = element.getBoundingClientRect();
                    if (rect.height > 10 && rect.width > 50) { // Meaningful size
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
            
            // Sort by relevance
            clickableMatches.sort((a, b) => {
              if (a.relevanceScore !== b.relevanceScore) {
                return b.relevanceScore - a.relevanceScore;
              }
              return a.rect.top - b.rect.top; // Earlier on page wins
            });
            
            if (clickableMatches.length > 0) {
              const bestMatch = clickableMatches[0];
              
              // Highlight briefly before clicking
              const originalStyle = bestMatch.element.style.cssText;
              bestMatch.element.style.backgroundColor = '#00ff00';
              bestMatch.element.style.transition = 'background-color 0.3s';
              bestMatch.element.style.border = '2px solid #0066ff';
              
              // Click after a short delay to show the highlight
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
            
            // Helper function to calculate relevance
            function calculateRelevance(text, searchTerms) {
              let score = 0;
              for (const term of searchTerms) {
                if (term && text.includes(term)) {
                  score += term.length; // Longer matches get higher score
                }
              }
              return score;
            }
          })();
        `;
        
        try {
          const result = await webview.executeJavaScript(searchAndClickScript, true);
          if (result.found && result.clicked) {
            addMessage(`✅ Found and clicked "${result.matchedTerm}": ${result.text}${result.href ? ' → ' + result.href : ''}`, 'ai');
          } else {
            addMessage(`❌ Could not find clickable element for "${command.topic}". Searched for: ${result.searchedFor.join(', ')}`, 'ai');
            executionFailed = true;
            break;
          }
        } catch (e) {
          console.error('Search and navigate error:', e);
          addMessage(`❌ Error navigating to "${command.topic}": ${e.message}`, 'ai');
          executionFailed = true;
          break;
        }
        continue;
      }

      if (command.action === 'agree_and_start_form') {
        // Check acknowledgment boxes and start form filling
        console.log('Checking acknowledgment and starting form filling...');
        addMessage(`✅ Looking for agreement checkboxes and forms...`, 'ai');
        
        const checkAcknowledgmentScript = `
          (() => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            const acknowledgedCheckboxes = [];
            
            checkboxes.forEach(checkbox => {
              if (checkbox.offsetParent !== null && !checkbox.disabled) { // Visible and enabled
                const label = checkbox.labels?.[0]?.textContent || 
                             checkbox.nextElementSibling?.textContent ||
                             checkbox.parentElement?.textContent || '';
                
                // Look for acknowledgment-related text
                const acknowledgmentKeywords = ['acknowledge', 'accept', 'agree', 'confirm', 'terms', 'conditions', 'privacy', 'consent'];
                const labelLower = label.toLowerCase();
                
                if (acknowledgmentKeywords.some(keyword => labelLower.includes(keyword))) {
                  if (!checkbox.checked) {
                    checkbox.checked = true;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                    
                    // Highlight the checkbox briefly
                    const parent = checkbox.parentElement || checkbox;
                    const originalStyle = parent.style.cssText;
                    parent.style.backgroundColor = '#90EE90';
                    parent.style.transition = 'background-color 0.3s';
                    
                    setTimeout(() => {
                      parent.style.backgroundColor = '';
                      setTimeout(() => {
                        parent.style.cssText = originalStyle;
                      }, 300);
                    }, 1000);
                    
                    acknowledgedCheckboxes.push({
                      label: label.trim(),
                      checked: true
                    });
                  }
                }
              }
            });
            
            return { success: true, acknowledged: acknowledgedCheckboxes };
          })();
        `;
        
        try {
          const ackResult = await webview.executeJavaScript(checkAcknowledgmentScript, true);
          if (ackResult.acknowledged.length > 0) {
            addMessage(`✓ Acknowledged: ${ackResult.acknowledged.map(a => a.label).join(', ')}`, 'ai');
            // Wait a moment for any page updates
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Now automatically start form filling
            const startFormCommand = { action: 'start_form_filling' };
            await executeCommands([startFormCommand]);
          } else {
            addMessage('No acknowledgment checkboxes found. Starting form filling directly...', 'ai');
            const startFormCommand = { action: 'start_form_filling' };
            await executeCommands([startFormCommand]);
          }
        } catch (e) {
          console.error('Acknowledgment error:', e);
          addMessage(`❌ Error with acknowledgment: ${e.message}`, 'ai');
          executionFailed = true;
          break;
        }
        continue;
      }

      if (command.action === 'start_form_filling') {
        // Start the form filling process (without acknowledgment handling)
        console.log('Starting form filling process...');
        
        const formFieldsScript = `
          (() => {
            const formFields = [];
            
            // More comprehensive selector - include all input types and common form elements
            const allPossibleInputs = document.querySelectorAll('input, textarea, select, [contenteditable="true"]');
            console.log('Total elements found:', allPossibleInputs.length);
            
            // Log all found elements for debugging
            allPossibleInputs.forEach((element, index) => {
              console.log(\`Element \${index + 1}:\`, {
                tagName: element.tagName,
                type: element.type,
                id: element.id,
                name: element.name,
                className: element.className,
                placeholder: element.placeholder,
                disabled: element.disabled,
                readOnly: element.readOnly,
                offsetParent: element.offsetParent !== null,
                style: element.style.display
              });
            });
            
            // Filter for actual form inputs (more permissive than before)
            const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select');
            console.log('Filtered form inputs:', inputs.length);
            
            inputs.forEach((input, index) => {
              // More lenient visibility check
              const isVisible = input.offsetParent !== null || 
                               window.getComputedStyle(input).display !== 'none' ||
                               window.getComputedStyle(input).visibility !== 'hidden';
              
              const isEditable = !input.disabled && !input.readOnly;
              
              console.log(\`Input \${index + 1} visibility/editability:\`, {
                tagName: input.tagName,
                type: input.type,
                isVisible: isVisible,
                isEditable: isEditable,
                offsetParent: input.offsetParent !== null,
                computedDisplay: window.getComputedStyle(input).display,
                computedVisibility: window.getComputedStyle(input).visibility
              });
              
              if (isVisible && isEditable) {
                const label = input.labels?.[0]?.textContent || 
                             input.getAttribute('placeholder') || 
                             input.getAttribute('aria-label') || 
                             input.getAttribute('name') || 
                             input.getAttribute('title') ||
                             \`Field \${index + 1}\`;
                
                // Create a better selector
                let selector = '';
                if (input.id) {
                  selector = '#' + input.id;
                } else if (input.name) {
                  selector = input.tagName.toLowerCase() + '[name="' + input.name + '"]';
                } else if (input.className) {
                  selector = input.tagName.toLowerCase() + '.' + input.className.split(' ').filter(c => c).join('.');
                } else {
                  // Fallback: use position-based selector
                  const allSameTagInputs = Array.from(document.querySelectorAll(input.tagName.toLowerCase()));
                  const inputIndex = allSameTagInputs.indexOf(input);
                  selector = input.tagName.toLowerCase() + ':nth-of-type(' + (inputIndex + 1) + ')';
                }
                
                console.log('Found field:', {
                  label: label.trim(),
                  selector: selector,
                  type: input.type || input.tagName.toLowerCase(),
                  tagName: input.tagName
                });
                
                formFields.push({
                  selector: selector,
                  type: input.type || input.tagName.toLowerCase(),
                  label: label.trim(),
                  required: input.required,
                  value: input.value,
                  options: input.tagName.toLowerCase() === 'select' ? Array.from(input.options).map(o => o.text) : null
                });
              }
            });
            
            console.log('Total fields found:', formFields.length);
            return { success: true, fields: formFields };
          })();
        `;
        
        try {
          const result = await webview.executeJavaScript(formFieldsScript, true);
          console.log('Form detection result:', result);
          
          if (result.success && result.fields.length > 0) {
            currentFormFields = result.fields;
            currentFieldIndex = 0;
            isFillingForm = true;
            
            addMessage(`Found ${result.fields.length} form fields. Let's fill them out!`, 'ai');
            console.log('Form fields:', result.fields);
            askNextFormQuestion();
          } else {
            addMessage('❌ No form fields found on this page. Please navigate to a form first.', 'ai');
            console.log('No form fields detected');
            executionFailed = true;
            break;
          }
        } catch (e) {
          console.error('Form detection error:', e);
          addMessage(`❌ Error detecting form fields: ${e.message}`, 'ai');
          executionFailed = true;
          break;
        }
        continue;
      }

        if (command.action === 'traverse') {
          // Traverse links to a specified depth
          let depth = command.depth || 1;
          let selector = command.selector;
          for (let i = 0; i < depth; i++) {
            const script = `
              (() => {
                const element = document.querySelector('${selector}');
                if (element) { element.click(); return { success: true }; }
                return { success: false, error: 'Element not found for traverse' };
              })();
            `;
            try {
              const result = await webview.executeJavaScript(script, true);
              if (!result.success) {
                addMessage(`❌ Traverse failed: ${result.error}`, 'ai');
                executionFailed = true;
                break;
              }
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for navigation
            } catch (e) {
              console.error('Traverse error:', e);
              addMessage(`❌ Traverse error: ${e.message}`, 'ai');
              executionFailed = true;
              break;
            }
          }
          continue;
        }

        if (command.action === 'follow-link') {
          // Click the link to follow
          const script = `
            (() => {
              const element = document.querySelector('${command.selector}');
              if (element) { element.click(); return { success: true }; }
              return { success: false, error: 'Link not found' };
            })();
          `;
          try {
            const result = await webview.executeJavaScript(script, true);
            if (result && !result.success) {
              addMessage(`❌ Follow-link failed: ${result.error}`, 'ai');
              executionFailed = true;
              break;
            }
          } catch (e) {
            console.error('Follow-link error:', e);
            addMessage(`❌ Follow-link error: ${e.message}`, 'ai');
            executionFailed = true;
            break;
          }
          continue;
        }

      const escapedSelector = command.selector ? command.selector.replace(/'/g, "'") : '';

      const script = `
        (() => {
          try {
            const element = document.querySelector('${escapedSelector}');
            if (!element) {
              return { success: false, error: 'Element with selector \'${escapedSelector}\' not found' };
            }
            ${getCommandScript(command)}
            return { success: true };
          } catch (e) {
            return { success: false, error: e.message };
          }
        })();
      `;

      try {
        const result = await webview.executeJavaScript(script, true);
        if (result && result.success) {
          addMessage(`✅ Step ${i + 1} completed successfully`, 'ai');
        } else if (result && !result.success) {
          const errorMessage = `❌ Step ${i + 1} failed: ${result.error}`;
          console.error(errorMessage);
          addMessage(errorMessage, 'ai');
          executionFailed = true;
          break;
        }
      } catch (e) {
        console.error('Error executing script in webview:', e);
        addMessage(`❌ Step ${i + 1} failed: ${e.message}`, 'ai');
        executionFailed = true;
        break;
      }
      
      // Small delay between commands for better visual feedback
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Handle execution results
    if (executionFailed) {
      addMessage(`⚠️ Command execution failed. Going back to the previous page...`, 'ai');
      
      // Go back to the previous page
      try {
        if (webview.canGoBack()) {
          webview.goBack();
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for navigation
        }
      } catch (e) {
        console.error('Error going back:', e);
      }
      
      addMessage(`🔄 Please try a different command or approach. I'm ready to help with another task.`, 'ai');
      return; // Don't suggest next actions
    }
    
    addMessage(`🎉 All ${commands.length} commands completed!`, 'ai');
    
    // Provide next action suggestions after automation completes successfully
    await suggestNextActions(Array.from(actionTypes));
  };

  // Form filling helper functions
  const askNextFormQuestion = () => {
    if (currentFieldIndex < currentFormFields.length) {
      const field = currentFormFields[currentFieldIndex];
      let question = `Please provide a value for "${field.label}"`;
      
      if (field.type === 'select' && field.options) {
        question += ` (Options: ${field.options.join(', ')})`;
      } else if (field.type === 'email') {
        question += ' (Email address)';
      } else if (field.type === 'tel') {
        question += ' (Phone number)';
      } else if (field.type === 'date') {
        question += ' (Date format: YYYY-MM-DD)';
      }
      
      if (field.required) {
        question += ' *Required';
      }
      
      addMessage(question, 'ai');
    } else {
      // All fields completed
      isFillingForm = false;
      addMessage('Form filling completed! All fields have been filled.', 'ai');
    }
  };

  const fillCurrentField = async (value) => {
    if (currentFieldIndex < currentFormFields.length) {
      const field = currentFormFields[currentFieldIndex];
      console.log('Filling field:', field.label, 'with value:', value, 'using selector:', field.selector);
      
      const fillScript = `
        (() => {
          try {
            console.log('Looking for element with selector: ${field.selector}');
            const element = document.querySelector('${field.selector}');
            
            if (!element) {
              console.log('Element not found, trying alternative selectors...');
              // Try alternative selectors
              const allInputs = document.querySelectorAll('input, textarea, select');
              let foundElement = null;
              
              for (let input of allInputs) {
                const inputLabel = input.labels?.[0]?.textContent || 
                                 input.getAttribute('placeholder') || 
                                 input.getAttribute('aria-label') || 
                                 input.getAttribute('name') || '';
                
                if (inputLabel.toLowerCase().includes('${field.label}'.toLowerCase().substring(0, 10))) {
                  foundElement = input;
                  break;
                }
              }
              
              if (!foundElement) {
                return { success: false, error: 'Field not found with selector: ${field.selector}' };
              } else {
                console.log('Found element using label matching');
                element = foundElement;
              }
            }
            
            console.log('Found element:', element.tagName, element.type, element.id, element.name);
            
            // Focus on the element first
            element.focus();
            
            // Clear existing value
            element.value = '';
            
            // Set the value
            if (element.tagName.toLowerCase() === 'select') {
              console.log('Handling select element');
              const options = Array.from(element.options);
              console.log('Available options:', options.map(o => o.text));
              
              const matchingOption = options.find(opt => 
                opt.text.toLowerCase().includes('${value}'.toLowerCase()) || 
                opt.value.toLowerCase().includes('${value}'.toLowerCase())
              );
              
              if (matchingOption) {
                element.value = matchingOption.value;
                console.log('Selected option:', matchingOption.text);
              } else {
                element.value = '${value}';
                console.log('No matching option found, set value directly');
              }
            } else {
              console.log('Setting text value');
              element.value = '${value}';
            }
            
            // Trigger multiple events to ensure the form recognizes the change
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
            
            // Highlight the filled field briefly
            const originalStyle = element.style.cssText;
            element.style.backgroundColor = '#90EE90';
            element.style.transition = 'background-color 0.3s';
            element.style.border = '2px solid #00AA00';
            
            setTimeout(() => {
              element.style.backgroundColor = '';
              element.style.border = '';
              setTimeout(() => {
                element.style.cssText = originalStyle;
              }, 300);
            }, 1500);
            
            return { success: true, value: element.value };
          } catch (e) {
            console.error('Fill field error:', e);
            return { success: false, error: e.message };
          }
        })();
      `;
      
      try {
        const result = await webview.executeJavaScript(fillScript, true);
        if (result.success) {
          addMessage(`✓ Filled "${field.label}" with: ${value}`, 'ai');
          currentFieldIndex++;
          
          // Wait a moment then ask for next field
          setTimeout(() => {
            askNextFormQuestion();
          }, 500);
        } else {
          addMessage(`Error filling field "${field.label}": ${result.error}`, 'ai');
        }
      } catch (e) {
        console.error('Fill field error:', e);
        addMessage(`Error filling field: ${e.message}`, 'ai');
      }
    }
  };

  const extractVisibleTextFromWebview = async () => {
    // This script extracts all visible text from the page
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

  const extractScreenContextFromWebview = async () => {
    // Extract a flat list of visible, interactive elements for LLM context
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
            element.hasAttribute('role') && ['button','link','textbox','searchbox','menuitem'].includes(element.getAttribute('role'))
          );
        }
        function getElementInfo(element) {
          if (!isVisible(element) || !isInteractive(element)) return null;
          return {
            tag: element.tagName.toLowerCase(),
            id: element.id || undefined,
            class: element.className || undefined,
            name: element.getAttribute('name') || undefined,
            role: element.getAttribute('role') || undefined,
            ariaLabel: element.getAttribute('aria-label') || undefined,
            placeholder: element.getAttribute('placeholder') || undefined,
            text: element.innerText ? element.innerText.trim() : undefined,
            type: element.getAttribute('type') || undefined,
            href: element.getAttribute('href') || undefined
          };
        }
        function walk(element, result) {
          if (!element) return;
          if (element.nodeType === Node.ELEMENT_NODE) {
            const info = getElementInfo(element);
            if (info) result.push(info);
            for (const child of element.children) {
              walk(child, result);
            }
          }
        }
        const result = [];
        walk(document.body, result);
        return result;
      })();
    `, true);
  };

  const handleDemoCommands = (message) => {
    const lowerMessage = message.toLowerCase().trim();
    
    // Demo Command 1: Go to revenue.ie
    if (lowerMessage.includes('go to revenue.ie') || lowerMessage === '1' || lowerMessage.includes('revenue.ie')) {
      return [
        {
          "action": "goto",
          "url": "https://www.revenue.ie/"
        }
      ];
    }
    
    // Demo Command 2: Scroll down
    if (lowerMessage.includes('scroll down') || lowerMessage === '2' || (lowerMessage.includes('scroll') && lowerMessage.includes('down'))) {
      return [
        {
          "action": "scroll",
          "direction": "down",
          "amount": 500
        },
        {
          "action": "wait",
          "milliseconds": 1000
        },
        {
          "action": "scroll",
          "direction": "down",
          "amount": 500
        },
        {
          "action": "wait",
          "milliseconds": 1000
        },
        {
          "action": "scroll",
          "direction": "down",
          "amount": 500
        }
      ];
    }
    
    // Demo Command 3: Look for specific topic and bring into focus
    if (lowerMessage.includes('look for') || lowerMessage === '3' || lowerMessage.includes('find') || lowerMessage.includes('search for')) {
      const topic = extractTopicFromMessage(lowerMessage);
      return [
        {
          "action": "search_content",
          "topic": topic
        }
      ];
    }
    
    // Demo Command 4: Go into a section/page
    if (lowerMessage.includes('go into') || lowerMessage === '4' || lowerMessage.includes('navigate to') || lowerMessage.includes('enter')) {
      const topic = extractTopicFromMessage(lowerMessage);
      return [
        {
          "action": "search_and_navigate",
          "topic": topic
        }
      ];
    }
    
    // Demo Command 5: I agree - Check acknowledgment boxes and start form
    if (lowerMessage.includes('i agree') || lowerMessage.includes('i accept') || lowerMessage.includes('i acknowledge')) {
      return [
        {
          "action": "agree_and_start_form"
        }
      ];
    }
    
    // Demo Command 6: Fill form (without acknowledgment)
    if (lowerMessage.includes('fill form') || lowerMessage === '5' || lowerMessage.includes('start form') || lowerMessage.includes('form filling')) {
      return [
        {
          "action": "start_form_filling"
        }
      ];
    }
    
    return null; // Not a demo command
  };

  const extractTopicFromMessage = (message) => {
    // Extract topic from messages like "look for VRT" or "go into vehicle registration"
    const patterns = [
      /look for (.+)/i,
      /find (.+)/i,
      /search for (.+)/i,
      /go into (.+)/i,
      /navigate to (.+)/i,
      /enter (.+)/i,
      /topic (.+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return 'information';
  };

  const sendMessage = async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    chatInput.value = '';

    try {
    // Check if we're in form filling mode
    if (isFillingForm) {
      // Check for cancel commands
      if (lowerMessage.includes('cancel') || lowerMessage.includes('stop') || lowerMessage.includes('quit')) {
        isFillingForm = false;
        currentFormFields = [];
        currentFieldIndex = 0;
        addMessage('Form filling cancelled.', 'ai');
        return;
      }
      
      await fillCurrentField(message);
      return;
    }      // Check for demo commands first
      const demoCommands = handleDemoCommands(message);
      if (demoCommands) {
        addMessage("Executing command...", 'ai');
        await executeCommands(demoCommands);
        return;
      }

      // Classify intent first
  const intent = await window.gptAPI.classifyIntent(message);
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

        const messageWithContext = `
You are an AI assistant that helps users interact with a web page.
The user has given you a command: "${message}"

The user is currently on a page with the following visible, interactive elements (flat JSON list):
${JSON.stringify(screenContext, null, 2)}

Your task is to generate a sequence of commands to be executed on the page to fulfill the user's request.
The commands should be in a JSON array format. Each object in the array should have an "action" property and other properties depending on the action.

IMPORTANT:
- Only use URLs, selectors, and actions that are present in the provided context. Do NOT invent, guess, or hallucinate any links, selectors, or actions.
- When the user wants to visit or sign in to a page, look for the most relevant link or button in the context by matching its visible text, href, or other attributes.
- For navigation, always use the "goto" action with the "url" property set to the correct absolute or relative href from the context. Do NOT use relative URLs unless no absolute URL is available. Do NOT use "click" for navigation to external sites.
- When matching by text, use partial/substring matching, ignore case and extra whitespace, and select the closest match to the user's phrase.
- For clicking buttons or links on the current page, use "click" with the correct selector (by text, id, class, etc.).
- Always prefer exact or closest matches for text, href, or aria-label when selecting elements.
- If no matching element is found in the context, respond with an empty array: []

The available actions are:
- "goto": navigates to a new URL. Requires a "url" property.
- "click": clicks on an element. Requires a "selector" property (a standard CSS selector that matches the element in the context).
- "fill": types text into an input field. Requires a "selector" property and a "text" property.
- "scroll": scrolls an element or the window. Requires a "direction" property ('up' or 'down') and an optional "selector" property.
- "select": selects an option in a dropdown menu. Requires a "selector" property and a "value" property.
- "hover": hovers the mouse over an element. Requires a "selector" property.

Examples:
User command: "go to vehicle registration tax"
Context contains:
  { "tag": "a", "class": "tile", "text": "Vehicle Registration Tax (VRT)\n\nImporting a vehicle, calculating and paying VRT, reliefs, exemptions, appeals and vehicle conversions.", "href": "/en/vrt/index.aspx" }
Generated commands:
[
  {
    "action": "goto",
    "url": "/en/vrt/index.aspx"
  }
]

User command: "go to my account sign in page"
Context contains:
  { "tag": "a", "text": "myAccount", "href": "https://www.ros.ie/myaccount-web/sign_in.html?execution=e1s1&lang=en" }
Generated commands:
[
  {
    "action": "goto",
    "url": "https://www.ros.ie/myaccount-web/sign_in.html?execution=e1s1&lang=en"
  }
]

User command: "click the Search button"
Context contains:
  { "tag": "button", "id": "btnSearch", "text": "Search" }
Generated commands:
[
  {
    "action": "click",
    "selector": "#btnSearch"
  }
]

User command: "fill the search box with 'Ireland'"
Context contains:
  { "tag": "input", "id": "searchInput", "placeholder": "Search" }
Generated commands:
[
  {
    "action": "fill",
    "selector": "#searchInput",
    "text": "Ireland"
  }
]

Please generate the JSON array of commands. Provide only the JSON array, with no other text before or after it.
`;
        console.log('Sending message to LLM with context...');
  const llmResponse = await window.gptAPI.chat([{ role: 'user', content: messageWithContext }]);
        console.log('LLM response received:', llmResponse);
        await window.mainAPI.saveLlmLog(llmResponse);
        try {
          const commands = JSON.parse(llmResponse);
          addMessage("🚀 Executing the automation steps...", 'ai');
          await executeCommands(commands);
          addMessage("✨ Task completed successfully!", 'ai');
        } catch (e) {
          addMessage(llmResponse, 'ai');
        }
      } else if (intent === 'question') {
        // Extract visible text from the webview
        addMessage('Let me look that up for you...', 'ai');
        const pageText = await extractVisibleTextFromWebview();
        console.log('Extracted page text:', pageText);
        const prompt = `You are an AI assistant. The user is viewing a website and has asked: "${message}"\n\nHere is the visible text from the page:\n${pageText}\n\nPlease answer the user's question using only the information from the page. If the answer is not present, say so.`;
        const llmResponse = await window.gptAPI.chat([{ role: 'user', content: prompt }]);
        addMessage(llmResponse, 'ai');
        await window.mainAPI.saveLlmLog(llmResponse);
        
        // Provide next action suggestions after answering questions
        await suggestNextActions();
      } else {
        addMessage("Sorry, I couldn't understand your request.", 'ai');
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      addMessage('Sorry, I encountered an error. Please try again later.', 'ai');
    }
  };

  // Update the URL input when the webview navigates
  webview.addEventListener('did-navigate', () => {
    urlInput.value = webview.getURL();
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
