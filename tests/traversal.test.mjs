import { test } from "node:test";
import assert from "node:assert/strict";
import { PetPhysics } from "../dist/src/core/physics.js";
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
