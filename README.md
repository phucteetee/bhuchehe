# BATTLEGROUND

A self-contained top-down tactical battle royale that runs smoothly in desktop and mobile browsers — from low-end devices to high-DPI gaming monitors. No build step, server, or external assets required: all graphics are drawn procedurally on Canvas 2D and all audio is synthesized via the Web Audio API.

## Play

Open `index.html` in any modern desktop or mobile browser.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrows | Move (Always Sprint) |
| Mouse | Aim |
| Left mouse | Fire |
| Right mouse / `G` | Throw tactical gadget (Frag / EMP / Smoke) |
| `1` / `2` / `Q` / Mouse wheel | Switch weapon slots |
| `E` | Swap nearby weapon or gadget |
| `R` | Reload |
| `Space` | Dash (brief i-frames) |
| `Esc` | Pause |
| `M` | Mute / unmute |
| `Enter` | Start or redeploy |
| Touch screen | Dual-stick Move + Aim/Fire, Swap, Gadget, Interact (`E`), Reload, Dash, Pause |

## Major Gameplay Systems

- **Dual-Weapon Loadout & Smart Loot**: Carry 2 weapons simultaneously (`1`/`2`/`Q`/wheel). Walking over a weapon automatically fills your empty second slot; when both slots are full, an on-screen comparison prompt (`▲` upgrade / `▼` downgrade) lets you intentionally swap with `E` and drop your old weapon cleanly on the ground.
- **Tactical Gadgets (`RMB` / `G`)**:
  - **Frag Grenade**: Bounces off cover with a pulsing blast-radius indicator, deals heavy AoE damage, shatters crates, and triggers barrel chain reactions.
  - **EMP Pulse**: Strips enemy armor, deals shock damage, slows targets, and jams enemy weapons.
  - **Smoke Canister**: Deploys a billowing tactical smoke cloud that breaks enemy bot line-of-sight.
- **12 Distinct Weapons**: Pistol, SMG, Shotgun, Revolver, Rifle, **Pulse AR** (3-round burst plasma rifle), DMR, LMG, Sniper, **Railgun** (piercing electromagnetic beam), **6-Barrel Minigun** (rotary spin-up suppression cannon), and **Bazooka** (accelerating high-explosive rocket launcher).
- **Interactive Arena Environment**:
  - **Destructible Crates**: Wooden supply crates crack under gunfire, shatter into splinters, and can drop bonus medkits, armor, gadgets, or skinned weapons.
  - **Explosive Fuel Barrels**: Shoot barrels to detonate fiery chain reactions across compounds.
  - **Kinetic Boost Pads**: Step onto glowing directional pads for high-speed tactical launches.
- **Match Modes & Tactical Kits**:
  - Modes: **Royale** (20 operators), **Blitz** (16 operators, fast storm, rarer skins, 1.15× AURA), and **Elite Ops** (45% Elites, deadlier AI, 1.6× AURA).
  - Free Tactical Kits: **Vanguard** (+30 starting Armor & 90 max), **Striker** (-22% reload, -25% dash CD, +8% crit), **Scout** (+10% speed & +35% radar range), **Medic** (faster regen to 85% HP & +55 HP medkits + speed boost).
- **Critical Hits & Combat Feel**: Center-line precision shots trigger `1.42×` **CRIT** hits with golden spark bursts, diamond hitmarkers, and crisp chimes.
- **Upgraded Tactical Bot AI**: Bots actively seek nearby upgrades/medkits/armor/supply drops, evade live grenades, respect smoke clouds, and elites can flush targets behind cover with gadgets.

## Graphics & Multi-Device Performance

Engineered to stay smooth on weak laptops/phones while scaling up for high-end PCs:

