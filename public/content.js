const API_KEY = 'AIzaSyBrVI_TAivVHZfvYfxZ5G1TGryrYVbvOGo'; // <--- Replace with your valid Cloud Translation API key

// Language options with their display names and full language codes
const LANGUAGES = {
  'zh': { name: 'Chinese (Simplified)', code: 'zh-CN' },
  'es': { name: 'Spanish', code: 'es-ES' },
  'en': { name: 'English', code: 'en-US' },
  'hi': { name: 'Hindi', code: 'hi-IN' },
  'ar': { name: 'Arabic', code: 'ar-SA' },
  'bn': { name: 'Bengali', code: 'bn-IN' },
  'pt': { name: 'Portuguese', code: 'pt-BR' },
  'ru': { name: 'Russian', code: 'ru-RU' },
  'ja': { name: 'Japanese', code: 'ja-JP' },
  'fa': { name: 'Persian', code: 'fa-IR' },
  'de': { name: 'German', code: 'de-DE' },
  'ko': { name: 'Korean', code: 'ko-KR' },
  'fr': { name: 'French', code: 'fr-FR' },
  'tr': { name: 'Turkish', code: 'tr-TR' },
  'vi': { name: 'Vietnamese', code: 'vi-VN' },
  'it': { name: 'Italian', code: 'it-IT' },
  'th': { name: 'Thai', code: 'th-TH' },
  'nl': { name: 'Dutch', code: 'nl-NL' },
  'pl': { name: 'Polish', code: 'pl-PL' },
  'uk': { name: 'Ukrainian', code: 'uk-UA' }
};

// Simple log helper
function log(message, error = false) {
  const prefix = '[Meet Translator]';
  if (error) {
    console.error(prefix, message);
  } else {
    console.log(prefix, message);
  }
}

// =======================
//  Inject UI
// =======================

// Create and inject CSS styles
function injectStyles() {
  const existingStyles = document.getElementById('meet-translator-styles');
  if (existingStyles) existingStyles.remove();

  const style = document.createElement('style');
  style.id = 'meet-translator-styles';
  style.textContent = `
    /* Container */
    #meet-translator-container {
      position: fixed;
      right: 20px;
      top: 20px;
      z-index: 9999999;
      background: #fff;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: 'Google Sans', Arial, sans-serif;
      width: 300px;
      transition: all 0.3s ease;
    }

    /* Language Selector Container */
    .language-selector-container {
      position: relative;
      margin: 4px 0;
    }

    .language-search {
      width: 100%;
      padding: 8px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 14px;
      margin-bottom: 4px;
      box-sizing: border-box;
    }

    .language-search:focus {
      outline: none;
      border-color: #1a73e8;
      box-shadow: 0 0 0 2px rgba(26,115,232,0.2);
    }

    .language-select {
      width: 100%;
      padding: 8px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 14px;
      background: white;
      max-height: 200px;
      overflow-y: auto;
      box-sizing: border-box;
      z-index: 10000000;
    }

    .language-select option {
      padding: 8px;
      font-size: 14px;
      cursor: pointer;
    }

    .language-select option:checked {
      background: #e8f0fe;
      color: #1a73e8;
    }

    .language-select option:hover {
      background: #f8f9fa;
    }

    .language-group-title {
      font-size: 12px;
      color: #5f6368;
      padding: 4px 8px;
      background: #f8f9fa;
      border-radius: 4px;
      margin-bottom: 4px;
      font-weight: 500;
    }

    /* Minimizing Behavior */
    #meet-translator-container.minimized {
      width: 60px;
      height: 60px;
      overflow: hidden;
      border-radius: 30px;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #meet-translator-container.minimized #meet-translator-header,
    #meet-translator-container.minimized .translator-body {
      display: none;
    }

    /* Header */
    #meet-translator-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    #meet-translator-title {
      font-size: 16px;
      font-weight: 500;
      color: #1a73e8;
    }
    #minimize-button {
      background: none;
      border: none;
      cursor: pointer;
      color: #5f6368;
      padding: 4px;
      border-radius: 4px;
      font-size: 16px;
    }
    #minimize-button:hover {
      background: #f1f3f4;
    }

    /* Button */
    #startTranslation {
      width: 100%;
      background: #1a73e8;
      color: white;
      border: none;
      padding: 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      margin: 10px 0;
      transition: background 0.3s ease;
    }
    #startTranslation:hover {
      background: #1557b0;
    }
    #startTranslation.active {
      background: #ea4335;
    }

    /* Status Label */
    #translationStatus {
      font-size: 12px;
      color: #5f6368;
      margin: 8px 0;
      min-height: 14px;
    }
    .error-message {
      color: #ea4335;
    }

    /* Transcription & Translation */
    .translation-box {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 4px;
      margin: 5px 0;
      font-size: 14px;
      max-height: 100px;
      overflow-y: auto;
      word-wrap: break-word;
    }
    #transcription {
      color: #5f6368;
      font-style: italic;
    }
    #translation {
      color: #1a73e8;
      font-weight: 500;
    }

    /* Make a sub-container for the main body (excluding header) */
    .translator-body {
      display: flex;
      flex-direction: column;
    }
  `;
  document.head.appendChild(style);
  log('Styles injected.');
}

