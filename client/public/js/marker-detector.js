const nonPlayerQrs = {10: 'respawn', 11: 'mysteryBox'}

// Helper function to draw crosshair in the center of the canvas
function drawCrosshair(ctx, canvasOutput, targetInCrosshair) {
    const centerX = canvasOutput.width / 2;
    const centerY = canvasOutput.height / 2;
    // const size = 20;
    const size = Math.min(canvasOutput.width, canvasOutput.height) * 0.05;
    
    ctx.lineWidth = 2;
    // Change color based on whether there's a target in crosshair
    if (targetInCrosshair) {
        // Red when over a marker
        ctx.strokeStyle = 'rgb(255, 255, 0)';
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
function processDetectedMarkers(markers, ctxOutput, canvasOutput, targetInCrosshair, players, currentPlayer) {
    if (markers.length > 0) {
        // Reset current target
        targetInCrosshair = null;

         // Center point of the canvas
        const centerX = canvasOutput.width / 2;
        const centerY = canvasOutput.height / 2;
        
        // Draw detected markers
        markers.forEach(marker => {
            // Draw marker outline
            // drawMarker(ctxOutput, marker);
            
            // Calculate center of marker
            const center = getMarkerCenter(marker);
            
            // Use different colors based on marker ID
            let colorInfo = getDistinctColor(marker.id);
            let color = colorInfo.rgb;
            // let colorHue = (marker.id * 30) % 360;
            // let color = hsvToRgb(colorHue / 360, 1, 1);

            // Get player of marker
            let markerPlayer = null
            for (const [key, player] of Object.entries(players)) {
              if (marker.id === player.qrId) {
                markerPlayer = player;
                break;
              }
            } 

            let isNonPlayer = false;
            if (nonPlayerQrs[marker.id] == 'respawn') {
                markerPlayer = {
                    id: marker.id,
                    name: 'Respawn',
                    health: 1,
                    qrId: marker.id
                };
                isNonPlayer = true;
                color = {r: 252, g: 3, b: 198}; // Pink color for respawn
            } else if (nonPlayerQrs[marker.id] == 'mysteryBox') {
                markerPlayer = {
                    id: 'mysteryBox',
                    name: 'Mystery Box',
                    health: 1,
                    qrId: marker.id
                };
                isNonPlayer = true;
                color = {r: 0, g: 255, b: 0}; // Green color for mystery box
            }
            
            if (markerPlayer) {
            // if (true) {

                drawMarker(ctxOutput, marker, markerPlayer);
                // Draw marker ID
                ctxOutput.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
                ctxOutput.font = '20px Arial';
                if (isNonPlayer) {
                    ctxOutput.fillText(`${markerPlayer.name}`, center.x - 20, center.y - 30);
                } else {
                    ctxOutput.fillText(`${markerPlayer.name}  ${markerPlayer.health}`, center.x - 20, center.y - 30);
                }

                // Check if center point is inside this marker
                if (isPointInMarker({x: centerX, y: centerY}, marker) && markerPlayer.health > 0) {
                    // Store the target marker if center is inside it
                    targetInCrosshair = {
                        id: marker.id,
                        player: markerPlayer, // This should be set elsewhere in your code
                        center: center
                    };
                    if (currentPlayer.health > 0 && marker.id === 10) {
                        // Nothing
                    } else if (currentPlayer.health <= 0 && marker.id !== 10) { 
                        //Nothing
                    } else {
                        // Highlight the target marker
                        ctxOutput.lineWidth = 6;
                        ctxOutput.strokeStyle = 'rgba(255, 255, 0, 0.8)';
                        ctxOutput.strokeRect(
                            center.x - 30,
                            center.y - 30,
                            60,
                            60
                        );
                    }
                }
            } 
    });
        
        // document.getElementById('status').innerHTML = `Detected ${markers.length} marker(s)`;
    }

    return targetInCrosshair;
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
function drawMarker(ctx, marker, markerPlayer = null) {
    // Use different colors for different marker IDs
    // const colorHue = (marker.id * 30) % 360;
    // const color = hsvToRgb(colorHue / 360, 1, 1);
    // const strokeColor = `rgb(${color.r}, ${color.g}, ${color.b})`;

    
    let colorInfo = getDistinctColor(marker.id);
    if (nonPlayerQrs[marker.id] == "respawn") {
        colorInfo = {cssColor: 'rgb(252, 3, 198)'}
    } else if (nonPlayerQrs[marker.id] == "mysteryBox") {
        colorInfo = {cssColor: 'rgb(0, 255, 0)'}
    }
    const strokeColor = colorInfo.cssColor;
    
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

// Helper function to get distinct colors for different marker IDs
function getDistinctColor(id) {

    if (id == 3) {
        id = 249;
    }
    // Use a color scheme that maximizes differentiation
    // This is based on the Golden Ratio to spread colors evenly in the color space
    const goldenRatioConjugate = 0.618033988749895;
    
    // Use a prime-based offset for even better distribution
    const primeOffset = 0.31;
    
    // Create a hash from ID that will be distributed between 0 and 1
    let h = ((id * goldenRatioConjugate) % 1 + primeOffset) % 1;
    
    // Use high saturation and value for distinct colors
    const s = 0.85 + (id % 3) * 0.05; // Slight variation in saturation (0.85-0.95)
    const v = 0.85 + (id % 5) * 0.03; // Slight variation in brightness (0.85-0.97)
    
    // Convert to RGB
    const rgb = hsvToRgb(h, s, v);
    
    // Return both RGB object and CSS color string
    return {
        h: h,
        s: s,
        v: v,
        rgb: rgb,
        cssColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
    };
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