// Connect to the server
const socket = io();
let currentPlayer = {
    id: null,
    name: '',
    score: 0
};

// DOM elements
const videoElement = document.getElementById('videoInput');
const canvasOutput = document.getElementById('canvasOutput');
const targetingOverlay = document.getElementById('targetingOverlay');
const respawnOverlay = document.getElementById('respawnOverlay');
const respawnCounter = document.getElementById('respawnCounter');
const playerNameInput = document.getElementById('playerNameInput');
const setNameBtn = document.getElementById('setNameBtn');
const shootBtn = document.getElementById('shootBtn');
const playerScore = document.getElementById('playerScore');
const playersList = document.getElementById('playersList');
const statusMessage = document.getElementById('statusMessage');
const joinRedBtn = document.getElementById('joinRedBtn');
const joinBlueBtn = document.getElementById('joinBlueBtn');
const teamSelection = document.getElementById('teamSelection');
const gameTimer = document.getElementById('gameTimer');
const timeDisplay = document.getElementById('timeDisplay');

// Canvas context
const ctx = canvasOutput.getContext('2d');

// Game state
let isProcessing = false;
let detectedMarkers = [];
let currentTarget = null;
let isOpenCVReady = false;
let gameMode = 'freeplay';
let gameActive = false;
let timeRemaining = 0;
let playerTeam = null;
let isPlayerActive = true;

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

// Initialize OpenCV when it's ready
function onOpenCvReady() {
    isOpenCVReady = true;
    statusMessage.textContent = 'OpenCV loaded. Starting camera...';
    
    // Check if we're in secure context
    checkSecureContext();
    
    startCamera();
}

// Set up event listener for OpenCV ready
document.addEventListener('opencv-ready', function() {
    console.log('OpenCV ready event received');
    onOpenCvReady();
});

// Also check immediately in case it's already loaded
if (window.cv && typeof cv.getBuildInformation === 'function') {
    console.log('OpenCV already loaded');
    onOpenCvReady();
}

// Debug overlay for showing camera information
function showDebugOverlay(message) {
    let debugOverlay = document.getElementById('debug-overlay');
    if (!debugOverlay) {
        debugOverlay = document.createElement('div');
        debugOverlay.id = 'debug-overlay';
        debugOverlay.style.position = 'absolute';
        debugOverlay.style.top = '10px';
        debugOverlay.style.left = '10px';
        debugOverlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
        debugOverlay.style.color = 'white';
        debugOverlay.style.padding = '5px';
        debugOverlay.style.fontSize = '12px';
        debugOverlay.style.zIndex = '1000';
        debugOverlay.style.maxWidth = '80%';
        document.querySelector('.camera-container').appendChild(debugOverlay);
    }
    
    debugOverlay.innerHTML = message;
}

