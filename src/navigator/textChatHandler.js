import {
    extractScreenContextFromWebview,
    extractVisibleTextFromWebview
} from '../helpers/extractors.js';
import {
    addMessage
} from './chatutils.js';
import {
    getOpenAIChatCompletion
} from '../helpers/openai.js';


// Send message to AI
export async function sendMessage(webview, chatInput, chatMessages) {
    if (!chatInput || !chatMessages) return;
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(chatMessages, message, 'user');
    chatInput.value = '';

    try {
        // Classify intent first
        const intent = await window.ollamaAPI.classifyIntent(message);
        console.log('Intent classified as:', intent, 'for message:', message);

        if (intent === 'action') {
            // Extract visible screen context instead of DOM
            console.log('Extracting screen context...');
            const screenContext = await extractScreenContextFromWebview(webview);
            console.log('Screen context extracted:', screenContext);

            if (screenContext) {
                console.log('Saving screen context to log file...');
                await window.mainAPI.saveDomLog(screenContext);
                console.log('Screen context saved to log file.');
            }

            // Prompt for high-level command (search_and_navigate)
            const navPrompt = `You are a browser assistant.\nGiven the user's command: "${message}", \n          generate a single high-level command object in JSON format.\nIf the command is to search or navigate to a topic, use:\n{\n  action: 'search_and_navigate',\n          \n  topic: '<topic>'\n}\nIf the command is to click, fill, or interact, use:\n{\n  action: '<action>',\n  selector: '<selector>',\n  value: '<value>' // \n          if applicable\n}\nOnly output the JSON object, no extra text.\n          `;
            console.log('Sending navPrompt to ChatGPT...');
            const llmResponse = await getOpenAIChatCompletion(navPrompt);
            console.log('LLM response received:', llmResponse);
            await window.mainAPI.saveLlmLog(llmResponse);
            try {
                const commandObj = JSON.parse(llmResponse);
                if (commandObj.action === 'search_and_navigate') {
                    addMessage(chatMessages, 'Executing command:', 'ai');
                } else {
                    addMessage(chatMessages, `Executing command: ${JSON.stringify(commandObj)}`, 'ai');
                }
                // Execute search_and_navigate like aura-nav
                if (commandObj.action === 'search_and_navigate' && commandObj.topic) {
                    console.log(`Searching and navigating to: ${commandObj.topic}`);
                    const searchAndClickScript = `
              (() => {
                const searchTerm = '${commandObj.topic.replace(/\'/g, "\\'")}';
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
                            addMessage(chatMessages, `Navigating to "${result.matchedTerm}": ${result.text}${result.href ? ' → ' + result.href : ''}`, 'ai');
                        } else {
                            addMessage(chatMessages, `Could not find clickable element for "${commandObj.topic}". Searched for: ${result.searchedFor.join(', ')}`, 'ai');
                        }
                    } catch (e) {
                        console.error('Search and navigate error:', e);
                        addMessage(chatMessages, `Error navigating to "${commandObj.topic}": ${e.message}`, 'ai');
                    }
                }
            } catch (e) {
                addMessage(chatMessages, llmResponse, 'ai');
            }
        } else if (intent === 'question') {
            // Extract visible text from the webview
            addMessage(chatMessages, 'Let me look that up for you...', 'ai');
            // You may need to implement extractVisibleTextFromWebview for Aura-dev
            const pageText = await extractVisibleTextFromWebview(webview);
            console.log('Extracted page text:', pageText);
            const prompt = `You are an AI assistant. The user is viewing a website and has asked: "${message}"\n\nHere is the visible text from the page:\n${pageText}\n\nPlease answer the user's question using only the information from the page. If the answer is not present, say so.`;
            const llmResponse = await window.ollamaAPI.chat([{
                role: 'user',
                content: prompt
            }]);
            addMessage(chatMessages, llmResponse, 'ai');
            await window.mainAPI.saveLlmLog(llmResponse);
        } else {
            addMessage(chatMessages, "Sorry, I couldn't understand your request.", 'ai');
        }
    } catch (error) {
        console.error('Error in sendMessage:', error);
        addMessage(chatMessages, 'Sorry, I encountered an error. Please try again later.', 'ai');
    }
}