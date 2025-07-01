import { fileURLToPath } from 'url'; // Import fileURLToPath from 'url'
import express from 'express';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import https from 'https';

// Serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// mkcert-generated cert/key
const options = {
  key: fs.readFileSync(path.join(__dirname, '192.168.46.52-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '192.168.46.52.pem'))
};

const app = express();

app.use(express.json());

app.use(express.static(path.join(__dirname, '../client')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../client/public/playerCreation.html')));
app.get('/room', (req, res) => res.sendFile(path.join(__dirname, '../client/public/room.html')));

const server = https.createServer(options, app);

// Attach Socket.IO to the HTTPS server
const io = new Server(server);

let players = {};

// Socket.IO logic
io.on('connection', socket => {
    console.log('Client connected:', socket.id);

    socket.on('requestPlayerId', (data) => {
        let playerId = Date.now().toString();

        console.log("Player Id: " + playerId);

        players[playerId] = {
            name: data.playerName
        }

        console.log(players);
        socket.emit("sendPlayerId", {playerId: playerId});
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});