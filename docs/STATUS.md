# Build status

## Verified on Windows (2026-08)

- TypeScript strict compilation
- static web build
- 58 deterministic engine tests
- headless behavior simulation (walk → stalk → groom → investigate arcs)
- save/restore memory path (including toy prefs, rich relationships, diary, routines)
- multi-pet simulation path
- geometry-to-surface conversion
- cursor prey response + medium-range stalking
- Keeper fullscreen/idle/locked suppression
- physics surface landing, hard-landing startle recovery
- moving-window surface attachment / window riding; snap-startle on teleports
- window-side climbing with hang/peek pull-up traversal
- bird flight between surfaces, rabbit hop locomotion
- search-missing-object chain (remember → travel → miss → search → give up)
- personality drift, sleep consolidation, toy favorites
- relationship model v2 (familiarity/trust/affection/irritation/rivalry) incl. legacy migration
- bed sharing vs. bed contesting by relationship
- native `cargo check` of the Tauri shell on windows-gnu **from a path containing spaces**
- web habitat smoke test: assets serve, settings panel DOM complete

Commands used:

```text
npm run build
npm test
npm run demo
cd src-tauri && cargo check   # uses src-tauri/.cargo/config.toml space-free target dir
```

## Native notes

The Tauri shell compiles on Windows. The MinGW `windres` resource compiler cannot
handle paths with spaces, so `src-tauri/.cargo/config.toml` pins the cargo target
directory to a space-free location (`%LOCALAPPDATA%\PetOS-target`). If you build
with the `stable-x86_64-pc-windows-msvc` toolchain or move the repo, that file can
be deleted.

Win32 sensors now include: monitors, windows, cursor speed/buttons, foreground app,
fullscreen detection, input idle time (`GetLastInputInfo`) and workstation lock
state (`OpenInputDesktop`).

## Alpha acceptance checklist

- [x] creature simulation exists independently of UI
- [x] multiple species are behaviorally distinct
- [x] memory changes future preference
- [x] pets react causally to cursor/context
- [x] multi-pet simulation exists
- [x] furniture/toy objects exist
- [x] browser development habitat exists
- [x] persistent world exists (diary/routines/object memory included)
- [x] Tauri shell exists
- [x] Windows desktop sensor implementation exists (idle + lock added)
- [x] compile Tauri shell on Windows (windows-gnu via space-free target dir)
- [x] pose-based animation pipeline replaces raw procedural rectangles
- [ ] production sprite packs / real-pet morphology mapping beyond palette
- [ ] native per-pixel hit testing so only pet pixels capture clicks
- [ ] signed installer/release packaging
- [ ] SQLite persistence backend (JSON store currently; schema is migration-ready)
