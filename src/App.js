import React, { useState, useRef, useEffect } from 'react';
import SimplePeer from 'simple-peer';

function App() {
  // Peer instance
  const [peer, setPeer] = useState(null);

  // Local media
  const localVideoRef = useRef(null);
  // Remote media
  const remoteVideoRef = useRef(null);

  // Signaling data
  const [mySignal, setMySignal] = useState('');       // offer/answer created locally
  const [peerSignal, setPeerSignal] = useState('');   // offer/answer from the other peer

  // For speech recognition
  const recognitionRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [translated, setTranslated] = useState('');

  // On mount, set up Web Speech Recognition (for local user’s mic)
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.interimResults = true;
    recognition.lang = 'en-US'; // set the language for your speech input

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          setTranscript((prev) => prev + result[0].transcript + ' ');
        } else {
          interimTranscript += result[0].transcript;
        }
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
  }, []);

  // Whenever transcript updates, call a free translation API (like MyMemory)
  useEffect(() => {
    if (!transcript.trim()) return;

    const translate = async () => {
      try {
        const encodedText = encodeURIComponent(transcript);
        const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=en|es`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data?.responseData?.translatedText) {
          setTranslated(data.responseData.translatedText);
          // Optionally speak it using TTS
          speakTranslation(data.responseData.translatedText);
        }
      } catch (err) {
        console.error('Translation error:', err);
      }
    };

    translate();
  }, [transcript]);

  // Use Web Speech Synthesis to speak out the translation
  const speakTranslation = (text) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'es'; // speak in Spanish
    window.speechSynthesis.speak(utter);
  };

  // Start/Stop recording
  const startRecording = () => {
    if (recognitionRef.current) {
      setTranscript('');
      setTranslated('');
      setIsRecording(true);
      recognitionRef.current.start();
    }
  };
  const stopRecording = () => {
    if (recognitionRef.current) {
      setIsRecording(false);
      recognitionRef.current.stop();
    }
  };

  // 1. Get user media and create a new Peer for the local side
  const createOffer = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(console.error);
    }

    const newPeer = new SimplePeer({
      initiator: true,
      trickle: false,   // to simplify signal exchange
      stream: stream
    });

    // When our peer has created an offer, we get the "signal" data
    newPeer.on('signal', (data) => {
      setMySignal(JSON.stringify(data));
    });

    // When we get a remote stream, show it in the remote video
    newPeer.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(console.error);
      }
    });

    setPeer(newPeer);
  };

  // 2. Accept an offer and create an answer
  const createAnswer = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(console.error);
    }

    const newPeer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream: stream
    });

    newPeer.on('signal', (data) => {
      setMySignal(JSON.stringify(data)); // this will be our answer
    });

    newPeer.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(console.error);
      }
    });

    setPeer(newPeer);
  };

  // 3. Once we have an offer or answer from the other side, we can signal our Peer with it
  const finalizeConnection = () => {
    if (!peer) return;
    const signalData = JSON.parse(peerSignal);
    peer.signal(signalData);
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>WebRTC Video + Speech Translation Demo</h1>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={createOffer}>Create Offer (Host)</button>
        <button onClick={createAnswer}>Create Answer (Join)</button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <textarea
          rows="5"
          cols="60"
          value={mySignal}
          readOnly
          placeholder="Your signal data appears here"
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <textarea
          rows="5"
          cols="60"
          value={peerSignal}
          onChange={(e) => setPeerSignal(e.target.value)}
          placeholder="Paste your partner's offer/answer here"
        />
        <br/>
        <button onClick={finalizeConnection}>Finalize Connection</button>
      </div>

      <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
        <div>
          <h3>Local Video</h3>
          <video ref={localVideoRef} width="320" height="240" autoPlay muted />
        </div>
        <div>
          <h3>Remote Video</h3>
          <video ref={remoteVideoRef} width="320" height="240" autoPlay />
        </div>
      </div>

      <div>
        <button onClick={isRecording ? stopRecording : startRecording}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h4>Transcript (English)</h4>
        <p>{transcript}</p>

        <h4>Translated (Spanish)</h4>
        <p>{translated}</p>
      </div>
    </div>
  );
}

export default App;
