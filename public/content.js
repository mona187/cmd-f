

// Language options with their display names
const LANGUAGES = {
  'en-US': 'English',
  'es-ES': 'Spanish',
  'fr-FR': 'French',
  'de-DE': 'German',
  'zh-CN': 'Chinese',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
  'ru-RU': 'Russian',
  'it-IT': 'Italian',
  'pt-BR': 'Portuguese',
  'hi-IN': 'Hindi',
  'ar-SA': 'Arabic'
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

    /* Language Selectors */
    .language-select {
      width: 100%;
      padding: 8px;
      margin: 4px 0;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 14px;
      background: white;
    }
    .language-arrow {
      text-align: center;
      color: #5f6368;
      margin: 4px 0;
      font-size: 18px;
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
  const select = document.createElement('select');
  select.id = id;
  select.className = 'language-select';
  
  Object.entries(LANGUAGES).forEach(([code, name]) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    if (code === defaultLang) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  return select;
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
  minimizeBtn.textContent = '—'; // Em dash or minus
  minimizeBtn.onclick = (e) => {
    e.stopPropagation();
    toggleMinimize();
  };

  header.appendChild(title);
  header.appendChild(minimizeBtn);

  // Body
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'translator-body';

  // Language selectors
  const sourceSelect = createLanguageSelector('sourceLanguage', 'en-US');
  const arrow = document.createElement('div');
  arrow.className = 'language-arrow';
  arrow.textContent = '↓';
  const targetSelect = createLanguageSelector('targetLanguage', 'es-ES');

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
  bodyDiv.appendChild(sourceSelect);
  bodyDiv.appendChild(arrow);
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
  recognition.lang = sourceLanguage;

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
            source: sourceLanguage.split('-')[0],
            target: targetLanguage.split('-')[0]
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
        speakText(translatedText, targetLanguage);
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