import { initializeWakeWord } from '../navigator/hey-aura.js';

console.log('homepage.js loaded'); // Add this

window.onload = () => {
  console.log('homepage.js window.onload fired'); // Add this
  const wakeWordToggle = document.getElementById('wake-word-toggle');
  const searchInput = document.getElementById('search-input');

  if (wakeWordToggle && searchInput) {
    console.log('Wake word toggle and search input found'); // Add this
    const onWakeWord = () => {
      console.log('Wake word detected on homepage!');
      searchInput.focus();
    };

    initializeWakeWord(wakeWordToggle, onWakeWord, null);
  } else {
    console.log('Wake word toggle or search input not found'); // Add this
  }
};