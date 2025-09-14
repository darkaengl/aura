// continuousVoiceHandler.js
// Handles continuous voice command mode with silence detection and auto-restart.
// Extracted & modularized from original project aura's inline renderer implementation.

import { addMessage as utilAddMessage } from './chatutils.js';
import { encodeToWav } from '../shared/audio.js';
import { STOP_PHRASES, RECORDING_LIMITS } from '../config/constants.js';
import { logger } from '../shared/logger.js';
import { sendMessage } from './textChatHandler.js';
import { performAcknowledgment, isAgreementPhrase } from './acknowledgmentHandler.js';
import { isFormSessionActive, handleFormInput } from './formFillingHandler.js';

// Stop command phrases now imported from constants

function isStopCommand(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return STOP_PHRASES.some(p => lower.includes(p));
}

export function initializeContinuousVoice({
  chatInput,
  chatMessages,
  chatContainer,
  micChatBtn,
  wakeWordToggle,
  webview,
  addMessage
}) {
  // Fallback addMessage if none supplied
  const pushMessage = addMessage || ((txt, sender) => utilAddMessage(chatMessages, txt, sender));

  // State
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;
  let autoStopTimeout = null;
  let maxRecordingTimeout = null;
  let continuousRestartTimeout = null;
  let isContinuousMode = false;

  // Config
  const silenceThreshold = RECORDING_LIMITS.SILENCE_DB_THRESHOLD; // dB approximate threshold
  const silenceDuration = RECORDING_LIMITS.SILENCE_DURATION_MS; // ms
  const maxRecordingDuration = RECORDING_LIMITS.MAX_RECORDING_MS; // ms

  function clearTimers() {
    if (autoStopTimeout) { clearTimeout(autoStopTimeout); autoStopTimeout = null; }
    if (maxRecordingTimeout) { clearTimeout(maxRecordingTimeout); maxRecordingTimeout = null; }
    if (continuousRestartTimeout) { clearTimeout(continuousRestartTimeout); continuousRestartTimeout = null; }
  }

  function applyContinuousVisualState(active) {
    if (!wakeWordToggle) return;
    if (active) {
      wakeWordToggle.title = 'Continuous mode ACTIVE - Say "stop listening" to end';
      wakeWordToggle.style.animation = 'pulse 1.5s infinite';
    } else {
      wakeWordToggle.style.animation = '';
      wakeWordToggle.title = 'Wake word detection ON - Say "browser" to start';
    }
  }

  async function startAutoRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunks = [];
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      const micSource = audioContext.createMediaStreamSource(stream);
      micSource.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function checkAudioLevel() {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0; for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        const decibels = average > 0 ? 20 * Math.log10(average / 255) : -Infinity;
        if (decibels > silenceThreshold) {
          if (autoStopTimeout) { clearTimeout(autoStopTimeout); autoStopTimeout = null; }
        } else if (!autoStopTimeout && isRecording) {
          autoStopTimeout = setTimeout(() => { stopAutoRecording(); }, silenceDuration);
        }
        if (isRecording) requestAnimationFrame(checkAudioLevel);
      }

      mediaRecorder.ondataavailable = (e) => { audioChunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        audioContext.close();
        stream.getTracks().forEach(t => t.stop());
        clearTimeout(autoStopTimeout); autoStopTimeout = null;
        clearTimeout(maxRecordingTimeout); maxRecordingTimeout = null;
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  const arrayBuffer = await audioBlob.arrayBuffer();
  const processingCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decoded = await processingCtx.decodeAudioData(arrayBuffer);
  const sampleRate = decoded.sampleRate;
  const wavBuffer = encodeToWav(decoded);
  const wavAudioBuffer = window.nodeBufferFrom(wavBuffer);

        micChatBtn && (micChatBtn.style.backgroundColor = '#ffaa00');
        pushMessage('🔄 Processing your command...', 'ai');
        try {
          const transcription = await window.speechAPI.transcribeAudio(wavAudioBuffer, sampleRate);
          if (transcription && transcription.trim()) {
            if (isStopCommand(transcription)) {
              pushMessage('🛑 Understood. Ending continuous mode. Say "browser" to start again.', 'ai');
              stopContinuousMode();
              processingCtx.close();
              return;
            }
            // If a guided form session is active, treat this as the answer first
            if (isFormSessionActive()) {
              pushMessage('📝 (Form) ' + transcription, 'user');
              await handleFormInput(transcription);
              if (isContinuousMode) {
                pushMessage('🎙️ Ready for next field/command...', 'ai');
                continuousRestartTimeout = setTimeout(() => startAutoRecording(), 2200);
              }
              processingCtx.close();
              return;
            }

            // Intercept agreement phrases before routing to LLM
            if (isAgreementPhrase(transcription)) {
              pushMessage('🔎 Detecting agreement checkboxes...', 'ai');
              try {
                const ackResult = await performAcknowledgment(webview);
                if (ackResult.success && ackResult.acknowledged.length > 0) {
                  pushMessage(`✅ Acknowledged: ${ackResult.acknowledged.map(a => a.label).join(', ')}`, 'ai');
                  pushMessage('👍 Agreement complete. Proceed with the next step.', 'ai');
                } else if (ackResult.success) {
                  pushMessage('❌ No agreement checkboxes found to acknowledge.', 'ai');
                } else {
                  pushMessage(`❌ Agreement error: ${ackResult.error}`, 'ai');
                }
              } catch (ackErr) {
                pushMessage(`❌ Agreement handling failed: ${ackErr.message}`, 'ai');
              }
              if (isContinuousMode) {
                pushMessage('🎙️ Ready for next command...', 'ai');
                continuousRestartTimeout = setTimeout(() => startAutoRecording(), 2500);
              }
              processingCtx.close();
              return; // Do not forward agreement phrase to LLM
            }
            chatInput.value = transcription;
            pushMessage(`📝 I heard: "${transcription}"`, 'ai');
            await sendMessage(webview, chatInput, chatMessages);
            if (isContinuousMode) {
              pushMessage('🎙️ Ready for next command...', 'ai');
              continuousRestartTimeout = setTimeout(() => startAutoRecording(), 3000);
            }
          } else if (isContinuousMode) {
            pushMessage('🤔 I didn\'t catch that. Ready for next command...', 'ai');
            continuousRestartTimeout = setTimeout(() => startAutoRecording(), 2000);
          } else {
            pushMessage('🤔 Sorry, I didn\'t catch that. Please try again or click the microphone button.', 'ai');
          }
        } catch (err) {
          logger.error('Transcription failed:', err);
          pushMessage('❌ Sorry, transcription failed. Please try again.', 'ai');
          if (isContinuousMode) {
            continuousRestartTimeout = setTimeout(() => startAutoRecording(), 3000);
          }
        } finally {
          if (!isContinuousMode && micChatBtn) micChatBtn.style.backgroundColor = '';
        }
        processingCtx.close();
      };

      mediaRecorder.start();
      isRecording = true;
      if (micChatBtn) micChatBtn.style.backgroundColor = isContinuousMode ? '#ff6600' : '#ff0000';
      maxRecordingTimeout = setTimeout(() => {
        stopAutoRecording();
        pushMessage(isContinuousMode ? '⏱️ Maximum recording time reached. Ready for next command...' : '⏱️ Maximum recording time reached. Processing your command...', 'ai');
      }, maxRecordingDuration);
      checkAudioLevel();
    } catch (error) {
      logger.error('Could not start recording:', error);
      pushMessage('Could not start recording. Please ensure microphone permissions are granted.', 'ai');
    }
  }

  function stopAutoRecording() {
    if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      isRecording = false;
    }
    clearTimers();
  }

  function startContinuousMode() {
    if (isContinuousMode) return;
    isContinuousMode = true;
    if (chatContainer) chatContainer.classList.remove('hidden');
    if (chatInput) chatInput.focus();
    pushMessage('🎙️ Continuous mode activated! Listening for commands...', 'ai');
    pushMessage('💡 Say "stop listening" or "stop executing commands" when done.', 'ai');
    applyContinuousVisualState(true);
    if (!isRecording) startAutoRecording();
  }

  function stopContinuousMode() {
    if (!isContinuousMode) return;
    isContinuousMode = false;
    stopAutoRecording();
    applyContinuousVisualState(false);
    if (micChatBtn) micChatBtn.style.backgroundColor = '';
  }

  function getStatus() {
    return { isContinuousMode, isRecording };
  }

  return {
    startContinuousMode,
    stopContinuousMode,
    getStatus
  };
}
