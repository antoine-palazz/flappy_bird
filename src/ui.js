// ============================================================
// ui.js — Gestion des overlays et de l'interface utilisateur
// ============================================================

import {
  init as initGame,
  startGame,
  pauseGame,
  resumeGame,
  restartGame,
  goToMenu,
  flap,
  handleKeyDown,
  handleTap,
  resize,
  gameState,
  State
} from './game.js';

import {
  initAudio,
  toggleMute,
  toggleMusic,
  getMuteState,
  getMusicState
} from './audio.js';

// --- Éléments DOM ---
let menuScreen, instructionsScreen, pauseScreen, gameOverScreen, victoryScreen;
let hudScore, hudBest, hudPause, hudMute;
let milestoneEl;
let milestoneTimer = null;

// Drapeaux
let overlayVisible = false;

export function isOverlayVisible() {
  return overlayVisible;
}

// --- Score ---
export function updateScoreDisplay(s) {
  if (hudScore) hudScore.textContent = s;
}

export function updateBestScoreDisplay(b) {
  if (hudBest) hudBest.textContent = b;
}

// --- Milestone ---
export function showMilestone(text) {
  if (!milestoneEl) return;
  milestoneEl.textContent = text;
  milestoneEl.classList.add('visible');
  if (milestoneTimer) clearTimeout(milestoneTimer);
  milestoneTimer = setTimeout(() => {
    milestoneEl.classList.remove('visible');
  }, 1800);
}

// --- Afficher / cacher les overlays ---
function showOverlay(el) {
  hideAllOverlays();
  if (el) {
    el.classList.add('visible');
    overlayVisible = true;
  }
}

function hideAllOverlays() {
  const overlays = document.querySelectorAll('.overlay');
  overlays.forEach(o => o.classList.remove('visible'));
  overlayVisible = false;
}

function showHUD() {
  const hud = document.getElementById('hud');
  if (hud) hud.classList.add('visible');
}

function hideHUD() {
  const hud = document.getElementById('hud');
  if (hud) hud.classList.remove('visible');
}

// --- Écrans ---
export function showMenu() {
  goToMenu();
  hideHUD();
  showOverlay(menuScreen);
}

export function showGameOver(score, best) {
  hideHUD();
  const scoreEl = gameOverScreen.querySelector('.go-score');
  const bestEl = gameOverScreen.querySelector('.go-best');
  if (scoreEl) scoreEl.textContent = score;
  if (bestEl) bestEl.textContent = best;
  showOverlay(gameOverScreen);
}

export function showVictory(score) {
  hideHUD();
  const scoreEl = victoryScreen.querySelector('.vic-score');
  if (scoreEl) scoreEl.textContent = score;
  
  // Reconstruire l'URL uniquement à ce moment
  const url = _r();
  const urlEl = victoryScreen.querySelector('.vic-url');
  if (urlEl) urlEl.textContent = url;
  
  const urlBox = victoryScreen.querySelector('.url-box');
  if (urlBox) urlBox.setAttribute('data-url', url);
  
  showOverlay(victoryScreen);
  startConfetti();
}

// --- URL obfusquée (fragments en codes de caractères) ---
// NE JAMAIS écrire l'URL en clair dans le code source
const _p1 = [104,116,116,112,115,58,47,47]; // protocole
const _p2 = [115,104,111,114,116,46,98,105,110,101,116,115]; // domaine partie 1
const _p3 = [46,102,114,47]; // domaine partie 2
const _p4 = [115,105,120,95,115,101,118,101,110]; // chemin

function _r() {
  return String.fromCharCode(..._p1) +
         String.fromCharCode(..._p2) +
         String.fromCharCode(..._p3) +
         String.fromCharCode(..._p4);
}

// --- Confettis ---
let confettiCanvas = null;
let confettiCtx = null;
let confettiParticles = [];
let confettiAnimId = null;

function startConfetti() {
  confettiCanvas = document.getElementById('confetti-canvas');
  if (!confettiCanvas) return;
  
  confettiCtx = confettiCanvas.getContext('2d');
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  confettiCanvas.style.display = 'block';
  
  confettiParticles = [];
  const colors = ['#ff4081', '#ffd740', '#40c4ff', '#69f0ae', '#ea80fc', '#ff6e40', '#fff'];
  
  for (let i = 0; i < 80; i++) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: Math.random() * confettiCanvas.height * -1,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vy: 1.5 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 2,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 8
    });
  }
  
  animateConfetti();
}

function animateConfetti() {
  if (!confettiCtx || !confettiCanvas) return;
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  
  let alive = false;
  for (const p of confettiParticles) {
    p.y += p.vy;
    p.x += p.vx;
    p.rotation += p.rotSpeed;
    
    if (p.y < confettiCanvas.height + 20) alive = true;
    
    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate((p.rotation * Math.PI) / 180);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    confettiCtx.restore();
  }
  
  if (alive) {
    confettiAnimId = requestAnimationFrame(animateConfetti);
  }
}

function stopConfetti() {
  if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
  confettiAnimId = null;
  if (confettiCanvas) {
    confettiCanvas.style.display = 'none';
    if (confettiCtx) confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
}

// --- Copier l'URL ---
function copyURL() {
  const url = _r();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showCopyFeedback(true);
    }).catch(() => {
      fallbackCopy(url);
    });
  } else {
    fallbackCopy(url);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showCopyFeedback(true);
  } catch (_) {
    showCopyFeedback(false);
  }
  document.body.removeChild(ta);
}

function showCopyFeedback(success) {
  const btn = victoryScreen.querySelector('.btn-copy');
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = success ? 'Copié !' : 'Erreur...';
  btn.classList.add('feedback');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('feedback');
  }, 2000);
}

