
// Sound effects library
const sounds = {
    laser: new Audio('sound/laser.mp3'),
    hit: new Audio('sound/hit.mp3'),
    submachineGun: new Audio('sound/submachine.mp3'),
    guncock: new Audio('sound/guncock.mp3'),
    lobby: new Audio('../sound/lobby.mp3'),
    bgmusic:new Audio('sound/gameplay.mp3')
};

// Play any sound

function playmusic(){
    const sounds= sounds.lobby.cloneNode();
    //const guncock = sounds.guncock.cloneNode();
    sound.play().catch(e => console.log('Sound play error:', e));
}
function playSound(soundKey) {
    if (sounds[soundKey]) {
        const sound = sounds[soundKey].cloneNode();
        sound.play().catch(e => console.log('Sound play error:', e));
    } else {
        console.warn(`Sound "${soundKey}" not found.`);
    }
}

// Play looping background sound
function playBackground(soundKey) {
    if (sounds[soundKey]) {
        const sound = sounds[soundKey].cloneNode();
        sound.loop = true;
        sound.volume = 0.5;
        sound.play().catch(e => console.log('Sound play error:', e));
        return sound; // Return so you can stop it later if needed
    } else {
        console.warn(`Background sound "${soundKey}" not found.`);
    }
}

// Example: Stop a background sound (optional helper)
function stopSound(audioInstance) {
    if (audioInstance) {
        audioInstance.pause();
        audioInstance.currentTime = 0;
    }
}
