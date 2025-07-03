# Laser Tag Game

A web-based laser tag game that uses phone cameras for object detection with OpenCV.js and Socket.io for real-time multiplayer functionality.

## Overview

This is a web application where players can use their phones as laser tag guns. Using the phone's camera, the app detects markers on other players and allows you to "shoot" at them. The application uses:

- OpenCV.js for marker/object detection (using [ArUco markers](https://chev.me/arucogen/) - Dictionary must be set to Original)
- Socket.io for real-time communication between players
- Express for the web server

## Setup Instructions for Local Run

1. Clone the repository
2. cd into API directory:
   ```
   cd API
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Start the server:
   ```
   npm start
   ```
5. Open the application in your browser:
   - On your computer: http://localhost:3000
   - On your phone: `http://[your-computer-ip]:3000`

## Setup Instructions for Production Run
1. Open the url - https://bbd-laser-tag.onrender.com/


