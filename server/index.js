// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// For Node <18, install node-fetch: npm install node-fetch
// Then uncomment this line:
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins for dev
  },
});

// Parse incoming JSON bodies
app.use(express.json());
// If needed, you can also do:
// app.use(cors());

/**
 * POST /translate
 * Expects JSON body: { text, sourceLanguage, targetLanguage }
 * Calls LibreTranslate and responds with { translation: "..."}
 */
app.post('/translate', async (req, res) => {
  const { text, sourceLanguage, targetLanguage } = req.body;

  try {
    const response = await fetch('https://libretranslate.com/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        source: sourceLanguage || 'en', // fallback if not provided
        target: targetLanguage || 'en', // fallback if not provided
        format: 'text',
      }),
    });

    const data = await response.json();
    console.log('Translation API response:', data);

    // LibreTranslate returns { translatedText: "..." } on success
    if (data && data.translatedText) {
      res.json({ translation: data.translatedText });
    } else {
      // If something unexpected, return original text
      console.warn('Unexpected LibreTranslate response:', data);
      res.json({ translation: text });
    }

  } catch (err) {
    console.error('Translation error:', err);
    // Return original text on error
    res.status(500).json({ translation: text });
  }
});

// WebRTC signaling
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
      caller: payload.caller
    });
  });

  socket.on('answer', (payload) => {
    console.log('Answer from:', socket.id, 'to:', payload.caller);
    io.to(payload.caller).emit('answer', {
      sdp: payload.sdp,
      answerer: socket.id
    });
  });

  socket.on('ice-candidate', (incoming) => {
    console.log('ICE candidate from:', socket.id, 'to:', incoming.target);
    io.to(incoming.target).emit('ice-candidate', {
      candidate: incoming.candidate,
      from: socket.id
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