// Start camera
async function startCamera() {
    statusMessage.textContent = 'Requesting camera access...';
    console.log('Starting camera...');
    
    // Add protocol info to debug overlay
    showDebugOverlay(`Protocol: ${window.location.protocol}<br>
                      Camera access requires HTTPS on most mobile browsers.`);
    
    // Display device info for debugging
    const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,
        orientation: window.screen.orientation ? window.screen.orientation.type : 'unknown',
        protocol: window.location.protocol
    };
    console.log('Device info:', deviceInfo);
    
    try {
        // First check if getUserMedia is supported
        if (!navigator.mediaDevices) {
            showDebugOverlay('navigator.mediaDevices is undefined. This often means you need HTTPS.');
            throw new Error('Camera API not supported - try using HTTPS');
        }
        
        if (!navigator.mediaDevices.getUserMedia) {
            showDebugOverlay('getUserMedia not available. Try using HTTPS.');
            throw new Error('getUserMedia not available - try using HTTPS');
        }
        
        // List available devices to help with debugging
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            console.log('Available video devices:', videoDevices);
            
            if (videoDevices.length === 0) {
                showDebugOverlay('No cameras detected on this device');
                throw new Error('No video devices found');
            }
            
            // Show how many cameras we've found
            showDebugOverlay(`Found ${videoDevices.length} camera(s):\n${videoDevices.map(d => d.label || 'unnamed camera').join('\n')}`);
            
            // Try each camera with different constraints
            await tryCamera(videoDevices);
        } catch (enumError) {
            console.error('Error enumerating devices:', enumError);
            
            // Fallback to basic camera access attempts without device info
            await tryDefaultCameraOptions();
        }
    } catch (error) {
        statusMessage.textContent = `Camera error: ${error.message}`;
        console.error('Error accessing camera:', error);
        
        // Show more detailed instructions for troubleshooting
        const cameraErrorMsg = document.createElement('div');
        cameraErrorMsg.className = window.isSecureContext ? 'camera-error' : 'security-warning';
        
        if (!window.isSecureContext) {
            // This is a security context issue - probably HTTP instead of HTTPS
            cameraErrorMsg.innerHTML = `
                <h3>⚠️ Security Warning</h3>
                <p>This site is being accessed over an insecure connection (HTTP).</p>
                <p>Camera access requires HTTPS on most mobile browsers.</p>
                <p>Error: ${error.message}</p>
                <p>Please try one of the following:</p>
                <ul>
                    <li>Access this site using HTTPS</li>
                    <li>Use ngrok to create a secure tunnel to your local server</li>
                    <li>For testing: enable "Insecure origins treated as secure" in Chrome flags</li>
                    <li>Use a desktop browser for testing</li>
                </ul>
                <button id="insecureInstructions" class="btn">Show Instructions</button>
                <button id="retryCamera" class="btn">Retry Anyway</button>
            `;
        } else {
            // Regular camera access error
            cameraErrorMsg.innerHTML = `
                <h3>Camera Access Error</h3>
                <p>${error.message}</p>
                <ul>
                    <li>Make sure you've given camera permission</li>
                    <li>Try using a different browser (Chrome recommended)</li>
                    <li>On iOS, make sure you're using Safari</li>
                    <li>Check that no other app is using the camera</li>
                    <li>For Android: allow camera access in site settings</li>
                    <li>Try refreshing the page</li>
                </ul>
                <button id="retryCamera" class="btn">Retry Camera Access</button>
            `;
        }
        
        document.querySelector('.camera-container').appendChild(cameraErrorMsg);
        
        // Add retry button functionality
        document.getElementById('retryCamera').addEventListener('click', () => {
            cameraErrorMsg.remove();
            startCamera();
        });
        
        // Add instructions button functionality if it exists
        const insecureInstructionsButton = document.getElementById('insecureInstructions');
        if (insecureInstructionsButton) {
            insecureInstructionsButton.addEventListener('click', () => {
                const instructions = document.createElement('div');
                instructions.className = 'security-instructions';
                instructions.innerHTML = `
                    <h3>How to use ngrok for HTTPS:</h3>
                    <ol>
                        <li>Install ngrok: <code>npm install -g ngrok</code></li>
                        <li>Start your server as usual</li>
                        <li>In another terminal, run: <code>ngrok http 3000</code></li>
                        <li>Use the https:// URL provided by ngrok to access your game</li>
                    </ol>
                    <button id="closeInstructions" class="btn">Close</button>
                `;
                document.body.appendChild(instructions);
                
                document.getElementById('closeInstructions').addEventListener('click', () => {
                    instructions.remove();
                });
            });
        }
    }
}

