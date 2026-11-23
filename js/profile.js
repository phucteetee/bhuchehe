'use strict';

/* =========================================================
   BATTLEGROUND — persistent profile, daily contracts, armory
   ========================================================= */

const PROFILE_KEY = 'battleground.profile.v1';
const PROFILE_VERSION = 1;

const RANKS = [
  { name: 'ROOKIE', min: 0, color: '#9fb1bb' },
  { name: 'BRONZE', min: 10000, color: '#d98c5f' },
  { name: 'SILVER', min: 30000, color: '#c7d4dd' },
  { name: 'GOLD', min: 75000, color: '#ffd166' },
  { name: 'PLATINUM', min: 150000, color: '#7bf5c1' },
  { name: 'DIAMOND', min: 300000, color: '#5ee7ff' },
  { name: 'LEGEND', min: 600000, color: '#b06cff' },
];

const OPERATOR_PRESETS = {
  cyan: {
    name: 'KAI', cost: 0, color: '#4b91a8', light: '#c9f9ff', auraColor: '#5ee7ff',
    skin: '#eac0a6', hair: '#15202b', eyes: '#75edff', hairStyle: 'spike', eyeStyle: 'focused', signature: 'comms', planet: 'MERCURY', planetType: 'rocky',
    desc: 'Mercury duelist · ion aura',
  },
  crimson: {
    name: 'AKARI', cost: 4000, color: '#c84943', light: '#ffc2c9', auraColor: '#ff5a6b',
    skin: '#f0c3aa', hair: '#57202b', eyes: '#ff8291', hairStyle: 'pony', eyeStyle: 'sharp', signature: 'ribbon', planet: 'MARS', planetType: 'rocky',
    desc: 'Mars blade runner · crimson aura',
  },
  emerald: {
    name: 'MIDORI', cost: 8000, color: '#19c98a', light: '#c6ffe9', auraColor: '#58e6a7',
    skin: '#e9c2a8', hair: '#123d35', eyes: '#80ffd0', hairStyle: 'twin', eyeStyle: 'bright', signature: 'leaf', planet: 'EARTH', planetType: 'terrestrial',
    desc: 'Earth recon ace · jade aura',
  },
  aurum: {
    name: 'REI', cost: 15000, color: '#d9a64a', light: '#fff0b8', auraColor: '#ffd166',
    skin: '#f2c9a7', hair: '#69451d', eyes: '#ffe69a', hairStyle: 'swept', eyeStyle: 'calm', signature: 'suncrest', planet: 'VENUS', planetType: 'rocky',
    desc: 'Venus solar striker · gold aura',
  },
  violet: {
    name: 'YUME', cost: 18000, color: '#5867ba', light: '#e0d0ff', auraColor: '#b48bff',
    skin: '#eac3b5', hair: '#38234f', eyes: '#d2aaff', hairStyle: 'long', eyeStyle: 'dreamy', signature: 'crescent', planet: 'NEPTUNE', planetType: 'ice',
    desc: 'Neptune void scout · violet aura',
  },
  rose: {
    name: 'HANA', cost: 24000, color: '#bd6b68', light: '#ffd5ef', auraColor: '#ff79c8',
    skin: '#f3c9b8', hair: '#64304e', eyes: '#ffa6d8', hairStyle: 'fringe', eyeStyle: 'spark', signature: 'flower', planet: 'JUPITER', planetType: 'gas',
    desc: 'Jupiter pulse medic · rose aura',
  },
  cobalt: {
    name: 'SORA', cost: 30000, color: '#398cbd', light: '#c9efff', auraColor: '#66cfff',
    skin: '#e7bfa8', hair: '#1b315e', eyes: '#9dc7ff', hairStyle: 'crown', eyeStyle: 'steady', signature: 'visor', planet: 'URANUS', planetType: 'ice',
    desc: 'Uranus sky hunter · cobalt aura',
  },
  onyx: {
    name: 'KURO', cost: 40000, color: '#737b8a', light: '#e8eef5', auraColor: '#d7bd85',
    skin: '#dcb7a4', hair: '#202631', eyes: '#dceaff', hairStyle: 'slick', eyeStyle: 'cold', signature: 'mask', planet: 'SATURN', planetType: 'ringed',
    desc: 'Saturn night sentinel · pale gold aura',
  },
};

const TRAIL_PRESETS = {
  none: { name: 'NONE', cost: 0, color: '#9fb1bb', light: '#e6eef2', desc: 'Clean boots' },
  cyan: { name: 'CYAN', cost: 1500, color: '#5ee7ff', light: '#b7f7ff', desc: 'Ion wake' },
  gold: { name: 'GOLD', cost: 3000, color: '#ffd166', light: '#ffe6a1', desc: 'Aura dust' },
  inferno: { name: 'INFERNO', cost: 6000, color: '#ff7a3d', light: '#ffd2a1', desc: 'Burning footsteps' },
  void: { name: 'VOID', cost: 12000, color: '#b06cff', light: '#dcc0ff', desc: 'Collapse wake' },
};

