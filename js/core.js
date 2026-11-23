'use strict';

/* =========================================================
   BATTLEGROUND — core constants, i18n, spatial grid, audio,
   adaptive graphics engine, input, and world generation
   ========================================================= */

const TAU = Math.PI * 2;
const WORLD = 4400;
let TOTAL_PLAYERS = 30;
let BOT_TOTAL = TOTAL_PLAYERS - 1;
const SAFE_ZONE = { x: 140, y: 140, w: 980, h: 680 };
const SAFE_ZONE_PORTAL = { x: SAFE_ZONE.x + 650, y: SAFE_ZONE.y + 555, r: 44 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const distance = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const smooth = (t) => t * t * (3 - 2 * t);
const easeOutCubic = (t) => { const u = 1 - clamp(t, 0, 1); return 1 - u * u * u; };
const easeOutQuart = (t) => { const u = 1 - clamp(t, 0, 1); return 1 - u * u * u * u; };
const easeOutBack = (t) => {
  const x = clamp(t, 0, 1) - 1;
  return 1 + 2.70158 * x * x * x + 1.70158 * x * x;
};
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const angleDiff = (a, b) => {
  let d = (b - a + Math.PI) % TAU;
  if (d < 0) d += TAU;
  return d - Math.PI;
};
const dampAngle = (a, b, lambda, dt) => a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));
const formatTime = (s) => {
  s = Math.max(0, Math.floor(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

/* ---------------------------------------------------------
   Weapons, gadgets, modes, and tactical perks
   --------------------------------------------------------- */
const WEAPONS = {
  pistol: {
    name: 'PISTOL', short: 'P', tier: 1, model: 'pistol',
    dmg: 20, rpm: 345, mag: 12, reload: 1.05,
    spread: 0.022, speed: 1550, pellets: 1, range: 920, pref: 300,
    color: '#ffd166', tracer: '#ffe7a3', kick: 1.5, len: 26, thick: 9, sound: 'pistol',
    critBonus: 0.08,
  },
  smg: {
    name: 'SMG', short: 'S', tier: 2, model: 'smg',
    dmg: 10, rpm: 860, mag: 34, reload: 1.4,
    spread: 0.052, speed: 1650, pellets: 1, range: 720, pref: 220,
    color: '#5ee7ff', tracer: '#b7f7ff', kick: 0.85, len: 30, thick: 8, sound: 'smg',
    critBonus: 0.04,
  },
  shotgun: {
    name: 'SHOTGUN', short: 'G', tier: 2, model: 'shotgun',
    dmg: 11.5, rpm: 92, mag: 6, reload: 1.85,
    spread: 0.155, speed: 1320, pellets: 6, range: 520, pref: 135,
    color: '#ff9f45', tracer: '#ffd2a1', kick: 4.8, len: 32, thick: 11, sound: 'shotgun',
    critBonus: 0.05, knockback: 18,
  },
  revolver: {
    name: 'REVOLVER', short: 'RV', tier: 2, model: 'revolver',
    dmg: 44, rpm: 155, mag: 6, reload: 1.65,
    spread: 0.016, speed: 1850, pellets: 1, range: 1120, pref: 360,
    color: '#ff8c42', tracer: '#ffd0a8', kick: 4.4, len: 30, thick: 10, sound: 'revolver',
    critBonus: 0.16,
  },
  rifle: {
    name: 'RIFLE', short: 'R', tier: 3, model: 'rifle',
    dmg: 34, rpm: 185, mag: 16, reload: 1.7,
    spread: 0.012, speed: 2250, pellets: 1, range: 1500, pref: 460,
    color: '#ff5a5f', tracer: '#ffa3a6', kick: 3.9, len: 40, thick: 10, sound: 'rifle',
    critBonus: 0.1,
  },
  pulse: {
    name: 'PULSE AR', short: 'PL', tier: 3, model: 'pulse',
    dmg: 15, rpm: 145, mag: 24, reload: 1.75, burstCount: 3, burstGap: 0.055,
    spread: 0.014, speed: 2150, pellets: 1, range: 1320, pref: 420,
    color: '#38f2d8', tracer: '#a8fff0', kick: 2.2, len: 42, thick: 10, sound: 'pulse',
    critBonus: 0.1,
  },
  dmr: {
    name: 'DMR', short: 'DM', tier: 3, model: 'dmr',
    dmg: 33, rpm: 235, mag: 12, reload: 1.8,
    spread: 0.008, speed: 2550, pellets: 1, range: 1680, pref: 560,
    color: '#7bf5c1', tracer: '#c9ffe4', kick: 3.1, len: 44, thick: 9, sound: 'dmr',
    critBonus: 0.15,
  },
  lmg: {
    name: 'LMG', short: 'LM', tier: 4, model: 'lmg',
    dmg: 13.5, rpm: 670, mag: 70, reload: 3.05,
    spread: 0.078, speed: 1850, pellets: 1, range: 1020, pref: 380,
    color: '#c7f464', tracer: '#eaffb0', kick: 2.2, len: 48, thick: 14, sound: 'lmg',
    critBonus: 0.04, moveMul: 0.95,
  },
  sniper: {
    name: 'SNIPER', short: 'SR', tier: 4, model: 'sniper',
    dmg: 94, rpm: 52, mag: 4, reload: 2.5,
    spread: 0.003, speed: 3250, pellets: 1, range: 2150, pref: 820,
    color: '#b06cff', tracer: '#dcc0ff', kick: 7.0, len: 54, thick: 10, sound: 'sniper',
    critBonus: 0.22, beam: true, knockback: 35,
  },
  railgun: {
    name: 'RAILGUN', short: 'RG', tier: 5, model: 'railgun',
    dmg: 86, rpm: 48, mag: 4, reload: 2.65,
    spread: 0.002, speed: 3600, pellets: 1, range: 2250, pref: 840,
    color: '#ff5cf4', tracer: '#ffc4fb', kick: 7.4, len: 56, thick: 11, sound: 'railgun',
    critBonus: 0.2, pierce: 1, beam: true, knockback: 42,
  },
  minigun: {
    name: 'MINIGUN', short: 'MG', tier: 5, model: 'minigun',
    dmg: 8.5, rpm: 1260, mag: 96, reload: 3.45,
    spread: 0.068, heatSpread: 0.036, speed: 1920, pellets: 1, range: 860, pref: 310,
    color: '#ffbe3b', tracer: '#ffe38f', kick: 1.35, len: 50, thick: 17, sound: 'minigun',
    critBonus: 0, critMul: 1.2, knockback: 3.5, crateDmgMul: 1.25,
    spinUp: 0.52, spinDown: 0.85, moveMul: 0.88, firingMoveMul: 0.64,
  },
  bazooka: {
    name: 'BAZOOKA', short: 'BZ', tier: 5, model: 'bazooka',
    dmg: 24, splashDmg: 82, splashRadius: 138, selfDmgMul: 0.72,
    rpm: 36, mag: 1, reload: 2.25,
    spread: 0.016, speed: 560, rocketAccel: 1150, rocketMaxSpeed: 980,
    pellets: 1, range: 1080, pref: 470,
    color: '#ff6b35', tracer: '#ffcf70', kick: 8.4, len: 54, thick: 15, sound: 'bazooka',
    canCrit: false, explosive: true, knockback: 300, crateDmgMul: 1.85,
    moveMul: 0.86,
  },
};

const GADGETS = {
  frag: {
    id: 'frag', name: 'FRAG', short: 'FRG', color: '#ff7a3d', light: '#ffd2a1',
    fuse: 1.15, radius: 155, maxDmg: 92, throwDist: 430, maxCharges: 3,
  },
  emp: {
    id: 'emp', name: 'EMP', short: 'EMP', color: '#5ee7ff', light: '#ccf7ff',
    fuse: 0.78, radius: 175, maxDmg: 34, shieldShred: 55, jamTime: 2.4, throwDist: 450, maxCharges: 3,
  },
  smoke: {
    id: 'smoke', name: 'SMOKE', short: 'SMK', color: '#9fb8c2', light: '#dcecf2',
    fuse: 0.45, radius: 142, duration: 7.5, throwDist: 410, maxCharges: 3,
  },
};

const GAME_MODES = {
  classic: {
    id: 'classic', players: 30, stormSpeed: 1.0, lootLuck: 0.25,
    eliteChance: 0.22, supplyFirst: 52, supplyGap: 68, auraMul: 1.0,
    noStorm: false, practice: false,
    name: 'ROYALE',
    desc: '30 operators · 4400m expanded map, extended storm & supply caches',
  },
  practice: {
    id: 'practice', players: 20, stormSpeed: 0, lootLuck: 0.9,
    eliteChance: 0.25, supplyFirst: 45, supplyGap: 65, auraMul: 0.25,
    noStorm: true, practice: true,
    name: 'PRACTICE',
    desc: '20 ops always · Free Safe Zone armory, no storm & instant respawn',
  },
};

const PERKS = {
  vanguard: {
    id: 'vanguard', name: 'VANGUARD',
    desc: 'Start with +30 Armor & 90 Max Armor',
  },
  striker: {
    id: 'striker', name: 'STRIKER',
    desc: '-22% Reload time, -25% Dash CD & +8% Crit',
  },
  scout: {
    id: 'scout', name: 'SCOUT',
    desc: '+10% Move speed & +35% Minimap radar range',
  },
  medic: {
    id: 'medic', name: 'MEDIC',
    desc: 'Faster Regen up to 85% HP & +55 HP Medkits',
  },
};

const hasOwn = (obj, key) => !!obj && typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);

const PREFS_KEY = 'battleground.prefs.v1';
const userPrefs = {
  mode: 'classic',
  perk: 'vanguard',
  autoAdapt: true,
  showFps: false,
};
try {
  const savedPrefs = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
  if (savedPrefs && typeof savedPrefs === 'object') {
    if (hasOwn(GAME_MODES, savedPrefs.mode)) userPrefs.mode = savedPrefs.mode;
    if (hasOwn(PERKS, savedPrefs.perk)) userPrefs.perk = savedPrefs.perk;
    if (typeof savedPrefs.autoAdapt === 'boolean') userPrefs.autoAdapt = savedPrefs.autoAdapt;
    if (typeof savedPrefs.showFps === 'boolean') userPrefs.showFps = savedPrefs.showFps;
  }
} catch (e) { /* storage unavailable */ }

function saveUserPrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(userPrefs)); } catch (e) {}
}

function getGameMode() {
  return hasOwn(GAME_MODES, userPrefs.mode) ? GAME_MODES[userPrefs.mode] : GAME_MODES.classic;
}

function isPracticeMode() {
  return !!getGameMode().practice;
}

function inSafeZoneRect(x, y, pad = 0) {
  return isPracticeMode() &&
    x >= SAFE_ZONE.x - pad && x <= SAFE_ZONE.x + SAFE_ZONE.w + pad &&
    y >= SAFE_ZONE.y - pad && y <= SAFE_ZONE.y + SAFE_ZONE.h + pad;
}

function getPlayerPerk() {
  return hasOwn(PERKS, userPrefs.perk) ? PERKS[userPrefs.perk] : PERKS.vanguard;
}

function updateDeployDeckUI() {
  const m = getGameMode();
  const p = getPlayerPerk();
  for (const btn of document.querySelectorAll('[data-mode]')) {
    const sel = btn.dataset.mode === m.id;
    btn.classList.toggle('selected', sel);
    btn.setAttribute('aria-pressed', String(sel));
  }
  for (const btn of document.querySelectorAll('[data-perk]')) {
    const sel = btn.dataset.perk === p.id;
    btn.classList.toggle('selected', sel);
    btn.setAttribute('aria-pressed', String(sel));
  }
  const mDesc = document.getElementById('modeDesc');
  const pDesc = document.getElementById('perkDesc');
  if (mDesc) mDesc.textContent = m.desc;
  if (pDesc) pDesc.textContent = p.desc;
}

