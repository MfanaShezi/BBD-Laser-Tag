const express = require('express');
const https = require('https');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode'); // Ensure you have the 'qrcode' package installed
const QRCodeTerminal = require('qrcode-terminal'); // Import qrcode-terminal
const os = require('os'); 
require('dotenv').config();

// Load mkcert certificates
const options = {
    key: fs.readFileSync(path.join(__dirname, '192.168.46.52-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '192.168.46.52.pem'))
};

// Initialize our express app
const app = express();
const server = https.createServer(options, app);
const io = socketIO(server);

// Import routes
const gameRoutes = require('./routes/gameroutes');
app.use('/', gameRoutes);

// Middleware
app.use(express.static(path.join(__dirname, '../client/public')));
app.use('/markers', express.static(path.join(__dirname, '../client/markers')));

// Game configuration and state
const gameConfig = { mode: 'freeplay', respawnTime: 5, gameTime: 300, teams: ['red', 'blue'] };
const players = new Map();
const teams = {
    red: { score: 0, players: new Set() },
    blue: { score: 0, players: new Set() }
};

// Import and initialize Socket.IO handlers
const socketHandlers = require('./socketHandlers');
socketHandlers(io, gameConfig, players, teams);

// Function to generate and save the QR code, and display it in the terminal
function generateQRCode(url) {
    const qrCodePath = path.join(__dirname, '../client/public/qr.png'); // Adjust path as needed

    // Save the QR code to a file
    QRCode.toFile(qrCodePath, url, (err) => {
        if (err) {
            console.error('Error generating QR code:', err);
        } else {
            console.log(`QR code saved to ${qrCodePath}`);
        }
    });

    // Display the QR code in the terminal
    QRCodeTerminal.generate(url, { small: true }, (qrcode) => {
        console.log('Scan this QR code to join the game:');
        console.log(qrcode);
    });
}

// Example usage: Generate a QR code for the game URL

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

const PORT = process.env.PORT || 3000;
const ip = getLocalIP(); // Replace with your logic to get the local IP address
console.log(ip);
const gameUrl = `https://${ip}:${PORT}/room`;

generateQRCode(gameUrl);

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on https://localhost:${PORT}`);
});