const CHALLENGE_POOL = [
  {
    id: 'kills', group: 'easy', metric: 'kills', goal: 5, reward: 250,
    name: 'Eliminate 5 operators',
  },
  {
    id: 'damage', group: 'easy', metric: 'damage', goal: 1500, reward: 300,
    name: 'Deal 1,500 damage',
  },
  {
    id: 'skins', group: 'easy', metric: 'skins', goal: 3, reward: 250,
    name: 'Loot 3 skinned weapons',
  },
  {
    id: 'sniperKills', group: 'weapon', metric: 'sniperKills', goal: 2, reward: 350,
    name: 'Get 2 Sniper/Railgun elims',
  },
  {
    id: 'shotgunKills', group: 'weapon', metric: 'shotgunKills', goal: 2, reward: 300,
    name: 'Get 2 shotgun eliminations',
  },
  {
    id: 'rifleKills', group: 'weapon', metric: 'rifleKills', goal: 3, reward: 350,
    name: 'Get 3 Rifle/Pulse/DMR elims',
  },
  {
    id: 'heavyKills', group: 'weapon', metric: 'heavyKills', goal: 2, reward: 350,
    name: 'Get 2 Heavy (LMG/Minigun/Bazooka) elims',
  },
  {
    id: 'top5', group: 'rank', metric: 'top5', goal: 1, reward: 300,
    name: 'Finish in the top 5',
  },
  {
    id: 'win', group: 'rank', metric: 'win', goal: 1, reward: 500,
    name: 'Win a match',
  },
  {
    id: 'longshot', group: 'rank', metric: 'longshot', goal: 1, reward: 400,
    name: 'Eliminate from 900m+',
  },
];

let profile = null;

const PROFILE_UI = {
  rankBadge: null,
  lifetimeAura: null,
  rankNext: null,
  rankFill: null,
  contractList: null,
  navPlayBtn: null,
  armoryBtn: null,
  careerBtn: null,
  settingsBtn: null,
  menuBankAura: null,
  menuMiniPortrait: null,
  menuHeaderOp: null,
  showcaseCard: null,
  menuShowcase: null,
  menuOpName: null,
  menuOpPlanet: null,
  menuOpDesc: null,
  menuTrailName: null,
  menuQuickArmoryBtn: null,
  menuQuickSettingsBtn: null,
  settings: null,
  settingsBackBtn: null,
  armory: null,
  armoryGrid: null,
  armoryAura: null,
  armoryBackBtn: null,
  career: null,
  careerRankBadge: null,
  careerLifetime: null,
  careerRankNext: null,
  careerRankFill: null,
  careerBank: null,
  careerStats: null,
  careerWeapons: null,
  careerBackBtn: null,
};

/* ---------------------------------------------------------
   Persistence
   --------------------------------------------------------- */
const FULL_ARMORY_AURA = 1000000;

function defaultProfile() {
  return {
    version: PROFILE_VERSION,
    auraEarned: FULL_ARMORY_AURA,
    auraBank: FULL_ARMORY_AURA,
    stats: {
      matches: 0, wins: 0, kills: 0, damage: 0,
      shotsFired: 0, shotsHit: 0,
      bestKills: 0, bestPlacement: 0, bestLongshot: 0,
    },
    weaponKills: {},
    challenges: { date: '', list: [] },
    unlocked: {
      operators: Object.keys(OPERATOR_PRESETS),
      trails: Object.keys(TRAIL_PRESETS),
    },
    equipped: { operator: 'cyan', trail: 'none' },
  };
}

