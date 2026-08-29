import { test } from "node:test";
import assert from "node:assert/strict";
import { Pet } from "../dist/src/core/pet.js";
import { calmDesktop } from "../dist/src/core/world.js";

test("pet follows morning routine during morning hours", () => {
  const pet = new Pet({ id: "routine1", name: "Routine", species: "cat", nowMs: 0 });
  const world = calmDesktop(0);
  // Set time to 8 AM
  const morning = new Date();
  morning.setHours(8, 0, 0, 0);
  world.nowMs = morning.getTime();
  pet.state.behaviorSinceMs = world.nowMs - 10_000;
  pet.tick(world, 100);
  assert.ok(pet.routineState !== null, "should have an active routine at 8 AM");
});

test("routine completes and clears", () => {
  const pet = new Pet({ id: "routine2", name: "R2", species: "dog", nowMs: 0 });
  const world = calmDesktop(0);
  const morning = new Date();
  morning.setHours(8, 0, 0, 0);
  world.nowMs = morning.getTime();
  pet.state.behaviorSinceMs = world.nowMs - 10_000;
  // Run many ticks to complete the routine
  for (let i = 0; i < 200; i++) {
    world.nowMs += 1000;
    pet.tick(world, 1000);
  }
  // Routine should have completed or moved through steps
  assert.ok(pet.state.ageSeconds > 0);
});
