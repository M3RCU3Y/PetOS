# PetOS 🐾

**A living-creature simulation that inhabits your desktop.**

PetOS is not a random sprite wandering over your taskbar. Every pet has species instincts, personality, drives, affect, memory, learned preferences, relationships, a body, and a model of the desktop world. The operating system becomes habitat: taskbars are floors, window tops are ledges, furniture is shelter, the cursor can become prey, and other pets are social agents.

## What is implemented

- Creature-first cognition with utility scoring and behavior inertia
- Cats, dogs, rabbits, and birds with different traits and locomotion
- Drives: fatigue, hunger, thirst, play, social need, curiosity, comfort
- Continuous affect: valence, arousal, stress
- Episodic memory, learned surface/app/toy preferences, rich social relationships (familiarity, trust, affection, irritation, rivalry)
- Keeper focus logic that reduces interruptions in fullscreen/gaming contexts, plus idle/battery/lock awareness
- Desktop topology from monitors, work areas, taskbar edges, and visible windows
- Cursor sensing: stalk at medium range, chase and pounce up close
- Gravity, jumping, falling, landing, walking, running and target following
- Window riding; violent window snaps startle pets off instead of teleporting them
- **Window-side climbing** with hang → peek → pull-up traversal to higher ledges
- Bird flight between surfaces; rabbit hop locomotion
- Multi-step search chains for remembered objects (travel → miss → search nearby → frustration → give up)
- Personality drift from lived experience; sleep-time memory consolidation; favorite toys/places/apps
- Multi-pet life: cuddling, play fighting, bed sharing vs. bed contests, newcomer curiosity, rival avoidance
- Daily routines (morning stretch, mealtime, evening wind-down) and deterministic weather + seasonal events that color mood
- Optional Cortex layer: local Ollama provider suggests high-level intentions shown as thought bubbles; fully functional without it
- Habitat objects: beds, balls, boxes, food/water bowls, scratchers — each advertising affordances to the brain
- Circadian weighting, so time of day subtly changes rest/play tendencies
- In-app diary (achievements) and life log sourced from episodic memory
- Persistent pets — memory, appearance, diary, routines and habits survive restarts — plus export/import backups
- Built-in pet packs plus JSON community pack import with detailed validation, version compatibility and SHA-256 trust fingerprints
- **Sprite-sheet pipeline**: packs can ship real art (`appearance.sheet`: strip image, frame size, per-behavior rows) with behavior alias resolution and graceful fallback to procedural art until sheets load
- Real-pet recreation: photo import extracts coat/accent/eye palette **and classifies markings** (tuxedo / tabby / patched / uniform) rendered on the procedural pet
- Live pet preview in the creator; local photo gallery of desktop snapshots
- Pose-based pixel renderer: species-specific skeletons, walk/run cycles, tails, blinking, gaze tracking, squash & stretch, sleep Z's, startle marks, dust and speed lines
- Interaction mode: pet, feed, brush, wake, call (personality decides if they bother), drag/toss, right-click menu, laser pointer (`Ctrl+Shift+L`)
- Procedural sound engine with species vocals, cooldowns, volume control and quiet hours (auto during gaming)
- Debug mind overlay showing behavior and drives
- Transparent always-on-top Tauri overlay with tray controls
- Windows native sensor layer using Win32 APIs directly (monitors, windows, cursor, foreground app, fullscreen, input idle time, workstation lock)
- Launch-at-login toggle (Tauri autostart plugin)
- Optional Cortex providers: Ollama (local), OpenAI, OpenRouter, Google Gemini and Anthropic — keys stay local; everything works with Cortex off
- Browser/mock desktop mode for development without Windows
- Onboarding flow: pick a species, name them, choose a temperament
- No GitHub Actions requirement

## Architecture

```text
Win32 desktop sensors ─┐
Browser mock sensors ──┼─> World Model ─> Pet Brain ─> Decision
                      │                    │
                      │          Memory / Drives / Affect
                      │                    │
                      └────────────> Physics / Body
                                         │
                                   Pixel Renderer
```

The simulation core does not know about Tauri or Windows. That means cognition can be tested headlessly and the same pet can later inhabit macOS/Linux adapters.

## Run the headless simulation

Requirements: Node.js 22+ and TypeScript.

```bash
npm install
npm test
npm run demo
```

## Run the browser habitat preview

```bash
npm install
npm run dev:web
```

Open `http://127.0.0.1:4173/`. This uses a fake desktop/window topology but runs the real cognition, physics, rendering and persistence layers.

## Run PetOS on Windows

Install Node.js 22+, Rust stable, the MSVC build tools/WebView2 prerequisites required by Tauri, then:

```powershell
npm install
npm run tauri:dev
```

Build an installer with:

```powershell
npm run tauri:build
```

> **Building from a path with spaces?** The MinGW resource compiler (`windres`) used by the
> windows-gnu toolchain fails when the project path contains spaces. This repo ships
> `src-tauri/.cargo/config.toml` which points the cargo target directory at a space-free
> location, so `cargo check`/`tauri dev` work out of the box. See `docs/STATUS.md`.

PetOS intentionally does not require GitHub Actions. Build and test locally.

## Interaction

PetOS normally uses click-through mode so it does not steal clicks from your applications. Open the tray menu and choose **Interact with pets**, or use the settings panel (`Ctrl + Shift + P` toggles it), to make the overlay interactive:

- **Drag** a pet to pick it up (shy pets dislike sudden grabs)
- Right-click a pet for the context menu: **pet / feed / brush / wake / call**
- Independent pets may ignore calls; clingy ones come running
- `Ctrl + Shift + L` toggles the laser pointer — pets will chase it

Personality modifies every reaction: playful pets live for toys, independent ones barely look up.

## Pet packs

A pack is deliberately simple JSON. The current importer supports species, appearance and personality overrides:

```json
{
  "id": "my-cat",
  "name": "My Cat",
  "version": "1.0.0",
  "species": "cat",
  "author": "you",
  "description": "A custom PetOS cat",
  "appearance": {
    "coat": "#22252c",
    "accent": "#f2f0e9",
    "eye": "#8dd7a2",
    "scale": 1
  },
  "personality": {
    "curiosity": 0.9,
    "playfulness": 0.75,
    "affection": 0.55
  },
  "tags": ["custom"]
}
```

The pack format is intentionally data-driven so sprite sheets, sounds, custom behaviors and accessories can be added without contaminating the simulation core.

## Privacy model

The default **Ambient** design reads only low-level context needed to inhabit the desktop: geometry, cursor position/speed, foreground application identity, monitor/work-area information and broad activity state. The current build does **not** capture screen pixels, text being typed, clipboard contents, microphone audio or document contents.

Future visual/LLM perception must remain explicit opt-in and isolated behind the Cortex interface.

## Project principle

> PetOS simulates an animal first and renders a desktop companion second.

The success metric is not animation count. It is whether a pet surprises you in a way that makes sense.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the engine design and [`docs/STATUS.md`](docs/STATUS.md) for what is verified versus what still requires a Windows build machine.
