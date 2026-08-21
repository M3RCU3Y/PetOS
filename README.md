# PetOS 🐾

**A living-creature simulation that inhabits your desktop.**

PetOS is not a random sprite wandering over your taskbar. Every pet has species instincts, personality, drives, affect, memory, learned preferences, relationships, a body, and a model of the desktop world. The operating system becomes habitat: taskbars are floors, window tops are ledges, furniture is shelter, the cursor can become prey, and other pets are social agents.

## What is implemented

- Creature-first cognition with utility scoring and behavior inertia
- Cats, dogs, rabbits, and birds with different traits and locomotion
- Drives: fatigue, hunger, thirst, play, social need, curiosity, comfort
- Continuous affect: valence, arousal, stress
- Episodic memory, learned surface/app preferences, social relationships
- Keeper focus logic that reduces interruptions in fullscreen/gaming contexts
- Desktop topology from monitors, work areas, taskbar edges, and visible windows
- Cursor sensing and contextual chase/pounce behavior
- Gravity, jumping, falling, landing, walking, running and target following
- Multi-pet simulation and social behaviors
- Habitat objects: beds, balls and boxes
- Persistent pets, memory, appearance, objects and settings in local storage
- Built-in pet packs plus JSON community pack import
- Pixel renderer for all four starter species
- Drag/pet interaction mode
- Debug mind overlay showing behavior and drives
- Transparent always-on-top Tauri overlay
- Windows native sensor layer using Win32 APIs directly
- Tray controls and settings summon
- Browser/mock desktop mode for development without Windows
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

PetOS intentionally does not require GitHub Actions. Build and test locally.

## Interaction

PetOS normally uses click-through mode so it does not steal clicks from your applications. Open the tray menu and choose **Interact with pets**, or use the settings panel, to make the overlay interactive. Drag a pet to pick it up. Releasing it also counts as affectionate attention and contributes to learned location preferences.

`Ctrl + Shift + P` toggles interaction mode while the overlay has keyboard focus.

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
