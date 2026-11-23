'use strict';

/* =========================================================
   BATTLEGROUND — entities, dual weapons, tactical gadgets,
   destructible cover, explosive barrels, boost pads, AI
   ========================================================= */

let nextEntityId = 1;
const MAX_PARTICLES = 440;
const MAX_DECALS = 200;
const DASH_COOLDOWN = 0.3;
const DASH_IFRAMES = 0.18;
const particlePool = [];
const bulletPool = [];
const decalPool = [];

/* ---------------------------------------------------------
   Object Pools (Bullets, Particles, Decals, Beams)
   --------------------------------------------------------- */
function spawnBullet(opts) {
  const b = bulletPool.pop() || {};
  b.x = opts.x; b.y = opts.y;
  b.startX = opts.x; b.startY = opts.y;
  b.vx = opts.vx; b.vy = opts.vy;
  b.dmg = opts.dmg; b.owner = opts.owner;
  b.weapon = opts.weapon; b.color = opts.color;
  b.travelled = 0; b.maxDist = opts.maxDist; b.angle = opts.angle;
  b.pierce = opts.pierce || 0;
  b.hitId = 0;
  b.beam = !!opts.beam;
  b.knockback = opts.knockback || 0;
  b.explosive = !!opts.explosive;
  b.splashDmg = opts.splashDmg || 0;
  b.splashRadius = opts.splashRadius || 0;
  b.selfDmgMul = opts.selfDmgMul != null ? opts.selfDmgMul : 0.55;
  b.accel = opts.accel || 0;
  b.maxSpeed = opts.maxSpeed || 0;
  b.crateDmgMul = opts.crateDmgMul || 1;
  b.inSafeZone = !!opts.inSafeZone;
  b.smokeT = 0;
  return b;
}

function releaseBullet(b) {
  b.owner = null;
  if (bulletPool.length < 512) bulletPool.push(b);
}

function spawnDecal(type, x, y, r, color, alpha = 0.45, angle = 0) {
  const limit = Math.min(MAX_DECALS, getGraphicsSettings().decals || 0);
  if (limit <= 0) return null;
  let d;
  if (decals.length >= limit) {
    d = decals.shift();
  } else {
    d = decalPool.pop() || {};
  }
  d.type = type;
  d.x = x; d.y = y;
  d.r = r;
  d.color = color;
  d.alpha = alpha;
  d.angle = angle;
  d.life = type === 'scorch' ? 35 : 18;
  d.maxLife = d.life;
  decals.push(d);
  return d;
}

function clearDecals() {
  for (const d of decals) {
    if (decalPool.length < MAX_DECALS) decalPool.push(d);
  }
  decals.length = 0;
}

function trimDecalsToQuality() {
  const limit = Math.min(MAX_DECALS, getGraphicsSettings().decals || 0);
  while (decals.length > limit) {
    const d = decals.shift();
    if (decalPool.length < MAX_DECALS) decalPool.push(d);
  }
}

function spawnBeam(x1, y1, x2, y2, color, width = 3, life = 0.34) {
  if (beams.length >= 24) beams.shift();
  beams.push({ x1, y1, x2, y2, color, width, life, maxLife: life });
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const entityList = [];

function allEntities() {
  entityList.length = 0;
  if (player) entityList.push(player);
  for (const b of bots) entityList.push(b);
  return entityList;
}

function aliveCount() {
  let n = player && player.alive ? 1 : 0;
  for (const b of bots) if (b.alive) n++;
  return n;
}

/* ---------------------------------------------------------
   Entities & Dual-Weapon Loadouts
   --------------------------------------------------------- */
function syncSlotFromEntity(e) {
  if (!e.slots) return;
  const s = e.slots[e.activeSlot];
  if (s) {
    s.weapon = e.weapon;
    s.skin = e.skin;
    s.mag = e.mag;
  }
}

function syncEntityFromSlot(e) {
  if (!e.slots) return;
  const s = e.slots[e.activeSlot];
  if (!s) return;
  e.weapon = s.weapon;
  e.skin = s.skin;
  e.mag = s.mag;
}

function makeEntity(opts) {
  const startWeapon = opts.weapon || 'pistol';
  const startSkin = opts.skin || 'factory';
  const startMag = WEAPONS[startWeapon].mag;
  return {
    id: nextEntityId++,
    name: opts.name,
    x: opts.x, y: opts.y,
    r: 18,
    color: opts.color,
    light: opts.light || '#ffffff',
    operatorId: opts.operatorId || 'cyan',
    operatorName: opts.operatorName || opts.name,
    auraColor: opts.auraColor || opts.color || '#5ee7ff',
    dashDecisionT: rand(0, 0.25),
    dashTrailT: 0,
    isPlayer: !!opts.isPlayer,
    elite: !!opts.elite,
    alive: true,
    hp: 100,
    maxHp: 100,
    hpTrail: 100,
    armor: 0,
    maxArmor: 75,
    speed: opts.speed || 240,
    angle: -Math.PI / 2,
    weapon: startWeapon,
    skin: startSkin,
    mag: startMag,
    slots: [{ weapon: startWeapon, skin: startSkin, mag: startMag }, null],
    activeSlot: 0,
    gadget: 'frag',
    gadgetCharges: opts.isPlayer ? 2 : (opts.elite ? 1 : 0),
    gadgetCd: 0,
    reloading: false,
    reloadT: 0,
    reloadTotal: 1,
    reloadMul: 1,
    dashCdMul: 1,
    critBonus: 0,
    radarRange: 1550,
    inSafeZone: !!opts.inSafeZone,
    safePortalGrace: 0,
    regenDelayBase: 5.5,
    regenCap: 0.7,
    medkitHeal: 40,
    cooldown: 0,
    burstLeft: 0,
    burstT: 0,
    burstAngle: 0,
    spin: 0,
    spinPhase: 0,
    spinSoundT: 0,
    heat: 0,
    triggerHeld: false,
    bloom: 0,
    hitFlash: 0,
    weaponKick: 0,
    weaponChangeT: 0,
    kills: 0,
    crits: 0,
    aura: 0,
    auraT: rand(0, 0.4),
    shotsFired: 0,
    shotsHit: 0,
    damageDealt: 0,
    longestKill: 0,
    skinsFound: 0,
    weaponKills: {},
    killStreak: 0,
    streakT: 0,
    trailT: 0,
    stepT: 0,
    dashCd: 0,
    dashT: 0,
    dashX: 0,
    dashY: 0,
    boostVelX: 0,
    boostVelY: 0,
    boostPadCd: 0,
    jamT: 0,
    slowT: 0,
    speedBoostT: 0,
    // bot AI state
    target: null,
    lootTarget: null,
    coverSpot: null,
    thinkT: rand(0, 0.3),
    reactT: 0,
    aimErr: rand(0.09, 0.2),
    aggression: rand(0.4, 1),
    role: Math.random() < 0.35 ? 'hunter' : 'looter',
    lastHitT: -99,
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    strafeT: rand(0.6, 1.8),
    firePause: 0,
    burst: randInt(2, 5),
    wander: null,
    wanderT: rand(2, 6),
    seed: rand(0, TAU),
    vx: 0,
    vy: 0,
    visAngle: -Math.PI / 2,
    walkPhase: rand(0, TAU),
    bobAmp: 0.45,
    scaleX: 1,
    scaleY: 1,
    scaleVX: 0,
    scaleVY: 0,
    kickPos: 0,
    kickVel: 0,
    muzzleRise: 0,
    flinchX: 0,
    flinchY: 0,
    spawnT: 0.35,
    dashDur: 0.18,
    moveX: 0,
    moveY: 0,
    sprintT: 0,
    ghostT: 0,
  };
}

function createPlayer() {
  const practice = isPracticeMode();
  const pos = practice
    ? { x: SAFE_ZONE.x + 310, y: SAFE_ZONE.y + 545 }
    : spawnPosition(220);
  const operatorId = typeof getEquippedOperatorId === 'function' ? getEquippedOperatorId() : 'cyan';
  const op = typeof getEquippedOperator === 'function'
    ? getEquippedOperator()
    : { name: 'KAI', color: '#17c3e8', light: '#c9f9ff', auraColor: '#5ee7ff' };
  const perk = getPlayerPerk();
  const e = makeEntity({
    name: 'YOU', x: pos.x, y: pos.y,
    operatorId, operatorName: op.name,
    color: op.color, light: op.light, auraColor: op.auraColor,
    isPlayer: true, inSafeZone: practice,
    speed: perk.id === 'scout' ? 288 : 262, weapon: 'pistol',
  });
  if (perk.id === 'vanguard') {
    e.maxArmor = 90;
    e.armor = 30;
  } else if (perk.id === 'striker') {
    e.reloadMul = 0.78;
    e.dashCdMul = 0.75;
    e.critBonus = 0.08;
  } else if (perk.id === 'scout') {
    e.radarRange = 2050;
  } else if (perk.id === 'medic') {
    e.regenDelayBase = 3.5;
    e.regenCap = 0.85;
    e.medkitHeal = 55;
  }
  if (practice) {
    e.armor = e.maxArmor;
    e.safePortalGrace = 0.6;
  }
  return e;
}

function createBots(excludeX, excludeY) {
  const mode = getGameMode();
  const practice = !!mode.practice;
  TOTAL_PLAYERS = mode.players;
  BOT_TOTAL = TOTAL_PLAYERS - 1;
  const names = shuffle(BOT_NAMES);
  const operatorIds = Object.keys(OPERATOR_PRESETS);
  const allWeaponKeys = Object.keys(WEAPONS);
  const royaleStartWeapons = ['pistol', 'pistol', 'smg', 'smg', 'shotgun', 'revolver', 'rifle', 'pulse', 'dmr'];
  const pool = [];
  const placed = [];

  for (let i = 0; i < BOT_TOTAL; i++) {
    let pos = spawnPosition(180);
    for (let tries = 0; tries < 90; tries++) {
      const farFromPlayer = practice || distance(pos.x, pos.y, excludeX, excludeY) > 680;
      const farFromBots = placed.every((p) => distance(pos.x, pos.y, p.x, p.y) > 290);
      if (farFromPlayer && farFromBots) break;
      pos = spawnPosition(180);
    }
    placed.push(pos);
    const weapon = practice ? pick(allWeaponKeys) : pick(royaleStartWeapons);
    const operatorId = pick(operatorIds);
    const operator = OPERATOR_PRESETS[operatorId];
    const elite = Math.random() < mode.eliteChance;
    const b = makeEntity({
      name: (elite ? '★ ' : '') + names[i % names.length],
      x: pos.x, y: pos.y,
      operatorId, operatorName: operator.name,
      color: operator.color, light: operator.light,
      auraColor: elite ? '#ffd166' : operator.auraColor,
      speed: rand(205, 245) * (elite ? 1.1 : 1),
      weapon,
      elite,
    });
    if (elite) {
      b.maxHp = 135;
      b.hp = b.maxHp;
      b.hpTrail = b.maxHp;
      b.maxArmor = 100;
      b.armor = 35;
      b.gadget = Math.random() < 0.7 ? 'frag' : 'emp';
      b.gadgetCharges = 1;
    }
    b.aimErr = rand(elite ? 0.055 : 0.095, elite ? 0.105 : 0.19);
    b.aggression = rand(elite ? 0.7 : 0.45, 1);
    b.skin = elite ? randomSkin(1.6) : (practice ? randomSkin(1.1) : (Math.random() < 0.62 ? 'factory' : randomSkin(0.25)));
    b.slots[0].skin = b.skin;
    b.role = elite || practice ? 'hunter' : (Math.random() < 0.42 ? 'hunter' : 'looter');
    const wDef = WEAPONS[weapon];
    b.burst = wDef.spinUp ? randInt(12, 22) : (wDef.explosive ? 1 : randInt(2, 4));
    pool.push(b);
  }
  return pool;
}

/* ---------------------------------------------------------
   Collision & Spatial Grid Helpers
   --------------------------------------------------------- */
const _collideBuf = [];

function collideEntity(e) {
  const m = 40;
  if (isPracticeMode()) {
    if (e.inSafeZone) {
      const pad = e.r + 12;
      e.x = clamp(e.x, SAFE_ZONE.x + pad, SAFE_ZONE.x + SAFE_ZONE.w - pad);
      e.y = clamp(e.y, SAFE_ZONE.y + pad, SAFE_ZONE.y + SAFE_ZONE.h - pad);
      for (let i = 0; i < safeZoneDummies.length; i++) {
        const d = safeZoneDummies[i];
        if (!d.alive) continue;
        const dx = e.x - d.x;
        const dy = e.y - d.y;
        const minDist = e.r + d.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < minDist * minDist && d2 > 0.0001) {
          const dist = Math.sqrt(d2);
          e.x += (dx / dist) * (minDist - dist);
          e.y += (dy / dist) * (minDist - dist);
        }
      }
      return;
    }
    // Keep combat entities outside the Safe Zone force-field barrier.
    const sx0 = SAFE_ZONE.x - e.r;
    const sx1 = SAFE_ZONE.x + SAFE_ZONE.w + e.r;
    const sy0 = SAFE_ZONE.y - e.r;
    const sy1 = SAFE_ZONE.y + SAFE_ZONE.h + e.r;
    if (e.x > sx0 && e.x < sx1 && e.y > sy0 && e.y < sy1) {
      const left = e.x - sx0;
      const right = sx1 - e.x;
      const top = e.y - sy0;
      const bottom = sy1 - e.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) e.x = sx0;
      else if (min === right) e.x = sx1;
      else if (min === top) e.y = sy0;
      else e.y = sy1;
    }
  }
  e.x = clamp(e.x, m, WORLD - m);
  e.y = clamp(e.y, m, WORLD - m);
  const near = queryObstacles(e.x - e.r - 4, e.y - e.r - 4, e.x + e.r + 4, e.y + e.r + 4, _collideBuf);
  for (let i = 0; i < near.length; i++) {
    const o = near[i];
    if (e.x + e.r < o.x || e.x - e.r > o.x + o.w ||
        e.y + e.r < o.y || e.y - e.r > o.y + o.h) continue;
    const cx = clamp(e.x, o.x, o.x + o.w);
    const cy = clamp(e.y, o.y, o.y + o.h);
    const dx = e.x - cx;
    const dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < e.r * e.r) {
      if (d2 < 0.0001) {
        const left = e.x - o.x;
        const right = o.x + o.w - e.x;
        const top = e.y - o.y;
        const bottom = o.y + o.h - e.y;
        const min = Math.min(left, right, top, bottom);
        if (min === left) e.x = o.x - e.r;
        else if (min === right) e.x = o.x + o.w + e.r;
        else if (min === top) e.y = o.y - e.r;
        else e.y = o.y + o.h + e.r;
      } else {
        const d = Math.sqrt(d2);
        e.x += (dx / d) * (e.r - d);
        e.y += (dy / d) * (e.r - d);
      }
    }
  }
  // Collide cleanly with live fuel barrels too.
  for (let i = 0; i < barrels.length; i++) {
    const bar = barrels[i];
    if (!bar.alive) continue;
    const dx = e.x - bar.x;
    const dy = e.y - bar.y;
    const minDist = e.r + bar.r;
    const d2 = dx * dx + dy * dy;
    if (d2 < minDist * minDist && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      e.x += (dx / d) * (minDist - d);
      e.y += (dy / d) * (minDist - d);
    }
  }
}

function segCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  if (a < 0.000001) return fx * fx + fy * fy <= r * r;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return true;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a);
  const t2 = (-b + sq) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

function lineBlockedBySmoke(x1, y1, x2, y2) {
  for (let i = 0; i < smokes.length; i++) {
    const sm = smokes[i];
    if (sm.life <= 0.4) continue;
    if (segCircle(x1, y1, x2, y2, sm.x, sm.y, sm.r * 0.88)) return true;
  }
  return false;
}

function botLOS(b, t) {
  if (b._losT > 0 && b._losTarget === t) return b._los;
  b._los = !lineBlockedBySmoke(b.x, b.y, t.x, t.y) && hasLOS(b.x, b.y, t.x, t.y);
  b._losTarget = t;
  b._losT = 0.14;
  return b._los;
}

/* ---------------------------------------------------------
   Weapon Handling & Dual-Slot Switching
   --------------------------------------------------------- */
function switchWeapon(slotIdx) {
  const p = player;
  if (!p || !p.alive || game.state !== 'playing') return false;
  if (slotIdx !== 0 && slotIdx !== 1) return false;
  if (slotIdx === p.activeSlot || !p.slots[slotIdx]) return false;
  syncSlotFromEntity(p);
  p.activeSlot = slotIdx;
  syncEntityFromSlot(p);
  p.reloading = false;
  p.reloadT = 0;
  p.burstLeft = 0;
  p.spin = 0;
  p.heat = 0;
  p.spinSoundT = 0;
  p.cooldown = Math.min(p.cooldown, 0.12);
  p.weaponChangeT = 0.22;
  sfx('swap');
  return true;
}

function startReload(e) {
  if (!e || !e.alive) return;
  const w = WEAPONS[e.weapon];
  if (e.reloading || e.mag >= w.mag) return;
  const dur = w.reload * (e.reloadMul || 1);
  e.reloading = true;
  e.reloadT = dur;
  e.reloadTotal = dur;
  e.burstLeft = 0;
  e.spin = 0;
  e.spinSoundT = 0;
  if (e.isPlayer) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const ejectAngle = e.angle + side * Math.PI / 2;
    spawnParticle('casing', e.x + Math.cos(e.angle) * 10, e.y + Math.sin(e.angle) * 10,
      Math.cos(ejectAngle) * 72, Math.sin(ejectAngle) * 72,
      0.32, 0.32, 4.2, '#91d8e6', 5, e.angle);
    sfx('reload');
  }
}