function sanitizeProfile(raw) {
  const p = defaultProfile();
  if (!raw || typeof raw !== 'object') return p;

  p.auraBank = Math.max(FULL_ARMORY_AURA, Math.floor(Number(raw.auraBank) || 0));
  const earned = Number(raw.auraEarned);
  p.auraEarned = Number.isFinite(earned) && earned >= 0 ? Math.floor(earned) : p.auraBank;
  if (p.auraEarned < p.auraBank) p.auraEarned = p.auraBank;

  if (raw.stats && typeof raw.stats === 'object') {
    for (const key in p.stats) {
      const v = Number(raw.stats[key]);
      p.stats[key] = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    }
  }

  if (raw.weaponKills && typeof raw.weaponKills === 'object') {
    for (const key in raw.weaponKills) {
      if (!hasOwn(WEAPONS, key)) continue;
      const v = Number(raw.weaponKills[key]);
      if (Number.isFinite(v) && v > 0) p.weaponKills[key] = Math.floor(v);
    }
  }

  if (raw.unlocked && typeof raw.unlocked === 'object') {
    for (const id of (Array.isArray(raw.unlocked.operators) ? raw.unlocked.operators : [])) {
      if (hasOwn(OPERATOR_PRESETS, id) && !p.unlocked.operators.includes(id)) p.unlocked.operators.push(id);
    }
    for (const id of (Array.isArray(raw.unlocked.trails) ? raw.unlocked.trails : [])) {
      if (hasOwn(TRAIL_PRESETS, id) && !p.unlocked.trails.includes(id)) p.unlocked.trails.push(id);
    }
  }

  if (raw.equipped && typeof raw.equipped === 'object') {
    if (typeof raw.equipped.operator === 'string' && p.unlocked.operators.includes(raw.equipped.operator)) {
      p.equipped.operator = raw.equipped.operator;
    }
    if (typeof raw.equipped.trail === 'string' && p.unlocked.trails.includes(raw.equipped.trail)) {
      p.equipped.trail = raw.equipped.trail;
    }
  }

  if (raw.challenges && typeof raw.challenges === 'object' && Array.isArray(raw.challenges.list)) {
    p.challenges.date = typeof raw.challenges.date === 'string' ? raw.challenges.date.slice(0, 16) : '';
    p.challenges.list = raw.challenges.list
      .filter((c) => c && typeof c.id === 'string' && typeof c.metric === 'string')
      .slice(0, 3)
      .map((c) => {
        const goal = Math.max(1, Math.floor(Number(c.goal) || 1));
        const progress = Math.max(0, Math.min(goal, Math.floor(Number(c.progress) || 0)));
        return {
          id: c.id.slice(0, 32),
          group: typeof c.group === 'string' ? c.group.slice(0, 24) : '',
          metric: c.metric.slice(0, 32),
          goal,
          reward: Math.max(0, Math.floor(Number(c.reward) || 0)),
          name: String(c.name || c.metric).slice(0, 80),
          progress,
          done: !!c.done || progress >= goal,
        };
      });
  }

  return p;
}

function loadProfile() {
  let raw = null;
  try {
    const stored = window.localStorage.getItem(PROFILE_KEY);
    if (stored) raw = JSON.parse(stored);
  } catch (e) {
    raw = null;
  }
  return sanitizeProfile(raw);
}

function saveProfile() {
  if (!profile) return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    // Private mode or blocked storage: play continues with an in-memory profile.
  }
}

function ensureProfile() {
  if (!profile) profile = loadProfile();
  return profile;
}

/* ---------------------------------------------------------
   Ranks
   --------------------------------------------------------- */
function getRank(total) {
  const bank = Math.max(0, Math.floor(Number(total) || 0));
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (bank >= RANKS[i].min) index = i;
  }
  const rank = RANKS[index];
  const next = RANKS[index + 1] || null;
  const span = next ? next.min - rank.min : 1;
  const progress = next ? clamp((bank - rank.min) / span, 0, 1) : 1;
  return {
    name: rank.name,
    color: rank.color,
    min: rank.min,
    next,
    progress,
    toNext: next ? Math.max(0, next.min - bank) : 0,
  };
}

function noteRankUp(beforeName) {
  if (!profile) return null;
  const rank = getRank(profile.auraEarned);
  if (rank.name === beforeName) return null;
  if (typeof game !== 'undefined' && game) game.rankUpNotice = rank;
  return rank;
}

/* ---------------------------------------------------------
   Daily contracts
   --------------------------------------------------------- */
function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollDailyChallenges(dateKey) {
  const rng = mulberry32(hashString(dateKey));
  const list = [];
  for (const group of ['easy', 'weapon', 'rank']) {
    const options = CHALLENGE_POOL.filter((c) => c.group === group);
    const def = options[Math.floor(rng() * options.length)];
    list.push({
      id: def.id,
      group: def.group,
      metric: def.metric,
      goal: def.goal,
      reward: def.reward,
      name: def.name,
      progress: 0,
      done: false,
    });
  }
  return list;
}

function ensureDailyChallenges() {
  const p = ensureProfile();
  const today = todayKey();
  // Never re-roll while a match is active (including the result screen): doing
  // so at midnight would silently wipe the contracts the player just progressed.
  const inMatch = typeof game !== 'undefined' && game && game.state !== 'menu';
  if (!inMatch && (p.challenges.date !== today || p.challenges.list.length !== 3)) {
    p.challenges.date = today;
    p.challenges.list = rollDailyChallenges(today);
    saveProfile();
    renderProfileUI();
  }
  return p.challenges.list;
}

function track(metric, amount = 1) {
  if (!profile || !amount) return [];
  ensureDailyChallenges();
  const rankBefore = getRank(profile.auraEarned).name;
  const completed = [];
  for (const c of profile.challenges.list) {
    if (c.done || c.metric !== metric) continue;
    c.progress = Math.min(c.goal, c.progress + amount);
    if (c.progress >= c.goal) {
      c.done = true;
      profile.auraBank += c.reward;
      profile.auraEarned += c.reward;
      completed.push(c);
    }
  }
  if (!completed.length) return [];

  noteRankUp(rankBefore);
  saveProfile();
  for (const c of completed) {
    if (typeof showToast === 'function') {
      showToast('CONTRACT COMPLETE · +' + c.reward + ' AURA BANKED', 2200, 'gold');
    }
    if (typeof sfx === 'function') sfx('aura');
  }
  renderProfileUI();
  return completed;
}

