# PetOS Architecture

PetOS is a creature simulation first and a desktop overlay second. The goal is believable causality: behavior should emerge from perception, drives, affect, personality, memory, species instincts, and the current desktop world.

## Runtime layers

1. **Platform sensor**: monitors, taskbar, visible windows, cursor, active-app category, idle state.
2. **World model**: converts raw OS geometry into surfaces, edges, moving platforms, objects, pets, and affordances.
3. **Body**: locomotion, collision, jumping, falling, climbing, carrying, dragging.
4. **Cognition**: utility scoring chooses goals. Behavior inertia and cooldowns prevent twitchy randomness.
5. **Affect**: continuous valence/arousal/stress changes decision weights rather than merely selecting a facial animation.
6. **Memory**: episodic interactions consolidate into preferences and habits.
7. **Keeper**: interruption policy keeps the pet quiet during gaming, fullscreen apps, presentations, and user dismissals.
8. **Cortex (optional)**: rare high-level LLM/VLM reasoning. It proposes intentions, never frame-by-frame movement.
9. **Renderer**: pixel-art sprite animation. Rendering must never own cognition state.

## Platform boundary

The simulation core must not import Tauri or Win32 APIs. A platform adapter will emit observations into the core. This makes the brain testable headlessly and gives us a future path to macOS/Linux.

The Windows implementation is planned around Tauri 2 + Rust. Pet windows will be transparent, borderless, always-on-top and normally click-through except while directly interacting with a pet. Native Windows APIs will provide real desktop/window topology where Tauri does not expose enough detail.

## Decision principle

Animations are outputs, not decisions.

Bad:

`random -> animation`

PetOS:

`perception -> world -> needs/emotion/memory -> goal -> behavior -> locomotion -> animation`

This lets seven ordinary animations form a small causal story instead of a screensaver.

## Simulation rates

- body/physics: 60 Hz
- animation: 60 Hz
- perception: ~10 Hz
- world topology: 2-5 Hz, plus OS events
- drive/affect updates: ~5 Hz
- utility reevaluation: 2-5 Hz
- memory consolidation: event-driven
- optional model inference: rare/event-driven

## Near-term milestones

### 0.1 Creature
Headless cognition engine, species profiles, drives, affect, memory, Keeper constraints and deterministic tests.

### 0.2 World
Windows taskbar/monitor topology, surfaces and cursor perception.

### 0.3 Body
Real transparent pet window, taskbar locomotion, jump/fall/perch and mouse interaction.

### 0.4 Learning
Persistent SQLite memories, favorite places, habits and adaptation.

### 0.5 Pack
Multiple pets and social relationships.
