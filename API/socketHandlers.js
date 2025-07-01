module.exports = (io, gameConfig, players, teams) => {

    const rooms = {};

    io.on('connection', (socket) => {
        console.log(`Player connected: ${socket.id}`);

        // Add new player to the players map
        players.set(socket.id, {
            id: socket.id,
            name: `Player ${players.size + 1}`,
            score: 0,
            lastHit: null,
            team: null,
            isActive: true,
            respawnTime: 0,
        });

        // Emit updated player list
        io.emit('playerList', Array.from(players.values()));

        // Handle room creation
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
                mode, // 'single' or 'team'
                players: [],
                spectators: [],
            };

            console.log(`Room created: ${name} (ID: ${roomId}, Mode: ${mode})`);
            console.log('Current rooms:', rooms);

            // Notify the client that the room was created
            socket.emit('roomCreated', rooms[roomId]);

            // Broadcast the updated room list to all clients
            io.emit('roomList', Object.values(rooms));
        });

        // Handle fetching room details
        socket.on('getRoomDetails', ({ roomId }) => {
            console.log(`Fetching details for room ID: ${roomId}`);
            console.log('Current rooms:', rooms);

            const room = rooms[roomId];
            if (!room) {
                socket.emit('roomError', 'Room not found.');
                return;
            }

            // Send room details to the client
            socket.emit('roomDetails', {
                id: room.id,
                name: room.name,
                mode: room.mode, // 'single' or 'team'
                players: room.players,
                spectators: room.spectators,
            });
        });

        // Handle joining a room
        socket.on('joinRoom', ({ roomId, role }) => {
            const room = rooms[roomId];
            if (!room) {
                socket.emit('roomError', 'Room not found.');
                return;
            }

            // Add the player to the room
            if (role === 'player') {
                if (!room.players.includes(socket.id)) {
                    room.players.push(socket.id);
                    console.log(`Player ${socket.id} joined room: ${room.name} (ID: ${roomId}) as a player`);
                }
            } else if (role === 'spectator') {
                if (!room.spectators.includes(socket.id)) {
                    room.spectators.push(socket.id);
                    console.log(`Spectator ${socket.id} joined room: ${room.name} (ID: ${roomId}) as a spectator`);
                }
            } else {
                socket.emit('roomError', 'Invalid role specified.');
                return;
            }

            // Join the socket.io room
            socket.join(roomId);

            // Debug the room state
            console.log('Updated room state:', room);

            // Send room details to the client
            socket.emit('roomDetails', room);

            // Notify the room about the new participant
            io.to(roomId).emit('roomUpdate', {
                roomId: room.id,
                name: room.name,
                mode: room.mode,
                players: room.players,
                spectators: room.spectators,
            });

            // Broadcast the updated room list to all clients
            io.emit('roomList', Object.values(rooms));
        });

        // Handle fetching the list of rooms
        socket.on('getRooms', () => {
            socket.emit('roomList', Object.values(rooms));
        });

        // Handle name change
        socket.on('setName', (name) => {
            const player = players.get(socket.id);
            if (player) {
                player.name = name;

                // Emit updated player list
                io.emit('playerList', Array.from(players.values()));
            }
        });

        // Player joins a team
        socket.on('joinTeam', ({ teamName }) => {
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

            // Emit updated player list
            io.emit('playerList', Array.from(players.values()));
        });

        //Handle room details update
        socket.on('roomDetails', (room) => {
            const roomInfo = document.getElementById('roomInfo');
            const teamButtons = document.getElementById('teamButtons');

            if (room.mode === 'single') {
                roomInfo.textContent = `You have joined the single-player room: ${room.name}`;
                teamButtons.style.display = 'none'; // Hide team buttons for single-player mode
            } else if (room.mode === 'team') {
                roomInfo.textContent = `You have joined the team room: ${room.name}`;
                teamButtons.style.display = 'block'; // Show team buttons for team mode
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            console.log(`Player disconnected: ${socket.id}`);

            // Remove the player from any rooms they were in
            for (const roomId in rooms) {
                const room = rooms[roomId];
                const playerIndex = room.players.indexOf(socket.id);
                const spectatorIndex = room.spectators.indexOf(socket.id);

                if (playerIndex !== -1) {
                    room.players.splice(playerIndex, 1);
                }

                if (spectatorIndex !== -1) {
                    room.spectators.splice(spectatorIndex, 1);
                }

                // Notify the room about the participant leaving
                io.to(roomId).emit('roomUpdate', room);
            }

            // Remove the player from the players map
            players.delete(socket.id);

            // Broadcast the updated player list
            io.emit('playerList', Array.from(players.values()));
        });
    });
};