/* ---------------------------------------------------------
   Match results
   --------------------------------------------------------- */
function addMatchWeaponKills(weaponKills) {
  if (!weaponKills || typeof weaponKills !== 'object') return;
  for (const key in weaponKills) {
    if (!hasOwn(WEAPONS, key)) continue;
    const n = Math.floor(Number(weaponKills[key]) || 0);
    if (n <= 0) continue;
    profile.weaponKills[key] = (profile.weaponKills[key] || 0) + n;
  }
}

function recordMatchResult(result) {
  const p = ensureProfile();
  ensureDailyChallenges();

  const prevBestKills = p.stats.bestKills;
  const prevBestPlacement = p.stats.bestPlacement;
  const prevBestLongshot = p.stats.bestLongshot;

  const kills = Math.max(0, Math.floor(Number(result.kills) || 0));
  const placement = Math.max(0, Math.floor(Number(result.placement) || 0));
  const damage = Math.max(0, Math.round(Number(result.damage) || 0));
  const longest = Math.max(0, Math.round(Number(result.longestKill) || 0));

  p.stats.matches++;
  p.stats.kills += kills;
  p.stats.damage += damage;
  p.stats.shotsFired += Math.max(0, Math.floor(Number(result.shotsFired) || 0));
  p.stats.shotsHit += Math.max(0, Math.floor(Number(result.shotsHit) || 0));
  if (result.win) p.stats.wins++;
  if (kills > p.stats.bestKills) p.stats.bestKills = kills;
  if (placement > 0 && (!p.stats.bestPlacement || placement < p.stats.bestPlacement)) {
    p.stats.bestPlacement = placement;
  }
  if (longest > p.stats.bestLongshot) p.stats.bestLongshot = longest;
  addMatchWeaponKills(result.weaponKills);

  const rankBefore = getRank(p.auraEarned).name;
  const matchAura = Math.max(0, Math.round(Number(result.aura) || 0));
  p.auraBank += matchAura;
  p.auraEarned += matchAura;

  const completedContracts = [];
  if (placement > 0 && placement <= 5) completedContracts.push(...track('top5', 1));
  if (result.win) completedContracts.push(...track('win', 1));
  const rankUp = noteRankUp(rankBefore);

  saveProfile();
  renderProfileUI();

  return {
    newBestKills: kills > prevBestKills,
    newBestPlacement: placement > 0 && (prevBestPlacement === 0 || placement < prevBestPlacement),
    newBestLongshot: longest > prevBestLongshot,
    completedContracts,
    rankUp,
  };
}

function getProfileBank() {
  return ensureProfile().auraBank;
}

function getProfileEarned() {
  return ensureProfile().auraEarned;
}

/* ---------------------------------------------------------
   Cosmetics
   --------------------------------------------------------- */
function getEquippedOperator() {
  const p = ensureProfile();
  return hasOwn(OPERATOR_PRESETS, p.equipped.operator) ? OPERATOR_PRESETS[p.equipped.operator] : OPERATOR_PRESETS.cyan;
}

function getEquippedOperatorId() {
  const p = ensureProfile();
  return hasOwn(OPERATOR_PRESETS, p.equipped.operator) ? p.equipped.operator : 'cyan';
}

function getEquippedTrail() {
  const p = ensureProfile();
  return hasOwn(TRAIL_PRESETS, p.equipped.trail) ? TRAIL_PRESETS[p.equipped.trail] : TRAIL_PRESETS.none;
}

function purchaseItem(kind, id) {
  const p = ensureProfile();
  const item = kind === 'operator'
    ? (hasOwn(OPERATOR_PRESETS, id) ? OPERATOR_PRESETS[id] : null)
    : kind === 'trail'
      ? (hasOwn(TRAIL_PRESETS, id) ? TRAIL_PRESETS[id] : null)
      : null;
  if (!item) return false;
  const list = kind === 'operator' ? p.unlocked.operators : p.unlocked.trails;
  if (list.includes(id)) {
    equipItem(kind, id);
    return true;
  }
  if (p.auraBank < item.cost) return false;

  p.auraBank -= item.cost;
  list.push(id);
  p.equipped[kind] = id;
  saveProfile();
  renderProfileUI();
  renderArmory();
  if (typeof sfx === 'function') sfx('pickup');
  if (typeof showToast === 'function') showToast(item.name + ' UNLOCKED', 1600, 'gold');
  return true;
}

