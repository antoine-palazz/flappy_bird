// ============================================================
// game.js — Moteur de jeu "La Volière du Trésor"
// ============================================================

import { playFlap, playScore, playCrash, playVictory } from './audio.js';
import {
  showGameOver,
  showVictory,
  showMilestone,
  updateScoreDisplay,
  updateBestScoreDisplay,
  isOverlayVisible
} from './ui.js';

// --- État global exporté ---
export const State = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
  VICTORY: 'VICTORY'
};

export let gameState = State.MENU;
export let score = 0;
export let bestScore = parseInt(localStorage.getItem('flappy_best_score') || '0', 10);

// --- Canvas ---
let canvas, ctx;
let W, H; // dimensions actuelles

// --- Constantes de base (ajustées au resize) ---
const BASE_W = 400;
const BASE_H = 700;
let scale = 1;

// Physique
const GRAVITY = 0.45;
const FLAP_FORCE = -7.5;
const TERMINAL_VEL = 10;

// Tuyaux
const BASE_PIPE_SPEED = 2.8;
const BASE_GAP = 155;
const PIPE_WIDTH_RATIO = 0.15; // pourcentage de la largeur
const MIN_GAP = 115;
const PIPE_SPAWN_DIST_RATIO = 0.55; // distance entre tuyaux en % largeur

// Oiseau
const BIRD_W_RATIO = 0.09;
const BIRD_H_RATIO = 0.045;
const BIRD_X_RATIO = 0.22;

// Sol
const GROUND_H_RATIO = 0.1;

// --- Variables de jeu ---
let bird = { x: 0, y: 0, w: 0, h: 0, vy: 0, rotation: 0, wingPhase: 0 };
let pipes = [];
let pipePool = [];
let groundX = 0;
let cloudLayers = [];
let lastTime = 0;
let pipeTimer = 0;
let gameSpeed = 1;
let currentGap = BASE_GAP;
let pipeWidth = 60;
let groundH = 70;
let spawnDist = 220;
let frameCount = 0;
let menuHoverTime = 0;

// Réduction de mouvement
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Difficulté progressive ---
function updateDifficulty() {
  const tier = Math.floor(score / 20);
  switch (tier) {
    case 0: gameSpeed = 1.0; currentGap = BASE_GAP * scale; break;
    case 1: gameSpeed = 1.10; currentGap = 145 * scale; break;
    case 2: gameSpeed = 1.20; currentGap = 135 * scale; break;
    case 3: gameSpeed = 1.30; currentGap = 125 * scale; break;
    default: gameSpeed = 1.35; currentGap = Math.max(MIN_GAP * scale, 115 * scale); break;
  }
  // Assurer un gap minimum jouable
  currentGap = Math.max(currentGap, bird.h * 3.5);
}

// --- Nuages (parallaxe) ---
function initClouds() {
  cloudLayers = [];
  for (let layer = 0; layer < 3; layer++) {
    const clouds = [];
    const count = 3 + layer * 2;
    for (let i = 0; i < count; i++) {
      clouds.push({
        x: Math.random() * W * 1.5,
        y: Math.random() * H * 0.45 + H * 0.02,
        w: (40 + Math.random() * 60) * scale,
        h: (15 + Math.random() * 25) * scale,
        speed: (0.15 + layer * 0.15) * scale
      });
    }
    cloudLayers.push(clouds);
  }
}

// --- Pool de tuyaux ---
function getPipe() {
  if (pipePool.length > 0) return pipePool.pop();
  return { x: 0, gapY: 0, scored: false };
}

function releasePipe(p) {
  pipePool.push(p);
}

function spawnPipe() {
  const p = getPipe();
  const minY = currentGap / 2 + 30 * scale;
  const maxY = H - groundH - currentGap / 2 - 30 * scale;
  p.x = W + pipeWidth;
  p.gapY = minY + Math.random() * (maxY - minY);
  p.scored = false;
  pipes.push(p);
}

