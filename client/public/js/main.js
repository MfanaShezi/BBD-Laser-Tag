// Connect to the server
const socket = io();
// let player = {
//     id: null,
//     name: '',
//     qrId: null,
//     roomId: null,
//     team: null,
//     score: 0,
//     health: 3,
//     kills: 0,
// };

let player = null;

let room = null;

let targetInCrosshair = null;
let video = null;
let canvasOutput = null;
let canvasProcessing = null; 
let streaming = false;
let detector = null;

const urlParams = new URLSearchParams(window.location.search);
const playerId = urlParams.get('playerId');
const roomId = urlParams.get('roomId');

function onLoad() {
    // Create AR detector with ARUCO_MIP_36h12 dictionary (better detection than standard ARUCO)
    // const urlParams = new URLSearchParams(window.location.search);
    // player.id = urlParams.get('playerId');
    // player.name = urlParams.get('playerName') || `Player ${player.id  || ''}`;
    // player.roomId = urlParams.get('roomId');
    // room.id = player.roomId;
    // player.team = urlParams.get('team') || 'default';  

    // socket.emit('joinRoom', { roomId: player.roomId, player:player});
    socket.emit("requestRoomInfo", {roomId: roomId});
    
    detector = new AR.Detector({ 
        dictionaryName: 'ARUCO_MIP_36h12',
        maxHammingDistance: 7 // Balance between detection accuracy and sensitivity
    });    
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
        // Get video dimensions from the actual video stream
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        
        // Get window dimensions
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        // Set dimensions to fill the entire screen
        // Processing canvas uses native video dimensions for accurate detection
        canvasProcessing.width = videoWidth;
        canvasProcessing.height = videoHeight;
        
        // Output canvas and video fill the entire screen
        canvasOutput.width = windowWidth;
        canvasOutput.height = windowHeight;
        
        // Set video element to fill the screen
        video.style.width = '100vw';
        video.style.height = '100vh';
        video.style.objectFit = 'cover'; // This is key - it will cover the entire area
        video.style.position = 'absolute';
        video.style.left = '0';
        video.style.top = '0';
        
        // Set canvas element to fill the screen
        canvasOutput.style.width = '100vw';
        canvasOutput.style.height = '100vh';
        canvasOutput.style.position = 'absolute';
        canvasOutput.style.left = '0';
        canvasOutput.style.top = '0';
        
        streaming = true;
        setTimeout(processVideo, 1000); // Start processing after a short delay
    }
    });
}

// Add this function to map coordinates between processing and output canvases
function mapCoordinates(point, fromCanvas, toCanvas, sourceRect) {
    // Source rectangle (sx, sy, sWidth, sHeight) defines the cropped area of the video
    const { x, y } = point;
    
    // Calculate scale factors between the processing canvas and the cropped area
    const scaleX = sourceRect.sWidth / fromCanvas.width;
    const scaleY = sourceRect.sHeight / fromCanvas.height;
    
    // Adjust for cropping offset
    const adjustedX = (x - sourceRect.sx) / scaleX;
    const adjustedY = (y - sourceRect.sy) / scaleY;
    
    // Scale to output canvas
    return {
        x: (adjustedX / fromCanvas.width) * toCanvas.width,
        y: (adjustedY / fromCanvas.height) * toCanvas.height
    };
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
        

        // Calculate dimensions to crop and fill the output canvas
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const videoAspect = videoWidth / videoHeight;
        
        const canvasWidth = canvasOutput.width;
        const canvasHeight = canvasOutput.height;
        const canvasAspect = canvasWidth / canvasHeight;
        
        // Variables for source cropping
        let sx = 0, sy = 0, sWidth = videoWidth, sHeight = videoHeight;
        
        // Crop the video to match the canvas aspect ratio
        if (videoAspect > canvasAspect) {
            // Video is wider than canvas - crop sides
            sWidth = videoHeight * canvasAspect;
            sx = (videoWidth - sWidth) / 2;
        } else if (videoAspect < canvasAspect) {
            // Video is taller than canvas - crop top/bottom
            sHeight = videoWidth / canvasAspect;
            sy = (videoHeight - sHeight) / 2;
        }
        
        const sourceRect = { sx, sy, sWidth, sHeight };

        // Draw the cropped video frame to fill the output canvas
        ctxOutput.drawImage(
            video, 
            sx, sy, sWidth, sHeight,      // Source rectangle (cropped area)
            0, 0, canvasWidth, canvasHeight   // Destination rectangle (full canvas)
        );



        // FIRST draw the video frame to the output canvas
        // ctxOutput.drawImage(video, 0, 0, canvasOutput.width, canvasOutput.height);
        
        // Get the image data for marker detection
        const imageData = ctxProcessing.getImageData(0, 0, canvasProcessing.width, canvasProcessing.height);
        
        // THEN detect and draw markers ON TOP of the video frame
        try {
            const markers = detector.detect(imageData);
            
            if (markers && markers.length > 0) {
                // console.log(`Detected ${markers.length} markers`);
                // targetInCrosshair = processDetectedMarkers(markers, ctxOutput, canvasOutput, targetInCrosshair, room.players);
                // Map the markers to output canvas coordinates
                const mappedMarkers = markers.map(marker => {
                    // Create a new marker object with mapped corners
                    const mappedMarker = { ...marker };
                    mappedMarker.corners = marker.corners.map(corner => 
                        mapCoordinates(corner, canvasProcessing, canvasOutput, sourceRect)
                    );
                    return mappedMarker;
                });
                
                targetInCrosshair = processDetectedMarkers(mappedMarkers, ctxOutput, canvasOutput, targetInCrosshair, room.players);
            } else {
                targetInCrosshair = null;
            }
        } catch (detectErr) {
            console.error("Detection error:", detectErr);
        }

        // Draw crosshair in the center of the canvas
        drawCrosshair(ctxOutput, canvasOutput, targetInCrosshair);
        
        // Calculate and schedule next frame
        let delay = 1000 / 30 - (Date.now() - begin); 
        setTimeout(processVideo, delay > 0 ? delay : 0);
        } catch (err) {
            console.error(err);
    }
}

