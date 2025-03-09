// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // During development, allow all origins
});

// Listen for new connections
io.on('connection', (socket) => {
  console.log('New client:', socket.id);

  // User joins a specific "room" (e.g. "room1"), so we can have multiple separate calls
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`${socket.id} joined room ${roomId}`);
    // Notify others in the room
    socket.to(roomId).emit('user-joined', socket.id);
  });

  // Relay "offer", "answer", and "ice-candidate" to the correct peer
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      sdp: data.sdp,
      caller: data.caller
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.caller).emit('answer', {
      sdp: data.sdp,
      answerer: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  // If a user hangs up, we can notify others
  socket.on('hang-up', (roomId) => {
    socket.to(roomId).emit('user-hung-up', socket.id);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server on port 5050 (or your choice)
const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`Signaling server running on http://localhost:${PORT}`);
});
