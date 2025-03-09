// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',  // In development, allow all
  },
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // 1) When a user joins, they tell the server which "room" they want to join
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);

    // Notify existing clients in this room that a new user joined
    socket.to(roomId).emit('user-joined', socket.id);
  });

  // 2) Handle an offer
  socket.on('offer', (payload) => {
    console.log('Offer from:', payload.caller, 'to:', payload.target);
    io.to(payload.target).emit('offer', {
      sdp: payload.sdp,
      caller: payload.caller,
    });
  });

  // 3) Handle an answer
  socket.on('answer', (payload) => {
    console.log('Answer from:', socket.id, 'to:', payload.caller);
    io.to(payload.caller).emit('answer', {
      sdp: payload.sdp,
      answerer: socket.id,
    });
  });

  // 4) ICE candidates
  socket.on('ice-candidate', (incoming) => {
    console.log('ICE candidate from:', socket.id, 'to:', incoming.target);
    io.to(incoming.target).emit('ice-candidate', {
      candidate: incoming.candidate,
      from: socket.id,
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // Could broadcast 'user-left' if you want to remove the video on others
  });
});

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
