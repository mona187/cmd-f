// client/src/App.js
import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';

const SIGNAL_SERVER_URL = 'http://localhost:5050'; // Adjust if your server is elsewhere

function App() {
  const [roomId, setRoomId] = useState('room1'); // Default room name
  const [myId, setMyId] = useState('');
  const [remoteId, setRemoteId] = useState('');

  const socketRef = useRef(null);
  const peerRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const [localStream, setLocalStream] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // 1) Connect to the signaling server
    socketRef.current = io(SIGNAL_SERVER_URL);

    // 2) When the server says "user-joined", we get the new user's ID
    socketRef.current.on('user-joined', (joinedUserId) => {
      console.log('New user joined:', joinedUserId);
      setRemoteId(joinedUserId);
    });

    // 3) We might store our own ID
    socketRef.current.on('connect', () => {
      setMyId(socketRef.current.id);
      console.log('Connected with ID:', socketRef.current.id);
    });

    // 4) Listen for offers
    socketRef.current.on('offer', handleOffer);

    // 5) Listen for answers
    socketRef.current.on('answer', handleAnswer);

    // 6) Listen for ICE candidates
    socketRef.current.on('ice-candidate', handleIceCandidate);

    return () => {
      socketRef.current.disconnect();
    };
  }, []);

  // "Join Room" means telling the server we want to join a certain room ID
  const joinRoom = async () => {
    try {
      // Get local media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      // Emit "join-room" to let server know which room we joined
      socketRef.current.emit('join-room', roomId);
      console.log('Joined room:', roomId);
    } catch (err) {
      console.error('Error accessing media devices.', err);
    }
  };

  // "Call Remote" starts the WebRTC offer
  const callRemote = () => {
    if (!localStream || !remoteId) {
      console.warn('No localStream or remoteId to call');
      return;
    }

    // Create a SimplePeer in "initiator" mode
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,  // We'll handle ICE manually
      stream: localStream,
    });

    peer.on('signal', (sdp) => {
      // If it's an offer, send "offer" to the server, specifying who we want to call
      socketRef.current.emit('offer', {
        target: remoteId,
        caller: socketRef.current.id,
        sdp,
      });
    });

    // When the remote stream arrives, set it in a <video> element
    peer.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      }
    });

    // If we generate ICE candidates, handle them
    peer.on('iceCandidate', (candidate) => {
      console.log('Local ICE candidate:', candidate);
      if (candidate) {
        socketRef.current.emit('ice-candidate', {
          candidate,
          target: remoteId,
        });
      }
    });

    peerRef.current = peer;
    setConnected(true);
  };

  // Handle an incoming offer
  const handleOffer = async ({ sdp, caller }) => {
    console.log('Received offer from:', caller);

    // Create a SimplePeer in "initiator=false" mode
    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream: localStream,
    });

    peer.on('signal', (answer) => {
      // If it's an answer, send it back
      socketRef.current.emit('answer', {
        sdp: answer,
        caller,
      });
    });

    peer.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      }
    });

    peer.on('iceCandidate', (candidate) => {
      if (candidate) {
        socketRef.current.emit('ice-candidate', {
          candidate,
          target: caller,
        });
      }
    });

    // "Signal" the newly created peer with the offer
    peer.signal(sdp);

    peerRef.current = peer;
    setConnected(true);
  };

  // Handle an incoming answer
  const handleAnswer = ({ sdp, answerer }) => {
    console.log('Received answer from:', answerer);
    peerRef.current?.signal(sdp);
  };

  // Handle ICE candidate
  const handleIceCandidate = ({ candidate, from }) => {
    console.log('Received ICE from:', from, candidate);
    // Pass it to our current peer
    peerRef.current?.signal(candidate);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>2-Person WebRTC Demo</h1>
      <p>Your ID: {myId}</p>

      <div style={{ marginBottom: '1rem' }}>
        <label>Room ID:</label>
        <input
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button onClick={joinRoom}>Join Room</button>
      </div>

      <p>
        If another user joins the same room, you'll see their ID appear in your console or in <code>remoteId</code> (we store it if you want).
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <label>Remote ID to call:</label>
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
    </div>
  );
}

export default App;
