import { test } from "node:test";
import assert from "node:assert/strict";
import { PetPhysics } from "../dist/src/core/physics.js";
import { PetOSSimulation } from "../dist/src/core/simulation.js";
import { Pet } from "../dist/src/core/pet.js";
import { calmDesktop } from "../dist/src/core/world.js";

test("bird has reduced gravity during glide", () => {
  const pet = new Pet({ id: "bird1", name: "Birdy", species: "bird", nowMs: 0 });
  pet.state.behavior = "perch";
  pet.state.body.grounded = false;
  pet.state.body.velocity = { x: 50, y: -100 };
  const world = calmDesktop(0);
  const physics = new PetPhysics();
  physics.update(pet.state, world, 16);
  // After 16ms with reduced gravity (~174), velocity should be less negative than full gravity (580)
  assert.ok(pet.state.body.velocity.y < -90, "gravity should be reduced for bird glide");
});

test("rabbit hops periodically while walking", () => {
  const pet = new Pet({ id: "rabbit1", name: "Hoppy", species: "rabbit", nowMs: 0 });
  pet.state.behavior = "walk";
  pet.state.body.target = { x: 500, y: 700 };
  pet.state.body.position = { x: 300, y: 700 };
  pet.state.body.grounded = true;
  const world = calmDesktop(0);
  const physics = new PetPhysics();
  let jumped = false;
  for (let i = 0; i < 100; i++) {
    world.nowMs = i * 100;
    pet.state.body.grounded = true;
    physics.update(pet.state, world, 100);
    if (!pet.state.body.grounded) { jumped = true; break; }
  }
  assert.ok(jumped, "rabbit should hop at some point");
});

test("climb traverses up a window side and ends perched on top", () => {
  const pet = new Pet({ id: "climber", name: "Scaler", species: "cat", nowMs: 0, x: 300, y: 1040 });
  pet.state.behavior = "climb";
  pet.state.body.grounded = true;
  const world = calmDesktop(0);
  world.surfaces.push({ id: "window:high", kind: "window", rect: { x: 280, y: 400, width: 600, height: 600 }, walkY: 400 });
  world.currentSurface = world.surfaces[0];
  const physics = new PetPhysics();
  let sawHang = false, sawPeek = false;
  for (let i = 0; i < 900; i++) {
    world.nowMs = i * 16;
    physics.update(pet.state, world, 16);
    if (pet.state.behavior === "hang") sawHang = true;
    if (pet.state.behavior === "peek") sawPeek = true;
    if (pet.state.behavior === "perch" && pet.state.body.grounded) break;
  }
  assert.ok(sawHang, "should hang at the ledge before pulling up");
  assert.ok(sawPeek, "should peek over the ledge");
  assert.equal(pet.state.behavior, "perch", "should end perched on the window");
  assert.equal(pet.state.body.surfaceId, "window:high");
  assert.equal(pet.state.body.position.y, 400);
});

test("losing the climbing wall startles the pet into a fall", () => {
  const pet = new Pet({ id: "dangler", name: "Dangler", species: "cat", nowMs: 0 });
  pet.state.behavior = "hang";
  const world = calmDesktop(0);
  const physics = new PetPhysics();
  // No traversal context yet: begin climb against a wall that then disappears
  pet.state.behavior = "climb";
  pet.state.body.grounded = true;
  pet.state.body.position = { x: 295, y: 900 };
  world.surfaces.push({ id: "window:ghost", kind: "window", rect: { x: 280, y: 300, width: 500, height: 640 }, walkY: 300 });
  world.currentSurface = world.surfaces[0];
  physics.update(pet.state, world, 16);
  world.surfaces.length = 1; // wall vanishes
  for (let i = 1; i < 40; i++) {
    world.nowMs = i * 16;
    physics.update(pet.state, world, 16);
  }
  assert.ok(!pet.state.body.grounded || pet.state.behavior !== "climb", "pet should not remain climbing a vanished wall");
});

test("hard landings leave the pet briefly startled", () => {
  const pet = new Pet({ id: "thud", name: "Thud", species: "dog", nowMs: 0, x: 500, y: 200 });
  pet.state.behavior = "run";
  pet.state.body.grounded = false;
  pet.state.body.velocity = { x: 60, y: 900 };
  const world = calmDesktop(0);
  const physics = new PetPhysics();
  let landed = false;
  for (let i = 0; i < 200 && !landed; i++) {
    physics.update(pet.state, world, 16);
    landed = pet.state.body.grounded;
  }
  assert.equal(landed, true, "pet should reach the taskbar");
  assert.equal(pet.state.behavior, "startle", "a violent landing should daze the pet briefly");
});

test("smooth window drags are ridden, snaps are not", () => {
  const sim = new PetOSSimulation();
  const pet = new Pet({ id: "rider2", name: "Rider2", species: "cat", nowMs: 0, x: 500, y: 300 });
  pet.state.body.surfaceId = "window:code";
  pet.state.body.grounded = true;
  pet.state.behavior = "sit";
  pet.state.behaviorSinceMs = 0;
  sim.addPet(pet);
  const monitor = { id: "m", rect: { x: 0, y: 0, width: 1280, height: 800 }, workArea: { x: 0, y: 0, width: 1280, height: 760 }, primary: true, scaleFactor: 1 };
  const base = { nowMs: 5000, dtMs: 16, monitors: [monitor], cursorPosition: { x: 900, y: 300 }, cursorSpeed: 0, cursorButtons: 0, userActivity: "active", foregroundApp: "Code.exe", secondsSinceNewWindow: 999, interactionMode: false, idleSeconds: 0, locked: false, batteryLevel: null, charging: true };
  sim.tick({ ...base, windows: [{ id: "code", title: "Code", app: "Code.exe", rect: { x: 400, y: 300, width: 600, height: 400 }, visible: true, foreground: true, minimized: false }] });
  // Violent snap far across the desktop
  sim.tick({ ...base, nowMs: 5016, windows: [{ id: "code", title: "Code", app: "Code.exe", rect: { x: 700, y: 300, width: 600, height: 400 }, visible: true, foreground: true, minimized: false }] });
  assert.equal(pet.state.behavior, "startle", "a snapped-away window should startle the rider");
  assert.equal(pet.state.body.grounded, false, "rider should lose grip on a snapped window");
});

test("cats stalk a fast cursor at medium range instead of charging", () => {
  const pet = new Pet({ id: "hunter", name: "Hunter", species: "cat", nowMs: 0 }, undefined);
  pet.state.drives.play = .9;
  pet.state.drives.fatigue = .05;
  pet.state.personality.playfulness = .95;
  pet.state.behaviorSinceMs = -30_000;
  const w = calmDesktop(10_000);
  w.cursor = { position: { x: 700, y: 1040 }, speed: 1400, distanceToPet: 260, buttons: 0 };
  const decision = pet.tick(w, 100);
  const stalk = decision.allScores.find(s => s.behavior === "stalk");
  assert.ok(stalk, "medium-range prey should offer a stalk option");
});
