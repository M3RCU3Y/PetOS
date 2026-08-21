import type { BehaviorId, PetTraits, SpeciesId } from "./types.js";

export interface SpeciesProfile {
  id: SpeciesId;
  behaviorBias: Partial<Record<BehaviorId, number>>;
  driveRates: {
    fatigue: number;
    hunger: number;
    play: number;
    social: number;
    curiosity: number;
  };
}

export const SPECIES: Record<SpeciesId, SpeciesProfile> = {
  cat: {
    id: "cat",
    behaviorBias: { sleep: 0.12, groom: 0.16, perch: 0.22, chase_cursor: 0.12, observe: 0.1 },
    driveRates: { fatigue: 0.00000007, hunger: 0.000000035, play: 0.00000035, social: 0.00000016, curiosity: 0.00000042 }
  },
  dog: {
    id: "dog",
    behaviorBias: { seek_user: 0.24, wander: 0.08, chase_cursor: 0.08 },
    driveRates: { fatigue: 0.000000075, hunger: 0.00000004, play: 0.00000038, social: 0.00000024, curiosity: 0.00000034 }
  },
  rabbit: {
    id: "rabbit",
    behaviorBias: { rest: 0.1, investigate: 0.08, observe: 0.16 },
    driveRates: { fatigue: 0.000000065, hunger: 0.000000045, play: 0.0000003, social: 0.00000018, curiosity: 0.00000038 }
  },
  bird: {
    id: "bird",
    behaviorBias: { perch: 0.28, investigate: 0.14, observe: 0.14 },
    driveRates: { fatigue: 0.00000006, hunger: 0.000000038, play: 0.00000036, social: 0.0000002, curiosity: 0.00000048 }
  }
};

export const DEFAULT_TRAITS: Record<SpeciesId, PetTraits> = {
  cat: { energy: 0.58, curiosity: 0.72, sociability: 0.46, affection: 0.62, boldness: 0.58, patience: 0.56, playfulness: 0.66, foodDrive: 0.48 },
  dog: { energy: 0.7, curiosity: 0.65, sociability: 0.82, affection: 0.82, boldness: 0.66, patience: 0.54, playfulness: 0.8, foodDrive: 0.68 },
  rabbit: { energy: 0.58, curiosity: 0.58, sociability: 0.52, affection: 0.52, boldness: 0.32, patience: 0.62, playfulness: 0.56, foodDrive: 0.62 },
  bird: { energy: 0.72, curiosity: 0.78, sociability: 0.62, affection: 0.5, boldness: 0.52, patience: 0.42, playfulness: 0.68, foodDrive: 0.5 }
};
