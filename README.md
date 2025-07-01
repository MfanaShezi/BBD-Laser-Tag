# Laser Tag Game

A web-based laser tag game that uses phone cameras for object detection with OpenCV.js and Socket.io for real-time multiplayer functionality.

## Overview

This project creates a web application where players can use their phones as laser tag guns. Using the phone's camera, the app detects markers on other players and allows you to "shoot" at them. The application uses:

- OpenCV.js for marker/object detection
- Socket.io for real-time communication between players
- Express for the web server

## Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the server:
   ```
   npm start
   ```
4. Open the application in your browser:
   - On your computer: `http://localhost:3000`
   - On your phone: `http://[your-computer-ip]:3000`
   - Admin panel: `http://[your-computer-ip]:3000/admin.html`

## How to Play

1. Open the game on your phone browser
2. Allow camera access when prompted
3. Enter your name and click "Set Name"
4. Print markers:
   - Simple markers: `http://[your-computer-ip]:3000/markers/print-markers.html`
   - ArUco markers: `http://[your-computer-ip]:3000/markers/aruco-generator.html`
5. Attach markers to your chest or a visible location
6. Point your phone camera at other players to detect their markers
7. Press the SHOOT button to tag another player when their marker is detected

## Game Modes

### Free Play Mode
- No respawn timers
- Score is accumulated without time limit
- Play continuously without restrictions

### Team Mode
- Players join either Red or Blue team
- Players can only hit members of the opposite team
- Players respawn after a short timeout when hit
- Team with highest score at the end of time wins

### Countdown Mode
- Set game time (default 5 minutes)
- Individual scoring
- Players respawn after being hit
- Player with highest score at the end wins

## Creating Custom Markers

For best results, create high-contrast markers with unique patterns. You can either:

1. Use the provided simple marker patterns
2. Create ArUco markers which offer better detection and identification

## Requirements

- Modern web browser with camera support
- Node.js and npm
- Multiple devices for multiplayer

## Development

- `npm start`: Start the server
- `npm run dev`: Start the development server

## Notes

- For optimal detection, ensure good lighting conditions
- Keep markers clearly visible and minimize motion blur
- Adjust marker size based on expected playing distance
