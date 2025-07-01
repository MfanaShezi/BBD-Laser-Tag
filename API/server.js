import path from 'path';
import { fileURLToPath } from 'url'; // Ensure this is imported only once
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

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
        rooms[roomId] = { id: roomId, name, mode, players: [], spectators: [] };

        console.log(`Room created: ${name} (ID: ${roomId}, Mode: ${mode})`);
        socket.emit('roomCreated', rooms[roomId]);
        io.emit('roomList', Object.values(rooms));
    });

    socket.on("joinRoom", (data) => {
        rooms[data.roomId].players.push(data.playerId);
    });

    socket.on("spectateRoom", (data) => {
        rooms[data.roomId].spectators.push(data.spectatorId);
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
    console.log(`Server is running on http://localhost:${PORT}`);
});