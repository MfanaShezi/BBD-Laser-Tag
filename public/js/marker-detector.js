/**
 * Marker Detector module
 * Handles detecting markers in images using OpenCV.js
 */
const MarkerDetector = (function() {
    // Configuration options
    const config = {
        adaptiveThresholdBlockSize: 13,
        adaptiveThresholdConstant: 2,
        minMarkerArea: 100,
        polygonApproxFactor: 0.05
    };
    
    /**
     * Detect markers in the provided image
     * @param {cv.Mat} img - OpenCV Mat containing the image
     * @returns {Array} Array of detected markers with position and ID
     */
    function detectMarkers(img) {
        // Convert to grayscale
        const gray = new cv.Mat();
        cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);
        
        // Apply adaptive threshold to create binary image
        const binary = new cv.Mat();
        cv.adaptiveThreshold(
            gray, 
            binary, 
            255, 
            cv.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv.THRESH_BINARY_INV, 
            config.adaptiveThresholdBlockSize, 
            config.adaptiveThresholdConstant
        );
        
        // Find contours
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(binary, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);
        
        const markers = [];
        
        // Process each contour
        for (let i = 0; i < contours.size(); ++i) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            
            // Skip small contours
            if (area < config.minMarkerArea) {
                contour.delete();
                continue;
            }
            
            // Approximate the contour to a polygon
            const approxCurve = new cv.Mat();
            const epsilon = config.polygonApproxFactor * cv.arcLength(contour, true);
            cv.approxPolyDP(contour, approxCurve, epsilon, true);
            
            // Check if it's a quadrilateral (4 vertices)
            if (approxCurve.rows === 4) {
                // We've found a potential marker
                
                // Get bounding rectangle
                const rect = cv.boundingRect(approxCurve);
                
                // Extract ROI (region of interest) containing the marker
                const roi = gray.roi(rect);
                
                // Here we would normally decode the marker to get its ID
                // For simplicity, we'll use a simple method to generate an ID
                const markerId = generateMarkerId(roi);
                
                // Save marker information
                markers.push({
                    id: markerId,
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    center: {
                        x: rect.x + rect.width / 2,
                        y: rect.y + rect.height / 2
                    },
                    corners: getCornerPoints(approxCurve)
                });
                
                // Clean up
                roi.delete();
            }
            
            approxCurve.delete();
            contour.delete();
        }
        
        // Clean up resources
        contours.delete();
        hierarchy.delete();
        binary.delete();
        gray.delete();
        
        return markers;
    }
    
    /**
     * Extract corner points from an OpenCV contour
     * @param {cv.Mat} approxCurve - Approximated contour points
     * @returns {Array} Array of corner points
     */
    function getCornerPoints(approxCurve) {
        const corners = [];
        for (let i = 0; i < approxCurve.rows; ++i) {
            corners.push({
                x: approxCurve.data32S[i * 2],
                y: approxCurve.data32S[i * 2 + 1]
            });
        }
        return corners;
    }
    
    /**
     * Generate a simple marker ID based on image content
     * In a real application, this would decode the marker pattern
     * @param {cv.Mat} roi - Region of interest containing the marker
     * @returns {number} Generated marker ID
     */
    function generateMarkerId(roi) {
        // Resize ROI to standard size
        const standardSize = new cv.Mat();
        cv.resize(roi, standardSize, new cv.Size(16, 16));
        
        // Calculate simple hash based on pixel values
        let hash = 0;
        for (let y = 4; y < 12; y += 4) {
            for (let x = 4; x < 12; x += 4) {
                const pixelValue = standardSize.ucharPtr(y, x)[0];
                hash = ((hash << 5) - hash) + pixelValue;
                hash = hash & hash; // Convert to 32bit integer
            }
        }
        
        // Clean up
        standardSize.delete();
        
        // Return positive ID
        return Math.abs(hash) % 1000; // Limit to 3 digits for display purposes
    }
    
    /**
     * Detect ArUco markers in an image
     * @param {cv.Mat} img - Input image
     * @returns {Array} Array of detected ArUco markers
     */
    function detectArucoMarkers(img) {
        if (!cv.aruco) {
            console.error('ArUco module not available');
            return [];
        }
        
        try {
            // Convert to grayscale
            const gray = new cv.Mat();
            cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);
            
            // Create ArUco detector
            const dictionary = new cv.aruco_Dictionary(cv.DICT_6X6_250);
            const parameters = new cv.aruco_DetectorParameters();
            
            // Structures to store results
            const corners = new cv.MatVector();
            const ids = new cv.Mat();
            const rejectedImgPoints = new cv.MatVector();
            
            // Detect markers
            cv.detectMarkers(
                gray, 
                dictionary, 
                corners, 
                ids, 
                parameters, 
                rejectedImgPoints
            );
            
            const markers = [];
            
            // Process results
            if (ids.rows > 0) {
                for (let i = 0; i < ids.rows; ++i) {
                    const markerId = ids.data32S[i];
                    const markerCorners = corners.get(i);
                    
                    // Calculate center point and bounding rect
                    let minX = Infinity, minY = Infinity;
                    let maxX = 0, maxY = 0;
                    const centerX = 0, centerY = 0;
                    
                    const cornerPoints = [];
                    
                    for (let j = 0; j < 4; j++) {
                        const x = markerCorners.data32F[j * 2];
                        const y = markerCorners.data32F[j * 2 + 1];
                        
                        cornerPoints.push({ x, y });
                        
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                        
                        centerX += x;
                        centerY += y;
                    }
                    
                    markers.push({
                        id: markerId,
                        x: minX,
                        y: minY,
                        width: maxX - minX,
                        height: maxY - minY,
                        center: {
                            x: centerX / 4,
                            y: centerY / 4
                        },
                        corners: cornerPoints
                    });
                }
            }
            
            // Clean up
            gray.delete();
            corners.delete();
            ids.delete();
            rejectedImgPoints.delete();
            
            return markers;
        } catch (error) {
            console.error('Error in ArUco detection:', error);
            return [];
        }
    }
    
    // Public API
    return {
        detectMarkers,
        detectArucoMarkers
    };
})();
