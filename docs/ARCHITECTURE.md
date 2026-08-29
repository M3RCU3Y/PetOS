# PetOS architecture

## 1. Core rule

The brain never commands pixels. It chooses goals and behaviors. Physics moves the body. The renderer observes the body. Native platform code only supplies perception and window control.

This prevents three common desktop-pet failure modes: scripted animation roulette, OS-specific logic infecting behavior code, and AI models micromanaging movement.

## 2. Cognition stack

### Reflex/body layer
Gravity, surface collision, held state and immediate movement constraints.

### Drives
Fatigue, hunger, thirst, play, social need, curiosity and comfort change slowly and are affected by behavior.

### Affect
Valence, arousal and stress bias behavior without becoming cartoon mood labels.

### Personality
Nine continuous traits modify species defaults. Personality is stable; drives and affect are dynamic.

### Utility brain
Candidate behaviors receive scores from needs, personality, species bias, context, learned preference, relationships and controlled stochastic noise. Behavior inertia gives chosen actions enough time to read as intentional.

### Keeper
Focus-aware suppression sits between social drive and interruption. Fullscreen, gaming and presentation contexts strongly reduce attention-seeking without pausing autonomous life.

### Cortex
`src/core/cortex.ts` is a deliberately high-level intelligence interface. Optional future local/cloud models should produce intentions, never frame-by-frame movement.

## 3. Memory

`PetMemory` stores a bounded episodic stream plus consolidated maps:

- surface preference
- foreground-app preference
- relationships with other pets

Positive repeated experiences reinforce places. Preferences decay slowly rather than becoming permanent after one event.

## 4. World model

Native desktop input is converted into neutral entities:

- monitors and work areas
- taskbar/floor surfaces
- visible window top surfaces
- cursor state
- habitat objects
- nearby pets

The brain sees these entities, not HWNDs or Tauri objects.

## 5. Simulation

`PetOSSimulation` owns many `Pet` instances and shared habitat objects. Each tick creates a pet-relative `WorldSnapshot`, runs cognition, then physics.

The current rates are intentionally decoupled by responsibility even though the browser driver presently invokes them from a single animation loop. Native desktop sensing is throttled to roughly 10 Hz, while rendering can remain 60 Hz.

## 6. Rendering

The alpha renderer is procedural pixel art. This is intentional: PetOS can exercise every behavior and species without waiting on an asset pipeline. The renderer is replaceable by sprite-sheet pet packs later.

## 7. Desktop shell

Tauri 2 owns one transparent, borderless, always-on-top overlay. The Rust layer:

- stretches it across the Windows virtual desktop
- defaults to click-through
- exposes an interaction mode
- creates a tray menu
- enumerates visible top-level windows
- enumerates monitor/work areas
- reads global cursor position/buttons
- identifies foreground process names
- infers fullscreen activity

The Win32 sensor code uses direct FFI so PetOS does not need a second Windows wrapper crate just to read basic geometry.

## 8. Persistence

The alpha stores the complete creature record in browser local storage. Saves contain versioned pet state, episodic memory, consolidated preferences and appearance. Storage is behind a tiny adapter so it can migrate to SQLite without changing cognition.

## 9. Pet packs

Current packs are JSON identity bundles. The target pack system will eventually add:

- sprite atlases and animation metadata
- sounds
- species/ethogram extensions
- accessories and markings
- behavior affordances
- signed metadata and compatibility versioning

## 10. Future platform adapters

The simulation is platform-neutral. Windows is first because window geometry and taskbar interaction are central to the product. macOS and Linux should implement the same `DesktopFrame` contract rather than fork the creature engine.
