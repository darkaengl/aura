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

  // MediaRecorder for Speech-to-Text
  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;

  micChatBtn.addEventListener('click', async () => {
    if (isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      micChatBtn.style.backgroundColor = ''; // Reset button color
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
            sendMessage(); // Send the message after speech input
          } catch (error) {
            console.error('Transcription error:', error);
            addMessage('Sorry, transcription failed. Please try again.', 'ai');
          }
        };

        mediaRecorder.start();
        isRecording = true;
        micChatBtn.style.backgroundColor = '#ff0000'; // Change button color to red when recording
        console.log('Recording started.');
      } catch (error) {
        console.error('Error accessing microphone:', error);
        addMessage('Could not access microphone. Please ensure it\'s connected and permissions are granted.', 'ai');
      }
    }
  });

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

  const sendMessage = async () => {
    const message = chatInput.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    chatInput.value = '';

    try {
      // We are reusing the ollamaAPI that was already set up.
      const response = await window.ollamaAPI.chat([{ role: 'user', content: message }]);
      addMessage(response, 'ai');
    } catch (error) {
      console.error('Error communicating with Ollama:', error);
      addMessage('Sorry, I am having trouble connecting to the AI. Please try again later.', 'ai');
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
};