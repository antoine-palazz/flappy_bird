// ============================================================
// audio.js — Audio procédural (WebAudio API)
// Musique chiptune + effets sonores
// ============================================================

let audioCtx = null;
let masterGain = null;
let musicGain = null;
let sfxGain = null;
let isMuted = false;
let musicPlaying = false;
let musicNodes = [];
let musicLoopTimeout = null;

// --- Initialisation (doit être appelée suite à un geste utilisateur) ---
function ensureContext() {
  if (audioCtx) {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return;
  }
  
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(audioCtx.destination);
  
  musicGain = audioCtx.createGain();
  musicGain.gain.value = 0.25;
  musicGain.connect(masterGain);
  
  sfxGain = audioCtx.createGain();
  sfxGain.gain.value = 0.5;
  sfxGain.connect(masterGain);
}

export function initAudio() {
  ensureContext();
}

// --- Contrôles ---
export function toggleMute() {
  ensureContext();
  isMuted = !isMuted;
  masterGain.gain.value = isMuted ? 0 : 1;
  return isMuted;
}

export function getMuteState() {
  return isMuted;
}

export function toggleMusic() {
  ensureContext();
  if (musicPlaying) {
    stopMusic();
  } else {
    startMusic();
  }
  return musicPlaying;
}

export function getMusicState() {
  return musicPlaying;
}

// --- Musique chiptune ---
// Mélodie joyeuse en boucle
const MELODY_NOTES = [
  // [fréquence, durée en beats]
  [523, 1], [587, 1], [659, 1], [698, 1],  // Do Ré Mi Fa
  [784, 2], [659, 2],                        // Sol — Mi —
  [523, 1], [587, 1], [659, 1], [523, 1],  // Do Ré Mi Do
  [466, 2], [523, 2],                        // Sib — Do —
  [659, 1], [698, 1], [784, 1], [880, 1],  // Mi Fa Sol La
  [784, 2], [659, 2],                        // Sol — Mi —
  [587, 1], [523, 1], [466, 1], [523, 1],  // Ré Do Sib Do
  [523, 4],                                   // Do ————
];

const BASS_NOTES = [
  [262, 4], [349, 4],  // Do Fa
  [262, 4], [233, 4],  // Do Sib
  [262, 4], [349, 4],  // Do Fa
  [233, 4], [262, 4],  // Sib Do
];

const BPM = 160;
const BEAT_DUR = 60 / BPM;

function startMusic() {
  if (musicPlaying) return;
  ensureContext();
  musicPlaying = true;
  
  playMusicLoop();
}

function playMusicLoop() {
  if (!musicPlaying || !audioCtx) return;
  
  // Nettoyer anciens noeuds
  cleanupMusic();
  
  const now = audioCtx.currentTime + 0.05;
  let melodyTime = now;
  let bassTime = now;
  
  // Durée totale d'une boucle
  let totalBeats = 0;
  for (const [, dur] of MELODY_NOTES) totalBeats += dur;
  const loopDuration = totalBeats * BEAT_DUR;
  
  // Mélodie (onde carrée)
  for (const [freq, dur] of MELODY_NOTES) {
    const noteDur = dur * BEAT_DUR;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, melodyTime);
    gain.gain.linearRampToValueAtTime(0.3, melodyTime + 0.02);
    gain.gain.setValueAtTime(0.3, melodyTime + noteDur - 0.03);
    gain.gain.linearRampToValueAtTime(0, melodyTime + noteDur);
    
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(melodyTime);
    osc.stop(melodyTime + noteDur);
    musicNodes.push(osc, gain);
    
    melodyTime += noteDur;
  }
  
  // Basse (triangle)
  for (const [freq, dur] of BASS_NOTES) {
    const noteDur = dur * BEAT_DUR;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, bassTime);
    gain.gain.linearRampToValueAtTime(0.2, bassTime + 0.03);
    gain.gain.setValueAtTime(0.2, bassTime + noteDur - 0.05);
    gain.gain.linearRampToValueAtTime(0, bassTime + noteDur);
    
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(bassTime);
    osc.stop(bassTime + noteDur);
    musicNodes.push(osc, gain);
    
    bassTime += noteDur;
  }
  
  // Programmer la boucle suivante
  musicLoopTimeout = setTimeout(() => playMusicLoop(), loopDuration * 1000 - 100);
}

function cleanupMusic() {
  if (musicLoopTimeout) {
    clearTimeout(musicLoopTimeout);
    musicLoopTimeout = null;
  }
  for (const node of musicNodes) {
    try {
      if (node.stop) node.stop();
      if (node.disconnect) node.disconnect();
    } catch (_) { /* ignoré */ }
  }
  musicNodes = [];
}

function stopMusic() {
  musicPlaying = false;
  cleanupMusic();
}

// --- Effets sonores ---
export function playFlap() {
  ensureContext();
  if (isMuted) return;
  
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.linearRampToValueAtTime(600, now + 0.08);
  
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.linearRampToValueAtTime(0, now + 0.1);
  
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.1);
}

export function playScore() {
  ensureContext();
  if (isMuted) return;
  
  const now = audioCtx.currentTime;
  
  // Double tonalité "ding"
  for (const freq of [880, 1100]) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }
}

export function playCrash() {
  ensureContext();
  if (isMuted) return;
  
  const now = audioCtx.currentTime;
  
  // Bruit blanc
  const bufferSize = audioCtx.sampleRate * 0.3;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.5;
  }
  
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  
  // Filtre passe-bas
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.linearRampToValueAtTime(200, now + 0.3);
  
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  noise.start(now);
  noise.stop(now + 0.3);
  
  // Tonalité descendante
  const osc = audioCtx.createOscillator();
  const oscGain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.linearRampToValueAtTime(80, now + 0.25);
  oscGain.gain.setValueAtTime(0.15, now);
  oscGain.gain.linearRampToValueAtTime(0, now + 0.25);
  osc.connect(oscGain);
  oscGain.connect(sfxGain);
  osc.start(now);
  osc.stop(now + 0.25);
}

export function playVictory() {
  ensureContext();
  if (isMuted) return;
  
  const now = audioCtx.currentTime;
  const notes = [523, 659, 784, 1047, 1319, 1568]; // Arpège Do majeur
  
  notes.forEach((freq, i) => {
    const t = now + i * 0.12;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = freq;
    
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.03);
    gain.gain.setValueAtTime(0.3, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(t);
    osc.stop(t + 0.5);
  });
  
  // Note finale tenue
  const finalTime = now + notes.length * 0.12;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 1047;
  gain.gain.setValueAtTime(0, finalTime);
  gain.gain.linearRampToValueAtTime(0.25, finalTime + 0.05);
  gain.gain.setValueAtTime(0.25, finalTime + 0.8);
  gain.gain.exponentialRampToValueAtTime(0.001, finalTime + 1.5);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(finalTime);
  osc.stop(finalTime + 1.5);
}

// Nettoyer si la page est déchargée
window.addEventListener('beforeunload', () => {
  stopMusic();
  if (audioCtx) audioCtx.close();
});