// --- Dimensions recalculées ---
export function resize() {
  canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  
  scale = Math.min(W / BASE_W, H / BASE_H);
  scale = Math.max(scale, 0.5);
  
  pipeWidth = Math.round(W * PIPE_WIDTH_RATIO);
  pipeWidth = Math.max(pipeWidth, 40);
  groundH = Math.round(H * GROUND_H_RATIO);
  spawnDist = Math.round(W * PIPE_SPAWN_DIST_RATIO);
  
  bird.w = Math.round(W * BIRD_W_RATIO);
  bird.h = Math.round(H * BIRD_H_RATIO);
  bird.x = Math.round(W * BIRD_X_RATIO);
  bird.w = Math.max(bird.w, 28);
  bird.h = Math.max(bird.h, 20);
  
  currentGap = BASE_GAP * scale;
  currentGap = Math.max(currentGap, bird.h * 3.5);
  
  initClouds();
}

// --- Initialisation ---
export function init() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  resize();
  resetBird();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function resetBird() {
  bird.y = H * 0.4;
  bird.vy = 0;
  bird.rotation = 0;
  bird.wingPhase = 0;
}

// --- Actions ---
export function flap() {
  if (gameState !== State.PLAYING) return;
  bird.vy = FLAP_FORCE * scale;
  bird.wingPhase = 0;
  playFlap();
}

export function startGame() {
  gameState = State.PLAYING;
  score = 0;
  pipes.forEach(releasePipe);
  pipes = [];
  pipeTimer = 0;
  gameSpeed = 1;
  currentGap = BASE_GAP * scale;
  groundX = 0;
  frameCount = 0;
  resetBird();
  updateScoreDisplay(0);
  lastTime = performance.now();
}

export function pauseGame() {
  if (gameState === State.PLAYING) gameState = State.PAUSED;
}

export function resumeGame() {
  if (gameState === State.PAUSED) {
    gameState = State.PLAYING;
    lastTime = performance.now();
  }
}

export function restartGame() {
  startGame();
}

export function goToMenu() {
  gameState = State.MENU;
  pipes.forEach(releasePipe);
  pipes = [];
  resetBird();
}

// --- Milestones ---
const milestones = {
  25: "Pas mal ! Continue comme ça !",
  50: "Ça chauffe ! 🔥",
  75: "Tu es proche du trésor !",
  90: "Presque... Encore un effort !"
};

function checkMilestone() {
  if (milestones[score]) {
    showMilestone(milestones[score]);
  }
}

// --- Boucle de jeu ---
function loop(now) {
  requestAnimationFrame(loop);
  
  const dt = Math.min(now - lastTime, 50); // cap pour éviter les sauts
  lastTime = now;
  const dtFactor = dt / 16.667;
  
  // Toujours dessiner
  draw(dtFactor);
  
  // Mise à jour uniquement en jeu
  if (gameState === State.PLAYING) {
    update(dtFactor);
  } else if (gameState === State.MENU) {
    // Animation douce de l'oiseau sur le menu
    menuHoverTime += dtFactor * 0.05;
    bird.y = H * 0.4 + Math.sin(menuHoverTime) * 12 * scale;
    bird.wingPhase += 0.15 * dtFactor;
    bird.rotation = Math.sin(menuHoverTime * 1.3) * 5;
  }
}

function update(dt) {
  frameCount++;
  
  // Physique oiseau
  bird.vy += GRAVITY * scale * dt;
  bird.vy = Math.min(bird.vy, TERMINAL_VEL * scale);
  bird.y += bird.vy * dt;
  
  // Rotation
  const targetRot = bird.vy < 0 ? -25 : Math.min(bird.vy * 4, 70);
  bird.rotation += (targetRot - bird.rotation) * 0.1 * dt;
  
  // Ailes
  bird.wingPhase += 0.3 * dt;
  
  // Sol / plafond
  if (bird.y + bird.h / 2 >= H - groundH) {
    die();
    return;
  }
  if (bird.y - bird.h / 2 <= 0) {
    bird.y = bird.h / 2;
    bird.vy = 0;
  }
  
  // Tuyaux
  const speed = BASE_PIPE_SPEED * scale * gameSpeed * dt;
  
  pipeTimer += speed;
  if (pipeTimer >= spawnDist) {
    spawnPipe();
    pipeTimer = 0;
  }
  
  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= speed;
    
    // Score
    if (!p.scored && p.x + pipeWidth / 2 < bird.x) {
      p.scored = true;
      score++;
      updateScoreDisplay(score);
      playScore();
      updateDifficulty();
      checkMilestone();
      
      // Victoire !
      if (score >= 100) {
        victory();
        return;
      }
    }
    
    // Suppression
    if (p.x + pipeWidth < -10) {
      pipes.splice(i, 1);
      releasePipe(p);
    }
  }
  
  // Collisions
  if (checkCollision()) {
    die();
    return;
  }
  
  // Sol défilement
  groundX -= speed;
  if (groundX <= -40 * scale) groundX = 0;
}

