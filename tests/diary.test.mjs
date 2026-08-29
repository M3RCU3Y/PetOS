import { test } from "node:test";
import assert from "node:assert/strict";
import { PetDiary, ACHIEVEMENTS } from "../dist/src/core/diary.js";
import { Pet } from "../dist/src/core/pet.js";

test("diary records entries", () => {
  const diary = new PetDiary();
  diary.record({ petId: "p1", atMs: Date.now(), kind: "milestone", title: "Test", detail: "Detail" });
  assert.ok(diary.recent.length === 1);
});

test("achievement unlocks when condition met", () => {
  const pet = new Pet({ id: "ach1", name: "A", species: "cat", nowMs: 0 });
  pet.state.ageSeconds = 90000; // > 1 day
  const diary = new PetDiary();
  const unlocked = diary.checkAchievements(pet.state);
  assert.ok(unlocked.some(a => a.id === "first-day"));
  assert.ok(diary.unlocked.includes("first-day"));
});

test("achievements don't re-unlock", () => {
  const pet = new Pet({ id: "ach2", name: "B", species: "cat", nowMs: 0 });
  pet.state.ageSeconds = 90000;
  const diary = new PetDiary();
  diary.checkAchievements(pet.state);
  const second = diary.checkAchievements(pet.state);
  assert.equal(second.filter(a => a.id === "first-day").length, 0);
});
