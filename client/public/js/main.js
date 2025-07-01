// Connect to the server
const socket = io();
let currentPlayer = {
    id: null,
    name: '',
    score: 0
};


let video = null;
let canvasOutput = null;
let canvasProcessing = null; 
let streaming = false;
let detector = null;

// Check if running in secure context (needed for camera access)
function checkSecureContext() {
    // Check if we're in a secure context
    if (window.isSecureContext === false) {
        console.warn('Not in secure context - camera access may be restricted');
        showDebugOverlay(`⚠️ Warning: Not in secure context (using HTTP).<br>
                        Most modern browsers require HTTPS for camera access.<br>
                        Current protocol: ${window.location.protocol}`);
        return false;
    }
    return true;
}

function onLoad() {
    // Create AR detector with ARUCO_MIP_36h12 dictionary (better detection than standard ARUCO)
    detector = new AR.Detector({ 
        dictionaryName: 'ARUCO_MIP_36h12',
        maxHammingDistance: 7 // Balance between detection accuracy and sensitivity
    });

    checkSecureContext();
    
    startCamera();
}


function startCamera() {
    console.log('Starting camera...');
    video = document.getElementById('videoInput');
    canvasOutput = document.getElementById('canvasOutput');
    
    // Create hidden canvas for processing
    canvasProcessing = document.createElement('canvas');
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then(function(stream) {
            video.srcObject = stream;
            video.play();
        })
        .catch(function(err) {
            // document.getElementById('status').innerHTML = 'Camera error: ' + err.message;
        });
    
    video.addEventListener('canplay', function() {
        if (!streaming) {
            // Set video and canvas dimensions
            const width = Math.min(640, video.videoWidth);
            const height = Math.min(480, video.videoHeight);
            
            video.setAttribute('width', width);
            video.setAttribute('height', height);
            canvasOutput.setAttribute('width', width);
            canvasOutput.setAttribute('height', height);
            canvasProcessing.width = width;
            canvasProcessing.height = height;
            
            streaming = true;
            setTimeout(processVideo, 1000); // Start processing after a short delay
        }
    });
}



function processVideo() {
    try {
        if (!streaming) return;
        
        let begin = Date.now();
        
        // Get the context for both canvases
        const ctxProcessing = canvasProcessing.getContext('2d');
        const ctxOutput = canvasOutput.getContext('2d');
        
        // Draw the video frame to the processing canvas
        ctxProcessing.drawImage(video, 0, 0, canvasProcessing.width, canvasProcessing.height);
        
        // FIRST draw the video frame to the output canvas
        ctxOutput.drawImage(video, 0, 0, canvasOutput.width, canvasOutput.height);
        
        // Get the image data for marker detection
        const imageData = ctxProcessing.getImageData(0, 0, canvasProcessing.width, canvasProcessing.height);
        
        // THEN detect and draw markers ON TOP of the video frame
        try {
            const markers = detector.detect(imageData);
            
            if (markers && markers.length > 0) {
                console.log(`Detected ${markers.length} markers`);
                processDetectedMarkers(markers, ctxOutput);
            } else {
            }
        } catch (detectErr) {
            console.error("Detection error:", detectErr);
        }
        
        // Calculate and schedule next frame
        let delay = 1000 / 30 - (Date.now() - begin);
        setTimeout(processVideo, delay > 0 ? delay : 0);
        } catch (err) {
            console.error(err);
    }
}

    // Helper function to process detected markers
function processDetectedMarkers(markers, ctxOutput) {
    if (markers.length > 0) {
        // Draw detected markers
        markers.forEach(marker => {
            // Draw marker outline
            drawMarker(ctxOutput, marker);
            
            // Calculate center of marker
            const center = getMarkerCenter(marker);
            
            // Use different colors based on marker ID
            const colorHue = (marker.id * 30) % 360;
            const color = hsvToRgb(colorHue / 360, 1, 1);
            
            // Draw marker ID
            ctxOutput.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
            ctxOutput.font = '20px Arial';
            ctxOutput.fillText(`ID: ${marker.id}`, center.x - 20, center.y - 15);
            
            // Get additional info based on marker ID
            // const info = getMarkerInfo(marker.id);
            // if (info) {
            //     ctxOutput.font = '16px Arial';
            //     ctxOutput.fillText(info, center.x - 30, center.y + 30);
            // }
        });
        
        // document.getElementById('status').innerHTML = `Detected ${markers.length} marker(s)`;
    }
}

