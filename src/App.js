import '@mediapipe/hands';
import * as handpose from '@tensorflow-models/handpose';
import * as tf from '@tensorflow/tfjs';
import React, { useEffect, useRef, useState } from 'react';
import SimplePeer from 'simple-peer';
import io from 'socket.io-client';
import SignLanguageRecognition from './components/SignLanguageRecognition';




// Update with your actual signaling server endpoint
const SIGNAL_SERVER_URL = process.env.REACT_APP_SIGNAL_SERVER_URL || 'http://localhost:5050';

// Add these CSS keyframes and new styles
const styles = {
  '@keyframes float': {
    '0%': { transform: 'translateY(0px)' },
    '50%': { transform: 'translateY(-10px)' },
    '100%': { transform: 'translateY(0px)' }
  },
  '@keyframes gradientBG': {
    '0%': { backgroundPosition: '0% 50%' },
    '50%': { backgroundPosition: '100% 50%' },
    '100%': { backgroundPosition: '0% 50%' }
  },
  '@keyframes pulse': {
    '0%': { transform: 'scale(1)', opacity: 0.8 },
    '50%': { transform: 'scale(1.05)', opacity: 1 },
    '100%': { transform: 'scale(1)', opacity: 0.8 }
  }
};

// Update KawaiiGhost with more professional design
const KawaiiGhost = ({ style, emotion = 'happy' }) => (
  <div style={{
    ...style,
    animation: 'float 3s ease-in-out infinite',
    filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.1))'
  }}>
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="ghostGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#4a90e2' }} />
          <stop offset="100%" style={{ stopColor: '#357abd' }} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <path d="M20,90 Q50,80 80,90 L80,50 Q80,20 50,20 Q20,20 20,50 Z" 
            fill="url(#ghostGradient)" 
            stroke="#357abd"
            filter="url(#glow)"
            strokeWidth="2"/>
      {emotion === 'happy' ? (
        <>
          <circle cx="35" cy="45" r="3" fill="#333"/>
          <circle cx="65" cy="45" r="3" fill="#333"/>
          <path d="M40,60 Q50,65 60,60" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <circle cx="35" cy="45" r="3" fill="#333"/>
          <circle cx="65" cy="45" r="3" fill="#333"/>
          <path d="M40,65 Q50,60 60,65" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        </>
      )}
    </svg>
  </div>
);

// Update language options constant with flag emojis
const LANGUAGE_OPTIONS = [
  { code: 'zh', name: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'bn', name: 'Bengali', flag: '🇧🇩' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'fa', name: 'Persian', flag: '🇮🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦' }
];