function updateWeapon(e, dt) {
  e.cooldown = Math.max(0, e.cooldown - dt);
  e.gadgetCd = Math.max(0, (e.gadgetCd || 0) - dt);
  e.hitFlash = Math.max(0, e.hitFlash - dt);
  e.dashCd = Math.max(0, e.dashCd - dt);
  e.boostPadCd = Math.max(0, (e.boostPadCd || 0) - dt);
  e.jamT = Math.max(0, (e.jamT || 0) - dt);
  e.slowT = Math.max(0, (e.slowT || 0) - dt);
  e.speedBoostT = Math.max(0, (e.speedBoostT || 0) - dt);
  e.weaponChangeT = Math.max(0, e.weaponChangeT - dt);
  e.spawnT = Math.max(0, (e.spawnT || 0) - dt);
  e.bloom = Math.max(0, (e.bloom || 0) - dt * 0.18);
  e.hpTrail = damp(e.hpTrail != null ? e.hpTrail : e.hp, e.hp, 5.2, dt);

  // Critically damped spring for silky gun kickback recoil.
  const kAccel = -340 * e.kickPos - 28 * e.kickVel;
  e.kickVel += kAccel * dt;
  e.kickPos = clamp(e.kickPos + e.kickVel * dt, -3, 14);
  if (Math.abs(e.kickPos) < 0.02 && Math.abs(e.kickVel) < 0.1) { e.kickPos = 0; e.kickVel = 0; }
  e.weaponKick = Math.max(0, e.kickPos);
  e.muzzleRise *= Math.exp(-18 * dt);

  // Smooth hit-flinch recoil spring decay.
  const flinchDecay = Math.exp(-16 * dt);
  e.flinchX *= flinchDecay;
  e.flinchY *= flinchDecay;

  // Elastic squash-and-stretch spring (dash burst, landing bounce, hit impact).
  const sxA = -260 * (e.scaleX - 1) - 18 * e.scaleVX;
  const syA = -260 * (e.scaleY - 1) - 18 * e.scaleVY;
  e.scaleVX += sxA * dt;
  e.scaleVY += syA * dt;
  e.scaleX = clamp(e.scaleX + e.scaleVX * dt, 0.72, 1.34);
  e.scaleY = clamp(e.scaleY + e.scaleVY * dt, 0.72, 1.34);

  // Smooth visual aim angle (zero lag for actual bullets, butter-smooth gun sweep).
  e.visAngle = dampAngle(e.visAngle != null ? e.visAngle : e.angle, e.angle, e.isPlayer ? 36 : 16, dt);

  // Continuous walk-bob phase (zero phase jump when starting/stopping movement!).
  const speedRatio = clamp(Math.hypot(e.vx || 0, e.vy || 0) / Math.max(1, e.speed), 0, 1.35);
  e.walkPhase = (e.walkPhase || 0) + dt * lerp(2.8, 11.2, clamp(speedRatio, 0, 1));
  e.bobAmp = damp(e.bobAmp != null ? e.bobAmp : 0.45, lerp(0.45, 1.65, clamp(speedRatio, 0, 1)), 10, dt);

  // Decay kinetic boost momentum cleanly.
  if (Math.abs(e.boostVelX) > 4 || Math.abs(e.boostVelY) > 4) {
    e.x += e.boostVelX * dt;
    e.y += e.boostVelY * dt;
    const drag = Math.exp(-5.5 * dt);
    e.boostVelX *= drag;
    e.boostVelY *= drag;
    collideEntity(e);
  } else {
    e.boostVelX = 0;
    e.boostVelY = 0;
  }

  // Handle rotary barrel spin-up, spin-down & thermal heat decay (6-barrel Minigun).
  const curWeapon = WEAPONS[e.weapon];
  if (curWeapon && curWeapon.spinUp) {
    const spooling = e.triggerHeld && e.alive && !e.reloading && e.jamT <= 0 && e.mag > 0;
    if (spooling) {
      e.spin = Math.min(1, (e.spin || 0) + dt / curWeapon.spinUp);
      e.spinPhase = ((e.spinPhase || 0) + dt * (5 + e.spin * 29)) % TAU;
      if (e.spin < 0.98) {
        e.spinSoundT = (e.spinSoundT || 0) - dt;
        if (e.spinSoundT <= 0) {
          e.spinSoundT = 0.15;
          sfx('minigunSpin', e.x, e.y, e.spin);
        }
      }
    } else {
      e.spin = Math.max(0, (e.spin || 0) - dt / (curWeapon.spinDown || 0.85));
      e.spinPhase = ((e.spinPhase || 0) + dt * e.spin * 26) % TAU;
      e.spinSoundT = 0;
    }
    if (!spooling || e.spin < 1) {
      e.heat = Math.max(0, (e.heat || 0) - dt * 0.48);
    }
  } else {
    e.spin = 0;
    e.heat = 0;
    e.spinSoundT = 0;
  }

  // Handle queued multi-shot bursts (Pulse AR).
  if (e.burstLeft > 0 && e.alive && !e.reloading && e.jamT <= 0) {
    e.burstT -= dt;
    if (e.burstT <= 0) {
      e.burstLeft--;
      const w = WEAPONS[e.weapon];
      e.burstT = w.burstGap || 0.055;
      if (e.mag > 0) fireRound(e, e.isPlayer ? e.angle : e.burstAngle, true);
      else e.burstLeft = 0;
    }
  }

  if (!e.isPlayer && e.alive && e.hp < e.maxHp && game.time - e.lastHitT > 6) {
    e.hp = Math.min(e.maxHp, e.hp + 8 * dt);
  }
  if (e.reloading) {
    e.reloadT -= dt;
    if (e.reloadT <= 0) {
      e.reloading = false;
      e.reloadT = 0;
      e.mag = WEAPONS[e.weapon].mag;
      syncSlotFromEntity(e);
      // Tactile magazine lock-in micro-spring.
      e.scaleX = 1.07;
      e.scaleY = 0.94;
      e.kickVel = -45;
      if (e.isPlayer) {
        spawnParticle('shock', e.x, e.y, 0, 0, 0.24, 0.24, 42, '#8defff', 0);
        for (let i = 0; i < 4; i++) {
          const a = e.angle + rand(-0.55, 0.55);
          spawnParticle('spark', e.x + Math.cos(e.angle) * (e.r + 10),
            e.y + Math.sin(e.angle) * (e.r + 10),
            Math.cos(a) * rand(35, 90), Math.sin(a) * rand(35, 90),
            0.16, 0.16, rand(1, 1.8), '#a8f4ff', 5);
        }
        sfx('reloadDone');
      }
    }
  } else if (e.mag <= 0) {
    startReload(e);
  }
}

function fireRound(e, angle, isBurstFollowup = false) {
  const w = WEAPONS[e.weapon];
  if (e.mag <= 0) {
    startReload(e);
    return false;
  }
  const kickImpulse = w.kick * (isBurstFollowup ? 0.65 : 1.0);
  e.kickPos = Math.min(11, e.kickPos + kickImpulse * 0.65);
  e.kickVel = Math.min(140, e.kickVel + kickImpulse * 22);
  e.muzzleRise = clamp(e.muzzleRise + (Math.random() < 0.5 ? 1 : -1) * w.kick * 0.015, -0.14, 0.14);
  e.mag--;
  syncSlotFromEntity(e);
  e.shotsFired += w.pellets;

  const skin = skinInfo(e.skin);
  const dmgMul = 1 + skin.bonus;
  const accent = skin.bonus > 0 ? skin.color : w.color;
  const tracer = skin.bonus > 0 ? skin.color : w.tracer;
  const moving = e.isPlayer && (Math.hypot(e.moveX || 0, e.moveY || 0) > 0.15);
  if (w.heatSpread) {
    e.heat = Math.min(1, (e.heat || 0) + 0.024);
  }
  const spread = (w.spread + (e.bloom || 0) + (e.heat || 0) * (w.heatSpread || 0)) * (moving ? 1.55 : 0.92);
  e.bloom = Math.min(0.06, (e.bloom || 0) + w.spread * 0.35);

  const rawMx = e.x + Math.cos(angle) * (e.r + 16);
  const rawMy = e.y + Math.sin(angle) * (e.r + 16);
  const muzzleBlocked = !hasLOS(e.x, e.y, rawMx, rawMy);
  const mx = muzzleBlocked ? e.x + Math.cos(angle) * (e.r - 2) : rawMx;
  const my = muzzleBlocked ? e.y + Math.sin(angle) * (e.r - 2) : rawMy;
  const flashX = muzzleBlocked ? mx : e.x + Math.cos(angle) * (w.len + 20);
  const flashY = muzzleBlocked ? my : e.y + Math.sin(angle) * (w.len + 20);

  const damageMul = dmgMul * (e === player ? (game.killBoost || 1) : 1);
  for (let i = 0; i < w.pellets; i++) {
    const a = angle + (Math.random() - 0.5) * 2 * spread;
    bullets.push(spawnBullet({
      x: mx, y: my,
      vx: Math.cos(a) * w.speed,
      vy: Math.sin(a) * w.speed,
      dmg: w.dmg * damageMul,
      owner: e,
      weapon: e.weapon,
      color: tracer,
      maxDist: w.range * rand(0.93, 1.05),
      angle: a,
      pierce: w.pierce || 0,
      beam: !!w.beam,
      knockback: w.knockback || 0,
      explosive: !!w.explosive,
      splashDmg: (w.splashDmg || 0) * damageMul,
      splashRadius: w.splashRadius || 0,
      selfDmgMul: w.selfDmgMul != null ? w.selfDmgMul : 0.55,
      accel: w.rocketAccel || 0,
      maxSpeed: w.rocketMaxSpeed || w.speed,
      crateDmgMul: w.crateDmgMul || 1,
      inSafeZone: !!e.inSafeZone,
    }));
  }

  const gfx = getGraphicsSettings();
  const flashScale = w.model === 'shotgun' ? 1.55
    : w.model === 'bazooka' ? 1.95
    : (w.model === 'sniper' || w.model === 'railgun') ? 1.75
    : w.model === 'minigun' ? 1.15
    : w.model === 'lmg' ? 1.18
    : w.model === 'smg' ? 0.85 : 1;
  spawnParticle('flash', flashX, flashY, 0, 0, 0.06, 0.06, 13 * flashScale,
    skin.bonus > 0 ? accent : '#ffe9b0', 0, angle);

  if (w.explosive) {
    // Authentic bazooka rear backblast flame & exhaust plume
    const backX = e.x - Math.cos(angle) * (e.r + 12);
    const backY = e.y - Math.sin(angle) * (e.r + 12);
    spawnParticle('flash', backX, backY, 0, 0, 0.1, 0.1, 18, '#ff9f45', 0, angle + Math.PI);
    spawnParticle('shock', flashX, flashY, 0, 0, 0.22, 0.22, 36, accent, 0);
    const backPuffs = gfx.fx >= 1 ? 5 : 2;
    for (let i = 0; i < backPuffs; i++) {
      const ba = angle + Math.PI + rand(-0.44, 0.44);
      const sp = rand(95, 240);
      spawnParticle('smoke', backX, backY, Math.cos(ba) * sp, Math.sin(ba) * sp,
        rand(0.35, 0.65), 0.65, rand(6, 12), '#98a6ad', 3.5);
    }
  }
  if (w.pellets > 1 && gfx.fx >= 1) {
    spawnParticle('flash', flashX, flashY, 0, 0, 0.05, 0.05, 8 * flashScale,
      accent, 0, angle + Math.PI / 2);
  }
  if (e.isPlayer && (w.model === 'sniper' || w.model === 'railgun') && gfx.fx >= 1) {
    spawnParticle('shock', flashX, flashY, 0, 0, 0.22, 0.22, 34, accent, 0);
  }
  if (e.isPlayer && gfx.fx >= 1 && (w.model !== 'minigun' || Math.random() < 0.45)) {
    spawnParticle('muzzleRing', flashX, flashY, 0, 0, 0.11, 0.11,
      w.model === 'shotgun' || w.model === 'bazooka' ? 28 : 19, accent, 0, angle);
  }
  const sparkCount = w.model === 'minigun' ? (gfx.fx >= 1 ? 2 : 1) : (gfx.fx >= 1 ? 3 : 1);
  for (let i = 0; i < sparkCount; i++) {
    const a = angle + rand(-0.4, 0.4);
    const speed = rand(120, 340);
    spawnParticle('spark', flashX, flashY, Math.cos(a) * speed, Math.sin(a) * speed,
      rand(0.08, 0.17), 0.17, rand(1, 2.2), accent, 6);
  }
  const casingChance = w.explosive ? 0 : (w.model === 'minigun' ? 0.5 : 0.78);
  if (e.isPlayer && gfx.fx >= 1 && Math.random() < casingChance) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const ejectAngle = angle + side * Math.PI / 2;
    spawnParticle('casing', e.x + Math.cos(ejectAngle) * 8, e.y + Math.sin(ejectAngle) * 8,
      Math.cos(ejectAngle) * rand(70, 125) - Math.cos(angle) * 28,
      Math.sin(ejectAngle) * rand(70, 125) - Math.sin(angle) * 28,
      0.46, 0.46, rand(2.4, 3.1), '#ffc96b', 4, angle);
  }
  if (e.isPlayer && gfx.fx >= 2 && !REDUCED_MOTION &&
      (Math.random() < 0.28 || (w.model === 'minigun' && (e.heat || 0) > 0.55 && Math.random() < 0.3))) {
    spawnParticle('smoke', flashX, flashY,
      Math.cos(angle) * rand(18, 50) + rand(-14, 14),
      Math.sin(angle) * rand(18, 50) + rand(-14, 14),
      rand(0.3, 0.52), 0.52, rand(3, 6), '#8fa6ad', 2);
  }

  if (e.isPlayer) {
    game.shake = Math.max(game.shake, w.kick);
    const kickScale = w.model === 'minigun' ? 0.45 : 0.72;
    kickCamera(-Math.cos(angle) * w.kick * kickScale, -Math.sin(angle) * w.kick * kickScale);
  } else {
    addGunPing(e.x, e.y);
  }
  sfx(w.sound, e.x, e.y);

  if (e.mag <= 0) startReload(e);
  return true;
}

function tryFire(e, angle) {
  if (!e.alive || e.reloading || e.cooldown > 0 || e.jamT > 0) return false;
  const w = WEAPONS[e.weapon];
  if (e.mag <= 0) {
    startReload(e);
    return false;
  }
  if (w.spinUp && (e.spin || 0) < 1) return false;
  const botRate = getGameMode().id === 'hardcore' ? 1.85 : 2.15;
  e.cooldown = (60 / w.rpm) * (e.isPlayer ? 1 : botRate);
  if (w.burstCount && w.burstCount > 1) {
    e.burstLeft = w.burstCount - 1;
    e.burstT = w.burstGap || 0.055;
    e.burstAngle = angle;
  }
  return fireRound(e, angle, false);
}

/* ---------------------------------------------------------
   Tactical Gadgets (Frag Grenade, EMP Pulse, Smoke Canister)
   --------------------------------------------------------- */
function throwGadget(e, targetX, targetY) {
  if (!e || !e.alive || e.gadgetCharges <= 0 || e.gadgetCd > 0) return false;
  const g = GADGETS[e.gadget] || GADGETS.frag;
  e.gadgetCharges--;
  e.gadgetCd = 0.65;

  const dx = targetX - e.x;
  const dy = targetY - e.y;
  const rawDist = Math.hypot(dx, dy) || 1;
  const dist = clamp(rawDist, 70, g.throwDist);
  const ux = dx / rawDist;
  const uy = dy / rawDist;
  const speed = clamp(dist * 1.85, 220, 680);

  let spawnX = e.x + ux * (e.r + 10);
  let spawnY = e.y + uy * (e.r + 10);
  if (pointInObstacle(spawnX, spawnY, 7)) {
    spawnX = e.x;
    spawnY = e.y;
  }

  projectiles.push({
    kind: g.id,
    owner: e,
    x: spawnX,
    y: spawnY,
    vx: ux * speed,
    vy: uy * speed,
    z: 10,
    vz: 185,
    fuse: g.fuse,
    maxFuse: g.fuse,
    radius: g.radius,
    color: g.color,
    spin: rand(0, TAU),
  });
  sfx('throw', e.x, e.y);
  return true;
}

function tryUseGadget() {
  const p = player;
  if (!p || !p.alive || game.state !== 'playing') return;
  if (p.gadgetCharges <= 0) {
    sfx('empty');
    return;
  }
  let tx, ty;
  if (touchState && touchState.aimActive) {
    tx = p.x + Math.cos(p.angle) * 320;
    ty = p.y + Math.sin(p.angle) * 320;
  } else {
    const mw = screenToWorld(mouse.x, mouse.y);
    tx = mw.x;
    ty = mw.y;
  }
  throwGadget(p, tx, ty);
}