// Helper function to try accessing cameras with various constraints
async function tryCamera(videoDevices) {
    // Try with the back camera first (likely to be better for marker detection)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // For iOS Safari, use more permissive constraints
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    let stream = null;
    
    // First try: Use environment camera on mobile
    if (isMobile) {
        try {
            statusMessage.textContent = 'Trying back camera...';
            showDebugOverlay('Attempting to use back camera (environment)');
            
            // iOS needs special handling
            const constraints = isIOS ? 
                { video: { facingMode: 'environment' } } : 
                { 
                    video: { 
                        facingMode: { exact: 'environment' },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    } 
                };
            
            stream = await navigator.mediaDevices.getUserMedia({
                ...constraints,
                audio: false
            });
            
            console.log('Using back camera (environment)');
            handleCameraStream(stream);
            return;
        } catch (backCameraError) {
            console.warn('Back camera failed:', backCameraError);
            showDebugOverlay(`Back camera failed: ${backCameraError.message}`);
        }
    }
    
    // Second try: Try specific device IDs if we have them
    if (videoDevices.length > 0) {
        // Try each video device
        for (const device of videoDevices) {
            try {
                statusMessage.textContent = `Trying camera: ${device.label || 'unnamed camera'}...`;
                showDebugOverlay(`Attempting device: ${device.label || device.deviceId}`);
                
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: device.deviceId } },
                    audio: false
                });
                
                console.log(`Using device: ${device.label || device.deviceId}`);
                handleCameraStream(stream);
                return;
            } catch (deviceError) {
                console.warn(`Device ${device.deviceId} failed:`, deviceError);
            }
        }
    }
    
    // Last resort: try with default constraints
    await tryDefaultCameraOptions();
}

// Fallback to try default camera constraints
async function tryDefaultCameraOptions() {
    try {
        statusMessage.textContent = 'Trying default camera...';
        showDebugOverlay('Attempting with basic camera options');
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });
        
        console.log('Using default camera options');
        handleCameraStream(stream);
    } catch (defaultError) {
        console.error('All camera attempts failed:', defaultError);
        showDebugOverlay('All camera attempts failed');
        throw defaultError; // Re-throw to trigger the error handling in startCamera
    }
}

