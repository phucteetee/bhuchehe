'use strict';

/* =========================================================
   BATTLEGROUND — layered world rendering, 2.5D cover,
   dynamic lighting halos, expressive operators, HUD, minimap
   ========================================================= */

let toastTimer = null;
let groundLayer = null;
let groundLayerScale = 0.55;
let groundLayerSource = null;
let groundLayerObstacles = null;

function invalidateRenderCaches() {
  groundLayer = null;
  groundLayerSource = null;
  groundLayerObstacles = null;
  minimapStatic = null;
  minimapStaticObstacles = null;
  minimapStaticSize = '';
  minimapLastDraw = -1;
}

function rr(c, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

const _viewBounds = { l: 0, r: 0, t: 0, b: 0 };

function viewBounds(pad = 120) {
  const vw = W / cam.zoom;
  const vh = H / cam.zoom;
  _viewBounds.l = cam.x - vw / 2 - pad;
  _viewBounds.r = cam.x + vw / 2 + pad;
  _viewBounds.t = cam.y - vh / 2 - pad;
  _viewBounds.b = cam.y + vh / 2 + pad;
  return _viewBounds;
}

/* ---------------------------------------------------------
   Cached additive light sprite (zero per-frame gradient allocs)
   --------------------------------------------------------- */
const lightSpriteCache = Object.create(null);

function getLightSprite(color) {
  if (lightSpriteCache[color]) return lightSpriteCache[color];
  const s = 96;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(0.38, color + '55');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  lightSpriteCache[color] = c;
  return c;
}

/* ---------------------------------------------------------
   Procedural subtle ground texture tile (baked once into ground)
   --------------------------------------------------------- */
function createGroundPattern(targetCtx) {
  const tile = document.createElement('canvas');
  tile.width = 128;
  tile.height = 128;
  const t = tile.getContext('2d');
  t.fillStyle = 'rgba(0,0,0,0)';
  t.fillRect(0, 0, 128, 128);
  // Subtle micro-grit & tactical plating seams
  for (let i = 0; i < 240; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 43758.5453) % 1;
    const px = Math.abs(x) * 128;
    const py = Math.abs(y) * 128;
    t.fillStyle = i % 2 ? 'rgba(180,220,235,0.022)' : 'rgba(0,0,0,0.05)';
    t.fillRect(px, py, 2, 2);
  }
  t.strokeStyle = 'rgba(130,190,210,0.024)';
  t.lineWidth = 1;
  t.strokeRect(0.5, 0.5, 127, 127);
  return targetCtx.createPattern(tile, 'repeat');
}

/* ---------------------------------------------------------
   Baked Static World Layer (viewport-clipped blit per frame!)
   --------------------------------------------------------- */
function buildGroundLayer() {
  const scale = getGraphicsSettings().groundScale;
  const size = Math.max(256, Math.round(WORLD * scale));
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d', { alpha: false });
  g.scale(scale, scale);

  // Deep atmospheric arena base
  const grad = g.createRadialGradient(WORLD / 2, WORLD / 2, 180, WORLD / 2, WORLD / 2, WORLD * 0.74);
  grad.addColorStop(0, '#121c26');
  grad.addColorStop(0.55, '#0d151d');
  grad.addColorStop(1, '#070c12');
  g.fillStyle = grad;
  g.fillRect(0, 0, WORLD, WORLD);

  // Subtle surface grit pattern
  const pat = createGroundPattern(g);
  if (pat) {
    g.fillStyle = pat;
    g.fillRect(0, 0, WORLD, WORLD);
  }

  // Roadways with shoulders, asphalt tone, crosswalks & lane markings
  for (const r of ROADS) {
    g.fillStyle = 'rgba(15,24,33,0.78)';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = 'rgba(100,160,185,0.04)';
    g.fillRect(r.x + 12, r.y + 12, r.w - 24, r.h - 24);
    g.strokeStyle = 'rgba(121,205,225,0.12)';
    g.lineWidth = 2;
    g.strokeRect(r.x, r.y, r.w, r.h);
  }

  // Road intersection crosswalks (all vertical × horizontal road crossings)
  const vRoads = ROADS.filter((r) => r.h > r.w);
  const hRoads = ROADS.filter((r) => r.w >= r.h);
  g.fillStyle = 'rgba(195,228,240,0.09)';
  for (const vr of vRoads) {
    for (const hr of hRoads) {
      for (let s = 18; s < vr.w - 18; s += 22) {
        g.fillRect(vr.x + s, hr.y - 22, 12, 16);
        g.fillRect(vr.x + s, hr.y + hr.h + 6, 12, 16);
      }
      for (let s = 18; s < hr.h - 18; s += 22) {
        g.fillRect(vr.x - 22, hr.y + s, 16, 12);
        g.fillRect(vr.x + vr.w + 6, hr.y + s, 16, 12);
      }
    }
  }

  g.save();
  g.strokeStyle = 'rgba(165,220,235,0.13)';
  g.lineWidth = 2.5;
  g.setLineDash([32, 28]);
  g.beginPath();
  for (const vr of vRoads) {
    g.moveTo(vr.x + vr.w / 2, 0);
    g.lineTo(vr.x + vr.w / 2, WORLD);
  }
  for (const hr of hRoads) {
    g.moveTo(0, hr.y + hr.h / 2);
    g.lineTo(WORLD, hr.y + hr.h / 2);
  }
  g.stroke();
  g.restore();

  g.save();
  g.strokeStyle = 'rgba(94,231,255,0.15)';
  g.lineWidth = 2;
  g.beginPath();
  for (const vr of vRoads) {
    g.moveTo(vr.x + 12, 0); g.lineTo(vr.x + 12, WORLD);
    g.moveTo(vr.x + vr.w - 12, 0); g.lineTo(vr.x + vr.w - 12, WORLD);
  }
  for (const hr of hRoads) {
    g.moveTo(0, hr.y + 12); g.lineTo(WORLD, hr.y + 12);
    g.moveTo(0, hr.y + hr.h - 12); g.lineTo(WORLD, hr.y + hr.h - 12);
  }
  g.stroke();
  g.restore();

  // Organic ground patches & craters
  for (const d of decor) {
    if (d.type === 'mote') continue;
    g.save();
    g.translate(d.x, d.y);
    g.rotate(d.rot);
    if (d.type === 'grass') {
      g.fillStyle = `rgba(62,135,98,${d.alpha * 1.1})`;
      g.beginPath();
      g.ellipse(0, 0, d.rx, d.ry, 0, 0, TAU);
      g.fill();
      g.fillStyle = `rgba(92,175,124,${d.alpha * 0.65})`;
      g.beginPath();
      g.ellipse(-d.rx * 0.2, -d.ry * 0.15, d.rx * 0.55, d.ry * 0.5, 0, 0, TAU);
      g.fill();
    } else if (d.type === 'dirt') {
      g.fillStyle = `rgba(140,112,72,${d.alpha})`;
      g.beginPath();
      g.ellipse(0, 0, d.rx, d.ry, 0, 0, TAU);
      g.fill();
    } else {
      g.fillStyle = 'rgba(2,6,10,0.36)';
      g.beginPath();
      g.ellipse(0, 0, d.rx * 0.7, d.ry * 0.65, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(0, 0, d.rx * 0.74, d.ry * 0.68, 0, 0, TAU);
      g.stroke();
    }
    g.restore();
  }

  // Survey strata etchings
  for (let iy2 = 0, y = 150; y < WORLD; iy2++, y += 320) {
    for (let ix2 = 0, x = 150; x < WORLD; ix2++, x += 320) {
      const road = ROADS.some((r) => x > r.x - 70 && x < r.x + r.w + 70 &&
        y > r.y - 70 && y < r.y + r.h + 70);
      if (road) continue;
      const seed = Math.sin(ix2 * 127.1 + iy2 * 311.7) * 43758.5453;
      const fraction = seed - Math.floor(seed);
      if (fraction < 0.34) continue;
      const cx = x + (fraction - 0.5) * 110;
      const cy = y + (Math.sin(ix2 * 43.7 + iy2 * 19.3) - 0.5) * 90;
      const rx = 24 + fraction * 27;
      const ry = rx * (0.54 + fraction * 0.2);

      g.save();
      g.translate(cx, cy);
      g.rotate(fraction * Math.PI);
      g.strokeStyle = 'rgba(0,0,0,0.14)';
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(2, 3, rx, ry, 0, 0, TAU);
      g.stroke();
      g.strokeStyle = 'rgba(125,175,195,0.08)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, 0, TAU);
      g.stroke();
      g.restore();
    }
  }

  // Tactical sector grid
  g.strokeStyle = 'rgba(140,195,215,0.048)';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x <= WORLD; x += 200) { g.moveTo(x, 0); g.lineTo(x, WORLD); }
  for (let y = 0; y <= WORLD; y += 200) { g.moveTo(0, y); g.lineTo(WORLD, y); }
  g.stroke();

  // Biome-specific district floor architecture
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const d of DISTRICTS) {
    const glow = g.createRadialGradient(d.x, d.y, 26, d.x, d.y, 330);
    glow.addColorStop(0, `rgba(${d.color},0.12)`);
    glow.addColorStop(0.55, `rgba(${d.color},0.036)`);
    glow.addColorStop(1, `rgba(${d.color},0)`);
    g.fillStyle = glow;
    g.beginPath();
    g.arc(d.x, d.y, 330, 0, TAU);
    g.fill();

    // Unique geometric floor treatment per biome
    g.save();
    g.translate(d.x, d.y);
    g.strokeStyle = `rgba(${d.color},0.14)`;
    g.lineWidth = 2;
    if (d.style === 'foundry') {
      // Industrial steel grate + hazard border
      g.strokeRect(-145, -110, 290, 220);
      g.strokeStyle = `rgba(${d.color},0.07)`;
      for (let gx = -125; gx <= 125; gx += 25) {
        g.beginPath(); g.moveTo(gx, -105); g.lineTo(gx, 105); g.stroke();
      }
    } else if (d.style === 'relay') {
      // Hexagonal comms pad
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        const px = Math.cos(a) * 155;
        const py = Math.sin(a) * 155;
        if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.stroke();
    } else if (d.style === 'docks') {
      // Cargo bay berths
      for (let bx = -130; bx <= 70; bx += 100) {
        g.strokeRect(bx, -95, 76, 190);
      }
    } else if (d.style === 'sector9') {
      // Octagonal containment pad
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + Math.PI / 8;
        const px = Math.cos(a) * 150;
        const py = Math.sin(a) * 150;
        if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.closePath();
      g.stroke();
    } else if (d.style === 'spire') {
      // Solar deck rings
      g.beginPath(); g.arc(0, 0, 162, 0, TAU); g.stroke();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        g.beginPath();
        g.moveTo(Math.cos(a) * 120, Math.sin(a) * 120);
        g.lineTo(Math.cos(a) * 162, Math.sin(a) * 162);
        g.stroke();
      }
    }
    g.restore();

    g.strokeStyle = `rgba(${d.color},0.13)`;
    g.lineWidth = 2;
    g.setLineDash([12, 18]);
    g.beginPath();
    g.arc(d.x, d.y, 138, 0, TAU);
    g.stroke();
    g.setLineDash([]);

    g.font = '800 22px "Segoe UI", system-ui, sans-serif';
    g.fillStyle = `rgba(${d.color},0.25)`;
    g.fillText(d.name, d.x, d.y - 6);
    g.font = '700 9.5px "Segoe UI", system-ui, sans-serif';
    g.fillStyle = `rgba(${d.color},0.15)`;
    g.fillText(d.sub, d.x, d.y + 15);
  }

  // Central octagonal landing platform
  g.save();
  g.translate(WORLD / 2, WORLD / 2);
  g.strokeStyle = 'rgba(94,231,255,0.12)';
  g.lineWidth = 2.5;
  g.beginPath(); g.arc(0, 0, 238, 0, TAU); g.stroke();
  g.beginPath(); g.arc(0, 0, 204, 0, TAU); g.stroke();
  for (let i = 0; i < 8; i++) {
    g.save();
    g.rotate(i * TAU / 8);
    g.strokeStyle = 'rgba(94,231,255,0.18)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-15, -218); g.lineTo(0, -202); g.lineTo(15, -218);
    g.stroke();
    g.restore();
  }
  g.strokeStyle = 'rgba(94,231,255,0.16)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-22, 0); g.lineTo(22, 0);
  g.moveTo(0, -22); g.lineTo(0, 22);
  g.stroke();
  g.restore();
  g.restore();

  // Bake ONLY indestructible obstacles (rocks & shipping containers) into groundLayer!
  // Destructible wooden crates are rendered dynamically so they can shatter & show cracks.
  for (const o of obstacles) {
    if (!o.destructible) drawObstacleShape(g, o);
  }

  // World border with hazard striping
  g.strokeStyle = 'rgba(94,231,255,0.25)';
  g.lineWidth = 7;
  g.strokeRect(3, 3, WORLD - 6, WORLD - 6);
  g.strokeStyle = 'rgba(94,231,255,0.06)';
  g.lineWidth = 20;
  g.strokeRect(10, 10, WORLD - 20, WORLD - 20);
  const stripe = 34;
  for (let i = 30; i < WORLD - 30; i += stripe * 2) {
    g.fillStyle = 'rgba(255,159,69,0.12)';
    g.fillRect(i, 14, stripe, 6);
    g.fillRect(i + stripe, WORLD - 20, stripe, 6);
    g.fillStyle = 'rgba(94,231,255,0.1)';
    g.fillRect(14, i, 6, stripe);
    g.fillRect(WORLD - 20, i + stripe, 6, stripe);
  }

  groundLayer = c;
  groundLayerScale = scale;
  groundLayerSource = decor;
  groundLayerObstacles = obstacles;
}

