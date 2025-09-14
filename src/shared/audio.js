// shared/audio.js
// Reusable audio/WAV helper utilities consolidated from wake word & continuous voice handlers.

export function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}

export function floatTo16BitPCM(output, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

export function encodeToWav(decodedAudio){
  const numberOfChannels = decodedAudio.numberOfChannels;
  const sampleRate = decodedAudio.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const byteRate = sampleRate * numberOfChannels * bitDepth / 8;
  const blockAlign = numberOfChannels * bitDepth / 8;
  const dataSize = decodedAudio.length * numberOfChannels * bitDepth / 8;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  floatTo16BitPCM(view, 44, decodedAudio.getChannelData(0));
  if (numberOfChannels === 2) floatTo16BitPCM(view, 44, decodedAudio.getChannelData(1));
  return buffer; // Caller wraps in Buffer via preload API
}
