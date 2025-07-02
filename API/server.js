import path from 'path';
import { fileURLToPath } from 'url'; // Ensure this is imported only once
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import https from 'https';
import os from 'os';
import QRCode from 'qrcode';
import fs from 'fs';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nonPlayerQrs = {10: 'respawn', 11: 'mysteryBox'}
const killsForWin = 5;

// Load environment variables from .env file
dotenv.config();

// Load SSL certificate and private key
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, '192.168.46.52-key.pem')), 
  cert: fs.readFileSync(path.join(__dirname, '192.168.46.52.pem')), 
};

// Initialize Express app
const app = express();

const PORT = process.env.PORT || 3000;

// Create HTTPS server
const httpsServer = https.createServer(sslOptions, app);
const io = new Server(httpsServer);

// Serve static files
app.use(express.static(path.join(__dirname, '../client/public')));

// // Create HTTP server and WebSocket server
// const httpServer = createServer(app);
// const io = new Server(httpServer);

// Data structures
let rooms = {};
let players = {};

//routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../client/public/index.html')));
app.get('/playerCreation', (req, res) => res.sendFile(path.join(__dirname, '../client/public/playerCreation.html')));
app.get('/room', (req, res) => res.sendFile(path.join(__dirname, '../client/public/room.html')));
app.get('/player', (req, res) => res.sendFile(path.join(__dirname, '../client/public/JoinRoomAsPlayer.html')));
app.get('/spectator', (req, res) => res.sendFile(path.join(__dirname, '../client/public/JoinRoomAsSpectator.html')));
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
        rooms[roomId] = { id: roomId, name, mode, players: {}, spectators: {}, qrsUsed: [], numReady: 0 };

        console.log(`Room created: ${name} (ID: ${roomId}, Mode: ${mode})`);
        socket.emit('roomCreated', rooms[roomId]);
        io.emit('roomList', Object.values(rooms));
    });

    socket.on("joinRoom", (data) => {
        // rooms[data.roomId].players.push(data.playerId);
        rooms[data.roomId].players[data.playerId] = players[data.playerId];
        rooms[data.roomId].players[data.playerId].roomId = data.roomId;
        
        for (let i = 0; i < 200; i++) {
            // Bug 1: Using square brackets with includes (it's a method, not an array index)
            // Bug 2: Not checking if the QR ID is already in use properly
            if (!rooms[data.roomId].qrsUsed.includes(i)) {
                rooms[data.roomId].players[data.playerId].qrId = i;
                rooms[data.roomId].qrsUsed.push(i); // Bug 3: Using square brackets with push
                break;
            }
        }

        // emit the updated room info to all clients
        io.emit("sendRoomInfo", rooms[data.roomId])
    });

    socket.on("spectateRoom", (data) => {
        rooms[data.roomId].spectators[data.spectatorId] = players[data.spectatorId];
        rooms[data.roomId].spectators[data.spectatorId].roomId = data.roomId;

        io.emit("sendRoomInfo", rooms[data.roomId])
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
        if (rooms[data.roomId].numReady == Object.keys(rooms[data.roomId].players).length) {
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
            id: playerId,
            name: data.playerName,
            health: 5,
            qrId: null,
            roomId: null,
            score: 0,
            kills: 0
        }

        console.log(players);
        socket.emit("sendPlayerId", {playerId: playerId});
    });

    socket.on("requestRoomInfo", (data) => {
      console.log("Sending room info for room:", data.roomId);
      console.log("Room details:", rooms[data.roomId]);
      socket.emit("sendRoomInfo", rooms[data.roomId]);
    });

    socket.on("hit", (data) => {
      const playerHitId = data.playerHit.id;
      const playerShootingId = data.playerShootingId;
      const roomId = data.playerHit.roomId;
      if (nonPlayerQrs[data.playerHit.qrId] === 'respawn') {

      } else if (nonPlayerQrs[data.playerHit.qrId] === 'mysteryBox') {

      } else {
        // console.log(rooms);
        if (rooms[roomId].players[playerHitId].health <= 0) {
          rooms[roomId].players[playerHitId].health = 0;
        } else {
          rooms[roomId].players[playerHitId].health -= 1;
          if (playerHitId !== playerShootingId) {
            rooms[roomId].players[playerShootingId].kills += 1;
          }
          if (rooms[roomId].players[playerShootingId].kills >= killsForWin) {
            io.emit("gameOver", {
              winner: rooms[roomId].players[playerShootingId],
              roomId: roomId
            });
          }
        }
      }

      socket.on("hitFrame", (data) => {
        io.emit("hitFrameFromServer", data);
      });

      io.emit("sendRoomInfo", rooms[roomId]);
    });
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
      for (const details of iface) {
          if (details.family === 'IPv4' && !details.internal && details.address.startsWith('192.168.46.')) {
              return details.address;
          }
      }
  }
  return '127.0.0.1';
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

// Start the HTTPS server
httpsServer.listen(PORT, () => {
  const ip = getLocalIP();
  const url = `https://${ip}:${PORT}`;

  console.log(`Server is running https://localhost:${PORT}`);

  // Generate QR code for the HTTPS URL
  generateQRCode(url);

  // Also create a text file with the HTTPS URL for easy sharing
  fs.writeFileSync(path.join(__dirname, 'game-url.txt'), url);
});

// Start the HTTP server
// httpServer.listen(PORT, () => {
//   const ip = getLocalIP();
//   console.log(`Local IP Address: ${ip}`);
//   const url = `http://${ip}:${PORT}`;

//   console.log(`Server is running on http://localhost:${PORT}`);

//   // Generate QR code for the URL
//   generateQRCode(url);
//   // Also create a text file with the URL for easy sharing
//   fs.writeFileSync(path.join(__dirname, 'game-url.txt'), url);
// });
