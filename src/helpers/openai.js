export async function getOpenAIChatCompletion(prompt) {
  try {
    const chatGptApiKey = await window.secretsAPI.getChatGptApiKey();
    const chatGptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${chatGptApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });
    const chatGptData = await chatGptResponse.json();
    return chatGptData.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('Error getting OpenAI chat completion:', error);
    throw error;
  }
}
