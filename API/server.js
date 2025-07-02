import path from 'path';
import { fileURLToPath } from 'url'; // Ensure this is imported only once
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import os from 'os';
import QRCode from 'qrcode';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config();

const PORT = process.env.PORT || 3000;

// Initialize Express app
const app = express();

// Serve static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../client/public')));

// Create HTTP server and WebSocket server
const httpServer = createServer(app);
const io = new Server(httpServer);

// Data structures
let rooms = {};
let players = {};

//routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../client/public/index.html')));
app.get('/playerCreation', (req, res) => res.sendFile(path.join(__dirname, '../client/public/playerCreation.html')));
app.get('/room', (req, res) => res.sendFile(path.join(__dirname, '../client/public/room.html')));
app.get('/player', (req, res) => res.sendFile(path.join(__dirname, '../client/public/joinRoomAsPlayer.html')));
app.get('/spectator', (req, res) => res.sendFile(path.join(__dirname, '../client/public/joinRoomAsSpectator.html')));
app.get('/lobby', (req, res) => res.sendFile(path.join(__dirname, '../client/public/lobby.html')));

// WebSocket logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle room creation
    socket.on('createRoom', ({ mode, name }) => {
        if (!mode || !name) {
            socket.emit('roomError', 'Room name and mode are required.');
            return;
        }

        const roomId = (Math.random() + 1).toString(36).substring(2);
        rooms[roomId] = { id: roomId, name, mode, players: [], spectators: [], numReady: 0 };

        console.log(`Room created: ${name} (ID: ${roomId}, Mode: ${mode})`);
        socket.emit('roomCreated', rooms[roomId]);
        io.emit('roomList', Object.values(rooms));
    });

    socket.on("joinRoom", (data) => {
        rooms[data.roomId].players.push(data.playerId);

        io.emit("sendRoomInfo", {room: rooms[data.roomId], players: players});
    });

    socket.on("spectateRoom", (data) => {
        rooms[data.roomId].spectators.push(data.spectatorId);

        io.emit("sendRoomInfo", {room: rooms[data.roomId], players: players});
    });

    // Handle fetching rooms
    socket.on('getRooms', () => {
        socket.emit('roomList', Object.values(rooms));
        console.log('Rooms sent to client:', Object.values(rooms));
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);
    });

    socket.on("playerReady", (data) => {
        io.emit("playerReadyServer", data);
        rooms[data.roomId].numReady++;
        if (rooms[data.roomId].numReady == rooms[data.roomId].players.length) {
            io.emit("allPlayersReady", ({roomId: data.roomId}));
        }
    });

    socket.on("playerUnready", (data) => {
        io.emit("playerUnreadyServer", data);
        rooms[data.roomId].numReady--;
    });

    //Player logic 

    socket.on('requestPlayerId', (data) => {
        let playerId = Date.now().toString();

        console.log("Player Id: " + playerId);

        players[playerId] = {
            name: data.playerName
        }

        console.log(players);
        socket.emit("sendPlayerId", {playerId: playerId});
    });

    socket.on("requestRoomInfo", (data) => {
        // console.log("All Rooms");
        // console.log(rooms);
        // console.log("Data");
        // console.log(data);
        // console.log("room roomId");
        // console.log(rooms[data.roomId]);
        socket.emit("sendRoomInfo", {room: rooms[data.roomId], players: players});
    });
});

// Start the server
httpServer.listen(PORT, () => {
    const ip = getLocalIP();
    const url = `http://${ip}:${PORT}`;

    console.log(`Server is running on http://localhost:${PORT}`);

    // Generate QR code for the URL
    generateQRCode(url);
    // Also create a text file with the URL for easy sharing
    fs.writeFileSync(path.join(__dirname, 'game-url.txt'), url);
});

// Find the server's local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface in interfaces) {
    for (const details of interfaces[iface]) {
      // Skip over non-IPv4 and internal (loopback) addresses
      if (details.family === 'IPv4' && !details.internal) {
        return details.address;
      }
    }
  }
  return '127.0.0.1'; // Default to localhost if no external IP found
}

// Generate QR code for easy access
function generateQRCode(url) {
  const qrPath = path.join(__dirname, 'qr.png');
  
  QRCode.toFile(qrPath, url, {
    errorCorrectionLevel: 'H',
    margin: 1,
    scale: 8,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  }, (err) => {
    if (err) {
      console.error('Error generating QR code:', err);
    } else {
      console.log('QR code generated successfully at /qr.png');
    }
  });

  // Also generate the QR code as a data URL for console display
  QRCode.toString(url, {
    type: 'terminal',
    errorCorrectionLevel: 'L',
    small: true
  }, (err, qrString) => {
    if (!err) {
      console.log('\nScan this QR code to join the game:');
      console.log(qrString);
    }
  });
}