function updateFpsToggleUI() {
  const on = !!userPrefs.showFps;
  for (const btn of document.querySelectorAll('[data-fps-toggle]')) {
    btn.textContent = 'FPS HUD: ' + (on ? 'ON' : 'OFF');
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
  }
  if (UI.fpsBadge) UI.fpsBadge.classList.toggle('hidden', !on);
}

/* ---------------------------------------------------------
   Weapon skins — each tier adds a damage multiplier
   --------------------------------------------------------- */
const SKINS = {
  factory: { name: 'FACTORY', color: '#9fb1bb', bonus: 0 },
  neon: { name: 'NEON', color: '#5ee7ff', bonus: 0.06 },
  gold: { name: 'GOLD', color: '#ffd166', bonus: 0.12 },
  inferno: { name: 'INFERNO', color: '#ff7a3d', bonus: 0.18 },
  void: { name: 'VOID', color: '#b06cff', bonus: 0.25 },
};

function skinInfo(key) {
  return SKINS[key] || SKINS.factory;
}

function randomSkin(luck = 0) {
  const totalLuck = Math.max(0, luck + (getGameMode().lootLuck || 0));
  const weights = [
    ['factory', 60 / (1 + totalLuck * 1.45)],
    ['neon', 22],
    ['gold', 11 * (1 + totalLuck * 0.25)],
    ['inferno', 5 * (1 + totalLuck)],
    ['void', 2 * (1 + totalLuck * 1.15)],
  ];
  let total = 0;
  for (const [, w] of weights) total += w;
  let roll = Math.random() * total;
  for (const [key, w] of weights) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return 'factory';
}

const ZONE_PHASES = [
  { wait: 30, shrink: 22, r: 2050, dps: 2 },
  { wait: 26, shrink: 20, r: 1500, dps: 3 },
  { wait: 24, shrink: 18, r: 1080, dps: 5 },
  { wait: 22, shrink: 16, r: 740, dps: 8 },
  { wait: 18, shrink: 14, r: 480, dps: 12 },
  { wait: 15, shrink: 12, r: 290, dps: 17 },
  { wait: 12, shrink: 10, r: 160, dps: 24 },
  { wait: 10, shrink: 8, r: 75, dps: 35 },
  { wait: 8, shrink: 12, r: 0, dps: 55 },
];

const BOT_NAMES = [
  'Viper', 'Kestrel', 'Nova', 'Rook', 'Havoc', 'Wraith', 'Bolt', 'Sable',
  'Echo', 'Grit', 'Vandal', 'Onyx', 'Fable', 'Talon', 'Ember', 'Riptide',
  'Cinder', 'Drift', 'Saber', 'Zenith', 'Fury', 'Lynx', 'Mako', 'Nyx',
  'Pyre', 'Quill', 'Ranger', 'Sly', 'Tusk', 'Vex', 'Warden', 'Wisp',
  'Zephyr', 'Atlas', 'Bandit', 'Cyclone', 'Dagger', 'Frost', 'Ghost', 'Hazel',
];

const ROADS = [
  { x: 1180, y: 0, w: 200, h: WORLD },
  { x: 0, y: 2920, w: WORLD, h: 190 },
  { x: 3340, y: 0, w: 200, h: WORLD },
];

const DISTRICTS = [
  { x: WORLD * 0.52, y: WORLD * 0.50, name: 'ARENA CORE', sub: 'SECTOR 00', color: '94,231,255', style: 'core' },
  { x: WORLD * 0.15, y: WORLD * 0.36, name: 'FOUNDRY', sub: 'INDUSTRIAL', color: '255,159,69', style: 'foundry' },
  { x: WORLD * 0.85, y: WORLD * 0.18, name: 'RELAY', sub: 'COMMS ARRAY', color: '176,108,255', style: 'relay' },
  { x: WORLD * 0.15, y: WORLD * 0.81, name: 'DOCKS', sub: 'CARGO BAY', color: '94,231,255', style: 'docks' },
  { x: WORLD * 0.85, y: WORLD * 0.82, name: 'SECTOR 9', sub: 'CONTAINMENT', color: '255,90,95', style: 'sector9' },
  { x: WORLD * 0.52, y: WORLD * 0.14, name: 'SPIRE', sub: 'OVERWATCH', color: '255,209,102', style: 'spire' },
  { x: WORLD * 0.86, y: WORLD * 0.50, name: 'OUTPOST', sub: 'EAST RIDGE', color: '123,245,193', style: 'foundry' },
  { x: WORLD * 0.52, y: WORLD * 0.85, name: 'REACTOR', sub: 'POWER CORE', color: '255,107,53', style: 'sector9' },
];

const REDUCED_MOTION = typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

/* ---------------------------------------------------------
   DOM
   --------------------------------------------------------- */
const canvas = document.getElementById('game');
// Use alpha:false without desynchronized:true to avoid tearing/flicker on Safari & older mobile WebViews.
const ctx = canvas.getContext('2d', { alpha: false });
const minimap = document.getElementById('minimap');
const mctx = minimap.getContext('2d', { alpha: false });

const UI = {
  fpsBadge: document.getElementById('fpsBadge'),
  alive: document.getElementById('aliveCount'),
  kills: document.getElementById('killCount'),
  aura: document.getElementById('auraCount'),
  auraPill: document.getElementById('auraPill'),
  zone: document.getElementById('zoneText'),
  supply: document.getElementById('supplyText'),
  feed: document.getElementById('feed'),
  pickupPrompt: document.getElementById('pickupPrompt'),
  pickupTitle: document.getElementById('pickupTitle'),
  pickupSub: document.getElementById('pickupSub'),
  hpTrail: document.getElementById('hpTrail'),
  hpFill: document.getElementById('hpFill'),
  hpText: document.getElementById('hpText'),
  armorFill: document.getElementById('armorFill'),
  armorText: document.getElementById('armorText'),
  slot0: document.getElementById('slot0'),
  slot1: document.getElementById('slot1'),
  slot0Name: document.getElementById('slot0Name'),
  slot0Mag: document.getElementById('slot0Mag'),
  slot1Name: document.getElementById('slot1Name'),
  slot1Mag: document.getElementById('slot1Mag'),
  gadgetSlot: document.getElementById('gadgetSlot'),
  gadgetName: document.getElementById('gadgetName'),
  gadgetCount: document.getElementById('gadgetCount'),
  weapon: document.getElementById('weaponName'),
  skin: document.getElementById('skinName'),
  mag: document.getElementById('mag'),
  reloadWrap: document.getElementById('reloadWrap'),
  reloadFill: document.getElementById('reloadFill'),
  dash: document.getElementById('dashHint'),
  dashLabel: document.getElementById('dashLabel'),
  toast: document.getElementById('toast'),
  streakBanner: document.getElementById('streakBanner'),
  streakCount: document.getElementById('streakCount'),
  stormWarn: document.getElementById('stormWarn'),
  operatorName: document.getElementById('operatorName'),
  hudPortrait: document.getElementById('hudPortrait'),
  hudBuff: document.getElementById('hudBuff'),
  hudWeapon: document.getElementById('hudWeapon'),
  dashTouch: document.getElementById('dashTouch'),
  gadgetTouch: document.getElementById('gadgetTouch'),
  swapTouch: document.getElementById('swapTouch'),
  interactTouch: document.getElementById('interactTouch'),
  safeTouch: document.getElementById('safeTouch'),
  practiceBar: document.getElementById('practiceBar'),
  returnSafeBtn: document.getElementById('returnSafeBtn'),
  safeZonePanel: document.getElementById('safeZonePanel'),
  safeZoneWeapons: document.getElementById('safeZoneWeapons'),
  safeZoneSkins: document.getElementById('safeZoneSkins'),
  safeZoneGadgets: document.getElementById('safeZoneGadgets'),
  deployArenaBtn: document.getElementById('deployArenaBtn'),
  pauseSafeBtn: document.getElementById('pauseSafeBtn'),
  pauseHint: document.getElementById('pauseHint'),
  warnArrow: document.getElementById('warnArrow'),
  warnDist: document.getElementById('warnDist'),
  vignette: document.getElementById('vignette'),
  stormVignette: document.getElementById('stormVignette'),
  countdown: document.getElementById('countdown'),
  menu: document.getElementById('menu'),
  pause: document.getElementById('pause'),
  end: document.getElementById('end'),
  endTitle: document.getElementById('endTitle'),
  endEyebrow: document.getElementById('endEyebrow'),
  endPlace: document.getElementById('endPlace'),
  endKills: document.getElementById('endKills'),
  endAura: document.getElementById('endAura'),
  endTime: document.getElementById('endTime'),
  endDamage: document.getElementById('endDamage'),
  endAccuracy: document.getElementById('endAccuracy'),
  endCrits: document.getElementById('endCrits'),
  endLongshot: document.getElementById('endLongshot'),
  endLifetime: document.getElementById('endLifetime'),
  endRank: document.getElementById('endRank'),
  endPromo: document.getElementById('endPromo'),
  endRecord: document.getElementById('endRecord'),
  endContracts: document.getElementById('endContracts'),
};

/* ---------------------------------------------------------
   Multi-Device Adaptive Graphics Engine (5 Tiers)
   --------------------------------------------------------- */
let W = window.innerWidth;
let H = window.innerHeight;
let DPR = 1;

const GRAPHICS_QUALITIES = {
  verylow: {
    key: 'verylow', label: 'Potato', dpr: 1, resScale: 0.72, maxPixels: 1050000,
    particles: 44, decals: 0, lights: false, groundScale: 0.30,
    ambient: false, fx: 0, minimapMs: 210, stormLightning: false,
  },
  low: {
    key: 'low', label: 'Low', dpr: 1, resScale: 0.86, maxPixels: 1800000,
    particles: 96, decals: 24, lights: false, groundScale: 0.40,
    ambient: false, fx: 0, minimapMs: 135, stormLightning: false,
  },
  medium: {
    key: 'medium', label: 'Med', dpr: 1.25, resScale: 1.0, maxPixels: 3200000,
    particles: 190, decals: 64, lights: false, groundScale: 0.55,
    ambient: true, fx: 1, minimapMs: 90, stormLightning: false,
  },
  high: {
    key: 'high', label: 'High', dpr: 1.5, resScale: 1.0, maxPixels: 4900000,
    particles: 300, decals: 120, lights: true, groundScale: 0.70,
    ambient: true, fx: 2, minimapMs: 65, stormLightning: true,
  },
  ultra: {
    key: 'ultra', label: 'Ultra', dpr: 2.0, resScale: 1.0, maxPixels: 7400000,
    particles: 440, decals: 200, lights: true, groundScale: 0.85,
    ambient: true, fx: 3, minimapMs: 45, stormLightning: true,
  },
};
const GRAPHICS_QUALITY_ORDER = ['verylow', 'low', 'medium', 'high', 'ultra'];
const GRAPHICS_QUALITY_KEY = 'battleground.graphics.v2';
let graphicsQuality = 'medium';
let adaptiveQualityReduction = 0;
let liveFps = 0;
let liveFrameMs = 16.7;
let detectedDeviceTier = 'medium';