function explodeArea(x, y, radius, maxDmg, source, tag = 'BLAST', opts = {}) {
  const selfMul = opts.selfDmgMul != null ? opts.selfDmgMul : 0.55;
  const crateMul = opts.crateDmgMul != null ? opts.crateDmgMul : 1.15;
  const kbForce = opts.knockback != null ? opts.knockback : 320;
  const directTarget = opts.directTarget || null;
  const directDmg = opts.directDmg || 0;
  const shotDist = opts.dist != null ? opts.dist : null;

  sfx('explosion', x, y);
  spawnDecal('scorch', x, y, radius * 0.42, '#0a090c', 0.62, rand(0, TAU));
  spawnParticle('wave', x, y, 0, 0, 0.5, 0.5, radius * 1.15, '#ff9f45', 0);
  spawnParticle('shock', x, y, 0, 0, 0.35, 0.35, radius * 0.9, '#ffd166', 0);
  spawnParticle('flash', x, y, 0, 0, 0.14, 0.14, radius * 0.46, '#ffe5a3', 0, rand(0, TAU));

  const gfx = getGraphicsSettings();
  const sparks = gfx.fx >= 2 ? 22 : gfx.fx >= 1 ? 14 : 7;
  for (let i = 0; i < sparks; i++) {
    const a = rand(0, TAU);
    const sp = rand(90, 420);
    spawnParticle(i % 3 === 0 ? 'shard' : 'spark', x, y,
      Math.cos(a) * sp, Math.sin(a) * sp, rand(0.22, 0.6), 0.6,
      rand(2, 4.5), i % 2 ? '#ff7a3d' : '#ffd166', 3.5, a);
  }
  const smokeN = gfx.fx >= 1 ? 7 : 3;
  for (let i = 0; i < smokeN; i++) {
    const a = rand(0, TAU);
    spawnParticle('smoke', x + Math.cos(a) * rand(4, 24), y + Math.sin(a) * rand(4, 24),
      Math.cos(a) * rand(24, 90), Math.sin(a) * rand(24, 90),
      rand(0.55, 1.15), 1.15, rand(12, 24), '#5b636b', 2);
  }

  if (player && player.alive) {
    const pd = distance(x, y, player.x, player.y);
    if (pd < 700) game.shake = Math.max(game.shake, (1 - pd / 700) * 11);
  }

  // Damage entities in blast radius with falloff, direct-hit bonus & knockback.
  const blastInSafe = inSafeZoneRect(x, y, 0);
  let splashHitEnemy = false;
  const r2 = radius * radius;
  const blastTargets = allEntities().slice();
  for (const e of blastTargets) {
    if (!e.alive) continue;
    if (isPracticeMode() && !!e.inSafeZone !== blastInSafe) continue;
    const isDirect = !!(directTarget && e === directTarget);
    const dx = e.x - x;
    const dy = e.y - y;
    const d2 = dx * dx + dy * dy;
    if (!isDirect && d2 > r2) continue;
    const d = Math.sqrt(d2) || 1;
    const falloff = isDirect ? 1 : clamp(1 - (d / radius) * 0.72, 0.28, 1);
    const dmg = (isDirect ? (maxDmg + directDmg) : (maxDmg * falloff)) * (e === source ? selfMul : 1);
    e.boostVelX += (dx / d) * kbForce * falloff;
    e.boostVelY += (dy / d) * kbForce * falloff;
    if (source === player && e !== player) splashHitEnemy = true;
    damage(e, dmg, source, {
      weapon: tag,
      dist: shotDist != null ? shotDist : d,
      blast: true,
      directHit: isDirect,
    });
  }
  // Safe Zone explosions also damage firing-range Target Dummies cleanly.
  if (blastInSafe && safeZoneDummies.length) {
    for (let i = 0; i < safeZoneDummies.length; i++) {
      const dm = safeZoneDummies[i];
      if (!dm.alive) continue;
      const isDirect = !!(directTarget && dm === directTarget);
      const dx = dm.x - x;
      const dy = dm.y - y;
      const d2 = dx * dx + dy * dy;
      if (!isDirect && d2 > r2) continue;
      const d = Math.sqrt(d2) || 1;
      const falloff = isDirect ? 1 : clamp(1 - (d / radius) * 0.72, 0.28, 1);
      const dmg = isDirect ? (maxDmg + directDmg) : (maxDmg * falloff);
      damageDummy(dm, dmg, source, { directHit: isDirect });
    }
  }
  if (opts.countSplashHit && !directTarget && splashHitEnemy && source === player) {
    player.shotsHit++;
  }

  // Shatter nearby destructible crates.
  const nearObs = queryObstacles(x - radius, y - radius, x + radius, y + radius);
  for (let i = 0; i < nearObs.length; i++) {
    const o = nearObs[i];
    if (!o.destructible || o.destroyed) continue;
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    if (distance(x, y, cx, cy) <= radius + Math.max(o.w, o.h) * 0.45) {
      damageObstacle(o, maxDmg * crateMul, source);
    }
  }

  // Chain-detonate nearby fuel barrels with a brief cinematic stagger.
  for (let i = 0; i < barrels.length; i++) {
    const bar = barrels[i];
    if (!bar.alive) continue;
    const d = distance(x, y, bar.x, bar.y);
    if (d <= radius * 1.12) {
      bar.hp = 0;
      bar.chainSource = source;
      if (bar.burnT <= 0) bar.burnT = 0.14;
    }
  }
}

function detonateEMP(x, y, g, source) {
  sfx('emp', x, y);
  spawnDecal('scorch', x, y, g.radius * 0.3, '#0b2030', 0.45, 0);
  spawnParticle('wave', x, y, 0, 0, 0.48, 0.48, g.radius * 1.15, '#5ee7ff', 0);
  spawnParticle('shock', x, y, 0, 0, 0.34, 0.34, g.radius * 0.9, '#b8f7ff', 0);
  for (let i = 0; i < 16; i++) {
    const a = rand(0, TAU);
    const sp = rand(100, 340);
    spawnParticle('spark', x, y, Math.cos(a) * sp, Math.sin(a) * sp,
      rand(0.25, 0.5), 0.5, rand(1.5, 3), '#5ee7ff', 3);
  }
  if (player && player.alive) {
    const pd = distance(x, y, player.x, player.y);
    if (pd < 600) game.shake = Math.max(game.shake, (1 - pd / 600) * 6);
  }
  const r2 = g.radius * g.radius;
  const empTargets = allEntities().slice();
  for (const e of empTargets) {
    if (!e.alive || e === source) continue;
    const d2 = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d2 > r2) continue;
    if (e.armor > 0) {
      const shred = Math.min(e.armor, g.shieldShred);
      e.armor -= shred;
      if (source === player) spawnText(e.x, e.y - 34, '-' + Math.round(shred) + ' ARM', '#5ee7ff', 13, 0.9);
    }
    e.jamT = Math.max(e.jamT, g.jamTime);
    e.slowT = Math.max(e.slowT, g.jamTime + 0.4);
    damage(e, g.maxDmg, source, { weapon: 'EMP', dist: Math.sqrt(d2), blast: true });
    if (source === player) spawnText(e.x, e.y - 48, 'JAMMED', '#7ef2ff', 11, 0.9);
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.fuse -= dt;
    pr.spin += dt * 9;

    // Move + bounce off obstacles & Safe Zone shield barrier.
    const nx = pr.x + pr.vx * dt;
    const ny = pr.y + pr.vy * dt;
    const prInSafe = isPracticeMode() && inSafeZoneRect(pr.x, pr.y, 0);
    const hitSafeX = isPracticeMode() && (inSafeZoneRect(nx, pr.y, prInSafe ? -7 : 7) !== prInSafe);
    const hitSafeY = isPracticeMode() && (inSafeZoneRect(pr.x, ny, prInSafe ? -7 : 7) !== prInSafe);
    if (hitSafeX || pointInObstacle(nx, pr.y, 7) || nx < 45 || nx > WORLD - 45) {
      pr.vx *= -0.58;
      sfx('bounce', pr.x, pr.y);
    } else {
      pr.x = nx;
    }
    if (hitSafeY || pointInObstacle(pr.x, ny, 7) || ny < 45 || ny > WORLD - 45) {
      pr.vy *= -0.58;
      sfx('bounce', pr.x, pr.y);
    } else {
      pr.y = ny;
    }

    // Arc bounce height z
    pr.vz -= 540 * dt;
    pr.z += pr.vz * dt;
    if (pr.z < 0) {
      pr.z = 0;
      if (Math.abs(pr.vz) > 45) {
        pr.vz *= -0.45;
        pr.vx *= 0.72;
        pr.vy *= 0.72;
        sfx('bounce', pr.x, pr.y);
      } else {
        pr.vz = 0;
        pr.vx *= Math.exp(-6 * dt);
        pr.vy *= Math.exp(-6 * dt);
      }
    } else {
      const airDrag = Math.exp(-1.5 * dt);
      pr.vx *= airDrag;
      pr.vy *= airDrag;
    }

    if (pr.fuse <= 0) {
      const g = GADGETS[pr.kind] || GADGETS.frag;
      if (pr.kind === 'frag') {
        explodeArea(pr.x, pr.y, g.radius, g.maxDmg, pr.owner, 'FRAG');
      } else if (pr.kind === 'emp') {
        detonateEMP(pr.x, pr.y, g, pr.owner);
      } else if (pr.kind === 'smoke') {
        sfx('smoke', pr.x, pr.y);
        smokes.push({
          x: pr.x, y: pr.y, r: g.radius,
          life: g.duration, maxLife: g.duration, seed: rand(0, TAU),
        });
        spawnParticle('shock', pr.x, pr.y, 0, 0, 0.35, 0.35, g.radius * 0.7, '#cfe3ea', 0);
      }
      const last = projectiles.pop();
      if (i < projectiles.length) projectiles[i] = last;
    }
  }
}

function updateSmokes(dt) {
  for (let i = smokes.length - 1; i >= 0; i--) {
    smokes[i].life -= dt;
    if (smokes[i].life <= 0) {
      const last = smokes.pop();
      if (i < smokes.length) smokes[i] = last;
    }
  }
}

/* ---------------------------------------------------------
   Destructible Crates, Explosive Fuel Barrels, Boost Pads
   --------------------------------------------------------- */
function damageObstacle(o, dmg, source) {
  if (!o || !o.destructible || o.destroyed) return;
  o.hp -= dmg;
  o.hitFlash = 0.14;
  o.shakeT = 0.22;
  spawnParticle('shard', o.x + rand(8, o.w - 8), o.y + rand(8, o.h - 8),
    rand(-120, 120), rand(-120, 120), rand(0.22, 0.45), 0.45,
    rand(2.5, 4.5), '#b68952', 4, rand(0, TAU));
  if (o.hp <= 0) {
    o.destroyed = true;
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    sfx('crateBreak', cx, cy);
    spawnDecal('crater', cx, cy, Math.min(o.w, o.h) * 0.42, '#2d2215', 0.48, rand(0, TAU));
    for (let i = 0; i < 10; i++) {
      const a = rand(0, TAU);
      const sp = rand(60, 210);
      spawnParticle('shard', cx, cy, Math.cos(a) * sp, Math.sin(a) * sp,
        rand(0.3, 0.65), 0.65, rand(3, 6), i % 2 ? '#a57943' : '#55442c', 3.5, a);
    }
    spawnParticle('dust', cx, cy, 0, 0, 0.45, 0.45, 22, '#9a8262', 2);
    if (Math.random() < 0.68) {
      const roll = Math.random();
      if (roll < 0.28) {
        pickups.push({ kind: 'health', x: cx, y: cy, phase: rand(0, TAU), dropLock: 0.15, spawnT: 0.35 });
      } else if (roll < 0.54) {
        pickups.push({ kind: 'armor', x: cx, y: cy, phase: rand(0, TAU), dropLock: 0.15, spawnT: 0.35 });
      } else if (roll < 0.72) {
        pickups.push({ kind: 'gadget', gadget: pick(['frag', 'emp', 'smoke']), x: cx, y: cy, phase: rand(0, TAU), dropLock: 0.15, spawnT: 0.35 });
      } else {
        const crateWeapons = [
          'smg', 'shotgun', 'revolver',
          'rifle', 'rifle', 'pulse', 'pulse', 'dmr', 'dmr',
          'lmg', 'lmg', 'sniper', 'sniper',
          'bazooka', 'minigun', 'railgun',
        ];
        pickups.push({
          kind: 'weapon',
          weapon: pick(crateWeapons),
          skin: randomSkin(1.4),
          x: cx, y: cy, phase: rand(0, TAU), dropLock: 0.15, spawnT: 0.35,
        });
      }
    }
  }
}

function damageBarrel(bar, dmg, source) {
  if (!bar || !bar.alive) return;
  bar.hp -= dmg;
  bar.hitFlash = 0.14;
  bar.shakeT = 0.22;
  bar.chainSource = source;
  if (bar.hp <= 0) {
    bar.alive = false;
    explodeArea(bar.x, bar.y, 168, 115, source, 'BARREL');
  } else if (bar.hp < bar.maxHp * 0.55 && bar.burnT <= 0) {
    bar.burnT = 1.8;
  }
}

function updateBarrels(dt) {
  for (let i = 0; i < barrels.length; i++) {
    const bar = barrels[i];
    if (!bar.alive) continue;
    if (bar.hitFlash > 0) bar.hitFlash = Math.max(0, bar.hitFlash - dt);
    if (bar.shakeT > 0) bar.shakeT = Math.max(0, bar.shakeT - dt);
    if (bar.burnT > 0) {
      bar.burnT -= dt;
      if (Math.random() < 0.35) {
        spawnParticle('spark', bar.x + rand(-6, 6), bar.y + rand(-6, 6),
          rand(-40, 40), rand(-90, -25), rand(0.18, 0.36), 0.36,
          rand(1.5, 3), '#ff8f3d', 2);
      }
      if (bar.burnT <= 0) {
        bar.alive = false;
        explodeArea(bar.x, bar.y, 168, 115, bar.chainSource || null, 'BARREL');
      }
    }
  }
  for (let i = 0; i < obstacles.length; i++) {
    if (obstacles[i].hitFlash > 0) obstacles[i].hitFlash = Math.max(0, obstacles[i].hitFlash - dt);
    if (obstacles[i].shakeT > 0) obstacles[i].shakeT = Math.max(0, obstacles[i].shakeT - dt);
  }
}

function updateBoostPads(dt) {
  for (let i = 0; i < boostPads.length; i++) {
    const pad = boostPads[i];
    for (const e of allEntities()) {
      if (!e.alive || e.boostPadCd > 0) continue;
      const dx = e.x - pad.x;
      const dy = e.y - pad.y;
      const reach = pad.r + e.r * 0.45;
      if (dx * dx + dy * dy <= reach * reach) {
        e.boostPadCd = 2.6;
        e.boostVelX = Math.cos(pad.angle) * 920;
        e.boostVelY = Math.sin(pad.angle) * 920;
        e.speedBoostT = Math.max(e.speedBoostT, 1.0);
        sfx('boost', pad.x, pad.y);
        spawnParticle('wave', pad.x, pad.y, 0, 0, 0.4, 0.4, 72, '#5ee7ff', 0);
        for (let k = 0; k < 6; k++) {
          spawnParticle('dash', pad.x + rand(-10, 10), pad.y + rand(-10, 10),
            Math.cos(pad.angle) * rand(180, 320), Math.sin(pad.angle) * rand(180, 320),
            rand(0.18, 0.32), 0.32, rand(12, 20), '#5ee7ff', 3, pad.angle);
        }
        if (e.isPlayer) game.zoomPunch = Math.max(game.zoomPunch || 0, 0.018);
      }
    }
  }
}

/* ---------------------------------------------------------
   Dash & Player Update
   --------------------------------------------------------- */
function tryDash() {
  const p = player;
  if (!p || !p.alive || game.state !== 'playing') return;
  if (p.dashCd > 0 || p.dashT > 0) return;
  let dx = 0;
  let dy = 0;
  if (typeof touchState !== 'undefined' && touchState) {
    dx += touchState.moveX;
    dy += touchState.moveY;
  }
  if (keys.KeyW || keys.ArrowUp) dy--;
  if (keys.KeyS || keys.ArrowDown) dy++;
  if (keys.KeyA || keys.ArrowLeft) dx--;
  if (keys.KeyD || keys.ArrowRight) dx++;
  if (!dx && !dy) {
    dx = Math.cos(p.angle);
    dy = Math.sin(p.angle);
  }
  const l = Math.hypot(dx, dy) || 1;
  p.dashX = dx / l;
  p.dashY = dy / l;
  p.dashDur = 0.18;
  p.dashT = p.dashDur;
  p.dashCd = DASH_COOLDOWN * (p.dashCdMul || 1);
  // Dashing briefly disrupts rotary spin-up to keep heavy firepower counterable.
  if (p.spin > 0) p.spin = Math.max(0, p.spin - 0.45);
  // Launch stretch along movement axis for crisp kinetic punch.
  p.scaleX = 1.24;
  p.scaleY = 0.8;
  game.invuln = DASH_IFRAMES;
  game.shake = Math.max(game.shake, 2.2);
  game.zoomPunch = Math.max(game.zoomPunch || 0, 0.012);
  sfx('dash');
  const trail = typeof getEquippedTrail === 'function' ? getEquippedTrail() : null;
  const dashColor = trail && trail.name !== 'NONE' ? trail.color : p.auraColor;
  spawnParticle('shock', p.x, p.y, 0, 0, 0.3, 0.3, 58, dashColor, 0);
  const count = getGraphicsSettings().fx >= 1 ? 8 : 4;
  for (let i = 0; i < count; i++) {
    spawnParticle('dash', p.x + rand(-8, 8), p.y + rand(-8, 8),
      rand(-40, 40) - p.dashX * 120, rand(-40, 40) - p.dashY * 120,
      rand(0.18, 0.32), 0.32, rand(12, 21), dashColor, 4,
      Math.atan2(p.dashY, p.dashX));
  }
}

