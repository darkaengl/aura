import {
    getOpenAIChatCompletion
} from '../helpers/openai.js';


/**
 * Processes CSS by splitting into chunks
 */
export const processCssInChunks = async (currentCss, violations) => {
  console.log(`[processCssInChunks] Start`);
  console.log('[processCssInChunks] Violations=', violations)
  const pieces = currentCss.split('}\n}\n');

  let limit = 10000;  // character limit
  let chunks = [];
  let chunk = '';

  for (let piece of pieces){
      piece +='}\n}\n';
      if (piece.length >= limit){
        if (chunk){
            chunks.push(chunk);
            chunk = '';
        }
        chunks.push(piece);
          continue;
      }
      if (chunk.length + piece.length <= limit){
        chunk += piece;
      } else {
        if (chunk) {
            chunks.push(chunk);
            chunk = piece;
        }
      }
  }

  if (chunk) {
    chunks.push(chunk);
  }

  chunks[chunks.length-1] = chunks[chunks.length-1].slice(0, ('}\n}\n').length *-1);

  let combinedSimplifiedCss = '';

  console.log(`[processCssInChunks] number of chunks: `, chunks.length);
  console.log(`[processCssInChunks] chunks: `, chunks);

  let llmRequests = [];

  for (let i = 0; i < chunks.length; i++) {
    const text = chunks[i];
    // const messages = [{
    // role: 'user',
    // content: 'Respond ONLY with valid CSS contained within triple backticks (e.g: ``` CSS_HERE ```). Update the CSS below to make resulting page simplified for users with visual impairments. Make the page clear and high-contrast. Do NOT change image content - only adjust image size and placement where necessary. Make all text huge and bold. Enlargen clickable items. CSS below: \n\n' + text
    // }];
    // llmRequests.push(window.gptAPI.chat(messages));
    let prompt = 'Respond ONLY with valid CSS contained within triple backticks (e.g: ``` CSS_HERE ```). Update the CSS below to make resulting page simplified for users with visual impairments. Make the page clear and high-contrast. Do NOT change image content - only adjust image size and placement where necessary. Make all text huge and bold. Enlargen clickable items. CSS below: \n\n' + text
    llmRequests.push(getOpenAIChatCompletion(prompt, {
        fallbackFn: async (prompt, meta) => {
          console.warn('Falling back to Ollama for navPrompt. Reason:', meta);
          // Simple fallback: ask Ollama to output ONLY JSON.
          const fallbackMessages = [{
            role: 'user',
            content: prompt
          }];
          const resp = await window.ollamaAPI.chat(fallbackMessages);
          return resp;
        },
        feature: 'css_refactor'
      }));
  }
  const llmResponses = await Promise.allSettled(llmRequests);
  for (let i = 0; i < llmResponses.length; i++)
  {
    let llmResp = llmResponses[i];
    if (llmResp['status'] == 'fulfilled') {
      let llmResponse = llmResp.value;
      console.log(llmResponse);
      console.log('\n');
      console.log(llmResponse.split("```")[1]);
      const escaped = llmResponse.split("```")[1].slice(4)

      console.log(`[processCssInChunks] Result for chunk ${i + 1} of ${chunks.length}:`, llmResponse.split("```")[1]);

      // Append simplified chunk to display and combined text
      combinedSimplifiedCss += (i > 0 ? '\n' : '') + escaped;
    }
    else {
      combinedSimplifiedCss += (i > 0 ? '\n' : '') + chunks[i];
    }
  }

  console.log(`[processTextInChunks] Returning final result:`, combinedSimplifiedCss);
  return combinedSimplifiedCss;
};


export const restyleLayout = async (webview, wcagViolations) => {
  webview.executeJavaScript(`
      Array.from(document.styleSheets)
        .map(sheet => {
        try {
            return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\\n');
        } catch (e) {
            // Skip CORS-protected sheets
            return '';
        }
        })
        .filter(text => text.length)
        .join('\\n')
  `).then(async cssText => {
    console.log('old css:', cssText);
    let newCss = await processCssInChunks(cssText, wcagViolations);
    // const newCss = llmResponse.split("```")[1].slice(4)
    console.log('newCss:', newCss);
    const script = `
      (function() {
        let style = document.getElementById('dynamic-style');
        if (!style) {
        style = document.createElement('style');
        style.id = 'dynamic-style';
        document.head.appendChild(style);
        }
        style.textContent = \`${newCss}\`;
      })();
    `;

    return webview.executeJavaScript(script)
  });
}