function equipItem(kind, id) {
  const p = ensureProfile();
  const list = kind === 'operator' ? p.unlocked.operators : kind === 'trail' ? p.unlocked.trails : null;
  if (!list || !list.includes(id)) return false;
  p.equipped[kind] = id;
  saveProfile();
  renderProfileUI();
  renderArmory();
  if (typeof sfx === 'function') sfx('pickup');
  return true;
}

/* ---------------------------------------------------------
   UI
   --------------------------------------------------------- */
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function cacheProfileUI() {
  PROFILE_UI.rankBadge = document.getElementById('rankBadge');
  PROFILE_UI.lifetimeAura = document.getElementById('lifetimeAura');
  PROFILE_UI.rankNext = document.getElementById('rankNext');
  PROFILE_UI.rankFill = document.getElementById('rankFill');
  PROFILE_UI.contractList = document.getElementById('contractList');
  PROFILE_UI.navPlayBtn = document.getElementById('navPlayBtn');
  PROFILE_UI.armoryBtn = document.getElementById('armoryBtn');
  PROFILE_UI.careerBtn = document.getElementById('careerBtn');
  PROFILE_UI.settingsBtn = document.getElementById('settingsBtn');
  PROFILE_UI.menuBankAura = document.getElementById('menuBankAura');
  PROFILE_UI.menuMiniPortrait = document.getElementById('menuMiniPortrait');
  PROFILE_UI.menuHeaderOp = document.getElementById('menuHeaderOp');
  PROFILE_UI.showcaseCard = document.querySelector('.showcaseCard');
  PROFILE_UI.menuShowcase = document.getElementById('menuShowcase');
  PROFILE_UI.menuOpName = document.getElementById('menuOpName');
  PROFILE_UI.menuOpPlanet = document.getElementById('menuOpPlanet');
  PROFILE_UI.menuOpDesc = document.getElementById('menuOpDesc');
  PROFILE_UI.menuTrailName = document.getElementById('menuTrailName');
  PROFILE_UI.menuQuickArmoryBtn = document.getElementById('menuQuickArmoryBtn');
  PROFILE_UI.menuQuickSettingsBtn = document.getElementById('menuQuickSettingsBtn');
  PROFILE_UI.settings = document.getElementById('settings');
  PROFILE_UI.settingsBackBtn = document.getElementById('settingsBackBtn');
  PROFILE_UI.armory = document.getElementById('armory');
  PROFILE_UI.armoryGrid = document.getElementById('armoryGrid');
  PROFILE_UI.armoryAura = document.getElementById('armoryAura');
  PROFILE_UI.armoryBackBtn = document.getElementById('armoryBackBtn');
  PROFILE_UI.career = document.getElementById('career');
  PROFILE_UI.careerRankBadge = document.getElementById('careerRankBadge');
  PROFILE_UI.careerLifetime = document.getElementById('careerLifetime');
  PROFILE_UI.careerRankNext = document.getElementById('careerRankNext');
  PROFILE_UI.careerRankFill = document.getElementById('careerRankFill');
  PROFILE_UI.careerBank = document.getElementById('careerBank');
  PROFILE_UI.careerStats = document.getElementById('careerStats');
  PROFILE_UI.careerWeapons = document.getElementById('careerWeapons');
  PROFILE_UI.careerBackBtn = document.getElementById('careerBackBtn');
}

