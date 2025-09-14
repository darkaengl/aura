// hey-aura.js
// Wake word detection utilities (renderer-side only)
// NOTE: speechAPI & nodeBufferFrom are already exposed via preload (shared/preload.js)
// This module intentionally contains ONLY renderer-safe code (no 'require').

import { WAKE_WORD } from '../config/constants.js';
import { encodeToWav } from '../shared/audio.js';
import { logger } from '../shared/logger.js';

let isWakeWordActive = true; // exported getter available via function
let wakeWordMediaRecorder = null;
let wakeWordStream = null;

// (Future extension placeholders kept for possible continuous mode integration)
let isContinuousMode = false; // not yet used – reserved

// (Audio helpers centralized in shared/audio.js)

// Placeholder for future continuous / stop command logic
function isStopCommand(_) { return false; }

export async function startWakeWordDetection(handleWakeWordDetection, updateWakeWordToggle) {
  try {
  logger.debug('Starting wake word detection...');
    wakeWordStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true
      }
    });
    wakeWordMediaRecorder = new MediaRecorder(wakeWordStream, { mimeType: 'audio/webm' });
    wakeWordMediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && isWakeWordActive) {
        const audioBlob = new Blob([event.data], { type: 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);
          const sampleRate = decodedAudio.sampleRate;
          const wavBuffer = encodeToWav(decodedAudio);
          const wavAudioBuffer = window.nodeBufferFrom(wavBuffer);
          const transcription = await window.speechAPI.transcribeAudio(wavAudioBuffer, sampleRate);
          const timestamp = new Date().toLocaleTimeString();
          if (transcription && transcription.trim()) {
            logger.debug(`🎧 [${timestamp}] Wake word monitoring - Detected speech: ${transcription}`);
            if (transcription.toLowerCase().includes(WAKE_WORD)) {
              logger.info(`Wake word detected: ${transcription}`);
              if (typeof handleWakeWordDetection === 'function') handleWakeWordDetection();
            } else {
              logger.debug(`Speech but not wake word: ${transcription}`);
            }
          } else {
            logger.debug(`🎧 [${timestamp}] Wake word monitoring - Detected speech: [No speech detected]`);
          }
        } catch (error) {
          // Ignore errors
          // Optional debug (commented to avoid noise):
          // console.debug('Wake word transcription error:', error.message);
        }
      }
    };
    wakeWordMediaRecorder.start(2000); // 2 second chunks
    isWakeWordActive = true;
    if (typeof updateWakeWordToggle === 'function') updateWakeWordToggle(true);
  logger.info('Wake word detection started successfully');
  } catch (error) {
    isWakeWordActive = false;
  logger.error('Failed to start wake word detection:', error);
    if (typeof updateWakeWordToggle === 'function') updateWakeWordToggle(false);
  }
}

export async function stopWakeWordDetection(updateWakeWordToggle) {
  try {
    if (wakeWordMediaRecorder && wakeWordMediaRecorder.state !== 'inactive') {
      wakeWordMediaRecorder.stop();
    }
    if (wakeWordStream) {
      wakeWordStream.getTracks().forEach(track => track.stop());
      wakeWordStream = null;
    }
    wakeWordMediaRecorder = null;
    isWakeWordActive = false;
    if (typeof updateWakeWordToggle === 'function') updateWakeWordToggle(false);
  } catch (error) {}
}

export function updateWakeWordToggle(active) {
  isWakeWordActive = active;
  // Apply visual state directly so other callers don't need wrapper
  const btn = document.getElementById('wake-word-toggle');
  if (btn) {
    if (active) {
      btn.classList.remove('wake-word-inactive');
      btn.classList.add('wake-word-active');
      btn.title = 'Wake word detection ON - Say "browser" to start';
    } else {
      btn.classList.remove('wake-word-active');
      btn.classList.add('wake-word-inactive');
      btn.title = 'Wake word detection OFF - Click to enable "browser"';
    }
  }
}

export function getWakeWordStatus() {
  return { active: isWakeWordActive, continuous: isContinuousMode };
}

// High-level initializer for convenience in renderer
export function initializeWakeWord(wakeWordToggleEl, onActivated, addMessageFn) {
  if (!wakeWordToggleEl) return;

  const applyVisual = (active) => {
    if (!wakeWordToggleEl) return;
    if (active) {
      wakeWordToggleEl.classList.remove('wake-word-inactive');
      wakeWordToggleEl.classList.add('wake-word-active');
      wakeWordToggleEl.title = 'Wake word detection ON - Say "browser" to start';
    } else {
      wakeWordToggleEl.classList.remove('wake-word-active');
      wakeWordToggleEl.classList.add('wake-word-inactive');
      wakeWordToggleEl.title = 'Wake word detection OFF - Click to enable "browser"';
    }
  };

  // Wrapper so we keep module state + visual sync
  const updateToggle = (active) => {
    updateWakeWordToggle(active);
    applyVisual(active);
  };

  const handleWakeWordDetection = () => {
    if (typeof onActivated === 'function') onActivated();
    if (typeof addMessageFn === 'function') {
      addMessageFn('🎙️ Wake word detected. How can I help?', 'ai');
    }
  };

  wakeWordToggleEl.addEventListener('click', async () => {
    if (isWakeWordActive) {
      await stopWakeWordDetection(updateToggle);
    } else {
      await startWakeWordDetection(handleWakeWordDetection, updateToggle);
    }
  });

  // Auto-start detection on load
  startWakeWordDetection(handleWakeWordDetection, updateToggle);
}

// Future: add continuous mode / auto recording utilities here to keep renderer clean