function updatePlayer(dt) {
  const p = player;
  if (!p) return;
  p.triggerHeld = !!(p.alive && mouse.down && game.state === 'playing' && !p.reloading && p.jamT <= 0 && p.mag > 0);
  updateWeapon(p, dt);
  if (p.streakT > 0) {
    p.streakT = Math.max(0, p.streakT - dt);
    if (p.streakT <= 0) p.killStreak = 0;
  }
  if (!p.alive) return;

  if (touchState && touchState.aimActive) {
    if (touchState.aimManual) {
      p.angle = Math.atan2(touchState.aimY, touchState.aimX);
    } else {
      let nearest = null;
      let nearestD2 = 760 * 760;
      for (const bot of bots) {
        if (!bot.alive) continue;
        const dx = bot.x - p.x;
        const dy = bot.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < nearestD2 && hasLOS(p.x, p.y, bot.x, bot.y)) {
          nearestD2 = d2;
          nearest = bot;
        }
      }
      if (nearest) p.angle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
    }
  } else {
    const mw = screenToWorld(mouse.x, mouse.y);
    p.angle = Math.atan2(mw.y - p.y, mw.x - p.x);
  }

  let dx = 0;
  let dy = 0;
  if (touchState) {
    dx += touchState.moveX;
    dy += touchState.moveY;
  }
  if (keys.KeyW || keys.ArrowUp) dy--;
  if (keys.KeyS || keys.ArrowDown) dy++;
  if (keys.KeyA || keys.ArrowLeft) dx--;
  if (keys.KeyD || keys.ArrowRight) dx++;

  const slowMul = p.slowT > 0 ? 0.62 : 1;
  const boostMul = p.speedBoostT > 0 ? 1.18 : 1;
  const sprint = 1.32;
  const curW = WEAPONS[p.weapon];
  const baseMoveMul = curW && curW.moveMul ? curW.moveMul : 1;
  const weaponMoveMul = curW && curW.firingMoveMul && (p.spin || 0) > 0.12
    ? lerp(baseMoveMul, curW.firingMoveMul, p.spin)
    : baseMoveMul;

  // Smooth exponential acceleration & deceleration — tight response, zero jarring snaps.
  let targetVx = 0;
  let targetVy = 0;
  if (dx || dy) {
    const l = Math.hypot(dx, dy);
    const maxSpeed = p.speed * sprint * slowMul * boostMul * weaponMoveMul;
    targetVx = (dx / l) * maxSpeed;
    targetVy = (dy / l) * maxSpeed;
  }
  const accelRate = (dx || dy) ? 20 : 16;
  p.vx = damp(p.vx || 0, targetVx, accelRate, dt);
  p.vy = damp(p.vy || 0, targetVy, accelRate, dt);
  const speedNow = Math.hypot(p.vx, p.vy);
  if (speedNow > 1.5) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.moveX = damp(p.moveX || 0, p.vx / Math.max(1, p.speed), 14, dt);
    p.moveY = damp(p.moveY || 0, p.vy / Math.max(1, p.speed), 14, dt);
    if (speedNow > 40) {
      p.stepT -= dt;
      if (p.stepT <= 0) {
        p.stepT = 0.17;
        spawnParticle('dust', p.x - (p.vx / speedNow) * 8, p.y - (p.vy / speedNow) * 8,
          rand(-14, 14), rand(-14, 14), rand(0.3, 0.52), 0.52,
          rand(2.5, 4.8), '#8fa6ad', 3);
      }
    }
    if ((dx || dy) && getGraphicsSettings().fx >= 1 && !REDUCED_MOTION) {
      p.sprintT -= dt;
      if (p.sprintT <= 0) {
        p.sprintT = 0.11;
        const ux = p.vx / speedNow;
        const uy = p.vy / speedNow;
        spawnParticle('dash', p.x - ux * (p.r + 6), p.y - uy * (p.r + 6),
          -ux * 120 + rand(-18, 18), -uy * 120 + rand(-18, 18),
          rand(0.14, 0.24), 0.24, rand(7, 12), p.auraColor, 3, Math.atan2(uy, ux));
      }
    }
  } else {
    p.vx = 0;
    p.vy = 0;
    p.moveX = damp(p.moveX || 0, 0, 12, dt);
    p.moveY = damp(p.moveY || 0, 0, 12, dt);
  }

  if (p.dashT > 0) {
    const prog = clamp(p.dashT / Math.max(0.01, p.dashDur || 0.18), 0, 1);
    p.dashT -= dt;
    p.ghostT -= dt;
    if (p.ghostT <= 0) {
      p.ghostT = 0.026;
      spawnParticle('planetGhost', p.x, p.y, 0, 0, 0.26, 0.26, p.r, p.operatorId, 0, 0);
    }
    // Smooth eased dash curve: fast burst tapering gracefully into landing.
    const dashSpd = 910 * (0.42 + 0.58 * prog);
    p.x += p.dashX * dashSpd * dt;
    p.y += p.dashY * dashSpd * dt;
    collideEntity(p);
    if (p.dashT <= 0) {
      // Smooth elastic landing squash bounce.
      p.scaleX = 0.88;
      p.scaleY = 1.13;
      spawnParticle('shock', p.x, p.y, 0, 0, 0.32, 0.32, 52, p.auraColor, 0);
      if (getGraphicsSettings().fx >= 1) {
        for (let i = 0; i < 4; i++) {
          const a = rand(0, TAU);
          spawnParticle('dust', p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12,
            Math.cos(a) * rand(30, 90), Math.sin(a) * rand(30, 90),
            rand(0.28, 0.48), 0.48, rand(3, 5.5), '#8fa6ad', 2.5);
        }
      }
    }
  } else if (speedNow > 1.5) {
    collideEntity(p);
  }

  const trail = typeof getEquippedTrail === 'function' ? getEquippedTrail() : null;
  if (trail && trail.name !== 'NONE' && speedNow > 45 && getGraphicsSettings().fx >= 1) {
    p.trailT -= dt;
    if (p.trailT <= 0) {
      p.trailT = 0.046;
      spawnParticle('ghost', p.x + rand(-3, 3), p.y + rand(-3, 3),
        rand(-8, 8), rand(-8, 8), rand(0.22, 0.38), 0.38,
        rand(5, 9), Math.random() < 0.3 ? trail.light : trail.color, 2.5);
    }
  }

  updateAuraMotes(p, dt);

  if (mouse.down && game.state === 'playing') tryFire(p, p.angle);
}

/* ---------------------------------------------------------
   Bot AI (Spatial-Grid Accelerated, Loot & Grenade Aware)
   --------------------------------------------------------- */
function acquireTarget(b) {
  let best = null;
  let bestScore = Infinity;
  const practice = isPracticeMode();
  const lateGame = practice || (zone && zone.phase >= 2);
  const recentlyHit = game.time - b.lastHitT < 4;
  let acquireRange;
  if (recentlyHit) acquireRange = 560;
  else if (!practice && game.matchTime < 18) acquireRange = 175;
  else if (lateGame) acquireRange = 480;
  else acquireRange = b.role === 'hunter' ? 320 + b.aggression * 170 : 170 + b.aggression * 110;
  const range2 = acquireRange * acquireRange;
  for (const o of allEntities()) {
    if (o === b || !o.alive || o.inSafeZone) continue;
    const dx = o.x - b.x;
    const dy = o.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > range2) continue;
    if (lineBlockedBySmoke(b.x, b.y, o.x, o.y)) continue;
    if (!hasLOS(b.x, b.y, o.x, o.y)) continue;
    const d = Math.sqrt(d2);
    let score = d;
    if (o === player) score *= 0.86;
    if (o.hp < 35) score *= 0.88;
    if (score < bestScore) {
      bestScore = score;
      best = o;
    }
  }
  if (best) {
    b._los = true;
    b._losTarget = best;
    b._losT = 0.1;
  }
  if (best && best !== b.target) b.reactT = rand(0.8, 1.65);
  b.target = best;
}

function findBotLoot(b) {
  let best = null;
  let bestScore = Infinity;
  const curW = WEAPONS[b.weapon];
  const curS = skinInfo(b.skin);
  const needHp = b.hp < b.maxHp * 0.65;
  const needArm = b.armor < b.maxArmor * 0.6;
  const maxR = b.role === 'looter' ? 460 : 300;
  const maxR2 = maxR * maxR;
  for (let i = 0; i < pickups.length; i++) {
    const p = pickups[i];
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d2 = dx * dx + dy * dy;
    if (!p.supply && d2 > maxR2) continue;
    if (p.supply && d2 > 680 * 680) continue;
    // Don't wander outside the safe circle or into the Practice Safe Zone for loot.
    if (isPracticeMode() && inSafeZoneRect(p.x, p.y, 24)) continue;
    if (zone && (p.x - zone.x) * (p.x - zone.x) + (p.y - zone.y) * (p.y - zone.y) > zone.r * zone.r) continue;
    let useful = false;
    let prio = 1;
    if (p.kind === 'health' && needHp) { useful = true; prio = 0.55; }
    else if (p.kind === 'armor' && needArm) { useful = true; prio = 0.72; }
    else if (p.kind === 'weapon') {
      const nw = WEAPONS[p.weapon];
      const ns = skinInfo(p.skin);
      if (nw.tier > curW.tier || (nw.tier === curW.tier && ns.bonus > curS.bonus + 0.01)) {
        useful = true;
        prio = p.supply ? 0.5 : 0.85;
      }
    }
    if (!useful) continue;
    const score = Math.sqrt(d2) * prio;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  b.lootTarget = best;
}

const _coverBuf = [];

function findBotCover(b, threat) {
  const near = queryObstacles(b.x - 270, b.y - 270, b.x + 270, b.y + 270, _coverBuf);
  for (let i = 0; i < near.length; i++) {
    const o = near[i];
    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2;
    if (distance(b.x, b.y, cx, cy) > 260) continue;
    const awayA = Math.atan2(cy - threat.y, cx - threat.x);
    const sx = clamp(cx + Math.cos(awayA) * (Math.max(o.w, o.h) * 0.55 + b.r + 8), 90, WORLD - 90);
    const sy = clamp(cy + Math.sin(awayA) * (Math.max(o.w, o.h) * 0.55 + b.r + 8), 90, WORLD - 90);
    if (!pointInObstacle(sx, sy, b.r * 0.6) && !hasLOS(sx, sy, threat.x, threat.y)) {
      return { x: sx, y: sy };
    }
  }
  return null;
}

function findIncomingBullet(e) {
  for (let i = 0; i < bullets.length; i++) {
    const bullet = bullets[i];
    if (bullet.owner === e) continue;
    const speed2 = bullet.vx * bullet.vx + bullet.vy * bullet.vy;
    if (speed2 < 1) continue;
    const rx = e.x - bullet.x;
    const ry = e.y - bullet.y;
    const time = (rx * bullet.vx + ry * bullet.vy) / speed2;
    const horizon = bullet.explosive ? 0.38 : 0.18;
    if (time <= 0 || time > horizon) continue;
    const radius = e.r + (bullet.explosive ? 38 : 11);
    const dx = rx - bullet.vx * time;
    const dy = ry - bullet.vy * time;
    if (dx * dx + dy * dy <= radius * radius) return bullet;
  }
  return null;
}

function findDangerousProjectile(e) {
  for (let i = 0; i < projectiles.length; i++) {
    const pr = projectiles[i];
    if (pr.kind === 'smoke') continue;
    const r = pr.radius + 26;
    const dx = e.x - pr.x;
    const dy = e.y - pr.y;
    if (dx * dx + dy * dy <= r * r) return pr;
  }
  return null;
}

function tryBotDash(b, target, targetDist, weapon, inStorm, dangerProj, dx, dy, dt) {
  b.dashDecisionT -= dt;
  if (b.dashDecisionT > 0) return false;
  b.dashDecisionT = rand(0.08, 0.16);
  if (b.dashCd > 0 || b.dashT > 0) return false;

  const threat = findIncomingBullet(b);
  const recentlyHit = game.time - b.lastHitT < 0.42 && target && target.alive;
  const tooClose = target && targetDist < Math.max(110, weapon.pref * 0.42) && targetDist > 82;
  const closingGap = target && targetDist > weapon.pref * 1.35 &&
    targetDist < 380 && botLOS(b, target) && Math.random() < 0.035;
  const escapeStorm = inStorm && zone && distance(b.x, b.y, zone.x, zone.y) < zone.r + 170;
  if (!dangerProj && !threat && !recentlyHit && !tooClose && !closingGap && !escapeStorm) return false;

  let dashX = dx;
  let dashY = dy;
  if (dangerProj) {
    dashX = b.x - dangerProj.x;
    dashY = b.y - dangerProj.y;
  } else if (threat) {
    const speed = Math.hypot(threat.vx, threat.vy) || 1;
    dashX = (-threat.vy / speed) * b.strafeDir;
    dashY = (threat.vx / speed) * b.strafeDir;
  } else if (escapeStorm) {
    dashX = zone.x - b.x;
    dashY = zone.y - b.y;
  } else if (tooClose) {
    dashX = b.x - target.x;
    dashY = b.y - target.y;
  } else if (recentlyHit && target) {
    const angle = Math.atan2(target.y - b.y, target.x - b.x) + b.strafeDir * Math.PI / 2;
    dashX = Math.cos(angle);
    dashY = Math.sin(angle);
  }

  const length = Math.hypot(dashX, dashY);
  if (length < 0.01) return false;
  dashX /= length;
  dashY /= length;
  if (pointInObstacle(b.x + dashX * 54, b.y + dashY * 54, b.r * 0.55)) {
    dashX *= -1;
    dashY *= -1;
    if (pointInObstacle(b.x + dashX * 54, b.y + dashY * 54, b.r * 0.55)) return false;
  }

  b.dashX = dashX;
  b.dashY = dashY;
  b.dashT = 0.16;
  b.dashCd = rand(1.8, 2.8);
  b.dashTrailT = 0;
  spawnParticle('shock', b.x, b.y, 0, 0, 0.27, 0.27, 44, b.auraColor, 0);
  if (getGraphicsSettings().fx >= 1) {
    for (let i = 0; i < 4; i++) {
      spawnParticle('dash', b.x + rand(-5, 5), b.y + rand(-5, 5),
        -dashX * rand(70, 130) + rand(-24, 24),
        -dashY * rand(70, 130) + rand(-24, 24),
        rand(0.16, 0.26), 0.26, rand(10, 17), b.auraColor, 4,
        Math.atan2(dashY, dashX));
    }
  }
  return true;
}

const _steerBuf = [];

function updateBot(b, dt) {
  if (!b.alive) return;
  updateWeapon(b, dt);
  updateAuraMotes(b, dt);
  if (b._losT > 0) b._losT -= dt;

  b.thinkT -= dt;
  if (b.thinkT <= 0) {
    b.thinkT = rand(0.22, 0.42);
    acquireTarget(b);
    if (!b.target) findBotLoot(b);
    else b.lootTarget = null;
    if (b.target && (b.hp < b.maxHp * 0.34 || b.reloading)) {
      b.coverSpot = findBotCover(b, b.target);
    } else {
      b.coverSpot = null;
    }
    // Elite bots can flush targets behind cover with a Frag/EMP!
    if (b.elite && b.gadgetCharges > 0 && b.gadgetCd <= 0 && b.target && b.target.alive) {
      const td = distance(b.x, b.y, b.target.x, b.target.y);
      if (td > 165 && td < 360 && !botLOS(b, b.target) && Math.random() < 0.22) {
        throwGadget(b, b.target.x + rand(-25, 25), b.target.y + rand(-25, 25));
      }
    }
  }
  if (b.target && (!b.target.alive || b.target.inSafeZone)) b.target = null;

  const t = b.target;
  const z = zone;
  const w = WEAPONS[b.weapon];
  const dz = z ? distance(b.x, b.y, z.x, z.y) : 0;
  const inStorm = z ? dz > z.r - 55 : false;
  const targetDist = t ? distance(b.x, b.y, t.x, t.y) : Infinity;
  const dangerProj = findDangerousProjectile(b);

  let tx = null;
  let ty = null;

  if (dangerProj) {
    tx = b.x + (b.x - dangerProj.x) * 2;
    ty = b.y + (b.y - dangerProj.y) * 2;
  } else if (inStorm && z) {
    tx = z.x;
    ty = z.y;
  } else if (b.coverSpot && t) {
    tx = b.coverSpot.x;
    ty = b.coverSpot.y;
  } else if (t) {
    const sight = botLOS(b, t);
    if (!sight || targetDist > w.pref) {
      tx = t.x;
      ty = t.y;
    } else if (targetDist < w.pref * 0.5) {
      tx = b.x - (t.x - b.x);
      ty = b.y - (t.y - b.y);
    } else {
      b.strafeT -= dt;
      if (b.strafeT <= 0) {
        b.strafeDir *= -1;
        b.strafeT = rand(0.8, 2.0);
      }
      const a = Math.atan2(t.y - b.y, t.x - b.x) + (Math.PI / 2) * b.strafeDir;
      tx = b.x + Math.cos(a) * 140;
      ty = b.y + Math.sin(a) * 140;
    }
  } else if (b.lootTarget && pickups.includes(b.lootTarget)) {
    tx = b.lootTarget.x;
    ty = b.lootTarget.y;
  } else {
    b.wanderT -= dt;
    if (!b.wander || b.wanderT <= 0 || distance(b.x, b.y, b.wander.x, b.wander.y) < 80) {
      if (z) {
        const a = rand(0, TAU);
        const rr = rand(80, Math.max(180, Math.min(z.r * 0.72, 1100)));
        b.wander = {
          x: clamp(z.x + Math.cos(a) * rr, 140, WORLD - 140),
          y: clamp(z.y + Math.sin(a) * rr, 140, WORLD - 140),
        };
      } else {
        b.wander = spawnPosition(180);
      }
      b.wanderT = rand(5, 9);
    }
    tx = b.wander.x;
    ty = b.wander.y;
  }

  let dx = 0;
  let dy = 0;
  if (tx != null) {
    dx = tx - b.x;
    dy = ty - b.y;
  }
  const dl = Math.hypot(dx, dy);
  if (dl > 1) { dx /= dl; dy /= dl; }
  else { dx = 0; dy = 0; }

  // Spatial-grid obstacle steering
  const steerNear = b.r + 64;
  const steerNear2 = steerNear * steerNear;
  const nearObs = queryObstacles(b.x - steerNear, b.y - steerNear, b.x + steerNear, b.y + steerNear, _steerBuf);
  for (let i = 0; i < nearObs.length; i++) {
    const o = nearObs[i];
    const cx = clamp(b.x, o.x, o.x + o.w);
    const cy = clamp(b.y, o.y, o.y + o.h);
    let ox = b.x - cx;
    let oy = b.y - cy;
    const od2 = ox * ox + oy * oy;
    if (od2 >= steerNear2) continue;
    let od = Math.sqrt(od2);
    if (od < 0.01) {
      ox = Math.cos(b.seed);
      oy = Math.sin(b.seed);
      od = 1;
    }
    const f = (steerNear - od) / steerNear;
    dx += (ox / od) * f * 1.6;
    dy += (oy / od) * f * 1.6;
  }

  // Steer bots gently away from the Practice Safe Zone perimeter.
  if (isPracticeMode()) {
    const cx = clamp(b.x, SAFE_ZONE.x, SAFE_ZONE.x + SAFE_ZONE.w);
    const cy = clamp(b.y, SAFE_ZONE.y, SAFE_ZONE.y + SAFE_ZONE.h);
    const sx = b.x - cx;
    const sy = b.y - cy;
    const sd2 = sx * sx + sy * sy;
    if (sd2 < steerNear2 && sd2 > 0.0001) {
      const sd = Math.sqrt(sd2);
      const f = (steerNear - sd) / steerNear;
      dx += (sx / sd) * f * 2.2;
      dy += (sy / sd) * f * 2.2;
    }
  }

  // Separation from other operators
  for (const o of allEntities()) {
    if (o === b || !o.alive) continue;
    const ox = b.x - o.x;
    const oy = b.y - o.y;
    const sd2 = ox * ox + oy * oy;
    if (sd2 < 2304 && sd2 > 0.0001) {
      const sd = Math.sqrt(sd2);
      const f = (48 - sd) / 48;
      dx += (ox / sd) * f * 0.7;
      dy += (oy / sd) * f * 0.7;
    }
  }

  tryBotDash(b, t, targetDist, w, inStorm, dangerProj, dx, dy, dt);
  const dashing = b.dashT > 0;
  if (dashing) {
    b.dashT = Math.max(0, b.dashT - dt);
    dx = b.dashX;
    dy = b.dashY;
    b.dashTrailT -= dt;
    if (b.dashTrailT <= 0 && getGraphicsSettings().fx >= 1) {
      b.dashTrailT = 0.045;
      spawnParticle('planetGhost', b.x, b.y, 0, 0, 0.22, 0.22, b.r, b.operatorId, 0, 0);
    }
  }

  const ndl = Math.hypot(dx, dy);
  const slowMul = b.slowT > 0 ? 0.58 : 1;
  const baseMoveMul = w.moveMul || 1;
  const weaponMoveMul = w.firingMoveMul && (b.spin || 0) > 0.12
    ? lerp(baseMoveMul, w.firingMoveMul, b.spin)
    : baseMoveMul;
  let targetVx = 0;
  let targetVy = 0;
  if (ndl > 0.01) {
    dx /= ndl;
    dy /= ndl;
    const sp = (dashing ? 780 : b.speed * weaponMoveMul) * (inStorm ? 1.28 : 1) * slowMul;
    targetVx = dx * sp;
    targetVy = dy * sp;
  }
  b.vx = damp(b.vx || 0, targetVx, dashing ? 26 : 13, dt);
  b.vy = damp(b.vy || 0, targetVy, dashing ? 26 : 13, dt);
  const bSpd = Math.hypot(b.vx, b.vy);
  if (bSpd > 2) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    collideEntity(b);
    b.moveX = damp(b.moveX || 0, b.vx / Math.max(1, b.speed), 10, dt);
    b.moveY = damp(b.moveY || 0, b.vy / Math.max(1, b.speed), 10, dt);
    b.stepT -= dt;
    if (b.stepT <= 0 && getGraphicsSettings().fx >= 1) {
      b.stepT = 0.34;
      spawnParticle('dust', b.x - (b.vx / bSpd) * 7, b.y - (b.vy / bSpd) * 7,
        rand(-10, 10), rand(-10, 10), rand(0.25, 0.42), 0.42,
        rand(2, 4), '#8fa6ad', 3);
    }
  } else {
    b.vx = 0;
    b.vy = 0;
    b.moveX = damp(b.moveX || 0, 0, 10, dt);
    b.moveY = damp(b.moveY || 0, 0, 10, dt);
  }

  // Aim & shoot
  if (b.firePause > 0) b.firePause -= dt;
  b.triggerHeld = false;
  const lateGame = !zone || zone.phase >= 2;
  const baseRange = lateGame || b.role === 'hunter' ? 290 + b.aggression * 155 : 240;
  const fireRange = Math.min(w.range, Math.max(baseRange, w.pref));
  const safeRocketDist = w.explosive ? (w.splashRadius || 138) * 1.12 : 0;
  if (t && t.alive && targetDist < fireRange && botLOS(b, t)) {
    const aim = Math.atan2(t.y - b.y, t.x - b.x);
    const turn = 5.8 * dt;
    b.angle += clamp(angleDiff(b.angle, aim), -turn, turn);
    b.reactT = Math.max(0, b.reactT - dt);
    const aligned = Math.abs(angleDiff(b.angle, aim)) < 0.22;
    const canEngage = b.reactT <= 0 && b.firePause <= 0 && b.jamT <= 0 && aligned && targetDist >= safeRocketDist;
    if (canEngage) {
      b.triggerHeld = true;
      const err = b.aimErr * (0.7 + targetDist / 700);
      if (tryFire(b, b.angle + rand(-err, err))) {
        b.burst--;
        if (b.burst <= 0) {
          b.firePause = w.explosive ? rand(1.6, 2.4) : rand(1.2, 2.3);
          b.burst = w.spinUp ? randInt(12, 22) : (w.explosive ? 1 : randInt(2, 4));
        }
      }
    }
  } else if (ndl > 0.01) {
    const moveAngle = Math.atan2(dy, dx);
    const turn = 5 * dt;
    b.angle += clamp(angleDiff(b.angle, moveAngle), -turn, turn);
  }
}

