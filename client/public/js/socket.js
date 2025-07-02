import { io } from 'socket.io-client';

// Initialize the WebSocket connection
const socket = io();

// Export the socket instance so it can be reused across the app
export default socket;