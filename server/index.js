const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // npm install node-fetch (for Node <18)

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(bodyParser.json());

// ====== Google Cloud Translation Endpoint (Optional) ======
//  - If you have a Google Cloud Translate API key, you can enable this endpoint.
//  - Otherwise, you can rely on the client-side MyMemory example, or remove this endpoint altogether.
app.post('/translate', async (req, res) => {
  const { text, targetLanguage, sourceLanguage } = req.body;
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
        source: sourceLanguage || 'en',
        target: targetLanguage || 'en',
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

// ====== Data Structures to Track Rooms & Participants ======
/**
 * rooms = {
 *   [roomId]: Set of socketIds,
 *   ...
 * }
 */
const rooms = {};

// ====== Socket.IO Signaling ======
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // --- Join a room ---
  socket.on('join-room', (roomId) => {
    // Create room if doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = new Set();
    }

    // Add this socket to the room
    rooms[roomId].add(socket.id);
    socket.join(roomId);

    console.log(`Socket ${socket.id} joined room ${roomId}`);

    // 1) Tell existing members that a new user joined
    socket.to(roomId).emit('user-joined', socket.id);

    // 2) Send back a list of all other participants to the new user
    const otherUsers = Array.from(rooms[roomId]).filter((id) => id !== socket.id);
    io.to(socket.id).emit('all-users', otherUsers);
  });

  // --- WebRTC offers, answers, and ICE candidates ---
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

  // --- Handle user disconnecting ---
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Remove from whichever room(s) the socket was in
    for (let roomId in rooms) {
      if (rooms[roomId].has(socket.id)) {
        rooms[roomId].delete(socket.id);
        // Notify other members in that room
        socket.to(roomId).emit('user-left', socket.id);
      }
    }
  });
});

// ====== Start the Server ======
const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
