const express = require('express');
const path = require('path');
const router = express.Router();

// Route for the main index page
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Route for the player view
router.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/playerview.html'));
});

// Route for the room view
router.get('/room', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/room.html'));
});

module.exports = router;