// Handle the camera stream once it's obtained
function handleCameraStream(stream) {
    // Log info about the tracks for debugging
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length > 0) {
        const settings = videoTracks[0].getSettings();
        console.log('Camera settings:', settings);
        console.log('Camera constraints:', videoTracks[0].getConstraints());
    }
    
    // If there's an old stream, clean it up
    if (videoElement.srcObject) {
        const oldTracks = videoElement.srcObject.getTracks();
        oldTracks.forEach(track => track.stop());
    }
    
    // Assign the new stream
    videoElement.srcObject = stream;
    
    // iOS Safari hack: add video element to DOM directly
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
        console.log('iOS device detected, applying special handling');
        // Force video element to be visible and properly sized
        videoElement.setAttribute('playsinline', true);
        videoElement.setAttribute('webkit-playsinline', true);
        
        // Try to force hardware acceleration for video rendering
        videoElement.style.transform = 'translateZ(0)';
    }
    
    // Add play event handler
    videoElement.onplay = function() {
        console.log('Video playing. Size:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        // Add debug overlay with video dimensions
        showDebugOverlay(`Stream: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
    };
    
    // Handle loadedmetadata event
    videoElement.onloadedmetadata = function() {
        console.log('Video metadata loaded. Size:', videoElement.videoWidth, 'x', videoElement.videoHeight);
        
        // For mobile devices, sometimes dimensions are swapped or incorrect initially
        const isPortrait = window.innerHeight > window.innerWidth;
        if (isPortrait && videoElement.videoWidth > videoElement.videoHeight) {
            console.log('Possible orientation mismatch, will adjust after playback');
        }
        
        // Set the canvas size to match the video
        canvasOutput.width = videoElement.videoWidth;
        canvasOutput.height = videoElement.videoHeight;
        
        // Start playing the video
        videoElement.play()
            .then(() => {
                console.log('Video playback started successfully');
                statusMessage.textContent = 'Camera active. Looking for targets...';
                
                // Ensure canvas dimensions match actual video display size after play
                setTimeout(() => {
                    // Double-check and update canvas dimensions after a slight delay
                    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                        canvasOutput.width = videoElement.videoWidth;
                        canvasOutput.height = videoElement.videoHeight;
                        console.log('Canvas size adjusted to:', canvasOutput.width, 'x', canvasOutput.height);
                    }
                    // Start processing frames
                    processVideo();
                }, 500);
            })
            .catch(e => {
                console.error('Video playback failed:', e);
                statusMessage.textContent = `Video playback error: ${e.message}`;
            });
    };
    
    // Handle errors
    videoElement.onerror = function(error) {
        console.error('Video element error:', error);
        statusMessage.textContent = 'Video stream error';
        showDebugOverlay(`Video error: ${error}`);
    };
}

// Process video frames
function processVideo() {
    if (!isProcessing && isOpenCVReady && videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        isProcessing = true;
        
        try {
            // Create an OpenCV matrix from the video frame
            const src = new cv.Mat(videoElement.height, videoElement.width, cv.CV_8UC4);
            const cap = new cv.VideoCapture(videoElement);
            
            cap.read(src);
        
            // Process the frame to detect markers
            detectedMarkers = MarkerDetector.detectMarkers(src);
            
            // Draw the results on the canvas
            drawResults(src);
            
            // Release resources
            src.delete();
        } catch (error) {
            console.error('Error processing video frame:', error);
            showDebugOverlay(`OpenCV error: ${error.message}`);
        } finally {
            isProcessing = false;
        }
    }
    
    // Process the next frame
    requestAnimationFrame(processVideo);
}

// Draw detection results
function drawResults(frame) {
    // Clear the canvas
    ctx.clearRect(0, 0, canvasOutput.width, canvasOutput.height);
    
    // Draw the current frame
    ctx.drawImage(videoElement, 0, 0, canvasOutput.width, canvasOutput.height);
    
    // Clear targeting overlay
    targetingOverlay.innerHTML = '';
    
    // Find closest marker to center (for targeting)
    currentTarget = findClosestMarkerToCenter();
    
    // Draw markers
    detectedMarkers.forEach(marker => {
        const isTarget = (currentTarget && marker.id === currentTarget.id);
        
        // Determine color based on team in team mode
        let markerColor = '#00ff00'; // Default green
        
        if (gameMode === 'team' && marker.playerTeam) {
            // In team mode, use team colors
            if (marker.playerTeam === 'red') {
                markerColor = '#ff0000';
            } else if (marker.playerTeam === 'blue') {
                markerColor = '#2196f3';
            }
            
            // If on same team, make it slightly transparent
            if (marker.playerTeam === playerTeam) {
                markerColor = markerColor + '80'; // Add 50% transparency
            }
        } else if (isTarget) {
            markerColor = '#ff0000'; // Red for target
        }
        
        // Draw rectangle around marker
        ctx.strokeStyle = markerColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(marker.x, marker.y, marker.width, marker.height);
        ctx.stroke();
        
        // Add ID and team text if applicable
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        let labelText = `ID: ${marker.id}`;
        if (marker.playerTeam) {
            labelText += ` (${marker.playerTeam})`;
        }
        ctx.fillText(labelText, marker.x, marker.y - 5);
        
        // Create targeting element
        if (isTarget) {
            const targetElem = document.createElement('div');
            targetElem.className = 'target-marker';
            targetElem.style.left = `${marker.center.x}px`;
            targetElem.style.top = `${marker.center.y}px`;
            targetElem.style.width = `${marker.width * 0.5}px`;
            targetElem.style.height = `${marker.height * 0.5}px`;
            
            // Adjust targeting element color based on team
            if (gameMode === 'team' && marker.playerTeam) {
                targetElem.style.borderColor = marker.playerTeam === 'red' ? '#ff0000' : '#2196f3';
            }
            
            targetingOverlay.appendChild(targetElem);
        }
    });
}

// Find the marker closest to the center of the frame
function findClosestMarkerToCenter() {
    if (detectedMarkers.length === 0) return null;
    
    const centerX = canvasOutput.width / 2;
    const centerY = canvasOutput.height / 2;
    
    let closestMarker = null;
    let minDistance = Infinity;
    
    detectedMarkers.forEach(marker => {
        const dx = marker.center.x - centerX;
        const dy = marker.center.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < minDistance) {
            minDistance = distance;
            closestMarker = marker;
        }
    });
    
    return closestMarker;
}

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
