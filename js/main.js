'use strict';

/* =========================================================
   BATTLEGROUND — match lifecycle, adaptive performance loop
   ========================================================= */

let lastFrame = performance.now();
let rafMode = true;
let fallbackStarted = false;
let countdownHideTimer = null;
let fpsWindowStart = performance.now();
let fpsWindowFrames = 0;
let lowFpsWindows = 0;
let highFpsWindows = 0;
let menuLastRender = 0;

function resetInput() {
  mouse.down = false;
  for (const k in keys) keys[k] = false;
  if (typeof touchState !== 'undefined' && touchState) {
    touchState.firing = false;
    touchState.moveX = 0;
    touchState.moveY = 0;
    touchState.movePointer = null;
    touchState.aimX = 0;
    touchState.aimY = 0;
    touchState.aimActive = false;
    touchState.aimManual = false;
    touchState.aimPointer = null;
  }
  const knob = document.getElementById('moveStickKnob');
  if (knob) knob.style.transform = 'translate(-50%, -50%)';
  const aimKnob = document.getElementById('aimStickKnob');
  if (aimKnob) aimKnob.style.transform = 'translate(-50%, -50%)';
}

function clearCountdownHide() {
  if (countdownHideTimer) {
    clearTimeout(countdownHideTimer);
    countdownHideTimer = null;
  }
}

function startMatch() {
  const mode = getGameMode();
  fpsWindowStart = performance.now();
  fpsWindowFrames = 0;
  lowFpsWindows = 0;
  highFpsWindows = 0;
  liveFps = 0;
  liveFrameMs = 16.7;
  clearCountdownHide();
  for (const key in SFX_LAST) delete SFX_LAST[key];
  if (typeof resetHUDCache === 'function') resetHUDCache();
  ensureAudio();
  resetInput();
  if (typeof isCareerOpen === 'function' && isCareerOpen()) closeCareer();
  if (typeof isArmoryOpen === 'function' && isArmoryOpen()) closeArmory();
  if (typeof isSettingsOpen === 'function' && isSettingsOpen()) closeSettings();

  obstacles = generateObstacles();
  rebuildObstacleGrid();
  barrels = generateBarrels();
  boostPads = generateBoostPads();
  decor = generateDecor();
  player = createPlayer();
  bots = createBots(player.x, player.y);
  pickups = generatePickups();
  addStarterLoot();

  for (const b of bullets) releaseBullet(b);
  bullets = [];
  projectiles = [];
  smokes = [];
  beams = [];
  clearParticles();
  clearDecals();
  texts = [];
  pings = [];
  zone = createZone();
  if (typeof invalidateRenderCaches === 'function') invalidateRenderCaches();

  cam.x = player.x;
  cam.y = player.y;
  cam.leadX = 0;
  cam.leadY = 0;
  cam.kickX = 0;
  cam.kickY = 0;
  game.state = 'countdown';
  game.pausedFrom = null;
  game.countdown = 3.0;
  game.countdownStep = -1;
  game.matchTime = 0;
  game.pendingEnd = null;
  game.placement = 0;
  game.shake = 0;
  game.hurt = 0;
  game.hitmarker = 0;
  game.hitmarkerTotal = 0.14;
  game.hitmarkerKill = false;
  game.hitmarkerCrit = false;
  game.invuln = 0;
  game.killBoost = 1;
  game.killBoostT = 0;
  game.regenDelay = 0;
  game.zoomPunch = 0;
  game.stormPulse = 0;
  game.auraFlash = 0;
  game.damageIndicator = 0;
  game.rewardsBanked = false;
  game.supplyNext = mode.supplyFirst || 55;
  game.nearPickup = null;
  game.rankUpNotice = null;
  game.time = 0;
  if (typeof ensureDailyChallenges === 'function') ensureDailyChallenges();

  UI.feed.innerHTML = '';
  UI.menu.classList.add('hidden');
  UI.pause.classList.add('hidden');
  UI.end.classList.add('hidden');
  if (UI.pickupPrompt) UI.pickupPrompt.classList.add('hidden');
  if (UI.interactTouch) UI.interactTouch.classList.add('hidden');
  UI.countdown.classList.remove('hidden');
  UI.countdown.querySelector('span').textContent = '3';
  UI.stormWarn.classList.remove('show');
  if (UI.streakBanner) UI.streakBanner.classList.remove('show');
  if (toastTimer) clearTimeout(toastTimer);
  UI.toast.className = '';

  document.body.classList.add('in-game', 'playing');
  setMusicMood('battle');
  if (typeof updateAudioMix === 'function') updateAudioMix();
  updateHUD();
}

