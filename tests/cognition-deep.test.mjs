import { test } from "node:test";
import assert from "node:assert/strict";
import { Pet } from "../dist/src/core/pet.js";
import { calmDesktop } from "../dist/src/core/world.js";
import { PetMemory } from "../dist/src/core/memory.js";

test("hungry pet with a missing remembered bowl searches nearby, then gives up", () => {
  const pet = new Pet({ id: "seeker", name: "Seeker", species: "dog", nowMs: 0 }, undefined);
  const w = calmDesktop(10_000);
  w.objects = [{ id: "bowl1", kind: "bowl", contents: "food", position: { x: 800, y: 1040 }, radius: 18 }];
  // First: see the bowl so it enters object memory
  pet.tick(w, 16);
  w.objects = [];
  pet.state.drives.hunger = .95;
  pet.state.body.position = { x: 810, y: 1040 };
  pet.state.behaviorSinceMs = -30_000;
  const d = pet.tick(w, 16);
  const investigate = d.allScores.find(s => s.behavior === "investigate");
  assert.ok(investigate, "should seek the remembered bowl");
  // Arrive repeatedly without finding it → misses accumulate
  let searchReasons = 0;
  for (let i = 0; i < 40; i++) {
    w.nowMs += 2_000;
    pet.state.body.position = { x: 810 + (i % 3) * 20, y: 1040 };
    if (pet.state.behaviorSinceMs > w.nowMs) pet.state.behaviorSinceMs = -30_000;
    const step = pet.tick(w, 16);
    if (step.reason.includes("searching nearby")) searchReasons++;
    if (pet.state.behaviorSinceMs > w.nowMs) pet.state.behaviorSinceMs = -30_000;
  }
  assert.ok(searchReasons >= 2, `expected search behavior, got ${searchReasons}`);
});

test("toys become favorites through play and bias future play", () => {
  const mem = new PetMemory();
  mem.reinforceToy("ball-red", .3);
  mem.reinforceToy("ball-red", .3);
  assert.ok(mem.preferenceForToy("ball-red") > .5);
  assert.equal(mem.favoriteToy(), "ball-red");
  assert.equal(mem.preferenceForToy("ball-blue"), 0);
});

test("personality drifts toward lived experience", () => {
  const now = Date.now();
  const episodes = [];
  for (let i = 0; i < 12; i++) {
    episodes.push({ id: `p${i}`, atMs: now - i * 60_000, kind: "petting", valence: .85, salience: .7, note: "was petted" });
  }
  const pet = new Pet({ id: "drift", name: "Drift", species: "cat", nowMs: 0 }, undefined);
  for (const e of episodes) pet.memory.remember(e);
  const before = pet.state.personality.affection;
  // Force drift check by aging the last-drift marker beyond the hour window
  pet.lastDriftAt = now - 3_600_000 * 2;
  pet.tick({ ...calmDesktop(now), nowMs: now }, 16);
  assert.ok(pet.state.personality.affection > before, "a well-petted pet should grow more affectionate");
});

test("sleeping consolidates trust in the sleeping spot", () => {
  const pet = new Pet({ id: "consolidator", name: "Consol", species: "rabbit", nowMs: 0 }, undefined);
  const w = calmDesktop(100_000);
  w.currentSurface = { id: "window:fav", kind: "window", rect: { x: 0, y: 300, width: 500, height: 400 }, walkY: 300 };
  pet.state.behavior = "sleep";
  pet.state.behaviorSinceMs = 90_000;
  const before = pet.memory.preferenceForSurface("window:fav");
  pet.lastConsolidateAt = 80_000;
  pet.tick(w, 16);
  assert.ok(pet.memory.preferenceForSurface("window:fav") > before, "sleep should reinforce the sleeping surface");
});