function drawGround() {
  if (!groundLayer || groundLayerSource !== decor || groundLayerObstacles !== obstacles) {
    buildGroundLayer();
  }
  // Viewport-clipped blit: only draw the visible slice of groundLayer!
  const v = viewBounds(40);
  const vx0 = clamp(v.l, 0, WORLD);
  const vy0 = clamp(v.t, 0, WORLD);
  const vx1 = clamp(v.r, 0, WORLD);
  const vy1 = clamp(v.b, 0, WORLD);
  const vw = vx1 - vx0;
  const vh = vy1 - vy0;
  if (vw > 1 && vh > 1) {
    const s = groundLayerScale;
    const sx = clamp(vx0 * s, 0, groundLayer.width);
    const sy = clamp(vy0 * s, 0, groundLayer.height);
    const sw = clamp(vw * s, 1, groundLayer.width - sx);
    const sh = clamp(vh * s, 1, groundLayer.height - sy);
    ctx.drawImage(groundLayer, sx, sy, sw, sh, vx0, vy0, vw, vh);
  }

  // Drifting ambient atmospheric dust motes (Medium+)
  if (!getGraphicsSettings().ambient) return;
  ctx.fillStyle = '#bfe9f2';
  for (const d of decor) {
    if (d.type !== 'mote') continue;
    const mx = (d.x + game.time * (d.vx || 0) + WORLD) % WORLD;
    const my = (d.y + game.time * (d.vy || 0) + WORLD) % WORLD;
    if (mx < v.l || mx > v.r || my < v.t || my > v.b) continue;
    const tw = 0.5 + 0.5 * Math.sin(game.time * 1.6 + d.phase);
    ctx.globalAlpha = d.alpha * (0.4 + tw * 0.6);
    ctx.beginPath();
    ctx.arc(mx, my, d.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ---------------------------------------------------------
   2.5D Obstacles (Static & Destructible), Decals, Boost Pads, Barrels
   --------------------------------------------------------- */
function drawObstacleShape(c, o) {
  c.save();
  const bevel = o.type === 'rock' ? 7 : 10;
  // Soft directional cast shadow
  c.fillStyle = 'rgba(0,0,0,0.44)';
  rr(c, o.x + 8, o.y + 12, o.w, o.h, o.type === 'rock' ? 18 : 8);
  c.fill();

  if (o.type === 'crate') {
    // 2.5D front face extrusion
    c.fillStyle = '#332717';
    rr(c, o.x, o.y + bevel * 0.45, o.w, o.h, 6);
    c.fill();
    // Top face
    c.fillStyle = '#624d31';
    rr(c, o.x, o.y, o.w, o.h - bevel * 0.4, 6);
    c.fill();
    c.strokeStyle = '#20170d';
    c.lineWidth = 2.6;
    c.stroke();
    // Inner plank frame & diagonal brace
    const topH = o.h - bevel * 0.4;
    c.strokeStyle = 'rgba(255,218,158,0.18)';
    c.lineWidth = 1.8;
    rr(c, o.x + 6, o.y + 6, o.w - 12, Math.max(8, topH - 12), 3);
    c.stroke();
    c.strokeStyle = 'rgba(28,18,8,0.62)';
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(o.x + 9, o.y + 9); c.lineTo(o.x + o.w - 9, o.y + topH - 9);
    c.moveTo(o.x + o.w - 9, o.y + 9); c.lineTo(o.x + 9, o.y + topH - 9);
    c.stroke();
    // Specular top bevel highlight
    c.strokeStyle = 'rgba(255,228,175,0.34)';
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(o.x + 10, o.y + 2.5); c.lineTo(o.x + o.w - 10, o.y + 2.5);
    c.stroke();
    // Corner bolts
    c.fillStyle = 'rgba(255,230,180,0.28)';
    for (const [nx, ny] of [[11, 11], [o.w - 11, 11], [11, topH - 11], [o.w - 11, topH - 11]]) {
      c.beginPath(); c.arc(o.x + nx, o.y + ny, 2, 0, TAU); c.fill();
    }
    // Progressive damage cracks + hit flash
    if (o.hp < o.maxHp) {
      const dmgPct = 1 - clamp(o.hp / o.maxHp, 0, 1);
      c.strokeStyle = 'rgba(12,8,4,0.85)';
      c.lineWidth = 1.8 + dmgPct * 1.6;
      c.beginPath();
      c.moveTo(o.x + o.w * 0.25, o.y + topH * 0.25);
      c.lineTo(o.x + o.w * 0.52, o.y + topH * 0.5);
      c.lineTo(o.x + o.w * 0.78, o.y + topH * 0.35);
      if (dmgPct > 0.4) {
        c.moveTo(o.x + o.w * 0.52, o.y + topH * 0.5);
        c.lineTo(o.x + o.w * 0.36, o.y + topH * 0.82);
      }
      c.stroke();
    }
    if (o.hitFlash > 0) {
      c.globalAlpha = Math.min(0.65, o.hitFlash * 5);
      c.fillStyle = '#fff3d6';
      rr(c, o.x, o.y, o.w, o.h, 6);
      c.fill();
    }
  } else if (o.type === 'rock') {
    // 2.5D rock side skirt
    c.fillStyle = '#212a33';
    rr(c, o.x, o.y + 5, o.w, o.h, 18);
    c.fill();
    // Rock upper face
    c.fillStyle = '#3d4a56';
    rr(c, o.x, o.y, o.w, o.h - 4, 18);
    c.fill();
    c.strokeStyle = '#121a21';
    c.lineWidth = 3;
    c.stroke();
    // Lit upper facet
    c.fillStyle = 'rgba(220,242,255,0.08)';
    rr(c, o.x + 8, o.y + 6, o.w * 0.54, o.h * 0.36, 12);
    c.fill();
    c.strokeStyle = 'rgba(10,15,20,0.55)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(o.x + o.w * 0.28, o.y + o.h * 0.6);
    c.lineTo(o.x + o.w * 0.55, o.y + o.h * 0.46);
    c.lineTo(o.x + o.w * 0.74, o.y + o.h * 0.68);
    c.stroke();
    c.strokeStyle = 'rgba(195,222,235,0.18)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(o.x + o.w * 0.16, o.y + o.h * 0.32);
    c.quadraticCurveTo(o.x + o.w * 0.36, o.y + o.h * 0.18, o.x + o.w * 0.58, o.y + o.h * 0.28);
    c.stroke();
  } else {
    // 2.5D steel shipping container
    c.fillStyle = '#13272c';
    rr(c, o.x, o.y + 6, o.w, o.h, 6);
    c.fill();
    const topH = o.h - 6;
    c.fillStyle = '#254a52';
    rr(c, o.x, o.y, o.w, topH, 6);
    c.fill();
    c.strokeStyle = '#09161a';
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = 'rgba(94,231,255,0.06)';
    rr(c, o.x + 7, o.y + 7, o.w - 14, Math.max(8, topH - 14), 3);
    c.fill();
    c.strokeStyle = 'rgba(94,231,255,0.13)';
    c.lineWidth = 2;
    for (let x = o.x + 18; x < o.x + o.w - 10; x += 20) {
      c.beginPath();
      c.moveTo(x, o.y + 8); c.lineTo(x, o.y + topH - 8);
      c.stroke();
    }
    c.strokeStyle = 'rgba(130,242,255,0.36)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(o.x + 10, o.y + 3.5); c.lineTo(o.x + o.w - 10, o.y + 3.5);
    c.stroke();
    c.fillStyle = 'rgba(123,245,193,0.34)';
    rr(c, o.x + 10, o.y + 9, 4, 8, 1); c.fill();
    rr(c, o.x + o.w - 14, o.y + Math.max(9, topH - 18), 4, 8, 1); c.fill();
  }
  c.restore();
}

function drawDecals() {
  if (!decals.length) return;
  const inSafe = isPlayerInSafeMap();
  const v = viewBounds(80);
  ctx.save();
  for (let i = 0; i < decals.length; i++) {
    const d = decals[i];
    if (!!d.safe !== inSafe) continue;
    if (d.x < v.l || d.x > v.r || d.y < v.t || d.y > v.b) continue;
    const fade = clamp(d.life / Math.min(6, d.maxLife), 0, 1);
    ctx.globalAlpha = d.alpha * fade;
    if (d.type === 'scorch') {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = d.alpha * fade * 0.45;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * 1.45, 0, TAU);
      ctx.fill();
    } else if (d.type === 'crater') {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 0.72, d.angle, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawBoostPads() {
  const v = viewBounds(50);
  const t = game.time;
  ctx.save();
  for (let i = 0; i < boostPads.length; i++) {
    const pad = boostPads[i];
    if (pad.x < v.l || pad.x > v.r || pad.y < v.t || pad.y > v.b) continue;
    const pulse = 0.5 + 0.5 * Math.sin(t * 4 + pad.pulse);
    ctx.save();
    ctx.translate(pad.x, pad.y);
    ctx.rotate(pad.angle);
    ctx.fillStyle = 'rgba(7,18,26,0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, pad.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(94,231,255,${0.4 + pulse * 0.35})`;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Animated directional kinetic chevrons
    const scroll = (t * 28) % 12;
    ctx.strokeStyle = '#8ef5ff';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let k = -1; k <= 1; k++) {
      const ox = k * 11 + scroll - 6;
      ctx.globalAlpha = clamp(1 - Math.abs(ox) / 22, 0.15, 0.95);
      ctx.beginPath();
      ctx.moveTo(ox - 5, -9);
      ctx.lineTo(ox + 4, 0);
      ctx.lineTo(ox - 5, 9);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawObstaclesAndBarrels() {
  const v = viewBounds(90);
  const settings = getGraphicsSettings();
  const t = game.time;

  // Dynamic destructible crates + static cover beacon lights
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (o.destroyed) continue;
    if (o.x + o.w < v.l || o.x > v.r || o.y + o.h < v.t || o.y > v.b) continue;
    if (o.destructible) {
      if (o.shakeT > 0 && !REDUCED_MOTION) {
        const amp = (o.shakeT / 0.22) * 2.8;
        ctx.save();
        ctx.translate(Math.sin(t * 72 + o.seed) * amp, Math.cos(t * 58 + o.seed) * amp * 0.6);
        drawObstacleShape(ctx, o);
        ctx.restore();
      } else {
        drawObstacleShape(ctx, o);
      }
    } else if (settings.fx >= 1 && i % (settings.fx >= 2 ? 3 : 5) === 0) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7);
      const rgb = o.type === 'rock' ? '94,231,255' : '123,245,193';
      const x = o.x + o.w - 6;
      const y = o.y + 6;
      ctx.globalAlpha = 0.34 + pulse * 0.44;
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + pulse * 0.7, 0, TAU);
      ctx.fill();
      if (settings.fx >= 2) {
        ctx.globalAlpha = 0.08 + pulse * 0.08;
        ctx.beginPath();
        ctx.arc(x, y, 6.5 + pulse * 3, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Explosive Fuel Barrels
  for (let i = 0; i < barrels.length; i++) {
    const bar = barrels[i];
    if (!bar.alive) continue;
    if (bar.x < v.l || bar.x > v.r || bar.y < v.t || bar.y > v.b) continue;
    ctx.save();
    if (bar.shakeT > 0 && !REDUCED_MOTION) {
      const amp = (bar.shakeT / 0.22) * 3.2;
      ctx.translate(Math.sin(t * 78 + bar.seed) * amp, Math.cos(t * 62 + bar.seed) * amp * 0.65);
    }
    // Cast shadow
    ctx.fillStyle = 'rgba(0,0,0,0.44)';
    ctx.beginPath();
    ctx.ellipse(bar.x + 3, bar.y + 7, bar.r * 1.05, bar.r * 0.65, 0, 0, TAU);
    ctx.fill();
    // Burning warning ring
    if (bar.burnT > 0) {
      const blink = 0.5 + 0.5 * Math.sin(t * 26);
      ctx.strokeStyle = `rgba(255,110,60,${0.4 + blink * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bar.x, bar.y, bar.r + 8 + blink * 5, 0, TAU);
      ctx.stroke();
    }
    // 2.5D cylinder base
    ctx.fillStyle = '#6c1e16';
    ctx.beginPath();
    ctx.arc(bar.x, bar.y + 3, bar.r, 0, TAU);
    ctx.fill();
    // Top cap
    ctx.fillStyle = bar.hitFlash > 0 ? '#ffe5b8' : '#d63e2e';
    ctx.beginPath();
    ctx.arc(bar.x, bar.y - 1, bar.r - 1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#290907';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // Hazard yellow stripe ring & cap detail
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bar.x, bar.y - 1, bar.r * 0.58, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#290907';
    ctx.beginPath();
    ctx.arc(bar.x + 3.5, bar.y - 3.5, 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/* ---------------------------------------------------------
   Pickups
   --------------------------------------------------------- */
function drawPickups() {
  const v = viewBounds(40);
  const settings = getGraphicsSettings();
  for (const p of pickups) {
    if (p.x < v.l || p.x > v.r || p.y < v.t || p.y > v.b) continue;
    const isWeapon = p.kind === 'weapon';
    const isGadget = p.kind === 'gadget';
    const w = isWeapon ? WEAPONS[p.weapon] : null;
    const skin = isWeapon ? skinInfo(p.skin) : null;
    const gDef = isGadget ? (GADGETS[p.gadget] || GADGETS.frag) : null;
    const color = p.kind === 'health' ? '#57e389'
      : p.kind === 'armor' ? '#67d9ff'
      : isGadget ? gDef.color
      : skin.bonus > 0 ? skin.color : w.color;
    const bob = Math.sin(game.time * 3.2 + p.phase) * 3.2;
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 3.2 + p.phase);
    const highlighted = p === game.nearPickup;
    const spawnProg = p.spawnT > 0 ? clamp(1 - p.spawnT / 0.36, 0, 1) : 1;
    const popScale = spawnProg < 1 ? easeOutBack(spawnProg) : 1;
    const popArc = spawnProg < 1 ? Math.sin(spawnProg * Math.PI) * 14 : 0;

    ctx.save();
    ctx.translate(p.x, p.y + bob - popArc);
    if (popScale !== 1) ctx.scale(popScale, popScale);

    // Vertical loot light beam (High+)
    if (settings.fx >= 2 &&
        (p.supply || p.kind === 'health' || p.kind === 'armor' ||
         isGadget || (isWeapon && skin.bonus > 0))) {
      const beamH = p.supply ? 78 : 42;
      ctx.globalAlpha = (p.supply ? 0.22 : 0.1) + pulse * 0.06;
      ctx.fillStyle = color;
      ctx.fillRect(-1.5, -beamH, 3, beamH + 8);
      ctx.globalAlpha = 1;
    }

    if (p.supply || highlighted) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(game.time * 5 + p.phase) * 0.14;
      ctx.strokeStyle = highlighted ? '#ffffff' : '#ffd166';
      ctx.lineWidth = highlighted ? 2.4 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, (highlighted ? 22 : 26) + Math.sin(game.time * 4) * 2.5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    const shadowScale = 1 - (bob - popArc) * 0.025;
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    ctx.beginPath();
    ctx.ellipse(0, 15 - bob + popArc, Math.max(5, 13 * shadowScale), Math.max(2, 5 * shadowScale), 0, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 0.18 + pulse * 0.06;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, TAU);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(8,14,19,0.92)';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (isWeapon) {
      if (skin.bonus > 0) {
        ctx.globalAlpha = 0.38 + pulse * 0.2;
        ctx.strokeStyle = skin.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const L = w.len + 20;
      const scale = Math.min(0.4, 20 / L);
      ctx.save();
      ctx.rotate(-0.35);
      ctx.scale(scale, scale);
      ctx.translate(-L / 2, 0);
      drawGunSprite(ctx, w, color, skin.bonus > 0);
      ctx.restore();
    } else if (p.kind === 'health') {
      ctx.fillStyle = color;
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
    } else if (p.kind === 'armor') {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -7.5); ctx.lineTo(6.5, -3.5); ctx.lineTo(6.5, 2);
      ctx.lineTo(0, 7.5); ctx.lineTo(-6.5, 2); ctx.lineTo(-6.5, -3.5);
      ctx.closePath();
      ctx.fill();
    } else if (isGadget) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 1, 5.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#081016';
      ctx.fillRect(-2.5, -7.5, 5, 3);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 1, 2.5, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ---------------------------------------------------------
   Weapon Models (12 Models including 6-Barrel Minigun & Bazooka)
   --------------------------------------------------------- */
function drawMinigunBarrels(c, L, t, accent, phase, heat) {
  const x0 = 20;
  const x1 = L + 6;
  const radius = t * 0.36;
  const barrels = [];
  for (let k = 0; k < 6; k++) {
    const a = phase + (k / 6) * TAU;
    barrels.push({ y: Math.sin(a) * radius, z: Math.cos(a) });
  }
  barrels.sort((a, b) => a.z - b.z);

  // Dark inner rotary spindle backing (cleanly covers static barrels during live spin)
  c.fillStyle = '#0c1218';
  c.fillRect(x0, -radius - 1.5, x1 - x0 - 1, radius * 2 + 3);

  // 6 individual steel rotary barrels sorted back-to-front
  for (let i = 0; i < barrels.length; i++) {
    const br = barrels[i];
    const lit = 0.5 + 0.5 * br.z;
    const shade = Math.round(42 + lit * 98);
    c.fillStyle = `rgb(${shade},${shade + 8},${shade + 14})`;
    c.fillRect(x0, br.y - 1.35, x1 - x0, 2.7);
    if (lit > 0.6) {
      c.fillStyle = 'rgba(235,248,255,0.42)';
      c.fillRect(x0 + 2, br.y - 1.0, x1 - x0 - 4, 0.8);
    }
  }

  // Molten thermal barrel glow as rotary heat builds
  if (heat > 0.04) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = clamp(heat * 0.72, 0, 0.75);
    c.fillStyle = heat > 0.65 ? '#ff5526' : '#ff9f45';
    rr(c, x0 + 4, -radius - 1.8, (x1 - x0) - 6, radius * 2 + 3.6, 2.5);
    c.fill();
    c.restore();
  }

  // Three circular rotary barrel-clamp rings
  const clampH = radius * 2 + 4.2;
  for (const cx of [x0 + 8, x0 + 26, x1 - 4]) {
    c.fillStyle = '#141d25';
    rr(c, cx - 2.2, -clampH / 2, 4.4, clampH, 1.5);
    c.fill();
    c.strokeStyle = cx > x1 - 6 ? accent : 'rgba(200,225,238,0.35)';
    c.lineWidth = 1;
    c.stroke();
  }
  // Muzzle tip accent flash collar
  c.fillStyle = accent;
  c.fillRect(x1 - 1.5, -radius - 0.8, 2.2, radius * 2 + 1.6);
}

function drawGunModel(c, w, accent, fancy) {
  const ctx = c;
  const t = w.thick;
  const L = w.len + 20;
  ctx.save();

  if (w.model === 'bazooka') {
    if (fancy) {
      ctx.globalAlpha = 0.36;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.6;
      rr(ctx, -14, -t / 2 - 2.5, L + 22, t + 5, 5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Cast shadow
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    rr(ctx, -11, -t / 2 + 3, L + 14, t, 4);
    ctx.fill();

    // Rear flared venturi backblast cone
    ctx.fillStyle = '#151c20';
    ctx.beginPath();
    ctx.moveTo(-14, -t * 0.56);
    ctx.lineTo(2, -t * 0.38);
    ctx.lineTo(2, t * 0.38);
    ctx.lineTo(-14, t * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ff8c42';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-13.5, -t * 0.52);
    ctx.lineTo(-13.5, t * 0.52);
    ctx.stroke();

    // Main launch tube body (olive-slate titanium)
    ctx.fillStyle = '#24322b';
    rr(ctx, -1, -t * 0.42, L - 2, t * 0.84, 3);
    ctx.fill();
    ctx.strokeStyle = '#0c1210';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // Upper metallic specular highlight
    ctx.fillStyle = 'rgba(220,245,235,0.22)';
    ctx.fillRect(3, -t * 0.36, L - 10, 2);
    // Hazard bands & reinforcement rings
    ctx.fillStyle = '#11181c';
    for (const bx of [10, 32, 54]) {
      rr(ctx, bx, -t * 0.48, 5, t * 0.96, 1.5);
      ctx.fill();
    }
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.88;
    ctx.fillRect(18, -t * 0.14, 32, t * 0.28);
    ctx.fillRect(2, -t * 0.34, 4, t * 0.68);
    ctx.globalAlpha = 1;

    // Optical side-mounted rocket sight
    ctx.fillStyle = '#0d141a';
    rr(ctx, 20, -t * 0.42 - 6.5, 19, 5.5, 2);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#7ef2ff';
    ctx.fillRect(36, -t * 0.42 - 5.2, 2.5, 3);

    // Front flared muzzle bell
    ctx.fillStyle = '#182126';
    ctx.beginPath();
    ctx.moveTo(L - 8, -t * 0.44);
    ctx.lineTo(L + 1, -t * 0.58);
    ctx.lineTo(L + 1, t * 0.58);
    ctx.lineTo(L - 8, t * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Protruding warhead nosecone
    ctx.fillStyle = '#3a4a3e';
    ctx.beginPath();
    ctx.moveTo(L, -t * 0.36);
    ctx.quadraticCurveTo(L + 8, -t * 0.24, L + 11, 0);
    ctx.quadraticCurveTo(L + 8, t * 0.24, L, t * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(L + 2, -t * 0.28, 3.2, t * 0.56);
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.arc(L + 9.8, 0, 1.8, 0, TAU);
    ctx.fill();

    ctx.restore();
    return;
  }

  if (w.model === 'minigun') {
    if (fancy) {
      ctx.globalAlpha = 0.36;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.6;
      rr(ctx, -8, -t / 2 - 2.5, L + 16, t + 5, 5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Cast shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    rr(ctx, -4, -t / 2 + 3, L + 9, t, 4);
    ctx.fill();

    // Heavy motorized rotary housing (rear)
    ctx.fillStyle = '#121920';
    rr(ctx, -6, -t * 0.54, 29, t * 1.08, 4);
    ctx.fill();
    ctx.strokeStyle = '#070b0f';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // Housing bevel & cooling vents
    ctx.fillStyle = '#24303a';
    rr(ctx, -2, -t * 0.38, 22, t * 0.76, 2.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-1, -t * 0.48, 20, 1.6);
    ctx.fillStyle = '#0b1016';
    for (let v = 0; v < 3; v++) {
      ctx.fillRect(2 + v * 5, -t * 0.24, 2.6, t * 0.48);
    }
    // Top chainsaw carry bar
    ctx.strokeStyle = '#53626e';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -t * 0.54);
    ctx.lineTo(3, -t * 0.54 - 5);
    ctx.lineTo(18, -t * 0.54 - 5);
    ctx.lineTo(20, -t * 0.54);
    ctx.stroke();
    // Under-slung drum magazine & brass feed belt
    ctx.fillStyle = '#0d141a';
    rr(ctx, 4, t * 0.42, 16, 10, 3);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    for (let b = 0; b < 4; b++) ctx.fillRect(6 + b * 3.2, t * 0.42 + 2.5, 2, 5);
    // Accent power strip on receiver
    ctx.fillStyle = accent;
    ctx.fillRect(-4, -t * 0.12, 4, t * 0.24);

    // 6-barrel rotary cluster (static pose for sprite/HUD)
    drawMinigunBarrels(ctx, L, t, accent, 0.25, 0);

    ctx.restore();
    return;
  }

  if (fancy) {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    rr(ctx, -1.5, -t / 2 - 1.5, L + 3, t + 3, 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  rr(ctx, 3, -t / 2 + 3, L, t, 3);
  ctx.fill();

  const hasStock = w.model !== 'pistol' && w.model !== 'revolver';
  if (hasStock) {
    ctx.fillStyle = '#151d24';
    ctx.beginPath();
    ctx.moveTo(-7, -t * 0.24); ctx.lineTo(5, -t * 0.4); ctx.lineTo(L * 0.2, -t * 0.36);
    ctx.lineTo(L * 0.2, t * 0.34); ctx.lineTo(5, t * 0.48); ctx.lineTo(-7, t * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Barrel & receiver
  ctx.fillStyle = '#303a43';
  ctx.beginPath();
  ctx.moveTo(L * 0.66, -t * 0.31); ctx.lineTo(L + 5, -t * 0.2);
  ctx.lineTo(L + 5, t * 0.2); ctx.lineTo(L * 0.66, t * 0.31);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#101820';
  rr(ctx, 0, -t / 2, L, t, 3);
  ctx.fill();
  ctx.fillStyle = '#202a32';
  rr(ctx, L * 0.19, -t * 0.32, L * 0.49, t * 0.64, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  rr(ctx, L * 0.08, -t / 2, L * 0.58, 1.4, 0.7);
  ctx.fill();
  ctx.fillStyle = '#0a1015';
  rr(ctx, L * 0.67, -t * 0.23, L * 0.29, t * 0.46, 1.5);
  ctx.fill();
  ctx.fillStyle = '#89939a';
  ctx.globalAlpha = 0.78;
  rr(ctx, L * 0.73, -t * 0.16, L * 0.26, t * 0.32, 1);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#171f26';
  rr(ctx, L * 0.21, -t / 2 - 3.2, L * 0.43, 2.8, 1);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(L * 0.3, t / 2 - 1.5, L * 0.44, 1.5);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#8d999f';
  ctx.fillRect(L + 2, -t * 0.2, 4, t * 0.4);
  ctx.fillStyle = accent;
  ctx.fillRect(L + 5, -t * 0.12, 3, t * 0.24);

  switch (w.model) {
    case 'pistol':
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 3; i++) ctx.fillRect(23 + i * 4, -t / 2 + 1, 2, t - 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#0b1015';
      rr(ctx, 12, t / 2 - 1, 9, 8, 2); ctx.fill();
      break;
    case 'smg':
      ctx.fillStyle = '#0b1015';
      rr(ctx, L * 0.38, t / 2 - 1, 9, 12, 2); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = accent; ctx.fillRect(L * 0.38 + 1, t / 2 + 9, 7, 2);
      break;
    case 'shotgun':
      ctx.fillStyle = '#1a232b';
      rr(ctx, L * 0.52, -t / 2 - 3, 13, t + 4, 2); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = accent; ctx.fillRect(L * 0.56, -t / 2 - 1, 5, t + 2);
      break;
    case 'rifle':
      ctx.fillStyle = '#0a0f14';
      rr(ctx, L * 0.34, -t / 2 - 7, 14, 5, 2); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#0b1015';
      rr(ctx, L * 0.48, t / 2 - 1, 8, 10, 2); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.stroke();
      break;
    case 'pulse':
      // Sci-fi bullpup coils & glowing energy cells
      ctx.fillStyle = '#09151a';
      rr(ctx, L * 0.24, -t / 2 - 6, 18, 5, 2); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = accent;
      for (let k = 0; k < 4; k++) ctx.fillRect(L * 0.5 + k * 5, -t * 0.3, 3, t * 0.6);
      break;
    case 'revolver':
      ctx.fillStyle = '#161f27';
      ctx.beginPath(); ctx.arc(L * 0.3, 0, 5, 0, TAU); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(L * 0.3, 0, 2, 0, TAU); ctx.stroke();
      break;
    case 'dmr':
      ctx.fillStyle = '#0a0f14';
      rr(ctx, L * 0.28, -t / 2 - 7, 19, 5, 2.5); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#0b1015';
      rr(ctx, L * 0.48, t / 2 - 1, 8, 9, 2); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.stroke();
      break;
    case 'lmg':
      ctx.fillStyle = '#0b1015';
      rr(ctx, L * 0.4, t / 2 - 1, 14, 14, 2); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = accent; ctx.fillRect(L * 0.4 + 2, t / 2 + 10, 10, 2);
      break;
    case 'sniper':
      ctx.fillStyle = '#0a0f14';
      rr(ctx, L * 0.22, -t / 2 - 8, 21, 6, 3); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = accent; ctx.fillRect(L - 8, -t / 2 - 2, 4, t + 4);
      break;
    case 'railgun':
      // Twin electromagnetic split rails + glowing core strip
      ctx.fillStyle = '#140c1f';
      rr(ctx, L * 0.16, -t / 2 - 7, 22, 6, 2.5); ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(L * 0.45, -1.6, L * 0.56, 3.2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(L * 0.48, -0.7, L * 0.5, 1.4);
      ctx.fillStyle = '#1b222c';
      ctx.fillRect(L * 0.65, -t / 2 - 2, L * 0.42, 3);
      ctx.fillRect(L * 0.65, t / 2 - 1, L * 0.42, 3);
      break;
  }
  ctx.restore();
}

const gunSpriteCache = Object.create(null);
const GUN_SPRITE_SCALE = 2;

function getGunSprite(w, accent, fancy) {
  const key = w.model + '|' + accent + '|' + (fancy ? 1 : 0);
  if (gunSpriteCache[key]) return gunSpriteCache[key];
  const L = w.len + 20;
  const t = w.thick;
  const padX = 18;
  const padY = 18;
  const unitW = L + padX * 2 + 12;
  const unitH = t + padY * 2 + 14;
  const image = document.createElement('canvas');
  image.width = Math.ceil(unitW * GUN_SPRITE_SCALE);
  image.height = Math.ceil(unitH * GUN_SPRITE_SCALE);
  const g = image.getContext('2d');
  g.scale(GUN_SPRITE_SCALE, GUN_SPRITE_SCALE);
  g.translate(padX, unitH / 2);
  drawGunModel(g, w, accent, fancy);
  const sprite = { canvas: image, ox: padX, oy: unitH / 2, w: unitW, h: unitH };
  gunSpriteCache[key] = sprite;
  return sprite;
}

function drawGunSprite(c, w, accent, fancy) {
  const sprite = getGunSprite(w, accent, fancy);
  c.drawImage(sprite.canvas, -sprite.ox, -sprite.oy, sprite.w, sprite.h);
}

function drawWeaponPreview() {
  const el = UI.hudWeapon;
  if (!el || !player) return;
  const c = el.getContext('2d');
  const w = WEAPONS[player.weapon];
  const skin = skinInfo(player.skin);
  const accent = skin.bonus > 0 ? skin.color : w.color;
  c.clearRect(0, 0, el.width, el.height);
  const scale = Math.min(el.width / (w.len + 50), el.height / (w.thick + 26), 1.5);
  c.save();
  c.translate(el.width / 2, el.height / 2 + 2);
  c.scale(scale, scale);
  c.translate(-(w.len + 20) / 2, 0);
  drawGunModel(c, w, accent, skin.bonus > 0);
  c.restore();
}

/* ---------------------------------------------------------
   Planet Operators (Pure Celestial Spheres — No Faces/Eyes)
   --------------------------------------------------------- */
const operatorHeadCache = Object.create(null);

function createOperatorHead(id) {
  const operator = OPERATOR_PRESETS[id] || OPERATOR_PRESETS.cyan;
  const image = document.createElement('canvas');
  image.width = 96;
  image.height = 96;
  const art = image.getContext('2d');
  art.lineJoin = 'round';
  art.lineCap = 'round';

  const cx = 48;
  const cy = 48;
  const radius = 34;

  // Ambient star sparkles
  art.globalAlpha = 0.65;
  art.fillStyle = operator.light;
  for (const [sx, sy, sr] of [[14, 20, 1.1], [80, 16, 0.9], [16, 76, 0.85], [82, 74, 1.05]]) {
    art.beginPath();
    art.arc(sx, sy, sr, 0, TAU);
    art.fill();
  }
  art.globalAlpha = 1;

  // Soft atmospheric outer glow
  const planetGlow = art.createRadialGradient(cx, cy, radius * 0.6, cx, cy, radius + 10);
  planetGlow.addColorStop(0, 'rgba(0,0,0,0)');
  planetGlow.addColorStop(0.78, operator.auraColor + '42');
  planetGlow.addColorStop(1, 'rgba(0,0,0,0)');
  art.fillStyle = planetGlow;
  art.beginPath();
  art.arc(cx, cy, radius + 10, 0, TAU);
  art.fill();

  // Back half of planetary rings (Saturn & faint axial ring for Uranus)
  if (operator.planetType === 'ringed') {
    art.save();
    art.translate(cx, cy);
    art.rotate(-0.26);
    art.strokeStyle = 'rgba(215,189,133,0.82)';
    art.lineWidth = 6.5;
    art.beginPath();
    art.ellipse(0, 0, 45, 12.5, 0, 0, TAU);
    art.stroke();
    art.strokeStyle = 'rgba(22,20,18,0.55)';
    art.lineWidth = 1.6;
    art.beginPath();
    art.ellipse(0, 0, 44.5, 12.2, 0, 0, TAU);
    art.stroke();
    art.restore();
  } else if (id === 'cobalt') {
    art.save();
    art.translate(cx, cy);
    art.rotate(0.42);
    art.strokeStyle = 'rgba(175,235,255,0.45)';
    art.lineWidth = 2.2;
    art.beginPath();
    art.ellipse(0, 0, 44, 10, 0, 0, TAU);
    art.stroke();
    art.restore();
  }

  // Main spherical body shading (top-left sunlit illumination)
  const surface = art.createRadialGradient(cx - 13, cy - 15, 2, cx + 4, cy + 6, radius + 9);
  surface.addColorStop(0, operator.light);
  surface.addColorStop(0.32, operator.color);
  surface.addColorStop(0.76, operator.color);
  surface.addColorStop(1, '#0d141c');
  art.fillStyle = surface;
  art.beginPath();
  art.arc(cx, cy, radius, 0, TAU);
  art.fill();

  // Clipped planetary surface geology / atmosphere
  art.save();
  art.beginPath();
  art.arc(cx, cy, radius - 0.5, 0, TAU);
  art.clip();

  if (operator.planetType === 'gas') {
    // Jupiter: banded turbulent clouds + Great Storm oval
    art.globalAlpha = 0.54;
    for (let i = 0; i < 7; i++) {
      art.fillStyle = i % 2 ? operator.light : operator.auraColor;
      const y = cy - 29 + i * 9.5;
      art.beginPath();
      art.moveTo(cx - 40, y);
      art.bezierCurveTo(cx - 12, y - 3, cx + 12, y + 3, cx + 40, y - 1);
      art.lineTo(cx + 40, y + 4.5);
      art.bezierCurveTo(cx + 12, y + 7, cx - 12, y + 1, cx - 40, y + 4.5);
      art.closePath();
      art.fill();
    }
    art.globalAlpha = 0.82;
    art.fillStyle = '#e58b5f';
    art.beginPath();
    art.ellipse(cx + 11, cy + 5, 9, 5, -0.2, 0, TAU);
    art.fill();
    art.strokeStyle = 'rgba(255,235,205,0.75)';
    art.lineWidth = 1.2;
    art.stroke();
  } else if (operator.planetType === 'terrestrial') {
    // Earth: deep ocean + green continents + polar ice + drifting clouds
    art.fillStyle = 'rgba(32,102,158,0.45)';
    art.fillRect(0, 0, 96, 96);
    art.fillStyle = 'rgba(66,184,124,0.86)';
    art.beginPath();
    art.moveTo(16, 36); art.lineTo(25, 22); art.lineTo(42, 20); art.lineTo(48, 30);
    art.lineTo(41, 41); art.lineTo(45, 50); art.lineTo(31, 52); art.lineTo(21, 44);
    art.closePath(); art.fill();
    art.beginPath();
    art.moveTo(56, 48); art.lineTo(68, 42); art.lineTo(79, 50); art.lineTo(76, 66);
    art.lineTo(62, 72); art.lineTo(54, 62);
    art.closePath(); art.fill();
    // Polar ice cap
    art.fillStyle = 'rgba(235,250,255,0.68)';
    art.beginPath(); art.ellipse(cx - 2, cy - 31, 14, 5, -0.1, 0, TAU); art.fill();
    // Translucent cloud wisps
    art.fillStyle = 'rgba(238,252,255,0.52)';
    art.beginPath(); art.ellipse(36, 32, 12, 3, -0.25, 0, TAU); art.fill();
    art.beginPath(); art.ellipse(60, 56, 11, 2.6, 0.2, 0, TAU); art.fill();
    art.beginPath(); art.ellipse(42, 65, 9, 2.2, -0.15, 0, TAU); art.fill();
  } else if (operator.planetType === 'ice') {
    // Neptune / Uranus: sweeping ice-giant currents & storm spot
    art.globalAlpha = 0.56;
    art.strokeStyle = operator.light;
    art.lineWidth = 3.2;
    for (let i = 0; i < 5; i++) {
      const y = cy - 24 + i * 12;
      art.beginPath();
      art.moveTo(12, y);
      art.bezierCurveTo(32, y - 6, 60, y + 6, 84, y - 1);
      art.stroke();
    }
    if (id === 'violet') {
      // Neptune dark storm vortex
      art.globalAlpha = 0.55;
      art.fillStyle = '#1b1d4a';
      art.beginPath(); art.ellipse(cx - 7, cy + 7, 8, 4.5, 0.15, 0, TAU); art.fill();
      art.strokeStyle = 'rgba(220,210,255,0.65)';
      art.lineWidth = 1;
      art.stroke();
    }
  } else if (operator.planetType === 'ringed') {
    // Saturn: subtle warm atmospheric bands
    art.globalAlpha = 0.35;
    for (let i = 0; i < 6; i++) {
      art.fillStyle = i % 2 ? '#fff0c8' : '#b89f6d';
      art.fillRect(cx - 40, cy - 26 + i * 10, 80, 4);
    }
  } else if (id === 'aurum') {
    // Venus: dense golden swirling atmospheric clouds
    art.globalAlpha = 0.48;
    art.strokeStyle = '#fff3c4';
    art.lineWidth = 3.5;
    for (let i = 0; i < 4; i++) {
      const y = cy - 19 + i * 13;
      art.beginPath();
      art.moveTo(12, y + 3);
      art.quadraticCurveTo(48, y - 9, 84, y + 3);
      art.stroke();
    }
  } else if (id === 'crimson') {
    // Mars: Valles Marineris rift canyon + craters + polar cap
    art.globalAlpha = 0.52;
    art.strokeStyle = '#5c1816';
    art.lineWidth = 3.2;
    art.beginPath();
    art.moveTo(18, 52); art.quadraticCurveTo(44, 42, 74, 54);
    art.stroke();
    art.strokeStyle = 'rgba(255,195,165,0.4)';
    art.lineWidth = 1.2;
    art.beginPath();
    art.moveTo(20, 50); art.quadraticCurveTo(44, 40, 72, 52);
    art.stroke();
    art.fillStyle = 'rgba(255,235,230,0.65)';
    art.beginPath(); art.ellipse(cx, cy - 31, 11, 4, 0, 0, TAU); art.fill();
    art.fillStyle = 'rgba(72,18,16,0.34)';
    for (const [x, y, rx, ry] of [[30, 32, 5, 3.8], [64, 34, 4, 3], [36, 66, 4.5, 3.2]]) {
      art.beginPath(); art.ellipse(x, y, rx, ry, 0.25, 0, TAU); art.fill();
    }
  } else {
    // Mercury: sculpted rocky impact craters & bright ejecta rims
    for (const [x, y, rad] of [[31, 32, 6.2], [62, 37, 4.8], [46, 56, 7.5], [29, 63, 4], [65, 62, 5.2]]) {
      art.fillStyle = 'rgba(10,18,26,0.34)';
      art.beginPath(); art.arc(x, y, rad, 0, TAU); art.fill();
      art.strokeStyle = 'rgba(205,245,255,0.42)';
      art.lineWidth = 1.1;
      art.beginPath(); art.arc(x, y, rad, -2.5, -0.5); art.stroke();
    }
  }

  // Spherical terminator shadow gradient
  const shade = art.createLinearGradient(cx - 18, cy - 24, cx + 32, cy + 30);
  shade.addColorStop(0, 'rgba(255,255,255,0.18)');
  shade.addColorStop(0.46, 'rgba(255,255,255,0)');
  shade.addColorStop(0.78, 'rgba(0,0,0,0.28)');
  shade.addColorStop(1, 'rgba(0,0,0,0.62)');
  art.fillStyle = shade;
  art.beginPath();
  art.arc(cx, cy, radius, 0, TAU);
  art.fill();
  art.restore();

  // Front half of rings (drawn cleanly over the globe)
  if (operator.planetType === 'ringed') {
    art.save();
    art.translate(cx, cy);
    art.rotate(-0.26);
    art.strokeStyle = 'rgba(248,228,178,0.95)';
    art.lineWidth = 3.2;
    art.beginPath();
    art.ellipse(0, 0, 45, 12.5, 0, 0.08, Math.PI - 0.08);
    art.stroke();
    art.strokeStyle = 'rgba(255,248,220,0.9)';
    art.lineWidth = 1;
    art.beginPath();
    art.ellipse(0, 0, 41.5, 11.2, 0, 0.1, Math.PI - 0.1);
    art.stroke();
    art.restore();
  } else if (id === 'cobalt') {
    art.save();
    art.translate(cx, cy);
    art.rotate(0.42);
    art.strokeStyle = 'rgba(210,246,255,0.72)';
    art.lineWidth = 1.8;
    art.beginPath();
    art.ellipse(0, 0, 44, 10, 0, 0.08, Math.PI - 0.08);
    art.stroke();
    art.restore();
  }

  // Crisp atmospheric specular crescent highlight
  art.strokeStyle = 'rgba(235,248,255,0.76)';
  art.lineWidth = 1.3;
  art.beginPath();
  art.arc(cx, cy, radius, -2.5, -1.35);
  art.stroke();
  art.strokeStyle = operator.auraColor;
  art.globalAlpha = 0.7;
  art.lineWidth = 1.4;
  art.beginPath();
  art.arc(cx, cy, radius + 0.8, -2.85, -2.1);
  art.stroke();
  art.globalAlpha = 1;

  return image;
}

function getOperatorHead(id) {
  if (!operatorHeadCache[id]) operatorHeadCache[id] = createOperatorHead(id);
  return operatorHeadCache[id];
}

function drawOperatorPortrait(canvasElement, id) {
  const portrait = canvasElement.getContext('2d');
  const operator = OPERATOR_PRESETS[id] || OPERATOR_PRESETS.cyan;
  const size = canvasElement.width;
  portrait.clearRect(0, 0, size, size);
  portrait.fillStyle = '#071018';
  portrait.fillRect(0, 0, size, size);
  portrait.save();
  portrait.globalAlpha = 0.28;
  portrait.fillStyle = operator.auraColor;
  portrait.beginPath();
  portrait.arc(size / 2, size / 2, size * 0.46, 0, TAU);
  portrait.fill();
  portrait.restore();
  const inset = size * 0.06;
  portrait.drawImage(getOperatorHead(id), inset, inset, size - inset * 2, size - inset * 2);
  portrait.strokeStyle = operator.auraColor;
  portrait.lineWidth = size * 0.035;
  portrait.beginPath();
  portrait.arc(size / 2, size / 2, size * 0.47, 0, TAU);
  portrait.stroke();
}

function drawPlanetShowcase(canvasElement, id) {
  if (!canvasElement) return;
  const c = canvasElement.getContext('2d');
  const operator = OPERATOR_PRESETS[id] || OPERATOR_PRESETS.cyan;
  const size = canvasElement.width;
  const half = size / 2;
  c.clearRect(0, 0, size, size);
  const halo = c.createRadialGradient(half, half, size * 0.14, half, half, size * 0.49);
  halo.addColorStop(0, operator.auraColor + '55');
  halo.addColorStop(0.55, operator.auraColor + '1f');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = halo;
  c.beginPath();
  c.arc(half, half, size * 0.49, 0, TAU);
  c.fill();
  const inset = size * 0.05;
  c.drawImage(getOperatorHead(id), inset, inset, size - inset * 2, size - inset * 2);
}

function drawAimLine() {
  const p = player;
  if (!p || !p.alive) return;
  const w = WEAPONS[p.weapon];
  const startX = p.x + Math.cos(p.angle) * (p.r + 22);
  const startY = p.y + Math.sin(p.angle) * (p.r + 22);
  ctx.save();
  ctx.strokeStyle = p.jamT > 0 ? 'rgba(94,231,255,0.06)'
    : w && w.explosive ? 'rgba(255,107,53,0.24)'
    : w && w.spinUp && p.spin > 0.1 ? 'rgba(255,190,59,0.22)'
    : 'rgba(94,231,255,0.16)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 7]);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(startX + Math.cos(p.angle) * 320, startY + Math.sin(p.angle) * 320);
  ctx.stroke();
  ctx.restore();
}

function drawAura(e) {
  const settings = getGraphicsSettings();
  if (settings.key === 'verylow' && !e.isPlayer) return;
  const aura = e.aura || 0;
  const tier = Math.min(4, Math.floor(aura / 1000));
  const t = game.time + e.seed;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  const baseAlpha = e.isPlayer ? 0.2 : 0.1;
  const boost = Math.min(e.isPlayer ? 0.36 : 0, aura / 14000);
  const low = settings.fx < 1;

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = baseAlpha + boost + pulse * 0.06;
  ctx.strokeStyle = e.auraColor;
  ctx.lineWidth = 1.4 + pulse * 0.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, e.r + 7 + pulse * 2, e.r * 0.72 + pulse * 2, t * 0.15, 0, TAU);
  ctx.stroke();

  if (!low || e.isPlayer) {
    const arcs = low ? 1 : 2 + Math.min(2, tier);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < arcs; i++) {
      const a0 = -t * (0.55 + i * 0.12) + i * (TAU / arcs);
      ctx.globalAlpha = baseAlpha + boost + 0.08 * Math.sin(t * 2.8 + i);
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 12 + i * 3, a0, a0 + (i % 2 ? 0.74 : 1.1));
      ctx.stroke();
    }
  }
  ctx.restore();
}

const entityBodyCache = Object.create(null);

function getEntityBodySprite(e) {
  const key = e.color + '|' + e.light;
  if (entityBodyCache[key]) return entityBodyCache[key];
  const size = 56;
  const r = 22;
  const image = document.createElement('canvas');
  image.width = size;
  image.height = size;
  const g = image.getContext('2d');
  // Tactical shoulder pauldrons
  g.fillStyle = '#15202a';
  g.beginPath(); g.ellipse(size / 2, size / 2 - 14, 11, 6.5, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(size / 2, size / 2 + 14, 11, 6.5, 0, 0, TAU); g.fill();
  g.strokeStyle = e.light;
  g.globalAlpha = 0.45;
  g.lineWidth = 1.2;
  g.beginPath(); g.ellipse(size / 2, size / 2 - 14, 11, 6.5, 0, 0, TAU); g.stroke();
  g.beginPath(); g.ellipse(size / 2, size / 2 + 14, 11, 6.5, 0, 0, TAU); g.stroke();
  g.globalAlpha = 1;

  // Core armored torso
  const grad = g.createRadialGradient(size / 2 - r * 0.3, size / 2 - r * 0.35, r * 0.15, size / 2, size / 2, r);
  grad.addColorStop(0, e.light);
  grad.addColorStop(0.5, e.color);
  grad.addColorStop(1, '#08131a');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(size / 2, size / 2, r - 2, 0, TAU);
  g.fill();
  entityBodyCache[key] = image;
  return image;
}

function drawEntities() {
  const inSafe = isPlayerInSafeMap();
  const v = viewBounds(80);
  for (const e of allEntities()) {
    if (!e.alive || !!e.inSafeZone !== inSafe) continue;
    if (e.x < v.l || e.x > v.r || e.y < v.t || e.y > v.b) continue;
    drawEntity(e);
  }
}

function drawEntity(e) {
  const r = e.r;
  // Continuous walk-bob phase + amplitude: 100% smooth with zero phase pop on start/stop.
  const bob = Math.sin(e.walkPhase || (game.time * 3 + e.seed)) * (e.bobAmp != null ? e.bobAmp : 0.45);
  const aimA = e.visAngle != null ? e.visAngle : e.angle;
  const swayX = (e.moveX || 0) * -2.6 + (e.flinchX || 0);
  const swayY = (e.moveY || 0) * -2.6 + (e.flinchY || 0);
  const lean = clamp(((e.moveX || 0) * -Math.sin(aimA) + (e.moveY || 0) * Math.cos(aimA)) * 0.13, -0.18, 0.18);
  const spawnProg = e.spawnT > 0 ? clamp(1 - e.spawnT / 0.35, 0, 1) : 1;
  const spawnScale = spawnProg < 1 ? easeOutBack(spawnProg) : 1;
  const sx = (e.scaleX != null ? e.scaleX : 1) * spawnScale;
  const sy = (e.scaleY != null ? e.scaleY : 1) * spawnScale;

  ctx.save();
  // Ground shadow synced subtly with vertical bob
  const shScale = (1 - bob * 0.025) * spawnScale;
  ctx.fillStyle = 'rgba(0,0,0,0.44)';
  ctx.beginPath();
  ctx.ellipse(e.x + 3 + (e.flinchX || 0) * 0.4, e.y + 10 + (e.flinchY || 0) * 0.4,
    r * 1.1 * shScale, r * 0.58 * shScale, 0, 0, TAU);
  ctx.fill();

  if (e.isPlayer) {
    ctx.globalAlpha = 0.16 + Math.sin(game.time * 2.4) * 0.04;
    ctx.strokeStyle = e.auraColor;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, r + 9, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = e.auraColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(e.x, e.y, r + 4, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (e.elite) {
    ctx.save();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -game.time * 18;
    ctx.globalAlpha = 0.78;
    ctx.beginPath(); ctx.arc(e.x, e.y, r + 11, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  if (e === player && game.invuln > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(game.invuln / DASH_IFRAMES, 0, 1) * 0.6;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(e.x, e.y, r + 13 + Math.sin(game.time * 30) * 2, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  const w = WEAPONS[e.weapon];
  const skin = skinInfo(e.skin);
  const accent = skin.bonus > 0 ? skin.color : w.color;

  drawAura(e);

  // Rotated torso + spring-recoil weapon + gripping tactical hands
  ctx.save();
  ctx.translate(e.x + swayX, e.y + bob + swayY);
  ctx.rotate(aimA);
  ctx.scale(sx, sy);

  const bodySize = r * 2.55;
  ctx.drawImage(getEntityBodySprite(e), -bodySize / 2, -bodySize / 2, bodySize, bodySize);

  ctx.save();
  if (e.reloading) {
    const rp = clamp(1 - e.reloadT / Math.max(0.001, e.reloadTotal), 0, 1);
    const dip = smooth(Math.sin(rp * Math.PI));
    ctx.translate(-dip * 2.5, dip * 5.8);
    ctx.rotate(dip * 0.22);
  }
  if (e.weaponChangeT > 0) {
    const pSwap = clamp(1 - e.weaponChangeT / 0.26, 0, 1);
    const easeSwap = easeOutBack(pSwap);
    ctx.globalAlpha = 0.4 + pSwap * 0.6;
    ctx.translate((1 - easeSwap) * -8, (1 - easeSwap) * 4);
    ctx.rotate((1 - easeSwap) * -0.25);
    ctx.scale(0.88 + easeSwap * 0.12, 0.88 + easeSwap * 0.12);
  }
  const kick = e.weaponKick || 0;
  ctx.translate(-kick, 0);
  if (e.muzzleRise) ctx.rotate(e.muzzleRise);
  drawGunSprite(ctx, w, accent, skin.bonus > 0);
  // Live animated 6-barrel spin + thermal barrel glow for active Minigun
  if (w.model === 'minigun' && ((e.spin || 0) > 0.01 || (e.heat || 0) > 0.02)) {
    drawMinigunBarrels(ctx, w.len + 20, w.thick, accent, e.spinPhase || 0.25, e.heat || 0);
  }
  // Tactical gloved hands following recoil
  ctx.fillStyle = '#18242e';
  ctx.strokeStyle = e.light;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(10, 6.5, 4.2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(21, -5.5, 3.8, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();

  // Pure celestial planet sphere (keeps sunlit top-left shading & rings consistent)
  ctx.restore();
  ctx.save();
  ctx.translate(e.x + swayX, e.y + bob + swayY);
  if (e.dashT > 0) {
    // Stretch smoothly along dash direction during dash!
    const da = Math.atan2(e.dashY || 0, e.dashX || 1);
    ctx.rotate(da);
    ctx.scale(sx, sy);
    ctx.rotate(-da + lean);
  } else {
    ctx.scale(sx, sy);
    ctx.rotate(lean);
  }
  const headSize = r * 1.92;
  ctx.drawImage(getOperatorHead(e.operatorId), -headSize / 2, -headSize / 2, headSize, headSize);
  ctx.restore();

  // Armor energy ring
  if (e.armor > 0) {
    ctx.strokeStyle = `rgba(103,217,255,${0.36 + (e.armor / e.maxArmor) * 0.44})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r + 4.5, 0.25, TAU - 0.25);
    ctx.stroke();
  }

  // EMP Jammed electric arc visual
  if (e.jamT > 0) {
    ctx.save();
    ctx.strokeStyle = '#6cf2ff';
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(game.time * 32);
    ctx.beginPath();
    ctx.arc(e.x, e.y, r + 7, game.time * 6, game.time * 6 + 2.4);
    ctx.stroke();
    ctx.restore();
  }

  if (e.hitFlash > 0) {
    ctx.globalAlpha = Math.min(0.8, e.hitFlash * 5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Name, armor bar (for armored bots) & HP bar
  const barW = 48;
  const by = e.y - r - 18;
  ctx.fillStyle = 'rgba(2,6,10,0.8)';
  ctx.fillRect(e.x - barW / 2, by, barW, 4.5);
  const trailRatio = clamp((e.hpTrail != null ? e.hpTrail : e.hp) / e.maxHp, 0, 1);
  if (trailRatio > e.hp / e.maxHp) {
    ctx.fillStyle = 'rgba(255,235,215,0.75)';
    ctx.fillRect(e.x - barW / 2, by, barW * trailRatio, 4.5);
  }
  const ratio = clamp(e.hp / e.maxHp, 0, 1);
  ctx.fillStyle = e.isPlayer ? '#6ff2b0' : ratio > 0.5 ? '#ffb347' : '#ff5a5f';
  ctx.fillRect(e.x - barW / 2, by, barW * ratio, 4.5);

  if (!e.isPlayer && e.armor > 0) {
    ctx.fillStyle = '#67d9ff';
    ctx.fillRect(e.x - barW / 2, by - 3.5, barW * clamp(e.armor / e.maxArmor, 0, 1), 2.4);
  }

  ctx.font = '700 9px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = e.isPlayer ? 'rgba(160,245,255,0.92)'
    : e.elite ? 'rgba(255,224,150,0.95)' : 'rgba(255,225,215,0.6)';
  ctx.fillText(e.isPlayer ? 'YOU' : e.name, e.x, by - (e.armor > 0 && !e.isPlayer ? 6 : 3));

  ctx.restore();
}

/* ---------------------------------------------------------
   Bullets, Beams, Throwables, Smoke Clouds & Particles
   --------------------------------------------------------- */
const BULLET_TRAILS = {
  pistol: { len: 20, width: 2.6 },
  smg: { len: 22, width: 2.2 },
  shotgun: { len: 16, width: 2.9 },
  revolver: { len: 28, width: 3.1 },
  rifle: { len: 32, width: 3.0 },
  pulse: { len: 30, width: 2.8 },
  dmr: { len: 38, width: 2.8 },
  lmg: { len: 24, width: 2.7 },
  sniper: { len: 48, width: 3.4 },
  railgun: { len: 62, width: 4.0 },
  minigun: { len: 21, width: 2.3 },
  bazooka: { len: 28, width: 5.0 },
};

function drawBullets() {
  const inSafe = isPlayerInSafeMap();
  const v = viewBounds(64);
  const fast = getGraphicsSettings().key === 'verylow';
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (!!b.inSafeZone !== inSafe) continue;
    if (b.x < v.l || b.x > v.r || b.y < v.t || b.y > v.b) continue;
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const ux = b.vx / speed;
    const uy = b.vy / speed;

    if (b.explosive) {
      // Dedicated Bazooka rocket warhead + flickering thruster flame
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.atan2(uy, ux));
      const flicker = 0.8 + 0.35 * Math.sin(game.time * 65 + i * 3);
      // Thruster flame plume (additive)
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.moveTo(-7, -4.5);
      ctx.lineTo(-22 * flicker, 0);
      ctx.lineTo(-7, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff1b8';
      ctx.beginPath();
      ctx.moveTo(-7, -2.2);
      ctx.lineTo(-14 * flicker, 0);
      ctx.lineTo(-7, 2.2);
      ctx.closePath();
      ctx.fill();

      // Solid metallic warhead body & tail fins
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#1b2429';
      ctx.beginPath();
      ctx.moveTo(-9, -6.5); ctx.lineTo(-4, -3); ctx.lineTo(-4, 3); ctx.lineTo(-9, 6.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#39483e';
      rr(ctx, -8, -3.4, 15, 6.8, 2);
      ctx.fill();
      ctx.fillStyle = b.color || '#ffcf70';
      ctx.beginPath();
      ctx.moveTo(5, -3.5);
      ctx.quadraticCurveTo(12, -2, 14, 0);
      ctx.quadraticCurveTo(12, 2, 5, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(11.5, 0, 1.4, 0, TAU);
      ctx.fill();
      ctx.restore();
      continue;
    }

    const cfg = BULLET_TRAILS[b.weapon] || BULLET_TRAILS.rifle;
    const tail = cfg.len;
    if (!fast) {
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = cfg.width * 2.8;
      ctx.beginPath();
      ctx.moveTo(b.x - ux * tail, b.y - uy * tail);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.strokeStyle = b.color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = cfg.width;
    ctx.beginPath();
    ctx.moveTo(b.x - ux * tail, b.y - uy * tail);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(b.x - ux * tail * 0.65, b.y - uy * tail * 0.65);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBeams() {
  if (!beams.length) return;
  const inSafe = isPlayerInSafeMap();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < beams.length; i++) {
    const bm = beams[i];
    if (!!bm.safe !== inSafe) continue;
    const a = clamp(bm.life / bm.maxLife, 0, 1);
    ctx.globalAlpha = a * 0.34;
    ctx.strokeStyle = bm.color;
    ctx.lineWidth = bm.width * 3.4 * a;
    ctx.beginPath();
    ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2);
    ctx.stroke();
    ctx.globalAlpha = a * 0.92;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, bm.width * 0.75 * a);
    ctx.beginPath();
    ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawProjectiles() {
  if (!projectiles.length) return;
  const inSafe = isPlayerInSafeMap();
  const v = viewBounds(180);
  ctx.save();
  for (let i = 0; i < projectiles.length; i++) {
    const pr = projectiles[i];
    if (!!pr.inSafeZone !== inSafe) continue;
    if (pr.x < v.l || pr.x > v.r || pr.y < v.t || pr.y > v.b) continue;
    const progress = 1 - clamp(pr.fuse / pr.maxFuse, 0, 1);
    const blink = 0.5 + 0.5 * Math.sin(game.time * (12 + progress * 24));

    // Danger radius preview ring for Frag & EMP
    if (pr.kind !== 'smoke') {
      ctx.globalAlpha = 0.14 + progress * 0.24;
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius * (0.25 + progress * 0.75), 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.45 + blink * 0.4;
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.radius, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Ground shadow
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y + 3, 7, 4, 0, 0, TAU);
    ctx.fill();

    // Spinning canister lifted by arc height z
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(pr.x, pr.y - pr.z * 0.35);
    ctx.rotate(pr.spin);
    ctx.fillStyle = '#18222a';
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = blink > 0.5 ? '#ffffff' : pr.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(0, 0, 2.8, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawSmokes() {
  if (!smokes.length) return;
  const inSafe = isPlayerInSafeMap();
  const v = viewBounds(180);
  const fast = getGraphicsSettings().key === 'verylow';
  ctx.save();
  for (let i = 0; i < smokes.length; i++) {
    const sm = smokes[i];
    if (!!sm.inSafeZone !== inSafe) continue;
    if (sm.x < v.l || sm.x > v.r || sm.y < v.t || sm.y > v.b) continue;
    const age = sm.maxLife - sm.life;
    const grow = 0.22 + 0.78 * easeOutCubic(clamp(age / 0.75, 0, 1));
    const fade = easeOutCubic(clamp(sm.life / 1.6, 0, 1));
    const rad = sm.r * grow;
    const puffs = fast ? 3 : 6;
    for (let k = 0; k < puffs; k++) {
      const a = sm.seed + (k / puffs) * TAU + game.time * (k % 2 ? 0.24 : -0.18);
      const drift = 0.34 + 0.06 * Math.sin(game.time * 1.4 + k * 2.1);
      const ox = Math.cos(a) * rad * drift;
      const oy = Math.sin(a) * rad * drift;
      ctx.globalAlpha = 0.28 * fade;
      ctx.fillStyle = k % 2 ? '#b8ccd6' : '#8ea3ae';
      ctx.beginPath();
      ctx.arc(sm.x + ox, sm.y + oy, rad * 0.64, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 0.42 * fade;
    ctx.fillStyle = '#a4b9c4';
    ctx.beginPath();
    ctx.arc(sm.x, sm.y, rad * 0.68, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles() {
  const inSafe = isPlayerInSafeMap();
  const v = viewBounds(70);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!!p.safe !== inSafe) continue;
    if (p.x < v.l || p.x > v.r || p.y < v.t || p.y > v.b) continue;
    const a = clamp(p.life / p.maxLife, 0, 1);
    if (p.type === 'spark') {
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.016, p.y - p.vy * 0.016);
      ctx.stroke();
    } else if (p.type === 'flash') {
      ctx.globalAlpha = a * 0.68;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle || 0);
      const length = p.size * (0.65 + (1 - a) * 1.2);
      ctx.beginPath();
      ctx.moveTo(length, 0); ctx.lineTo(length * 0.18, length * 0.22);
      ctx.lineTo(0, length * 0.72); ctx.lineTo(-length * 0.14, length * 0.14);
      ctx.lineTo(-length * 0.55, 0); ctx.lineTo(-length * 0.14, -length * 0.14);
      ctx.lineTo(0, -length * 0.72); ctx.lineTo(length * 0.18, -length * 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (p.type === 'muzzleRing') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle || 0);
      ctx.globalAlpha = a * 0.72;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, p.size * 0.07);
      ctx.beginPath();
      ctx.ellipse(-p.size * 0.22, 0, p.size * 0.5 * (1.15 - a * 0.15),
        p.size * 0.2 * (1.15 - a * 0.15), 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    } else if (p.type === 'casing') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle || 0);
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = '#332819';
      ctx.fillRect(-p.size * 0.65, -p.size * 0.3, p.size * 1.5, p.size * 0.7);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size * 0.45, -p.size * 0.18, p.size, p.size * 0.34);
      ctx.restore();
    } else if (p.type === 'dash') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle || 0);
      ctx.lineCap = 'round';
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = a * 0.42;
      ctx.lineWidth = Math.max(2, p.size * 0.32);
      ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0); ctx.stroke();
      ctx.globalAlpha = a * 0.8;
      ctx.lineWidth = Math.max(1, p.size * 0.09);
      ctx.beginPath(); ctx.moveTo(-p.size * 0.72, 0); ctx.lineTo(p.size * 0.72, 0); ctx.stroke();
      ctx.restore();
    } else if (p.type === 'shard') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.angle || 0) + (1 - a) * 3);
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.size, 0); ctx.lineTo(0, p.size * 0.42);
      ctx.lineTo(-p.size * 0.5, 0); ctx.lineTo(0, -p.size * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (p.type === 'wave') {
      const prog = easeOutCubic(1 - a);
      const radius = p.size * prog + 6;
      ctx.globalAlpha = a * a * 0.58;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1 + a * 2.6;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.stroke();
      ctx.globalAlpha = a * a * 0.22;
      ctx.lineWidth = 6 + a * 6;
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (!!p.safe !== inSafe) continue;
    if (p.type === 'spark' || p.type === 'flash' || p.type === 'muzzleRing' ||
        p.type === 'dash' || p.type === 'casing' || p.type === 'shard' ||
        p.type === 'wave') continue;
    if (p.x < v.l || p.x > v.r || p.y < v.t || p.y > v.b) continue;
    const a = clamp(p.life / p.maxLife, 0, 1);
    if (p.type === 'ring') {
      ctx.globalAlpha = a * a * 0.55;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.stroke();
    } else if (p.type === 'shock') {
      const radius = p.size * easeOutCubic(1 - a);
      ctx.globalAlpha = a * a * 0.78;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5 + a * 1.8;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, TAU); ctx.stroke();
    } else if (p.type === 'planetGhost') {
      const s = p.size * 1.85 * (0.72 + a * 0.28);
      ctx.globalAlpha = a * a * 0.36;
      ctx.drawImage(getOperatorHead(p.color), p.x - s / 2, p.y - s / 2, s, s);
    } else if (p.type === 'deathGhost') {
      const prog = easeOutCubic(1 - a);
      const s = p.size * 1.92 * (1 + prog * 0.35) * a;
      if (s > 1) {
        ctx.globalAlpha = a * a * 0.65;
        ctx.drawImage(getOperatorHead(p.color), p.x - s / 2, p.y - s / 2, s, s);
      }
    } else if (p.type === 'dust' || p.type === 'smoke') {
      ctx.globalAlpha = a * a * 0.24;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.2 + easeOutCubic(1 - a) * 0.85), 0, TAU); ctx.fill();
    } else if (p.type === 'ghost') {
      ctx.globalAlpha = a * a * 0.32;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.65 + a * 0.35), 0, TAU); ctx.fill();
    } else {
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* Dynamic soft light halos on High & Ultra using cached sprite blits! */
function drawDynamicLights() {
  if (!getGraphicsSettings().lights) return;
  const inSafe = isPlayerInSafeMap();
  const v = viewBounds(180);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Player signature ambient light
  if (player && player.alive) {
    const rad = 115 + Math.min(75, (player.aura || 0) / 140);
    ctx.globalAlpha = 0.22;
    const sp = getLightSprite(player.auraColor || '#5ee7ff');
    ctx.drawImage(sp, player.x - rad, player.y - rad, rad * 2, rad * 2);
  }
  // Muzzle flashes & explosion flash light pools
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.type !== 'flash' || !!p.safe !== inSafe) continue;
    if (p.x < v.l || p.x > v.r || p.y < v.t || p.y > v.b) continue;
    const a = clamp(p.life / p.maxLife, 0, 1);
    const rad = p.size * 4.5;
    ctx.globalAlpha = a * 0.45;
    const sp = getLightSprite(p.color || '#ffd166');
    ctx.drawImage(sp, p.x - rad, p.y - rad, rad * 2, rad * 2);
  }
  if (!inSafe) {
    // Supply beacons & burning barrels (Combat Map only)
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      if (!p.supply) continue;
      if (p.x < v.l || p.x > v.r || p.y < v.t || p.y > v.b) continue;
      ctx.globalAlpha = 0.22 + 0.08 * Math.sin(game.time * 4);
      const sp = getLightSprite('#ffd166');
      ctx.drawImage(sp, p.x - 95, p.y - 95, 190, 190);
    }
    for (let i = 0; i < barrels.length; i++) {
      const bar = barrels[i];
      if (!bar.alive || bar.burnT <= 0) continue;
      if (bar.x < v.l || bar.x > v.r || bar.y < v.t || bar.y > v.b) continue;
      ctx.globalAlpha = 0.35;
      const sp = getLightSprite('#ff7a3d');
      ctx.drawImage(sp, bar.x - 80, bar.y - 80, 160, 160);
    }
  }
  // Flying Bazooka rocket thruster halos
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (!b.explosive || !!b.inSafeZone !== inSafe) continue;
    if (b.x < v.l || b.x > v.r || b.y < v.t || b.y > v.b) continue;
    ctx.globalAlpha = 0.42;
    const sp = getLightSprite('#ff7a3d');
    ctx.drawImage(sp, b.x - 68, b.y - 68, 136, 136);
  }
  ctx.restore();
}

function drawTexts() {
  const inSafe = isPlayerInSafeMap();
  const v = viewBounds(60);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!!t.safe !== inSafe) continue;
    if (t.x < v.l || t.x > v.r || t.y < v.t || t.y > v.b) continue;
    const age = t.maxLife - t.life;
    const pop = age < 0.14 ? 0.5 + 0.5 * easeOutBack(age / 0.14) : 1;
    const a = t.life < t.maxLife * 0.35 ? easeOutCubic(t.life / (t.maxLife * 0.35)) : 1;
    ctx.save();
    ctx.translate(t.x, t.y);
    if (pop !== 1) ctx.scale(pop, pop);
    ctx.globalAlpha = a;
    ctx.font = `800 ${t.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillText(t.text, 1, 1.5);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/* ---------------------------------------------------------
   Storm Wall (with High/Ultra Lightning Perimeter Arcs)
   --------------------------------------------------------- */
function drawZoneOverlay() {
  if (!zone) return;
  const zc = worldToScreen(zone.x, zone.y);
  const zr = zone.r * cam.zoom;
  const settings = getGraphicsSettings();

  if (zone.state === 'waiting' && zone.nextR > 0) {
    const nx = worldToScreen(zone.nextX, zone.nextY);
    const nr = zone.nextR * cam.zoom;
    if (nx.x + nr > -60 && nx.x - nr < W + 60 &&
        nx.y + nr > -60 && nx.y - nr < H + 60) {
      ctx.save();
      ctx.setLineDash([10, 14]);
      ctx.lineDashOffset = -game.time * 18;
      ctx.strokeStyle = 'rgba(226,214,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(nx.x, nx.y, Math.max(0.1, nr), 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      if (settings.fx >= 1) {
        ctx.font = '700 9px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(226,214,255,0.45)';
        ctx.fillText('NEXT ZONE', nx.x, nx.y - nr - 8);
      }
      ctx.restore();
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(zc.x, zc.y, Math.max(0.1, zr), 0, TAU, true);
  ctx.fillStyle = 'rgba(128,62,220,0.18)';
  ctx.fill('evenodd');
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(zc.x, zc.y, Math.max(0.1, zr), 0, TAU);
  ctx.strokeStyle = zone.state === 'shrinking' ? 'rgba(214,170,255,0.2)' : 'rgba(180,120,255,0.12)';
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.strokeStyle = zone.state === 'shrinking' ? 'rgba(235,210,255,0.95)' : 'rgba(185,125,255,0.72)';
  ctx.lineWidth = zone.state === 'shrinking' ? 3 : 2;
  ctx.stroke();

  if (settings.fx >= 1) {
    ctx.setLineDash([9, 15]);
    ctx.lineDashOffset = -game.time * 24;
    ctx.strokeStyle = 'rgba(239,221,255,0.72)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(zc.x, zc.y, Math.max(0.1, zr - 7), 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Crackling storm energy lightning arcs along visible perimeter (High/Ultra)
  if (settings.stormLightning && zr > 24 && !REDUCED_MOTION) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(230,195,255,0.6)';
    ctx.lineWidth = 1.5;
    const arcs = 8;
    for (let i = 0; i < arcs; i++) {
      const a0 = game.time * 0.45 + (i / arcs) * TAU;
      const sx = zc.x + Math.cos(a0) * zr;
      const sy = zc.y + Math.sin(a0) * zr;
      if (sx < -120 || sx > W + 120 || sy < -120 || sy > H + 120) continue;
      ctx.beginPath();
      for (let s = 0; s <= 4; s++) {
        const a = a0 + s * 0.045;
        const jit = s === 0 || s === 4 ? 0 : Math.sin(game.time * 28 + i * 7 + s * 3) * 8;
        const px = zc.x + Math.cos(a) * (zr + jit);
        const py = zc.y + Math.sin(a) * (zr + jit);
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  // Safe-zone guide chevrons when player is outside
  if (player && player.alive) {
    const dx = zone.x - player.x;
    const dy = zone.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > zone.r) {
      const ps = worldToScreen(player.x, player.y);
      const a = Math.atan2(dy, dx);
      const scroll = (game.time * 34) % 14;
      ctx.save();
      ctx.translate(ps.x, ps.y);
      ctx.rotate(a);
      ctx.strokeStyle = '#e6c6ff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const off = (player.r + 24) * cam.zoom + i * 13 + scroll;
        ctx.globalAlpha = 0.6 - i * 0.14;
        ctx.beginPath();
        ctx.moveTo(off - 7, -7); ctx.lineTo(off, 0); ctx.lineTo(off - 7, 7);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

/* Off-screen Supply Drop & Danger Grenade edge pointers */
function drawOffscreenIndicators() {
  if (!player || !player.alive || player.inSafeZone || game.state !== 'playing') return;
  const pad = 42;
  ctx.save();
  // Active Supply Drops
  for (let i = 0; i < pickups.length; i++) {
    const p = pickups[i];
    if (!p.supply || p.kind !== 'weapon') continue;
    const s = worldToScreen(p.x, p.y);
    if (s.x > 20 && s.x < W - 20 && s.y > 20 && s.y < H - 20) continue;
    const a = Math.atan2(s.y - H / 2, s.x - W / 2);
    const ix = clamp(s.x, pad, W - pad);
    const iy = clamp(s.y, pad + 40, H - pad);
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd166';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(9, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Live Threatening Grenades
  for (let i = 0; i < projectiles.length; i++) {
    const pr = projectiles[i];
    if (pr.kind === 'smoke') continue;
    if (distance(player.x, player.y, pr.x, pr.y) > 460) continue;
    const s = worldToScreen(pr.x, pr.y);
    const ix = clamp(s.x, pad, W - pad);
    const iy = clamp(s.y, pad + 30, H - pad);
    const blink = 0.55 + 0.45 * Math.sin(game.time * 24);
    ctx.globalAlpha = blink;
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(ix, iy - 16, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#090c10';
    ctx.font = '900 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', ix, iy - 15.5);
  }
  ctx.restore();
}

let auraFlashGrad = null;
let auraFlashKey = '';

function drawAuraFlash() {
  const a = game.auraFlash || 0;
  if (a <= 0) return;
  const key = W + 'x' + H;
  if (!auraFlashGrad || auraFlashKey !== key) {
    auraFlashGrad = ctx.createRadialGradient(
      W / 2, H / 2, Math.min(W, H) * 0.22,
      W / 2, H / 2, Math.max(W, H) * 0.72);
    auraFlashGrad.addColorStop(0, 'rgba(255,209,102,0)');
    auraFlashGrad.addColorStop(1, 'rgba(255,190,80,1)');
    auraFlashKey = key;
  }
  ctx.save();
  ctx.globalAlpha = 0.24 * a;
  ctx.fillStyle = auraFlashGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

let lockTargetCache = null;
let lockTargetAt = -1;

function findLockTarget() {
  if (!player || !player.alive) return null;
  const inSafe = isPlayerInSafeMap();
  if (lockTargetCache && lockTargetCache.alive && !!lockTargetCache.isDummy === inSafe && game.time - lockTargetAt < 0.08) {
    return lockTargetCache;
  }
  const pool = inSafe ? safeZoneDummies : bots;
  let best = null;
  let bestDist = Infinity;
  for (const b of pool) {
    if (!b.alive) continue;
    const d = distance(player.x, player.y, b.x, b.y);
    if (d > 950 || d >= bestDist) continue;
    const s = worldToScreen(b.x, b.y);
    if (s.x < -40 || s.x > W + 40 || s.y < -40 || s.y > H + 40) continue;
    if (Math.hypot(s.x - mouse.x, s.y - mouse.y) > 40) continue;
    if (!inSafe && !hasLOS(player.x, player.y, b.x, b.y)) continue;
    best = b;
    bestDist = d;
  }
  lockTargetCache = best;
  lockTargetAt = game.time;
  return best;
}

let _crosshairSpread = 10;
let _lockAnim = 0;
let _lastLockId = 0;
let _crosshairLastT = 0;

function drawCrosshair() {
  if (!player || !player.alive) return;
  if (game.state !== 'playing' && game.state !== 'countdown') return;
  if (touchState && touchState.aimActive) return;
  if (isSafeZonePanelOpen() && UI.safeZonePanel) {
    const r = UI.safeZonePanel.getBoundingClientRect();
    if (mouse.x >= r.left && mouse.x <= r.right && mouse.y >= r.top && mouse.y <= r.bottom) return;
  }

  const dt = clamp(game.time - _crosshairLastT, 0.001, 0.05);
  _crosshairLastT = game.time;

  const x = mouse.x;
  const y = mouse.y;
  const curWeapon = WEAPONS[player.weapon];
  const speedRatio = clamp(Math.hypot(player.vx || 0, player.vy || 0) / Math.max(1, player.speed), 0, 1.2);
  const heatSpread = (player.heat || 0) * (curWeapon.heatSpread || 0);
  const targetSpread = clamp(
    8 + (curWeapon.spread + (player.bloom || 0) + heatSpread) * 62 + speedRatio * 4,
    8, 24
  );
  _crosshairSpread = damp(_crosshairSpread, targetSpread, 18, dt);
  const spread = _crosshairSpread;

  ctx.save();
  ctx.strokeStyle = player.jamT > 0 ? '#5ee7ff'
    : curWeapon.explosive ? 'rgba(255,155,102,0.92)'
    : 'rgba(255,255,255,0.88)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 1.6, 0, TAU);
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i;
    const cx = Math.cos(a);
    const cy = Math.sin(a);
    ctx.moveTo(x + cx * spread, y + cy * spread);
    ctx.lineTo(x + cx * (spread + 5.5), y + cy * (spread + 5.5));
  }
  ctx.stroke();

  // Bazooka blast-bracket reticle ring
  if (curWeapon.explosive && !player.reloading) {
    ctx.strokeStyle = 'rgba(255,107,53,0.42)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(x, y, spread + 8, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Minigun rotary spin-up & thermal heat arc around crosshair
  if (curWeapon.spinUp && ((player.spin || 0) > 0.02 || (player.heat || 0) > 0.05)) {
    const sp = clamp(player.spin || 0, 0, 1);
    const ht = clamp(player.heat || 0, 0, 1);
    ctx.strokeStyle = ht > 0.6 ? '#ff5a3c' : (sp >= 0.99 ? '#ffd166' : '#5ee7ff');
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, 25, -Math.PI * 0.75, -Math.PI * 0.75 + Math.PI * 1.5 * Math.max(sp, ht * 0.5));
    ctx.stroke();
  }

  if (player.dashCd > 0 && getGraphicsSettings().fx >= 1) {
    const dp = clamp(1 - player.dashCd / (DASH_COOLDOWN * (player.dashCdMul || 1)), 0, 1);
    ctx.strokeStyle = 'rgba(94,231,255,0.65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, 22, Math.PI * 0.25, Math.PI * 0.25 + Math.PI * 0.5 * dp);
    ctx.stroke();
  }

  const target = findLockTarget();
  if (target) {
    if (target.id !== _lastLockId) { _lastLockId = target.id; _lockAnim = 0; }
    _lockAnim = clamp(_lockAnim + dt * 7.5, 0, 1);
    const lockEase = easeOutBack(_lockAnim);
    const s = worldToScreen(target.x, target.y);
    const rad = Math.max(16, target.r * cam.zoom + 10) + (1 - lockEase) * 14;
    const arm = 8;
    ctx.globalAlpha = clamp(_lockAnim * 1.4, 0, 0.92);
    ctx.strokeStyle = mouse.down ? '#ff8a4c' : '#ff6675';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = s.x + sx * rad;
      const cy = s.y + sy * rad;
      ctx.moveTo(cx, cy - sy * arm); ctx.lineTo(cx, cy); ctx.lineTo(cx - sx * arm, cy);
    }
    ctx.stroke();
    ctx.font = '700 8px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(target.elite ? 'ELITE' : 'LOCK', s.x, s.y - rad - 8);
    ctx.globalAlpha = 1;
  } else {
    _lastLockId = 0;
    _lockAnim = 0;
  }

  if (player.reloading) {
    const t = 1 - player.reloadT / Math.max(0.001, player.reloadTotal);
    ctx.strokeStyle = 'rgba(255,179,71,0.92)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, 17, -Math.PI / 2, -Math.PI / 2 + TAU * t);
    ctx.stroke();
  }

  if (game.hitmarker > 0) {
    const prog = 1 - clamp(game.hitmarker / (game.hitmarkerTotal || 0.14), 0, 1);
    const a = 1 - prog * prog;
    const expand = easeOutCubic(prog) * (game.hitmarkerKill ? 5 : 3);
    ctx.globalAlpha = a;
    ctx.strokeStyle = game.hitmarkerKill ? '#ff5a5f' : game.hitmarkerCrit ? '#ffd166' : '#ffffff';
    ctx.lineWidth = game.hitmarkerKill || game.hitmarkerCrit ? 2.4 : 2;
    const inner = (game.hitmarkerCrit ? 5 : 6) + expand * 0.4;
    const outer = (game.hitmarkerKill ? 14 : game.hitmarkerCrit ? 13 : 12) + expand;
    ctx.beginPath();
    for (const [sx, sy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      ctx.moveTo(x + sx * inner, y + sy * inner);
      ctx.lineTo(x + sx * outer, y + sy * outer);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawDamageIndicator() {
  if (!player || game.damageIndicator <= 0) return;
  const alpha = clamp(game.damageIndicator, 0, 1);
  const radius = player.r + 18 + (1 - alpha) * 7;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.globalAlpha = alpha * 0.78;
  ctx.strokeStyle = '#ff6675';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, radius, game.damageAngle - 0.42, game.damageAngle + 0.42);
  ctx.stroke();
  ctx.restore();
}

/* ---------------------------------------------------------
   Dedicated Separate Safe Zone Map (Armory Bay, Firing Range & Portal)
   --------------------------------------------------------- */
let safeZonePanelOpen = false;

function isSafeZonePanelOpen() {
  return !!(safeZonePanelOpen && isPlayerInSafeMap());
}

function setSafeZonePanelOpen(open) {
  safeZonePanelOpen = !!open;
  if (typeof syncSafeZonePanelUI === 'function') syncSafeZonePanelUI();
}

function toggleSafeZonePanel() {
  if (!isPlayerInSafeMap()) return;
  safeZonePanelOpen = !safeZonePanelOpen;
  sfx('ui');
  if (typeof syncSafeZonePanelUI === 'function') syncSafeZonePanelUI();
}

function drawSafeZoneMap() {
  if (!isPlayerInSafeMap()) return;
  const t = game.time;
  const mw = SAFE_MAP_W;
  const mh = SAFE_MAP_H;

  ctx.save();
  // Deep orbital void grid surrounding the standalone sanctuary facility
  const v = viewBounds(80);
  ctx.fillStyle = '#04080e';
  ctx.fillRect(v.l, v.t, v.r - v.l, v.b - v.t);
  ctx.strokeStyle = 'rgba(94,231,255,0.032)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const gx0 = Math.floor(v.l / 120) * 120;
  const gy0 = Math.floor(v.t / 120) * 120;
  for (let gx = gx0; gx <= v.r; gx += 120) { ctx.moveTo(gx, v.t); ctx.lineTo(gx, v.b); }
  for (let gy = gy0; gy <= v.b; gy += 120) { ctx.moveTo(v.l, gy); ctx.lineTo(v.r, gy); }
  ctx.stroke();

  // Facility outer drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  rr(ctx, 20, 26, mw - 24, mh - 24, 18);
  ctx.fill();

  // Main sanctuary armored hangar deck
  const deckGrad = ctx.createRadialGradient(mw * 0.42, mh * 0.48, 80, mw * 0.5, mh * 0.5, mw * 0.68);
  deckGrad.addColorStop(0, '#0f1e2c');
  deckGrad.addColorStop(0.6, '#0a1520');
  deckGrad.addColorStop(1, '#070e17');
  ctx.fillStyle = deckGrad;
  rr(ctx, 22, 22, mw - 44, mh - 44, 16);
  ctx.fill();

  // Subtle architectural deck grid
  ctx.strokeStyle = 'rgba(94,231,255,0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = 80; gx < mw - 24; gx += 60) {
    ctx.moveTo(gx, 28); ctx.lineTo(gx, mh - 28);
  }
  for (let gy = 80; gy < mh - 24; gy += 60) {
    ctx.moveTo(28, gy); ctx.lineTo(mw - 28, gy);
  }
  ctx.stroke();

  // --- BAY 1: ARMORY DECK (Top-Left, Weapons) ---
  ctx.fillStyle = 'rgba(7,16,24,0.62)';
  rr(ctx, 68, 122, 782, 260, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(94,231,255,0.18)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // --- BAY 2: TACTICAL GEAR & FINISH FORGE (Mid-Left) ---
  ctx.fillStyle = 'rgba(7,16,24,0.56)';
  rr(ctx, 68, 396, 782, 112, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(94,231,255,0.15)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // --- BAY 3: DEPLOYMENT STAGING DECK (Bottom-Left) ---
  ctx.fillStyle = 'rgba(9,19,29,0.58)';
  rr(ctx, 68, 522, 782, 240, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,179,71,0.18)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Spawn pad circle
  ctx.save();
  ctx.strokeStyle = 'rgba(94,231,255,0.22)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.arc(SAFE_ZONE_SPAWN.x, SAFE_ZONE_SPAWN.y, 40, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = '800 8px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(94,231,255,0.45)';
  ctx.fillText('SPAWN PAD', SAFE_ZONE_SPAWN.x, SAFE_ZONE_SPAWN.y + 46);
  ctx.restore();

  // Animated runway chevrons leading from Spawn Pad to Combat Teleport Portal
  ctx.save();
  const scroll = (t * 36) % 24;
  ctx.strokeStyle = 'rgba(255,209,102,0.42)';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let k = 0; k < 7; k++) {
    const cx = SAFE_ZONE_SPAWN.x + 80 + k * 24 + scroll;
    if (cx > SAFE_ZONE_PORTAL.x - 62) continue;
    const cy = lerp(SAFE_ZONE_SPAWN.y, SAFE_ZONE_PORTAL.y, (cx - SAFE_ZONE_SPAWN.x) / (SAFE_ZONE_PORTAL.x - SAFE_ZONE_SPAWN.x));
    ctx.globalAlpha = 0.25 + 0.45 * Math.sin(((cx - SAFE_ZONE_SPAWN.x) / 180) * Math.PI);
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 8);
    ctx.lineTo(cx + 4, cy);
    ctx.lineTo(cx - 5, cy + 8);
    ctx.stroke();
  }
  ctx.restore();

  // --- BAY 4: BALLISTIC FIRING RANGE (Right Half) ---
  ctx.fillStyle = 'rgba(6,12,18,0.74)';
  rr(ctx, 886, 122, 446, 640, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,159,69,0.28)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Firing line caution stripes & range distance lines
  ctx.strokeStyle = 'rgba(255,159,69,0.32)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(886, 134); ctx.lineTo(886, 750);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(255,179,71,0.09)';
  ctx.lineWidth = 1.2;
  ctx.font = '800 9px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,179,71,0.34)';
  for (const [rx, label] of [[990, '100M'], [1115, '200M'], [1240, '300M']]) {
    ctx.beginPath();
    ctx.moveTo(rx, 152); ctx.lineTo(rx, 748);
    ctx.stroke();
    ctx.fillText(label, rx, 134);
  }
  // Recessed lane guides behind each target dummy
  ctx.strokeStyle = 'rgba(94,231,255,0.08)';
  ctx.lineWidth = 1;
  for (const ly of [230, 428, 626]) {
    ctx.beginPath();
    ctx.moveTo(902, ly); ctx.lineTo(1312, ly);
    ctx.stroke();
  }

  // Crisp facility floor headers
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '900 13.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(94,231,255,0.72)';
  ctx.fillText('SAFE ZONE FACILITY · WEAPON ARMORY', 70, 62);
  ctx.font = '700 9px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(165,204,220,0.52)';
  ctx.fillText('WALK TO PEDESTAL [E] · QUICK ARMORY [B] · ENTER PORTAL OR PRESS [T] TO DEPLOY', 70, 82);

  ctx.font = '800 9px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(94,231,255,0.48)';
  ctx.fillText('ALL 12 WEAPONS · TIER 1 → TIER 5', 84, 134);
  ctx.fillText('TACTICAL GADGETS & WEAPON FINISH FORGE', 84, 405);
  ctx.fillStyle = 'rgba(255,179,71,0.56)';
  ctx.fillText('DEPLOYMENT DECK', 84, 534);

  ctx.textAlign = 'center';
  ctx.font = '900 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,179,71,0.72)';
  ctx.fillText('BALLISTIC FIRING RANGE', 1109, 64);
  ctx.font = '700 8.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(170,204,218,0.44)';
  ctx.fillText('LIVE DAMAGE · CRIT · BLAST & EMP TARGETS', 1109, 82);

  // Glowing perimeter sanctuary forcefield walls
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.8);
  ctx.strokeStyle = `rgba(94,231,255,${0.16 + pulse * 0.1})`;
  ctx.lineWidth = 10;
  rr(ctx, 22, 22, mw - 44, mh - 44, 16);
  ctx.stroke();
  ctx.strokeStyle = '#5ee7ff';
  ctx.lineWidth = 2.4;
  rr(ctx, 22, 22, mw - 44, mh - 44, 16);
  ctx.stroke();
  ctx.setLineDash([16, 16]);
  ctx.lineDashOffset = -t * 24;
  ctx.strokeStyle = 'rgba(200,248,255,0.58)';
  ctx.lineWidth = 1.1;
  rr(ctx, 28, 28, mw - 56, mh - 56, 12);
  ctx.stroke();
  ctx.setLineDash([]);

  // Interactive Weapon, Gadget & Skin Forge Pedestals
  for (let i = 0; i < safeZoneStations.length; i++) {
    const st = safeZoneStations[i];
    const near = game.nearStation === st;
    const isWeapon = st.kind === 'weapon';
    const isGadget = st.kind === 'gadget';
    const w = isWeapon ? WEAPONS[st.weapon] : null;
    const g = isGadget ? GADGETS[st.gadget] : null;
    const col = isWeapon ? w.color : isGadget ? g.color : skinInfo(player ? player.skin : 'gold').color;
    const activeEquip = player && ((isWeapon && player.weapon === st.weapon) || (isGadget && player.gadget === st.gadget));

    ctx.save();
    ctx.translate(st.x, st.y);
    if (near || activeEquip) {
      ctx.globalAlpha = near ? 0.24 : 0.14;
      ctx.fillStyle = near ? '#5ee7ff' : '#ffd166';
      ctx.beginPath();
      ctx.arc(0, 0, st.r + 11, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = near ? 'rgba(20,44,60,0.96)' : 'rgba(9,18,26,0.92)';
    ctx.beginPath();
    ctx.arc(0, 0, st.r + (near ? 3 : 0), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = near ? '#ffffff' : activeEquip ? '#ffd166' : col;
    ctx.lineWidth = near || activeEquip ? 2.4 : 1.6;
    ctx.stroke();

    if (isWeapon) {
      const L = w.len + 20;
      const sc = Math.min(0.46, 27 / L);
      ctx.save();
      ctx.rotate(-0.28);
      ctx.scale(sc, sc);
      ctx.translate(-L / 2, 0);
      drawGunSprite(ctx, w, col, w.tier >= 5);
      ctx.restore();
      ctx.font = '800 9px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = near ? '#ffffff' : col;
      ctx.fillText(w.name, 0, st.r + 6);
      ctx.font = '700 7.5px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(160,196,210,0.65)';
      ctx.fillText('T' + w.tier, 0, st.r + 18);
    } else if (isGadget) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 1, 6.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#081016';
      ctx.fillRect(-3, -8.5, 6, 3.5);
      ctx.font = '800 9px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = near ? '#ffffff' : col;
      ctx.fillText(g.name, 0, st.r + 6);
    } else {
      const sk = skinInfo(player ? player.skin : 'factory');
      ctx.fillStyle = sk.color;
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(9, 0); ctx.lineTo(0, 10); ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.font = '800 9px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = near ? '#ffffff' : sk.color;
      ctx.fillText('SKIN: ' + sk.name, 0, st.r + 6);
    }
    ctx.restore();
  }

  // Glowing Combat Deployment Portal
  const pt = SAFE_ZONE_PORTAL;
  ctx.save();
  ctx.translate(pt.x, pt.y);
  const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, pt.r + 22);
  grad.addColorStop(0, 'rgba(94,231,255,0.48)');
  grad.addColorStop(0.58, 'rgba(255,179,71,0.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, pt.r + 22, 0, TAU); ctx.fill();

  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, pt.r, 0, TAU); ctx.stroke();
  ctx.save();
  ctx.rotate(t * 1.4);
  ctx.setLineDash([13, 10]);
  ctx.strokeStyle = '#5ee7ff';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(0, 0, pt.r - 10, 0, TAU); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.rotate(-t * 2.1);
  ctx.setLineDash([6, 8]);
  ctx.strokeStyle = '#ffe5a3';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0, 0, pt.r - 20, 0, TAU); ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 10.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('COMBAT TP', 0, -5);
  ctx.font = '800 8px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffd166';
  ctx.fillText('WALK IN · [T]', 0, 9);
  ctx.restore();

  // Holographic Firing-Range Target Dummies
  for (let i = 0; i < safeZoneDummies.length; i++) {
    const dm = safeZoneDummies[i];
    ctx.save();
    ctx.translate(dm.x + (dm.flinchX || 0), dm.y + (dm.flinchY || 0));
    if (!dm.alive) {
      const prog = 1 - clamp(dm.respawnT / 0.9, 0, 1);
      ctx.strokeStyle = 'rgba(94,231,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, dm.r, -Math.PI / 2, -Math.PI / 2 + TAU * prog);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.44)';
    ctx.beginPath(); ctx.ellipse(2, 9, dm.r, dm.r * 0.55, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = dm.hitFlash > 0 ? '#ffffff' : (dm.maxArmor >= 100 ? '#3a224d' : dm.maxArmor > 0 ? '#1b475c' : '#4a252a');
    ctx.beginPath(); ctx.arc(0, 0, dm.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = dm.maxArmor >= 100 ? '#b06cff' : dm.maxArmor > 0 ? '#67d9ff' : '#ff7a59';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    // Bullseye target rings
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, dm.r * 0.55, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill();
    // HP & Armor bars
    const bw = 54;
    const by = -dm.r - 16;
    ctx.fillStyle = 'rgba(2,6,10,0.85)';
    ctx.fillRect(-bw / 2, by, bw, 4.5);
    const tr = clamp((dm.hpTrail != null ? dm.hpTrail : dm.hp) / dm.maxHp, 0, 1);
    if (tr > dm.hp / dm.maxHp) {
      ctx.fillStyle = 'rgba(255,235,215,0.75)';
      ctx.fillRect(-bw / 2, by, bw * tr, 4.5);
    }
    ctx.fillStyle = '#ff6b57';
    ctx.fillRect(-bw / 2, by, bw * clamp(dm.hp / dm.maxHp, 0, 1), 4.5);
    if (dm.armor > 0 && dm.maxArmor > 0) {
      ctx.fillStyle = '#67d9ff';
      ctx.fillRect(-bw / 2, by - 3.5, bw * clamp(dm.armor / dm.maxArmor, 0, 1), 2.5);
    }
    ctx.font = '700 8.5px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(225,245,255,0.88)';
    ctx.fillText(dm.name, 0, by - (dm.armor > 0 ? 5.5 : 3));
    ctx.restore();
  }
  ctx.restore();
}

function initSafeZonePanelUI() {
  for (const slotBtn of document.querySelectorAll('[data-sz-slot]')) {
    slotBtn.addEventListener('click', () => {
      const s = Number(slotBtn.dataset.szSlot);
      if (s !== 0 && s !== 1) return;
      safeZoneTargetSlot = s;
      if (player && player.slots[s] && typeof switchWeapon === 'function') {
        switchWeapon(s);
      } else {
        sfx('ui');
      }
      syncSafeZonePanelUI();
    });
  }
  if (UI.safeZoneWeapons) {
    let html = '';
    for (const key in WEAPONS) {
      const w = WEAPONS[key];
      html += `<button type="button" class="szBtn" data-sz-weapon="${key}" style="--wc:${w.color}">` +
        `<b>${w.name}</b><small>T${w.tier}</small></button>`;
    }
    UI.safeZoneWeapons.innerHTML = html;
    UI.safeZoneWeapons.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sz-weapon]');
      if (!btn || typeof selectSafeZoneWeapon !== 'function') return;
      selectSafeZoneWeapon(btn.dataset.szWeapon);
    });
  }
  if (UI.safeZoneSkins) {
    let html = '';
    for (const key in SKINS) {
      const sk = SKINS[key];
      html += `<button type="button" class="szChip" data-sz-skin="${key}" style="--sc:${sk.color}">` +
        `${sk.name}${sk.bonus > 0 ? ' +' + Math.round(sk.bonus * 100) + '%' : ''}</button>`;
    }
    UI.safeZoneSkins.innerHTML = html;
    UI.safeZoneSkins.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sz-skin]');
      if (!btn || typeof selectSafeZoneSkin !== 'function') return;
      selectSafeZoneSkin(btn.dataset.szSkin);
    });
  }
  if (UI.safeZoneGadgets) {
    let html = '';
    for (const key in GADGETS) {
      const g = GADGETS[key];
      html += `<button type="button" class="szChip" data-sz-gadget="${key}" style="--sc:${g.color}">${g.name}</button>`;
    }
    UI.safeZoneGadgets.innerHTML = html;
    UI.safeZoneGadgets.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sz-gadget]');
      if (!btn || typeof selectSafeZoneGadget !== 'function') return;
      selectSafeZoneGadget(btn.dataset.szGadget);
    });
  }
}

function syncSafeZonePanelUI() {
  const practiceMode = isPracticeMode();
  const activePlay = practiceMode && game.state === 'playing' && player && player.alive;
  const inSafe = !!(activePlay && player.inSafeZone);
  const drawerOpen = !!(inSafe && safeZonePanelOpen);

  if (UI.safeZonePanel) UI.safeZonePanel.classList.toggle('hidden', !drawerOpen);
  if (UI.safeZoneControls) UI.safeZoneControls.classList.toggle('hidden', !inSafe);
  if (UI.practiceBar) UI.practiceBar.classList.toggle('hidden', !(activePlay && !inSafe));
  if (UI.toggleArmoryBtn) UI.toggleArmoryBtn.classList.toggle('active', drawerOpen);

  // Clean non-obstructive HUD visibility by mode & map
  if (UI.zonePill) UI.zonePill.classList.toggle('hidden', practiceMode);
  if (UI.supplyPill) UI.supplyPill.classList.toggle('hidden', practiceMode);
  if (UI.safePill) UI.safePill.classList.toggle('hidden', !inSafe);
  if (UI.alivePill) UI.alivePill.classList.toggle('hidden', inSafe);
  if (UI.minimapWrap) UI.minimapWrap.classList.toggle('hidden', inSafe);
  if (UI.feed) UI.feed.classList.toggle('hidden', inSafe);

  if (UI.safeTouch) {
    UI.safeTouch.classList.toggle('hidden', !activePlay);
    if (activePlay) UI.safeTouch.textContent = inSafe ? 'TP' : 'SAFE';
  }
  if (UI.armoryTouch) {
    UI.armoryTouch.classList.toggle('hidden', !inSafe);
    UI.armoryTouch.classList.toggle('active', drawerOpen);
  }
  if (!inSafe || !player) return;

  const activeTarget = (safeZoneTargetSlot === 0 || safeZoneTargetSlot === 1) ? safeZoneTargetSlot : player.activeSlot;
  for (const slotBtn of document.querySelectorAll('[data-sz-slot]')) {
    const s = Number(slotBtn.dataset.szSlot);
    slotBtn.classList.toggle('active', s === activeTarget);
  }
  if (UI.safeZoneWeapons) {
    for (const btn of UI.safeZoneWeapons.querySelectorAll('[data-sz-weapon]')) {
      btn.classList.toggle('active', btn.dataset.szWeapon === player.weapon);
    }
  }
  if (UI.safeZoneSkins) {
    for (const btn of UI.safeZoneSkins.querySelectorAll('[data-sz-skin]')) {
      btn.classList.toggle('active', btn.dataset.szSkin === player.skin);
    }
  }
  if (UI.safeZoneGadgets) {
    for (const btn of UI.safeZoneGadgets.querySelectorAll('[data-sz-gadget]')) {
      btn.classList.toggle('active', btn.dataset.szGadget === player.gadget);
    }
  }
}

/* ---------------------------------------------------------
   Main Render Pipeline
   --------------------------------------------------------- */
function render() {
  const inSafeMap = isPlayerInSafeMap();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = inSafeMap ? '#04080e' : '#05080c';
  ctx.fillRect(0, 0, W, H);

  // Smooth harmonic multi-frequency trauma shake + directional recoil kick (zero jagged noise).
  const shake = REDUCED_MOTION ? 0 : game.shake;
  const st = game.time;
  const shakeX = shake > 0.05
    ? (Math.sin(st * 53) * 0.68 + Math.sin(st * 91 + 1.3) * 0.32) * shake : 0;
  const shakeY = shake > 0.05
    ? (Math.cos(st * 47 + 0.7) * 0.68 + Math.sin(st * 83 + 2.1) * 0.32) * shake : 0;
  const kickX = REDUCED_MOTION ? 0 : (cam.kickX || 0);
  const kickY = REDUCED_MOTION ? 0 : (cam.kickY || 0);

  ctx.save();
  ctx.translate(W / 2 + shakeX + kickX, H / 2 + shakeY + kickY);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  if (inSafeMap) {
    drawSafeZoneMap();
    drawDecals();
    drawAimLine();
    drawEntities();
    drawBullets();
    drawBeams();
    drawProjectiles();
    drawParticles();
    drawSmokes();
    drawDynamicLights();
    drawTexts();
  } else {
    drawGround();
    drawDecals();
    drawBoostPads();
    drawPickups();
    drawObstaclesAndBarrels();
    drawAimLine();
    drawEntities();
    drawDamageIndicator();
    drawBullets();
    drawBeams();
    drawProjectiles();
    drawParticles();
    drawSmokes();
    drawDynamicLights();
    drawTexts();
  }

  ctx.restore();

  if (!inSafeMap && !isPracticeMode()) drawZoneOverlay();
  if (!inSafeMap) drawOffscreenIndicators();
  drawAuraFlash();
  drawCrosshair();
  updateHUD();
  if (!inSafeMap) drawMinimap();
}

/* ---------------------------------------------------------
   Zero-Thrash Cached HUD
   --------------------------------------------------------- */
const hudCache = {
  alive: -1, kills: -1, aura: -1, hpW: -1, hpTrailW: -1, hpT: -1, arW: -1, arT: -1,
  weapon: '', skin: '', mag: -1, reload: null, reloadW: -1,
  slot0: '', slot1: '', activeSlot: -1, gadget: '',
  pickupKey: '',
  dash: '', dashReady: null, dashProgress: null, hpCritical: null, ammoLow: null,
  zone: '', zoneClosing: null, warn: null, warnAngle: null, warnDist: '', storm: -1, hurt: -1,
  supply: '', operator: '', buff: '', streak: '',
};

function resetHUDCache() {
  for (const k in hudCache) {
    hudCache[k] = typeof hudCache[k] === 'number' ? -1 : typeof hudCache[k] === 'string' ? '' : null;
  }
  lockTargetCache = null;
  lockTargetAt = -1;
  _crosshairLastT = 0;
  _lockAnim = 0;
  _lastLockId = 0;
}

function updateHUD() {
  if (!player) return;

  const alive = aliveCount();
  if (alive !== hudCache.alive) {
    hudCache.alive = alive;
    UI.alive.textContent = String(alive);
    const pill = UI.alive.parentElement;
    pill.classList.remove('flash'); void pill.offsetWidth; pill.classList.add('flash');
  }
  const kills = player.kills || 0;
  if (kills !== hudCache.kills) {
    hudCache.kills = kills;
    UI.kills.textContent = String(kills);
    const pill = UI.kills.parentElement;
    pill.classList.remove('flash'); void pill.offsetWidth; pill.classList.add('flash');
  }
  if (UI.operatorName) {
    const operator = OPERATOR_PRESETS[player.operatorId] || OPERATOR_PRESETS.cyan;
    if (hudCache.operator !== player.operatorId) {
      hudCache.operator = player.operatorId;
      UI.operatorName.textContent = operator.name;
      UI.operatorName.style.color = operator.auraColor;
      UI.operatorName.style.textShadow = '0 0 12px ' + operator.auraColor + '88';
      if (UI.hudPortrait) drawOperatorPortrait(UI.hudPortrait, player.operatorId);
    }
  }

  let buff = 'COMBAT READY';
  let buffTone = '';
  if (player.inSafeZone) {
    buff = 'SAFE ZONE · INVULNERABLE';
    buffTone = 'cyan';
  } else if (player.jamT > 0) {
    buff = 'EMP JAMMED';
    buffTone = 'purple';
  } else if (game.invuln > 0) {
    buff = 'DASH · EVADE';
    buffTone = 'cyan';
  } else if (game.killBoostT > 0) {
    buff = 'STREAK +' + Math.round(((game.killBoost || 1) - 1) * 100) + '% DMG';
    buffTone = 'gold';
  } else if (player.speedBoostT > 0) {
    buff = 'SPEED BOOST';
    buffTone = 'cyan';
  } else if (player.hp < player.maxHp * (player.regenCap || 0.7) && game.regenDelay <= 0) {
    buff = 'REGENERATING';
    buffTone = 'green';
  } else if (player.weapon === 'minigun' && !player.reloading) {
    if ((player.heat || 0) > 0.62) {
      buff = 'ROTARY HOT';
      buffTone = 'red';
    } else if ((player.spin || 0) > 0.06 && (player.spin || 0) < 0.99) {
      buff = 'SPINNING UP ' + Math.round(player.spin * 100) + '%';
      buffTone = 'amber';
    } else if ((player.spin || 0) >= 0.99) {
      buff = '6-BARREL ACTIVE';
      buffTone = 'gold';
    }
  } else if (player.weapon === 'bazooka' && !player.reloading) {
    buff = 'ORDNANCE ARMED';
    buffTone = 'amber';
  }
  if (buff !== hudCache.buff && UI.hudBuff) {
    hudCache.buff = buff;
    UI.hudBuff.textContent = buff;
    UI.hudBuff.className = buffTone;
  }

  const aura = player.aura || 0;
  if (aura !== hudCache.aura) {
    hudCache.aura = aura;
    UI.aura.textContent = aura.toLocaleString('en-US');
  }

  const streak = player.killStreak || 0;
  const streakShow = streak >= 2 && player.streakT > 0;
  const streakKey = streakShow ? String(streak) : '';
  if (streakKey !== hudCache.streak && UI.streakBanner && UI.streakCount) {
    hudCache.streak = streakKey;
    if (streakShow) UI.streakCount.textContent = streakKey;
    UI.streakBanner.classList.toggle('show', streakShow);
  }

  const hpPct = Math.round(clamp(player.hp / player.maxHp, 0, 1) * 1000) / 10;
  if (hpPct !== hudCache.hpW) {
    hudCache.hpW = hpPct;
    UI.hpFill.style.width = hpPct + '%';
  }
  const trailPct = Math.round(clamp((player.hpTrail != null ? player.hpTrail : player.hp) / player.maxHp, 0, 1) * 1000) / 10;
  if (trailPct !== hudCache.hpTrailW && UI.hpTrail) {
    hudCache.hpTrailW = trailPct;
    UI.hpTrail.style.width = trailPct + '%';
  }
  const hpTxt = Math.max(0, Math.ceil(player.hp));
  if (hpTxt !== hudCache.hpT) {
    hudCache.hpT = hpTxt;
    UI.hpText.textContent = String(hpTxt);
  }
  const hpCritical = hpPct <= 25;
  if (hpCritical !== hudCache.hpCritical) {
    hudCache.hpCritical = hpCritical;
    UI.hpFill.parentElement.classList.toggle('critical', hpCritical);
    UI.vignette.classList.toggle('low', hpCritical && player.alive);
  }

  const arPct = Math.round(clamp(player.armor / player.maxArmor, 0, 1) * 1000) / 10;
  if (arPct !== hudCache.arW) {
    hudCache.arW = arPct;
    UI.armorFill.style.width = arPct + '%';
  }
  const arTxt = Math.max(0, Math.ceil(player.armor));
  if (arTxt !== hudCache.arT) {
    hudCache.arT = arTxt;
    UI.armorText.textContent = String(arTxt);
  }

  // Dual Weapon Slot Cards & Tactical Gadget Card
  if (player.slots && UI.slot0 && UI.slot1) {
    const s0 = player.slots[0];
    const s1 = player.slots[1];
    const k0 = s0 ? s0.weapon + '|' + s0.skin + '|' + (player.activeSlot === 0 ? player.mag : s0.mag) : 'empty';
    const k1 = s1 ? s1.weapon + '|' + s1.skin + '|' + (player.activeSlot === 1 ? player.mag : s1.mag) : 'empty';
    if (k0 !== hudCache.slot0) {
      hudCache.slot0 = k0;
      UI.slot0.classList.toggle('empty', !s0);
      if (s0) {
        const sk = skinInfo(s0.skin);
        UI.slot0Name.textContent = WEAPONS[s0.weapon].name;
        UI.slot0Name.style.color = sk.bonus > 0 ? sk.color : '#edf7fb';
        UI.slot0Mag.textContent = String(player.activeSlot === 0 ? player.mag : s0.mag);
      }
    }
    if (k1 !== hudCache.slot1) {
      hudCache.slot1 = k1;
      UI.slot1.classList.toggle('empty', !s1);
      if (s1) {
        const sk = skinInfo(s1.skin);
        UI.slot1Name.textContent = WEAPONS[s1.weapon].name;
        UI.slot1Name.style.color = sk.bonus > 0 ? sk.color : '#edf7fb';
        UI.slot1Mag.textContent = String(player.activeSlot === 1 ? player.mag : s1.mag);
      } else {
        UI.slot1Name.textContent = 'EMPTY';
        UI.slot1Name.style.color = '';
        UI.slot1Mag.textContent = '—';
      }
    }
    if (player.activeSlot !== hudCache.activeSlot) {
      hudCache.activeSlot = player.activeSlot;
      UI.slot0.classList.toggle('active', player.activeSlot === 0);
      UI.slot1.classList.toggle('active', player.activeSlot === 1);
    }
  }
  const gKey = (player.gadget || 'frag') + '|' + (player.gadgetCharges || 0);
  if (gKey !== hudCache.gadget && UI.gadgetSlot) {
    hudCache.gadget = gKey;
    const g = GADGETS[player.gadget] || GADGETS.frag;
    UI.gadgetName.textContent = g.name;
    UI.gadgetName.style.color = g.color;
    UI.gadgetCount.textContent = '×' + (player.gadgetCharges || 0);
    UI.gadgetSlot.classList.toggle('empty', (player.gadgetCharges || 0) <= 0);
    if (UI.gadgetTouch) UI.gadgetTouch.textContent = g.short + ' ' + (player.gadgetCharges || 0);
  }

  // World Pickup / Safe Zone Pedestal Prompt [E]
  const nsSt = player.inSafeZone ? game.nearStation : null;
  const np = nsSt ? null : game.nearPickup;
  const pKey = nsSt
    ? ('sz|' + nsSt.kind + '|' + (nsSt.weapon || nsSt.gadget || player.skin) + '|' + player.weapon)
    : np ? (np.kind + '|' + (np.weapon || np.gadget) + '|' + (np.skin || '') + '|' + player.weapon + '|' + player.skin) : '';
  if (pKey !== hudCache.pickupKey && UI.pickupPrompt) {
    hudCache.pickupKey = pKey;
    const showPrompt = !!(nsSt || np);
    UI.pickupPrompt.classList.toggle('hidden', !showPrompt);
    if (UI.interactTouch) UI.interactTouch.classList.toggle('hidden', !showPrompt);
    if (nsSt) {
      UI.pickupPrompt.classList.add('upgrade');
      if (nsSt.kind === 'weapon') {
        const nw = WEAPONS[nsSt.weapon];
        UI.pickupTitle.textContent = 'EQUIP ' + nw.name;
        UI.pickupTitle.style.color = nw.color;
        UI.pickupSub.textContent = nw.explosive
          ? `TIER ${nw.tier} · BLAST ${nw.splashDmg} (${nw.splashDmg + nw.dmg} HIT) · MAG ${nw.mag}`
          : nw.spinUp ? `TIER ${nw.tier} · ${nw.rpm} RPM · MAG ${nw.mag}`
          : `TIER ${nw.tier} · DMG ${Math.round(nw.dmg * nw.pellets)} · MAG ${nw.mag}`;
      } else if (nsSt.kind === 'gadget') {
        const g = GADGETS[nsSt.gadget];
        UI.pickupTitle.textContent = 'EQUIP ' + g.name + ' (×' + g.maxCharges + ')';
        UI.pickupTitle.style.color = g.color;
        UI.pickupSub.textContent = 'SAFE ZONE GADGET RACK';
      } else {
        const sk = skinInfo(player.skin);
        UI.pickupTitle.textContent = 'CYCLE SKIN · ' + sk.name;
        UI.pickupTitle.style.color = sk.color;
        UI.pickupSub.textContent = 'FACTORY / NEON / GOLD / INFERNO / VOID';
      }
    } else if (np) {
      if (np.kind === 'weapon') {
        const nw = WEAPONS[np.weapon];
        const ns = skinInfo(np.skin);
        const cw = WEAPONS[player.weapon];
        const cs = skinInfo(player.skin);
        const better = nw.tier > cw.tier || (nw.tier === cw.tier && ns.bonus > cs.bonus);
        const arrow = better ? '▲ ' : (nw.tier < cw.tier ? '▼ ' : '⇄ ');
        const bonusTxt = ns.bonus > 0 ? ' +' + Math.round(ns.bonus * 100) + '%' : '';
        UI.pickupPrompt.classList.toggle('upgrade', better);
        UI.pickupTitle.textContent = arrow + (ns.bonus > 0 ? ns.name + ' ' : '') + nw.name + bonusTxt;
        UI.pickupTitle.style.color = ns.bonus > 0 ? ns.color : nw.color;
        if (nw.explosive) {
          const blastVal = Math.round((nw.splashDmg || 0) * (1 + ns.bonus));
          const directVal = Math.round(((nw.splashDmg || 0) + nw.dmg) * (1 + ns.bonus));
          UI.pickupSub.textContent = `TIER ${nw.tier} · BLAST ${blastVal} (${directVal} HIT) · MAG ${nw.mag}`;
        } else if (nw.spinUp) {
          UI.pickupSub.textContent = `TIER ${nw.tier} · ${nw.rpm} RPM · MAG ${nw.mag}`;
        } else {
          const dmgVal = Math.round(nw.dmg * (1 + ns.bonus) * nw.pellets);
          UI.pickupSub.textContent = `TIER ${nw.tier} · DMG ${dmgVal} · MAG ${nw.mag}`;
        }
      } else if (np.kind === 'gadget') {
        const g = GADGETS[np.gadget] || GADGETS.frag;
        UI.pickupPrompt.classList.remove('upgrade');
        UI.pickupTitle.textContent = '⇄ ' + g.name + ' (×2)';
        UI.pickupTitle.style.color = g.color;
        UI.pickupSub.textContent = 'SWAP TACTICAL GADGET';
      }
    }
  }

  if (player.weapon !== hudCache.weapon) {
    hudCache.weapon = player.weapon;
    UI.weapon.textContent = WEAPONS[player.weapon].name;
    drawWeaponPreview();
  }
  if (player.skin !== hudCache.skin) {
    hudCache.skin = player.skin;
    const skin = skinInfo(player.skin);
    UI.skin.textContent = skin.bonus > 0
      ? skin.name + ' · +' + Math.round(skin.bonus * 100) + '% DMG'
      : 'FACTORY FINISH';
    UI.skin.style.color = skin.color;
    UI.skin.style.textShadow = skin.bonus > 0 ? '0 0 12px ' + skin.color : 'none';
    drawWeaponPreview();
  }
  if (player.mag !== hudCache.mag) {
    hudCache.mag = player.mag;
    UI.mag.textContent = String(player.mag);
  }
  const curMagCap = WEAPONS[player.weapon].mag;
  const ammoLow = player.mag === 0 || (curMagCap > 1 && player.mag <= Math.ceil(curMagCap * 0.25));
  if (ammoLow !== hudCache.ammoLow) {
    hudCache.ammoLow = ammoLow;
    UI.mag.classList.toggle('low', ammoLow);
  }

  if (player.reloading) {
    if (hudCache.reload !== true) {
      hudCache.reload = true;
      UI.reloadWrap.classList.add('active');
    }
    const pct = Math.round(clamp(1 - player.reloadT / Math.max(0.001, player.reloadTotal), 0, 1) * 1000) / 10;
    if (pct !== hudCache.reloadW) {
      hudCache.reloadW = pct;
      UI.reloadFill.style.width = pct + '%';
    }
  } else if (hudCache.reload !== false) {
    hudCache.reload = false;
    hudCache.reloadW = -1;
    UI.reloadWrap.classList.remove('active');
    UI.reloadFill.style.width = '0%';
  }

  const maxDash = DASH_COOLDOWN * (player.dashCdMul || 1);
  const dashText = player.dashCd > 0
    ? 'DASH ' + (Math.ceil(player.dashCd * 10) / 10).toFixed(1) + 's'
    : player.dashT > 0 ? 'DASHING' : 'SPACE · DASH READY';
  if (dashText !== hudCache.dash) {
    hudCache.dash = dashText;
    UI.dashLabel.textContent = dashText;
  }
  const dashReady = player.dashCd <= 0 && player.dashT <= 0;
  if (dashReady !== hudCache.dashReady) {
    hudCache.dashReady = dashReady;
    UI.dash.classList.toggle('ready', dashReady);
  }
  const dashProgress = Math.round(clamp(1 - player.dashCd / maxDash, 0, 1) * 20) / 20;
  if (dashProgress !== hudCache.dashProgress) {
    hudCache.dashProgress = dashProgress;
    UI.dash.style.setProperty('--dash-progress', dashProgress);
    if (UI.dashTouch) UI.dashTouch.style.setProperty('--dash-progress', dashProgress);
  }

  if (!isPracticeMode()) {
    if (zone) {
      let label;
      if (zone.state === 'waiting') {
        label = 'ZONE ' + (zone.phase + 1) + ' · ' + Math.max(0, Math.ceil(zone.timer)) + 's';
      } else if (zone.state === 'shrinking') {
        label = 'ZONE ' + (zone.phase + 1) + ' · CLOSING ' + Math.max(0, Math.ceil(zone.timer)) + 's';
      } else {
        label = 'FINAL ZONE';
      }
      if (label !== hudCache.zone) {
        hudCache.zone = label;
        UI.zone.textContent = label;
      }
      const closing = zone.state === 'shrinking';
      if (closing !== hudCache.zoneClosing) {
        hudCache.zoneClosing = closing;
        UI.zone.parentElement.classList.toggle('closing', closing);
      }
    }

    if (UI.supply && game.supplyNext != null) {
      const supplyLeft = Math.max(0, game.supplyNext - game.matchTime);
      const supplyText = supplyLeft > 0 ? 'CACHE ' + formatTime(supplyLeft) : 'CACHE LIVE';
      if (supplyText !== hudCache.supply) {
        hudCache.supply = supplyText;
        UI.supply.textContent = supplyText;
        UI.supply.parentElement.classList.toggle('active', supplyLeft <= 0);
      }
    }

    let outside = false;
    if (player.alive && zone) {
      const zdx = player.x - zone.x;
      const zdy = player.y - zone.y;
      outside = zdx * zdx + zdy * zdy > zone.r * zone.r;
    }
    if (outside !== hudCache.warn) {
      hudCache.warn = !!outside;
      UI.stormWarn.classList.toggle('show', !!outside);
      if (!outside) { hudCache.warnAngle = null; hudCache.warnDist = ''; }
    }
    if (outside && zone) {
      const dx = zone.x - player.x;
      const dy = zone.y - player.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.round(Math.atan2(dy, dx) * 100) / 100;
      if (angle !== hudCache.warnAngle && UI.warnArrow) {
        hudCache.warnAngle = angle;
        UI.warnArrow.style.setProperty('--warn-angle', (angle * 180 / Math.PI + 90).toFixed(0) + 'deg');
      }
      const meters = Math.max(0, Math.round((dist - zone.r) / 10));
      const distText = meters + 'm';
      if (distText !== hudCache.warnDist && UI.warnDist) {
        hudCache.warnDist = distText;
        UI.warnDist.textContent = distText;
      }
    }
    const storm = Math.round((game.stormPulse || 0) * 100) / 100;
    if (storm !== hudCache.storm) {
      hudCache.storm = storm;
      UI.stormVignette.style.opacity = storm.toFixed(2);
    }
  } else {
    if (hudCache.warn !== false) {
      hudCache.warn = false;
      UI.stormWarn.classList.remove('show');
    }
    if (hudCache.storm !== 0) {
      hudCache.storm = 0;
      UI.stormVignette.style.opacity = '0';
    }
  }
  const hurt = Math.round(clamp(game.hurt * 0.9, 0, 1) * 100) / 100;
  if (hurt !== hudCache.hurt) {
    hudCache.hurt = hurt;
    UI.vignette.style.opacity = hurt.toFixed(2);
  }
}

function addFeed(killerName, victimName, byStorm, isPlayer, weaponKey, isBlast, isSelf = false) {
  const el = document.createElement('div');
  el.className = 'feedItem' + (byStorm ? ' storm' : isBlast ? ' blast' : '');
  const killerStyle = isPlayer ? ' style="color:#5ee7ff"' : '';
  let weapon = '';
  if (weaponKey && WEAPONS[weaponKey]) {
    weapon = `<em style="color:${WEAPONS[weaponKey].color}">${WEAPONS[weaponKey].short}</em>`;
  } else if (weaponKey) {
    weapon = `<em style="color:#ff8f45">${escapeHtml(weaponKey)}</em>`;
  }
  if (isSelf) {
    el.innerHTML = `<b${killerStyle}>${escapeHtml(killerName)}</b>${weapon}<span>self-eliminated</span>`;
  } else {
    el.innerHTML = `<b${killerStyle}>${escapeHtml(killerName)}</b>${weapon}<span>eliminated</span><b class="victim">${escapeHtml(victimName)}</b>`;
  }
  UI.feed.appendChild(el);
  while (UI.feed.children.length > 4) UI.feed.firstChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 380);
  }, 4200);
}

function pulseAura() {
  if (!UI.auraPill) return;
  UI.auraPill.classList.remove('pop');
  void UI.auraPill.offsetWidth;
  UI.auraPill.classList.add('pop');
}

function showToast(text, ms = 1600, tone = '') {
  UI.toast.textContent = text;
  UI.toast.className = 'show' + (tone ? ' ' + tone : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { UI.toast.classList.remove('show'); }, ms);
}

/* ---------------------------------------------------------
   Minimap (Cached static base + Boost Pads + Scout Radar)
   --------------------------------------------------------- */
let minimapStatic = null;
let minimapStaticObstacles = null;
let minimapStaticSize = '';
let minimapLastDraw = -1;

function buildMinimapStatic(S, mmDpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.floor(S * mmDpr));
  c.height = Math.max(1, Math.floor(S * mmDpr));
  const g = c.getContext('2d');
  g.setTransform(mmDpr, 0, 0, mmDpr, 0, 0);
  g.fillStyle = '#0a1016';
  g.fillRect(0, 0, S, S);

  const pad = 5;
  const k = (S - pad * 2) / WORLD;
  const mapX = (x) => pad + x * k;
  const mapY = (y) => pad + y * k;

  g.fillStyle = 'rgba(255,255,255,0.035)';
  for (const r of ROADS) g.fillRect(mapX(r.x), mapY(r.y), r.w * k, r.h * k);

  // Bake only indestructible cover into static minimap; destructible crates render live below.
  g.fillStyle = 'rgba(255,255,255,0.09)';
  for (const o of obstacles) {
    if (o.destructible) continue;
    g.fillRect(mapX(o.x), mapY(o.y), Math.max(1, o.w * k), Math.max(1, o.h * k));
  }

  // Boost pad markers
  g.fillStyle = 'rgba(94,231,255,0.65)';
  for (const bp of boostPads) {
    g.beginPath();
    g.arc(mapX(bp.x), mapY(bp.y), 1.8, 0, TAU);
    g.fill();
  }

  for (const d of DISTRICTS) {
    g.fillStyle = `rgba(${d.color},0.42)`;
    g.beginPath(); g.arc(mapX(d.x), mapY(d.y), 1.6, 0, TAU); g.fill();
    g.strokeStyle = `rgba(${d.color},0.18)`;
    g.lineWidth = 0.8;
    g.beginPath(); g.arc(mapX(d.x), mapY(d.y), 3.2, 0, TAU); g.stroke();
  }

  g.strokeStyle = 'rgba(94,231,255,0.16)';
  g.lineWidth = 1;
  g.strokeRect(pad, pad, S - pad * 2, S - pad * 2);

  minimapStatic = c;
}

function drawMinimap() {
  const S = minimap.clientWidth || 174;
  if (!S) return;
  const now = performance.now();
  if (now - minimapLastDraw < getGraphicsSettings().minimapMs) return;
  minimapLastDraw = now;

  const mmDpr = Math.min(DPR, 1.5);
  const sizeKey = S + 'x' + mmDpr;
  if (!minimapStatic || minimapStaticObstacles !== obstacles || minimapStaticSize !== sizeKey) {
    minimap.width = Math.max(1, Math.floor(S * mmDpr));
    minimap.height = Math.max(1, Math.floor(S * mmDpr));
    buildMinimapStatic(S, mmDpr);
    minimapStaticObstacles = obstacles;
    minimapStaticSize = sizeKey;
  }

  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.clearRect(0, 0, minimap.width, minimap.height);
  mctx.drawImage(minimapStatic, 0, 0);
  mctx.setTransform(mmDpr, 0, 0, mmDpr, 0, 0);
  if (!zone && !isPracticeMode()) return;

  const pad = 5;
  const k = (S - pad * 2) / WORLD;
  const mapX = (x) => pad + x * k;
  const mapY = (y) => pad + y * k;

  // Live intact destructible crates on radar (vanish cleanly when shattered)
  mctx.fillStyle = 'rgba(196,154,96,0.22)';
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (!o.destructible || o.destroyed) continue;
    mctx.fillRect(mapX(o.x), mapY(o.y), Math.max(1, o.w * k), Math.max(1, o.h * k));
  }

  if (zone && !isPracticeMode()) {
    mctx.save();
    mctx.beginPath();
    mctx.rect(0, 0, S, S);
    mctx.arc(mapX(zone.x), mapY(zone.y), Math.max(0.5, zone.r * k), 0, TAU, true);
    mctx.fillStyle = 'rgba(140,70,255,0.22)';
    mctx.fill('evenodd');
    mctx.restore();

    mctx.strokeStyle = 'rgba(190,130,255,0.9)';
    mctx.lineWidth = 1.3;
    mctx.beginPath();
    mctx.arc(mapX(zone.x), mapY(zone.y), Math.max(0.5, zone.r * k), 0, TAU);
    mctx.stroke();

    if (zone.state === 'waiting' && zone.nextR > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(game.time * 2.4);
      mctx.save();
      mctx.setLineDash([3, 4]);
      mctx.strokeStyle = `rgba(232,218,255,${(0.28 + pulse * 0.28).toFixed(2)})`;
      mctx.lineWidth = 1;
      mctx.beginPath();
      mctx.arc(mapX(zone.nextX), mapY(zone.nextY), Math.max(0.5, zone.nextR * k), 0, TAU);
      mctx.stroke();
      mctx.restore();
    }
  }

  if (player) {
    const radar = player.radarRange || 1550;
    if (zone && !isPracticeMode()) {
      const zdx = zone.x - player.x;
      const zdy = zone.y - player.y;
      if (zdx * zdx + zdy * zdy > zone.r * zone.r) {
        const zd = Math.hypot(zdx, zdy) || 1;
        mctx.save();
        mctx.setLineDash([2, 4]);
        mctx.strokeStyle = 'rgba(230,198,255,0.6)';
        mctx.lineWidth = 1;
        mctx.beginPath();
        mctx.moveTo(mapX(player.x), mapY(player.y));
        mctx.lineTo(mapX(zone.x - (zdx / zd) * zone.r), mapY(zone.y - (zdy / zd) * zone.r));
        mctx.stroke();
        mctx.restore();
      }
    }

    for (const p of pickups) {
      if (!p.supply && distance(p.x, p.y, player.x, player.y) > 900) continue;
      mctx.fillStyle = p.supply ? '#ffd166' : 'rgba(255,209,102,0.65)';
      if (p.supply) {
        mctx.save();
        mctx.translate(mapX(p.x), mapY(p.y));
        mctx.rotate(game.time);
        mctx.strokeStyle = 'rgba(255,209,102,0.92)';
        mctx.lineWidth = 1;
        mctx.strokeRect(-3.5, -3.5, 7, 7);
        mctx.restore();
        continue;
      }
      mctx.fillRect(mapX(p.x) - 1, mapY(p.y) - 1, 2, 2);
    }

    for (const g of pings) {
      const a = g.life / g.maxLife;
      mctx.strokeStyle = `rgba(255,90,95,${a * 0.8})`;
      mctx.lineWidth = 1;
      mctx.beginPath();
      mctx.arc(mapX(g.x), mapY(g.y), 2 + (1 - a) * 7, 0, TAU);
      mctx.stroke();
    }

    for (const b of bots) {
      if (!b.alive) continue;
      if (distance(player.x, player.y, b.x, b.y) > radar) continue;
      mctx.fillStyle = b.elite ? '#ffd166' : '#ff5a5f';
      mctx.beginPath();
      mctx.arc(mapX(b.x), mapY(b.y), b.elite ? 3 : 2.2, 0, TAU);
      mctx.fill();
      if (b.elite) {
        mctx.strokeStyle = 'rgba(255,209,102,0.8)';
        mctx.lineWidth = 1;
        mctx.beginPath();
        mctx.arc(mapX(b.x), mapY(b.y), 5.5, 0, TAU);
        mctx.stroke();
      }
    }

    const vw = (W / cam.zoom) * k;
    const vh = (H / cam.zoom) * k;
    mctx.strokeStyle = 'rgba(255,255,255,0.12)';
    mctx.lineWidth = 1;
    mctx.strokeRect(mapX(player.x) - vw / 2, mapY(player.y) - vh / 2, vw, vh);

    const px = mapX(player.x);
    const py = mapY(player.y);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(player.angle);
    mctx.fillStyle = '#5ee7ff';
    mctx.beginPath();
    mctx.moveTo(5, 0); mctx.lineTo(-3.5, 3.5); mctx.lineTo(-2, 0); mctx.lineTo(-3.5, -3.5);
    mctx.closePath();
    mctx.fill();
    mctx.restore();

    mctx.strokeStyle = 'rgba(94,231,255,0.28)';
    mctx.lineWidth = 1;
    mctx.beginPath();
    mctx.arc(px, py, 7 + Math.sin(game.time * 3) * 1.5, 0, TAU);
    mctx.stroke();
  }
}