function beginPlay() {
  game.state = 'playing';
  game.pausedFrom = null;
  if (player && player.alive && typeof spawnParticle === 'function') {
    spawnParticle('wave', player.x, player.y, 0, 0, 0.75, 0.75, 120, player.auraColor, 0);
    spawnParticle('shock', player.x, player.y, 0, 0, 0.5, 0.5, 90, player.auraColor, 0);
  }
  const span = UI.countdown.querySelector('span');
  span.textContent = 'FIGHT';
  span.style.animation = 'none';
  void span.offsetWidth;
  span.style.animation = '';
  clearCountdownHide();
  countdownHideTimer = setTimeout(() => {
    UI.countdown.classList.add('hidden');
    countdownHideTimer = null;
  }, 700);
}

function showEnd(win) {
  game.state = 'over';
  game.pausedFrom = null;
  clearCountdownHide();
  resetInput();
  setMusicMood('menu');
  if (typeof updateAudioMix === 'function') updateAudioMix();
  if (UI.streakBanner) UI.streakBanner.classList.remove('show');
  if (UI.pickupPrompt) UI.pickupPrompt.classList.add('hidden');
  if (UI.interactTouch) UI.interactTouch.classList.add('hidden');
  document.body.classList.remove('playing');
  UI.countdown.classList.add('hidden');
  UI.pause.classList.add('hidden');

  const place = win ? 1 : (game.placement || aliveCount() + 1);
  const kills = player ? player.kills : 0;
  const crits = player ? (player.crits || 0) : 0;
  const matchAura = player ? (player.aura || 0) : 0;
  const damage = player ? (player.damageDealt || 0) : 0;
  const shotsFired = player ? (player.shotsFired || 0) : 0;
  const shotsHit = player ? (player.shotsHit || 0) : 0;
  const longest = player ? (player.longestKill || 0) : 0;
  const accuracy = shotsFired > 0 ? Math.min(100, Math.round((shotsHit / shotsFired) * 100)) : 0;

  let records = {};
  let completedContracts = [];
  if (!game.rewardsBanked) {
    game.rewardsBanked = true;
    if (typeof recordMatchResult === 'function') {
      try {
        const result = recordMatchResult({
          win, placement: place, kills, aura: matchAura,
          damage, shotsFired, shotsHit, longestKill: longest,
          weaponKills: player ? player.weaponKills : null,
        });
        if (result) {
          records = result;
          completedContracts = result.completedContracts || [];
        }
      } catch (e) {
        records = {};
      }
    }
  }
  const lifetime = typeof getProfileEarned === 'function' ? getProfileEarned() : 0;
  const rank = typeof getRank === 'function' ? getRank(lifetime) : null;

  UI.endPlace.textContent = '#' + place;
  UI.endKills.textContent = String(kills);
  UI.endAura.textContent = matchAura.toLocaleString('en-US');
  UI.endTime.textContent = formatTime(game.matchTime);
  if (UI.endDamage) UI.endDamage.textContent = Math.round(damage).toLocaleString('en-US');
  if (UI.endAccuracy) UI.endAccuracy.textContent = accuracy + '%';
  if (UI.endCrits) UI.endCrits.textContent = String(crits);
  if (UI.endLongshot) UI.endLongshot.textContent = longest > 0
    ? Math.round(longest).toLocaleString('en-US') + 'm' : '—';
  if (UI.endLifetime) UI.endLifetime.textContent = lifetime.toLocaleString('en-US');
  if (UI.endRank && rank) {
    UI.endRank.textContent = rank.next
      ? rank.name + ' · ' + Math.round(rank.progress * 100) + '% TO ' + rank.next.name
      : rank.name + ' · MAX RANK';
    UI.endRank.style.color = rank.color;
  }
  const promotion = (typeof game !== 'undefined' && game.rankUpNotice) || records.rankUp || null;
  if (UI.endPromo) {
    UI.endPromo.textContent = promotion ? 'RANK UP · ' + promotion.name : '';
    UI.endPromo.style.display = promotion ? 'block' : 'none';
    if (promotion) UI.endPromo.style.color = promotion.color;
  }
  if (UI.endRecord) {
    const marks = [];
    if (records.newBestKills) marks.push('BEST ' + kills + ' ELIMS');
    if (records.newBestPlacement) marks.push('BEST PLACEMENT #' + place);
    if (records.newBestLongshot) marks.push('LONGEST ' + Math.round(longest) + 'm');
    UI.endRecord.textContent = marks.length ? 'NEW RECORD · ' + marks.join(' · ') : '';
    if (marks.length) sfx('record');
  }
  if (UI.endContracts) {
    UI.endContracts.textContent = completedContracts.length
      ? 'CONTRACT COMPLETE · ' + completedContracts
        .map((c) => c.name + ' +' + c.reward + ' AURA').join(' · ')
      : '';
  }
  UI.endTitle.textContent = win ? 'VICTORY' : 'ELIMINATED';
  UI.endTitle.classList.toggle('win', win);
  UI.endEyebrow.textContent = win ? 'BATTLEGROUND CHAMPION' : 'MATCH OVER';
  if (toastTimer) clearTimeout(toastTimer);
  UI.toast.className = '';
  UI.end.classList.remove('hidden');
}