function renderProfileUI() {
  const p = ensureProfile();
  const ui = PROFILE_UI;
  if (!ui.rankBadge) return;

  const rank = getRank(p.auraEarned);
  const opId = getEquippedOperatorId();
  const operator = OPERATOR_PRESETS[opId] || OPERATOR_PRESETS.cyan;
  const trail = getEquippedTrail();

  if (UI.operatorName) {
    UI.operatorName.textContent = operator.name;
    UI.operatorName.style.color = operator.auraColor;
    UI.operatorName.style.textShadow = '0 0 12px ' + operator.auraColor + '88';
  }
  ui.rankBadge.textContent = rank.name;
  ui.rankBadge.style.color = rank.color;
  ui.rankBadge.style.borderColor = rank.color;
  ui.rankBadge.style.textShadow = '0 0 18px ' + rank.color + '66';
  if (ui.menuBankAura) ui.menuBankAura.textContent = p.auraBank.toLocaleString('en-US');
  if (ui.menuHeaderOp) {
    ui.menuHeaderOp.textContent = operator.name;
    ui.menuHeaderOp.style.color = operator.light;
  }
  if (ui.showcaseCard) ui.showcaseCard.style.setProperty('--op-aura', operator.auraColor);
  if (ui.menuOpName) {
    ui.menuOpName.textContent = operator.name;
    ui.menuOpName.style.color = operator.light;
    ui.menuOpName.style.textShadow = '0 0 18px ' + operator.auraColor + '66';
  }
  if (ui.menuOpPlanet) {
    ui.menuOpPlanet.textContent = operator.planet + ' · ' + operator.planetType.toUpperCase();
    ui.menuOpPlanet.style.color = operator.auraColor;
  }
  if (ui.menuOpDesc) ui.menuOpDesc.textContent = operator.desc;
  if (ui.menuTrailName) {
    ui.menuTrailName.textContent = trail.name;
    ui.menuTrailName.style.color = trail.color;
    ui.menuTrailName.style.borderColor = trail.color + '66';
  }
  if (ui.menuMiniPortrait && typeof drawOperatorPortrait === 'function') {
    drawOperatorPortrait(ui.menuMiniPortrait, opId);
  }
  if (ui.menuShowcase && typeof drawPlanetShowcase === 'function') {
    drawPlanetShowcase(ui.menuShowcase, opId);
  }
  if (ui.lifetimeAura) ui.lifetimeAura.textContent = p.auraEarned.toLocaleString('en-US');
  if (ui.rankNext) {
    ui.rankNext.textContent = rank.next
      ? rank.toNext.toLocaleString('en-US') + ' TO ' + rank.next.name
      : 'MAX RANK';
  }
  if (ui.rankFill) {
    ui.rankFill.style.width = Math.round(rank.progress * 100) + '%';
    ui.rankFill.style.background = rank.color;
  }

  if (ui.contractList) {
    const list = p.challenges.list;
    if (!list.length) {
      ui.contractList.innerHTML = '<div class="contractRow"><div class="contractMeta">CONTRACTS REFRESH AT MIDNIGHT</div></div>';
    } else {
      ui.contractList.innerHTML = list.map((c) => {
        const pct = Math.round(Math.min(1, c.progress / c.goal) * 100);
        const meta = c.done ? 'COMPLETE · +' + c.reward + ' AURA'
          : Math.floor(c.progress) + ' / ' + c.goal + ' · +' + c.reward + ' AURA';
        return '<div class="contractRow' + (c.done ? ' done' : '') + '">' +
          '<div class="contractTop"><span class="contractName">' + escapeHtml(c.name) + '</span>' +
          '<b class="contractReward">✦ ' + c.reward + '</b></div>' +
          '<div class="contractBar"><i style="width:' + pct + '%"></i></div>' +
          '<div class="contractMeta">' + meta + '</div></div>';
      }).join('');
    }
  }

  if (ui.armoryAura) ui.armoryAura.textContent = p.auraBank.toLocaleString('en-US');
}

function renderArmory() {
  const p = ensureProfile();
  const ui = PROFILE_UI;
  if (!ui.armoryGrid) return;

  if (ui.armoryAura) ui.armoryAura.textContent = p.auraBank.toLocaleString('en-US');

  const sections = [
    { kind: 'operator', title: 'OPERATORS', items: OPERATOR_PRESETS, list: p.unlocked.operators },
    { kind: 'trail', title: 'TRAILS', items: TRAIL_PRESETS, list: p.unlocked.trails },
  ];

  let html = '';
  for (const sec of sections) {
    html += '<div class="armorySection">' + sec.title + '</div>';
    for (const id in sec.items) {
      const item = sec.items[id];
      const owned = sec.list.includes(id);
      const equipped = p.equipped[sec.kind] === id;
      let action = 'buy';
      let label = '✦ ' + item.cost.toLocaleString('en-US');
      let cls = 'locked';
      let disabled = false;

      if (equipped) {
        action = 'none';
        label = 'EQUIPPED';
        cls = 'equipped';
        disabled = true;
      } else if (owned) {
        action = 'equip';
        label = 'EQUIP';
        cls = 'equip';
      } else if (p.auraBank < item.cost) {
        disabled = true;
      }

      const preview = sec.kind === 'operator'
        ? '<canvas class="armoryPortrait" width="96" height="96" data-operator-portrait="' + id + '" aria-hidden="true"></canvas>'
        : '<div class="armoryPreview" style="--c:' + item.color + ';--l:' + item.light + '"></div>';
      html += '<div class="armoryCard' + (equipped ? ' isEquipped' : '') + '">' +
        preview +
        '<div class="armoryName">' + item.name + '</div>' +
        '<div class="armoryType">' + (sec.kind === 'operator' ? (item.planet + ' · ' + item.planetType.toUpperCase()) : 'MOVEMENT TRAIL') + '</div>' +
        '<div class="armoryDesc">' + item.desc + '</div>' +
        '<button class="armoryBtn ' + cls + '" data-kind="' + sec.kind +
        '" data-id="' + id + '" data-action="' + action + '"' + (disabled ? ' disabled' : '') + '>' +
        label + '</button></div>';
    }
  }
  ui.armoryGrid.innerHTML = html;
  if (typeof drawOperatorPortrait === 'function') {
    for (const portrait of ui.armoryGrid.querySelectorAll('[data-operator-portrait]')) {
      drawOperatorPortrait(portrait, portrait.dataset.operatorPortrait);
    }
  }
}