/* ---------------------------------------------------------
   Bullets (Grid Collision, Barrels, Crates, Pierce, Crits)
   --------------------------------------------------------- */
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    let speed = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / speed;
    const uy = b.vy / speed;
    if (b.accel > 0 && speed < b.maxSpeed) {
      speed = Math.min(b.maxSpeed, speed + b.accel * dt);
      b.vx = ux * speed;
      b.vy = uy * speed;
    }
    if (b.explosive) {
      b.smokeT = (b.smokeT || 0) - dt;
      if (b.smokeT <= 0) {
        const fx = getGraphicsSettings().fx;
        b.smokeT = fx >= 1 ? 0.022 : 0.045;
        spawnParticle('smoke', b.x - ux * 10, b.y - uy * 10,
          -ux * rand(24, 65) + rand(-18, 18), -uy * rand(24, 65) + rand(-18, 18),
          rand(0.28, 0.52), 0.52, rand(4.5, 8.5), '#95a3ab', 3);
        if (fx >= 1) {
          spawnParticle('spark', b.x - ux * 11, b.y - uy * 11,
            -ux * rand(60, 140) + rand(-35, 35), -uy * rand(60, 140) + rand(-35, 35),
            rand(0.08, 0.16), 0.16, rand(1.4, 2.4), '#ffbe55', 5);
        }
      }
    }
    const remaining = speed * dt;
    const steps = Math.max(1, Math.ceil(remaining / 18));
    const stepLen = remaining / steps;
    let done = false;

    for (let s = 0; s < steps && !done; s++) {
      const nx = b.x + ux * stepLen;
      const ny = b.y + uy * stepLen;

      // 0. Safe Zone shield barrier isolation (blocks shots crossing in or out)
      if (isPracticeMode() && inSafeZoneRect(nx, ny, 0) !== b.inSafeZone) {
        if (b.explosive) {
          explodeArea(b.x, b.y, b.splashRadius, b.splashDmg, b.owner, b.weapon, {
            selfDmgMul: b.selfDmgMul, crateDmgMul: b.crateDmgMul,
            knockback: b.knockback, dist: b.travelled,
          });
        } else {
          spawnHitSparks(b.x, b.y, '#5ee7ff');
        }
        done = true;
        break;
      }

      // 0b. Safe Zone firing-range target dummies
      if (b.inSafeZone && safeZoneDummies.length) {
        let hitDummy = null;
        for (let k = 0; k < safeZoneDummies.length; k++) {
          const dm = safeZoneDummies[k];
          if (!dm.alive || dm.id === b.hitId) continue;
          if (Math.abs(dm.x - b.x) > dm.r + stepLen + 2 ||
              Math.abs(dm.y - b.y) > dm.r + stepLen + 2) continue;
          if (segCircle(b.x, b.y, nx, ny, dm.x, dm.y, dm.r)) {
            hitDummy = dm;
            break;
          }
        }
        if (hitDummy) {
          if (b.explosive) {
            b.x = nx; b.y = ny;
            explodeArea(nx, ny, b.splashRadius, b.splashDmg, b.owner, b.weapon, {
              directTarget: hitDummy, directDmg: b.dmg,
              selfDmgMul: 0, crateDmgMul: b.crateDmgMul, knockback: 0,
            });
            done = true;
            break;
          }
          const perp = Math.abs((hitDummy.x - b.x) * uy - (hitDummy.y - b.y) * ux);
          const w = WEAPONS[b.weapon];
          const allowCrit = !w || w.canCrit !== false;
          const critChance = (w ? w.critBonus || 0 : 0) + (b.owner ? b.owner.critBonus || 0 : 0);
          const isCrit = allowCrit && (w && w.pellets === 1) && (perp < hitDummy.r * 0.34 || Math.random() < critChance);
          const finalDmg = isCrit ? b.dmg * ((w && w.critMul) || 1.42) : b.dmg;
          spawnHitSparks(nx, ny, isCrit ? '#ffd166' : b.color);
          spawnParticle('shock', nx, ny, 0, 0, 0.2, 0.2, isCrit ? 44 : 32, isCrit ? '#ffd166' : b.color, 0);
          damageDummy(hitDummy, finalDmg, b.owner, { crit: isCrit });
          if (b.pierce > 0) {
            b.pierce--;
            b.hitId = hitDummy.id;
            b.dmg *= 0.82;
          } else {
            b.x = nx; b.y = ny;
            done = true;
            break;
          }
        }
      }

      // 1. Check entity hits
      let hit = null;
      if (!b.inSafeZone && player && player.alive && !player.inSafeZone && player !== b.owner && player.id !== b.hitId &&
          Math.abs(player.x - b.x) <= player.r + stepLen + 2 &&
          Math.abs(player.y - b.y) <= player.r + stepLen + 2 &&
          segCircle(b.x, b.y, nx, ny, player.x, player.y, player.r)) {
        hit = player;
      }
      if (!hit && !b.inSafeZone) {
        for (let k = 0; k < bots.length; k++) {
          const bot = bots[k];
          if (!bot.alive || bot === b.owner || bot.id === b.hitId) continue;
          if (Math.abs(bot.x - b.x) > bot.r + stepLen + 2 ||
              Math.abs(bot.y - b.y) > bot.r + stepLen + 2) continue;
          if (segCircle(b.x, b.y, nx, ny, bot.x, bot.y, bot.r)) {
            hit = bot;
            break;
          }
        }
      }
      if (hit) {
        if (b.explosive) {
          b.x = nx;
          b.y = ny;
          explodeArea(nx, ny, b.splashRadius, b.splashDmg, b.owner, b.weapon, {
            directTarget: hit,
            directDmg: b.dmg,
            selfDmgMul: b.selfDmgMul,
            crateDmgMul: b.crateDmgMul,
            knockback: b.knockback,
            dist: b.travelled + stepLen * 0.5,
            countSplashHit: true,
          });
          done = true;
          break;
        }
        // Skill-rewarding Crit detection: direct center-line hit or precision crit roll.
        const perp = Math.abs((hit.x - b.x) * uy - (hit.y - b.y) * ux);
        const w = WEAPONS[b.weapon];
        const canCrit = (b.owner === player || (b.owner && b.owner.elite)) && (!w || w.canCrit !== false);
        const critChance = (w ? w.critBonus || 0 : 0) + (b.owner ? b.owner.critBonus || 0 : 0);
        const isCrit = canCrit && (w && w.pellets === 1) && (perp < hit.r * 0.34 || Math.random() < critChance);
        const critMul = (w && w.critMul) || 1.42;
        const finalDmg = isCrit ? b.dmg * critMul : b.dmg;

        if (b.knockback) {
          hit.boostVelX += ux * b.knockback * 4.5;
          hit.boostVelY += uy * b.knockback * 4.5;
        }
        spawnHitSparks(nx, ny, isCrit ? '#ffd166' : b.color);
        spawnParticle('shock', nx, ny, 0, 0, 0.22, 0.22, isCrit ? 46 : 34, isCrit ? '#ffd166' : b.color, 0);
        damage(hit, finalDmg, b.owner === hit ? null : b.owner, {
          weapon: b.weapon,
          dist: b.travelled + stepLen * 0.5,
          crit: isCrit,
        });

        if (b.pierce > 0) {
          b.pierce--;
          b.hitId = hit.id;
          b.dmg *= 0.82;
        } else {
          b.x = nx;
          b.y = ny;
          done = true;
          break;
        }
      }

      // 2. Check explosive barrels
      for (let k = 0; k < barrels.length; k++) {
        const bar = barrels[k];
        if (!bar.alive) continue;
        if (Math.abs(bar.x - b.x) > bar.r + stepLen + 2 ||
            Math.abs(bar.y - b.y) > bar.r + stepLen + 2) continue;
        if (segCircle(b.x, b.y, nx, ny, bar.x, bar.y, bar.r)) {
          b.x = nx;
          b.y = ny;
          if (b.explosive) {
            explodeArea(nx, ny, b.splashRadius, b.splashDmg, b.owner, b.weapon, {
              selfDmgMul: b.selfDmgMul,
              crateDmgMul: b.crateDmgMul,
              knockback: b.knockback,
              dist: b.travelled + stepLen * 0.5,
              countSplashHit: true,
            });
          } else {
            spawnHitSparks(nx, ny, '#ff9f45');
            damageBarrel(bar, b.dmg, b.owner);
          }
          done = true;
          break;
        }
      }
      if (done) break;

      b.x = nx;
      b.y = ny;
      b.travelled += stepLen;

      // 3. Check Spatial Grid obstacles (including destructible crates!)
      const obs = findObstacleAtPoint(b.x, b.y, 0);
      if (obs) {
        if (b.explosive) {
          explodeArea(b.x, b.y, b.splashRadius, b.splashDmg, b.owner, b.weapon, {
            selfDmgMul: b.selfDmgMul,
            crateDmgMul: b.crateDmgMul,
            knockback: b.knockback,
            dist: b.travelled,
            countSplashHit: true,
          });
          done = true;
          break;
        }
        spawnHitSparks(b.x, b.y, obs.type === 'crate' ? '#c99b63' : '#b7c7cf');
        spawnDecal('chip', b.x, b.y, rand(2.5, 4.5), '#080c10', 0.55, b.angle);
        if (obs.destructible) {
          damageObstacle(obs, b.dmg * (b.crateDmgMul || 1), b.owner);
        }
        if (b.pierce > 0 && obs.destructible && obs.destroyed) {
          b.pierce--;
        } else {
          done = true;
          break;
        }
      }
      if (b.travelled >= b.maxDist) {
        if (b.explosive) {
          explodeArea(b.x, b.y, b.splashRadius, b.splashDmg, b.owner, b.weapon, {
            selfDmgMul: b.selfDmgMul,
            crateDmgMul: b.crateDmgMul,
            knockback: b.knockback,
            dist: b.travelled,
            countSplashHit: true,
          });
        }
        done = true;
        break;
      }
    }

    if (done) {
      if (b.beam) {
        spawnBeam(b.startX, b.startY, b.x, b.y, b.color,
          b.weapon === 'railgun' ? 4.8 : 2.6, b.weapon === 'railgun' ? 0.42 : 0.28);
      }
      releaseBullet(b);
      const last = bullets.pop();
      if (i < bullets.length) bullets[i] = last;
    }
  }
}

