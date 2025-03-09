class TranslationService {
  constructor() {
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.translationApiUrl = process.env.REACT_APP_TRANSLATION_API_URL;
    this.speechToTextApiUrl = process.env.REACT_APP_SPEECH_TO_TEXT_API_URL;
    this.translationApiKey = process.env.REACT_APP_TRANSLATION_API_KEY;
    this.speechToTextApiKey = process.env.REACT_APP_SPEECH_TO_TEXT_API_KEY;
    this.initializeSpeechRecognition();
  }

  initializeSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
    } else {
      throw new Error('Speech recognition is not supported in this browser');
    }
  }

  validateApiKeys() {
    if (!this.translationApiKey || !this.speechToTextApiKey) {
      throw new Error('API keys are not configured. Please check your environment variables.');
    }
  }

  async translateText(text, fromLang, toLang) {
    try {
      this.validateApiKeys();

      if (!text || !fromLang || !toLang) {
        throw new Error('Missing required parameters for translation');
      }

      const response = await fetch(`${this.translationApiUrl}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.translationApiKey}`
        },
        body: JSON.stringify({
          text,
          source: fromLang,
          target: toLang
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Translation API error: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      return data.translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`Translation failed: ${error.message}`);
    }
  }

  startListening(fromLang, onResult, onError) {
    if (!this.recognition) {
      const error = new Error('Speech recognition not initialized');
      if (onError) onError(error);
      return;
    }

    this.recognition.lang = fromLang;
    this.recognition.onresult = onResult;
    this.recognition.onerror = (event) => {
      if (onError) onError(new Error(`Speech recognition error: ${event.error}`));
    };
    
    try {
      this.recognition.start();
    } catch (error) {
      if (onError) onError(new Error(`Failed to start speech recognition: ${error.message}`));
    }
  }

  stopListening() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }

  speak(text, lang) {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Speech synthesis is not supported in this browser'));
        return;
      }

      if (!text || !lang) {
        reject(new Error('Missing required parameters for speech synthesis'));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.onend = resolve;
      utterance.onerror = (event) => reject(new Error(`Speech synthesis error: ${event.error}`));
      
      try {
        this.synthesis.speak(utterance);
      } catch (error) {
        reject(new Error(`Failed to start speech synthesis: ${error.message}`));
      }
    });
  }

  async processAudioChunk(audioData, fromLang, toLang) {
    try {
      this.validateApiKeys();

      if (!audioData || !fromLang || !toLang) {
        throw new Error('Missing required parameters for audio processing');
      }

      // Convert audio to text
      const text = await this.convertAudioToText(audioData, fromLang);
      if (!text) {
        throw new Error('Speech-to-text conversion failed to produce text');
      }

      // Translate the text
      const translatedText = await this.translateText(text, fromLang, toLang);
      if (!translatedText) {
        throw new Error('Translation failed to produce output');
      }

      // Convert translated text to speech
      await this.speak(translatedText, toLang);
      
      return {
        originalText: text,
        translatedText: translatedText
      };
    } catch (error) {
      console.error('Error processing audio chunk:', error);
      throw new Error(`Audio processing failed: ${error.message}`);
    }
  }

  async convertAudioToText(audioData, lang) {
    try {
      this.validateApiKeys();

      if (!audioData || !lang) {
        throw new Error('Missing required parameters for speech-to-text conversion');
      }

      const response = await fetch(`${this.speechToTextApiUrl}/recognize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.speechToTextApiKey}`
        },
        body: JSON.stringify({
          audio: audioData,
          language: lang
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Speech-to-text API error: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error('Speech-to-text error:', error);
      throw new Error(`Speech-to-text conversion failed: ${error.message}`);
    }
  }

  // Add support for more languages
  getSupportedLanguages() {
    return [
      { code: 'zh', name: 'Chinese (Simplified)' },
      { code: 'es', name: 'Spanish' },
      { code: 'en', name: 'English' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ar', name: 'Arabic' },
      { code: 'bn', name: 'Bengali' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'fa', name: 'Persian' },
      { code: 'de', name: 'German' },
      { code: 'ko', name: 'Korean' },
      { code: 'fr', name: 'French' },
      { code: 'tr', name: 'Turkish' },
      { code: 'vi', name: 'Vietnamese' },
      { code: 'it', name: 'Italian' },
      { code: 'th', name: 'Thai' },
      { code: 'nl', name: 'Dutch' },
      { code: 'pl', name: 'Polish' },
      { code: 'uk', name: 'Ukrainian' }
    ];
  }
}

export default new TranslationService(); 