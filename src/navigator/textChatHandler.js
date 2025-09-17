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
    console.log('Form session is active, routing message to form handler:', message);
    const consumed = await handleFormInput(message);
    if (consumed) {
      console.log('Message consumed by form handler');
      return;
    }
  }

    try {
        // Classify intent first
        const intent = await window.ollamaAPI.classifyIntent(message);
        console.log('Intent classified as:', intent, 'for message:', message);

        if (intent === 'action') {
            // Check for form filling keywords first before sending to LLM
            const lowerMessage = message.toLowerCase();
            console.log('Checking for form filling keywords in message:', lowerMessage);
            if (lowerMessage.includes('fill form') || 
                lowerMessage.includes('start form') || 
                lowerMessage.includes('form filling') ||
                lowerMessage.includes('start filling')) {
              console.log('✅ Detected form filling request, using start_form_filling action');
              const formCommands = [{ "action": "start_form_filling" }];
              addMessage(chatMessages, "Starting form filling process...", 'ai');
              await executeCommands({ webview, commands: formCommands, addMessage: (t,s)=>addMessage(chatMessages,t,s||'ai') });
              return;
            }
            console.log('No form filling keywords detected, proceeding with normal command generation');
            
            // Extract visible screen context instead of DOM
            console.log('Extracting screen context...');
            const screenContext = await extractScreenContextFromWebview(webview);
            console.log('Screen context extracted:', screenContext);

            if (screenContext) {
                console.log('Saving screen context to log file...');
                await window.mainAPI.saveDomLog(screenContext);
                console.log('Screen context saved to log file.');
            }

            // Use the working prompt structure from dev_kaushal branch
            const messageWithContext = `
You are an AI assistant that helps users interact with a web page.
The user has given you a command: "${message}"

The user is currently on a page with the following visible, interactive elements (flat JSON list):
${JSON.stringify(screenContext, null, 2)}

Your task is to generate a sequence of commands to be executed on the page to fulfill the user's request.
The commands should be in a JSON array format. Each object in the array should have an "action" property and other properties depending on the action.

IMPORTANT:
- Only use URLs, selectors, and actions that are present in the provided context. Do NOT invent, guess, or hallucinate any links, selectors, or actions.
- When the user wants to visit or navigate to something, look for the most relevant link or button in the context by matching its visible text, href, or other attributes.
- For navigation, always use the "search_and_navigate" action with the "topic" property set to the user's search terms.
- When matching by text, use partial/substring matching, ignore case and extra whitespace, and select the closest match to the user's phrase.
- Always prefer exact or closest matches for text, href, or aria-label when selecting elements.
- If no matching element is found in the context, respond with an empty array: []

The available actions are:
- "search_and_navigate": searches for and clicks on an element to navigate. Requires a "topic" property with the search terms.
- "click": clicks on an element. Requires a "selector" property (a standard CSS selector that matches the element in the context).
- "fill": types text into an input field. Requires a "selector" property and a "value" property.
- "select": selects an option in a dropdown menu. Requires a "selector" property and a "value" property.
- "agree_and_start_form": checks agreement boxes automatically.
- "start_form_filling": starts guided form filling session.

Examples:
User command: "go to vehicle tax calculation"
Context contains:
  { "tag": "button", "id": "newVehicleButton", "text": "Vehicle VRT Calculation" }
Generated commands:
[
  {
    "action": "search_and_navigate",
    "topic": "vehicle tax calculation"
  }
]

User command: "click the search button"
Context contains:
  { "tag": "button", "id": "btnSearch", "text": "Search" }
Generated commands:
[
  {
    "action": "click",
    "selector": "#btnSearch"
  }
]

Please generate the JSON array of commands. Provide only the JSON array, with no other text before or after it.
`;
      console.log('Sending message to LLM with context...');
      const llmResponse = await getOpenAIChatCompletion(messageWithContext, {
        fallbackFn: async (prompt, meta) => {
          console.warn('Falling back to Ollama for navigation. Reason:', meta);
          // Simple fallback: ask Ollama to output ONLY JSON.
          const fallbackMessages = [{
            role: 'user',
            content: `${prompt}\n\nIf you cannot comply fully, output a minimal JSON object: [{"action":"search_and_navigate","topic":"${message.replace(/"/g,'\\"')}"}]`
          }];
          const resp = await window.ollamaAPI.chat(fallbackMessages);
          return resp;
        },
        feature: 'navigator'
      });
            console.log('LLM response received:', llmResponse);
            await window.mainAPI.saveLlmLog(llmResponse);
            try {
                const commands = JSON.parse(llmResponse);
                if (!Array.isArray(commands)) {
                  addMessage(chatMessages, 'Invalid response format from AI. Expected array of commands.', 'ai');
                  return;
                }
                addMessage(chatMessages, "🚀 Executing the automation steps...", 'ai');
                await executeCommands({ webview, commands, screenContext, addMessage: (t,s)=>addMessage(chatMessages,t,s||'ai') });
                
                // Don't show completion message for form filling commands (they're ongoing)
                const hasFormCommand = commands.some(c => c.action === 'start_form_filling');
                if (!hasFormCommand) {
                  addMessage(chatMessages, "✨ Task completed successfully!", 'ai');
                }
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