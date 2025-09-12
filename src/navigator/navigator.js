import {
    sendMessage
} from './textChatHandler.js';
import {
    initializeMicChat
} from './micChatHandler.js';

export function initializeNavigatorFeatures(webview, chatInput, chatMessages,
    micChatBtn, micBtn, chatContainer, closeChatBtn, chatSendBtn) {
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;

    // Chat send button event
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', () => sendMessage(webview, chatInput, chatMessages));
    }

    // Chat input 'Enter' event
    if (chatInput) {
        chatInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                sendMessage(webview, chatInput, chatMessages);
            }
        });
    }

    // Initialize microphone chat
    initializeMicChat(micChatBtn, isRecording, mediaRecorder, audioChunks, 
      chatInput, webview, chatMessages);

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
}