// client/src/App.js
import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';

const SIGNAL_SERVER_URL = 'http://localhost:5050'; // Adjust if your server is elsewhere

function App() {
  // WebRTC states
  const [roomId, setRoomId] = useState('room1');
  const [myId, setMyId] = useState('');
  const [remoteId, setRemoteId] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const peerRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Translator states (using basic ISO language codes)
  const [sourceLang, setSourceLang] = useState('en'); // e.g., 'en'
  const [targetLang, setTargetLang] = useState('fr'); // e.g., 'fr'
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');

  useEffect(() => {
    socketRef.current = io(SIGNAL_SERVER_URL);

    // Listen for new users joining
    socketRef.current.on('user-joined', (joinedUserId) => {
      console.log('New user joined:', joinedUserId);
      setRemoteId(joinedUserId);
    });

    // Store our socket ID
    socketRef.current.on('connect', () => {
      setMyId(socketRef.current.id);
      console.log('Connected with ID:', socketRef.current.id);
    });

    // WebRTC signaling
    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleIceCandidate);

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  // Join room and get local media
  const joinRoom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      socketRef.current.emit('join-room', roomId);
      console.log('Joined room:', roomId);
    } catch (err) {
      console.error('Error accessing media devices.', err);
    }
  };

  // Call remote peer
  const callRemote = () => {
    if (!localStream || !remoteId) {
      console.warn('No localStream or remoteId to call');
      return;
    }

    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream: localStream,
    });

    peer.on('signal', (data) => {
      if (data.sdp) {
        socketRef.current.emit('offer', {
          target: remoteId,
          caller: socketRef.current.id,
          sdp: data,
        });
      } else if (data.candidate) {
        socketRef.current.emit('ice-candidate', {
          candidate: data,
          target: remoteId,
        });
      }
    });

    peer.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      }
    });

    peerRef.current = peer;
    setConnected(true);
  };

  // Handle incoming offer
  const handleOffer = async ({ sdp, caller }) => {
    console.log('Received offer from:', caller);
    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream: localStream,
    });

    peer.on('signal', (data) => {
      if (data.sdp) {
        socketRef.current.emit('answer', {
          sdp: data,
          caller,
        });
      } else if (data.candidate) {
        socketRef.current.emit('ice-candidate', {
          candidate: data,
          target: caller,
        });
      }
    });

    peer.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      }
    });

    peer.signal(sdp);
    peerRef.current = peer;
    setConnected(true);
  };

  // Handle incoming answer
  const handleAnswer = ({ sdp, answerer }) => {
    console.log('Received answer from:', answerer);
    peerRef.current?.signal(sdp);
  };

  // Handle ICE candidates
  const handleIceCandidate = ({ candidate, from }) => {
    console.log('Received ICE from:', from, candidate);
    peerRef.current?.signal(candidate);
  };

  // Start speech recognition and call translation endpoint
  const startRecognition = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Your browser does not support speech recognition.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = sourceLang;
    recognition.interimResults = false;

    recognition.onresult = async (event) => {
      const result = event.results[0][0].transcript;
      setTranscript(result);

      // Call the server translation endpoint
      const translated = await translateText(result, targetLang);
      setTranslation(translated);
      speakText(translated, targetLang);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };

    recognition.start();
  };

  // Call the /translate endpoint for a real translation
  const translateText = async (text, targetLanguage) => {
    try {
      const response = await fetch('/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, targetLanguage }),
      });
      const data = await response.json();
      return data.translation;
    } catch (err) {
      console.error('Error translating text:', err);
      return text;
    }
  };

  // Speak the translated text using SpeechSynthesis
  const speakText = (text, lang) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>2-Person WebRTC Demo with Real Translation</h1>
      <p>Your Socket ID: {myId}</p>

      <div style={{ marginBottom: '1rem' }}>
        <label>Room ID: </label>
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button onClick={joinRoom}>Join Room</button>
      </div>

      <p>When another user joins the same room, their Socket ID will appear.</p>

      <div style={{ marginBottom: '1rem' }}>
        <label>Remote Socket ID to call: </label>
        <input
          value={remoteId}
          onChange={(e) => setRemoteId(e.target.value)}
        />
        <button onClick={callRemote} disabled={connected}>
          {connected ? 'Connected' : 'Call Remote'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <div>
          <h3>Local Video</h3>
          <video
            ref={localVideoRef}
            muted
            style={{ width: 320, background: 'black' }}
            autoPlay
          />
        </div>
        <div>
          <h3>Remote Video</h3>
          <video
            ref={remoteVideoRef}
            style={{ width: 320, background: 'black' }}
            autoPlay
          />
        </div>
      </div>

      <hr style={{ margin: '2rem 0' }} />

      <h2>Translator</h2>
      <div>
        <label>Source Language: </label>
        <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          {/* Add more options as needed */}
        </select>
      </div>
      <div>
        <label>Target Language: </label>
        <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
          <option value="fr">French</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          {/* Add more options as needed */}
        </select>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <button onClick={startRecognition}>Start Translation</button>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <h3>Transcript:</h3>
        <p>{transcript}</p>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <h3>Translation:</h3>
        <p>{translation}</p>
      </div>
    </div>
  );
}

export default App;