/* ---------------------------------------------------------
   Damage / Elimination
   --------------------------------------------------------- */
function damage(target, amount, source, opts = {}) {
  if (!target.alive || game.state !== 'playing') return;
  if (target.inSafeZone) return;
  // Once victory is secured, prevent post-win slow-mo storm/blast from overturning Victory!
  if (game.pendingEnd && game.pendingEnd.win && target === player) return;
  if (target === player && game.invuln > 0 && !opts.trueDamage) {
    if (!opts.silent) {
      spawnParticle('shard', target.x, target.y, rand(-90, 90), rand(-90, 90),
        0.24, 0.24, 5, target.auraColor, 4);
    }
    return;
  }
  if (target === player) game.regenDelay = target.regenDelayBase || 5.5;
  let dmg = amount;
  if (source && !source.isPlayer && !target.isPlayer) dmg *= 0.36;
  target.lastHitT = game.time;

  const hadArmor = target.armor > 0;
  let absorbed = 0;
  if (!opts.trueDamage && target.armor > 0) {
    absorbed = Math.min(target.armor, dmg * 0.6);
    target.armor -= absorbed;
    dmg -= absorbed;
  }
  const totalDealt = dmg + absorbed;
  target.hp -= dmg;
  if (!opts.storm) {
    target.hitFlash = 0.14;
    target.scaleX = 1.11;
    target.scaleY = 0.9;
    if (source && source !== target) {
      const fdx = target.x - source.x;
      const fdy = target.y - source.y;
      const fl = Math.hypot(fdx, fdy) || 1;
      const imp = clamp(totalDealt * 0.14, 2, 7);
      target.flinchX = clamp((target.flinchX || 0) + (fdx / fl) * imp, -9, 9);
      target.flinchY = clamp((target.flinchY || 0) + (fdy / fl) * imp, -9, 9);
    }
  }

  if (hadArmor && target.armor <= 0 && !opts.storm) {
    spawnParticle('shock', target.x, target.y, 0, 0, 0.3, 0.3, target.r * 2.1, '#67d9ff', 0);
    for (let i = 0; i < 5; i++) {
      const a = rand(0, TAU);
      spawnParticle('shard', target.x, target.y,
        Math.cos(a) * rand(80, 190), Math.sin(a) * rand(80, 190),
        rand(0.25, 0.48), 0.48, rand(3, 5), '#8be6ff', 4, a);
    }
    sfx('armor', target.x, target.y);
  }

  if (source === player && target !== player && !opts.storm) {
    player.damageDealt += totalDealt;
    if (!opts.blast || opts.directHit) player.shotsHit++;
    if (opts.crit) player.crits++;
    if (typeof track === 'function') track('damage', totalDealt);
  }

  if (source === player && target !== player) {
    game.hitmarker = opts.crit || opts.directHit ? 0.2 : 0.14;
    game.hitmarkerTotal = game.hitmarker;
    game.hitmarkerKill = false;
    game.hitmarkerCrit = !!(opts.crit || opts.directHit);
    if (!opts.silent && totalDealt >= 1) {
      const txt = opts.crit || opts.directHit ? Math.round(totalDealt) + '!' : String(Math.round(totalDealt));
      const col = opts.crit ? '#ffd166'
        : opts.directHit ? '#ff9f45'
        : absorbed > 0 ? '#8be6ff'
        : (totalDealt >= 30 ? '#ffcf86' : '#ffffff');
      spawnText(target.x + rand(-7, 7), target.y - target.r - 4, txt, col,
        opts.crit || opts.directHit ? 17 : 14, opts.crit || opts.directHit ? 0.95 : 0.8);
    }
    sfx(opts.crit || opts.directHit ? 'crit' : 'hit', target.x, target.y);
  }
  if (target === player && !opts.storm) {
    game.hurt = Math.min(1, game.hurt + amount / 55);
    game.shake = Math.max(game.shake, opts.blast ? 6.5 : 4);
    if (source && source !== player) {
      game.damageAngle = Math.atan2(source.y - target.y, source.x - target.x);
      game.damageIndicator = 1;
    }
    sfx('hurt');
  }
  if (!opts.storm) spawnHitSparks(target.x, target.y, target === player ? '#8beeff' : '#ffb199');

  if (target.hp <= 0) {
    killEntity(target, source, !!opts.storm, { weapon: opts.weapon, dist: opts.dist, blast: !!opts.blast });
  }
}

function killEntity(e, source, byStorm, info = {}) {
  if (!e.alive) return;
  const aliveBefore = aliveCount();
  if (e.isPlayer) game.placement = aliveBefore;
  e.alive = false;
  e.hp = 0;
  e.reloading = false;
  e.burstLeft = 0;
  e.spin = 0;
  e.heat = 0;
  e.triggerHeld = false;

  if (source && source !== e) source.kills++;
  if (source === player && e !== player) {
    game.hitmarker = 0.32;
    game.hitmarkerTotal = 0.32;
    game.hitmarkerKill = true;
    sfx('kill');
    game.zoomPunch = Math.min(0.036, (game.zoomPunch || 0) + 0.022);
    game.shake = Math.max(game.shake, e.elite ? 6.5 : 4.5);

    source.killStreak = (source.killStreak || 0) + 1;
    source.streakT = 8.5;
    if (source.killStreak >= 2) {
      source.hp = Math.min(source.maxHp, source.hp + 18);
      game.killBoost = 1 + Math.min(0.32, source.killStreak * 0.08);
      game.killBoostT = 6.5;
      game.regenDelay = 0;
      if (source.killStreak >= 3) {
        const g = GADGETS[source.gadget] || GADGETS.frag;
        if (source.gadgetCharges < g.maxCharges) source.gadgetCharges++;
      }
      showToast(source.killStreak + ' ELIMINATION STREAK', 1500, 'gold');
      sfx('streak');
      spawnParticle('wave', source.x, source.y, 0, 0, 0.55, 0.55, source.r * 4, '#ffd166', 0);
    }
    const baseAura = e.elite ? 1500 : 1000;
    const totalAura = Math.round(baseAura * (getGameMode().auraMul || 1));
    grantAura(totalAura);

    const weapon = info.weapon || source.weapon;
    if (WEAPONS[weapon]) {
      source.weaponKills[weapon] = (source.weaponKills[weapon] || 0) + 1;
    }
    const dist = Math.max(0, Number(info.dist) || 0);
    if (dist > source.longestKill) source.longestKill = dist;
    if (typeof track === 'function') {
      track('kills', 1);
      if (weapon === 'sniper' || weapon === 'railgun') track('sniperKills', 1);
      else if (weapon === 'shotgun') track('shotgunKills', 1);
      else if (weapon === 'rifle' || weapon === 'dmr' || weapon === 'pulse') track('rifleKills', 1);
      else if (weapon === 'lmg' || weapon === 'minigun' || weapon === 'bazooka') track('heavyKills', 1);
      if (dist >= 900) track('longshot', 1);
    }
  }
  const practice = isPracticeMode();
  if (e.isPlayer) {
    if (practice) {
      if (typeof addFeed === 'function') {
        if (byStorm || !source) addFeed('THE STORM', e.name, true, false, null, false, false);
        else addFeed(source.name, e.name, false, source === player, info.weapon || source.weapon, !!info.blast, source === e);
      }
      spawnDeathBurst(e);
      respawnPracticePlayer();
      return;
    }
    mouse.down = false;
    game.shake = 10;
    sfx('lose');
    game.pendingEnd = { t: 1.25, win: false };
  }

  if (typeof addFeed === 'function') {
    if (byStorm || !source) addFeed('THE STORM', e.name, true, false, null, false, false);
    else addFeed(source.name, e.name, false, source === player, info.weapon || source.weapon, !!info.blast, source === e);
  }

  spawnDeathBurst(e);
  dropLoot(e);
  if (practice && !e.isPlayer) {
    respawnPracticeBot(e);
  }
}

function dropLoot(e) {
  const drop = (extra) => {
    let x = e.x;
    let y = e.y;
    for (let i = 0; i < 12; i++) {
      const cx = clamp(e.x + rand(-30, 30), 60, WORLD - 60);
      const cy = clamp(e.y + rand(-30, 30), 60, WORLD - 60);
      if (!pointInObstacle(cx, cy, 16)) { x = cx; y = cy; break; }
    }
    pickups.push({
      kind: extra.kind, weapon: extra.weapon, skin: extra.skin, gadget: extra.gadget,
      x, y, phase: rand(0, TAU), dropLock: 0.25, spawnT: 0.36,
    });
    // Keep Practice floor pickups bounded during endless sessions.
    if (isPracticeMode() && pickups.length > 145) {
      const idxOld = pickups.findIndex((p) => !p.supply);
      if (idxOld !== -1) pickups.splice(idxOld, 1);
    }
  };
  if (Math.random() < 0.5) {
    drop({ kind: 'weapon', weapon: e.weapon, skin: e.skin });
  } else {
    const dropPool = e.elite
      ? ['rifle', 'pulse', 'dmr', 'lmg', 'lmg', 'sniper', 'sniper', 'minigun', 'bazooka', 'railgun']
      : ['smg', 'shotgun', 'revolver', 'rifle', 'pulse', 'dmr', 'lmg', 'lmg', 'sniper', 'sniper', 'bazooka', 'minigun'];
    drop({
      kind: 'weapon',
      weapon: pick(dropPool),
      skin: randomSkin(e.elite ? 1.8 : 0.45),
    });
  }
  if (Math.random() < 0.42) drop({ kind: 'health' });
  if (Math.random() < 0.34) drop({ kind: 'armor' });
  if (Math.random() < (e.elite ? 0.65 : 0.28)) {
    drop({ kind: 'gadget', gadget: pick(['frag', 'emp', 'smoke']) });
  }
}

/* ---------------------------------------------------------
   Smart Pickups & Interactive Swap [E]
   --------------------------------------------------------- */
function equipWeaponToEntity(e, p, slotIdx) {
  const next = WEAPONS[p.weapon];
  const nextSkin = skinInfo(p.skin);
  e.slots[slotIdx] = { weapon: p.weapon, skin: p.skin || 'factory', mag: next.mag };
  if (slotIdx === e.activeSlot) {
    syncEntityFromSlot(e);
    e.reloading = false;
    e.reloadT = 0;
    e.burstLeft = 0;
    e.spin = 0;
    e.heat = 0;
    e.spinSoundT = 0;
    e.weaponChangeT = 0.26;
    if (!e.isPlayer) {
      e.burst = next.spinUp ? randInt(12, 22) : (next.explosive ? 1 : randInt(2, 4));
    }
  }
  if (e.isPlayer) {
    if (nextSkin.bonus > 0) {
      e.skinsFound++;
      if (typeof track === 'function') track('skins', 1);
    }
    const bonusTxt = nextSkin.bonus > 0 ? ' +' + Math.round(nextSkin.bonus * 100) + '%' : '';
    showToast(nextSkin.name + ' ' + next.name + bonusTxt, 1400, nextSkin.bonus >= 0.12 ? 'gold' : '');
    sfx('pickup');
  }
}

function pickupBurst(p) {
  const burstColor = p.kind === 'health' ? '#7bf5a8'
    : p.kind === 'armor' ? '#67d9ff'
    : p.kind === 'gadget' ? (GADGETS[p.gadget] || GADGETS.frag).color
    : skinInfo(p.skin).bonus > 0 ? skinInfo(p.skin).color : WEAPONS[p.weapon].color;
  const n = getGraphicsSettings().fx >= 1 ? 8 : 4;
  for (let i = 0; i < n; i++) {
    spawnParticle('spark', p.x, p.y, rand(-130, 130), rand(-130, 130),
      rand(0.2, 0.42), 0.42, rand(1, 2.4), burstColor, 5);
  }
  spawnParticle('shock', p.x, p.y, 0, 0, 0.28, 0.28, 40, burstColor, 0);
}

function interactPickup() {
  const p = player;
  if (!p || !p.alive || game.state !== 'playing') return false;
  // Inside Practice Safe Zone: interact with weapon/gadget/skin pedestals!
  if (p.inSafeZone && game.nearStation) {
    const st = game.nearStation;
    if (st.kind === 'weapon') return selectSafeZoneWeapon(st.weapon);
    if (st.kind === 'gadget') return selectSafeZoneGadget(st.gadget);
    if (st.kind === 'skin') return cycleSafeZoneSkin();
    return false;
  }
  const target = game.nearPickup;
  if (!target) return false;
  const idx = pickups.indexOf(target);
  if (idx === -1) { game.nearPickup = null; return false; }

  if (target.kind === 'weapon') {
    syncSlotFromEntity(p);
    const oldSlot = p.slots[p.activeSlot];
    equipWeaponToEntity(p, target, p.activeSlot);
    pickupBurst(target);
    pickups.splice(idx, 1);
    // Drop previous weapon cleanly onto an unobstructed spot with brief dropLock.
    if (oldSlot) {
      let dx = p.x;
      let dy = p.y;
      for (let t = 0; t < 10; t++) {
        const cx = clamp(p.x + rand(-18, 18), 60, WORLD - 60);
        const cy = clamp(p.y + rand(-18, 18), 60, WORLD - 60);
        if (!pointInObstacle(cx, cy, 14)) { dx = cx; dy = cy; break; }
      }
      pickups.push({
        kind: 'weapon', weapon: oldSlot.weapon, skin: oldSlot.skin,
        x: dx, y: dy, phase: rand(0, TAU), dropLock: 0.75,
      });
    }
    game.nearPickup = null;
    return true;
  } else if (target.kind === 'gadget') {
    const oldG = p.gadget;
    const oldCharges = p.gadgetCharges;
    const g = GADGETS[target.gadget] || GADGETS.frag;
    p.gadget = g.id;
    p.gadgetCharges = Math.min(g.maxCharges, 2);
    pickupBurst(target);
    pickups.splice(idx, 1);
    sfx('pickup');
    showToast(g.name + ' EQUIPPED', 1200);
    if (oldCharges > 0 && oldG !== g.id) {
      let dx = p.x;
      let dy = p.y;
      for (let t = 0; t < 10; t++) {
        const cx = clamp(p.x + rand(-18, 18), 60, WORLD - 60);
        const cy = clamp(p.y + rand(-18, 18), 60, WORLD - 60);
        if (!pointInObstacle(cx, cy, 14)) { dx = cx; dy = cy; break; }
      }
      pickups.push({
        kind: 'gadget', gadget: oldG,
        x: dx, y: dy, phase: rand(0, TAU), dropLock: 0.75,
      });
    }
    game.nearPickup = null;
    return true;
  }
  return false;
}

function updatePickups(dt) {
  let closestPrompt = null;
  let closestD2 = 54 * 54;

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    if (p.dropLock > 0) p.dropLock = Math.max(0, p.dropLock - dt);
    if (p.spawnT > 0) p.spawnT = Math.max(0, p.spawnT - dt);
    let consumed = false;

    for (const e of allEntities()) {
      if (!e.alive) continue;
      if (e.isPlayer && p.dropLock > 0) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d2 = dx * dx + dy * dy;
      const reach = e.r + 16;

      // Track promptable manual-swap items for the player within 54px.
      if (e.isPlayer && d2 < closestD2 && (p.kind === 'weapon' || p.kind === 'gadget')) {
        const needsManualWeapon = p.kind === 'weapon' && e.slots[0] && e.slots[1];
        const needsManualGadget = p.kind === 'gadget' && e.gadgetCharges > 0 && e.gadget !== p.gadget;
        if (needsManualWeapon || needsManualGadget) {
          closestD2 = d2;
          closestPrompt = p;
        }
      }

      if (d2 < reach * reach) {
        if (applyAutoPickup(e, p)) {
          pickups.splice(i, 1);
          consumed = true;
          break;
        }
      }
    }
    if (consumed && p === closestPrompt) closestPrompt = null;
  }
  game.nearPickup = closestPrompt;
}

