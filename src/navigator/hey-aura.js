// hey-aura.js
// Wake word detection utilities (renderer-side only)
// NOTE: speechAPI & nodeBufferFrom are already exposed via preload (shared/preload.js)
// This module intentionally contains ONLY renderer-safe code (no 'require').

import { WAKE_WORD } from '../config/constants.js';
import { encodeToWav } from '../shared/audio.js';
import { logger } from '../shared/logger.js';

let isWakeWordActive = true; // exported getter available via function
let wakeWordStream = null;
let audioContext = null;
let workletNode = null;
let audioBuffer = [];
let actualSampleRate = 16000; // Initialize with default, will be updated

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
        sampleRate: actualSampleRate, // Request actual sample rate
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
    const audioTracks = wakeWordStream.getAudioTracks();
    if (audioTracks.length > 0) {
      const track = audioTracks[0];
      const settings = track.getSettings();
      actualSampleRate = settings.sampleRate; // Update actual sample rate
      logger.info('Audio track settings:', settings);
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    await audioContext.resume();

    try {
      // Try path relative to the root in a bundled environment
      await audioContext.audioWorklet.addModule('src/shared/wake-word-processor.js');
    } catch (e) {
      logger.error('Failed to load audio worklet module, trying alternative path.', e);
      try {
        // Try path relative to the script file
        await audioContext.audioWorklet.addModule('../shared/wake-word-processor.js');
      } catch (e2) {
        logger.error('Failed to load audio worklet module with alternative path.', e2);
        throw e2; // re-throw to be caught by outer catch
      }
    }
    
    workletNode = new AudioWorkletNode(audioContext, 'wake-word-processor');
    const source = audioContext.createMediaStreamSource(wakeWordStream);
    source.connect(workletNode);
    workletNode.connect(audioContext.destination);

    workletNode.port.onmessage = (event) => {
      if (isWakeWordActive) {
        const pcmData = event.data;
        audioBuffer.push(pcmData);

        // The worklet gives us chunks of 128 samples.
        // Let's collect about 2 seconds of audio.
        const bufferSize = 128;
        if ((audioBuffer.length * bufferSize) / actualSampleRate > 2) {
          const fullBuffer = audioBuffer.reduce((acc, val) => {
            const tmp = new Float32Array(acc.length + val.length);
            tmp.set(acc, 0);
            tmp.set(val, acc.length);
            return tmp;
          }, new Float32Array(0));

          audioBuffer = []; // Clear the buffer

          // Now process this fullBuffer
          (async () => {
            try {
              // We have the raw data, so we need to create a "decodedAudio" object
              // that encodeToWav can use.
              const decodedAudio = {
                numberOfChannels: 1,
                sampleRate: actualSampleRate,
                length: fullBuffer.length,
                getChannelData: () => fullBuffer
              };

              const sum = fullBuffer.reduce((a, b) => a + Math.abs(b), 0);
              const avg = sum / fullBuffer.length;
              logger.info(`Average audio level: ${avg}`);

              const wavBuffer = encodeToWav(decodedAudio);
              const wavAudioBuffer = window.nodeBufferFrom(wavBuffer);
              logger.info('Sending audio for transcription...');
              const transcription = await window.speechAPI.transcribeAudio(wavAudioBuffer, actualSampleRate);
              logger.info('Received transcription:', transcription);
              const timestamp = new Date().toLocaleTimeString();
              if (transcription && transcription.trim()) {
                logger.info(`🎧 [${timestamp}] Wake word monitoring - Detected speech: ${transcription}`);
                if (transcription.toLowerCase().includes(WAKE_WORD)) {
                  logger.info(`Wake word detected: ${transcription}`);
                  if (typeof handleWakeWordDetection === 'function') handleWakeWordDetection();
                } else {
                  logger.info(`Speech but not wake word: ${transcription}`);
                }
              } else {
                logger.info(`🎧 [${timestamp}] Wake word monitoring - Detected speech: [No speech detected]`);
              }
            } catch (error) {
              logger.error('Wake word transcription error:', error);
            }
          })();
        }
      }
    };

    isWakeWordActive = true;
    if (typeof updateWakeWordToggle === 'function') updateWakeWordToggle(true);
    logger.info('Wake word detection started successfully');
  } catch (error) {
    isWakeWordActive = false;
    logger.error('Failed to start wake word detection:', error);
    if (typeof updateWakeWordToggle === 'function') updateWakeWordToggle(false);
    alert('Could not start wake word detection. Please ensure you have a microphone connected and have granted microphone permission to the app.');
  }
}

export async function stopWakeWordDetection(updateWakeWordToggle) {
  try {
    if (workletNode) {
      workletNode.port.onmessage = null;
      workletNode.disconnect();
      workletNode = null;
    }
    if (audioContext) {
      await audioContext.close();
      audioContext = null;
    }
    if (wakeWordStream) {
      wakeWordStream.getTracks().forEach(track => track.stop());
      wakeWordStream = null;
    }
    isWakeWordActive = false;
    if (typeof updateWakeWordToggle === 'function') updateWakeWordToggle(false);
  } catch (error) {
    logger.error('Error stopping wake word detection:', error);
  }
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
