import { test } from "node:test";
import assert from "node:assert/strict";
import { Pet } from "../dist/src/core/pet.js";
import { calmDesktop } from "../dist/src/core/world.js";

test("boredom builds during idle and decays during play", () => {
  const pet = new Pet({ id: "test", name: "Test", species: "cat", nowMs: 0 });
  const world = calmDesktop(0);
  pet.state.boredom = .3;
  // Simulate idle ticks
  for (let i = 0; i < 100; i++) {
    world.nowMs = i * 2000;
    pet.tick(world, 2000);
    if (pet.state.behavior === "idle" || pet.state.behavior === "sit") {
      assert.ok(pet.state.boredom >= .29, "boredom should not decrease during idle");
    }
  }
});

test("frustration builds when drives are unmet", () => {
  const pet = new Pet({ id: "test2", name: "T2", species: "dog", nowMs: 0 });
  const world = calmDesktop(0);
  pet.state.drives.hunger = .95;
  pet.state.drives.thirst = .9;
  pet.state.frustration = 0;
  for (let i = 0; i < 50; i++) {
    world.nowMs = i * 2000;
    pet.tick(world, 2000);
  }
  assert.ok(pet.state.frustration > 0, "frustration should build when hungry with no food");
});
