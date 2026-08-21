import { test } from "node:test";
import assert from "node:assert/strict";
import { PetOSSimulation } from "../dist/src/core/simulation.js";
import { Pet } from "../dist/src/core/pet.js";
import { calmDesktop } from "../dist/src/core/world.js";

test("adaptive tick rate slows when all pets are sleeping", () => {
  const sim = new PetOSSimulation();
  const pet = new Pet({ id: "sleepy", name: "Sleepy", species: "cat", nowMs: 0 });
  pet.state.behavior = "sleep";
  sim.addPet(pet);
  // At 200ms interval, a 16ms frame should not tick
  assert.equal(sim.shouldTick(16), false, "16ms should not trigger tick when sleeping");
  // A 200ms+ frame should tick
  assert.equal(sim.shouldTick(250), true, "250ms should trigger tick when sleeping");
});

test("normal tick rate when pets are active", () => {
  const sim = new PetOSSimulation();
  const pet = new Pet({ id: "active", name: "Active", species: "dog", nowMs: 0 });
  pet.state.behavior = "walk";
  sim.addPet(pet);
  assert.equal(sim.shouldTick(16), true, "16ms should trigger tick when active");
});
