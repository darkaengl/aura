import { initializeWakeWord } from '../navigator/hey-aura.js';
import { initializeNavigatorFeatures } from '../navigator/navigator.js';
import { initializeContinuousVoice } from '../navigator/continuousVoiceHandler.js';

console.log('homepage.js loaded');

document.addEventListener('DOMContentLoaded', () => {
  console.log('homepage.js DOMContentLoaded fired');
  const wakeWordToggle = document.getElementById('wake-word-toggle');
  const searchInput = document.getElementById('search-input');

  // Chat interface elements
  const chatContainer = document.getElementById('chat-container');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const micChatBtn = document.getElementById('mic-chat-btn');

  // Helper to append messages
  const addMessage = (text, sender) => {
    if (!chatMessages) return;
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `${sender}-message`);
    messageElement.innerText = text;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  if (wakeWordToggle && searchInput && chatContainer) { // Check for chatContainer as well
    console.log('All necessary elements found');

    // Initialize voice and text navigator features
    // Pass null for webview as homepage.html doesn't have one, navigation will be handled by IPC
    initializeNavigatorFeatures(null, chatInput, chatMessages, micChatBtn, null, // micBtn is not used in homepage.html
        chatContainer, closeChatBtn, chatSendBtn);

    // Set up continuous voice handler
    const continuous = initializeContinuousVoice({
        chatInput,
        chatMessages,
        chatContainer,
        micChatBtn,
        wakeWordToggle,
        webview: null, // No webview on homepage.html
        addMessage
    });

    const onWakeWord = () => {
      console.log('Wake word detected on homepage!');
      chatContainer.classList.remove('hidden'); // Open chat window
      addMessage('🎙️ Wake word detected. How can I help?', 'ai'); // Show instructions
      continuous.startContinuousMode(); // Start continuous mode
    };

    initializeWakeWord(wakeWordToggle, onWakeWord, addMessage); // Pass addMessage for wake word module
  } else {
    console.log('One or more necessary elements not found');
  }
});