function detectRecommendedQuality() {
  let score = 2; // start at medium (index 2)
  const cores = Number(navigator.hardwareConcurrency) || 4;
  const mem = Number(navigator.deviceMemory) || 4;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const ua = navigator.userAgent || '';
  const isMobile = coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  if (cores <= 2) score -= 2;
  else if (cores <= 4) score -= 1;
  else if (cores >= 8 && !isMobile) score += 1;

  if (mem <= 2) score -= 1.5;
  else if (mem <= 4 && isMobile) score -= 0.5;
  else if (mem >= 8 && !isMobile) score += 0.5;

  if (isMobile) score -= 0.5;
  if (REDUCED_MOTION) score -= 0.5;

  // Lightweight GPU tier probe (immediately releases context).
  try {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    const gl = probe.getContext('webgl') || probe.getContext('experimental-webgl');
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        const renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
        if (/SwiftShader|llvmpipe|Software|Basic Render|Mesa OffScreen/i.test(renderer)) {
          score = 0;
        } else if (/RTX|RX [6789]|Radeon Pro|Apple M[1-9]|GeForce GTX 1[60]|Arc A|Adreno [78]/i.test(renderer)) {
          score += 1.2;
        } else if (/Intel\(R\) HD|Intel\(R\) UHD|Mali-G5|Mali-T|Adreno [345]/i.test(renderer)) {
          score -= 0.8;
        }
      }
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } else {
      score -= 1;
    }
  } catch (e) { /* ignore probe error */ }

  const idx = clamp(Math.round(score), 0, GRAPHICS_QUALITY_ORDER.length - 1);
  detectedDeviceTier = GRAPHICS_QUALITY_ORDER[idx];
  return detectedDeviceTier;
}

try {
  const savedQuality = localStorage.getItem(GRAPHICS_QUALITY_KEY);
  if (GRAPHICS_QUALITY_ORDER.includes(savedQuality)) {
    graphicsQuality = savedQuality;
    detectRecommendedQuality();
  } else {
    graphicsQuality = detectRecommendedQuality();
  }
} catch (error) {
  graphicsQuality = detectRecommendedQuality();
}

function getEffectiveQualityKey() {
  const selectedIndex = GRAPHICS_QUALITY_ORDER.indexOf(graphicsQuality);
  const reduction = userPrefs.autoAdapt ? adaptiveQualityReduction : 0;
  const effectiveIndex = Math.max(0, selectedIndex - reduction);
  return GRAPHICS_QUALITY_ORDER[effectiveIndex];
}

function getGraphicsSettings() {
  return GRAPHICS_QUALITIES[getEffectiveQualityKey()];
}

function updateGraphicsQualityUI() {
  const effectiveKey = getEffectiveQualityKey();
  const effective = GRAPHICS_QUALITIES[effectiveKey];
  const effLabel = effective.label.toUpperCase();
  document.body.classList.remove(
    'graphics-verylow', 'graphics-low', 'graphics-medium', 'graphics-high', 'graphics-ultra'
  );
  document.body.classList.add('graphics-' + effectiveKey);

  for (const button of document.querySelectorAll('[data-quality]')) {
    const selected = button.dataset.quality === graphicsQuality;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  for (const btn of document.querySelectorAll('[data-adapt-toggle]')) {
    btn.textContent = 'ADAPT: ' + (userPrefs.autoAdapt ? 'ON' : 'OFF');
    btn.classList.toggle('active', userPrefs.autoAdapt);
    btn.setAttribute('aria-pressed', String(userPrefs.autoAdapt));
  }
  const adapted = userPrefs.autoAdapt && adaptiveQualityReduction > 0;
  for (const status of document.querySelectorAll('[data-quality-status]')) {
    const fpsPart = liveFps ? `${liveFps} FPS (${Math.round(liveFrameMs)}ms) · ` : '';
    status.textContent = adapted
      ? fpsPart + 'AUTO → ' + effLabel
      : fpsPart + (userPrefs.autoAdapt ? 'AUTO ADAPT ON' : 'LOCKED · ' + effLabel);
  }
  const perfTier = document.getElementById('menuPerfTier');
  if (perfTier) perfTier.textContent = 'GRAPHICS · ' + effLabel;
  if (UI.fpsBadge && userPrefs.showFps) {
    const scalePct = Math.round(DPR * 100);
    UI.fpsBadge.textContent = (liveFps || '--') + ' FPS · ' + effLabel + ' · ' + scalePct + '%';
    UI.fpsBadge.classList.toggle('low', liveFps > 0 && liveFps < 35);
    UI.fpsBadge.classList.toggle('warn', liveFps >= 35 && liveFps < 50);
  }
}

function applyGraphicsQuality(rebuildGround = true) {
  resize();
  if (typeof trimParticlesToQuality === 'function') trimParticlesToQuality();
  if (typeof trimDecalsToQuality === 'function') trimDecalsToQuality();
  // Adaptive changes mid-match skip rebuilding the baked ground layer so there is ZERO hitch!
  if (rebuildGround && typeof invalidateRenderCaches === 'function') invalidateRenderCaches();
  updateGraphicsQualityUI();
  if (game.state === 'menu' || game.state === 'paused' || game.state === 'over') {
    if (typeof render === 'function') render();
  }
}

function setGraphicsQuality(level) {
  if (!GRAPHICS_QUALITY_ORDER.includes(level)) return;
  if (graphicsQuality === level) {
    if (adaptiveQualityReduction > 0) setAdaptiveQualityReduction(0);
    return;
  }
  graphicsQuality = level;
  adaptiveQualityReduction = 0;
  try { localStorage.setItem(GRAPHICS_QUALITY_KEY, level); } catch (e) {}
  applyGraphicsQuality(true);
}

function setAdaptiveQualityReduction(reduction) {
  const maxRed = GRAPHICS_QUALITY_ORDER.indexOf(graphicsQuality);
  const next = clamp(reduction, 0, maxRed);
  if (next === adaptiveQualityReduction) return;
  adaptiveQualityReduction = next;
  // Never rebuild static ground mid-match during adaptive scaling: zero stutter!
  applyGraphicsQuality(false);
}

/* ---------------------------------------------------------
   Global mutable state
   --------------------------------------------------------- */
const cam = {
  x: WORLD / 2, y: WORLD / 2, zoom: 1, baseZoom: 1,
  leadX: 0, leadY: 0, kickX: 0, kickY: 0,
};

function kickCamera(kx, ky) {
  if (REDUCED_MOTION) return;
  cam.kickX = clamp(cam.kickX + kx, -22, 22);
  cam.kickY = clamp(cam.kickY + ky, -22, 22);
}
const mouse = { x: W / 2, y: H / 2, down: false };
const keys = Object.create(null);

const game = {
  state: 'menu',          // menu | countdown | playing | paused | over
  pausedFrom: null,
  time: 0,
  matchTime: 0,
  countdown: 0,
  countdownStep: -1,
  pendingEnd: null,
  placement: 0,
  shake: 0,
  hurt: 0,
  hitmarker: 0,
  hitmarkerTotal: 0.14,
  hitmarkerKill: false,
  hitmarkerCrit: false,
  invuln: 0,
  killBoost: 1,
  killBoostT: 0,
  regenDelay: 0,
  zoomPunch: 0,
  stormPulse: 0,
  auraFlash: 0,
  damageAngle: 0,
  damageIndicator: 0,
  rewardsBanked: false,
  supplyNext: 55,
  nearPickup: null,
  rankUpNotice: null,
};

let player = null;
let bots = [];
let obstacles = [];
let barrels = [];
let boostPads = [];
let decor = [];
let pickups = [];
let bullets = [];
let projectiles = [];
let smokes = [];
let particles = [];
let decals = [];
let beams = [];
let texts = [];
let pings = [];
let zone = null;
let safeZoneStations = [];
let safeZoneDummies = [];

/* ---------------------------------------------------------
   Spatial Hash Grid for O(1) obstacle queries & LOS
   --------------------------------------------------------- */
const GRID_CELL = 200;
const GRID_DIM = Math.ceil(WORLD / GRID_CELL);
const obstacleGrid = new Array(GRID_DIM * GRID_DIM);
for (let i = 0; i < obstacleGrid.length; i++) obstacleGrid[i] = [];
let _gridStamp = 0;
const _queryBuf = [];

function rebuildObstacleGrid() {
  for (let i = 0; i < obstacleGrid.length; i++) obstacleGrid[i].length = 0;
  for (let idx = 0; idx < obstacles.length; idx++) {
    const o = obstacles[idx];
    o._q = 0;
    if (o.destroyed) continue;
    const x0 = clamp(Math.floor(o.x / GRID_CELL), 0, GRID_DIM - 1);
    const y0 = clamp(Math.floor(o.y / GRID_CELL), 0, GRID_DIM - 1);
    const x1 = clamp(Math.floor((o.x + o.w) / GRID_CELL), 0, GRID_DIM - 1);
    const y1 = clamp(Math.floor((o.y + o.h) / GRID_CELL), 0, GRID_DIM - 1);
    for (let gy = y0; gy <= y1; gy++) {
      const row = gy * GRID_DIM;
      for (let gx = x0; gx <= x1; gx++) {
        obstacleGrid[row + gx].push(o);
      }
    }
  }
}

function queryObstacles(minX, minY, maxX, maxY, out = _queryBuf) {
  out.length = 0;
  const x0 = clamp(Math.floor(minX / GRID_CELL), 0, GRID_DIM - 1);
  const y0 = clamp(Math.floor(minY / GRID_CELL), 0, GRID_DIM - 1);
  const x1 = clamp(Math.floor(maxX / GRID_CELL), 0, GRID_DIM - 1);
  const y1 = clamp(Math.floor(maxY / GRID_CELL), 0, GRID_DIM - 1);
  _gridStamp = (_gridStamp + 1) | 0;
  if (_gridStamp === 0) _gridStamp = 1;
  const stamp = _gridStamp;
  for (let gy = y0; gy <= y1; gy++) {
    const row = gy * GRID_DIM;
    for (let gx = x0; gx <= x1; gx++) {
      const cell = obstacleGrid[row + gx];
      for (let i = 0; i < cell.length; i++) {
        const o = cell[i];
        if (o._q === stamp || o.destroyed) continue;
        o._q = stamp;
        out.push(o);
      }
    }
  }
  return out;
}

function findObstacleAtPoint(x, y, pad = 0) {
  const x0 = clamp(Math.floor((x - pad) / GRID_CELL), 0, GRID_DIM - 1);
  const y0 = clamp(Math.floor((y - pad) / GRID_CELL), 0, GRID_DIM - 1);
  const x1 = clamp(Math.floor((x + pad) / GRID_CELL), 0, GRID_DIM - 1);
  const y1 = clamp(Math.floor((y + pad) / GRID_CELL), 0, GRID_DIM - 1);
  for (let gy = y0; gy <= y1; gy++) {
    const row = gy * GRID_DIM;
    for (let gx = x0; gx <= x1; gx++) {
      const cell = obstacleGrid[row + gx];
      for (let i = 0; i < cell.length; i++) {
        const o = cell[i];
        if (o.destroyed) continue;
        if (x > o.x - pad && x < o.x + o.w + pad &&
            y > o.y - pad && y < o.y + o.h + pad) return o;
      }
    }
  }
  return null;
}

function pointInObstacle(x, y, pad = 0) {
  return findObstacleAtPoint(x, y, pad) !== null;
}

// Allocation-free Liang-Barsky segment-vs-AABB test.
function segRect(x1, y1, x2, y2, rect, pad = 0) {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const minX = rect.x - pad;
  const maxX = rect.x + rect.w + pad;
  const minY = rect.y - pad;
  const maxY = rect.y + rect.h + pad;

  // Check X slabs
  if (dx === 0) {
    if (x1 < minX || x1 > maxX) return false;
  } else {
    const inv = 1 / dx;
    let tx0 = (minX - x1) * inv;
    let tx1 = (maxX - x1) * inv;
    if (tx0 > tx1) { const tmp = tx0; tx0 = tx1; tx1 = tmp; }
    if (tx0 > t0) t0 = tx0;
    if (tx1 < t1) t1 = tx1;
    if (t0 > t1) return false;
  }
  // Check Y slabs
  if (dy === 0) {
    if (y1 < minY || y1 > maxY) return false;
  } else {
    const inv = 1 / dy;
    let ty0 = (minY - y1) * inv;
    let ty1 = (maxY - y1) * inv;
    if (ty0 > ty1) { const tmp = ty0; ty0 = ty1; ty1 = tmp; }
    if (ty0 > t0) t0 = ty0;
    if (ty1 < t1) t1 = ty1;
    if (t0 > t1) return false;
  }
  return true;
}

function hasLOS(x1, y1, x2, y2) {
  // Safe Zone shield barrier blocks sightlines between sanctuary and combat arena.
  if (isPracticeMode()) {
    const in1 = inSafeZoneRect(x1, y1, 0);
    const in2 = inSafeZoneRect(x2, y2, 0);
    if (in1 !== in2) return false;
    if (!in1 && segRect(x1, y1, x2, y2, SAFE_ZONE, 2)) return false;
  }
  // Fast grid-accelerated ray walk using bounding cells along the segment.
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / (GRID_CELL * 0.75)));
  _gridStamp = (_gridStamp + 1) | 0;
  if (_gridStamp === 0) _gridStamp = 1;
  const stamp = _gridStamp;

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const gx = clamp(Math.floor((x1 + dx * t) / GRID_CELL), 0, GRID_DIM - 1);
    const gy = clamp(Math.floor((y1 + dy * t) / GRID_CELL), 0, GRID_DIM - 1);
    const cell = obstacleGrid[gy * GRID_DIM + gx];
    for (let i = 0; i < cell.length; i++) {
      const o = cell[i];
      if (o._q === stamp || o.destroyed) continue;
      o._q = stamp;
      if (segRect(x1, y1, x2, y2, o, 3)) return false;
    }
  }
  return true;
}