- **5 Graphics Tiers (`POTATO` / `LOW` / `MED` / `HIGH` / `ULTRA`)** + **Auto-Detect** heuristic (inspects CPU cores, device memory, mobile/touch layout, and GPU renderer tier on first launch).
- **Zero-Hitch Adaptive Scaling**: Tracks both FPS and EMA frame time (`ms`). When **Auto-Adapt** is enabled, sustained frame drops smoothly step down resolution scale, particle caps, decals, dynamic lighting, and CSS blur *without rebuilding the baked ground layer mid-match* (zero stutter).
- **Optional Live FPS HUD**: Toggle the compact top-left telemetry badge (`FPS · Quality · Resolution %`).
- **O(1) Spatial Hash Grid**: Obstacles are indexed in a 16×16 spatial grid, replacing brute-force bullet/collision/LOS/AI cover scans.
- **Viewport-Clipped Ground Blit**: Static terrain, grit noise texture, roads, 6 distinct biome floors, and 2.5D indestructible rocks/containers are baked once per match and only the visible viewport slice is blitted each frame.
- **Dynamic Visual Upgrades**:
  - 2.5D extruded cover with directional cast shadows and specular highlights.
  - Pure celestial planet operators (Mercury, Mars, Earth, Venus, Neptune, Jupiter, Uranus, Saturn) with distinct planetary surfaces, rings, craters, cloud bands, and signature aura — no facial features.
  - Cached radial light halos (High/Ultra), persistent battle decals (scorch craters & bullet chips), fading Sniper/Railgun ion beams, and crackling storm perimeter lightning arcs.
  - Delayed damage-drain HP bar and off-screen supply/grenade edge indicators.

## Releases

### v0.1.2
- **New Tier 5 Heavy Weapons**:
  - **Bazooka (`BZ`)**: Single-tube heavy rocket launcher firing accelerating warheads (`560 → 980 px/s`) with backblast exhaust, smoke trails, `138px` AoE blast (`82` max splash + `24` direct-hit skill bonus = `106`), `1.85×` crate-breaching power, and barrel chain-detonation.
  - **6-Barrel Minigun (`MG`)**: Rotary heavy cannon (`1260 RPM`, `96`-round drum, `8.5` dmg) featuring live animated spinning 6-barrel rendering, rising turbine spin-up audio, thermal barrel glow, crosshair spin/heat arc, and cover shredding.
- **Weapon Power Balancing System**:
  - **Heavy Mobility Weight**: Carrying Heavy weapons slows movement (`LMG 0.95×`, `Minigun 0.88×` carry / `0.64×` braced firing, `Bazooka 0.86×`), encouraging tactical Dual-Weapon (`Q`) swaps.
  - **Minigun Counterplay**: `0.52s` mandatory spin-up delay (`1.04s` cold TTK vs `0.63s` SMG/LMG), dynamic thermal spread bloom (`0.068 → 0.104+`), `1.2×` reduced crit scaling, `3.45s` reload, dash spin disruption, and shorter `860` range.
  - **Bazooka Counterplay**: Slow dodgeable accelerating rockets, `2.25s` single-shot reload window, `72%` self-damage radius penalty preventing point-blank abuse, no random crits, and `1080` range cap so Sniper/Railgun stay kings of long range.
  - **Loot Economy & Bot AI**: 1 curated Bazooka + 1 Minigun spawn at distinct map landmarks per match, plus Tier 5 Supply Caches and Elite drops. Bots respect Bazooka safe standoff distance, evade incoming rockets, and fire sustained Minigun bursts.

### v0.1.1
- **AAA Tactical Lobby & UI Overhaul**: Full-viewport 3-column tactical lobby with esports top navigation bar (`PLAY` / `ARMORY` / `CAREER` / `SETTINGS`), animated orbital Planet Operator showcase pedestal, dedicated Settings overlay, chamfered `DROP IN` command dock, and armored in-game HUD plates with radar corner reticles.
- **Always-Sprint Movement**: Removed manual `Shift` sprint toggling; operators now sprint automatically at full tactical pace.
- **Full Armory Unlock**: All 8 celestial planet operators (Mercury, Mars, Earth, Venus, Neptune, Jupiter, Uranus, Saturn), all 5 movement trails, and `1,000,000` AURA unlocked by default.
- **Damped-Spring Animations**: Frame-rate-independent exponential damping for gun recoil, camera kick/lead, walk-cycle bobbing, dash afterimages, and harmonic screen shake.

## Files

- `index.html` — page shell, dual-weapon HUD, mode/perk deck, dual-stick touch UI, screens
- `style.css` — responsive layout, 5-tier performance CSS rules, glassmorphism & touch styling
- `js/core.js` — weapons, gadgets, modes, perks, 5-tier adaptive graphics, spatial hash grid, audio/music, input, world generation
- `js/profile.js` — `localStorage` persistence (`battleground.profile.v1`), ranks, daily contracts, career, armory
- `js/combat.js` — entities, dual-weapon loadout, smart loot, throwables, destructible cover, barrels, boost pads, spatial-grid bot AI
- `js/render.js` — viewport-clipped ground baking, 2.5D cover, decals, dynamic lighting, expressive operators, beams, storm lightning, HUD, minimap
- `js/main.js` — match lifecycle, state machine, EMA frame-time adaptive loop
