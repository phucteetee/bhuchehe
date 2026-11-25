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
| `E` | Swap nearby weapon or gadget / interact with Safe Zone pedestals |
| `R` | Reload |
| `Space` | Dash (brief i-frames) |
| `H` / `T` / `B` | Practice mode: Return to Safe Zone (`H`) / Teleport to Combat (`T`) / Toggle Quick Armory (`B`) |
| `Esc` | Pause (or close Quick Armory) |
| `M` | Mute / unmute |
| `Enter` | Start or redeploy |
| Touch screen | Dual-stick Move + Aim/Fire, Swap, Gadget, Interact (`E`), Reload, Dash, Safe Zone (`SAFE`/`TP`), Armory (`GUNS`), Pause |

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
  - Modes:
    - **Royale**: 30 operators (`1` player + `29` bots) on the expanded `4400×4400` 8-district map with extended 9-phase storm (~5 min) and supply caches.
    - **Practice**: Dedicated **Safe Zone Map** (`1400×820` standalone armory & ballistic firing-range facility with all 12 weapons, all 5 finishes, all 3 gadgets, 3 regenerating target dummies, collapsible Quick Armory `[B]`, and glowing **COMBAT TP** portal `[T]`) separated completely from the full `4400×4400` Combat Arena. Combat Arena features **zero floor weapon drops**, **no storm or zone countdown timer**, 19 continuously respawning bots wielding random weapons (always **20** active operators), instant combat respawn, and one-click **`SAFE ZONE [H]`** return.
  - Free Tactical Kits: **Vanguard** (+30 starting Armor & 90 max), **Striker** (-22% reload, -25% dash CD, +8% crit), **Scout** (+10% speed & +35% radar range), **Medic** (faster regen to 85% HP & +55 HP medkits + speed boost).
- **Critical Hits & Combat Feel**: Center-line precision shots trigger `1.42×` **CRIT** hits with golden spark bursts, diamond hitmarkers, and crisp chimes.
- **Upgraded Tactical Bot AI**: Bots actively seek nearby upgrades/medkits/armor/supply drops, evade live grenades, respect smoke clouds, and elites can flush targets behind cover with gadgets.

## Graphics & Multi-Device Performance

Engineered to stay smooth on weak laptops/phones while scaling up for high-end PCs:

- **5 Graphics Tiers (`POTATO` / `LOW` / `MED` / `HIGH` / `ULTRA`)** + **Auto-Detect** heuristic (inspects CPU cores, device memory, mobile/touch layout, and GPU renderer tier on first launch).
- **Zero-Hitch Adaptive Scaling**: Tracks both FPS and EMA frame time (`ms`). When **Auto-Adapt** is enabled, sustained frame drops smoothly step down resolution scale, particle caps, decals, dynamic lighting, and CSS blur *without rebuilding the baked ground layer mid-match* (zero stutter).
- **Optional Live FPS HUD**: Toggle the compact top-left telemetry badge (`FPS · Quality · Resolution %`).
- **O(1) Spatial Hash Grid**: Obstacles are indexed in a 16×16 spatial grid, replacing brute-force bullet/collision/LOS/AI cover scans.
- **Viewport-Clipped Ground Blit**: Static terrain, grit noise texture, 3 arterial highways, 8 distinct biome floors (`4400×4400`), and 2.5D indestructible rocks/containers are baked once per match and only the visible viewport slice is blitted each frame.
- **Dynamic Visual Upgrades**:
  - 2.5D extruded cover with directional cast shadows and specular highlights.
  - Pure celestial planet operators (Mercury, Mars, Earth, Venus, Neptune, Jupiter, Uranus, Saturn) with distinct planetary surfaces, rings, craters, cloud bands, and signature aura — no facial features.
  - Cached radial light halos (High/Ultra), persistent battle decals (scorch craters & bullet chips), fading Sniper/Railgun ion beams, and crackling storm perimeter lightning arcs.
  - Delayed damage-drain HP bar and off-screen supply/grenade edge indicators.

## Releases

### v0.1.5
- **2 New Tactical Weapons (14 Total) & SMG Accuracy Tuning**:
  - **Ricochet (`RC`, Tier 4)**: Fires high-velocity energy discs that bounce up to 2 times off walls, cover, and enemy Shield Domes with a `+15%` damage boost per bounce for bank-shot trick eliminations.
  - **Cryo Beam (`CR`, Tier 4)**: Close-to-mid-range pressurized frost projector that fires rapid icy bolts, chilling and slowing targets (`0.78s` slow) to control corners and flush cover.
  - **SMG Accuracy Tuning**: Tightened SMG base spread (`0.052 → 0.024`), bloom cap (`0.026`), moving spread multiplier (`1.22×`), and projectile velocity (`1820 px/s`) for noticeably straighter beams while keeping Assault Rifles (`0.012`) superior at mid/long range.
- **2 New Tactical Gadgets (5 Total)**:
  - **Thermite (`THM`)**: Ignites a `4.5s` burning fire pool (`34 DPS`) that denies chokepoints, shreds wooden crates (`2.35×`), ignites barrels, and forces bots out of cover.
  - **Shield Dome (`SHD`)**: Deploys a `5.5s` / `260 HP` holographic cyan energy dome that blocks enemy bullets (and reflects Ricochet discs) so you can heal or reload safely in open terrain.
- **New Map Environmental Interactions**:
  - **Blue Cryo / EMP Barrels**: Alongside red explosive barrels, blue Cryo barrels detonate in a wide frost-EMP wave (`178px`) that strips armor (`-45`), deals `38` damage, slows (`3.0s`), and jams weapons (`2.2s`).
  - **District Shield Pylons**: 6 hexagonal armor-recharging pylons placed across major districts (`+18 ARM/s` up to `120` charge per cycle, `28s` recharge cooldown, with live electric tether beams & minimap markers).
  - **Holographic Stealth Brushes**: 14 energy-foliage stealth patches that cloak operators (`STEALTH · CLOAKED`) and break bot acquisition beyond `115px` until firing.
