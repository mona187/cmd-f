// App.js
import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';

// For Sign Language
import '@mediapipe/hands';
import * as handpose from '@tensorflow-models/handpose';
import * as tf from '@tensorflow/tfjs';

// ---------- Styling Helpers and KawaiiGhost ----------
const styles = {
  // Keyframe Animations
  '@keyframes float': {
    '0%': { transform: 'translateY(0px)' },
    '50%': { transform: 'translateY(-10px)' },
    '100%': { transform: 'translateY(0px)' },
  },
  '@keyframes gradientBG': {
    '0%': { backgroundPosition: '0% 50%' },
    '50%': { backgroundPosition: '100% 50%' },
    '100%': { backgroundPosition: '0% 50%' },
  },
  '@keyframes pulse': {
    '0%': { transform: 'scale(1)', opacity: 0.8 },
    '50%': { transform: 'scale(1.05)', opacity: 1 },
    '100%': { transform: 'scale(1)', opacity: 0.8 },
  },
};

// A fun ghost SVG for the UI
const KawaiiGhost = ({ style, emotion = 'happy' }) => (
  <div
    style={{
      ...style,
      animation: 'float 3s ease-in-out infinite',
      filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.1))',
    }}
  >
    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="ghostGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#4a90e2' }} />
          <stop offset="100%" style={{ stopColor: '#357abd' }} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M20,90 Q50,80 80,90 L80,50 Q80,20 50,20 Q20,20 20,50 Z"
        fill="url(#ghostGradient)"
        stroke="#357abd"
        filter="url(#glow)"
        strokeWidth="2"
      />
      {emotion === 'happy' ? (
        <>
          <circle cx="35" cy="45" r="3" fill="#333" />
          <circle cx="65" cy="45" r="3" fill="#333" />
          <path
            d="M40,60 Q50,65 60,60"
            fill="none"
            stroke="#333"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle cx="35" cy="45" r="3" fill="#333" />
          <circle cx="65" cy="45" r="3" fill="#333" />
          <path
            d="M40,65 Q50,60 60,65"
            fill="none"
            stroke="#333"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  </div>
);

// ---------- MAIN APP ----------
const SIGNAL_SERVER_URL = 'http://localhost:5050';

// You can add your ICE server config here
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  // { urls: 'turn:your-turn-server.com:3478', username: '...', credential: '...' }
];