/* ---------------------------------------------------------
   Audio — fully synthesized, no asset files, procedural score
   --------------------------------------------------------- */
const AUDIO_KEY = 'battleground.audio.v2';
const audioSettings = { music: true, volume: 70 };
try {
  const saved = JSON.parse(localStorage.getItem(AUDIO_KEY) || 'null');
  if (saved && typeof saved === 'object') {
    if (typeof saved.music === 'boolean') audioSettings.music = saved.music;
    if (typeof saved.volume === 'number' && Number.isFinite(saved.volume)) {
      audioSettings.volume = clamp(saved.volume, 0, 100);
    }
  }
} catch (error) {}

let actx = null;
let master = null;
let masterWarmth = null;
let masterLimiter = null;
let sfxGain = null;
let musicGain = null;
let musicFilter = null;
let reverbSend = null;
let reverbNode = null;
let reverbWet = null;
let noiseBuffer = null;
let audioMuted = false;

const SFX_LAST = Object.create(null);
const SFX_GAP = {
  pistol: 45, smg: 46, shotgun: 70, revolver: 60, rifle: 55,
  pulse: 42, dmr: 55, lmg: 48, sniper: 80, railgun: 95,
  minigun: 42, minigunSpin: 140, bazooka: 120,
  hit: 36, crit: 52, hurt: 140, kill: 110, streak: 200, aura: 120,
  ui: 40, armor: 120, explosion: 85, emp: 120, smoke: 120,
  bounce: 65, boost: 180, crateBreak: 70, swap: 75, throw: 90,
};

function createArenaImpulse(ac) {
  const dur = 0.68;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, 2.8);
      const white = Math.random() * 2 - 1;
      // Progressive high-frequency air damping for natural tactical arena space
      lp = lp * (0.42 + t * 0.48) + white * (0.58 - t * 0.48);
      data[i] = lp * env;
    }
  }
  return buf;
}

function updateAudioMix() {
  if (!actx) return;
  const now = actx.currentTime;
  const paused = typeof game !== 'undefined' && game && game.state === 'paused';
  if (master) {
    const targetMaster = audioMuted ? 0 : (audioSettings.volume / 100) * 0.78;
    master.gain.setTargetAtTime(targetMaster, now, 0.03);
  }
  if (musicGain) {
    const moodMul = paused ? 0.32 : musicMood === 'menu' ? 0.7 : 0.85;
    const targetMusic = audioSettings.music && !audioMuted ? moodMul : 0;
    musicGain.gain.setTargetAtTime(targetMusic, now, 0.08);
  }
  if (musicFilter) {
    const targetCut = paused ? 480 : musicMood === 'menu' ? 2100 : musicMood === 'final' ? 12500 : 8800;
    musicFilter.frequency.setTargetAtTime(targetCut, now, 0.14);
  }
}

function applyAudioSettings() {
  updateAudioMix();
}

function saveAudioSettings() {
  try { localStorage.setItem(AUDIO_KEY, JSON.stringify(audioSettings)); } catch (e) {}
  applyAudioSettings();
}

function updateAudioSettingsUI() {
  const musicOn = audioSettings.music && !audioMuted;
  for (const button of document.querySelectorAll('[data-audio-toggle]')) {
    button.textContent = musicOn ? 'MUSIC ON' : 'MUSIC OFF';
    button.classList.toggle('off', !musicOn);
    button.setAttribute('aria-pressed', String(musicOn));
  }
  for (const slider of document.querySelectorAll('[data-audio-volume]')) {
    slider.value = String(audioSettings.volume);
  }
  for (const status of document.querySelectorAll('[data-audio-status]')) {
    status.textContent = (audioMuted ? 'MUTED · ' : musicOn ? 'MUSIC ON · ' : 'MUSIC OFF · ') +
      audioSettings.volume + '% VOLUME';
  }
}

function setAudioMusic(on) {
  audioSettings.music = !!on;
  saveAudioSettings();
  updateAudioSettingsUI();
  if (audioSettings.music && !audioMuted) ensureAudio();
}

function setAudioVolume(value) {
  audioSettings.volume = clamp(Number(value) || 0, 0, 100);
  saveAudioSettings();
  updateAudioSettingsUI();
}

let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked && actx && actx.state === 'running') return;
  const ok = ensureAudio();
  if (ok && actx && actx.state === 'running') {
    audioUnlocked = true;
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  }
}
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', unlockAudio);

function ensureAudio() {
  if (audioMuted) return false;
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = 0;

    // Master warmth lowshelf + soft dynamics limiter (prevents clipping & adds punch)
    let mixDest = master;
    if (actx.createDynamicsCompressor) {
      masterLimiter = actx.createDynamicsCompressor();
      masterLimiter.threshold.value = -13;
      masterLimiter.knee.value = 14;
      masterLimiter.ratio.value = 6;
      masterLimiter.attack.value = 0.003;
      masterLimiter.release.value = 0.16;
      masterLimiter.connect(master);
      mixDest = masterLimiter;
    }
    if (actx.createBiquadFilter) {
      masterWarmth = actx.createBiquadFilter();
      masterWarmth.type = 'lowshelf';
      masterWarmth.frequency.value = 115;
      masterWarmth.gain.value = 2.6;
      masterWarmth.connect(mixDest);
      mixDest = masterWarmth;
    }

    sfxGain = actx.createGain();
    sfxGain.gain.value = 1;
    sfxGain.connect(mixDest);

    musicGain = actx.createGain();
    musicGain.gain.value = 0;
    if (actx.createBiquadFilter) {
      musicFilter = actx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 2100;
      musicFilter.Q.value = 0.7;
      musicGain.connect(musicFilter);
      musicFilter.connect(mixDest);
    } else {
      musicGain.connect(mixDest);
    }

    // Procedural stereo arena reverb bus
    if (actx.createConvolver) {
      try {
        reverbSend = actx.createGain();
        reverbSend.gain.value = 1;
        reverbNode = actx.createConvolver();
        reverbNode.buffer = createArenaImpulse(actx);
        reverbWet = actx.createGain();
        reverbWet.gain.value = 0.24;
        reverbSend.connect(reverbNode);
        reverbNode.connect(reverbWet);
        reverbWet.connect(mixDest);
        // Subtle ambient glue on music bus
        const musicRev = actx.createGain();
        musicRev.gain.value = 0.16;
        (musicFilter || musicGain).connect(musicRev);
        musicRev.connect(reverbSend);
      } catch (e) {
        reverbSend = null;
      }
    }

    master.connect(actx.destination);
    const len = Math.floor(actx.sampleRate * 1.5);
    noiseBuffer = actx.createBuffer(1, len, actx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    musicNextNote = actx.currentTime + 0.08;
  }
  if (actx.state === 'suspended') {
    const p = actx.resume();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        if (actx && actx.state === 'running') {
          audioUnlocked = true;
          musicNextNote = actx.currentTime + 0.06;
          updateAudioMix();
        }
      }).catch(() => {});
    }
  }
  applyAudioSettings();
  return true;
}

function routeAudio(node, bus, pan, reverbAmt = 0) {
  const targetBus = bus || sfxGain || master;
  let out = node;
  if (pan && actx.createStereoPanner) {
    const panner = actx.createStereoPanner();
    panner.pan.value = clamp(pan, -1, 1);
    node.connect(panner);
    out = panner;
  }
  out.connect(targetBus);
  if (reverbAmt > 0 && reverbSend) {
    const send = actx.createGain();
    send.gain.value = reverbAmt;
    out.connect(send);
    send.connect(reverbSend);
  }
}

function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, when = 0, bus = null, pan = 0, opts = null) {
  if (!actx || audioMuted) return;
  const t0 = actx.currentTime + Math.max(0, when);
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type;
  const startFreq = Math.max(20, freq);
  osc.frequency.setValueAtTime(startFreq, t0);
  if (opts && opts.detune) osc.detune.setValueAtTime(opts.detune, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, startFreq + slide), t0 + dur);
  const atk = Math.min(dur * 0.4, (opts && opts.attack) || 0.005);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + atk);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  let head = osc;
  if (opts && opts.cutoff && actx.createBiquadFilter) {
    const flt = actx.createBiquadFilter();
    flt.type = opts.filterType || 'lowpass';
    flt.frequency.setValueAtTime(opts.cutoff, t0);
    if (opts.endCutoff) flt.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endCutoff), t0 + dur);
    if (opts.q) flt.Q.value = opts.q;
    head.connect(flt);
    head = flt;
  }
  head.connect(gain);
  routeAudio(gain, bus, pan, opts && opts.reverb ? opts.reverb : 0);
  osc.start(t0);
  osc.stop(t0 + dur + 0.035);
}

function noiseBurst(dur, vol, cutoff = 1800, when = 0, bus = null, pan = 0, opts = null) {
  if (!actx || audioMuted || !noiseBuffer) return;
  const t0 = actx.currentTime + Math.max(0, when);
  const src = actx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = actx.createBiquadFilter();
  filter.type = (opts && opts.filterType) || 'lowpass';
  filter.frequency.setValueAtTime(Math.max(40, cutoff), t0);
  if (opts && opts.endCutoff) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endCutoff), t0 + dur);
  }
  if (opts && opts.q) filter.Q.value = opts.q;
  const gain = actx.createGain();
  const atk = opts && opts.attack ? Math.min(dur * 0.4, opts.attack) : 0;
  if (atk > 0.002) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t0 + atk);
  } else {
    gain.gain.setValueAtTime(Math.max(0.001, vol), t0);
  }
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  routeAudio(gain, bus, pan, opts && opts.reverb ? opts.reverb : 0);
  const offset = Math.random() * Math.max(0.05, noiseBuffer.duration - dur - 0.05);
  src.start(t0, offset);
  src.stop(t0 + dur + 0.035);
}

function spatialGain(x, y) {
  if (x == null || !player || !player.alive) return 0.55;
  return clamp(1 - distance(x, y, player.x, player.y) / 1600, 0.06, 1);
}

function spatialPan(x) {
  if (x == null || !player) return 0;
  return clamp((x - player.x) / 900, -1, 1);
}

