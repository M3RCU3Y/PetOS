import { clamp01 } from "./math.js";
import type { RandomSource } from "./rng.js";
import { SPECIES } from "./species.js";
import type { BehaviorId, BehaviorScore, Decision, PetState, WorldObservation } from "./types.js";
import type { PetMemory } from "./memory.js";

const MIN_BEHAVIOR_MS: Partial<Record<BehaviorId, number>> = {
  sleep: 20_000,
  rest: 8_000,
  groom: 5_000,
  observe: 4_000,
  perch: 8_000,
  investigate: 3_000,
  seek_user: 3_000,
  chase_cursor: 1_500,
  wander: 3_000
};

function scored(behavior: BehaviorId, score: number, ...reasons: string[]): BehaviorScore {
  return { behavior, score: Math.max(0, score), reasons };
}

export class PetBrain {
  constructor(private readonly rng: RandomSource) {}

  decide(state: PetState, world: WorldObservation, memory: PetMemory): Decision {
    const t = state.traits;
    const d = state.drives;
    const a = state.affect;
    const species = SPECIES[state.species];
    const surfacePreference = Math.max(0, memory.preferenceForSurface(world.currentSurface.id));
    const newWindow = world.secondsSinceNewWindow !== null && world.secondsSinceNewWindow < 12 ? 1 - world.secondsSinceNewWindow / 12 : 0;
    const cursorInterest = clamp01(world.cursorSpeed / 1800) * clamp01(1 - world.cursorDistance / 700);
    const recentlyPetted = world.recentPettingSecondsAgo !== null && world.recentPettingSecondsAgo < 20
      ? 1 - world.recentPettingSecondsAgo / 20
      : 0;
    const safeToInterrupt = world.userActivity !== "gaming" && world.userActivity !== "fullscreen";

    const scores: BehaviorScore[] = [
      scored("sleep", d.fatigue * 1.55 + (1 - a.arousal) * 0.28 + world.currentSurface.quality * 0.18,
        `fatigue ${d.fatigue.toFixed(2)}`, `surface comfort ${world.currentSurface.quality.toFixed(2)}`),
      scored("rest", d.fatigue * 0.75 + (1 - a.arousal) * 0.2 + surfacePreference * 0.18,
        `fatigue ${d.fatigue.toFixed(2)}`, `familiarity ${surfacePreference.toFixed(2)}`),
      scored("groom", 0.16 + d.comfortDeficit * 0.25 + (1 - a.stress) * 0.12,
        `comfort deficit ${d.comfortDeficit.toFixed(2)}`),
      scored("wander", d.curiosity * 0.62 + t.energy * 0.18 + (world.userIdleSeconds > 120 ? 0.12 : 0),
        `curiosity drive ${d.curiosity.toFixed(2)}`),
      scored("investigate", d.curiosity * 0.68 + t.curiosity * 0.38 + newWindow * 0.62 + (world.currentSurface.moving ? 0.2 : 0),
        `trait curiosity ${t.curiosity.toFixed(2)}`, `novelty ${newWindow.toFixed(2)}`),
      scored("chase_cursor", d.play * 0.8 + t.playfulness * 0.48 + cursorInterest * 0.85 - a.stress * 0.22,
        `play drive ${d.play.toFixed(2)}`, `cursor interest ${cursorInterest.toFixed(2)}`),
      scored("seek_user", safeToInterrupt ? d.social * 0.72 + t.sociability * 0.4 + t.affection * 0.26 + recentlyPetted * 0.18 : 0.03,
        safeToInterrupt ? `social drive ${d.social.toFixed(2)}` : "keeper: user is busy"),
      scored("perch", world.currentSurface.elevation * 0.42 + world.currentSurface.quality * 0.28 + surfacePreference * 0.32,
        `elevation ${world.currentSurface.elevation.toFixed(2)}`, `preference ${surfacePreference.toFixed(2)}`),
      scored("observe", 0.2 + t.curiosity * 0.24 + (world.userActivity === "typing" ? 0.16 : 0) + surfacePreference * 0.12,
        `curiosity ${t.curiosity.toFixed(2)}`)
    ];

    for (const item of scores) {
      item.score += species.behaviorBias[item.behavior] ?? 0;
      item.score += (this.rng.next() - 0.5) * 0.08;
      if (item.behavior === state.behavior) item.score += 0.13 + t.patience * 0.12;
    }

    const currentAge = world.nowMs - state.behaviorSinceMs;
    const minimum = MIN_BEHAVIOR_MS[state.behavior] ?? 2_000;
    if (currentAge < minimum) {
      const current = scores.find((item) => item.behavior === state.behavior);
      if (current) {
        current.score += 2;
        current.reasons.push(`behavior inertia ${Math.round((minimum - currentAge) / 1000)}s`);
      }
    }

    scores.sort((a, b) => b.score - a.score);
    const winner = scores[0];
    if (!winner) throw new Error("PetBrain produced no candidate behaviors");

    return {
      behavior: winner.behavior,
      score: winner.score,
      reasons: winner.reasons,
      allScores: scores
    };
  }
}
