const express = require('express');
const https = require('https');
const socketIO = require('socket.io');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const fs = require('fs');
require('dotenv').config();

// Load mkcert certificates
const options = {
    key: fs.readFileSync(path.join(__dirname, '192.168.46.52-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '192.168.46.52.pem'))
};

// Initialize our express app
const app = express();
const server = https.createServer(options, app); // Use HTTPS here
const io = socketIO(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/markers', express.static(path.join(__dirname, 'markers')));

// Game configuration and state remain unchanged
const gameConfig = { mode: 'freeplay', respawnTime: 5, gameTime: 300, teams: ['red', 'blue'] };
let gameActive = false;
let gameTimer = null;
let timeRemaining = gameConfig.gameTime;
const players = new Map();
const teams = { red: { score: 0, players: new Set() }, blue: { score: 0, players: new Set() } };

// Socket.IO game logic remains unchanged
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    players.set(socket.id, { id: socket.id, name: `Player ${players.size + 1}`, score: 0, lastHit: null, team: null, isActive: true, respawnTime: 0 });

    socket.emit('gameState', {
        mode: gameConfig.mode,
        active: gameActive,
        timeRemaining: timeRemaining,
        teams: {
            red: { score: teams.red.score, playerCount: teams.red.players.size },
            blue: { score: teams.blue.score, playerCount: teams.blue.players.size }
        }
    });

    io.emit('playerList', Array.from(players.values()));

    socket.on('setName', (name) => {
        const player = players.get(socket.id);
        if (player) {
            player.name = name;
            io.emit('playerList', Array.from(players.values()));
        }
    });

    socket.on('joinTeam', (teamName) => {
        if (!teams[teamName]) return;
        const player = players.get(socket.id);
        if (player) {
            if (player.team && teams[player.team]) teams[player.team].players.delete(socket.id);
            player.team = teamName;
            teams[teamName].players.add(socket.id);
            socket.emit('teamAssigned', teamName);
            io.emit('playerList', Array.from(players.values()));
            io.emit('teamUpdate', {
                red: { score: teams.red.score, playerCount: teams.red.players.size },
                blue: { score: teams.blue.score, playerCount: teams.blue.players.size }
            });
        }
    });

    socket.on('hit', (targetId) => {
        const target = players.get(targetId);
        const shooter = players.get(socket.id);
        if (!target || !shooter || targetId === socket.id || !target.isActive || !shooter.isActive) return;
        if (gameConfig.mode === 'team' && target.team === shooter.team) return;

        shooter.score += 1;
        target.lastHit = shooter.id;

        if (gameConfig.mode === 'team' && shooter.team) teams[shooter.team].score += 1;

        if (gameConfig.mode !== 'freeplay') {
            target.isActive = false;
            target.respawnTime = gameConfig.respawnTime;

            setTimeout(() => {
                if (players.has(targetId)) {
                    const targetPlayer = players.get(targetId);
                    targetPlayer.isActive = true;
                    targetPlayer.respawnTime = 0;
                    io.to(targetId).emit('respawned');
                    io.emit('playerList', Array.from(players.values()));
                }
            }, gameConfig.respawnTime * 1000);
        }

        io.emit('playerHit', { shooter: shooter.id, target: targetId, shooterTeam: shooter.team, targetTeam: target.team });
        io.emit('playerList', Array.from(players.values()));

        if (gameConfig.mode === 'team') {
            io.emit('teamUpdate', {
                red: { score: teams.red.score, playerCount: teams.red.players.size },
                blue: { score: teams.blue.score, playerCount: teams.blue.players.size }
            });
        }
    });

    socket.on('startGame', (options = {}) => {
        if (options.mode) gameConfig.mode = options.mode;
        if (options.respawnTime) gameConfig.respawnTime = options.respawnTime;
        if (options.gameTime) gameConfig.gameTime = options.gameTime;

        timeRemaining = gameConfig.gameTime;
        gameActive = true;
        teams.red.score = 0;
        teams.blue.score = 0;

        if (gameTimer) clearInterval(gameTimer);
        gameTimer = setInterval(() => {
            timeRemaining--;
            if (timeRemaining % 5 === 0) io.emit('timeUpdate', timeRemaining);
            if (timeRemaining <= 0) endGame();
        }, 1000);

        io.emit('gameStarted', { mode: gameConfig.mode, timeRemaining });
    });

    socket.on('endGame', () => endGame());

    socket.on('resetScores', () => {
        players.forEach(player => { player.score = 0; });
        teams.red.score = 0;
        teams.blue.score = 0;
        io.emit('playerList', Array.from(players.values()));
        io.emit('teamUpdate', {
            red: { score: teams.red.score, playerCount: teams.red.players.size },
            blue: { score: teams.blue.score, playerCount: teams.blue.players.size }
        });
        io.emit('scoresReset');
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        const player = players.get(socket.id);
        if (player && player.team && teams[player.team]) teams[player.team].players.delete(socket.id);
        players.delete(socket.id);
        io.emit('playerList', Array.from(players.values()));
        io.emit('teamUpdate', {
            red: { score: teams.red.score, playerCount: teams.red.players.size },
            blue: { score: teams.blue.score, playerCount: teams.blue.players.size }
        });
    });
});

function endGame() {
    gameActive = false;
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = null;

    let winner = null;
    let topPlayers = [];

    if (gameConfig.mode === 'team') {
        winner = teams.red.score > teams.blue.score ? 'red' : teams.blue.score > teams.red.score ? 'blue' : 'tie';
    } else {
        topPlayers = Array.from(players.values()).sort((a, b) => b.score - a.score).slice(0, 3);
    }

    io.emit('gameEnded', {
        mode: gameConfig.mode,
        winner: winner,
        topPlayers: topPlayers,
        teamScores: { red: teams.red.score, blue: teams.blue.score }
    });
}

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

function generateQRCode(url) {
    const qrPath = path.join(__dirname, 'public', 'qr.png');

    QRCode.toFile(qrPath, url, { errorCorrectionLevel: 'H', margin: 1, scale: 8, color: { dark: '#000000', light: '#ffffff' } }, (err) => {
        if (err) console.error('Error generating QR code:', err);
        else console.log('QR code generated successfully at /qr.png');
    });

    QRCode.toString(url, { type: 'terminal', errorCorrectionLevel: 'L', small: true }, (err, qrString) => {
        if (!err) {
            console.log('\nScan this QR code to join the game:');
            console.log(qrString);
        }
    });
}

app.get('/join', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'join.html'));
});

// Start the HTTPS server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    const ip = getLocalIP();
    const url = `https://${ip}:${PORT}/join`;

    console.log(` HTTPS Server running on port ${PORT}`);
    console.log(` Local IP address: ${ip}`);
    console.log(`\nShare this URL with players: ${url}`);

    generateQRCode(url);
    fs.writeFileSync(path.join(__dirname, 'game-url.txt'), url);
});
