const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // npm install node-fetch (for Node <18)
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
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
const rooms = new Map();

// ====== Socket.IO Signaling ======
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    // Leave previous room if any
    const currentRoom = [...socket.rooms].find(room => room !== socket.id);
    if (currentRoom) {
      socket.leave(currentRoom);
    }

    // Join new room
    socket.join(roomId);
    
    // Get all users in the room except the current user
    const usersInRoom = Array.from(io.sockets.adapter.rooms.get(roomId) || [])
      .filter(id => id !== socket.id);

    // Notify others in the room
    socket.to(roomId).emit('user-joined', socket.id);
    
    // Store room information
    rooms.set(socket.id, roomId);
  });

  socket.on('offer', ({ target, sdp }) => {
    socket.to(target).emit('offer', {
      sdp,
      caller: socket.id
    });
  });

  socket.on('answer', ({ caller, sdp }) => {
    socket.to(caller).emit('answer', {
      sdp,
      answerer: socket.id
    });
  });

  socket.on('ice-candidate', ({ target, candidate }) => {
    socket.to(target).emit('ice-candidate', {
      candidate,
      from: socket.id
    });
  });

  socket.on('disconnect', () => {
    const roomId = rooms.get(socket.id);
    if (roomId) {
      socket.to(roomId).emit('user-left', socket.id);
      rooms.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

// ====== Start the Server ======
const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