// Helper function to convert HSV to RGB (keep your existing function)
function hsvToRgb(h, s, v) {
    let r, g, b;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

// Helper function to draw a marker
function drawMarker(ctx, marker) {
    // Use different colors for different marker IDs
    const colorHue = (marker.id * 30) % 360;
    const color = hsvToRgb(colorHue / 360, 1, 1);
    const strokeColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
    
    // Draw the outline with thicker lines for better visibility
    ctx.lineWidth = 4;
    ctx.strokeStyle = strokeColor;
    
    ctx.beginPath();
    
    // Connect the corners of the marker
    ctx.moveTo(marker.corners[0].x, marker.corners[0].y);
    for (let i = 1; i < marker.corners.length; i++) {
        ctx.lineTo(marker.corners[i].x, marker.corners[i].y);
    }
    
    // Connect back to the first corner
    ctx.lineTo(marker.corners[0].x, marker.corners[0].y);
    
    ctx.stroke();
    ctx.closePath();
    
    // Add corner dots for better visualization
    ctx.fillStyle = strokeColor;
    marker.corners.forEach(corner => {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 4, 0, 2 * Math.PI);
        ctx.fill();
    });
}

// Helper function to calculate marker center
function getMarkerCenter(marker) {
    let sumX = 0;
    let sumY = 0;
    
    for (let i = 0; i < marker.corners.length; i++) {
        sumX += marker.corners[i].x;
        sumY += marker.corners[i].y;
    }
    
    return {
        x: Math.floor(sumX / marker.corners.length),
        y: Math.floor(sumY / marker.corners.length)
    };
}

// // Helper function to get additional information for specific marker IDs
// function getMarkerInfo(markerId) {
//     // You can customize this with your own marker meanings
//     const markerInfo = {
//         0: "Robot Start Position",
//         1: "Navigation Point A",
//         2: "Navigation Point B",
//         3: "Goal Location",
//         4: "Obstacle",
//         // Add more marker IDs and their meanings as needed
//     };
    
//     return markerInfo[markerId] || "Custom Marker";
// }






//////////////////////////////////////////////////////////////////////////////////// Unknow??n







// Handle shoot button click
shootBtn.addEventListener('click', function() {
    if (currentTarget) {
        // Visual feedback
        shootBtn.classList.add('active');
        setTimeout(() => shootBtn.classList.remove('active'), 200);
        
        // Play sound effect
        playLaserSound();
        
        // Send hit event to server
        socket.emit('hit', currentTarget.playerId);
        
        // Show hit confirmation
        showHitConfirmation(currentTarget.center.x, currentTarget.center.y);
        
        statusMessage.textContent = `Shot fired at player ${currentTarget.playerId}!`;
    } else {
        statusMessage.textContent = 'No target detected!';
    }
});

// Sound effects
const sounds = {
    laser: new Audio('sound/laser.mp3'),
    hit: new Audio('sound/hit.mp3')
};

// Preload and configure sounds
sounds.laser.volume = 0.4;
sounds.hit.volume = 0.6;

// Play laser sound effect
function playLaserSound() {
    // Clone the audio to allow for rapid firing
    const sound = sounds.laser.cloneNode();
    sound.play().catch(e => console.log('Sound play error:', e));
}

// Play hit sound effect
function playHitSound() {
    // Clone the audio to allow for overlapping sounds
    const sound = sounds.hit.cloneNode();
    sound.play().catch(e => console.log('Sound play error:', e));
}

// Show hit confirmation animation
function showHitConfirmation(x, y) {
    const hitEffect = document.createElement('div');
    hitEffect.className = 'hit-effect';
    hitEffect.style.left = `${x}px`;
    hitEffect.style.top = `${y}px`;
    targetingOverlay.appendChild(hitEffect);
    
    // Add animation
    const animation = document.createElement('div');
    animation.className = 'hit-animation';
    hitEffect.appendChild(animation);
    
    // Remove after animation completes
    setTimeout(() => {
        if (hitEffect.parentNode) {
            targetingOverlay.removeChild(hitEffect);
        }
    }, 800);
}






// Set player name
setNameBtn.addEventListener('click', function() {
    const name = playerNameInput.value.trim();
    if (name) {
        socket.emit('setName', name);
        currentPlayer.name = name;
        statusMessage.textContent = `Name set to: ${name}`;
    }
});

// Team selection handlers
joinRedBtn.addEventListener('click', function() {
    socket.emit('joinTeam', 'red');
});

joinBlueBtn.addEventListener('click', function() {
    socket.emit('joinTeam', 'blue');
});

// Format time as MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Socket event handlers
socket.on('connect', function() {
    currentPlayer.id = socket.id;
    statusMessage.textContent = 'Connected to server!';
});

socket.on('gameState', function(state) {
    gameMode = state.mode;
    gameActive = state.active;
    timeRemaining = state.timeRemaining;
    
    // Update UI based on game state
    timeDisplay.textContent = formatTime(timeRemaining);
    
    if (gameActive) {
        statusMessage.textContent = `Game in progress (${gameMode} mode)`;
        gameTimer.style.display = 'block';
    } else {
        statusMessage.textContent = 'Waiting for game to start';
        gameTimer.style.display = 'none';
    }
    
    // Show/hide team selection based on game mode
    teamSelection.style.display = gameMode === 'team' ? 'flex' : 'none';
});