function applyAutoPickup(e, p) {
  if (p.kind === 'weapon') {
    const next = WEAPONS[p.weapon];
    const nextSkin = skinInfo(p.skin);
    if (!e.isPlayer) {
      const cur = WEAPONS[e.weapon];
      const curSkin = skinInfo(e.skin);
      const better = next.tier > cur.tier ||
        (next.tier === cur.tier && nextSkin.bonus > curSkin.bonus + 0.001);
      if (!better) return false;
      equipWeaponToEntity(e, p, 0);
      pickupBurst(p);
      return true;
    }
    // For the player: auto-fill empty slot 2! If currently holding starter factory pistol, switch to it!
    if (!e.slots[1]) {
      const autoSwitch = e.activeSlot === 0 && e.weapon === 'pistol' && e.skin === 'factory';
      equipWeaponToEntity(e, p, 1);
      if (autoSwitch) {
        syncSlotFromEntity(e);
        e.activeSlot = 1;
        syncEntityFromSlot(e);
        e.reloading = false;
        e.reloadT = 0;
        e.burstLeft = 0;
        e.spin = 0;
        e.heat = 0;
        e.spinSoundT = 0;
        e.weaponChangeT = 0.25;
      }
      pickupBurst(p);
      return true;
    }
    // Both slots full -> require intentional [E] swap so you never lose your favorite gun!
    return false;
  } else if (p.kind === 'health') {
    if (e.hp >= e.maxHp) return false;
    const heal = e.medkitHeal || 40;
    e.hp = Math.min(e.maxHp, e.hp + heal);
    if (e.isPlayer) {
      if (getPlayerPerk().id === 'medic') e.speedBoostT = Math.max(e.speedBoostT, 2.2);
      sfx('pickup');
      spawnText(e.x, e.y - 30, '+' + heal + ' HP', '#7bf5a8');
    }
    pickupBurst(p);
    return true;
  } else if (p.kind === 'armor') {
    if (e.armor >= e.maxArmor) return false;
    e.armor = Math.min(e.maxArmor, e.armor + 30);
    if (e.isPlayer) {
      sfx('armor');
      spawnText(e.x, e.y - 30, '+30 ARMOR', '#67d9ff');
    }
    pickupBurst(p);
    return true;
  } else if (p.kind === 'gadget') {
    if (!e.isPlayer) return false;
    const g = GADGETS[p.gadget] || GADGETS.frag;
    if (e.gadgetCharges <= 0) {
      e.gadget = g.id;
      e.gadgetCharges = Math.min(g.maxCharges, 2);
      sfx('pickup');
      showToast(g.name + ' ×' + e.gadgetCharges, 1100);
      pickupBurst(p);
      return true;
    }
    if (e.gadget === g.id && e.gadgetCharges < g.maxCharges) {
      e.gadgetCharges = Math.min(g.maxCharges, e.gadgetCharges + 1);
      sfx('pickup');
      spawnText(e.x, e.y - 30, '+1 ' + g.name, g.color);
      pickupBurst(p);
      return true;
    }
    return false;
  }
  return false;
}

function addStarterLoot() {
  if (!player) return;
  const weapons = ['smg', 'shotgun', 'revolver', 'rifle', 'rifle', 'pulse', 'dmr', 'lmg', 'sniper'];
  for (let n = 0; n < 4; n++) {
    for (let i = 0; i < 60; i++) {
      const a = rand(0, TAU);
      const d = rand(190, 480);
      const x = clamp(player.x + Math.cos(a) * d, 140, WORLD - 140);
      const y = clamp(player.y + Math.sin(a) * d, 140, WORLD - 140);
      if (pointInObstacle(x, y, 36)) continue;
      if (pickups.some((p) => distance(x, y, p.x, p.y) < 68)) continue;
      pickups.push({
        kind: 'weapon',
        weapon: pick(weapons),
        skin: randomSkin(2.4 - n * 0.45),
        x, y, phase: rand(0, TAU), dropLock: 0,
      });
      break;
    }
  }
}

/* ---------------------------------------------------------
   Practice Mode — Safe Zone Arsenal, Dummies, Teleport & Instant Respawn
   --------------------------------------------------------- */
const SKIN_ORDER = ['factory', 'neon', 'gold', 'inferno', 'void'];

function damageDummy(dm, amount, source, opts = {}) {
  if (!dm || !dm.alive) return;
  let dmg = amount;
  let absorbed = 0;
  const hadArmor = dm.armor > 0;
  if (dm.armor > 0) {
    absorbed = Math.min(dm.armor, dmg * 0.6);
    dm.armor -= absorbed;
    dmg -= absorbed;
  }
  const totalDealt = dmg + absorbed;
  dm.hp -= dmg;
  dm.hitFlash = 0.14;
  if (source) {
    const fdx = dm.x - source.x;
    const fdy = dm.y - source.y;
    const fl = Math.hypot(fdx, fdy) || 1;
    const imp = clamp(totalDealt * 0.14, 2, 7);
    dm.flinchX = clamp((dm.flinchX || 0) + (fdx / fl) * imp, -8, 8);
    dm.flinchY = clamp((dm.flinchY || 0) + (fdy / fl) * imp, -8, 8);
  }
  if (hadArmor && dm.armor <= 0) {
    spawnParticle('shock', dm.x, dm.y, 0, 0, 0.28, 0.28, dm.r * 2, '#67d9ff', 0);
    sfx('armor', dm.x, dm.y);
  }
  if (source === player) {
    game.hitmarker = opts.crit || opts.directHit ? 0.2 : 0.14;
    game.hitmarkerTotal = game.hitmarker;
    game.hitmarkerKill = dm.hp <= 0;
    game.hitmarkerCrit = !!(opts.crit || opts.directHit);
    if (totalDealt >= 1) {
      const txt = opts.crit || opts.directHit ? Math.round(totalDealt) + '!' : String(Math.round(totalDealt));
      const col = opts.crit ? '#ffd166' : opts.directHit ? '#ff9f45' : absorbed > 0 ? '#8be6ff' : '#ffffff';
      spawnText(dm.x + rand(-7, 7), dm.y - dm.r - 4, txt, col,
        opts.crit || opts.directHit ? 17 : 14, opts.crit || opts.directHit ? 0.95 : 0.8);
    }
    sfx(dm.hp <= 0 ? 'kill' : (opts.crit || opts.directHit ? 'crit' : 'hit'), dm.x, dm.y);
  }
  if (dm.hp <= 0) {
    dm.alive = false;
    dm.hp = 0;
    dm.respawnT = 0.9;
    spawnParticle('shock', dm.x, dm.y, 0, 0, 0.38, 0.38, 64, '#5ee7ff', 0);
    spawnText(dm.x, dm.y - dm.r - 18, 'RESETTING', '#5ee7ff', 11, 0.85);
  }
}

function combatSpawnPosition(avoidPlayerDist = 0) {
  for (let tries = 0; tries < 90; tries++) {
    const pos = spawnPosition(180);
    if (avoidPlayerDist > 0 && player && !player.inSafeZone &&
        distance(pos.x, pos.y, player.x, player.y) < avoidPlayerDist) continue;
    if (bots.some((b) => b.alive && distance(pos.x, pos.y, b.x, b.y) < 160)) continue;
    return pos;
  }
  return spawnPosition(180);
}

function selectSafeZoneWeapon(weaponKey, skinKey = null, targetSlot = -1) {
  const p = player;
  if (!p || !p.alive || !isPracticeMode() || !p.inSafeZone) return false;
  const w = WEAPONS[weaponKey];
  if (!w) return false;
  syncSlotFromEntity(p);
  let slotIdx = targetSlot;
  if (slotIdx !== 0 && slotIdx !== 1) {
    if (!p.slots[1] && !(p.activeSlot === 0 && p.weapon === 'pistol' && p.skin === 'factory')) {
      slotIdx = 1;
    } else if (!p.slots[1] && p.activeSlot === 0 && p.weapon === 'pistol' && p.skin === 'factory') {
      slotIdx = 0;
    } else {
      slotIdx = p.activeSlot;
    }
  }
  const chosenSkin = skinKey && SKINS[skinKey] ? skinKey : (p.skin || 'factory');
  p.slots[slotIdx] = { weapon: weaponKey, skin: chosenSkin, mag: w.mag };
  p.activeSlot = slotIdx;
  syncEntityFromSlot(p);
  p.reloading = false;
  p.reloadT = 0;
  p.burstLeft = 0;
  p.spin = 0;
  p.heat = 0;
  p.spinSoundT = 0;
  p.weaponChangeT = 0.24;
  sfx('pickup');
  spawnParticle('shock', p.x, p.y, 0, 0, 0.26, 0.26, 44, w.color, 0);
  showToast('EQUIPPED ' + w.name + ' (SLOT ' + (slotIdx + 1) + ')', 1100);
  if (typeof syncSafeZonePanelUI === 'function') syncSafeZonePanelUI();
  return true;
}

function selectSafeZoneSkin(skinKey) {
  const p = player;
  if (!p || !p.alive || !isPracticeMode() || !p.inSafeZone || !SKINS[skinKey]) return false;
  p.skin = skinKey;
  syncSlotFromEntity(p);
  const sk = skinInfo(skinKey);
  sfx('aura');
  spawnParticle('shock', p.x, p.y, 0, 0, 0.28, 0.28, 48, sk.color, 0);
  showToast(sk.name + ' FINISH' + (sk.bonus > 0 ? ' +' + Math.round(sk.bonus * 100) + '%' : ''), 1100, sk.bonus >= 0.12 ? 'gold' : '');
  if (typeof syncSafeZonePanelUI === 'function') syncSafeZonePanelUI();
  return true;
}

function cycleSafeZoneSkin() {
  const p = player;
  if (!p || !p.inSafeZone) return false;
  const idx = SKIN_ORDER.indexOf(p.skin || 'factory');
  const next = SKIN_ORDER[(idx + 1) % SKIN_ORDER.length];
  return selectSafeZoneSkin(next);
}

function selectSafeZoneGadget(gadgetId) {
  const p = player;
  if (!p || !p.alive || !isPracticeMode() || !p.inSafeZone) return false;
  const g = GADGETS[gadgetId];
  if (!g) return false;
  p.gadget = g.id;
  p.gadgetCharges = g.maxCharges;
  sfx('pickup');
  spawnParticle('shock', p.x, p.y, 0, 0, 0.26, 0.26, 42, g.color, 0);
  showToast(g.name + ' ×' + g.maxCharges, 1000);
  if (typeof syncSafeZonePanelUI === 'function') syncSafeZonePanelUI();
  return true;
}

function teleportToCombat() {
  const p = player;
  if (!p || !p.alive || !isPracticeMode() || game.state !== 'playing') return false;
  const pos = combatSpawnPosition(0);
  spawnParticle('wave', p.x, p.y, 0, 0, 0.45, 0.45, 72, '#5ee7ff', 0);
  p.inSafeZone = false;
  p.x = pos.x;
  p.y = pos.y;
  p.vx = 0; p.vy = 0;
  p.boostVelX = 0; p.boostVelY = 0;
  p.dashT = 0;
  p.hp = p.maxHp;
  p.hpTrail = p.maxHp;
  p.armor = Math.max(p.armor, getPlayerPerk().id === 'vanguard' ? 60 : 40);
  p.reloading = false; p.reloadT = 0;
  p.burstLeft = 0; p.spin = 0; p.heat = 0;
  p.jamT = 0; p.slowT = 0;
  for (let i = 0; i < 2; i++) {
    if (p.slots[i]) p.slots[i].mag = WEAPONS[p.slots[i].weapon].mag;
  }
  syncEntityFromSlot(p);
  const g = GADGETS[p.gadget] || GADGETS.frag;
  p.gadgetCharges = Math.max(p.gadgetCharges, Math.min(g.maxCharges, 2));
  game.invuln = 1.25;
  game.nearStation = null;
  p.spawnT = 0.35;
  cam.x = p.x;
  cam.y = p.y;
  sfx('boost');
  spawnParticle('wave', p.x, p.y, 0, 0, 0.65, 0.65, 110, '#5ee7ff', 0);
  spawnParticle('shock', p.x, p.y, 0, 0, 0.42, 0.42, 82, '#ffd166', 0);
  showToast('COMBAT ARENA · PRESS H FOR SAFE ZONE', 1800, 'gold');
  if (typeof syncSafeZonePanelUI === 'function') syncSafeZonePanelUI();
  return true;
}

function returnToSafeZone() {
  const p = player;
  if (!p || !p.alive || !isPracticeMode() || game.state !== 'playing') return false;
  spawnParticle('wave', p.x, p.y, 0, 0, 0.45, 0.45, 72, '#5ee7ff', 0);
  p.inSafeZone = true;
  p.safePortalGrace = 0.9;
  p.x = SAFE_ZONE.x + 310;
  p.y = SAFE_ZONE.y + 545;
  p.vx = 0; p.vy = 0;
  p.boostVelX = 0; p.boostVelY = 0;
  p.dashT = 0;
  p.hp = p.maxHp;
  p.hpTrail = p.maxHp;
  p.armor = p.maxArmor;
  p.reloading = false; p.reloadT = 0;
  p.burstLeft = 0; p.spin = 0; p.heat = 0;
  p.jamT = 0; p.slowT = 0;
  for (let i = 0; i < 2; i++) {
    if (p.slots[i]) p.slots[i].mag = WEAPONS[p.slots[i].weapon].mag;
  }
  syncEntityFromSlot(p);
  const g = GADGETS[p.gadget] || GADGETS.frag;
  p.gadgetCharges = g.maxCharges;
  mouse.down = false;
  game.nearPickup = null;
  p.spawnT = 0.32;
  cam.x = p.x;
  cam.y = p.y;
  sfx('boost');
  spawnParticle('wave', p.x, p.y, 0, 0, 0.55, 0.55, 96, '#5ee7ff', 0);
  showToast('SAFE ZONE · SELECT WEAPONS', 1500);
  if (typeof syncSafeZonePanelUI === 'function') syncSafeZonePanelUI();
  return true;
}

function respawnPracticeBot(b) {
  const pos = combatSpawnPosition(520);
  const allWeaponKeys = Object.keys(WEAPONS);
  const weapon = pick(allWeaponKeys);
  const wDef = WEAPONS[weapon];
  const skin = randomSkin(1.25);
  const operatorIds = Object.keys(OPERATOR_PRESETS);
  const opId = pick(operatorIds);
  const op = OPERATOR_PRESETS[opId];
  const elite = Math.random() < getGameMode().eliteChance;

  b.alive = true;
  b.inSafeZone = false;
  b.x = pos.x;
  b.y = pos.y;
  b.vx = 0; b.vy = 0;
  b.boostVelX = 0; b.boostVelY = 0;
  b.dashT = 0; b.dashCd = rand(0.8, 1.8);
  b.elite = elite;
  b.operatorId = opId;
  b.operatorName = op.name;
  b.color = op.color;
  b.light = op.light;
  b.auraColor = elite ? '#ffd166' : op.auraColor;
  b.name = (elite ? '★ ' : '') + pick(BOT_NAMES);
  b.maxHp = elite ? 135 : 100;
  b.hp = b.maxHp;
  b.hpTrail = b.maxHp;
  b.maxArmor = elite ? 100 : 75;
  b.armor = elite ? 35 : (Math.random() < 0.35 ? 30 : 0);
  b.weapon = weapon;
  b.skin = skin;
  b.mag = wDef.mag;
  b.slots = [{ weapon, skin, mag: wDef.mag }, null];
  b.activeSlot = 0;
  b.reloading = false; b.reloadT = 0;
  b.burstLeft = 0; b.spin = 0; b.heat = 0; b.triggerHeld = false;
  b.jamT = 0; b.slowT = 0;
  b.killStreak = 0; b.streakT = 0; b.lastHitT = -99; b.hitFlash = 0;
  b.target = null; b.lootTarget = null; b.coverSpot = null; b.wander = null;
  for (let i = 0; i < bots.length; i++) {
    if (bots[i].target === b) bots[i].target = null;
  }
  b.firePause = 0;
  b.burst = wDef.spinUp ? randInt(12, 22) : (wDef.explosive ? 1 : randInt(2, 4));
  b.gadget = Math.random() < 0.7 ? 'frag' : 'emp';
  b.gadgetCharges = elite ? 1 : 0;
  b.spawnT = 0.35;
  spawnParticle('shock', b.x, b.y, 0, 0, 0.32, 0.32, 54, b.auraColor, 0);
}

function respawnPracticePlayer() {
  const p = player;
  if (!p) return;
  const pos = combatSpawnPosition(0);
  p.alive = true;
  p.inSafeZone = false;
  p.x = pos.x;
  p.y = pos.y;
  p.vx = 0; p.vy = 0;
  p.boostVelX = 0; p.boostVelY = 0;
  p.dashT = 0; p.dashCd = 0;
  p.hp = p.maxHp;
  p.hpTrail = p.maxHp;
  p.armor = getPlayerPerk().id === 'vanguard' ? 45 : 25;
  p.reloading = false; p.reloadT = 0;
  p.burstLeft = 0; p.spin = 0; p.heat = 0; p.triggerHeld = false;
  p.jamT = 0; p.slowT = 0;
  p.killStreak = 0; p.streakT = 0;
  for (let i = 0; i < 2; i++) {
    if (p.slots[i]) p.slots[i].mag = WEAPONS[p.slots[i].weapon].mag;
  }
  syncEntityFromSlot(p);
  game.invuln = 1.3;
  game.hurt = 0;
  game.shake = 5;
  p.spawnT = 0.36;
  cam.x = p.x;
  cam.y = p.y;
  sfx('boost');
  spawnParticle('wave', p.x, p.y, 0, 0, 0.6, 0.6, 105, '#5ee7ff', 0);
  showToast('RESPAWNED · PRESS H FOR SAFE ZONE', 1600, 'gold');
}