/* ---- Procedural Tactical Electronic Score ---- */
const MUSIC = {
  menu: {
    bpm: 92, root: 110,
    bass: [0, 0, -4, -4, -2, -2, 3, 2],
    chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [3, 7, 10]],
    lead: [0, null, 7, null, 12, null, 10, 7, 3, null, 7, null, 10, null, 5, null],
  },
  battle: {
    bpm: 122, root: 110,
    bass: [0, 0, 3, 0, 5, 3, 7, 5],
    chords: [[0, 7, 12], [3, 7, 10], [5, 8, 12], [7, 10, 14]],
    lead: [0, 7, 12, 7, 3, 10, 7, 12, 5, 12, 10, 7, 3, 7, 10, 12],
  },
  final: {
    bpm: 142, root: 98,
    bass: [0, 0, 0, 3, 5, 5, 7, 10],
    chords: [[0, 7, 15], [3, 10, 15], [5, 12, 17], [7, 14, 19]],
    lead: [0, 12, 7, 12, 3, 12, 10, 12, 5, 12, 7, 12, 8, 12, 10, 15],
  },
};
let musicMood = 'menu';
let musicStep = 0;
let musicNextNote = 0;

function setMusicMood(mood) {
  if (MUSIC[mood] && musicMood !== mood) {
    musicMood = mood;
    musicStep = 0;
    if (actx) musicNextNote = actx.currentTime + 0.06;
    updateAudioMix();
  }
}

function scheduleMusicStep(step, when) {
  if (!actx) return;
  // Convert absolute AudioContext schedule time into a relative offset for tone()/noiseBurst().
  const delay = Math.max(0, when - actx.currentTime);
  const m = MUSIC[musicMood];
  const s = step % 16;
  const bar = (step >> 4) % m.chords.length;
  const root = m.root;
  const note = (semi, oct = 1) => root * oct * Math.pow(2, semi / 12);

  // Atmospheric stereo synth pad on bar downbeat
  if (s === 0) {
    const chord = m.chords[bar];
    const padDur = (60 / m.bpm) * 3.8;
    const padVol = musicMood === 'menu' ? 0.032 : 0.024;
    for (let i = 0; i < chord.length; i++) {
      tone(note(chord[i], 1), padDur, 'triangle', padVol, 0, delay, musicGain, (i - 1) * 0.35, {
        attack: 0.14, detune: i % 2 ? 6 : -6, cutoff: 1400,
      });
    }
  }

  // Rhythmic sub-bass & filtered pulse bass
  const bassHit = musicMood === 'menu' ? (s % 4 === 0)
    : musicMood === 'final' ? (s % 2 === 0)
    : (s % 4 === 0 || s === 6 || s === 14);
  if (bassHit) {
    const semi = m.bass[(step >> 2) % m.bass.length];
    const dur = musicMood === 'final' ? 0.19 : 0.32;
    const accent = s % 4 === 0 ? 1 : 0.65;
    tone(note(semi, 0.5), dur + 0.06, 'sine', 0.11 * accent, 0, delay, musicGain);
    tone(note(semi, 1), dur, 'sawtooth', 0.055 * accent, 0, delay, musicGain, 0, {
      cutoff: musicMood === 'menu' ? 420 : 880, endCutoff: 220, q: 2.2,
    });
  }

  // Arpeggiated tactical synth lead with subtle stereo ping-pong
  const lead = m.lead[s];
  if (lead != null) {
    const leadPan = (s % 2 ? 0.24 : -0.24);
    const leadVol = musicMood === 'final' ? 0.044 : musicMood === 'battle' ? 0.034 : 0.028;
    tone(note(lead, 2), 0.16, musicMood === 'menu' ? 'sine' : 'triangle', leadVol, 0, delay, musicGain, leadPan, {
      cutoff: 3200, endCutoff: 950,
    });
  }

  // Punchy kick drum
  const kickHit = musicMood === 'menu'
    ? (s === 0 || s === 10)
    : (s === 0 || s === 8 || (musicMood === 'final' && (s === 6 || s === 14)));
  if (kickHit) {
    tone(128, 0.14, 'sine', musicMood === 'menu' ? 0.14 : 0.22, -92, delay, musicGain, 0, { attack: 0.002 });
    noiseBurst(0.018, 0.04, 1800, delay, musicGain, 0, { filterType: 'bandpass', q: 1.4 });
  }

  // Crisp snare / tactical clap on backbeats (battle & final)
  if (musicMood !== 'menu' && (s === 4 || s === 12)) {
    noiseBurst(0.11, 0.075, 2200, delay, musicGain, 0, { filterType: 'bandpass', q: 1.1, endCutoff: 900 });
    tone(195, 0.075, 'triangle', 0.065, -90, delay, musicGain);
  }

  // Hi-hat groove
  const hatHit = musicMood === 'final' ? true : (musicMood === 'battle' ? s % 2 === 0 : s % 4 === 2);
  if (hatHit) {
    const openHat = s === 14 || s === 6;
    noiseBurst(openHat ? 0.065 : 0.028, openHat ? 0.022 : 0.013, 8200, delay, musicGain,
      s % 2 ? 0.14 : -0.14, { filterType: 'highpass' });
  }
}

function updateMusic() {
  if (!actx || !audioSettings.music || audioMuted || document.hidden || actx.state !== 'running') return;
  const m = MUSIC[musicMood];
  const stepDur = 60 / m.bpm / 4;
  const now = actx.currentTime;
  if (musicNextNote < now - 0.35 || musicNextNote > now + 1.5) musicNextNote = now + 0.05;
  let guard = 0;
  while (musicNextNote < now + 0.16 && guard++ < 16) {
    scheduleMusicStep(musicStep, musicNextNote);
    musicNextNote += stepDur;
    musicStep++;
  }
}