function quitToMenu() {
  game.state = 'menu';
  game.pausedFrom = null;
  clearCountdownHide();
  game.pendingEnd = null;
  game.matchTime = 0;
  game.nearPickup = null;
  resetInput();
  setMusicMood('menu');
  if (typeof updateAudioMix === 'function') updateAudioMix();
  setupBackdrop();
  if (typeof invalidateRenderCaches === 'function') invalidateRenderCaches();
  document.body.classList.remove('in-game', 'playing');
  UI.menu.classList.remove('hidden');
  UI.pause.classList.add('hidden');
  UI.end.classList.add('hidden');
  UI.countdown.classList.add('hidden');
  if (UI.pickupPrompt) UI.pickupPrompt.classList.add('hidden');
  if (UI.interactTouch) UI.interactTouch.classList.add('hidden');
  UI.feed.innerHTML = '';
  UI.stormWarn.classList.remove('show');
  if (UI.streakBanner) UI.streakBanner.classList.remove('show');
  UI.vignette.style.opacity = '0';
  UI.stormVignette.style.opacity = '0';
  game.auraFlash = 0;
  if (toastTimer) clearTimeout(toastTimer);
  UI.toast.className = '';
  if (typeof ensureDailyChallenges === 'function') ensureDailyChallenges();
  if (typeof saveProfile === 'function') saveProfile();
  if (typeof renderProfileUI === 'function') renderProfileUI();
}

function togglePause() {
  if (game.state === 'playing' || game.state === 'countdown') {
    game.pausedFrom = game.state;
    game.state = 'paused';
    clearCountdownHide();
    resetInput();
    UI.toast.className = '';
    document.body.classList.remove('playing');
    UI.pause.classList.remove('hidden');
    if (typeof updateAudioMix === 'function') updateAudioMix();
  } else if (game.state === 'paused') {
    const resumeState = game.pausedFrom === 'countdown' ? 'countdown' : 'playing';
    game.state = resumeState;
    game.pausedFrom = null;
    lastFrame = performance.now();
    fpsWindowStart = lastFrame;
    fpsWindowFrames = 0;
    lowFpsWindows = 0;
    highFpsWindows = 0;
    document.body.classList.add('playing');
    UI.pause.classList.add('hidden');
    if (typeof updateAudioMix === 'function') updateAudioMix();
  }
}

function handleEscape() {
  if (typeof isSettingsOpen === 'function' && isSettingsOpen()) { closeSettings(); return; }
  if (typeof isArmoryOpen === 'function' && isArmoryOpen()) { closeArmory(); return; }
  if (typeof isCareerOpen === 'function' && isCareerOpen()) { closeCareer(); return; }
  if (game.state === 'playing' || game.state === 'countdown' || game.state === 'paused') togglePause();
}

