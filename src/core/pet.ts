import { PetBrain } from "./brain.js";
import { clamp01, clamp11, lerp } from "./math.js";
import { PetMemory } from "./memory.js";
import type { RandomSource } from "./rng.js";
import { DEFAULT_TRAITS, SPECIES } from "./species.js";
import type { Decision, Drives, PetState, SpeciesId, WorldObservation } from "./types.js";

export interface PetOptions {
  id: string;
  name: string;
  species?: SpeciesId;
  nowMs?: number;
}

export class Pet {
  readonly memory = new PetMemory();
  readonly state: PetState;
  private readonly brain: PetBrain;

  constructor(options: PetOptions, rng: RandomSource) {
    const species = options.species ?? "cat";
    const nowMs = options.nowMs ?? Date.now();
    this.brain = new PetBrain(rng);
    this.state = {
      id: options.id,
      name: options.name,
      species,
      traits: { ...DEFAULT_TRAITS[species] },
      drives: {
        fatigue: 0.28,
        hunger: 0.18,
        play: 0.42,
        social: 0.34,
        curiosity: 0.5,
        comfortDeficit: 0.12
      },
      affect: { valence: 0.25, arousal: 0.45, stress: 0.08 },
      behavior: "observe",
      behaviorSinceMs: nowMs
    };
  }

  tick(world: WorldObservation, deltaMs: number): Decision {
    this.updateDrives(deltaMs, world);
    this.updateAffect(deltaMs, world);

    const decision = this.brain.decide(this.state, world, this.memory);
    if (decision.behavior !== this.state.behavior) {
      this.memory.remember({
        atMs: world.nowMs,
        type: "behavior",
        surfaceId: world.currentSurface.id,
        behavior: decision.behavior,
        valence: this.state.affect.valence * 0.25,
        description: `${this.state.name} chose ${decision.behavior}`
      });
      this.state.behavior = decision.behavior;
      this.state.behaviorSinceMs = world.nowMs;
    }

    this.applyBehaviorEffects(deltaMs);
    return decision;
  }

  receivePetting(world: WorldObservation, intensity = 0.6): void {
    const amount = clamp01(intensity);
    this.state.affect.valence = clamp11(this.state.affect.valence + 0.18 * amount);
    this.state.affect.stress = clamp01(this.state.affect.stress - 0.12 * amount);
    this.state.drives.social = clamp01(this.state.drives.social - 0.22 * amount);
    this.memory.remember({
      atMs: world.nowMs,
      type: "interaction",
      surfaceId: world.currentSurface.id,
      valence: 0.75 * amount,
      description: "Received petting from the user"
    });
  }

  private updateDrives(deltaMs: number, world: WorldObservation): void {
    const rates = SPECIES[this.state.species].driveRates;
    const d = this.state.drives;
    d.fatigue = clamp01(d.fatigue + rates.fatigue * deltaMs * (1.12 - this.state.traits.energy * 0.35));
    d.hunger = clamp01(d.hunger + rates.hunger * deltaMs * (0.72 + this.state.traits.foodDrive * 0.5));
    d.play = clamp01(d.play + rates.play * deltaMs * (0.6 + this.state.traits.playfulness * 0.75));
    d.social = clamp01(d.social + rates.social * deltaMs * (0.5 + this.state.traits.sociability * 0.8));
    d.curiosity = clamp01(d.curiosity + rates.curiosity * deltaMs * (0.55 + this.state.traits.curiosity * 0.75));
    d.comfortDeficit = clamp01(lerp(d.comfortDeficit, 1 - world.currentSurface.quality, Math.min(1, deltaMs / 15_000)));
  }

  private updateAffect(deltaMs: number, world: WorldObservation): void {
    const a = this.state.affect;
    const settle = Math.min(1, deltaMs / 60_000);
    a.valence = clamp11(lerp(a.valence, 0.15, settle));
    a.stress = clamp01(lerp(a.stress, world.currentSurface.moving ? 0.32 : 0.06, settle * 1.5));
    const activityArousal = world.userActivity === "gaming" ? 0.68 : world.userActivity === "typing" ? 0.5 : 0.3;
    a.arousal = clamp01(lerp(a.arousal, activityArousal, settle));
  }

  private applyBehaviorEffects(deltaMs: number): void {
    const seconds = deltaMs / 1000;
    const d: Drives = this.state.drives;
    switch (this.state.behavior) {
      case "sleep":
        d.fatigue = clamp01(d.fatigue - 0.0003 * seconds);
        d.play = clamp01(d.play + 0.00008 * seconds);
        break;
      case "rest":
        d.fatigue = clamp01(d.fatigue - 0.00008 * seconds);
        break;
      case "chase_cursor":
        d.play = clamp01(d.play - 0.0012 * seconds);
        d.fatigue = clamp01(d.fatigue + 0.00005 * seconds);
        break;
      case "seek_user":
        d.social = clamp01(d.social - 0.0008 * seconds);
        break;
      case "investigate":
      case "wander":
        d.curiosity = clamp01(d.curiosity - 0.0009 * seconds);
        d.fatigue = clamp01(d.fatigue + 0.00003 * seconds);
        break;
      case "groom":
        d.comfortDeficit = clamp01(d.comfortDeficit - 0.001 * seconds);
        break;
      default:
        break;
    }
  }
}
