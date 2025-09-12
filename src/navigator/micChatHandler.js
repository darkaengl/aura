import {
    sendMessage
} from './textChatHandler.js';
import {
    writeString,
    floatTo16BitPCM,
    addMessage
} from './chatutils.js';

export function initializeMicChat(micChatBtn, isRecording, mediaRecorder, audioChunks, chatInput, webview, chatMessages) {
    if (micChatBtn) {
        micChatBtn.addEventListener('click', async () => {
            if (isRecording) {
                mediaRecorder.stop();
                isRecording = false;
                micChatBtn.style.backgroundColor = '';
                console.log('Recording stopped.');
            } else {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: true
                    });
                    mediaRecorder = new MediaRecorder(stream, {
                        mimeType: 'audio/webm'
                    });
                    audioChunks = [];

                    mediaRecorder.ondataavailable = (event) => {
                        audioChunks.push(event.data);
                    };

                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, {
                            type: 'audio/webm'
                        });
                        const arrayBuffer = await audioBlob.arrayBuffer();
                        const audioContext = new(window.AudioContext || window.webkitAudioContext)();
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
                            sendMessage(webview, chatInput, chatMessages);
                        } catch (error) {
                            console.error('Transcription error:', error);
                            addMessage(chatMessages, 'Sorry, transcription failed. Please try again.', 'ai');
                        }
                    };

                    mediaRecorder.start();
                    isRecording = true;
                    micChatBtn.style.backgroundColor = '#ff0000';
                    console.log('Recording started.');
                } catch (error) {
                    console.error('Error accessing microphone:', error);
                    addMessage(chatMessages, 'Could not access microphone. Please ensure it\'s connected and permissions are granted.', 'ai');
                }
            }
        });
    }
}