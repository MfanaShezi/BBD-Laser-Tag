const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const PORT = 3000;

const path = require('path');

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/player', (req, res) => {
  res.sendFile(__dirname + '/playerView.html');
});

app.get('/spectator', (req, res) => {
  res.sendFile(__dirname + '/spectatorView.html');
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Receive frame from sender
  socket.on('frame', (data) => {
    // Broadcast to all viewers except sender
    socket.broadcast.emit('frame', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});

// app.use(express.static(path.join(__dirname, 'public'))); // serve files from /public

// app.listen(PORT, () => {
//   const os = require('os');
//   const interfaces = os.networkInterfaces();
//   let localIP;

//   for (const iface of Object.values(interfaces)) {
//     for (const config of iface) {
//       if (config.family === 'IPv4' && !config.internal) {
//         localIP = config.address;
//       }
//     }
//   }

//   console.log(`Server running at http://${localIP}:${PORT}`);
// });