socket.on('teamAssigned', function(teamName) {
    playerTeam = teamName;
    statusMessage.textContent = `Joined ${teamName} team`;
    
    // Update UI for team
    document.body.className = ''; // Clear any existing classes
    document.body.classList.add(`team-${teamName}`);
    
    // Update team buttons
    joinRedBtn.disabled = (teamName === 'red');
    joinBlueBtn.disabled = (teamName === 'blue');
});

socket.on('playerList', function(players) {
    // Update current player info
    const player = players.find(p => p.id === currentPlayer.id);
    if (player) {
        currentPlayer = player;
        playerScore.textContent = `Score: ${currentPlayer.score}`;
        isPlayerActive = player.isActive;
        
        if (!player.isActive) {
            shootBtn.disabled = true;
        } else {
            shootBtn.disabled = false;
        }
    }
    
    // Update player list
    playersList.innerHTML = '';
    players.forEach(player => {
        const li = document.createElement('li');
        
        // Add team indicator if in team mode
        let playerText = `${player.name}: ${player.score}`;
        if (player.team) {
            playerText = `[${player.team.toUpperCase()}] ${playerText}`;
            li.classList.add(`team-${player.team}`);
        }
        
        // Add inactive indicator
        if (!player.isActive) {
            playerText += ' (respawning)';
            li.classList.add('inactive');
        }
        
        li.textContent = playerText;
        
        // Highlight current player
        if (player.id === currentPlayer.id) {
            li.style.fontWeight = 'bold';
        }
        
        playersList.appendChild(li);
    });
    
    // Map marker IDs to player IDs
    if (detectedMarkers.length > 0 && players.length > 0) {
        detectedMarkers.forEach(marker => {
            // This is where we'd match marker IDs to player IDs
            // For now, we're just using a simple mapping
            const playerIndex = parseInt(marker.id) % players.length;
            const playerArray = Array.from(players.values());
            marker.playerId = playerArray[playerIndex].id;
            marker.playerTeam = playerArray[playerIndex].team;
        });
    }
});

socket.on('playerHit', function(data) {
    if (data.shooter === currentPlayer.id) {
        statusMessage.textContent = 'Hit confirmed!';
        playHitSound();
        
        // Update the score immediately for better UX
        currentPlayer.score += 1;
        playerScore.textContent = `Score: ${currentPlayer.score}`;
    } else if (data.target === currentPlayer.id) {
        statusMessage.textContent = 'You were hit!';
        playHitSound();
        
        // Add visual feedback for being hit
        document.body.classList.add('hit');
        setTimeout(() => document.body.classList.remove('hit'), 1000);
        
        // Show respawn overlay if not in freeplay mode
        if (gameMode !== 'freeplay') {
            isPlayerActive = false;
            respawnOverlay.classList.add('active');
            shootBtn.disabled = true;
            
            // Start respawn countdown
            let respawnTime = 5; // This should match the server's respawnTime
            respawnCounter.textContent = respawnTime;
            
            const respawnInterval = setInterval(() => {
                respawnTime--;
                respawnCounter.textContent = respawnTime;
                
                if (respawnTime <= 0) {
                    clearInterval(respawnInterval);
                }
            }, 1000);
        }
        
        // Vibrate the device if browser supports it
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 200]);
        }
    }
});

socket.on('respawned', function() {
    isPlayerActive = true;
    respawnOverlay.classList.remove('active');
    shootBtn.disabled = false;
    statusMessage.textContent = 'You have respawned!';
});

socket.on('teamUpdate', function(teamData) {
    // Update team scores if we're in team mode
    if (gameMode === 'team') {
        const redScore = teamData.red.score;
        const blueScore = teamData.blue.score;
        
        // In a real game, you'd show this on a scoreboard
        statusMessage.textContent = `Red: ${redScore} - Blue: ${blueScore}`;
    }
});

socket.on('timeUpdate', function(seconds) {
    timeRemaining = seconds;
    timeDisplay.textContent = formatTime(seconds);
});

socket.on('gameStarted', function(data) {
    gameMode = data.mode;
    gameActive = true;
    timeRemaining = data.timeRemaining;
    
    // Show/hide team selection
    teamSelection.style.display = gameMode === 'team' ? 'flex' : 'none';
    
    // Show game timer
    gameTimer.style.display = 'block';
    timeDisplay.textContent = formatTime(timeRemaining);
    
    statusMessage.textContent = `Game started! (${gameMode} mode)`;
});

socket.on('gameEnded', function(data) {
    gameActive = false;
    
    let resultMessage = 'Game Over! ';
    
    if (data.mode === 'team') {
        if (data.winner === 'tie') {
            resultMessage += "It's a tie!";
        } else {
            resultMessage += `Team ${data.winner.toUpperCase()} wins!`;
        }
        resultMessage += ` Final Score: Red ${data.teamScores.red} - Blue ${data.teamScores.blue}`;
    } else {
        if (data.topPlayers.length > 0) {
            resultMessage += `Winner: ${data.topPlayers[0].name} with ${data.topPlayers[0].score} points!`;
        }
    }
    
    statusMessage.textContent = resultMessage;
});
