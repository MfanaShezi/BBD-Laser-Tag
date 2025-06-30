#!/bin/bash

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "ngrok is not installed. Installing it now..."
    npm install -g ngrok
    
    if [ $? -ne 0 ]; then
        echo "Failed to install ngrok. Please install it manually with 'npm install -g ngrok'"
        exit 1
    fi
fi

# Start the server in the background
echo "Starting the server..."
node server.js &
SERVER_PID=$!

# Wait a moment for the server to start
sleep 2

# Start ngrok
echo "Starting ngrok HTTPS tunnel..."
ngrok http 3000

# When ngrok is terminated (Ctrl+C), kill the server process
kill $SERVER_PID
echo "Server stopped"