function masteryLabel(kills) {
  if (kills >= 50) return 'MASTER';
  if (kills >= 25) return 'VETERAN';
  if (kills >= 10) return 'MARKSMAN';
  if (kills >= 1) return 'INITIATE';
  return '—';
}

function renderCareer() {
  const p = ensureProfile();
  const ui = PROFILE_UI;
  if (!ui.career) return;

  const rank = getRank(p.auraEarned);
  if (ui.careerRankBadge) {
    ui.careerRankBadge.textContent = rank.name;
    ui.careerRankBadge.style.color = rank.color;
    ui.careerRankBadge.style.borderColor = rank.color;
    ui.careerRankBadge.style.textShadow = '0 0 18px ' + rank.color + '66';
  }
  if (ui.careerLifetime) ui.careerLifetime.textContent = p.auraEarned.toLocaleString('en-US');
  if (ui.careerBank) ui.careerBank.textContent = p.auraBank.toLocaleString('en-US');
  if (ui.careerRankNext) {
    ui.careerRankNext.textContent = rank.next
      ? rank.toNext.toLocaleString('en-US') + ' TO ' + rank.next.name
      : 'MAX RANK';
  }
  if (ui.careerRankFill) {
    ui.careerRankFill.style.width = Math.round(rank.progress * 100) + '%';
    ui.careerRankFill.style.background = rank.color;
  }

  const s = p.stats;
  const accuracy = s.shotsFired > 0
    ? Math.min(100, Math.round((s.shotsHit / s.shotsFired) * 100))
    : null;
  const winRate = s.matches > 0 ? Math.round((s.wins / s.matches) * 100) : null;
  const perMatch = s.matches > 0 ? (s.kills / s.matches).toFixed(1) : null;
  const stats = [
    ['MATCHES', s.matches.toLocaleString('en-US')],
    ['WINS', s.wins.toLocaleString('en-US')],
    ['WIN RATE', winRate === null ? '—' : winRate + '%'],
    ['ELIMINATIONS', s.kills.toLocaleString('en-US')],
    ['KILLS / MATCH', perMatch === null ? '—' : perMatch],
    ['DAMAGE DEALT', s.damage.toLocaleString('en-US')],
    ['ACCURACY', accuracy === null ? '—' : accuracy + '%'],
    ['BEST PLACEMENT', s.bestPlacement > 0 ? '#' + s.bestPlacement : '—'],
    ['BEST ELIMS', s.bestKills.toLocaleString('en-US')],
    ['LONGEST SHOT', s.bestLongshot > 0 ? s.bestLongshot.toLocaleString('en-US') + 'm' : '—'],
  ];
  if (ui.careerStats) {
    ui.careerStats.innerHTML = stats.map(([label, value]) =>
      '<div class="careerStat"><span>' + label + '</span><b>' + value + '</b></div>'
    ).join('');
  }

  if (ui.careerWeapons) {
    let html = '';
    for (const key in WEAPONS) {
      const weapon = WEAPONS[key];
      const kills = Math.max(0, Math.floor(Number(p.weaponKills[key]) || 0));
      const pct = Math.round(Math.min(1, kills / 50) * 100);
      const color = weapon.color || '#5ee7ff';
      html += '<div class="masteryRow' + (kills >= 50 ? ' maxed' : '') + '">' +
        '<div class="masteryTop">' +
        '<span class="masteryName" style="color:' + color + '">' + weapon.name + '</span>' +
        '<span class="masteryLevel">' + masteryLabel(kills) + '</span>' +
        '<span class="masteryKills">' + kills.toLocaleString('en-US') + '</span></div>' +
        '<div class="masteryBar"><i style="width:' + pct + '%;--wc:' + color + '"></i></div></div>';
    }
    ui.careerWeapons.innerHTML = html;
  }
}

function setActiveLobbyTab(tab) {
  const ui = PROFILE_UI;
  if (ui.navPlayBtn) ui.navPlayBtn.classList.toggle('active', tab === 'play');
  if (ui.armoryBtn) ui.armoryBtn.classList.toggle('active', tab === 'armory');
  if (ui.careerBtn) ui.careerBtn.classList.toggle('active', tab === 'career');
  if (ui.settingsBtn) ui.settingsBtn.classList.toggle('active', tab === 'settings');
}

function isArmoryOpen() {
  return !!(PROFILE_UI.armory && !PROFILE_UI.armory.classList.contains('hidden'));
}

function isCareerOpen() {
  return !!(PROFILE_UI.career && !PROFILE_UI.career.classList.contains('hidden'));
}

function isSettingsOpen() {
  return !!(PROFILE_UI.settings && !PROFILE_UI.settings.classList.contains('hidden'));
}

function closeAllLobbyOverlays() {
  if (PROFILE_UI.armory) PROFILE_UI.armory.classList.add('hidden');
  if (PROFILE_UI.career) PROFILE_UI.career.classList.add('hidden');
  if (PROFILE_UI.settings) PROFILE_UI.settings.classList.add('hidden');
  setActiveLobbyTab('play');
  renderProfileUI();
}

