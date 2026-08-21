import { test } from "node:test";
import assert from "node:assert/strict";
import { PetMemory } from "../dist/src/core/memory.js";
import { Pet } from "../dist/src/core/pet.js";
import { calmDesktop } from "../dist/src/core/world.js";
import { PetOSSimulation } from "../dist/src/core/simulation.js";

test("legacy flat relationship numbers migrate into the rich model", () => {
  const mem = new PetMemory({ relationships: { buddy: .6 } });
  const rel = mem.relate("buddy");
  assert.equal(rel.familiarity, .6);
  assert.equal(rel.affection, 0);
  assert.ok(mem.relationshipWith("buddy") > 0);
});

test("encounters shape distinct relationship components", () => {
  const mem = new PetMemory();
  for (let i = 0; i < 10; i++) {
    mem.noteEncounter("friend", "cuddle");
    mem.noteEncounter("rival", "fight");
  }
  const friend = mem.relate("friend");
  const rival = mem.relate("rival");
  assert.ok(friend.affection > .2, "cuddling builds affection");
  assert.ok(friend.irritation < 0, "cuddling soothes irritation");
  assert.ok(rival.rivalry > .25, "scuffles build rivalry");
  assert.ok(mem.relationshipWith("friend") > mem.relationshipWith("rival"));
});

test("a sleeping trusted friend invites cuddling", () => {
  const pet = new Pet({ id: "snuggler", name: "Snug", species: "cat", nowMs: 0 }, undefined);
  pet.state.drives.fatigue = .8;
  pet.state.personality.sociability = .9;
  pet.state.behaviorSinceMs = -30_000;
  const w = calmDesktop(10_000);
  w.nearbyPets = [{
    id: "pal", species: "rabbit", behavior: "sleep",
    position: { x: 320, y: 1040 }, distance: 60, relationship: 0
  }];
  pet.memory.noteEncounter("pal", "share");
  pet.memory.noteEncounter("pal", "cuddle");
  for (let i = 0; i < 8; i++) pet.memory.noteEncounter("pal", "play");
  const d = pet.tick(w, 16);
  assert.ok(d.allScores.some(s => s.behavior === "cuddle"), "should consider cuddling a sleeping friend");
});

test("an occupied bed becomes contested between rivals but shared among friends", () => {
  const rivalPet = new Pet({ id: "grumpy", name: "Grumpy", species: "dog", nowMs: 0 }, undefined);
  rivalPet.state.drives.fatigue = .9;
  rivalPet.state.behaviorSinceMs = -30_000;
  const w = calmDesktop(10_000);
  w.objects = [{ id: "bed1", kind: "bed", position: { x: 400, y: 1040 }, radius: 38, comfort: .95 }];
  w.nearbyPets = [{ id: "enemy", species: "cat", behavior: "sleep", position: { x: 405, y: 1040 }, distance: 20, relationship: 0 }];
  for (let i = 0; i < 12; i++) rivalPet.memory.noteEncounter("enemy", "steal");
  const d = rivalPet.tick(w, 16);
  const contest = d.allScores.find(s => s.behavior === "play_fight" && s.reason.includes("bed"));
  assert.ok(contest, "rival occupant should trigger a bed contest");

  const friendly = new Pet({ id: "polite", name: "Polite", species: "dog", nowMs: 0 }, undefined);
  friendly.state.drives.fatigue = .9;
  friendly.state.behaviorSinceMs = -30_000;
  for (let i = 0; i < 12; i++) friendly.memory.noteEncounter("buddy", "groom" in {} ? "greet" : "cuddle");
  w.nearbyPets = [{ id: "buddy", species: "cat", behavior: "sleep", position: { x: 405, y: 1040 }, distance: 20, relationship: 0 }];
  const d2 = friendly.tick(w, 16);
  const share = d2.allScores.find(s => s.reason.includes("shares a warm bed"));
  assert.ok(share, "trusted friend should be shared with");
});

test("unfamiliar pets spark curiosity instead of instant friendship", () => {
  const pet = new Pet({ id: "shy", name: "Shy", species: "rabbit", nowMs: 0 }, undefined);
  pet.state.behaviorSinceMs = -30_000;
  const w = calmDesktop(10_000);
  w.nearbyPets = [{ id: "newcomer", species: "bird", behavior: "idle", position: { x: 500, y: 1000 }, distance: 200, relationship: 0 }];
  const d = pet.tick(w, 16);
  const curiosity = d.allScores.find(s => s.behavior === "investigate" && s.reason.includes("newcomer"));
  assert.ok(curiosity, "should investigate unfamiliar pets");
});