function createLanguageSelector(id, defaultLang) {
  const container = document.createElement('div');
  container.className = 'language-selector-container';

  // Create search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'language-search';
  searchInput.placeholder = 'Search languages...';
  container.appendChild(searchInput);

  // Create select element
  const select = document.createElement('select');
  select.id = id;
  select.className = 'language-select';
  select.size = 5; // Show 5 options at once

  // Group languages by region
  const languageGroups = {
    'East Asian': ['zh', 'ja', 'ko'],
    'South Asian': ['hi', 'bn'],
    'Middle Eastern': ['ar', 'fa'],
    'European': ['en', 'es', 'fr', 'de', 'it', 'nl', 'pl', 'uk', 'ru'],
    'Other': ['pt', 'tr', 'vi', 'th']
  };

  // Create options grouped by region
  Object.entries(languageGroups).forEach(([group, codes]) => {
    const groupTitle = document.createElement('option');
    groupTitle.disabled = true;
    groupTitle.className = 'language-group-title';
    groupTitle.textContent = group;
    select.appendChild(groupTitle);

    codes.forEach(code => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = LANGUAGES[code].name;
      if (code === defaultLang) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  });

  // Add search functionality
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    Array.from(select.options).forEach(option => {
      if (option.disabled) return; // Skip group titles
      const text = option.textContent.toLowerCase();
      option.style.display = text.includes(searchTerm) ? '' : 'none';
    });
  });

  container.appendChild(select);
  return container;
}

function createTranslatorUI() {
  const container = document.createElement('div');
  container.id = 'meet-translator-container';
  
  // Header
  const header = document.createElement('div');
  header.id = 'meet-translator-header';

  const title = document.createElement('div');
  title.id = 'meet-translator-title';
  title.textContent = 'Meet Translator';
  
  const minimizeBtn = document.createElement('button');
  minimizeBtn.id = 'minimize-button';
  minimizeBtn.textContent = '—';
  minimizeBtn.onclick = (e) => {
    e.stopPropagation();
    toggleMinimize();
  };

  header.appendChild(title);
  header.appendChild(minimizeBtn);

  // Body
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'translator-body';

  // Language selectors with labels
  const sourceLabel = document.createElement('div');
  sourceLabel.textContent = 'From:';
  sourceLabel.style.fontSize = '12px';
  sourceLabel.style.color = '#5f6368';
  sourceLabel.style.marginBottom = '4px';

  const targetLabel = document.createElement('div');
  targetLabel.textContent = 'To:';
  targetLabel.style.fontSize = '12px';
  targetLabel.style.color = '#5f6368';
  targetLabel.style.marginBottom = '4px';

  const sourceSelect = createLanguageSelector('sourceLanguage', 'en');
  const arrow = document.createElement('div');
  arrow.className = 'language-arrow';
  arrow.textContent = '↓';
  const targetSelect = createLanguageSelector('targetLanguage', 'es');

  // Start/Stop button
  const startButton = document.createElement('button');
  startButton.id = 'startTranslation';
  startButton.textContent = 'Start Translation';

  // Status
  const status = document.createElement('div');
  status.id = 'translationStatus';
  
  // Transcription & translation boxes
  const transcriptionDiv = document.createElement('div');
  transcriptionDiv.id = 'transcription';
  transcriptionDiv.className = 'translation-box';
  const translationDiv = document.createElement('div');
  translationDiv.id = 'translation';
  translationDiv.className = 'translation-box';

  // Assemble Body
  bodyDiv.appendChild(sourceLabel);
  bodyDiv.appendChild(sourceSelect);
  bodyDiv.appendChild(arrow);
  bodyDiv.appendChild(targetLabel);
  bodyDiv.appendChild(targetSelect);
  bodyDiv.appendChild(startButton);
  bodyDiv.appendChild(status);
  bodyDiv.appendChild(transcriptionDiv);
  bodyDiv.appendChild(translationDiv);

  // Put header + body into container
  container.appendChild(header);
  container.appendChild(bodyDiv);

  // When minimized, clicking anywhere on container re-expands it
  container.addEventListener('click', () => {
    if (container.classList.contains('minimized')) {
      container.classList.remove('minimized');
    }
  });

  return container;
}

function toggleMinimize() {
  const container = document.getElementById('meet-translator-container');
  container.classList.toggle('minimized');
}

// =======================
// Text-to-Speech (TTS)
// =======================

function speakText(text, langCode) {
  if (!('speechSynthesis' in window)) {
    log('Speech synthesis not supported in this browser.', true);
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  // Use full code if possible (e.g. "en-US"), though some voices might not be available.
  utterance.lang = langCode;
  // **Slower speaking rate** (1.0 is default speed, <1 is slower)
  utterance.rate = 0.8; // Adjust to 0.7 or 0.5 if you want it slower
  window.speechSynthesis.speak(utterance);
}

// =======================
// Speech Recognition Flow
// =======================

let recognition = null;
let isTranslating = false;

function checkSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    log('Speech recognition not supported in this browser.', true);
    return false;
  }
  return true;
}

