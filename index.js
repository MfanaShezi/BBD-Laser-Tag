const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
require('dotenv').config();
const Port = process.env.PORT || 3000;

// Import the routes
const gameRoutes = require('./routes/gameroutes.js');

// Use the routes
app.use('/', gameRoutes);



io.on('connection', (socket) => {
  console.log('a user connected');
});

console.log(Port)
server.listen(Port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${Port}`);
});