function openArmory() {
  if (game.state !== 'menu') return;
  if (PROFILE_UI.career) PROFILE_UI.career.classList.add('hidden');
  if (PROFILE_UI.settings) PROFILE_UI.settings.classList.add('hidden');
  ensureDailyChallenges();
  renderArmory();
  if (PROFILE_UI.armory) PROFILE_UI.armory.classList.remove('hidden');
  setActiveLobbyTab('armory');
  if (typeof sfx === 'function') sfx('ui');
}

function closeArmory() {
  if (PROFILE_UI.armory) PROFILE_UI.armory.classList.add('hidden');
  setActiveLobbyTab('play');
  renderProfileUI();
}

function openCareer() {
  if (game.state !== 'menu') return;
  if (PROFILE_UI.armory) PROFILE_UI.armory.classList.add('hidden');
  if (PROFILE_UI.settings) PROFILE_UI.settings.classList.add('hidden');
  ensureDailyChallenges();
  renderCareer();
  if (PROFILE_UI.career) PROFILE_UI.career.classList.remove('hidden');
  setActiveLobbyTab('career');
  if (typeof sfx === 'function') sfx('ui');
}

function closeCareer() {
  if (PROFILE_UI.career) PROFILE_UI.career.classList.add('hidden');
  setActiveLobbyTab('play');
  renderProfileUI();
}

function openSettings() {
  if (game.state !== 'menu') return;
  if (PROFILE_UI.armory) PROFILE_UI.armory.classList.add('hidden');
  if (PROFILE_UI.career) PROFILE_UI.career.classList.add('hidden');
  if (typeof updateGraphicsQualityUI === 'function') updateGraphicsQualityUI();
  if (typeof updateAudioSettingsUI === 'function') updateAudioSettingsUI();
  if (typeof updateFpsToggleUI === 'function') updateFpsToggleUI();
  if (PROFILE_UI.settings) PROFILE_UI.settings.classList.remove('hidden');
  setActiveLobbyTab('settings');
  if (typeof sfx === 'function') sfx('ui');
}

function closeSettings() {
  if (PROFILE_UI.settings) PROFILE_UI.settings.classList.add('hidden');
  setActiveLobbyTab('play');
  renderProfileUI();
}

function wireProfileUI() {
  if (PROFILE_UI.navPlayBtn) PROFILE_UI.navPlayBtn.addEventListener('click', closeAllLobbyOverlays);
  if (PROFILE_UI.armoryBtn) PROFILE_UI.armoryBtn.addEventListener('click', openArmory);
  if (PROFILE_UI.careerBtn) PROFILE_UI.careerBtn.addEventListener('click', openCareer);
  if (PROFILE_UI.settingsBtn) PROFILE_UI.settingsBtn.addEventListener('click', openSettings);
  if (PROFILE_UI.menuQuickArmoryBtn) PROFILE_UI.menuQuickArmoryBtn.addEventListener('click', openArmory);
  if (PROFILE_UI.menuQuickSettingsBtn) PROFILE_UI.menuQuickSettingsBtn.addEventListener('click', openSettings);
  if (PROFILE_UI.armoryBackBtn) PROFILE_UI.armoryBackBtn.addEventListener('click', closeArmory);
  if (PROFILE_UI.careerBackBtn) PROFILE_UI.careerBackBtn.addEventListener('click', closeCareer);
  if (PROFILE_UI.settingsBackBtn) PROFILE_UI.settingsBackBtn.addEventListener('click', closeSettings);

  // Clicking outside the modal panel closes the overlay cleanly.
  if (PROFILE_UI.armory) {
    PROFILE_UI.armory.addEventListener('click', (e) => {
      if (e.target === PROFILE_UI.armory) closeArmory();
    });
  }
  if (PROFILE_UI.career) {
    PROFILE_UI.career.addEventListener('click', (e) => {
      if (e.target === PROFILE_UI.career) closeCareer();
    });
  }
  if (PROFILE_UI.settings) {
    PROFILE_UI.settings.addEventListener('click', (e) => {
      if (e.target === PROFILE_UI.settings) closeSettings();
    });
  }

  if (PROFILE_UI.armoryGrid) {
    PROFILE_UI.armoryGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.armoryBtn');
      if (!btn || btn.disabled) return;
      const kind = btn.dataset.kind;
      const id = btn.dataset.id;
      if (btn.dataset.action === 'buy') purchaseItem(kind, id);
      else if (btn.dataset.action === 'equip') equipItem(kind, id);
    });
  }
}

let dailyTimer = null;

function initProfile() {
  profile = loadProfile();
  saveProfile();
  cacheProfileUI();
  wireProfileUI();
  ensureDailyChallenges();
  renderProfileUI();
  if (!dailyTimer) dailyTimer = setInterval(ensureDailyChallenges, 60000);
}