function handleEnter() {
  if (typeof isSettingsOpen === 'function' && isSettingsOpen()) return;
  if (typeof isArmoryOpen === 'function' && isArmoryOpen()) return;
  if (typeof isCareerOpen === 'function' && isCareerOpen()) return;
  if (game.state === 'menu' || game.state === 'over') startMatch();
  else if (game.state === 'paused') togglePause();
}

function toggleMute() {
  audioMuted = !audioMuted;
  applyAudioSettings();
  updateAudioSettingsUI();
  if (!audioMuted) ensureAudio();
  showToast(audioMuted ? 'SOUND OFF' : 'SOUND ON', 900);
}

/* ---------------------------------------------------------
   Simulation
   --------------------------------------------------------- */
function checkWin() {
  if (game.pendingEnd || !player || !player.alive) return;
  if (bots.every((b) => !b.alive)) {
    game.pendingEnd = { t: 1.0, win: true };
    showToast('VICTORY', 2600, 'gold');
    sfx('win');
  }
}

function updateMatch(dt) {
  const slow = game.pendingEnd ? 0.35 : 1;
  const sdt = dt * slow;
  game.matchTime += sdt;

  updatePlayer(sdt);
  for (let i = 0; i < bots.length; i++) updateBot(bots[i], sdt);
  updateBullets(sdt);
  updateProjectiles(sdt);
  updateSmokes(sdt);
  updateBarrels(sdt);
  updateBoostPads(sdt);
  updatePickups(sdt);
  updateZone(sdt);
  updateFx(sdt);
  updateSupplyDrop(sdt);
  updateCamera(dt);
  checkWin();

  if (game.pendingEnd) {
    game.pendingEnd.t -= dt;
    if (game.pendingEnd.t <= 0) {
      const win = game.pendingEnd.win;
      game.pendingEnd = null;
      showEnd(win);
    }
  }
}

function setCountdownText() {
  const step = Math.max(1, Math.ceil(game.countdown));
  if (step === game.countdownStep) return;
  game.countdownStep = step;
  const span = UI.countdown.querySelector('span');
  span.textContent = String(step);
  span.style.animation = 'none';
  void span.offsetWidth;
  span.style.animation = '';
}

function update(dt) {
  if (game.state === 'paused' || game.state === 'over') return;
  game.time += dt;

  if (game.state === 'menu') {
    updateCamera(dt);
    return;
  }

  if (game.state === 'countdown') {
    if (player && player.alive) {
      const mw = screenToWorld(mouse.x, mouse.y);
      player.angle = Math.atan2(mw.y - player.y, mw.x - player.x);
      player.visAngle = dampAngle(player.visAngle != null ? player.visAngle : player.angle, player.angle, 32, dt);
      player.spawnT = Math.max(0, (player.spawnT || 0) - dt);
      player.walkPhase = (player.walkPhase || 0) + dt * 2.8;
    }
    for (let i = 0; i < bots.length; i++) {
      bots[i].spawnT = Math.max(0, (bots[i].spawnT || 0) - dt);
      bots[i].walkPhase = (bots[i].walkPhase || 0) + dt * 2.8;
    }
    game.countdown -= dt;
    if (game.countdown <= 0) beginPlay();
    else setCountdownText();
    updateCamera(dt);
    return;
  }

  if (game.state === 'playing') updateMatch(dt);
}

/* ---------------------------------------------------------
   Main Loop & Zero-Hitch Adaptive Performance Governor
   --------------------------------------------------------- */
let liveWorkMs = 4;

function tick(now) {
  const rawMs = Math.max(0.5, now - lastFrame);
  const dt = Math.min(rawMs / 1000, 0.05);
  lastFrame = now;

  if (typeof updateMusic === 'function') updateMusic();
  if (game.state === 'paused' || game.state === 'over') return;

  if (game.state === 'menu') {
    const lowTier = getGraphicsSettings().fx < 1;
    if (lowTier && now - menuLastRender < 50) return;
    menuLastRender = now;
    update(dt);
    render();
    return;
  }

  const workStart = performance.now();
  update(dt);
  render();
  const workMs = performance.now() - workStart;
  if (game.state === 'playing' || game.state === 'countdown') {
    trackGraphicsPerformance(now, rawMs, workMs);
  }
}