function updateSafeZone(dt) {
  if (!isPracticeMode()) return;
  // Update firing-range target dummies
  for (let i = 0; i < safeZoneDummies.length; i++) {
    const dm = safeZoneDummies[i];
    if (dm.hitFlash > 0) dm.hitFlash = Math.max(0, dm.hitFlash - dt);
    const decay = Math.exp(-16 * dt);
    dm.flinchX *= decay;
    dm.flinchY *= decay;
    dm.hpTrail = damp(dm.hpTrail != null ? dm.hpTrail : dm.hp, dm.hp, 5.2, dt);
    if (!dm.alive) {
      dm.respawnT -= dt;
      if (dm.respawnT <= 0) {
        dm.alive = true;
        dm.hp = dm.maxHp;
        dm.hpTrail = dm.maxHp;
        dm.armor = dm.maxArmor;
        spawnParticle('shock', dm.x, dm.y, 0, 0, 0.3, 0.3, 46, '#5ee7ff', 0);
      }
    }
  }

  const p = player;
  if (!p || !p.alive || !p.inSafeZone) {
    game.nearStation = null;
    return;
  }

  // Sanctuary passive restore
  p.hp = p.maxHp;
  p.hpTrail = p.maxHp;
  p.armor = p.maxArmor;
  p.jamT = 0;
  p.slowT = 0;
  if (p.safePortalGrace > 0) p.safePortalGrace = Math.max(0, p.safePortalGrace - dt);

  // Detect nearest interactive weapon/gadget/skin pedestal inside Safe Zone
  let bestSt = null;
  let bestD2 = 54 * 54;
  for (let i = 0; i < safeZoneStations.length; i++) {
    const st = safeZoneStations[i];
    const dx = p.x - st.x;
    const dy = p.y - st.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestSt = st;
    }
  }
  game.nearStation = bestSt;

  // Walk onto glowing Combat Teleport Portal to warp into the arena!
  if (p.safePortalGrace <= 0) {
    const pdx = p.x - SAFE_ZONE_PORTAL.x;
    const pdy = p.y - SAFE_ZONE_PORTAL.y;
    const pr = SAFE_ZONE_PORTAL.r + p.r * 0.25;
    if (pdx * pdx + pdy * pdy <= pr * pr) {
      teleportToCombat();
    }
  }
}

/* ---------------------------------------------------------
   Zone / Storm & High-Tier Supply Drops
   --------------------------------------------------------- */
function updateZone(dt) {
  const z = zone;
  if (!z) return;
  const speedMul = getGameMode().stormSpeed || 1;
  const dpsMul = 1;

  if (z.state === 'waiting') {
    z.timer -= dt;
    if (z.timer <= 0 && z.phase < ZONE_PHASES.length) {
      const p = ZONE_PHASES[z.phase];
      z.sx = z.x; z.sy = z.y; z.sr = z.r;
      z.tx = z.nextX; z.ty = z.nextY; z.tr = z.nextR;
      z.dps = p.dps * dpsMul;
      z.state = 'shrinking';
      z.timer = p.shrink / speedMul;
      z.shrinkTotal = z.timer;
      if (typeof showToast === 'function') {
        showToast('THE ZONE IS CLOSING', 1900, 'warn');
      }
      sfx('zone');
    }
  } else if (z.state === 'shrinking') {
    z.timer -= dt;
    const t = 1 - Math.max(0, z.timer) / z.shrinkTotal;
    const e = smooth(clamp(t, 0, 1));
    z.x = lerp(z.sx, z.tx, e);
    z.y = lerp(z.sy, z.ty, e);
    z.r = lerp(z.sr, z.tr, e);
    if (z.timer <= 0) {
      z.phase++;
      if (z.phase < ZONE_PHASES.length) {
        z.state = 'waiting';
        z.timer = ZONE_PHASES[z.phase].wait / speedMul;
        planNextZone(z);
        if (z.phase >= 5 && typeof setMusicMood === 'function') setMusicMood('final');
      } else {
        z.state = 'final';
        z.timer = 0;
        if (typeof setMusicMood === 'function') setMusicMood('final');
      }
    }
  }

  if (game.state !== 'playing') return;
  const zoneTargets = allEntities().slice();
  for (const e of zoneTargets) {
    if (!e.alive) continue;
    const dx = e.x - z.x;
    const dy = e.y - z.y;
    if (dx * dx + dy * dy > z.r * z.r) {
      damage(e, z.dps * dt, null, { trueDamage: true, storm: true, silent: true });
    }
  }
}

function updateSupplyDrop(dt) {
  if (!game || game.state !== 'playing') return;

  // In Practice mode, gently replenish floor weapons across the combat map if loot runs low.
  if (isPracticeMode()) {
    game.practiceLootT = (game.practiceLootT || 0) - dt;
    if (game.practiceLootT <= 0) {
      game.practiceLootT = 6;
      let floorWeps = 0;
      for (let i = 0; i < pickups.length; i++) {
        if (pickups[i].kind === 'weapon') floorWeps++;
      }
      if (floorWeps < 50) {
        const toAdd = Math.min(8, 60 - floorWeps);
        for (let k = 0; k < toAdd; k++) {
          const pos = spawnPosition(150);
          pickups.push({
            kind: 'weapon',
            weapon: pick(FLOOR_WEAPON_POOL),
            skin: randomSkin(0.5),
            x: pos.x, y: pos.y, phase: rand(0, TAU), dropLock: 0, spawnT: 0.35,
          });
        }
      }
    }
  }

  if (game.matchTime < game.supplyNext) return;

  let pos = null;
  for (let i = 0; i < 50; i++) {
    const candidate = zone
      ? {
        x: clamp(rand(zone.x - zone.r * 0.72, zone.x + zone.r * 0.72), 150, WORLD - 150),
        y: clamp(rand(zone.y - zone.r * 0.72, zone.y + zone.r * 0.72), 150, WORLD - 150),
      }
      : spawnPosition(180);
    if (!inSafeZoneRect(candidate.x, candidate.y, 140) &&
        !pointInObstacle(candidate.x, candidate.y, 58) &&
        pickups.every((p) => distance(candidate.x, candidate.y, p.x, p.y) > 90)) {
      pos = candidate;
      break;
    }
  }
  if (!pos) {
    pos = zone
      ? { x: clamp(zone.x, 150, WORLD - 150), y: clamp(zone.y, 150, WORLD - 150) }
      : spawnPosition(180);
    for (let i = 0; i < 40; i++) {
      const cx = clamp(pos.x + rand(-160, 160), 150, WORLD - 150);
      const cy = clamp(pos.y + rand(-160, 160), 150, WORLD - 150);
      if (!inSafeZoneRect(cx, cy, 140) && !pointInObstacle(cx, cy, 58)) { pos = { x: cx, y: cy }; break; }
    }
  }

  const apexWeapons = ['railgun', 'bazooka', 'minigun'];
  const bonusWeapons = ['sniper', 'lmg', 'dmr', 'pulse'];
  const skin = randomSkin(4.2);
  const bonusSkin = randomSkin(2.6);
  const addSupply = (def, ox = 0, oy = 0) => {
    const sx = clamp(pos.x + ox, 60, WORLD - 60);
    const sy = clamp(pos.y + oy, 60, WORLD - 60);
    pickups.push({
      ...def,
      x: pointInObstacle(sx, sy, 14) ? pos.x : sx,
      y: pointInObstacle(sx, sy, 14) ? pos.y : sy,
      phase: rand(0, TAU),
      supply: true,
      dropLock: 0,
    });
  };
  addSupply({
    kind: 'weapon',
    weapon: pick(apexWeapons),
    skin: skin === 'factory' ? 'inferno' : skin,
  });
  addSupply({
    kind: 'weapon',
    weapon: pick(bonusWeapons),
    skin: bonusSkin === 'factory' ? 'gold' : bonusSkin,
  }, 0, 28);
  addSupply({ kind: 'armor' }, 28, 4);
  addSupply({ kind: 'health' }, -28, 4);
  addSupply({ kind: 'gadget', gadget: pick(['frag', 'emp', 'smoke']) }, 0, -28);

  game.supplyNext = game.matchTime + (getGameMode().supplyGap || 58);
  if (typeof showToast === 'function') {
    showToast('HIGH-TIER CACHE DEPLOYED', 1900, 'gold');
  }
  sfx('zone');
  if (typeof addGunPing === 'function') addGunPing(pos.x, pos.y);
  for (let i = 0; i < 16; i++) {
    const a = rand(0, TAU);
    spawnParticle('spark', pos.x, pos.y, Math.cos(a) * rand(60, 220),
      Math.sin(a) * rand(60, 220), rand(0.4, 0.9), 0.9, rand(1.5, 3), '#ffd166', 2);
  }
  spawnParticle('wave', pos.x, pos.y, 0, 0, 0.8, 0.8, 120, '#ffd166', 0);
}

/* ---------------------------------------------------------
   FX Helpers & Pooling
   --------------------------------------------------------- */
function spawnParticle(type, x, y, vx, vy, life, maxLife, size, color, drag = 2, angle = 0) {
  const qualityLimit = getGraphicsSettings().particles;
  const limit = Math.min(MAX_PARTICLES,
    REDUCED_MOTION ? Math.round(qualityLimit * 0.6) : qualityLimit);
  if (limit <= 0) return null;
  let particle;
  if (particles.length >= limit) {
    let index = 0;
    let smallestLife = Infinity;
    for (let i = 0; i < particles.length; i++) {
      if (particles[i].life < smallestLife) {
        smallestLife = particles[i].life;
        index = i;
      }
    }
    particle = particles[index];
  } else {
    particle = particlePool.pop() || {};
    particles.push(particle);
  }
  particle.type = type;
  particle.x = x; particle.y = y;
  particle.vx = vx; particle.vy = vy;
  particle.life = life; particle.maxLife = maxLife;
  particle.size = size; particle.color = color;
  particle.drag = drag; particle.angle = angle;
  return particle;
}

function clearParticles() {
  for (const particle of particles) {
    if (particlePool.length < MAX_PARTICLES) particlePool.push(particle);
  }
  particles.length = 0;
}

function trimParticlesToQuality() {
  const limit = Math.min(MAX_PARTICLES, getGraphicsSettings().particles);
  while (particles.length > limit) {
    const particle = particles.pop();
    if (particlePool.length < MAX_PARTICLES) particlePool.push(particle);
  }
}

function updateAuraMotes(e, dt) {
  if (getGraphicsSettings().fx < 1 && !e.isPlayer) return;
  e.auraT -= dt;
  if (e.auraT > 0) return;
  e.auraT = rand(e.isPlayer && e.aura > 0 ? 0.2 : 0.36,
    e.isPlayer && e.aura > 0 ? 0.34 : 0.58);
  const a = rand(0, TAU);
  const radius = e.r + rand(-2, 5);
  spawnParticle('spark', e.x + Math.cos(a) * radius, e.y + Math.sin(a) * radius,
    Math.cos(a) * rand(8, 24), Math.sin(a) * rand(8, 24) - rand(22, 48),
    rand(0.35, 0.72), 0.72, rand(1.1, 2.2), e.auraColor, 1.2);
}

function spawnHitSparks(x, y, color) {
  const n = getGraphicsSettings().fx >= 1 ? 5 : 2;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const sp = rand(50, 260);
    spawnParticle('spark', x, y, Math.cos(a) * sp, Math.sin(a) * sp,
      rand(0.15, 0.38), 0.38, rand(1, 2.5), color, 7);
  }
  spawnParticle('flash', x, y, 0, 0, 0.08, 0.08, 15, '#ffd9a0', 0);
  if (getGraphicsSettings().fx >= 1 && Math.random() < 0.5) {
    spawnParticle('dust', x, y, rand(-45, 45), rand(-45, 45),
      rand(0.2, 0.42), 0.42, rand(3, 6), '#8fa6ad', 3);
  }
}

function spawnDeathBurst(e) {
  spawnDecal('scorch', e.x, e.y, e.r * 1.4, '#080c12', 0.44, rand(0, TAU));
  spawnParticle('deathGhost', e.x, e.y, 0, 0, 0.32, 0.32, e.r, e.operatorId, 0, 0);
  spawnParticle('ring', e.x, e.y, 0, 0, 0.55, 0.55, e.r, e.color, 0);
  spawnParticle('ring', e.x, e.y, 0, 0, 0.36, 0.36, e.r * 0.55, e.auraColor, 0);
  spawnParticle('shock', e.x, e.y, 0, 0, 0.42, 0.42, 76, e.auraColor, 0);
  if (e.elite) spawnParticle('wave', e.x, e.y, 0, 0, 0.7, 0.7, 150, '#ffd166', 0);
  const sparks = getGraphicsSettings().fx >= 1 ? 14 : 6;
  for (let i = 0; i < sparks; i++) {
    const a = rand(0, TAU);
    const sp = rand(40, 360);
    spawnParticle(i % 3 === 0 ? 'dot' : 'spark', e.x, e.y,
      Math.cos(a) * sp, Math.sin(a) * sp, rand(0.25, 0.85), 0.85,
      rand(1.5, 4), i % 2 ? e.auraColor : '#ffd9a0', 3.5);
  }
  if (getGraphicsSettings().fx >= 1) {
    for (let i = 0; i < 4; i++) {
      spawnParticle('smoke', e.x + rand(-9, 9), e.y + rand(-9, 9),
        rand(-26, 26), rand(-45, -12), rand(0.45, 0.8), 0.8,
        rand(8, 15), '#83939b', 1.8);
    }
  }
}

function spawnText(x, y, text, color, size = 14, life = 0.85) {
  if (texts.length >= 44) texts.shift();
  texts.push({ x, y, vy: size >= 18 ? -34 : -42, life, maxLife: life, text, color, size });
}

function grantAura(amount) {
  if (!player || !player.alive) return;
  player.aura = (player.aura || 0) + amount;
  spawnText(player.x + rand(-5, 5), player.y - player.r - 28,
    '+' + amount + ' AURA', '#ffe6a1', 21, 1.35);
  spawnParticle('ring', player.x, player.y, 0, 0, 0.7, 0.7, player.r, player.auraColor, 0);
  spawnParticle('shock', player.x, player.y, 0, 0, 0.4, 0.4, player.r * 3.2, player.auraColor, 0);
  const sparks = getGraphicsSettings().fx >= 1 ? 16 : 6;
  for (let i = 0; i < sparks; i++) {
    const a = rand(0, TAU);
    const sp = rand(60, 320);
    spawnParticle(i % 3 === 0 ? 'dot' : 'spark',
      player.x + Math.cos(a) * player.r, player.y + Math.sin(a) * player.r,
      Math.cos(a) * sp, Math.sin(a) * sp - 40, rand(0.3, 0.9), 0.9,
      rand(1.4, 3), player.auraColor, 3);
  }
  game.auraFlash = 1;
  sfx('aura');
  if (typeof pulseAura === 'function') pulseAura();
}

function addGunPing(x, y) {
  if (!player) return;
  if (distance(x, y, player.x, player.y) > (player.radarRange || 1300) + 400) return;
  pings.push({ x, y, life: 1.4, maxLife: 1.4 });
  if (pings.length > 14) pings.shift();
}

function updateFx(dt) {
  // Smooth exponential shake decay (eliminates abrupt linear stop).
  game.shake *= Math.exp(-11 * dt);
  if (game.shake < 0.04) game.shake = 0;
  game.zoomPunch = (game.zoomPunch || 0) * Math.exp(-9 * dt);
  if (game.zoomPunch < 0.0004) game.zoomPunch = 0;
  game.hurt = Math.max(0, game.hurt - dt * 1.6);
  game.damageIndicator = Math.max(0, game.damageIndicator - dt * 1.8);
  game.hitmarker = Math.max(0, game.hitmarker - dt);
  game.auraFlash = Math.max(0, (game.auraFlash || 0) - dt * 1.8);
  game.invuln = Math.max(0, (game.invuln || 0) - dt);
  if (game.hitmarker <= 0) {
    game.hitmarkerKill = false;
    game.hitmarkerCrit = false;
  }

  // Frame-rate-independent storm vignette pulse (consistent on 30/60/120/144Hz).
  let outsideStorm = false;
  if (player && player.alive && zone) {
    const zdx = player.x - zone.x;
    const zdy = player.y - zone.y;
    outsideStorm = zdx * zdx + zdy * zdy > zone.r * zone.r;
  }
  const targetStorm = outsideStorm ? 0.72 + Math.sin(game.time * 4.8) * 0.14 : 0;
  game.stormPulse = damp(game.stormPulse || 0, targetStorm, 7, dt);

  if (game.killBoostT > 0) {
    game.killBoostT = Math.max(0, game.killBoostT - dt);
    if (game.killBoostT <= 0) game.killBoost = 1;
  }
  if (player && player.alive) {
    game.regenDelay = Math.max(0, (game.regenDelay || 0) - dt);
    const cap = player.maxHp * (player.regenCap || 0.7);
    if (game.regenDelay <= 0 && player.hp < cap) {
      player.hp = Math.min(cap, player.hp + (player.regenCap > 0.75 ? 7 : 5) * dt);
    }
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      const last = particles.pop();
      if (i < particles.length) particles[i] = last;
      if (particlePool.length < MAX_PARTICLES) particlePool.push(p);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.drag) {
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
    }
    if (p.type === 'ring') p.size += 130 * dt;
  }

  for (let i = decals.length - 1; i >= 0; i--) {
    decals[i].life -= dt;
    if (decals[i].life <= 0) {
      const d = decals[i];
      const last = decals.pop();
      if (i < decals.length) decals[i] = last;
      if (decalPool.length < MAX_DECALS) decalPool.push(d);
    }
  }

  for (let i = beams.length - 1; i >= 0; i--) {
    beams[i].life -= dt;
    if (beams[i].life <= 0) {
      const last = beams.pop();
      if (i < beams.length) beams[i] = last;
    }
  }

  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life -= dt;
    t.y += t.vy * dt;
    t.vy *= Math.exp(-2.4 * dt);
    if (t.life <= 0) {
      const last = texts.pop();
      if (i < texts.length) texts[i] = last;
    }
  }

  for (let i = pings.length - 1; i >= 0; i--) {
    pings[i].life -= dt;
    if (pings[i].life <= 0) {
      const last = pings.pop();
      if (i < pings.length) pings[i] = last;
    }
  }
}
