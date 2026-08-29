import { test } from "node:test";
import assert from "node:assert/strict";
import { ObjectPermanence } from "../dist/src/core/objectMemory.js";

test("object permanence remembers and finds nearest", () => {
  const mem = new ObjectPermanence();
  mem.observe([
    { id: "food1", kind: "bowl", position: { x: 100, y: 200 }, radius: 18, contents: "food" },
    { id: "bed1", kind: "bed", position: { x: 500, y: 300 }, radius: 38 }
  ], 0);
  assert.ok(mem.knowsAbout("bowl"));
  const nearest = mem.findNearest("bowl", { x: 0, y: 0 });
  assert.ok(nearest !== null);
  assert.equal(nearest.id, "food1");
});

test("stale memories are forgotten", () => {
  const mem = new ObjectPermanence();
  mem.observe([{ id: "ball1", kind: "ball", position: { x: 50, y: 50 }, radius: 11 }], 0);
  mem.observe([], 6 * 60 * 1000 + 1);
  assert.ok(!mem.knowsAbout("ball"));
});
