// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
// For Node <18, install node-fetch with: npm install node-fetch
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(bodyParser.json());

// Translation endpoint using Google Cloud Translation API
app.post('/translate', async (req, res) => {
  const { text, targetLanguage } = req.body;
  try {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) {
      throw new Error('Missing GOOGLE_TRANSLATE_API_KEY environment variable');
    }
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: 'en', // Assumes source is English; adjust as needed or pass from client
        target: targetLanguage,
        format: 'text',
      }),
    });
    const data = await response.json();
    console.log('Google Translate API response:', data);
    if (
      data &&
      data.data &&
      data.data.translations &&
      data.data.translations.length > 0
    ) {
      res.json({ translation: data.data.translations[0].translatedText });
    } else {
      console.log('Unexpected response from Google API:', data);
      res.json({ translation: text });
    }
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ translation: text });
  }
});

// WebRTC signaling events
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
    socket.to(roomId).emit('user-joined', socket.id);
  });

  socket.on('offer', (payload) => {
    console.log('Offer from:', payload.caller, 'to:', payload.target);
    io.to(payload.target).emit('offer', {
      sdp: payload.sdp,
      caller: payload.caller,
    });
  });

  socket.on('answer', (payload) => {
    console.log('Answer from:', socket.id, 'to:', payload.caller);
    io.to(payload.caller).emit('answer', {
      sdp: payload.sdp,
      answerer: socket.id,
    });
  });

  socket.on('ice-candidate', (incoming) => {
    console.log('ICE candidate from:', socket.id, 'to:', incoming.target);
    io.to(incoming.target).emit('ice-candidate', {
      candidate: incoming.candidate,
      from: socket.id,
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