function checkCollision() {
  // Hitbox réduite pour être indulgent
  const margin = 3 * scale;
  const bx = bird.x - bird.w / 2 + margin;
  const by = bird.y - bird.h / 2 + margin;
  const bw = bird.w - margin * 2;
  const bh = bird.h - margin * 2;
  
  for (const p of pipes) {
    const px = p.x;
    const pw = pipeWidth;
    const topH = p.gapY - currentGap / 2;
    const botY = p.gapY + currentGap / 2;
    
    // Tuyau du haut
    if (bx < px + pw && bx + bw > px && by < topH) return true;
    // Tuyau du bas
    if (bx < px + pw && bx + bw > px && by + bh > botY) return true;
  }
  return false;
}

function die() {
  playCrash();
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('flappy_best_score', String(bestScore));
  }
  updateBestScoreDisplay(bestScore);
  gameState = State.GAME_OVER;
  showGameOver(score, bestScore);
}

function victory() {
  playVictory();
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('flappy_best_score', String(bestScore));
  }
  gameState = State.VICTORY;
  showVictory(score);
}

// --- Dessin ---
function draw(dt) {
  if (!ctx) return;
  
  ctx.clearRect(0, 0, W, H);
  
  drawSky();
  drawClouds(dt);
  drawPipes();
  drawGround();
  drawBird();
  
  // Score pendant le jeu
  if (gameState === State.PLAYING || gameState === State.PAUSED) {
    drawScore();
  }
}

function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, H - groundH);
  grad.addColorStop(0, '#4fc3f7');
  grad.addColorStop(0.5, '#81d4fa');
  grad.addColorStop(1, '#b3e5fc');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H - groundH);
}

