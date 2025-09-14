/**
 * Get a chat completion from OpenAI. Falls back gracefully when:
 *  - No API key is configured
 *  - OpenAI returns a non-2xx response (e.g. 401)
 * Optionally, you can plug in an Ollama fallback by passing a fallback function.
 */
export async function getOpenAIChatCompletion(prompt, { fallbackFn, feature } = {}) {
  let chatGptApiKey = '';
  let model = 'gpt-3.5-turbo';
  try {
    if (feature && window.secretsAPI.getLLMKey) {
      chatGptApiKey = window.secretsAPI.getLLMKey(feature) || '';
      const cfg = window.secretsAPI.getLLMConfig && window.secretsAPI.getLLMConfig(feature);
      if (cfg && cfg.model) model = cfg.model;
    }
  } catch (_) {}
  if (!chatGptApiKey) {
    chatGptApiKey = await window.secretsAPI.getChatGptApiKey();
  }

  if (!chatGptApiKey) {
    console.warn('[OpenAI] No API key configured. Skipping OpenAI call.');
    if (fallbackFn) return await fallbackFn(prompt, { reason: 'missing_api_key' });
    return '[OpenAI disabled: missing API key]';
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chatGptApiKey}`
      },
      body: JSON.stringify({
  model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[OpenAI] Non-OK response:', response.status, errText);
      if (fallbackFn) return await fallbackFn(prompt, { reason: 'http_' + response.status, details: errText });
      return `[OpenAI error ${response.status}]`;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('Error getting OpenAI chat completion:', error);
    if (fallbackFn) return await fallbackFn(prompt, { reason: 'exception', details: error.message });
    return '[OpenAI exception: ' + error.message + ']';
  }
}
