import React, { useState, useEffect } from 'react';
import { Button, Container, Typography, Box } from '@mui/material';
import TranslationService from '../services/TranslationService';
import { googleConfig } from '../config/google-meet-config';
import './MeetTranslator.css';

const MeetTranslator = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [currentMeeting, setCurrentMeeting] = useState(null);
  const [error, setError] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState({
    from: 'en',
    to: 'es'
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationStatus, setTranslationStatus] = useState('');
  const supportedLanguages = TranslationService.getSupportedLanguages();

  useEffect(() => {
    // Load Google API Client Library
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = initializeGoogleApi;
    document.body.appendChild(script);
  }, []);

  const initializeGoogleApi = () => {
    window.gapi.load('client:auth2', async () => {
      try {
        await window.gapi.client.init({
          apiKey: googleConfig.apiKey,
          clientId: googleConfig.clientId,
          scope: googleConfig.scopes.join(' ')
        });

        // Listen for sign-in state changes
        window.gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        
        // Handle initial sign-in state
        updateSigninStatus(window.gapi.auth2.getAuthInstance().isSignedIn.get());
      } catch (error) {
        setError('Error initializing Google API: ' + error.message);
      }
    });
  };

  const updateSigninStatus = (isSignedIn) => {
    setIsSignedIn(isSignedIn);
    if (isSignedIn) {
      const googleUser = window.gapi.auth2.getAuthInstance().currentUser.get();
      setUser({
        name: googleUser.getBasicProfile().getName(),
        email: googleUser.getBasicProfile().getEmail()
      });
      checkForActiveMeeting();
    }
  };

  const handleSignIn = () => {
    window.gapi.auth2.getAuthInstance().signIn();
  };

  const handleSignOut = () => {
    window.gapi.auth2.getAuthInstance().signOut();
    setUser(null);
    setCurrentMeeting(null);
  };

  const checkForActiveMeeting = async () => {
    try {
      // Check if we're in a Google Meet
      if (window.location.hostname === 'meet.google.com') {
        const meetingId = window.location.pathname.substring(1);
        setCurrentMeeting({ id: meetingId });
        await setupTranslation();
      } else {
        setError('Please join a Google Meet call first');
      }
    } catch (error) {
      setError('Error accessing meeting: ' + error.message);
    }
  };

  const setupTranslation = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
    } catch (error) {
      setError('Error setting up audio translation: ' + error.message);
    }
  };

  const toggleTranslation = () => {
    if (!currentMeeting) {
      setError('Please join a Google Meet call first');
      return;
    }
    setIsTranslating(!isTranslating);
    setTranslationStatus(isTranslating ? 'Translation stopped' : 'Translation active');
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Meet Translator
        </Typography>
        
        <Typography variant="h6" gutterBottom>
          Real-time translation for Google Meet
        </Typography>

        <Button 
          variant="contained" 
          color="primary"
          size="large"
          sx={{ mt: 2 }}
        >
          Get Started
        </Button>
      </Box>
    </Container>
  );
};

export default MeetTranslator; 