function sfx(name, x, y, param = 0) {
  if (audioMuted || !ensureAudio()) return;
  if (actx && actx.state !== 'running') return;
  const v = spatialGain(x, y);
  if (v < 0.07 && x != null) return;
  const pan = x != null ? spatialPan(x) : 0;
  const now = performance.now();
  const gap = SFX_GAP[name] || 45;
  if (now - (SFX_LAST[name] || 0) < gap) return;
  SFX_LAST[name] = now;
  const jit = 0.95 + Math.random() * 0.1;

  switch (name) {
    case 'pistol':
      noiseBurst(0.065, 0.32 * v, 3200 * jit, 0, null, pan, { endCutoff: 850, reverb: 0.14 });
      tone(210 * jit, 0.075, 'triangle', 0.13 * v, -135, 0, null, pan);
      tone(980 * jit, 0.026, 'square', 0.045 * v, -620, 0, null, pan);
      break;
    case 'smg':
      noiseBurst(0.042, 0.24 * v, 3800 * jit, 0, null, pan, { filterType: 'bandpass', q: 0.9, endCutoff: 1100, reverb: 0.1 });
      tone(265 * jit, 0.046, 'sawtooth', 0.085 * v, -150, 0, null, pan, { cutoff: 1900 });
      tone(1250 * jit, 0.018, 'triangle', 0.03 * v, -520, 0, null, pan);
      break;
    case 'shotgun':
      noiseBurst(0.18, 0.48 * v, 1900 * jit, 0, null, pan, { endCutoff: 320, reverb: 0.32 });
      tone(112 * jit, 0.19, 'triangle', 0.24 * v, -76, 0, null, pan);
      noiseBurst(0.28, 0.14 * v, 720, 0.025, null, pan, { endCutoff: 200, reverb: 0.28 });
      // Subtle mechanical pump-rack follow-up
      noiseBurst(0.045, 0.07 * v, 2400, 0.18, null, pan, { filterType: 'bandpass', q: 2.4 });
      tone(340, 0.035, 'square', 0.028 * v, 120, 0.21, null, pan);
      break;
    case 'rifle':
      noiseBurst(0.1, 0.42 * v, 4400 * jit, 0, null, pan, { endCutoff: 780, reverb: 0.24 });
      tone(155 * jit, 0.12, 'sawtooth', 0.16 * v, -95, 0, null, pan, { cutoff: 1400 });
      noiseBurst(0.035, 0.16 * v, 5200, 0, null, pan, { filterType: 'highpass' });
      break;
    case 'pulse':
      tone(860 * jit, 0.068, 'sawtooth', 0.1 * v, -540, 0, null, pan, { cutoff: 3400, endCutoff: 700, reverb: 0.16 });
      tone(1620 * jit, 0.055, 'sine', 0.06 * v, -840, 0, null, pan);
      noiseBurst(0.045, 0.15 * v, 4800, 0, null, pan, { filterType: 'bandpass', q: 1.5 });
      break;
    case 'revolver':
      noiseBurst(0.13, 0.48 * v, 2800 * jit, 0, null, pan, { endCutoff: 520, reverb: 0.34 });
      tone(125 * jit, 0.16, 'sawtooth', 0.2 * v, -78, 0, null, pan, { cutoff: 1100 });
      tone(680 * jit, 0.08, 'triangle', 0.06 * v, -380, 0.01, null, pan, { reverb: 0.22 });
      break;
    case 'dmr':
      noiseBurst(0.085, 0.36 * v, 4800 * jit, 0, null, pan, { endCutoff: 900, reverb: 0.26 });
      tone(195 * jit, 0.11, 'sawtooth', 0.14 * v, -110, 0, null, pan, { cutoff: 2200 });
      tone(1100 * jit, 0.032, 'sine', 0.05 * v, -700, 0, null, pan);
      break;
    case 'lmg':
      noiseBurst(0.062, 0.3 * v, 3100 * jit, 0, null, pan, { endCutoff: 680, reverb: 0.18 });
      tone(148 * jit, 0.075, 'sawtooth', 0.13 * v, -84, 0, null, pan, { cutoff: 1200 });
      tone(780 * jit, 0.022, 'square', 0.032 * v, -320, 0, null, pan);
      break;
    case 'sniper':
      noiseBurst(0.22, 0.56 * v, 4600 * jit, 0, null, pan, { endCutoff: 420, reverb: 0.48 });
      tone(94 * jit, 0.26, 'triangle', 0.28 * v, -56, 0, null, pan);
      noiseBurst(0.05, 0.24 * v, 5600, 0, null, pan, { filterType: 'highpass' });
      noiseBurst(0.45, 0.11 * v, 740, 0.06, null, pan, { endCutoff: 190, reverb: 0.45 });
      break;
    case 'railgun':
      tone(2100, 0.2, 'sawtooth', 0.14 * v, -1820, 0, null, pan, { cutoff: 5200, endCutoff: 420, reverb: 0.42 });
      tone(118, 0.3, 'triangle', 0.28 * v, -74, 0, null, pan);
      tone(540, 0.32, 'sine', 0.08 * v, 280, 0.02, null, pan, { reverb: 0.46 });
      noiseBurst(0.18, 0.46 * v, 6400, 0, null, pan, { endCutoff: 800, reverb: 0.38 });
      break;
    case 'minigun':
      noiseBurst(0.04, 0.25 * v, 3600 * jit, 0, null, pan, { filterType: 'bandpass', q: 0.8, endCutoff: 950, reverb: 0.14 });
      tone(152 * jit, 0.045, 'sawtooth', 0.11 * v, -92, 0, null, pan, { cutoff: 1500 });
      tone(640 * jit, 0.022, 'square', 0.036 * v, -310, 0, null, pan);
      break;
    case 'minigunSpin': {
      const sp = clamp(param || 0, 0, 1);
      const baseF = 115 + sp * 240;
      tone(baseF, 0.14, 'sawtooth', (0.045 + sp * 0.03) * v, 75, 0, null, pan, { cutoff: 900 + sp * 1800 });
      tone(baseF * 2.02, 0.13, 'triangle', (0.028 + sp * 0.02) * v, 110, 0.008, null, pan);
      break;
    }
    case 'bazooka':
      // Pneumatic launch tube thoomp + rocket motor ignition whoosh
      tone(118, 0.26, 'triangle', 0.3 * v, -84, 0, null, pan, { reverb: 0.3 });
      noiseBurst(0.14, 0.44 * v, 1250, 0, null, pan, { endCutoff: 340, reverb: 0.32 });
      noiseBurst(0.36, 0.26 * v, 2800, 0.035, null, pan, { filterType: 'bandpass', q: 0.9, endCutoff: 620, attack: 0.025, reverb: 0.28 });
      break;
    case 'explosion':
      // Seismic sub-drop + fiery roar + debris crackle + arena echo
      tone(82, 0.48, 'sine', 0.34 * v, -58, 0, null, pan);
      tone(138, 0.28, 'sawtooth', 0.22 * v, -104, 0.01, null, pan, { cutoff: 520, endCutoff: 95 });
      noiseBurst(0.12, 0.56 * v, 3200, 0, null, pan, { endCutoff: 450, reverb: 0.48 });
      noiseBurst(0.55, 0.48 * v, 860, 0.02, null, pan, { endCutoff: 140, reverb: 0.52 });
      noiseBurst(0.24, 0.14 * v, 4200, 0.09, null, pan, { filterType: 'bandpass', q: 1.8 });
      break;
    case 'emp':
      tone(1180, 0.32, 'sawtooth', 0.14 * v, -1040, 0, null, pan, { cutoff: 4200, endCutoff: 280, reverb: 0.4 });
      tone(380, 0.42, 'sine', 0.2 * v, -300, 0.025, null, pan, { reverb: 0.32 });
      noiseBurst(0.24, 0.26 * v, 4600, 0, null, pan, { filterType: 'bandpass', q: 1.6, endCutoff: 520 });
      break;
    case 'smoke':
      noiseBurst(0.62, 0.26 * v, 1600, 0, null, pan, { endCutoff: 520, attack: 0.04, reverb: 0.22 });
      tone(220, 0.14, 'sine', 0.06 * v, -110, 0, null, pan);
      break;
    case 'throw':
      noiseBurst(0.1, 0.16 * v, 2100, 0, null, pan, { filterType: 'bandpass', q: 1.2, endCutoff: 700 });
      tone(320, 0.085, 'sine', 0.055 * v, 190, 0, null, pan);
      break;
    case 'bounce':
      tone(310 * jit, 0.048, 'triangle', 0.075 * v, -110, 0, null, pan);
      noiseBurst(0.024, 0.05 * v, 2200, 0, null, pan, { filterType: 'bandpass', q: 2.2 });
      break;
    case 'boost':
      tone(240, 0.26, 'sine', 0.15 * v, 760, 0, null, pan, { reverb: 0.24 });
      tone(480, 0.2, 'triangle', 0.08 * v, 820, 0.02, null, pan);
      noiseBurst(0.22, 0.18 * v, 2800, 0, null, pan, { filterType: 'bandpass', q: 1.2, endCutoff: 5200 });
      break;
    case 'crateBreak':
      noiseBurst(0.17, 0.3 * v, 1500, 0, null, pan, { endCutoff: 360, reverb: 0.2 });
      tone(155 * jit, 0.11, 'square', 0.1 * v, -92, 0, null, pan, { cutoff: 950 });
      noiseBurst(0.09, 0.16 * v, 3200, 0.03, null, pan, { filterType: 'bandpass', q: 2.0 });
      break;
    case 'swap':
      tone(480, 0.04, 'triangle', 0.065, 220);
      noiseBurst(0.032, 0.06, 3600, 0.015, null, 0, { filterType: 'bandpass', q: 2.4 });
      break;
    case 'crit':
      tone(1040, 0.07, 'triangle', 0.12 * v, 460, 0, null, pan, { reverb: 0.22 });
      tone(1680, 0.1, 'sine', 0.095 * v, 280, 0.02, null, pan, { reverb: 0.28 });
      noiseBurst(0.025, 0.08 * v, 5800, 0, null, pan, { filterType: 'highpass' });
      break;
    case 'aura':
      [660, 990, 1320, 1760].forEach((f, i) =>
        tone(f, 0.24, 'sine', 0.065, 120, i * 0.05, null, (i - 1.5) * 0.2, { reverb: 0.35 }));
      break;
    case 'hit':
      tone(520 * jit, 0.042, 'triangle', 0.085 * v, -240, 0, null, pan);
      noiseBurst(0.02, 0.075 * v, 4200, 0, null, pan, { filterType: 'bandpass', q: 1.8 });
      break;
    case 'hurt':
      tone(98, 0.2, 'sawtooth', 0.2, -46, 0, null, 0, { cutoff: 480 });
      noiseBurst(0.11, 0.16, 820, 0, null, 0, { endCutoff: 240 });
      break;
    case 'reload':
      tone(640, 0.035, 'square', 0.05, -180);
      noiseBurst(0.035, 0.07, 2800, 0.03, null, 0, { filterType: 'bandpass', q: 2.4 });
      tone(390, 0.048, 'triangle', 0.045, -70, 0.065);
      break;
    case 'reloadDone':
      noiseBurst(0.03, 0.08, 3800, 0, null, 0, { filterType: 'bandpass', q: 2.2 });
      tone(780, 0.05, 'triangle', 0.075, 160);
      tone(1180, 0.075, 'sine', 0.06, 90, 0.048, null, 0, { reverb: 0.2 });
      break;
    case 'pickup':
      tone(587, 0.075, 'triangle', 0.095, 60, 0, null, 0, { reverb: 0.18 });
      tone(880, 0.1, 'sine', 0.08, 80, 0.065, null, 0, { reverb: 0.24 });
      break;
    case 'kill':
      tone(115, 0.18, 'sine', 0.18, -62);
      tone(523, 0.14, 'triangle', 0.1, 180, 0.015, null, 0, { reverb: 0.28 });
      tone(784, 0.22, 'sine', 0.085, 120, 0.06, null, 0, { reverb: 0.34 });
      break;
    case 'streak':
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(f, 0.22, 'triangle', 0.08, 0, i * 0.055, null, (i - 1.5) * 0.18, { reverb: 0.32 }));
      break;
    case 'armor':
      tone(420, 0.11, 'sine', 0.09 * v, 320, 0, null, pan, { reverb: 0.25 });
      tone(840, 0.15, 'triangle', 0.065 * v, 440, 0.04, null, pan, { reverb: 0.3 });
      noiseBurst(0.07, 0.09 * v, 5400, 0.01, null, pan, { filterType: 'highpass' });
      break;
    case 'zone':
      tone(62, 0.65, 'sawtooth', 0.14, 28, 0, null, 0, { cutoff: 340, endCutoff: 780, reverb: 0.45 });
      tone(124, 0.55, 'triangle', 0.08, 42, 0.05, null, 0, { reverb: 0.4 });
      noiseBurst(0.52, 0.08, 380, 0, null, 0, { endCutoff: 140 });
      break;
    case 'dash':
      noiseBurst(0.16, 0.14, 1400, 0, null, 0, { filterType: 'bandpass', q: 0.9, endCutoff: 3400 });
      tone(190, 0.13, 'sine', 0.075, 240);
      break;
    case 'empty':
      tone(175, 0.03, 'square', 0.05, -40);
      break;
    case 'ui':
      tone(760, 0.045, 'sine', 0.055, 180);
      break;
    case 'record':
      [784, 988, 1319, 1568].forEach((f, i) =>
        tone(f, 0.24, 'triangle', 0.075, 0, i * 0.085, null, (i - 1.5) * 0.2, { reverb: 0.34 }));
      break;
    case 'win':
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone(f, 0.36, 'triangle', 0.1, 0, i * 0.11, null, (i - 2) * 0.18, { reverb: 0.4 }));
      break;
    case 'lose':
      [330, 262, 196, 147].forEach((f, i) =>
        tone(f, 0.38, 'triangle', 0.095, -12, i * 0.14, null, 0, { cutoff: 1400, reverb: 0.35 }));
      break;
  }
}

/* ---------------------------------------------------------
   Resize / camera / coordinates
   --------------------------------------------------------- */
function resize() {
  const vv = window.visualViewport;
  W = Math.round(vv ? vv.width : window.innerWidth);
  H = Math.round(vv ? vv.height : window.innerHeight);
  const quality = getGraphicsSettings();
  const rawDpr = Math.min(window.devicePixelRatio || 1, quality.dpr) * (quality.resScale || 1);
  const pixelDpr = Math.sqrt(quality.maxPixels / Math.max(1, W * H));
  DPR = clamp(Math.min(rawDpr, pixelDpr), 0.55, 2.0);
  canvas.width = Math.max(1, Math.floor(W * DPR));
  canvas.height = Math.max(1, Math.floor(H * DPR));
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  cam.baseZoom = clamp(Math.min(W / 1250, H / 730), 0.72, 1.25);
  if (game.state === 'menu' || !cam.zoom) cam.zoom = cam.baseZoom;

  const mm = minimap.clientWidth || 174;
  const mmDpr = Math.min(DPR, 1.5);
  minimap.width = Math.max(1, Math.floor(mm * mmDpr));
  minimap.height = Math.max(1, Math.floor(mm * mmDpr));
}

function screenToWorld(sx, sy) {
  return {
    x: cam.x + (sx - W / 2) / cam.zoom,
    y: cam.y + (sy - H / 2) / cam.zoom,
  };
}

function worldToScreen(wx, wy) {
  return {
    x: (wx - cam.x) * cam.zoom + W / 2,
    y: (wy - cam.y) * cam.zoom + H / 2,
  };
}

function updateCamera(dt) {
  const base = cam.baseZoom || 1;
  const punch = REDUCED_MOTION ? 0 : (game.zoomPunch || 0);
  // Subtle dynamic FOV breathing when dashing or sprinting for silky speed feel.
  let speedZoom = 0;
  if (!REDUCED_MOTION && player && player.alive && game.state === 'playing') {
    if (player.dashT > 0) speedZoom = -0.022;
    else if (player.speedBoostT > 0) speedZoom = -0.015;
    else if (Math.hypot(player.vx || 0, player.vy || 0) > 120) {
      speedZoom = -0.01;
    }
  }
  const targetZoom = base * (1 + punch + speedZoom);
  cam.zoom = damp(cam.zoom || base, targetZoom, 9, dt);

  // Smooth exponential decay on directional camera recoil kick.
  const kickDecay = Math.exp(-14 * dt);
  cam.kickX *= kickDecay;
  cam.kickY *= kickDecay;
  if (Math.abs(cam.kickX) < 0.02) cam.kickX = 0;
  if (Math.abs(cam.kickY) < 0.02) cam.kickY = 0;

  if (!player || game.state === 'menu') {
    const t = game.time;
    cam.x = WORLD / 2 + Math.cos(t * 0.06) * 520;
    cam.y = WORLD / 2 + Math.sin(t * 0.045) * 380;
    cam.leadX = 0;
    cam.leadY = 0;
    return;
  }
  const viewW = W / cam.zoom;
  const viewH = H / cam.zoom;
  let desiredLeadX = 0;
  let desiredLeadY = 0;
  if (touchState && touchState.aimActive) {
    desiredLeadX = touchState.aimX * 52;
    desiredLeadY = touchState.aimY * 52;
  } else {
    desiredLeadX = clamp((mouse.x - W / 2) / cam.zoom * 0.085, -62, 62);
    desiredLeadY = clamp((mouse.y - H / 2) / cam.zoom * 0.085, -62, 62);
  }
  cam.leadX = damp(cam.leadX, desiredLeadX, 7.5, dt);
  cam.leadY = damp(cam.leadY, desiredLeadY, 7.5, dt);

  const halfW = Math.min(viewW / 2, WORLD / 2);
  const halfH = Math.min(viewH / 2, WORLD / 2);
  const targetX = clamp(player.x + cam.leadX, halfW, WORLD - halfW);
  const targetY = clamp(player.y + cam.leadY, halfH, WORLD - halfH);
  cam.x = damp(cam.x, targetX, 9.5, dt);
  cam.y = damp(cam.y, targetY, 9.5, dt);
}

