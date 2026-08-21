export type SpeciesId = "cat" | "dog" | "rabbit" | "bird";

export type BehaviorId =
  | "sleep"
  | "rest"
  | "groom"
  | "wander"
  | "investigate"
  | "chase_cursor"
  | "seek_user"
  | "perch"
  | "observe";

export interface PetTraits {
  energy: number;
  curiosity: number;
  sociability: number;
  affection: number;
  boldness: number;
  patience: number;
  playfulness: number;
  foodDrive: number;
}

export interface Drives {
  fatigue: number;
  hunger: number;
  play: number;
  social: number;
  curiosity: number;
  comfortDeficit: number;
}

export interface Affect {
  valence: number;
  arousal: number;
  stress: number;
}

export interface SurfaceObservation {
  id: string;
  kind: "taskbar" | "window" | "furniture" | "desktop";
  quality: number;
  elevation: number;
  moving: boolean;
}

export interface WorldObservation {
  nowMs: number;
  cursorSpeed: number;
  cursorDistance: number;
  userIdleSeconds: number;
  userActivity: "idle" | "light" | "typing" | "gaming" | "fullscreen";
  secondsSinceNewWindow: number | null;
  currentSurface: SurfaceObservation;
  nearbyPetCount: number;
  recentPettingSecondsAgo: number | null;
}

export interface BehaviorScore {
  behavior: BehaviorId;
  score: number;
  reasons: string[];
}

export interface Decision {
  behavior: BehaviorId;
  score: number;
  reasons: string[];
  allScores: BehaviorScore[];
}

export interface EpisodicMemory {
  atMs: number;
  type: "interaction" | "behavior" | "environment";
  surfaceId: string;
  behavior?: BehaviorId;
  valence: number;
  description: string;
}

export interface PetState {
  id: string;
  name: string;
  species: SpeciesId;
  traits: PetTraits;
  drives: Drives;
  affect: Affect;
  behavior: BehaviorId;
  behaviorSinceMs: number;
}
