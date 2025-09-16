import {
    extractScreenContextFromWebview,
    extractVisibleTextFromWebview
} from '../helpers/extractors.js';
import {
    addMessage
} from './chatutils.js';
import { getOpenAIChatCompletion } from '../helpers/openai.js';
import { generateNextSteps } from './nextStepSuggestions.js';
import { isFormSessionActive, handleFormInput } from './formFillingHandler.js';
import { executeCommands } from './commandExecutor.js';


// Send message to AI
export async function sendMessage(webview, chatInput, chatMessages) {
    if (!chatInput || !chatMessages) return;
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(chatMessages, message, 'user');
    chatInput.value = '';

  // If a form session is active, route message directly to form handler and short-circuit
  if (isFormSessionActive()) {
    const consumed = await handleFormInput(message);
    if (consumed) return;
  }

    // Check if we are on homepage.html and webview is null
    const isOnHomepage = window.location.pathname.includes('homepage.html');
    // Classify intent first (moved up to determine if webview is needed)
    const intent = await window.ollamaAPI.classifyIntent(message);
    console.log('Intent classified as:', intent, 'for message:', message);
    const needsWebview = (intent === 'action' || intent === 'question');

    if (isOnHomepage && webview === null && needsWebview) {
        addMessage(chatMessages, "To perform this action, I need to navigate to a web page. Navigating to Google.com...", 'ai');
        window.electronAPI.sendNavigate('https://www.google.com');
        return; // Stop processing here, the page will reload.
    }

    try {
        // Classify intent first (already done above)
        // const intent = await window.ollamaAPI.classifyIntent(message);
        // console.log('Intent classified as:', intent, 'for message:', message);

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

            // Prompt for high-level command(s) (now supports array for multi-step)
            const navPrompt = `You are a browser assistant.\nGiven the user's instruction: "${message}", output EITHER a single JSON object OR a JSON array of objects (for multiple sequential actions).\nSupported actions (initial set):\n- search_and_navigate => {"action":"search_and_navigate","topic":"<topic>"}\n- agree_and_start_form => {"action":"agree_and_start_form"}\n- start_form_filling => {"action":"start_form_filling"}\n- click => {"action":"click","selector":"<css selector>"}\n- fill => {"action":"fill","selector":"<css selector>","value":"<text>"}\n- select => {"action":"select","selector":"<css selector>","value":"<visible option text>"}\nRules:\n1. Output ONLY raw JSON (no markdown, text, or explanation).\n2. If multiple steps are clearly requested (e.g. navigate then fill), output a JSON array in the exact order.\n3. For vague requests to proceed or continue on a site with a visible agreement, prefer {"action":"agree_and_start_form"}.\n4. For 'start the form' or similar, output {"action":"start_form_filling"}.\n5. If unsure default to {"action":"search_and_navigate","topic":"${message.replace(/"/g,'\\"')}"}.`;
      console.log('Sending navPrompt to ChatGPT...');
      const llmResponse = await getOpenAIChatCompletion(navPrompt, {
        fallbackFn: async (prompt, meta) => {
          console.warn('Falling back to Ollama for navPrompt. Reason:', meta);
          // Simple fallback: ask Ollama to output ONLY JSON.
          const fallbackMessages = [{
            role: 'user',
            content: `${prompt}\n\nIf you cannot comply fully, output a minimal JSON object: {"action":"search_and_navigate","topic":"<best guess>"}`
          }];
          const resp = await window.ollamaAPI.chat(fallbackMessages);
          return resp;
        },
        feature: 'navigator'
      });
            console.log('LLM response received:', llmResponse);
            await window.mainAPI.saveLlmLog(llmResponse);
            try {
                let parsed;
                try { parsed = JSON.parse(llmResponse); } catch (e) { /* not JSON */ }
                if (!parsed) {
                  addMessage(chatMessages, llmResponse, 'ai');
                  return;
                }
                // Normalize to array
                const commands = Array.isArray(parsed) ? parsed : [parsed];
                await executeCommands({ webview, commands, addMessage: (t,s)=>addMessage(chatMessages,t,s||'ai') });
                // After finishing command execution, trigger next steps only if a navigation occurred OR commands length > 0
                const hadNav = commands.some(c=>c.action==='search_and_navigate');
                if (hadNav) {
                  addMessage(chatMessages, '🤔 Analyzing page content to suggest next steps...', 'ai');
                  await generateNextSteps(webview, (text, sender) => addMessage(chatMessages, text, sender || 'ai'));
                }
            } catch (e) {
                addMessage(chatMessages, `⚠️ Could not process command JSON: ${e.message}`, 'ai');
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