# Build status

## Verified in the development VM

- TypeScript strict compilation
- static web build
- 11 deterministic engine tests
- headless behavior simulation
- save/restore memory path
- multi-pet simulation path
- geometry-to-surface conversion
- cursor prey response
- Keeper fullscreen suppression
- physics surface landing
- community pack validation

Commands used:

```text
npm run build
npm test
npm run demo
```

## Implemented but not executable in this VM

The Tauri/Win32 shell is present in `src-tauri/`, but the supplied development VM is Linux and does not contain a Rust toolchain. Therefore this repository does **not** claim that the Windows installer has been compiled in this environment.

The native layer should be compiled on Windows before an alpha release is tagged. Any compile/API issues found there should be fixed locally rather than by adding a paid GitHub Actions pipeline.

## Alpha acceptance checklist

- [x] creature simulation exists independently of UI
- [x] multiple species are behaviorally distinct
- [x] memory changes future preference
- [x] pets react causally to cursor/context
- [x] multi-pet simulation exists
- [x] furniture/toy objects exist
- [x] browser development habitat exists
- [x] persistent world exists
- [x] Tauri shell exists
- [x] Windows desktop sensor implementation exists
- [ ] compile Tauri shell on a Windows machine with Rust/MSVC installed
- [ ] replace procedural art with production sprite packs
- [ ] native per-pixel hit testing so only pet pixels capture clicks
- [ ] signed installer/release packaging
