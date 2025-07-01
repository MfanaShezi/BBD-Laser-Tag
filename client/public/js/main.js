// Connect to the server
const socket = io();
let currentPlayer = {
    id: null,
    name: '',
    score: 0,
    health: 3
};

let targetInCrosshair = null;


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
                targetInCrosshair = null;
            }
        } catch (detectErr) {
            console.error("Detection error:", detectErr);
        }

        // Draw crosshair in the center of the canvas
        drawCrosshair(ctxOutput);
        
        // Calculate and schedule next frame
        let delay = 1000 / 30 - (Date.now() - begin);
        setTimeout(processVideo, delay > 0 ? delay : 0);
        } catch (err) {
            console.error(err);
    }
}

// Helper function to draw crosshair in the center of the canvas
function drawCrosshair(ctx) {
    const centerX = canvasOutput.width / 2;
    const centerY = canvasOutput.height / 2;
    // const size = 20;
    const size = Math.min(canvasOutput.width, canvasOutput.height) * 0.05;
    
    ctx.lineWidth = 2;
    // Change color based on whether there's a target in crosshair
    if (targetInCrosshair) {
        // Red when over a marker
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    } else {
        // Black when not over a marker
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    }
    
    // Draw crosshair lines
    ctx.beginPath();
    // Horizontal line
    ctx.moveTo(centerX - size, centerY);
    ctx.lineTo(centerX + size, centerY);
    // Vertical line
    ctx.moveTo(centerX, centerY - size);
    ctx.lineTo(centerX, centerY + size);
    ctx.stroke();
    
    // Draw small circle in center
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
    ctx.stroke();
}

    // Helper function to process detected markers
function processDetectedMarkers(markers, ctxOutput) {
    if (markers.length > 0) {
        // Reset current target
        targetInCrosshair = null;

         // Center point of the canvas
        const centerX = canvasOutput.width / 2;
        const centerY = canvasOutput.height / 2;
        
        // Draw detected markers
        markers.forEach(marker => {
            // Draw marker outline
            drawMarker(ctxOutput, marker);
            
            // Calculate center of marker
            const center = getMarkerCenter(marker);
            
            // Use different colors based on marker ID
            const colorHue = (marker.id+1 * 30) % 360;
            const color = hsvToRgb(colorHue / 360, 1, 1);
            
            // Draw marker ID
            ctxOutput.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
            ctxOutput.font = '20px Arial';
            ctxOutput.fillText(`ID: ${marker.id}`, center.x - 20, center.y - 15);
            
            // Check if center point is inside this marker
            if (isPointInMarker({x: centerX, y: centerY}, marker)) {
                // Store the target marker if center is inside it
                targetInCrosshair = {
                    id: marker.id,
                    playerId: marker.playerId, // This should be set elsewhere in your code
                    playerTeam: marker.playerTeam, // This should be set elsewhere in your code
                    center: center
                };
                
                // Highlight the target marker
                ctxOutput.lineWidth = 6;
                ctxOutput.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                ctxOutput.strokeRect(
                    center.x - 30,
                    center.y - 30,
                    60,
                    60
                );
            }
        });
        
        // document.getElementById('status').innerHTML = `Detected ${markers.length} marker(s)`;
    }
}

// Helper function to check if a point is inside a marker
function isPointInMarker(point, marker, margin = 100) {
    // Implementation of point-in-polygon algorithm
    let inside = false;
    
    // Clone corners array and add first corner at the end to close the loop
    // const corners = [...enlargedCorners, enlargedCorners[0]];
    const corners = [...marker.corners, marker.corners[0]];
    
    for (let i = 0; i < corners.length - 1; i++) {
        const c1 = corners[i];
        const c2 = corners[i + 1];
        
        // Check if point is on a corner
        if ((point.x === c1.x && point.y === c1.y) || (point.x === c2.x && point.y === c2.y)) {
            return true;
        }
        
        // Check if point is between corners vertically
        if ((c1.y > point.y) !== (c2.y > point.y)) {
            // Calculate x-intersection of the line with horizontal line at point.y
            const xIntersection = (c2.x - c1.x) * (point.y - c1.y) / (c2.y - c1.y) + c1.x;
            
            // Check if point is on horizontal line and the x-intersection
            if (point.x === xIntersection) {
                return true;
            }
            
            // Check if point is to the left of the line
            if (point.x < xIntersection) {
                inside = !inside;
            }
        }
    }

    if (inside) {
        // Check if marker centre is inside crosshair corners
        return inside
    }

    // check if marker centre is inside croshshairCorners
    const center = getMarkerCenter(marker);

    const size = Math.min(canvasOutput.width, canvasOutput.height) * 0.07;

    // get crosshair corners 
    const crosshairCorners = [
        { x: point.x - size, y: point.y - size },
        { x: point.x + size, y: point.y - size },
        { x: point.x + size, y: point.y + size },
        { x: point.x - size, y: point.y + size },
        { x: point.x - size, y: point.y - size } ]

    for (let i = 0; i < crosshairCorners.length - 1; i++) {
        const c1 = crosshairCorners[i];
        const c2 = crosshairCorners[i + 1];
        
        // Check if center is on a corner
        if ((center.x === c1.x && center.y === c1.y) || (center.x === c2.x && center.y === c2.y)) {
            return true;
        }
        
        // Check if point is between corners vertically
        if ((c1.y > center.y) !== (c2.y > center.y)) {
            // Calculate x-intersection of the line with horizontal line at point.y
            const xIntersection = (c2.x - c1.x) * (center.y - c1.y) / (c2.y - c1.y) + c1.x;
            
            // Check if point is on horizontal line and the x-intersection
            if (center.x === xIntersection) {
                return true;
            }
            
            // Check if point is to the left of the line
            if (center.x < xIntersection) {
                inside = !inside;
            }
        }
    }
    
    return inside;
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







// Handle shoot button click - UPDATED
shootBtn.addEventListener('click', function() {
    if (targetInCrosshair) {
        // Visual feedback
        shootBtn.classList.add('active');
        setTimeout(() => shootBtn.classList.remove('active'), 200);
        
        // Play sound effect
        playLaserSound();
        
        // Send hit event to server
        socket.emit('hit', targetInCrosshair.playerId);
        
        // Show hit confirmation
        showHitConfirmation(targetInCrosshair.center.x, targetInCrosshair.center.y);
        
        statusMessage.textContent = `Shot fired at player ${targetInCrosshair.playerId}!`;
    } else {
        statusMessage.textContent = 'No target in crosshair!';
    }
});

// Sound effects
const sounds = {
    laser: new Audio('sound/laser.mp3'),
    hit: new Audio('sound/hit.mp3')
};

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