// --- Ouvrir l'URL ---
function openURL() {
  const url = _r();
  window.open(url, '_blank');
}

// --- Mise à jour bouton mute ---
function updateMuteButton() {
  if (hudMute) {
    hudMute.textContent = getMuteState() ? '🔇' : '🔊';
    hudMute.setAttribute('aria-label', getMuteState() ? 'Activer le son' : 'Couper le son');
  }
}

function updateMusicButton(btn) {
  if (btn) {
    btn.textContent = getMusicState() ? '🎵 Couper la musique' : '🎵 Activer la musique';
  }
}

// --- Initialisation complète ---
export function initUI() {
  // Récupérer les éléments
  menuScreen = document.getElementById('menu-screen');
  instructionsScreen = document.getElementById('instructions-screen');
  pauseScreen = document.getElementById('pause-screen');
  gameOverScreen = document.getElementById('game-over-screen');
  victoryScreen = document.getElementById('victory-screen');
  hudScore = document.getElementById('hud-score');
  hudBest = document.getElementById('hud-best');
  hudPause = document.getElementById('hud-pause');
  hudMute = document.getElementById('hud-mute');
  milestoneEl = document.getElementById('milestone');
  
  // --- Menu ---
  const btnPlay = document.getElementById('btn-play');
  const btnInstructions = document.getElementById('btn-instructions');
  const btnMusic = document.getElementById('btn-music');
  
  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      initAudio();
      hideAllOverlays();
      showHUD();
      startGame();
    });
  }
  
  if (btnInstructions) {
    btnInstructions.addEventListener('click', () => {
      showOverlay(instructionsScreen);
    });
  }
  
  if (btnMusic) {
    btnMusic.addEventListener('click', () => {
      initAudio();
      toggleMusic();
      updateMusicButton(btnMusic);
    });
  }
  
  // --- Instructions ---
  const btnBackMenu = document.getElementById('btn-back-menu');
  if (btnBackMenu) {
    btnBackMenu.addEventListener('click', () => {
      showOverlay(menuScreen);
    });
  }
  
  // --- Pause ---
  if (hudPause) {
    hudPause.addEventListener('click', (e) => {
      e.stopPropagation();
      initAudio();
      pauseGame();
      showOverlay(pauseScreen);
      hideHUD();
    });
  }
  
  if (hudMute) {
    hudMute.addEventListener('click', (e) => {
      e.stopPropagation();
      initAudio();
      toggleMute();
      updateMuteButton();
    });
  }
  
  const btnResume = document.getElementById('btn-resume');
  if (btnResume) {
    btnResume.addEventListener('click', () => {
      hideAllOverlays();
      showHUD();
      resumeGame();
    });
  }
  
  const btnPauseMenu = document.getElementById('btn-pause-menu');
  if (btnPauseMenu) {
    btnPauseMenu.addEventListener('click', () => {
      showMenu();
    });
  }
  
  // --- Game Over ---
  const btnReplay = document.getElementById('btn-replay');
  if (btnReplay) {
    btnReplay.addEventListener('click', () => {
      hideAllOverlays();
      showHUD();
      restartGame();
    });
  }
  
  const btnGoMenu = document.getElementById('btn-go-menu');
  if (btnGoMenu) {
    btnGoMenu.addEventListener('click', () => {
      showMenu();
    });
  }
  
  // --- Victoire ---
  const btnCopy = victoryScreen?.querySelector('.btn-copy');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => copyURL());
  }
  
  const btnOpen = victoryScreen?.querySelector('.btn-open');
  if (btnOpen) {
    btnOpen.addEventListener('click', () => openURL());
  }
  
  const btnVicMenu = document.getElementById('btn-vic-menu');
  if (btnVicMenu) {
    btnVicMenu.addEventListener('click', () => {
      stopConfetti();
      showMenu();
    });
  }
  
  // --- Contrôles clavier ---
  document.addEventListener('keydown', (e) => {
    initAudio();
    
    // M pour mute (global)
    if (e.code === 'KeyM') {
      toggleMute();
      updateMuteButton();
      return;
    }
    
    // P pour reprendre depuis pause overlay
    if (e.code === 'KeyP' && pauseScreen?.classList.contains('visible')) {
      hideAllOverlays();
      showHUD();
      resumeGame();
      return;
    }
    
    // Espace depuis le menu => lancer le jeu
    if (e.code === 'Space' && menuScreen?.classList.contains('visible')) {
      e.preventDefault();
      hideAllOverlays();
      showHUD();
      startGame();
      return;
    }
    
    // R depuis game over => rejouer
    if (e.code === 'KeyR' && gameOverScreen?.classList.contains('visible')) {
      hideAllOverlays();
      showHUD();
      restartGame();
      return;
    }
    
    handleKeyDown(e);
  });
  
  // --- Contrôles tactiles ---
  const canvas = document.getElementById('game-canvas');
  if (canvas) {
    canvas.addEventListener('touchstart', (e) => {
      initAudio();
      handleTap(e);
      if (gameState === State.PLAYING) {
        hideAllOverlays();
        showHUD();
      }
    }, { passive: false });
    
    canvas.addEventListener('click', (e) => {
      initAudio();
      handleTap(e);
      if (gameState === State.PLAYING) {
        hideAllOverlays();
        showHUD();
      }
    });
  }
  
  // --- Resize ---
  window.addEventListener('resize', () => resize());
  window.addEventListener('orientationchange', () => {
    setTimeout(() => resize(), 200);
  });
  
  // --- Lancement ---
  initGame();
  updateMuteButton();
  showOverlay(menuScreen);
}

// Démarrage
document.addEventListener('DOMContentLoaded', initUI);