/* ---------------------------------------------------------
   Input (Keyboard, Mouse, Wheel, Settings, Dual-Stick Touch)
   --------------------------------------------------------- */
window.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

let lastWheelSwap = 0;

canvas.addEventListener('mousedown', (e) => {
  if ((game.state !== 'playing' && game.state !== 'countdown') || !player || !player.alive) return;
  if (e.button === 0) {
    mouse.down = true;
  } else if (e.button === 2 && game.state === 'playing') {
    if (typeof tryUseGadget === 'function') tryUseGadget();
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.down = false;
});

window.addEventListener('wheel', (e) => {
  if (game.state !== 'playing' || !player || !player.alive) return;
  if (e.target && e.target.closest && e.target.closest('#safeZonePanel')) return;
  if (Math.abs(e.deltaY) < 4) return;
  const now = performance.now();
  if (now - lastWheelSwap < 140) return;
  lastWheelSwap = now;
  if (typeof switchWeapon === 'function') switchWeapon(player.activeSlot === 0 ? 1 : 0);
}, { passive: true });

window.addEventListener('blur', () => {
  mouse.down = false;
  for (const k in keys) keys[k] = false;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code.startsWith('Arrow') ||
      (e.code === 'Tab' && game.state === 'playing')) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;

  if (e.code === 'KeyM') {
    if (typeof toggleMute === 'function') toggleMute();
    return;
  }
  if (e.code === 'Escape') {
    if (typeof handleEscape === 'function') handleEscape();
    return;
  }
  if (e.code === 'Enter') {
    if (typeof handleEnter === 'function') handleEnter();
    return;
  }
  if (game.state !== 'playing' || !player || !player.alive) return;
  if (e.code === 'KeyR' && typeof startReload === 'function') startReload(player);
  if (e.code === 'Space' && typeof tryDash === 'function') tryDash();
  if (e.code === 'KeyQ' && typeof switchWeapon === 'function') switchWeapon(player.activeSlot === 0 ? 1 : 0);
  if (e.code === 'Digit1' && typeof switchWeapon === 'function') switchWeapon(0);
  if (e.code === 'Digit2' && typeof switchWeapon === 'function') switchWeapon(1);
  if (e.code === 'KeyE' && typeof interactPickup === 'function') interactPickup();
  if (e.code === 'KeyG' && typeof tryUseGadget === 'function') tryUseGadget();
  if (e.code === 'KeyH' && isPracticeMode() && !player.inSafeZone && typeof returnToSafeZone === 'function') {
    returnToSafeZone();
  }
  if (e.code === 'KeyT' && isPracticeMode() && player.inSafeZone && typeof teleportToCombat === 'function') {
    teleportToCombat();
  }
});

window.addEventListener('keyup', (e) => { keys[e.code] = false; });

for (const button of document.querySelectorAll('[data-quality]')) {
  button.addEventListener('click', () => {
    setGraphicsQuality(button.dataset.quality);
    sfx('ui');
  });
}
for (const button of document.querySelectorAll('[data-quality-auto]')) {
  button.addEventListener('click', () => {
    const rec = detectRecommendedQuality();
    setGraphicsQuality(rec);
    sfx('ui');
    if (typeof showToast === 'function') {
      showToast('AUTO: ' + GRAPHICS_QUALITIES[rec].label.toUpperCase(), 1300);
    }
  });
}
for (const button of document.querySelectorAll('[data-adapt-toggle]')) {
  button.addEventListener('click', () => {
    userPrefs.autoAdapt = !userPrefs.autoAdapt;
    if (!userPrefs.autoAdapt) adaptiveQualityReduction = 0;
    saveUserPrefs();
    applyGraphicsQuality(false);
    sfx('ui');
  });
}
for (const button of document.querySelectorAll('[data-fps-toggle]')) {
  button.addEventListener('click', () => {
    userPrefs.showFps = !userPrefs.showFps;
    saveUserPrefs();
    updateFpsToggleUI();
    updateGraphicsQualityUI();
    sfx('ui');
  });
}
for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () => {
    if (!hasOwn(GAME_MODES, button.dataset.mode)) return;
    userPrefs.mode = button.dataset.mode;
    saveUserPrefs();
    updateDeployDeckUI();
    sfx('ui');
  });
}
for (const button of document.querySelectorAll('[data-perk]')) {
  button.addEventListener('click', () => {
    if (!hasOwn(PERKS, button.dataset.perk)) return;
    userPrefs.perk = button.dataset.perk;
    saveUserPrefs();
    updateDeployDeckUI();
    sfx('ui');
  });
}
for (const button of document.querySelectorAll('[data-audio-toggle]')) {
  button.addEventListener('click', () => {
    setAudioMusic(!audioSettings.music);
    sfx('ui');
  });
}
for (const slider of document.querySelectorAll('[data-audio-volume]')) {
  slider.addEventListener('input', () => setAudioVolume(slider.value));
}

if (UI.slot0) UI.slot0.addEventListener('click', () => { if (typeof switchWeapon === 'function') switchWeapon(0); });
if (UI.slot1) UI.slot1.addEventListener('click', () => { if (typeof switchWeapon === 'function') switchWeapon(1); });
if (UI.gadgetSlot) UI.gadgetSlot.addEventListener('click', () => { if (typeof tryUseGadget === 'function') tryUseGadget(); });

/* ---------------------------------------------------------
   Dual-Stick Touch Controls
   --------------------------------------------------------- */
const touchState = {
  moveX: 0,
  moveY: 0,
  movePointer: null,
  aimX: 0,
  aimY: 0,
  aimActive: false,
  aimManual: false,
  aimPointer: null,
  firing: false,
};

function bindTouchControls() {
  const stick = document.getElementById('moveStick');
  const knob = document.getElementById('moveStickKnob');
  const aimStick = document.getElementById('aimStick');
  const aimKnob = document.getElementById('aimStickKnob');
  const dash = document.getElementById('dashTouch');
  const reload = document.getElementById('reloadTouch');
  const gadget = document.getElementById('gadgetTouch');
  const swap = document.getElementById('swapTouch');
  const interact = document.getElementById('interactTouch');
  const pause = document.getElementById('pauseTouch');
  if (!stick || !knob) return;

  const updateMoveStick = (e) => {
    if (touchState.movePointer !== e.pointerId) return;
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = rect.width * 0.34;
    const length = Math.hypot(dx, dy);
    if (length > max) { dx = dx / length * max; dy = dy / length * max; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    touchState.moveX = dx / max;
    touchState.moveY = dy / max;
  };
  const releaseMoveStick = (e) => {
    if (touchState.movePointer !== e.pointerId) return;
    touchState.movePointer = null;
    touchState.moveX = 0;
    touchState.moveY = 0;
    knob.classList.remove('dragging');
    knob.style.transform = 'translate(-50%, -50%)';
  };
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    touchState.movePointer = e.pointerId;
    knob.classList.add('dragging');
    stick.setPointerCapture(e.pointerId);
    updateMoveStick(e);
  });
  stick.addEventListener('pointermove', updateMoveStick);
  stick.addEventListener('pointerup', releaseMoveStick);
  stick.addEventListener('pointercancel', releaseMoveStick);

  if (aimStick && aimKnob) {
    const updateAimStick = (e) => {
      if (touchState.aimPointer !== e.pointerId) return;
      const rect = aimStick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const max = rect.width * 0.35;
      const length = Math.hypot(dx, dy);
      if (length > max) { dx = dx / length * max; dy = dy / length * max; }
      aimKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      touchState.aimX = dx / max;
      touchState.aimY = dy / max;
      touchState.aimManual = length > max * 0.24;
      touchState.firing = true;
      mouse.down = true;
    };
    const releaseAimStick = (e) => {
      if (touchState.aimPointer !== e.pointerId) return;
      touchState.aimPointer = null;
      touchState.aimActive = false;
      touchState.aimManual = false;
      touchState.aimX = 0;
      touchState.aimY = 0;
      touchState.firing = false;
      mouse.down = false;
      aimKnob.classList.remove('dragging');
      aimKnob.style.transform = 'translate(-50%, -50%)';
    };
    aimStick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      touchState.aimPointer = e.pointerId;
      touchState.aimActive = true;
      aimKnob.classList.add('dragging');
      aimStick.setPointerCapture(e.pointerId);
      updateAimStick(e);
    });
    aimStick.addEventListener('pointermove', updateAimStick);
    aimStick.addEventListener('pointerup', releaseAimStick);
    aimStick.addEventListener('pointercancel', releaseAimStick);
  }

  if (dash) dash.addEventListener('pointerdown', (e) => { e.preventDefault(); if (typeof tryDash === 'function') tryDash(); });
  if (reload) reload.addEventListener('pointerdown', (e) => { e.preventDefault(); if (typeof startReload === 'function' && player) startReload(player); });
  if (gadget) gadget.addEventListener('pointerdown', (e) => { e.preventDefault(); if (typeof tryUseGadget === 'function') tryUseGadget(); });
  if (swap) swap.addEventListener('pointerdown', (e) => { e.preventDefault(); if (typeof switchWeapon === 'function' && player) switchWeapon(player.activeSlot === 0 ? 1 : 0); });
  if (interact) interact.addEventListener('pointerdown', (e) => { e.preventDefault(); if (typeof interactPickup === 'function') interactPickup(); });
  if (pause) pause.addEventListener('pointerdown', (e) => { e.preventDefault(); if (typeof togglePause === 'function') togglePause(); });
  const safeTouch = document.getElementById('safeTouch');
  if (safeTouch) {
    safeTouch.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!isPracticeMode() || !player || !player.alive) return;
      if (player.inSafeZone && typeof teleportToCombat === 'function') teleportToCombat();
      else if (!player.inSafeZone && typeof returnToSafeZone === 'function') returnToSafeZone();
    });
  }
}

bindTouchControls();
updateDeployDeckUI();
updateFpsToggleUI();
updateGraphicsQualityUI();
updateAudioSettingsUI();

/* ---------------------------------------------------------
   World generation (static cover, destructible crates,
   explosive fuel barrels, kinetic boost pads, loot)
   --------------------------------------------------------- */
function rectsOverlap(a, b, pad = 0) {
  return a.x < b.x + b.w + pad && a.x + a.w > b.x - pad &&
         a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;
}

function generateObstacles() {
  const list = [];
  const practice = isPracticeMode();
  const add = (x, y, w, h, type) => {
    if (x < 96 || y < 96 || x + w > WORLD - 96 || y + h > WORLD - 96) return false;
    // Keep the exact center drop ring slightly open for dynamic fights.
    if (Math.hypot(x + w / 2 - WORLD / 2, y + h / 2 - WORLD / 2) < 105) return false;
    const rect = {
      x, y, w, h, type, seed: Math.random() * 100,
      destructible: type === 'crate',
      hp: type === 'crate' ? 68 : 9999,
      maxHp: type === 'crate' ? 68 : 9999,
      hitFlash: 0,
      destroyed: false,
      _q: 0,
    };
    if (practice && rectsOverlap(rect, SAFE_ZONE, 120)) return false;
    if (list.some((o) => rectsOverlap(rect, o, 36))) return false;
    list.push(rect);
    return true;
  };

  // Curated tactical cover rings around each district landmark.
  for (const d of DISTRICTS) {
    const count = d.style === 'core' ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + rand(-0.35, 0.35);
      const dist = d.style === 'core' ? 265 : rand(165, 255);
      const isHoriz = Math.random() < 0.5;
      const w = isHoriz ? rand(96, 152) : rand(56, 78);
      const h = isHoriz ? rand(56, 78) : rand(96, 152);
      const type = d.style === 'docks' ? 'container'
        : d.style === 'foundry' ? pick(['container', 'crate'])
        : pick(['container', 'rock', 'crate']);
      add(d.x + Math.cos(a) * dist - w / 2, d.y + Math.sin(a) * dist - h / 2, w, h, type);
    }
  }

  // Compound clusters across the expanded 4400x4400 arena.
  for (let c = 0; c < 20; c++) {
    const cx = rand(340, WORLD - 340);
    const cy = rand(340, WORLD - 340);
    const n = randInt(2, 4);
    for (let i = 0; i < n; i++) {
      const type = pick(['crate', 'crate', 'rock', 'container']);
      const w = type === 'crate' ? rand(56, 86) : rand(72, 150);
      const h = type === 'crate' ? rand(56, 86) : rand(64, 138);
      add(cx + rand(-165, 165) - w / 2, cy + rand(-165, 165) - h / 2, w, h, type);
    }
  }

  // Scattered tactical cover & destructible supply crates.
  for (let i = 0; i < 74; i++) {
    const type = pick(['crate', 'crate', 'rock', 'rock', 'container']);
    const w = type === 'crate' ? rand(52, 80) : rand(56, 132);
    const h = type === 'crate' ? rand(52, 80) : rand(56, 128);
    add(rand(130, WORLD - 130 - w), rand(130, WORLD - 130 - h), w, h, type);
  }
  return list;
}

