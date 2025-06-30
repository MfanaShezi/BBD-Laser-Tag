module.exports = (io, gameConfig, players, teams) => {
    io.on('connection', (socket) => {
        console.log(`Player connected: ${socket.id}`);

        // Handle player joining a team
        socket.on('joinTeam', (teamName) => {
            const player = players.get(socket.id);
            if (player) {
                if (player.team && teams[player.team]) teams[player.team].players.delete(socket.id);
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

            if (gameConfig.mode === 'team' && shooter.team) teams[shooter.team].score += 1;

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

        // Handle player disconnect
        socket.on('disconnect', () => {
            console.log(`Player disconnected: ${socket.id}`);
            const player = players.get(socket.id);
            if (player) {
                if (player.team && teams[player.team]) teams[player.team].players.delete(socket.id);
                players.delete(socket.id);
                io.emit('playerList', Array.from(players.values()));
            }
        });
    });
};