function drawClouds(dt) {
  if (prefersReducedMotion) return;
  
  const alphas = [0.3, 0.4, 0.55];
  
  for (let l = 0; l < cloudLayers.length; l++) {
    ctx.fillStyle = `rgba(255,255,255,${alphas[l]})`;
    const layer = cloudLayers[l];
    const moveSpeed = (gameState === State.PLAYING) ? gameSpeed : 0.3;
    
    for (const c of layer) {
      if (gameState === State.PLAYING || gameState === State.MENU) {
        c.x -= c.speed * moveSpeed * dt;
      }
      if (c.x + c.w < 0) {
        c.x = W + Math.random() * 100;
        c.y = Math.random() * H * 0.4 + H * 0.02;
      }
      
      // Nuage : ovales empilés
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w * 0.5, c.h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x - c.w * 0.25, c.y + c.h * 0.1, c.w * 0.35, c.h * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(c.x + c.w * 0.25, c.y + c.h * 0.05, c.w * 0.35, c.h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPipes() {
  for (const p of pipes) {
    const topH = p.gapY - currentGap / 2;
    const botY = p.gapY + currentGap / 2;
    
    // Tuyau du haut
    drawSinglePipe(p.x, 0, pipeWidth, topH, false);
    // Tuyau du bas
    drawSinglePipe(p.x, botY, pipeWidth, H - groundH - botY, true);
  }
}

function drawSinglePipe(x, y, w, h, isBottom) {
  if (h <= 0) return;
  
  const r = Math.min(8 * scale, w / 4);
  const capH = Math.min(22 * scale, h * 0.15);
  const capExtra = 5 * scale;
  
  // Corps du tuyau
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, '#43a047');
  grad.addColorStop(0.3, '#66bb6a');
  grad.addColorStop(0.7, '#43a047');
  grad.addColorStop(1, '#2e7d32');
  ctx.fillStyle = grad;
  
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  
  // Bord
  ctx.strokeStyle = '#1b5e20';
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  
  // Capuchon (embout)
  const capY = isBottom ? y : y + h - capH;
  const capGrad = ctx.createLinearGradient(x - capExtra, 0, x + w + capExtra, 0);
  capGrad.addColorStop(0, '#388e3c');
  capGrad.addColorStop(0.3, '#81c784');
  capGrad.addColorStop(0.7, '#388e3c');
  capGrad.addColorStop(1, '#1b5e20');
  ctx.fillStyle = capGrad;
  
  // Capuchon arrondi
  const cx = x - capExtra;
  const cw = w + capExtra * 2;
  ctx.beginPath();
  ctx.moveTo(cx + r, capY);
  ctx.lineTo(cx + cw - r, capY);
  ctx.arcTo(cx + cw, capY, cx + cw, capY + r, r);
  ctx.lineTo(cx + cw, capY + capH - r);
  ctx.arcTo(cx + cw, capY + capH, cx + cw - r, capY + capH, r);
  ctx.lineTo(cx + r, capY + capH);
  ctx.arcTo(cx, capY + capH, cx, capY + capH - r, r);
  ctx.lineTo(cx, capY + r);
  ctx.arcTo(cx, capY, cx + r, capY, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawGround() {
  const gY = H - groundH;
  
  // Sol principal
  const grad = ctx.createLinearGradient(0, gY, 0, H);
  grad.addColorStop(0, '#8d6e63');
  grad.addColorStop(0.15, '#a1887f');
  grad.addColorStop(0.3, '#6d4c41');
  grad.addColorStop(1, '#4e342e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, gY, W, groundH);
  
  // Herbe
  ctx.fillStyle = '#66bb6a';
  ctx.fillRect(0, gY, W, 8 * scale);
  
  // Motif rayures sol
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;
  const stripe = 40 * scale;
  const offsetX = groundX % stripe;
  for (let i = -1; i < W / stripe + 2; i++) {
    const sx = i * stripe + offsetX;
    ctx.beginPath();
    ctx.moveTo(sx, gY + 8 * scale);
    ctx.lineTo(sx - 15 * scale, H);
    ctx.stroke();
  }
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate((bird.rotation * Math.PI) / 180);
  
  const w = bird.w;
  const h = bird.h;
  
  // Corps (ovale)
  const bodyGrad = ctx.createRadialGradient(0, 0, h * 0.1, 0, 0, w * 0.55);
  bodyGrad.addColorStop(0, '#ffd54f');
  bodyGrad.addColorStop(0.7, '#ffb300');
  bodyGrad.addColorStop(1, '#ff8f00');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e65100';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();
  
  // Aile
  const wingY = Math.sin(bird.wingPhase) * h * 0.2;
  ctx.fillStyle = '#ffa000';
  ctx.beginPath();
  ctx.ellipse(-w * 0.1, wingY, w * 0.22, h * 0.28, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e65100';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Oeil
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(w * 0.18, -h * 0.12, w * 0.1, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Pupille
  ctx.fillStyle = '#212121';
  ctx.beginPath();
  ctx.ellipse(w * 0.22, -h * 0.1, w * 0.05, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Bec
  ctx.fillStyle = '#ff5722';
  ctx.beginPath();
  ctx.moveTo(w * 0.35, -h * 0.05);
  ctx.lineTo(w * 0.55, h * 0.05);
  ctx.lineTo(w * 0.35, h * 0.15);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

function drawScore() {
  const text = String(score);
  const fontSize = Math.round(36 * scale);
  ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  const x = W / 2;
  const y = 20 * scale;
  
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 4 * scale;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y);
}

// --- Entrées ---
// Note : les raccourcis menu/pause/gameover sont gérés dans ui.js
// handleKeyDown ne traite que les contrôles en jeu (overlay fermé)
export function handleKeyDown(e) {
  if (isOverlayVisible()) return;
  
  switch (e.code) {
    case 'Space':
      e.preventDefault();
      flap();
      break;
    case 'KeyP':
      if (gameState === State.PLAYING) pauseGame();
      break;
    case 'KeyR':
      if (gameState === State.PLAYING) {
        restartGame();
      }
      break;
  }
}

export function handleTap(e) {
  if (isOverlayVisible()) return;
  e.preventDefault();
  
  if (gameState === State.MENU) {
    startGame();
  } else if (gameState === State.PLAYING) {
    flap();
  }
}
