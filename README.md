# Arctic Relay — a three.js tactical FPS

A round-based tactical shooter at Relay Station K-7, 78° north: one operative
against four Drifter raiders, under the aurora. Plant the relay charge at the
dome pad and defend it until it detonates — or clear the Drifters. First to
3 rounds takes the station.

## The game

- **Complete loop:** mouse-look + WASD movement, weapons that fire, reload and
  run dry, bots that patrol, hold angles and shoot back, rounds that end in a
  win or a loss, and a HUD with health, armour, ammo, round timer and score.
- **Gunplay:** headshots deal bonus damage, recoil and spread punish firing on
  the move, crouching steadies the aim, movement has acceleration and friction,
  floating damage numbers mark every hit, and the map collides on every wall,
  crate and ice ridge.
- **Tactics:** a bomb to plant (hold E on the dome pad) and defend against
  defuse, money earned each round and spent in the buy menu, three weapons
  (Aurora Rifle, Frostbite SMG, Long Night sniper), a cryo grenade that
  slows bots and a smoke grenade (Q) whose cloud blocks Drifter sight, a
  live minimap, and four bot archetypes with different behaviour — Sable
  the Holder, Rime the Sniper, Gale the Rusher (he hunts your gunfire) and
  Frost the Flanker (he works the lane opposite to yours and cuts across
  mid when the charge is planted).
- **The map:** an original arctic research station — Relay Dome, Hab and Lab
  modules, comms tower, snowdrifts, ice walls and crates — under an aurora sky
  with falling snow, cold moonlight and warm door lamps.
- **Code:** one module per job (`map`, `player`, `bots`, `weapons`, `combat`,
  `rounds`, `hud`, `audio`, `state`), a fixed 60 Hz simulation kept apart
  from rendering, a single state store, and pooled tracers so the hot loops
  allocate nothing per frame.

## Play it

```sh
node serve.ts        # game/ on http://localhost:8080
```

Click Deploy, then play. `B` is not needed — the buy menu opens between
rounds. `1/2/3` switch weapons, `G` throws a cryo grenade, `Q` throws a
smoke grenade, `E` plants the charge on the pad, `Ctrl` crouches, `Space`
jumps, right mouse aims.

## Screenshots

Deterministic captures for the entry: `?shot=start|play|plant|end&seed=7`
renders a frozen frame and sets `window.__shotReady`. See `shots.json`.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library.

## License

MIT — see `LICENSE`.
