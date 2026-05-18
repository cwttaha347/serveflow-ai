let audioCtx = null;

/**
 * Pre-warms the AudioContext. 
 * Should be called on the first user interaction (click/tap).
 */
export const warmAudioContext = () => {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
            // Create and stop a silent buffer to "unlock" audio
            const buffer = audioCtx.createBuffer(1, 1, 22050);
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            source.start(0);
        }
    } else if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
};

export const playNotificationSound = () => {
    try {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            audioCtx = new AudioContext();
        }

        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now = audioCtx.currentTime;
        
        // Create professional dual-tone chime
        const playTone = (freq, start, duration, vol) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.5, start + duration);
            
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(vol, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(start);
            osc.stop(start + duration);
        };

        // Two-tone sequence: Bing-Bong
        playTone(880, now, 0.5, 0.1);      // Higher tone
        playTone(660, now + 0.15, 0.6, 0.08); // Lower harmonic tone
        
    } catch (e) {
        console.error("Audio play failed", e);
    }
};
