# BATTLEGROUND

A self-contained top-down tactical battle royale that runs smoothly in desktop and mobile browsers — from low-end devices to high-DPI gaming monitors. No build step, server, or external assets required: all graphics are drawn procedurally on Canvas 2D and all audio is synthesized via the Web Audio API.

## Play

Open `index.html` in any modern desktop or mobile browser.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrows | Move |
| Mouse | Aim |
| Left mouse | Fire |
| Right mouse / `G` | Throw tactical gadget (Frag / EMP / Smoke) |
| `1` / `2` / `Q` / Mouse wheel | Switch weapon slots |
| `E` | Swap nearby weapon or gadget |
| `R` | Reload |
| `Shift` | Sprint |
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
- **10 Distinct Weapons**: Pistol, SMG, Shotgun, Revolver, Rifle, **Pulse AR** (3-round burst plasma rifle), DMR, LMG, Sniper, and **Railgun** (piercing electromagnetic beam).
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

## Files

- `index.html` — page shell, dual-weapon HUD, mode/perk deck, dual-stick touch UI, screens
- `style.css` — responsive layout, 5-tier performance CSS rules, glassmorphism & touch styling
- `js/core.js` — weapons, gadgets, modes, perks, 5-tier adaptive graphics, spatial hash grid, audio/music, input, world generation
- `js/profile.js` — `localStorage` persistence (`battleground.profile.v1`), ranks, daily contracts, career, armory
- `js/combat.js` — entities, dual-weapon loadout, smart loot, throwables, destructible cover, barrels, boost pads, spatial-grid bot AI
- `js/render.js` — viewport-clipped ground baking, 2.5D cover, decals, dynamic lighting, expressive operators, beams, storm lightning, HUD, minimap
- `js/main.js` — match lifecycle, state machine, EMA frame-time adaptive loop