async function toggleTranslation() {
  const button = document.getElementById('startTranslation');
  const status = document.getElementById('translationStatus');

  if (!isTranslating) {
    // Start
    if (!checkSpeechRecognition()) {
      status.textContent = 'Speech recognition not supported in this browser (use Chrome).';
      status.className = 'error-message';
      return;
    }
    try {
      // Attempt mic access
      await navigator.mediaDevices.getUserMedia({ audio: true });
      button.textContent = 'Stop Translation';
      button.classList.add('active');
      status.textContent = 'Translation active...';
      status.className = '';
      startTranslationService();
      isTranslating = true;
      log('Translation started.');
    } catch (err) {
      log('Microphone access denied:', err);
      status.textContent = 'Please allow microphone access to use translation.';
      status.className = 'error-message';
    }
  } else {
    // Stop
    button.textContent = 'Start Translation';
    button.classList.remove('active');
    status.textContent = '';
    status.className = '';
    stopTranslationService();
    isTranslating = false;
    log('Translation stopped.');
  }
}

function startTranslationService() {
  const sourceLanguage = document.getElementById('sourceLanguage').value;
  const targetLanguage = document.getElementById('targetLanguage').value;
  const transcriptionDiv = document.getElementById('transcription');
  const translationDiv = document.getElementById('translation');
  const status = document.getElementById('translationStatus');

  // Clear old text
  transcriptionDiv.textContent = '';
  translationDiv.textContent = '';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = LANGUAGES[sourceLanguage].code;

  recognition.onstart = () => {
    log('Speech recognition started.');
    status.textContent = 'Listening...';
    status.className = '';
  };

  recognition.onresult = async (event) => {
    // Combine all segments
    const transcript = Array.from(event.results)
      .map(r => r[0].transcript)
      .join('');
    
    log('Transcription:', transcript);
    transcriptionDiv.textContent = transcript;

    // Only translate final chunk
    const isFinal = event.results[event.results.length - 1].isFinal;
    if (!isFinal) return;

    try {
      // Call the Cloud Translation API
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: transcript,
            source: sourceLanguage,
            target: targetLanguage
          })
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Translation API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      if (data?.data?.translations?.[0]) {
        const translatedText = data.data.translations[0].translatedText;
        log('Translation:', translatedText);
        translationDiv.textContent = translatedText;

        // Speak the translated text out loud (slower)
        speakText(translatedText, LANGUAGES[targetLanguage].code);
      }
    } catch (error) {
      log('Translation error:', error);
      status.textContent = `Translation error: ${error.message}`;
      status.className = 'error-message';
    }
  };

  recognition.onerror = (event) => {
    log('Speech recognition error:', event.error);
    status.textContent = `Speech recognition error: ${event.error}`;
    status.className = 'error-message';
    stopTranslationService();
  };

  recognition.onend = () => {
    log('Speech recognition ended.');
    if (isTranslating) {
      // Attempt to restart if user didn't manually stop
      try {
        log('Restarting speech recognition...');
        recognition.start();
      } catch (err) {
        log('Error restarting recognition:', err);
        stopTranslationService();
      }
    }
  };

  try {
    recognition.start();
  } catch (err) {
    log('Error starting recognition:', err);
    status.textContent = 'Cannot start speech recognition.';
    status.className = 'error-message';
  }
}

function stopTranslationService() {
  if (recognition) {
    try {
      recognition.stop();
    } catch (err) {
      log('Error stopping recognition:', err);
    }
    recognition = null;
  }
  const button = document.getElementById('startTranslation');
  const status = document.getElementById('translationStatus');
  if (button) {
    button.textContent = 'Start Translation';
    button.classList.remove('active');
  }
  if (status) {
    status.textContent = '';
    status.className = '';
  }
  isTranslating = false;
  log('Translation service stopped.');
}

// =======================
//  Initialize
// =======================
function initializeExtension() {
  log('Initializing Meet Translator extension.');

  // Remove any existing container
  const existing = document.getElementById('meet-translator-container');
  if (existing) existing.remove();

  injectStyles();

  // Build the UI
  const container = createTranslatorUI();
  document.body.appendChild(container);

  // Hook the start/stop button
  const startButton = document.getElementById('startTranslation');
  startButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent container from toggling minimize
    toggleTranslation();
  });

  // Pre-check microphone
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => {
      log('Mic permission granted.');
    })
    .catch(err => {
      log('Mic permission denied or error:', err);
      const st = document.getElementById('translationStatus');
      if (st) {
        st.textContent = 'Please allow microphone access to use translation.';
        st.className = 'error-message';
      }
    });

  log('Extension UI injected, ready to use.');
}

// Start once page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
}