///////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Event Listeners ///////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

// Handle shoot button click - UPDATED
shootBtn.addEventListener('click', function() {
    if (player.health <= 0) {
        // TODO
    } else {
        playLaserSound();
    }
    if (targetInCrosshair) {
        // Visual feedback
        shootBtn.classList.add('active');
        setTimeout(() => shootBtn.classList.remove('active'), 200);
        
        if (player.health <= 0 && targetInCrosshair.id != 10) return;
        if (player.health > 0 && targetInCrosshair.id == 10) return; // Don't shoot at yourself if alive
        if (targetInCrosshair.player.health <= 0) return; // Don't shoot if target is already dead
        // Send hit event to server
        socket.emit('hit', {'playerShootingId': player.id, 'playerHit':targetInCrosshair.player});
        setTimeout(() => {
            playHitSound();
        }, 250);
        
        // Show hit confirmation
        showHitConfirmation(targetInCrosshair.center.x, targetInCrosshair.center.y);
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

// Format time as MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

///////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////// Socket Stuff //////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////


// // Handle room-related socket events
// socket.on('roomDetails', (room) => {
//     currentRoom = room;
//     const roomInfo = document.getElementById('roomInfo');
//     const teamButtons = document.getElementById('teamButtons');

//     if (roomInfo) {
//         if (room.mode === 'single') {
//             roomInfo.textContent = `You have joined the single-player room: ${room.name}`;
//             if (teamButtons) teamButtons.style.display = 'none'; // Hide team buttons for single-player mode
//         } else if (room.mode === 'team') {
//             roomInfo.textContent = `You have joined the team room: ${room.name}`;
//             if (teamButtons) teamButtons.style.display = 'block'; // Show team buttons for team mode
//         }
//     }
// });

socket.on('roomError', (message) => {
    alert(message);
    window.location.href = '/room.html'; // Redirect back to room selection
});

// socket.on('sendRoomInfo', (sentRoom) => {
//     if (sentRoom.id !== player.roomId) return;

//     room.players = sentRoom.players;
//     player = room.players[player.id];
//     // console.log(player);
// });

socket.on('gameOver', (data) => {
    const winner = data.winner;
    const roomId = data.roomId;

    if (room.id === roomId) {
        alert(`Game Over! Player ${winner.name} wins with ${winner.kills} kills!`);
        // Optionally redirect or reset the game
        // window.location.href = '/room.html'; // Redirect to room selection
    }
});
socket.on('sendRoomInfo', (localRoom) => {
    console.log("Gets Here 0");
    if (localRoom.id !== roomId) return;

    room = structuredClone(localRoom);
    player = structuredClone(localRoom.players[playerId]);
    console.log("Gets Here 1");
    console.log(player);
});