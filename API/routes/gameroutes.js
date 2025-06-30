const express = require('express');
const router = express.Router();
const path = require('path');


// Serve the join page
router.get('/join', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/public', 'join.html')); 
    console.log(path.join(__dirname, '../../client/public', 'join.html'));
});

module.exports = router;