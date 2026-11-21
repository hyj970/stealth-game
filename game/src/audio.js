// Procedural sound: every noise is a small WebAudio oscillator, so the game
// ships no audio files. Sounds start only after a user gesture (browsers demand
// it); until then every call is a silent no-op.

/** Make the sound board. `muted` starts false; toggle it with `setMuted`. */
export function makeAudio() {
  let context = null;
  let muted = false;
  let master = null;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  /** Unlock audio from a user gesture (call from a key or click handler). */
  function unlock() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (muted || !ensure() || context.state !== 'running') return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noiseBurst(duration, volume, lowpass) {
    if (muted || !ensure() || context.state !== 'running') return;
    const now = context.currentTime;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
  }

  return {
    unlock,
    /** Mute or unmute everything; returns the new state. */
    setMuted(value) {
      muted = value;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** A soft footstep; quieter while sneaking, louder while running. */
    footstep(sneaking, running) {
      noiseBurst(0.07, sneaking ? 0.05 : running ? 0.22 : 0.12, sneaking ? 500 : 900);
    },
    /** The clink of a thrown coin landing. */
    coinClink() {
      tone(2400, 0.12, 'sine', 0.16, 1500);
      tone(3100, 0.09, 'sine', 0.1, 2200);
    },
    /** A picked-up coin or relic. */
    pickup() {
      tone(660, 0.1, 'sine', 0.18);
      tone(990, 0.16, 'sine', 0.16);
    },
    /** The Moonstone, lifted: a little chime. */
    moonstone() {
      tone(523, 0.14, 'sine', 0.18);
      tone(784, 0.14, 'sine', 0.18);
      tone(1047, 0.28, 'sine', 0.2);
    },
    /** A guard grows suspicious: a short questioning blip. */
    suspicious() {
      tone(440, 0.16, 'triangle', 0.16, 520);
    },
    /** The alarm: a rising two-note sting. */
    alarm() {
      tone(220, 0.22, 'sawtooth', 0.14, 440);
      tone(440, 0.3, 'sawtooth', 0.12, 660);
    },
    /** Caught: a low falling note. */
    caught() {
      tone(330, 0.5, 'sawtooth', 0.16, 110);
    },
    /** Escaped with the prize: a short rising fanfare. */
    win() {
      tone(523, 0.14, 'sine', 0.18);
      tone(659, 0.14, 'sine', 0.18);
      tone(784, 0.14, 'sine', 0.18);
      tone(1047, 0.34, 'sine', 0.22);
    },
  };
}
