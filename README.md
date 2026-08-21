# PetOS

**A living-creature simulation for your desktop.**

PetOS is not meant to be a sprite that picks random animations. The project treats each desktop pet as a small autonomous animal with species instincts, personality, drives, emotion, memory, habits, perception and a physical relationship with the desktop environment.

The operating system becomes the habitat: taskbars are floors, window tops are ledges, moving windows are platforms, the cursor is something interesting to stalk, and other pets are social agents.

## Design rule

> Simulate an animal first. Render a desktop companion second.

A believable PetOS chain looks like:

`boredom -> exploration -> notices new window -> jumps to ledge -> cursor passes -> stalks -> pounces -> tires -> grooms -> sleeps on a remembered comfortable surface`

The animation set can be small. The causal structure must be rich.

## Current foundation

The first code in this repository is the headless cognition kernel:

- species-specific behavior biases
- persistent personality traits
- dynamic drives
- continuous valence/arousal/stress
- utility-based behavior selection
- controlled stochasticity
- behavior inertia to prevent random twitching
- episodic memory and learned surface preferences
- an early Keeper rule that suppresses interruptions during fullscreen/gaming contexts
- deterministic tests

Run the simulation locally:

```bash
npm run demo
npm test
```

No GitHub Actions are required. Development and tests are intended to run locally.

## Planned desktop stack

- **Tauri 2 + Rust** for the native application and platform adapters
- **TypeScript** for portable simulation/application logic
- **PixiJS/WebGL** for pixel rendering
- **SQLite** for long-term pet memory
- **Win32** for rich Windows topology and surface interaction

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Status

Very early alpha. The creature brain exists first; the Windows body comes next.