function trackGraphicsPerformance(now, rawMs, workMs) {
  if (document.hidden) return;
  const elapsed = now - fpsWindowStart;
  // Ignore stalled/suspended browser tabs or screenshot pauses (>2.2s gap)
  // so Auto-Adapt never falsely drops quality after a browser stall.
  if (rawMs > 300 || elapsed > 2200) {
    fpsWindowStart = now;
    fpsWindowFrames = 0;
    return;
  }
  liveFrameMs = liveFrameMs * 0.9 + rawMs * 0.1;
  liveWorkMs = liveWorkMs * 0.88 + workMs * 0.12;
  fpsWindowFrames++;
  if (elapsed < 1000) return;

  const fps = fpsWindowFrames * 1000 / elapsed;
  fpsWindowStart = now;
  fpsWindowFrames = 0;
  liveFps = Math.round(fps);
  updateGraphicsQualityUI();

  if (!userPrefs.autoAdapt) {
    lowFpsWindows = 0;
    highFpsWindows = 0;
    return;
  }

  // Only step down when FPS is genuinely low AND frame/render time confirms GPU/CPU pressure.
  if ((fps < 44 && liveFrameMs > 22) || liveWorkMs > 18) {
    lowFpsWindows++;
    highFpsWindows = 0;
    if (lowFpsWindows >= 2 && adaptiveQualityReduction < GRAPHICS_QUALITY_ORDER.indexOf(graphicsQuality)) {
      lowFpsWindows = 0;
      setAdaptiveQualityReduction(adaptiveQualityReduction + 1);
    }
  } else if (fps > 55 && liveFrameMs < 18.5 && liveWorkMs < 11) {
    highFpsWindows++;
    lowFpsWindows = 0;
    if (highFpsWindows >= 6 && adaptiveQualityReduction > 0) {
      highFpsWindows = 0;
      setAdaptiveQualityReduction(adaptiveQualityReduction - 1);
    }
  } else {
    lowFpsWindows = 0;
    highFpsWindows = 0;
  }
}

function rafLoop(now) {
  if (!rafMode) return;
  tick(now);
  requestAnimationFrame(rafLoop);
}

function startFallbackLoop() {
  if (fallbackStarted) return;
  fallbackStarted = true;
  rafMode = false;
  lastFrame = performance.now();
  setInterval(() => tick(performance.now()), 1000 / 60);
}

/* ---------------------------------------------------------
   Boot & Lifecycle Listeners
   --------------------------------------------------------- */
const handleResize = () => {
  resize();
  if (game.state === 'paused' || game.state === 'over' || game.state === 'menu') render();
};
window.addEventListener('resize', handleResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', handleResize);

window.addEventListener('blur', () => {
  if (game.state === 'playing' || game.state === 'countdown') togglePause();
});
document.addEventListener('visibilitychange', () => {
  lastFrame = performance.now();
  fpsWindowStart = lastFrame;
  fpsWindowFrames = 0;
  lowFpsWindows = 0;
  highFpsWindows = 0;
  liveFps = 0;
  updateGraphicsQualityUI();
  if (document.hidden && (game.state === 'playing' || game.state === 'countdown')) togglePause();
});
document.addEventListener('mouseleave', () => { mouse.down = false; });

document.getElementById('playBtn').addEventListener('click', () => { sfx('ui'); startMatch(); });
document.getElementById('againBtn').addEventListener('click', () => { sfx('ui'); startMatch(); });
document.getElementById('resumeBtn').addEventListener('click', () => { sfx('ui'); togglePause(); });
document.getElementById('quitBtn').addEventListener('click', () => { sfx('ui'); quitToMenu(); });
const endMenuBtn = document.getElementById('endMenuBtn');
if (endMenuBtn) endMenuBtn.addEventListener('click', () => { sfx('ui'); quitToMenu(); });

if (typeof initProfile === 'function') initProfile();
if (typeof updateDeployDeckUI === 'function') updateDeployDeckUI();
if (typeof updateFpsToggleUI === 'function') updateFpsToggleUI();
updateGraphicsQualityUI();
updateAudioSettingsUI();
resize();
setupBackdrop();
requestAnimationFrame(rafLoop);

setTimeout(() => {
  if (rafMode && performance.now() - lastFrame > 1200) startFallbackLoop();
}, 1600);
