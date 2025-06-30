module.exports = (io, gameConfig, players, teams) => {
    io.on('connection', (socket) => {
        console.log(`Player connected: ${socket.id}`);

        // Room and viewer tracking
        const rooms = {};

        // Create a new room
        socket.on('createRoom', ({ mode, name }) => {
            if (!mode || !name) {
                socket.emit('roomError', 'Room name and mode are required.');
                return;
            }

            // Generate a unique room ID
            const roomId = (Math.random() + 1).toString(36).substring(2);

            // Create the room object
            rooms[roomId] = {
                id: roomId,
                name,
                mode,
                players: [],
                spectators: [],
            };

            console.log(`Room created: ${name} (ID: ${roomId}, Mode: ${mode})`);

            // Notify the client that the room was created
            socket.emit('roomCreated', rooms[roomId]);

            // Broadcast the updated room list to all clients
            io.emit('roomList', Object.values(rooms));
        });

        // Handle joining a room
        socket.on('joinRoom', ({ roomId, role }) => {
            const room = rooms[roomId];

            // Check if the room exists
            if (!room) {
                socket.emit('roomError', 'Room not found.');
                return;
            }

            // Handle joining as a player
            if (role === 'player') {
                if (!room.players.includes(socket.id)) {
                    room.players.push(socket.id);
                    console.log(`Player ${socket.id} joined room: ${room.name} (ID: ${roomId}) as a player`);
                }
            }
            // Handle joining as a spectator
            else if (role === 'spectator') {
                if (!room.spectators.includes(socket.id)) {
                    room.spectators.push(socket.id);
                    console.log(`Spectator ${socket.id} joined room: ${room.name} (ID: ${roomId}) as a spectator`);
                }
            } else {
                socket.emit('roomError', 'Invalid role specified.');
                return;
            }

            // Add the socket to the room
            socket.join(roomId);

            // Notify the room about the new participant
            io.to(roomId).emit('roomUpdate', {
                roomId: room.id,
                name: room.name,
                mode: room.mode,
                players: room.players,
                spectators: room.spectators,
            });
        });

        // Handle fetching the list of rooms
        socket.on('getRooms', () => {
            socket.emit('roomList', Object.values(rooms));
        });

        // Player joins a team
        socket.on('joinTeam', (teamName) => {
            const player = players.get(socket.id);

            if (player) {
                if (player.team && teams[player.team]) {
                    teams[player.team].players.delete(socket.id);
                }

                player.team = teamName;
                teams[teamName].players.add(socket.id);

                socket.emit('teamAssigned', teamName);

                io.emit('playerList', Array.from(players.values()));
                io.emit('teamUpdate', {
                    red: { score: teams.red.score, playerCount: teams.red.players.size },
                    blue: { score: teams.blue.score, playerCount: teams.blue.players.size }
                });
            }
        });

        // Handle player hit
        socket.on('hit', (targetId) => {
            const target = players.get(targetId);
            const shooter = players.get(socket.id);

            if (!target || !shooter || targetId === socket.id || !target.isActive || !shooter.isActive) return;

            if (gameConfig.mode === 'team' && target.team === shooter.team) return;

            shooter.score += 1;
            target.lastHit = shooter.id;

            if (gameConfig.mode === 'team' && shooter.team) {
                teams[shooter.team].score += 1;
            }

            if (gameConfig.mode !== 'freeplay') {
                target.isActive = false;
                target.respawnTime = gameConfig.respawnTime;

                setTimeout(() => {
                    if (players.has(targetId)) {
                        const targetPlayer = players.get(targetId);
                        targetPlayer.isActive = true;
                        targetPlayer.respawnTime = 0;
                        io.to(targetId).emit('respawned');
                        io.emit('playerList', Array.from(players.values()));
                    }
                }, gameConfig.respawnTime * 1000);
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`Player disconnected: ${socket.id}`);

            // Remove the player from any rooms they were in
            for (const roomId in rooms) {
                const room = rooms[roomId];
                const playerIndex = room.players.indexOf(socket.id);
                if (playerIndex !== -1) {
                    room.players.splice(playerIndex, 1);

                    // Notify the room about the player leaving
                    io.to(roomId).emit('roomUpdate', room);

                    // If the room is empty, delete it
                    if (room.players.length === 0 && room.spectators.length === 0) {
                        delete rooms[roomId];
                        console.log(`Room deleted: ${room.name} (ID: ${roomId})`);
                    }
                }

                const spectatorIndex = room.spectators.indexOf(socket.id);
                if (spectatorIndex !== -1) {
                    room.spectators.splice(spectatorIndex, 1);

                    // Notify the room about the spectator leaving
                    io.to(roomId).emit('roomUpdate', room);

                    // If the room is empty, delete it
                    if (room.players.length === 0 && room.spectators.length === 0) {
                        delete rooms[roomId];
                        console.log(`Room deleted: ${room.name} (ID: ${roomId})`);
                    }
                }
            }

            // Broadcast the updated room list to all clients
            io.emit('roomList', Object.values(rooms));

            const player = players.get(socket.id);

            if (player) {
                if (player.team && teams[player.team]) {
                    teams[player.team].players.delete(socket.id);
                }

                players.delete(socket.id);
                io.emit('playerList', Array.from(players.values()));
            }
        });
    });
};