function App() {
  // --- WebRTC / Video Chat state ---
  const [roomId, setRoomId] = useState('room1');
  const [myId, setMyId] = useState('');
  const [remoteId, setRemoteId] = useState('');
  const [connected, setConnected] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const localStreamRef = useRef(null); // store local stream
  const peerRef = useRef(null);
  const socketRef = useRef(null);
  const handposeModelRef = useRef(null);
  const requestAnimationFrameRef = useRef(null);

  // --- Speech Recognition + Translation state ---
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('fr');
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [isSignDetectionActive, setIsSignDetectionActive] = useState(false);
  const [detectedSign, setDetectedSign] = useState('');
  const [isSpeechRecognitionActive, setIsSpeechRecognitionActive] = useState(false);
  const recognitionRef = useRef(null);

  // Add voice loading effect
  const [selectedVoice, setSelectedVoice] = useState('');
  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    // Connect to the signaling server
    socketRef.current = io(SIGNAL_SERVER_URL);

    // On connect, store our Socket.IO ID and join room if specified
    socketRef.current.on('connect', () => {
      setMyId(socketRef.current.id);
      console.log('Connected with ID:', socketRef.current.id);
      
      // Auto-join room if roomId is set
      if (roomId) {
        joinRoom();
      }
    });

    // Listen for new user joined
    socketRef.current.on('user-joined', (joinedUserId) => {
      console.log('New user joined:', joinedUserId);
      setRemoteId(joinedUserId);
      // Automatically start call when new user joins
      if (localStreamRef.current) {
        callRemote();
      }
    });

    socketRef.current.on('user-left', (userId) => {
      console.log('User left:', userId);
      if (userId === remoteId) {
        setRemoteId('');
        setConnected(false);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      }
    });

    // Listen for incoming offers/answers/candidates
    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleIceCandidate);

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Join a room and get local media
  const joinRoom = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      localStreamRef.current = stream;

      // Play local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(() => {});
      }

      // Tell server we joined a room
      socketRef.current.emit('join-room', roomId);
      console.log('Joined room:', roomId);

    } catch (err) {
      console.error('Error accessing media devices:', err);
      alert('Could not access camera or microphone. Please check permissions.');
    }
  };

  // --- B. Call the remote user we know about (start the offer process) ---
  const callRemote = () => {
    if (!localStreamRef.current || !remoteId) {
      console.warn('No localStream or remoteId to call');
      return;
    }
    console.log('Calling remote user:', remoteId);

    const peer = new SimplePeer({
      initiator: true,
      trickle: false, // we signal via socket in one piece
      stream: localStreamRef.current,
    });

    // When the peer has an offer or ICE candidate, send it to remote
    peer.on('signal', (data) => {
      if (data.sdp) {
        // This is an SDP offer
        socketRef.current.emit('offer', {
          target: remoteId,
          caller: socketRef.current.id,
          sdp: data,
        });
      } else if (data.candidate) {
        // This is an ICE candidate
        socketRef.current.emit('ice-candidate', {
          candidate: data,
          target: remoteId,
        });
      }
    });

    // When we get a remote stream, attach it to remoteVideo
    peer.on('stream', (remoteStream) => {
      console.log('Received remote stream:', remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      }
    });

    peerRef.current = peer;
    setConnected(true);
  };

  // --- C. Handle inbound offer from a caller ---
  const handleOffer = ({ sdp, caller }) => {
    console.log('Received offer from:', caller);

    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream: localStreamRef.current,
    });

    peer.on('signal', (data) => {
      if (data.sdp) {
        // This is our answer
        socketRef.current.emit('answer', {
          sdp: data,
          caller,
        });
      } else if (data.candidate) {
        // ICE candidate
        socketRef.current.emit('ice-candidate', {
          candidate: data,
          target: caller,
        });
      }
    });

    peer.on('stream', (remoteStream) => {
      console.log('Received remote stream (answer side):', remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      }
    });

    // Pass the inbound offer
    peer.signal(sdp);
    peerRef.current = peer;
    setConnected(true);
  };

  // --- D. Handle inbound answer from the callee ---
  const handleAnswer = ({ sdp, answerer }) => {
    console.log('Received answer from:', answerer);
    peerRef.current?.signal(sdp);
  };

  // --- E. Handle inbound ICE candidates ---
  const handleIceCandidate = ({ candidate, from }) => {
    console.log('Received ICE from:', from, candidate);
    peerRef.current?.signal(candidate);
  };

  // ======== SPEECH RECOGNITION + TRANSLATION ========

  // Handle sign detection
  const handleSignDetected = async (sign) => {
    if (sign !== detectedSign) {
      setDetectedSign(sign);
      const translated = await translateText(sign, 'en', targetLang);
      setTranslation(translated);
      speakText(translated, targetLang);
    }
  };

  // Improved speech recognition with toggle functionality
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Your browser does not support speech recognition.');
      return;
    }

    if (isSpeechRecognitionActive) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setIsSpeechRecognitionActive(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.lang = sourceLang;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = async (event) => {
        const last = event.results.length - 1;
        const spokenText = event.results[last][0].transcript;
        setTranscript(spokenText);

        if (event.results[last].isFinal) {
          const translated = await translateText(spokenText, sourceLang, targetLang);
          setTranslation(translated);
          speakText(translated, targetLang);
        }
      };

      recognition.onerror = (err) => {
        console.error('Speech recognition error:', err);
        setIsSpeechRecognitionActive(false);
      };

      recognition.onend = () => {
        if (isSpeechRecognitionActive) {
          recognition.start();
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsSpeechRecognitionActive(true);
    }
  };

  // Example using a free MyMemory endpoint (no API key needed)
  const translateText = async (text, fromLang, toLang) => {
    if (!text.trim()) return '';
    try {
      const encodedText = encodeURIComponent(text);
      const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${fromLang}|${toLang}`;
      const resp = await fetch(url);
      const data = await resp.json();
      // MyMemory puts the result in data.responseData.translatedText
      const translation = data?.responseData?.translatedText || '';
      return translation;
    } catch (err) {
      console.error('Translation error:', err);
      return text; // fallback to original
    }
  };

  // Update voice loading effect
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      
      // Filter for reliable voices only
      const filteredVoices = voices
        .filter(voice => {
          // Only include voices that:
          // 1. Are English voices
          // 2. Have a valid name
          // 3. Are from reliable sources or known fun voices
          return (
            voice.lang.startsWith('en') &&
            voice.name &&
            (
              voice.name.includes('Google') ||
              voice.name.includes('Microsoft') ||
              voice.name.includes('Samantha') ||
              voice.name.includes('Alex') ||
              voice.name.includes('Victoria') ||
              voice.name.includes('Daniel') ||
              voice.name.includes('Junior') ||
              voice.name.includes('Fred') ||
              voice.name.includes('Rishi') ||
              voice.name.includes('Junior') ||
              voice.name.includes('Junior') ||
              voice.name.includes('Junior')
            )
          );
        })
        .sort((a, b) => {
          // Sort by source first (Google voices first)
          if (a.name.includes('Google') && !b.name.includes('Google')) return -1;
          if (!a.name.includes('Google') && b.name.includes('Google')) return 1;
          // Then by gender (female voices first)
          if (a.name.includes('Female') && !b.name.includes('Female')) return -1;
          if (!a.name.includes('Female') && b.name.includes('Female')) return 1;
          // Then by name
          return a.name.localeCompare(b.name);
        });
      
      console.log('Available voices:', filteredVoices);
      setAvailableVoices(filteredVoices);
      
      // Set default voice to first available voice
      if (filteredVoices.length > 0 && !selectedVoice) {
        setSelectedVoice(filteredVoices[0].name);
      }
    };

    // Load voices when they're ready
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    loadVoices();
  }, []);

  // Update voice preview function with fun message
  const previewVoice = (voiceName) => {
    const voice = availableVoices.find(v => v.name === voiceName);
    if (voice) {
      try {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        // Fun preview messages based on voice characteristics
        let previewMessage = "Hello! I'm a fun voice assistant!";
        if (voice.name.includes('Junior')) {
          previewMessage = "Hey there! I'm a cool kid voice!";
        } else if (voice.name.includes('Fred')) {
          previewMessage = "Hi! I'm Fred, and I love to chat!";
        } else if (voice.name.includes('Rishi')) {
          previewMessage = "Namaste! I'm here to help you!";
        }
        
        const utterance = new SpeechSynthesisUtterance(previewMessage);
        utterance.voice = voice;
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Add error handling
        utterance.onerror = (event) => {
          console.error('Voice preview error:', event);
          window.speechSynthesis.cancel();
        };
        
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Error previewing voice:', err);
      }
    }
  };

  // Update speakText function with better error handling
  const speakText = (text, lang) => {
    if (!text) return;
    
    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.9; // Slower rate for main speech
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Set voice if available
      if (selectedVoice && availableVoices.length > 0) {
        const voice = availableVoices.find(v => v.name === selectedVoice);
        if (voice) {
          utterance.voice = voice;
        }
      }

      // Add error handling
      utterance.onerror = (event) => {
        console.error('Speech error:', event);
        window.speechSynthesis.cancel();
      };

      // Add a small delay to prevent rapid-fire speech
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 100);
    } catch (err) {
      console.error('Error in speakText:', err);
    }
  };

  // Load the handpose model
  useEffect(() => {
    const loadHandposeModel = async () => {
      try {
        console.log('Starting to load TensorFlow.js and handpose model...');
        
        // First ensure TensorFlow.js is ready
        if (!tf) {
          console.error('TensorFlow.js not loaded!');
          return;
        }
        console.log('TensorFlow.js loaded, backend:', await tf.ready());
        
        // Load the handpose model
        console.log('Loading handpose model...');
        const model = await handpose.load({
          maxHands: 1,
          modelType: 'lite'
        });
        
        handposeModelRef.current = model;
        setIsModelLoaded(true); // Directly set model loaded state
        console.log('Handpose model loaded successfully!');
      } catch (err) {
        console.error('Failed to load handpose model:', err);
        alert('Error loading hand detection model. Please check console for details.');
      }
    };

    // Add a timeout to ensure we're not stuck waiting forever
    const timeoutId = setTimeout(() => {
      if (!handposeModelRef.current) {
        console.error('Model loading timed out after 30 seconds');
        alert('Hand detection model loading timed out. Please refresh the page.');
      }
    }, 30000);

    loadHandposeModel();

    return () => clearTimeout(timeoutId);
  }, []);

  // Remove the separate model loading check since we're handling it directly
  useEffect(() => {
    const checkModelLoaded = () => {
      console.log('Checking model status:', {
        isModelLoaded: !!handposeModelRef.current,
        modelRef: handposeModelRef.current
      });
    };
    
    // Check model status every 3 seconds
    const intervalId = setInterval(checkModelLoaded, 3000);
    return () => clearInterval(intervalId);
  }, []);

  // Function to draw hand landmarks on canvas
  const drawHand = (predictions, ctx) => {
    if (!predictions.length) return;

    // Draw dots for each landmark
    predictions.forEach(prediction => {
      const landmarks = prediction.landmarks;

      // Draw dots
      landmarks.forEach(([x, y, z]) => {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 3 * Math.PI);
        ctx.fillStyle = '#00FF00';
        ctx.fill();
      });

      // Draw lines connecting landmarks
      const palmBase = landmarks[0];
      const thumb = landmarks.slice(1, 5);
      const indexFinger = landmarks.slice(5, 9);
      const middleFinger = landmarks.slice(9, 13);
      const ringFinger = landmarks.slice(13, 17);
      const pinky = landmarks.slice(17, 21);

      // Draw lines for each finger
      [thumb, indexFinger, middleFinger, ringFinger, pinky].forEach(finger => {
        ctx.beginPath();
        ctx.moveTo(palmBase[0], palmBase[1]);
        finger.forEach(([x, y]) => {
          ctx.lineTo(x, y);
        });
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });
  };

  // Function to interpret hand gestures
  const interpretHandGesture = (landmarks) => {
    const palmBase = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // Helper function to check if a finger is extended
    const isFingerUp = (fingerTip) => {
      // Check if finger is higher than palm base (in screen coordinates, lower Y is higher)
      const verticalDiff = palmBase[1] - fingerTip[1];
      // Also check horizontal distance to avoid false positives
      const horizontalDiff = Math.abs(palmBase[0] - fingerTip[0]);
      
      return verticalDiff > 40 && horizontalDiff < 100;
    };

    // Check each finger
    const isThumbUp = isFingerUp(thumbTip);
    const isIndexUp = isFingerUp(indexTip);
    const isMiddleUp = isFingerUp(middleTip);
    const isRingUp = isFingerUp(ringTip);
    const isPinkyUp = isFingerUp(pinkyTip);

    console.log('Finger states:', {
      thumb: isThumbUp,
      index: isIndexUp,
      middle: isMiddleUp,
      ring: isRingUp,
      pinky: isPinkyUp
    });

    // Simple gesture detection
    if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
      return "Yes";
    }
    if (!isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
      return "One";
    }
    if (!isThumbUp && isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
      return "Two";
    }
    if (!isThumbUp && isIndexUp && isMiddleUp && isRingUp && !isPinkyUp) {
      return "Three";
    }
    if (!isThumbUp && isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
      return "Hello";
    }
    if (!isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && isPinkyUp) {
      return "Rock";
    }

    return ""; // No recognized gesture
  };

  // Function to detect hand signs
  const detectHandSigns = async (video) => {
    if (!handposeModelRef.current || !video) return;

    try {
      // Set canvas dimensions to match video
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      const ctx = canvas.getContext('2d');
      
      // Clear previous drawings
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const predictions = await handposeModelRef.current.estimateHands(video, {
        flipHorizontal: true
      });
      
      if (predictions.length > 0) {
        drawHand(predictions, ctx);
        const landmarks = predictions[0].landmarks;
        const sign = interpretHandGesture(landmarks);
        
        if (sign && sign !== detectedSign) {
          setDetectedSign(sign);
          const translated = await translateText(sign, 'en', targetLang);
          setTranslation(translated);
          speakText(translated, targetLang);
        }
      }

      if (isSignDetectionActive) {
        requestAnimationFrameRef.current = requestAnimationFrame(() => 
          detectHandSigns(video)
        );
      }
    } catch (err) {
      console.error('Hand detection error:', err);
    }
  };

  // Start/Stop sign language detection
  const toggleSignDetection = () => {
    console.log('Toggle sign detection:', !isSignDetectionActive);
    if (!isSignDetectionActive) {
      if (!handposeModelRef.current) {
        console.error('Handpose model not loaded yet!');
        alert('Please wait for the hand detection model to load...');
        return;
      }
      
      setIsSignDetectionActive(true);
      if (localVideoRef.current) {
        console.log('Starting hand detection with video:', localVideoRef.current);
        detectHandSigns(localVideoRef.current);
      } else {
        console.error('No video reference available!');
      }
    } else {
      setIsSignDetectionActive(false);
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current);
      }
    }
  };

  // Add visual feedback for model loading
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(-45deg, #EEF2F7, #F4F7FA, #E8EEF5, #F0F4F8)',
      backgroundSize: '400% 400%',
      animation: 'gradientBG 15s ease infinite',
      fontFamily: "'Inter', 'Segoe UI', 'Roboto', sans-serif"
    }}>
      {/* Main Container */}
      <div style={{
        maxWidth: '1800px',
        margin: '0 auto',
        padding: '2rem',
        display: 'grid',
        gridTemplateColumns: '1fr 350px',
        gap: '2rem',
        height: 'calc(100vh - 4rem)',
      }}>
        {/* Left Side - Main Content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          height: '100%',
        }}>
          {/* Top Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.5rem 2rem',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <KawaiiGhost style={{ width: '40px', height: '40px' }} />
              <div>
                <h1 style={{ 
                  margin: 0,
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  background: 'linear-gradient(45deg, #357ABD, #4A90E2)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>Sign Language Translator</h1>
                <p style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '0.875rem',
                  color: '#64748b'
                }}>Connected: {connected ? 'Yes' : 'No'}</p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              background: 'rgba(255, 255, 255, 0.5)',
              padding: '0.5rem',
              borderRadius: '12px',
              boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
            }}>
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                style={{ 
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  outline: 'none',
                  width: '140px',
                  fontSize: '0.875rem',
                  transition: 'all 0.2s',
                  backgroundColor: 'white'
                }}
                placeholder="Enter Room ID"
              />
              <button 
                onClick={joinRoom}
                style={{
                  background: 'linear-gradient(45deg, #357ABD, #4A90E2)',
                  color: 'white',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(74, 144, 226, 0.25)'
                }}
              >
                <KawaiiGhost style={{ width: '20px', height: '20px' }} />
                Join Room
              </button>
            </div>
          </div>

          {/* Video Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
            flex: 1,
          }}>
            {/* Local Video */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '20px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
              backdropFilter: 'blur(10px)',
              aspectRatio: '16/9',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <video
                ref={localVideoRef}
                muted
                style={{ 
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)',
                  borderRadius: '20px',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
                autoPlay
                playsInline
              />
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
              <SignLanguageRecognition
                videoRef={localVideoRef}
                onSignDetected={handleSignDetected}
                targetLang={targetLang}
                isActive={isSignDetectionActive}
                onActiveChange={setIsSignDetectionActive}
                KawaiiGhost={KawaiiGhost}
                hideButton={true}
              />
              <div style={{
                position: 'absolute',
                bottom: '1.5rem',
                left: '1.5rem',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                padding: '0.75rem 1.25rem',
                borderRadius: '12px',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backdropFilter: 'blur(4px)',
              }}>
                <KawaiiGhost style={{ width: '24px', height: '24px' }} />
                <div>
                  <div style={{ fontWeight: '500' }}>You</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Local Video</div>
                </div>
              </div>
            </div>

            {/* Remote Video */}
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '20px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
              backdropFilter: 'blur(10px)',
              aspectRatio: '16/9',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <video
                ref={remoteVideoRef}
                style={{ 
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '20px',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
                autoPlay
              />
              <div style={{
                position: 'absolute',
                bottom: '1.5rem',
                left: '1.5rem',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                padding: '0.75rem 1.25rem',
                borderRadius: '12px',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backdropFilter: 'blur(4px)',
              }}>
                <KawaiiGhost style={{ width: '24px', height: '24px', emotion: 'sleepy' }} />
                <div>
                  <div style={{ fontWeight: '500' }}>{remoteId ? 'Friend' : 'Waiting...'}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Remote Video</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1.5rem',
            padding: '1.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            backdropFilter: 'blur(10px)',
          }}>
            {/* Call Control */}
            <button 
              onClick={callRemote}
              disabled={connected || !remoteId}
              style={{
                background: connected
                  ? 'linear-gradient(45deg, #e2e8f0, #f1f5f9)'
                  : 'linear-gradient(45deg, #357ABD, #4A90E2)',
                color: connected ? '#64748b' : 'white',
                padding: '1rem 2rem',
                borderRadius: '12px',
                border: 'none',
                cursor: connected ? 'default' : 'pointer',
                opacity: connected || !remoteId ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'all 0.2s',
                minWidth: '180px',
                fontSize: '0.875rem',
                fontWeight: '500',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              <KawaiiGhost style={{ width: '24px', height: '24px' }} />
              {connected ? 'Connected' : 'Start Call'}
            </button>

            {/* Sign Language Detection Toggle */}
            <button 
              onClick={toggleSignDetection}
              style={{
                background: isSignDetectionActive 
                  ? 'linear-gradient(45deg, #ff4444, #ff6b6b)'
                  : 'linear-gradient(45deg, #357ABD, #4A90E2)',
                color: 'white',
                padding: '1rem 2rem',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'all 0.2s',
                minWidth: '180px',
                fontSize: '0.875rem',
                fontWeight: '500',
                boxShadow: isSignDetectionActive
                  ? '0 2px 4px rgba(255, 68, 68, 0.25)'
                  : '0 2px 4px rgba(74, 144, 226, 0.25)'
              }}
            >
              <KawaiiGhost style={{ width: '24px', height: '24px' }} />
              {isSignDetectionActive ? 'Stop Signs' : 'Start Signs'}
            </button>

            {/* Speech Recognition Toggle */}
            <button 
              onClick={toggleSpeechRecognition}
              style={{
                background: isSpeechRecognitionActive
                  ? 'linear-gradient(45deg, #ff4444, #ff6b6b)'
                  : 'linear-gradient(45deg, #357ABD, #4A90E2)',
                color: 'white',
                padding: '1rem 2rem',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                transition: 'all 0.2s',
                minWidth: '180px',
                fontSize: '0.875rem',
                fontWeight: '500',
                boxShadow: isSpeechRecognitionActive
                  ? '0 2px 4px rgba(255, 68, 68, 0.25)'
                  : '0 2px 4px rgba(74, 144, 226, 0.25)'
              }}
            >
              <KawaiiGhost style={{ width: '24px', height: '24px' }} />
              {isSpeechRecognitionActive ? 'Stop Speech' : 'Start Speech'}
            </button>

            {/* Voice Selection */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '12px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
            }}>
              <KawaiiGhost style={{ width: '24px', height: '24px' }} />
              <select
                value={selectedVoice}
                onChange={(e) => {
                  setSelectedVoice(e.target.value);
                  previewVoice(e.target.value);
                }}
                style={{
                  padding: '0.5rem',
                  borderRadius: '8px',
                  border: '2px solid #e2e8f0',
                  outline: 'none',
                  fontSize: '0.875rem',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  minWidth: '200px'
                }}
              >
                {availableVoices.map(voice => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Side - Info Panel */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          height: '100%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(10px)',
        }}>
          {/* Language Selection */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.5rem',
            backgroundColor: '#f8fafc',
            borderRadius: '16px',
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '1rem',
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <KawaiiGhost style={{ width: '24px', height: '24px' }} />
              Language Settings
            </h3>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'white',
                padding: '0.5rem',
                borderRadius: '8px',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
              }}>
                <KawaiiGhost style={{ width: '24px', height: '24px' }} />
                <select
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    flex: 1,
                    outline: 'none',
                    fontSize: '0.875rem'
                  }}
                >
                  {LANGUAGE_OPTIONS.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} From: {lang.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'white',
                padding: '0.5rem',
                borderRadius: '8px',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)'
              }}>
                <KawaiiGhost style={{ width: '24px', height: '24px' }} />
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '2px solid #e2e8f0',
                    flex: 1,
                    outline: 'none',
                    fontSize: '0.875rem'
                  }}
                >
                  {LANGUAGE_OPTIONS.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} To: {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Quick Sign Guide */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            backgroundColor: '#f8fafc',
            borderRadius: '16px',
          }}>
            <h3 style={{ 
              margin: '0 0 1rem 0',
              fontSize: '1rem',
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <KawaiiGhost style={{ width: '24px', height: '24px' }} />
              Quick Sign Guide
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '0.75rem'
            }}>
              {[
                { emoji: '👍', text: 'Yes', description: 'Thumb up' },
                { emoji: '☝️', text: 'One', description: 'Index finger up' },
                { emoji: '✌️', text: 'Two', description: 'Index and middle up' },
                { emoji: '🤟', text: 'Three', description: 'First three fingers up' },
                { emoji: '👋', text: 'Hello', description: 'All fingers up' },
                { emoji: '🤙', text: 'Rock', description: 'Pinky up' }
              ].map((item, index) => (
                <div key={index} style={{
                  padding: '0.75rem',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                  transition: 'transform 0.2s',
                  cursor: 'pointer',
                  ':hover': {
                    transform: 'translateY(-2px)'
                  }
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{item.emoji}</span>
                  <div>
                    <div style={{ fontWeight: '500' }}>{item.text}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.description}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Detection Results */}
            {detectedSign && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1.5rem',
                borderRadius: '12px',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
              }}>
                <h3 style={{ 
                  margin: '0 0 1rem 0',
                  fontSize: '1rem',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <KawaiiGhost style={{ width: '24px', height: '24px' }} />
                  Detected Sign
                </h3>
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: '#f0f9ff',
                  marginBottom: '0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  {detectedSign}
                </div>
                {translation && translation !== detectedSign && (
                  <div style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    backgroundColor: '#f0f9ff',
                    fontSize: '0.875rem',
                    color: '#64748b'
                  }}>
                    {translation}
                  </div>
                )}
              </div>
            )}

            {/* Transcript */}
            {transcript && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1.5rem',
                borderRadius: '12px',
                backgroundColor: 'white',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
              }}>
                <h3 style={{ 
                  margin: '0 0 1rem 0',
                  fontSize: '1rem',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <KawaiiGhost style={{ width: '24px', height: '24px' }} />
                  Speech Recognition
                </h3>
                <div style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: '#f0f9ff',
                  marginBottom: '0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  {transcript}
                </div>
                {translation && translation !== transcript && (
                  <div style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    backgroundColor: '#f0f9ff',
                    fontSize: '0.875rem',
                    color: '#64748b'
                  }}>
                    {translation}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
