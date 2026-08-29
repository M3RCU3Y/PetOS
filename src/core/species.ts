import type { Behavior, Personality, Species } from "./types.js";

export interface SpeciesProfile {
  species: Species;
  defaultPersonality: Personality;
  movement: { walkSpeed: number; runSpeed: number; jumpSpeed: number; gravity: number; bodyWidth: number; bodyHeight: number; };
  behaviorBias: Partial<Record<Behavior, number>>;
  /** Cats scale window sides to reach high ledges; birds fly instead. */
  climber?: boolean;
}

const cat: SpeciesProfile = {
  species: "cat",
  defaultPersonality: { energy:.55, curiosity:.82, boldness:.58, sociability:.45, affection:.62, patience:.45, playfulness:.72, independence:.76, foodDrive:.52 },
  movement: { walkSpeed: 62, runSpeed: 170, jumpSpeed: 310, gravity: 900, bodyWidth: 54, bodyHeight: 44 },
  behaviorBias: { groom:.22, sleep:.18, chase_cursor:.3, pounce:.22, climb:.25, perch:.28, investigate:.2, seek_user:.02, scratch:.3 },
  climber: true
};
const dog: SpeciesProfile = {
  species: "dog",
  defaultPersonality: { energy:.7, curiosity:.65, boldness:.7, sociability:.88, affection:.9, patience:.5, playfulness:.86, independence:.28, foodDrive:.72 },
  movement: { walkSpeed: 70, runSpeed: 190, jumpSpeed: 270, gravity: 950, bodyWidth: 64, bodyHeight: 48 },
  behaviorBias: { seek_user:.3, follow_pet:.18, play_pet:.25, greet_pet:.25, carry_toy:.25, play_toy:.25, sleep:.05 }
};
const rabbit: SpeciesProfile = {
  species: "rabbit",
  defaultPersonality: { energy:.62, curiosity:.58, boldness:.33, sociability:.55, affection:.55, patience:.56, playfulness:.62, independence:.54, foodDrive:.66 },
  movement: { walkSpeed: 78, runSpeed: 210, jumpSpeed: 360, gravity: 930, bodyWidth: 49, bodyHeight: 42 },
  behaviorBias: { jump:.28, zoomies:.15, hide:.25, investigate:.12, sleep:.08 }
};
const bird: SpeciesProfile = {
  species: "bird",
  defaultPersonality: { energy:.76, curiosity:.78, boldness:.52, sociability:.66, affection:.54, patience:.35, playfulness:.68, independence:.64, foodDrive:.55 },
  movement: { walkSpeed: 48, runSpeed: 120, jumpSpeed: 420, gravity: 580, bodyWidth: 38, bodyHeight: 34 },
  behaviorBias: { perch:.38, investigate:.24, jump:.2, groom:.12, seek_user:.08 }
};

export const SPECIES: Record<Species, SpeciesProfile> = { cat, dog, rabbit, bird };

export function personalityFor(species: Species, overrides: Partial<Personality> = {}): Personality {
  return { ...SPECIES[species].defaultPersonality, ...overrides };
}