function App() {
  // -------------- State: WebRTC / Socket --------------
  const [roomId, setRoomId] = useState('room1');
  const [remoteId, setRemoteId] = useState('');
  const [offerReceived, setOfferReceived] = useState(false);
  const [connected, setConnected] = useState(false);

  // For optional video toggle
  const [isVideoOn, setIsVideoOn] = useState(true);

  // -------------- State: Detection / Speech --------------
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [isSpeechRecognitionActive, setIsSpeechRecognitionActive] = useState(false);

  // For sign detection
  const [isSignDetectionActive, setIsSignDetectionActive] = useState(false);
  const [detectedSign, setDetectedSign] = useState('');

  // -------------- Refs --------------
  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const inboundOfferRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const canvasRef = useRef(null); // to draw hands

  // For handpose
  const handposeModelRef = useRef(null);
  const requestAnimationFrameRef = useRef(null);

  // For speech recognition
  const recognitionRef = useRef(null);
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('fr');

  // For simpler "model loaded" feedback
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  // ---------- Socket Setup (similar to snippet #1) ----------
  useEffect(() => {
    socketRef.current = io(SIGNAL_SERVER_URL);

    socketRef.current.on('connect', () => {
      console.log('Socket connected. ID =', socketRef.current.id);
    });

    // Another user joined => store remoteId
    socketRef.current.on('user-joined', (joinedUserId) => {
      console.log('User joined:', joinedUserId);
      setRemoteId(joinedUserId);
    });

    // If remote hung up
    socketRef.current.on('user-hung-up', () => {
      endCall();
    });

    // Inbound offer/answer/candidates
    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleIceCandidate);

    // Cleanup
    return () => {
      socketRef.current.disconnect();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ---------- Join Room (with optional video) ----------
  const joinRoom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoOn,
      });
      localStreamRef.current = stream;

      // Display local video if we have video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(() => {});
      }

      // Join the room
      socketRef.current.emit('join-room', roomId);
      console.log('Joined room:', roomId);
    } catch (err) {
      console.error('Media error:', err);
      alert('Could not get camera/mic. Check permissions or try turning off video.');
    }
  };

  // ---------- Start Call (Offer) ----------
  const startCall = () => {
    if (!localStreamRef.current) {
      alert('Join a room first to get local media');
      return;
    }
    if (!remoteId) {
      alert('No remote user found yet.');
      return;
    }
    console.log('Starting call with:', remoteId);

    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream: localStreamRef.current,
      config: { iceServers },
    });

    peer.on('signal', (data) => {
      if (data.sdp) {
        // It's an SDP offer
        socketRef.current.emit('offer', {
          sdp: data,
          target: remoteId,
          caller: socketRef.current.id,
        });
      } else if (data.candidate) {
        // ICE candidate
        socketRef.current.emit('ice-candidate', {
          candidate: data,
          target: remoteId,
        });
      }
    });

    peer.on('stream', (remoteStream) => {
      console.log('Got remote stream (offer side)');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      }
    });

    peerRef.current = peer;
    setConnected(true);
  };

  // ---------- Handle Inbound Offer ----------
  const handleOffer = ({ sdp, caller }) => {
    console.log('Received offer from:', caller);
    setRemoteId(caller);
    setOfferReceived(true);
    inboundOfferRef.current = sdp;
  };

  // ---------- Accept/Answer Call ----------
  const answerCall = () => {
    setOfferReceived(false);
    if (!localStreamRef.current) {
      alert('No local stream available');
      return;
    }
    console.log('Answering call from:', remoteId);

    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream: localStreamRef.current,
      config: { iceServers },
    });

    peer.on('signal', (data) => {
      if (data.sdp) {
        // This is our answer
        socketRef.current.emit('answer', {
          sdp: data,
          caller: remoteId,
        });
      } else if (data.candidate) {
        // ICE candidate
        socketRef.current.emit('ice-candidate', {
          candidate: data,
          target: remoteId,
        });
      }
    });

    peer.on('stream', (remoteStream) => {
      console.log('Got remote stream (answer side)');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      }
    });

    peerRef.current = peer;
    peerRef.current.signal(inboundOfferRef.current);
    setConnected(true);
  };

  // ---------- Handle Inbound Answer ----------
  const handleAnswer = ({ sdp }) => {
    console.log('Received answer');
    peerRef.current?.signal(sdp);
  };

  // ---------- Handle ICE Candidates ----------
  const handleIceCandidate = ({ candidate }) => {
    console.log('Received ICE candidate');
    peerRef.current?.signal(candidate);
  };

  // ---------- Hang Up / End Call ----------
  const endCall = () => {
    console.log('Hanging up...');
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setConnected(false);
    setOfferReceived(false);
    inboundOfferRef.current = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    socketRef.current.emit('hang-up', roomId);
  };

  // ============================================================
  // =            Sign Detection (from snippet #2)             =
  // ============================================================
  useEffect(() => {
    // Load the handpose model
    const loadModel = async () => {
      try {
        await tf.ready();
        const model = await handpose.load({ maxHands: 1, modelType: 'lite' });
        handposeModelRef.current = model;
        setIsModelLoaded(true);
        console.log('Handpose model loaded successfully!');
      } catch (err) {
        console.error('Error loading Handpose model:', err);
        alert('Could not load hand detection model');
      }
    };
    loadModel();

    return () => {
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current);
      }
    };
  }, []);

  // Start or stop sign detection loop
  useEffect(() => {
    if (isSignDetectionActive) {
      if (!handposeModelRef.current) {
        alert('Model not loaded yet!');
        setIsSignDetectionActive(false);
      } else if (localVideoRef.current) {
        detectHandSigns(localVideoRef.current);
      }
    } else {
      // stop
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current);
      }
    }
  }, [isSignDetectionActive]);

  const detectHandSigns = async (video) => {
    if (!handposeModelRef.current || !video) return;

    try {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      const ctx = canvas.getContext('2d');

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const predictions = await handposeModelRef.current.estimateHands(video, {
        flipHorizontal: true,
      });

      if (predictions.length > 0) {
        drawHand(predictions, ctx);
        const landmarks = predictions[0].landmarks;
        const sign = interpretHandGesture(landmarks);
        if (sign && sign !== detectedSign) {
          setDetectedSign(sign);
          // Translate sign -> targetLang
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

  // A quick example of drawing the hand
  const drawHand = (predictions, ctx) => {
    predictions.forEach((prediction) => {
      const landmarks = prediction.landmarks;
      // draw circles
      landmarks.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 3 * Math.PI);
        ctx.fillStyle = '#00FF00';
        ctx.fill();
      });
    });
  };

  // Basic finger detection for an example
  const interpretHandGesture = (landmarks) => {
    if (!landmarks?.length) return '';

    // Using the snippet #2 approach
    const palmBase = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const isFingerUp = (fingerTip) => {
      const verticalDiff = palmBase[1] - fingerTip[1];
      const horizontalDiff = Math.abs(palmBase[0] - fingerTip[0]);
      return verticalDiff > 40 && horizontalDiff < 100;
    };

    const isThumbUp = isFingerUp(thumbTip);
    const isIndexUp = isFingerUp(indexTip);
    const isMiddleUp = isFingerUp(middleTip);
    const isRingUp = isFingerUp(ringTip);
    const isPinkyUp = isFingerUp(pinkyTip);

    if (isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
      return 'Yes';
    }
    if (!isThumbUp && isIndexUp && !isMiddleUp && !isRingUp && !isPinkyUp) {
      return 'One';
    }
    if (!isThumbUp && isIndexUp && isMiddleUp && !isRingUp && !isPinkyUp) {
      return 'Two';
    }
    if (!isThumbUp && isIndexUp && isMiddleUp && isRingUp && !isPinkyUp) {
      return 'Three';
    }
    if (!isThumbUp && isIndexUp && isMiddleUp && isRingUp && isPinkyUp) {
      return 'Hello';
    }
    if (!isThumbUp && !isIndexUp && !isMiddleUp && !isRingUp && isPinkyUp) {
      return 'Rock';
    }

    return '';
  };

  const toggleSignDetection = () => {
    setIsSignDetectionActive((prev) => !prev);
  };

  // ============================================================
  // =         Speech Recognition (from snippet #2)            =
  // ============================================================
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Your browser does not support speech recognition.');
      return;
    }

    if (isSpeechRecognitionActive) {
      // Stop
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsSpeechRecognitionActive(false);
    } else {
      // Start
      const recognition = new SpeechRecognition();
      recognition.lang = sourceLang;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = async (event) => {
        const last = event.results.length - 1;
        const spokenText = event.results[last][0].transcript;
        setTranscript(spokenText);

        if (event.results[last].isFinal) {
          // Translate
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

  // Example MyMemory translator
  const translateText = async (text, fromLang, toLang) => {
    if (!text.trim()) return '';
    try {
      const encodedText = encodeURIComponent(text);
      const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${fromLang}|${toLang}`;
      const resp = await fetch(url);
      const data = await resp.json();
      const translation = data?.responseData?.translatedText || '';
      return translation;
    } catch (err) {
      console.error('Translation error:', err);
      return text; // fallback
    }
  };

  // Use browser TTS
  const speakText = (text, lang) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 1.0;
    window.speechSynthesis.speak(utter);
  };

  // Cleanup speech recognition
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // ---------- UI RENDER ----------
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(-45deg, #EEF2F7, #F4F7FA, #E8EEF5, #F0F4F8)',
        backgroundSize: '400% 400%',
        animation: 'gradientBG 15s ease infinite',
        fontFamily: "'Inter', 'Segoe UI', 'Roboto', sans-serif",
      }}
    >
      {/* Main Container */}
      <div
        style={{
          maxWidth: '1800px',
          margin: '0 auto',
          padding: '2rem',
          display: 'grid',
          gridTemplateColumns: '1fr 350px',
          gap: '2rem',
          height: 'calc(100vh - 4rem)',
        }}
      >
        {/* Left Side - Main Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            height: '100%',
          }}
        >
          {/* Top Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.5rem 2rem',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
              }}
            >
              <KawaiiGhost style={{ width: '40px', height: '40px' }} />
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: '1.5rem',
                    fontWeight: '600',
                    background: 'linear-gradient(45deg, #357ABD, #4A90E2)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Sign Language Translator
                </h1>
                <p
                  style={{
                    margin: '0.25rem 0 0 0',
                    fontSize: '0.875rem',
                    color: '#64748b',
                  }}
                >
                  Connected: {connected ? 'Yes' : 'No'}
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                background: 'rgba(255, 255, 255, 0.5)',
                padding: '0.5rem',
                borderRadius: '12px',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
              }}
            >
              {/* Room ID */}
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
                  backgroundColor: 'white',
                }}
                placeholder="Enter Room ID"
              />
              {/* Check box for video on/off */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.875rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={isVideoOn}
                  onChange={(e) => setIsVideoOn(e.target.checked)}
                />
                Video
              </label>

              {/* Join Room Button */}
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
                  boxShadow: '0 2px 4px rgba(74, 144, 226, 0.25)',
                }}
              >
                <KawaiiGhost style={{ width: '20px', height: '20px' }} />
                Join Room
              </button>
            </div>
          </div>

          {/* Video Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1.5rem',
              flex: 1,
            }}
          >
            {/* Local Video */}
            <div
              style={{
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
              }}
            >
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
              {/* Canvas for hand detection */}
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
              {/* Label "You" */}
              <div
                style={{
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
                }}
              >
                <KawaiiGhost style={{ width: '24px', height: '24px' }} />
                <div>
                  <div style={{ fontWeight: '500' }}>You</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Local Video</div>
                </div>
              </div>
            </div>

            {/* Remote Video */}
            <div
              style={{
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
              }}
            >
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
              <div
                style={{
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
                }}
              >
                <KawaiiGhost style={{ width: '24px', height: '24px', emotion: 'sleepy' }} />
                <div>
                  <div style={{ fontWeight: '500' }}>{remoteId ? 'Friend' : 'Waiting...'}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Remote Video</div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '1.5rem',
              padding: '1.5rem',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* Start Call */}
            {!connected && (
              <button
                onClick={startCall}
                style={{
                  background: 'linear-gradient(45deg, #357ABD, #4A90E2)',
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
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
              >
                <KawaiiGhost style={{ width: '24px', height: '24px' }} />
                Start Call
              </button>
            )}

            {/* Accept Call (only if we have an inbound offer and not connected) */}
            {offerReceived && !connected && (
              <button
                onClick={answerCall}
                style={{
                  background: 'linear-gradient(45deg, #28A745, #4CAF50)',
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
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
              >
                <KawaiiGhost style={{ width: '24px', height: '24px' }} />
                Accept Call
              </button>
            )}

            {/* Hang Up */}
            {connected && (
              <button
                onClick={endCall}
                style={{
                  background: 'linear-gradient(45deg, #ff4444, #ff6b6b)',
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
                  boxShadow: '0 2px 4px rgba(255, 68, 68, 0.25)',
                }}
              >
                <KawaiiGhost style={{ width: '24px', height: '24px' }} />
                Hang Up
              </button>
            )}

            {/* Toggle Sign Detection */}
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
                  : '0 2px 4px rgba(74, 144, 226, 0.25)',
              }}
            >
              <KawaiiGhost style={{ width: '24px', height: '24px' }} />
              {isSignDetectionActive ? 'Stop Signs' : 'Start Signs'}
            </button>

            {/* Toggle Speech Recognition */}
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
                  : '0 2px 4px rgba(74, 144, 226, 0.25)',
              }}
            >
              <KawaiiGhost style={{ width: '24px', height: '24px' }} />
              {isSpeechRecognitionActive ? 'Stop Speech' : 'Start Speech'}
            </button>
          </div>
        </div>

        {/* Right Side - Info Panel */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '20px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            height: '100%',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Language Selection */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              padding: '1.5rem',
              backgroundColor: '#f8fafc',
              borderRadius: '16px',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '1rem',
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <KawaiiGhost style={{ width: '24px', height: '24px' }} />
              Language Settings
            </h3>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: 'white',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
                }}
              >
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
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="en">From: English</option>
                  <option value="es">From: Spanish</option>
                  <option value="fr">From: French</option>
                  <option value="de">From: German</option>
                  <option value="zh">From: Chinese</option>
                </select>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: 'white',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
                }}
              >
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
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="en">To: English</option>
                  <option value="es">To: Spanish</option>
                  <option value="fr">To: French</option>
                  <option value="de">To: German</option>
                  <option value="zh">To: Chinese</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Sign Guide */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              backgroundColor: '#f8fafc',
              borderRadius: '16px',
            }}
          >
            <h3
              style={{
                margin: '0 0 1rem 0',
                fontSize: '1rem',
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <KawaiiGhost style={{ width: '24px', height: '24px' }} />
              Quick Sign Guide
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: '0.75rem',
              }}
            >
              {[
                { emoji: '👍', text: 'Yes', description: 'Thumb up' },
                { emoji: '☝️', text: 'One', description: 'Index finger up' },
                { emoji: '✌️', text: 'Two', description: 'Index + Middle up' },
                { emoji: '🤟', text: 'Three', description: 'First 3 fingers up' },
                { emoji: '👋', text: 'Hello', description: 'All fingers up' },
                { emoji: '🤙', text: 'Rock', description: 'Pinky up' },
              ].map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '12px',
                    backgroundColor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                    transition: 'transform 0.2s',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{item.emoji}</span>
                  <div>
                    <div style={{ fontWeight: '500' }}>{item.text}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {item.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Detected Sign */}
            {detectedSign && (
              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1rem',
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <KawaiiGhost style={{ width: '24px', height: '24px' }} />
                  Detected Sign
                </h3>
                <div
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    backgroundColor: '#f0f9ff',
                    marginBottom: '0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                  }}
                >
                  {detectedSign}
                </div>
                {translation && translation !== detectedSign && (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      backgroundColor: '#f0f9ff',
                      fontSize: '0.875rem',
                      color: '#64748b',
                    }}
                  >
                    {translation}
                  </div>
                )}
              </div>
            )}

            {/* Spoken Text + Translation */}
            {transcript && (
              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1.5rem',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1rem',
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <KawaiiGhost style={{ width: '24px', height: '24px' }} />
                  Speech Recognition
                </h3>
                <div
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    backgroundColor: '#f0f9ff',
                    marginBottom: '0.75rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                  }}
                >
                  {transcript}
                </div>
                {translation && translation !== transcript && (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      backgroundColor: '#f0f9ff',
                      fontSize: '0.875rem',
                      color: '#64748b',
                    }}
                  >
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
