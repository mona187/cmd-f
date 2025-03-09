import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';

// Update with your actual signaling server endpoint
const SIGNAL_SERVER_URL = 'http://localhost:5050';

function App() {
  // --- WebRTC / Video Chat state ---
  const [roomId, setRoomId] = useState('room1');
  const [myId, setMyId] = useState('');
  const [remoteId, setRemoteId] = useState('');
  const [connected, setConnected] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  const localStreamRef = useRef(null); // store local stream
  const peerRef = useRef(null);
  const socketRef = useRef(null);

  // --- Speech Recognition + Translation state ---
  const [sourceLang, setSourceLang] = useState('en'); // e.g., "en"
  const [targetLang, setTargetLang] = useState('fr'); // e.g., "fr"
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');

  useEffect(() => {
    // 1. Connect to the signaling server
    socketRef.current = io(SIGNAL_SERVER_URL);

    // 2. On connect, store our Socket.IO ID
    socketRef.current.on('connect', () => {
      setMyId(socketRef.current.id);
      console.log('Connected with ID:', socketRef.current.id);
    });

    // Listen for new user joined
    socketRef.current.on('user-joined', (joinedUserId) => {
      console.log('New user joined:', joinedUserId);
      setRemoteId(joinedUserId);
    });

    // Listen for incoming offers/answers/candidates
    socketRef.current.on('offer', handleOffer);
    socketRef.current.on('answer', handleAnswer);
    socketRef.current.on('ice-candidate', handleIceCandidate);

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  // --- A. Join a room and get local media ---
  const joinRoom = async () => {
    try {
      // 1. Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      localStreamRef.current = stream; // store in ref

      // 2. Play local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      // 3. Tell server we joined a room
      socketRef.current.emit('join-room', roomId);
      console.log('Joined room:', roomId);

    } catch (err) {
      console.error('Error accessing media devices:', err);
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

  // 1. Start speech recognition with the chosen sourceLang
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
      const spokenText = event.results[0][0].transcript;
      setTranscript(spokenText);

      // 2. Translate the text
      const translated = await translateText(spokenText, sourceLang, targetLang);
      setTranslation(translated);

      // 3. Speak out loud using TTS
      speakText(translated, targetLang);
    };

    recognition.onerror = (err) => {
      console.error('Speech recognition error:', err);
    };

    recognition.start();
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

  // Use the browser's built-in speechSynthesis
  const speakText = (text, lang) => {
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang; 
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>WebRTC Video + Audio Chat with Live Translation</h1>
      <p>Your Socket ID: {myId}</p>

      <div style={{ marginBottom: '1rem' }}>
        <label>Room ID: </label>
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          style={{ marginRight: '1rem' }}
        />
        <button onClick={joinRoom}>Join Room</button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <p>Other user in room: {remoteId || 'No one yet'}</p>
        <button onClick={callRemote} disabled={connected || !remoteId}>
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

      <h2>Speech Recognition + Translation</h2>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ marginRight: '0.5rem' }}>Source Language:</label>
        <select
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="zh">Chinese</option>
          <option value="fa">Farsi</option>
        </select>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ marginRight: '0.5rem' }}>Target Language:</label>
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
        >
          <option value="en">English</option>
          <option value="ar">Arabic</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="zh">Chinese</option>
          <option value="fa-IR">Farsi</option>
        </select>
      </div>

      <button onClick={startRecognition}>Start Speech Recognition</button>

      <div style={{ marginTop: '1rem' }}>
        <h3>Transcript (detected in {sourceLang}):</h3>
        <p>{transcript}</p>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h3>Translation (spoken in {targetLang}):</h3>
        <p>{translation}</p>
      </div>
    </div>
  );
}

export default App;
