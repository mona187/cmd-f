import React, { useState, useEffect, useRef } from 'react';
import { ZoomMtg } from '@zoomus/websdk';
import TranslationService from '../services/TranslationService';
import { zoomConfig } from '../config/zoom-config';
import './ZoomTranslator.css';

const ZoomTranslator = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [meetingDetails, setMeetingDetails] = useState({
    meetingNumber: '',
    password: '',
    userName: ''
  });
  const [error, setError] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState({
    from: 'en',
    to: 'es'
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationStatus, setTranslationStatus] = useState('');
  const supportedLanguages = TranslationService.getSupportedLanguages();

  useEffect(() => {
    // Initialize Zoom SDK
    ZoomMtg.setZoomJSLib('https://source.zoom.us/2.18.0/lib', '/av');
    ZoomMtg.preLoadWasm();
    ZoomMtg.prepareWebSDK();
    
    // Set configurations
    ZoomMtg.i18n.load('en-US');
    ZoomMtg.i18n.reload('en-US');

    // Initialize meeting configurations
    initializeMeeting();
  }, []);

  const initializeMeeting = () => {
    ZoomMtg.init({
      leaveUrl: zoomConfig.leaveUrl,
      success: (success) => {
        console.log('Zoom SDK initialized:', success);
      },
      error: (error) => {
        console.error('Failed to initialize Zoom SDK:', error);
        setError('Failed to initialize Zoom. Please refresh the page.');
      }
    });
  };

  const handleJoinMeeting = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Validate inputs
      if (!meetingDetails.meetingNumber || !meetingDetails.userName) {
        throw new Error('Meeting number and name are required');
      }

      // Join the meeting
      ZoomMtg.join({
        meetingNumber: meetingDetails.meetingNumber,
        userName: meetingDetails.userName,
        password: meetingDetails.password,
        sdkKey: zoomConfig.sdkKey,
        userEmail: '', // Optional
        success: (success) => {
          console.log('Joined meeting successfully:', success);
          setIsConnected(true);
          setupAudioTranslation();
        },
        error: (error) => {
          console.error('Failed to join meeting:', error);
          setError('Failed to join meeting. Please check your meeting details.');
        }
      });
    } catch (error) {
      setError(error.message);
    }
  };

  const setupAudioTranslation = () => {
    // Set up audio stream handling
    ZoomMtg.getAudioStream({
      success: (stream) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(1024, 1, 1);

        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = async (e) => {
          if (!isTranslating) return;

          try {
            const result = await TranslationService.processAudioChunk(
              e.inputBuffer.getChannelData(0),
              selectedLanguages.from,
              selectedLanguages.to
            );

            setTranslationStatus(`Translated: ${result.originalText} → ${result.translatedText}`);
          } catch (error) {
            console.error('Translation error:', error);
            setTranslationStatus(`Error: ${error.message}`);
          }
        };
      },
      error: (error) => {
        console.error('Failed to get audio stream:', error);
        setError('Failed to access audio stream');
      }
    });
  };

  const toggleTranslation = () => {
    setIsTranslating(!isTranslating);
    setTranslationStatus(isTranslating ? 'Translation stopped' : 'Translation active');
  };

  return (
    <div className="zoom-translator">
      <h2>Zoom Real-Time Translator</h2>
      
      {error && <div className="error-message">{error}</div>}

      {!isConnected ? (
        <form onSubmit={handleJoinMeeting} className="join-form">
          <input
            type="text"
            placeholder="Meeting Number"
            value={meetingDetails.meetingNumber}
            onChange={(e) => setMeetingDetails(prev => ({
              ...prev,
              meetingNumber: e.target.value
            }))}
            required
          />
          <input
            type="text"
            placeholder="Your Name"
            value={meetingDetails.userName}
            onChange={(e) => setMeetingDetails(prev => ({
              ...prev,
              userName: e.target.value
            }))}
            required
          />
          <input
            type="password"
            placeholder="Meeting Password (if required)"
            value={meetingDetails.password}
            onChange={(e) => setMeetingDetails(prev => ({
              ...prev,
              password: e.target.value
            }))}
          />
          <button type="submit">Join Meeting</button>
        </form>
      ) : (
        <div className="translation-controls">
          <div className="language-selector">
            <select
              value={selectedLanguages.from}
              onChange={(e) => setSelectedLanguages(prev => ({
                ...prev,
                from: e.target.value
              }))}
            >
              {supportedLanguages.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            
            <span>→</span>
            
            <select
              value={selectedLanguages.to}
              onChange={(e) => setSelectedLanguages(prev => ({
                ...prev,
                to: e.target.value
              }))}
            >
              {supportedLanguages.map(lang => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={toggleTranslation}
            className={isTranslating ? 'stop' : 'start'}
          >
            {isTranslating ? 'Stop Translation' : 'Start Translation'}
          </button>

          <div className="status">
            <p>Meeting Status: Connected</p>
            <p>Translation Status: {translationStatus}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZoomTranslator; 