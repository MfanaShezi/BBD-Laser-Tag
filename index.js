const express = require('express');
const fs = require('fs');                   
const path = require('path');
const { Server } = require("socket.io");
const https = require('https');               

const app = express();
const PORT = 3000;

// mkcert-generated cert/key
const options = {
  key: fs.readFileSync(path.join(__dirname, '192.168.46.52-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '192.168.46.52.pem'))
};

app.get('/',       (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/player', (req, res) => res.sendFile(path.join(__dirname, 'playerView.html')));
app.get('/spectator', (req, res) => res.sendFile(path.join(__dirname, 'spectatorView.html')));


const server = https.createServer(options, app);

// Attach Socket.IO to the HTTPS server
const io = new Server(server);

// Socket.IO logic
io.on('connection', socket => {
  console.log('Client connected:', socket.id);

  socket.on('frame', data => {
    socket.broadcast.emit('frame', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start listening
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTPS + Socket.IO server running at https://localhost:${PORT}`);
});
