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
import { start } from 'repl';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nonPlayerQrs = {10: 'respawn', 11: 'respawn', 12: 'respawn', 13: 'respawn', 14: 'mysteryBox', 15: 'mysteryBox', 16: 'mysteryBox', 17: 'mysteryBox', 18: 'mysteryBox', 19: 'mysteryBox'};
const killsForWin = 3;
const startHealth = 5; // Default health for players

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
        rooms[roomId] = { id: roomId, name, mode, players: {}, spectators: {}, qrsUsed: [], numReady: 0 , ended: false};

        console.log(`Room created: ${name} (ID: ${roomId}, Mode: ${mode})`);
        socket.emit('roomCreated', rooms[roomId]);
        io.emit('roomList', Object.values(rooms));
    });

    socket.on("joinRoom", (data) => {
        // Initialize players object if it doesn't exist
        if (!rooms[data.roomId].players) {
            rooms[data.roomId].players = {};
        }
        
        // Check if player exists, create if not
        if (!players[data.playerId]) {
            players[data.playerId] = {
                id: data.playerId,
                name: data.playerName || 'Player_' + data.playerId.substring(0, 5),
                health: startHealth,
                qrId: null,
                roomId: null,
                kills: 0,
                deaths: 0,
                damage: 1
            };
        }
    
      
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
            health: startHealth,
            qrId: null,
            roomId: null,
            // score: 0,
            kills: 0,
            deaths: 0,
            damage:1
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
      const playerHitId = data.playerHitId;
      const playerShootingId = data.playerShootingId;
      const roomId = data.roomId;
      console.log(`Player ${playerShootingId} hit player ${playerHitId} in room ${roomId}`);
      if (nonPlayerQrs[playerHitId] === 'respawn') {
        if (rooms[roomId].players[playerShootingId].health <= 0) {
          rooms[roomId].players[playerShootingId].health = startHealth;
          rooms[roomId].players[playerShootingId].damage = 1; // Reset QR ID on respawn
        }
      } else if (nonPlayerQrs[playerHitId] === 'mysteryBox') {
          if (rooms[roomId].players[playerShootingId].health > 0) { 
          // Apply random effect to the player who shot the mystery box
            const result = mysteryBoxEffect(rooms[roomId].players[playerShootingId], roomId);
            
            // Notify all clients about the mystery box effect
            io.emit("mysteryBoxHit", {
                playerId: playerShootingId,
                playerName: rooms[roomId].players[playerShootingId].name,
                effect: result.effect,
                message: result.message,
                roomId: roomId
            });
            
            console.log(`Mystery box effect: ${result.message} for player ${rooms[roomId].players[playerShootingId].name}`);
          }
      } else {
        // console.log(rooms);
        if (rooms[roomId].players[playerHitId].health <= 0) {
          rooms[roomId].players[playerHitId].health = 0;
        } else {
          rooms[roomId].players[playerHitId].health -= rooms[roomId].players[playerShootingId].damage;
          if (rooms[roomId].players[playerHitId].health <= 0) {
            rooms[roomId].players[playerHitId].health = 0;
            if (playerHitId !== playerShootingId) {
              rooms[roomId].players[playerShootingId].kills += 1;
            }
            rooms[roomId].players[playerHitId].deaths += 1;
          }

          if (rooms[roomId].players[playerShootingId].kills >= killsForWin) {
            io.emit("gameOver", {
              winner: rooms[roomId].players[playerShootingId],
              roomId: roomId
            });
            rooms[roomId].ended = true;
            io.emit("sendRoomInfo", rooms[roomId]);
          }
        }
      }

      socket.on("hitFrame", (data) => {
        io.emit("hitFrameFromServer", data);
      });

      io.emit("sendRoomInfo", rooms[roomId]);
    });

    socket.on("nukeRoom", (roomId) => {
      console.log("Nuking room:", roomId);
      delete rooms[roomId];
      for (const playerId in players) {
        if (players[playerId].roomId === roomId) {
          delete players[playerId];
        }
      }
      io.emit("nukeRoom", roomId);
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

// Add this function at the top level of your server.js file
function mysteryBoxEffect(player, roomId) {
    // Generate a random number between 0 and 3 to select an effect
    const effect = Math.floor(Math.random() * 4);
    
    let effectMessage = "";
    
    switch (effect) {
        case 0: // Lose 1 health
            player.health = Math.max(1, player.health - 1); // Don't let health drop below 1
            effectMessage = "Lost 1 health";
            break;
            
        case 1: // Gain 1 health
            player.health = Math.min(startHealth, player.health + 1); // Don't exceed max health
            effectMessage = "Gained 1 health";
            break;
            
        case 2: // Halve damage
            player.damage = Math.max(0.25, player.damage / 2); // Minimum 0.5 damage
            effectMessage = "Damage halved";
            break;
            
        case 3: // Double damage
            player.damage = Math.min(8, player.damage * 2); // Maximum 4x damage
            effectMessage = "Damage doubled";
            break;
    }
    
    return {
        player: player,
        effect: effect,
        message: effectMessage
    };
}