function generateBarrels() {
  const list = [];
  for (let i = 0; i < 42; i++) {
    for (let tries = 0; tries < 50; tries++) {
      const anchor = i < DISTRICTS.length * 2
        ? DISTRICTS[i % DISTRICTS.length]
        : null;
      const x = anchor
        ? clamp(anchor.x + rand(-300, 300), 140, WORLD - 140)
        : rand(160, WORLD - 160);
      const y = anchor
        ? clamp(anchor.y + rand(-300, 300), 140, WORLD - 140)
        : rand(160, WORLD - 160);
      if (inSafeZoneRect(x, y, 120)) continue;
      if (pointInObstacle(x, y, 28)) continue;
      if (list.some((b) => distance(x, y, b.x, b.y) < 110)) continue;
      list.push({
        x, y, r: 16, hp: 36, maxHp: 36,
        alive: true, hitFlash: 0, burnT: 0, seed: rand(0, TAU),
      });
      break;
    }
  }
  return list;
}

function generateBoostPads() {
  const candidates = [
    { x: 1280, y: WORLD * 0.34, angle: -Math.PI / 2 },
    { x: 1280, y: WORLD * 0.56, angle: Math.PI / 2 },
    { x: WORLD * 0.38, y: 3015, angle: 0 },
    { x: WORLD * 0.64, y: 3015, angle: Math.PI },
    { x: 3440, y: WORLD * 0.34, angle: Math.PI / 2 },
    { x: 3440, y: WORLD * 0.56, angle: -Math.PI / 2 },
    { x: WORLD * 0.38, y: WORLD * 0.28, angle: Math.PI * 0.2 },
    { x: WORLD * 0.66, y: WORLD * 0.28, angle: Math.PI * 0.8 },
    { x: WORLD * 0.36, y: WORLD * 0.78, angle: -Math.PI * 0.25 },
    { x: WORLD * 0.68, y: WORLD * 0.78, angle: -Math.PI * 0.75 },
  ];
  const list = [];
  for (const c of candidates) {
    let x = c.x;
    let y = c.y;
    for (let tries = 0; tries < 25; tries++) {
      if (!inSafeZoneRect(x, y, 110) && !pointInObstacle(x, y, 42)) {
        list.push({ x, y, r: 28, angle: c.angle, pulse: rand(0, TAU) });
        break;
      }
      x = clamp(c.x + rand(-110, 110), 160, WORLD - 160);
      y = clamp(c.y + rand(-110, 110), 160, WORLD - 160);
    }
  }
  return list;
}

function generateDecor() {
  const list = [];
  for (let i = 0; i < 145; i++) {
    list.push({
      type: pick(['grass', 'grass', 'dirt', 'dirt', 'crater']),
      x: rand(0, WORLD),
      y: rand(0, WORLD),
      rx: rand(38, 128),
      ry: rand(26, 92),
      rot: rand(0, TAU),
      alpha: rand(0.04, 0.1),
    });
  }
  for (let i = 0; i < 90; i++) {
    list.push({
      type: 'mote',
      x: rand(0, WORLD),
      y: rand(0, WORLD),
      size: rand(1.1, 2.7),
      phase: rand(0, TAU),
      alpha: rand(0.06, 0.16),
      vx: rand(-8, 8),
      vy: rand(-14, -4),
    });
  }
  return list;
}

const FLOOR_WEAPON_POOL = [
  'smg', 'smg', 'smg', 'smg', 'smg', 'smg',
  'shotgun', 'shotgun', 'shotgun', 'shotgun', 'shotgun',
  'revolver', 'revolver', 'revolver', 'revolver', 'revolver',
  'rifle', 'rifle', 'rifle', 'rifle', 'rifle', 'rifle', 'rifle',
  'pulse', 'pulse', 'pulse', 'pulse', 'pulse', 'pulse',
  'dmr', 'dmr', 'dmr', 'dmr', 'dmr', 'dmr',
  'lmg', 'lmg', 'lmg', 'lmg', 'lmg', 'lmg',
  'sniper', 'sniper', 'sniper', 'sniper', 'sniper',
  'railgun', 'minigun', 'bazooka', 'bazooka',
];

function generatePickups() {
  const defs = [];
  // Scaled for expanded 4400x4400 map & 30-operator Royale / continuous Practice combat
  const weaponCount = isPracticeMode() ? 66 : 74;
  for (let i = 0; i < weaponCount; i++) {
    defs.push({ kind: 'weapon', weapon: pick(FLOOR_WEAPON_POOL), skin: randomSkin(0.3) });
  }
  for (let i = 0; i < 20; i++) defs.push({ kind: 'health' });
  for (let i = 0; i < 16; i++) defs.push({ kind: 'armor' });
  for (let i = 0; i < 16; i++) {
    defs.push({ kind: 'gadget', gadget: pick(['frag', 'frag', 'emp', 'smoke']) });
  }

  const list = [];
  for (const def of defs) {
    for (let tries = 0; tries < 90; tries++) {
      const x = rand(140, WORLD - 140);
      const y = rand(140, WORLD - 140);
      if (inSafeZoneRect(x, y, 120)) continue;
      if (pointInObstacle(x, y, 36)) continue;
      if (list.some((p) => distance(x, y, p.x, p.y) < 58)) continue;
      list.push({ ...def, x, y, phase: rand(0, TAU), dropLock: 0 });
      break;
    }
  }

  // Curated guaranteed Tier 5 apex spawns (Bazooka, Minigun & Railgun at distinct districts).
  const heavySpots = DISTRICTS.slice().sort(() => Math.random() - 0.5);
  const heavyWeapons = ['bazooka', 'minigun', 'railgun'];
  for (let h = 0; h < heavyWeapons.length; h++) {
    const spot = heavySpots[h % heavySpots.length];
    for (let tries = 0; tries < 60; tries++) {
      const x = clamp(spot.x + rand(-220, 220), 150, WORLD - 150);
      const y = clamp(spot.y + rand(-220, 220), 150, WORLD - 150);
      if (inSafeZoneRect(x, y, 120)) continue;
      if (pointInObstacle(x, y, 38)) continue;
      if (player && !player.inSafeZone && distance(x, y, player.x, player.y) < 280) continue;
      if (list.some((p) => distance(x, y, p.x, p.y) < 68)) continue;
      list.push({
        kind: 'weapon', weapon: heavyWeapons[h], skin: randomSkin(0.95),
        x, y, phase: rand(0, TAU), dropLock: 0,
      });
      break;
    }
  }
  return list;
}

function generateSafeZoneLayout() {
  safeZoneStations = [];
  safeZoneDummies = [];
  if (!isPracticeMode()) return;

  const keysList = Object.keys(WEAPONS);
  for (let i = 0; i < keysList.length; i++) {
    const col = i % 6;
    const row = Math.floor(i / 6);
    safeZoneStations.push({
      kind: 'weapon',
      weapon: keysList[i],
      x: SAFE_ZONE.x + 95 + col * 116,
      y: SAFE_ZONE.y + 112 + row * 112,
      r: 22,
    });
  }
  const gadgetIds = ['frag', 'emp', 'smoke'];
  for (let i = 0; i < gadgetIds.length; i++) {
    safeZoneStations.push({
      kind: 'gadget',
      gadget: gadgetIds[i],
      x: SAFE_ZONE.x + 95 + i * 104,
      y: SAFE_ZONE.y + 392,
      r: 21,
    });
  }
  safeZoneStations.push({
    kind: 'skin',
    x: SAFE_ZONE.x + 440,
    y: SAFE_ZONE.y + 392,
    r: 24,
  });

  // Two live firing-range dummies (Unarmored & Armored) to test weapons inside Safe Zone.
  safeZoneDummies.push(
    {
      id: -101, name: 'DUMMY 100HP', x: SAFE_ZONE.x + 860, y: SAFE_ZONE.y + 165,
      r: 20, hp: 100, maxHp: 100, hpTrail: 100, armor: 0, maxArmor: 0,
      hitFlash: 0, respawnT: 0, alive: true, flinchX: 0, flinchY: 0, isDummy: true,
    },
    {
      id: -102, name: 'ARMORED 175', x: SAFE_ZONE.x + 860, y: SAFE_ZONE.y + 330,
      r: 20, hp: 100, maxHp: 100, hpTrail: 100, armor: 75, maxArmor: 75,
      hitFlash: 0, respawnT: 0, alive: true, flinchX: 0, flinchY: 0, isDummy: true,
    }
  );
}

function spawnPosition(pad = 150) {
  for (let i = 0; i < 100; i++) {
    const x = rand(pad, WORLD - pad);
    const y = rand(pad, WORLD - pad);
    if (inSafeZoneRect(x, y, 160)) continue;
    if (!pointInObstacle(x, y, 34)) return { x, y };
  }
  return { x: WORLD * 0.52, y: WORLD * 0.50 };
}

function planNextZone(z) {
  const p = ZONE_PHASES[z.phase];
  if (!p || p.r <= 0) {
    z.nextX = z.x;
    z.nextY = z.y;
    z.nextR = 0;
    return;
  }
  const maxOff = Math.max(0, z.r - p.r * 1.05);
  const a = rand(0, TAU);
  const off = rand(0, maxOff);
  z.nextX = clamp(z.x + Math.cos(a) * off, p.r + 50, WORLD - p.r - 50);
  z.nextY = clamp(z.y + Math.sin(a) * off, p.r + 50, WORLD - p.r - 50);
  z.nextR = p.r;
}

function createZone() {
  if (getGameMode().noStorm) return null;
  const speedMul = getGameMode().stormSpeed || 1;
  const startR = 3350;
  const z = {
    x: WORLD / 2, y: WORLD / 2, r: startR,
    sx: WORLD / 2, sy: WORLD / 2, sr: startR,
    tx: WORLD / 2, ty: WORLD / 2, tr: startR,
    nextX: WORLD / 2, nextY: WORLD / 2, nextR: 0,
    phase: 0,
    state: 'waiting',
    timer: ZONE_PHASES[0].wait / speedMul,
    shrinkTotal: ZONE_PHASES[0].shrink / speedMul,
    dps: ZONE_PHASES[0].dps,
  };
  planNextZone(z);
  return z;
}

function setupBackdrop() {
  player = null;
  bots = [];
  safeZoneStations = [];
  safeZoneDummies = [];
  obstacles = generateObstacles();
  rebuildObstacleGrid();
  barrels = generateBarrels();
  boostPads = generateBoostPads();
  decor = generateDecor();
  pickups = [];
  bullets = [];
  projectiles = [];
  smokes = [];
  decals = [];
  beams = [];
  if (typeof clearParticles === 'function') clearParticles();
  texts = [];
  pings = [];
  zone = createZone();
  cam.x = WORLD / 2;
  cam.y = WORLD / 2;
}
