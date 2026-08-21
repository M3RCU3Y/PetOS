import test from "node:test";
import assert from "node:assert/strict";
import { Pet, SeededRandom, calmDesktop } from "../dist/index.js";

test("high fatigue makes sleep dominate once behavior inertia expires", () => {
  const pet = new Pet({ id: "a", name: "Nap", species: "cat", nowMs: 0 }, new SeededRandom(1));
  pet.state.drives.fatigue = 0.98;
  pet.state.behaviorSinceMs = -10_000;
  const world = calmDesktop(10_000);
  const decision = pet.tick(world, 100);
  assert.equal(decision.behavior, "sleep");
});

test("fast nearby cursor can trigger play-oriented chasing", () => {
  const pet = new Pet({ id: "b", name: "Rocket", species: "cat", nowMs: 0 }, new SeededRandom(2));
  pet.state.drives.fatigue = 0.05;
  pet.state.drives.play = 0.95;
  pet.state.drives.curiosity = 0.15;
  pet.state.behaviorSinceMs = -10_000;
  const world = calmDesktop(10_000);
  world.cursorSpeed = 2000;
  world.cursorDistance = 30;
  const decision = pet.tick(world, 100);
  assert.equal(decision.behavior, "chase_cursor");
});

test("behavior inertia prevents twitchy one-tick state changes", () => {
  const pet = new Pet({ id: "c", name: "Steady", species: "cat", nowMs: 0 }, new SeededRandom(3));
  pet.state.behavior = "groom";
  pet.state.behaviorSinceMs = 9_000;
  const world = calmDesktop(10_000);
  world.secondsSinceNewWindow = 0;
  const decision = pet.tick(world, 100);
  assert.equal(decision.behavior, "groom");
});

test("positive interactions teach a surface preference", () => {
  const pet = new Pet({ id: "d", name: "Memory", species: "cat", nowMs: 0 }, new SeededRandom(4));
  const world = calmDesktop(1_000);
  world.currentSurface.id = "window:vscode";
  for (let i = 0; i < 8; i += 1) pet.receivePetting(world, 1);
  assert.ok(pet.memory.preferenceForSurface("window:vscode") > 0.4);
});

test("keeper suppresses attention seeking during fullscreen activity", () => {
  const pet = new Pet({ id: "e", name: "Polite", species: "dog", nowMs: 0 }, new SeededRandom(5));
  pet.state.drives.social = 1;
  pet.state.drives.fatigue = 0.05;
  pet.state.behaviorSinceMs = -10_000;
  const world = calmDesktop(10_000);
  world.userActivity = "fullscreen";
  const decision = pet.tick(world, 100);
  const seek = decision.allScores.find((score) => score.behavior === "seek_user");
  assert.ok(seek);
  assert.ok(seek.score < 0.4);
});
