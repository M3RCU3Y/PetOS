import { Pet } from "./core/pet.js";
import { SeededRandom } from "./core/rng.js";
import { calmDesktop } from "./core/world.js";

const rng = new SeededRandom(42);
const pet = new Pet({ id: "pet-1", name: "Mochi", species: "cat", nowMs: 0 }, rng);

let nowMs = 0;
for (let step = 0; step < 12; step += 1) {
  nowMs += 5_000;
  const world = calmDesktop(nowMs);

  if (step >= 3 && step <= 5) {
    world.cursorSpeed = 1450;
    world.cursorDistance = 90;
  }

  if (step === 7) {
    world.secondsSinceNewWindow = 1;
    world.currentSurface = {
      id: "window:vscode",
      kind: "window",
      quality: 0.82,
      elevation: 0.72,
      moving: false
    };
  }

  const decision = pet.tick(world, 5_000);
  console.log(
    `${String(nowMs / 1000).padStart(3)}s  ${decision.behavior.padEnd(14)} score=${decision.score.toFixed(2)}  ${decision.reasons.join("; ")}`
  );
}
