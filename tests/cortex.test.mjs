import { test } from "node:test";
import assert from "node:assert/strict";
import { HeuristicCortex, OllamaCortex, createCortex } from "../dist/src/core/cortex.js";
import { Pet } from "../dist/src/core/pet.js";
import { calmDesktop } from "../dist/src/core/world.js";

test("heuristic cortex settles during gaming", async () => {
  const pet = new Pet({ id: "polite2", name: "Polite", species: "cat", nowMs: 0 });
  const w = calmDesktop(1000);
  w.userActivity = "gaming";
  const intent = await new HeuristicCortex().reflect(pet.state, w);
  assert.equal(intent.kind, "settle");
  assert.ok(intent.confidence >= .8);
});

test("heuristic cortex seeks attention when bonded and lonely", async () => {
  const pet = new Pet({ id: "clingy", name: "Clingy", species: "dog", nowMs: 0 });
  pet.state.drives.social = .9;
  pet.state.bond = .6;
  const intent = await new HeuristicCortex().reflect(pet.state, calmDesktop(1000));
  assert.equal(intent.kind, "seek_attention");
});

test("ollama cortex falls back to heuristics when unreachable", async () => {
  const pet = new Pet({ id: "offline", name: "Offline", species: "cat", nowMs: 0 });
  pet.state.drives.play = .95;
  const cortex = new OllamaCortex("http://127.0.0.1:59999", "nope");
  const intent = await cortex.reflect(pet.state, calmDesktop(1000));
  // Unreachable provider must degrade to the heuristic result, never hang or throw
  assert.equal(intent.kind, "play");
});

test("factory returns heuristic when off and ollama provider when requested", () => {
  assert.ok(createCortex("off") instanceof HeuristicCortex);
  assert.ok(createCortex("ollama") instanceof OllamaCortex);
});