- **Progression, Finishers & Settings QoL**:
  - **Finisher VFX Shop (Armory)**: 6 elimination Finisher effects (`Standard`, `Solar Nova`, `Cryo Shatter`, `Ion Strike`, `Void Collapse`, `Supernova`) purchasable with AURA in the Armory and triggered live on eliminations.
  - **Weapon Mastery Tracer Perks**: Reaching `25+` eliminations (`VETERAN`) unlocks enhanced **Glow Tracers** and `50+` (`MASTER`) unlocks **Apex Golden Tracers** + HUD mastery star badge.
  - **Settings Overhaul**: Added **Crosshair Customizer** (4 styles, 6 colors, size slider, live preview), **Custom Keybinds** (click-to-rebind with swap & reset), and full **English / Vietnamese (`EN` / `VI`)** interface switcher.
- **HUD & Performance Polish**:
  - Moved **Zone & Cache** telemetry directly beside the top-right Radar (`#topRightDock`) and consolidated **ELIMS / ALIVE / AURA** cleanly at the top-left.
  - Fixed `RETURN TO SAFE ZONE` button appearing when pausing in Royale mode and fixed Pause/Countdown, DDA Line-of-Sight, cover-first bullet collision, swept anti-tunneling Dash/Boost collision, EMP burst cancellation, and Safe Zone Quick Armory synchronization.
  - Scaled all new VFX (hex dome mesh, firelight halos, frost crystals, pylon glows) cleanly across `POTATO` → `ULTRA` tiers.

### v0.1.4
- **Dedicated Separate Safe Zone Map (Practice Mode)**:
  - Moved the Practice **Safe Zone** onto its own standalone `1400×820` orbital Tactical Armory & Ballistic Firing Range map — completely isolated in rendering, physics, projectiles, particles, decals, and spatial audio from the full `4400×4400` Combat Arena.
  - Upgraded the Firing Range with distance markers (`100M` / `200M` / `300M`) and 3 regenerating target dummies (`DUMMY 100`, `ARMORED 175`, `HEAVY 250`) supporting bullets, rockets, Frag blasts, and EMP armor shred.
  - Combat Arena is now 100% full `4400×4400` playable terrain with no Safe Zone cutout or radar box.
- **Zero Floor Weapons & No Zone Timer in Practice Mode**:
  - Removed all floor weapon spawns, Tier 5 apex weapon spawns, crate weapon drops, bot death weapon drops, and supply caches in Practice mode (utility pickups like medkits, armor, and gadgets still drop naturally in combat).
  - Completely removed the storm/zone shrink countdown timer system and supply timer from both simulation and HUD in Practice mode.
- **Unobstructed, Symmetrical UI/UX Overhaul**:
  - Made the Safe Zone Quick Armory a collapsible slide-out drawer (`ARMORY [B]` + `SLOT 1` / `SLOT 2` switcher + close button) that starts hidden so the Safe Zone Map and firing range are 100% unobstructed; hid radar minimap and kill feed while inside the Safe Zone Map.
  - Redesigned the in-game HUD with symmetrical `268px` bottom-left Vital Plate and compact horizontal bottom-right Weapon/Loadout Plate (reducing bottom-right height by ~78px), a unified slim top telemetry bar, a compact `162px` radar minimap, a capped 4-item translucent kill feed, and refined upper-edge toast notifications that stay clear of combat sightlines.
  - Balanced the main lobby 3-column stage (`320px / 1fr / 320px`) for crisp symmetry across desktop and mobile viewports.

### v0.1.3
- **Expanded Map & Longer Matches**:
  - Expanded arena from `3200×3200` to `4400×4400` (+89% playable area) with 8 named districts (`ARENA CORE`, `FOUNDRY`, `RELAY`, `DOCKS`, `SECTOR 9`, `SPIRE`, `OUTPOST`, `REACTOR`), 3 intersecting highways, 20 fortified compounds, 42 explosive barrels, 10 kinetic boost pads, and 74+ floor weapons (plus 3 guaranteed Tier 5 apex spawns).
  - **Royale Mode Upgraded to 30 Operators**: Increased lobby count from `20` → `30` (`1` player + `29` bots) with an extended 9-phase storm (~5 minutes) and rebalanced bot-vs-bot pacing.
- **Streamlined Modes & New Practice Mode (`PRACTICE`)**:
  - Removed the 2 redundant modes (`Blitz` and `Elite Ops`) and replaced them with **Practice** mode.
  - **Protected Safe Zone Sanctuary**: Free access to all 12 weapons, all 5 weapon finishes, and all 3 tactical gadgets via physical pedestals (`[E]`) or the quick-armory dock, plus 2 live regenerating firing-range target dummies (`DUMMY 100HP` & `ARMORED 175`).
  - **Seamless Combat Teleport (`COMBAT TP` / `T`)**: Step onto the glowing portal pad, click `TELEPORT TO COMBAT`, or press `T` to drop into the live combat arena with **no shrinking storm**.
  - **Continuous 20-Operator Action**: Always maintains `20` active operators (`1` player + `19` bots). Floor weapons spawn and auto-replenish around the map; bots spawn with random weapons across all 12 tiers and respawn immediately on death; players respawn immediately at a random combat location on death.
  - **Return to Safe Zone (`H` / HUD / Mobile / Pause)**: Dedicated `SAFE ZONE [H]` button in the top-left HUD, mobile touch button, pause menu option, and `H` hotkey let players return to the Safe Zone anytime to switch loadouts.

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
