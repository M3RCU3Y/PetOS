export type Species = "cat" | "dog" | "rabbit" | "bird";

export type Behavior =
  | "idle" | "walk" | "run" | "sit" | "sleep" | "groom" | "stretch"
  | "investigate" | "chase_cursor" | "pounce" | "seek_user" | "zoomies"
  | "jump" | "climb" | "perch" | "hide" | "eat" | "drink"
  | "play_toy" | "carry_toy" | "follow_pet" | "play_pet" | "greet_pet" | "scratch"
  | "stalk" | "startle" | "hang" | "peek" | "cuddle" | "play_fight";

export type UserActivity = "idle" | "active" | "typing" | "media" | "gaming" | "fullscreen" | "presentation";
export type SurfaceKind = "taskbar" | "window" | "monitor_floor" | "furniture";
export type ObjectKind = "bed" | "ball" | "box" | "bowl" | "scratcher" | "toy" | "plant" | "perch" | "tunnel";

export interface Vec2 { x: number; y: number; }
export interface Rect { x: number; y: number; width: number; height: number; }

export interface Personality {
  energy: number;
  curiosity: number;
  boldness: number;
  sociability: number;
  affection: number;
  patience: number;
  playfulness: number;
  independence: number;
  foodDrive: number;
}

export interface Drives {
  fatigue: number;
  hunger: number;
  thirst: number;
  play: number;
  social: number;
  curiosity: number;
  comfort: number;
}

export interface Affect {
  valence: number;
  arousal: number;
  stress: number;
}

export interface BodyState {
  position: Vec2;
  velocity: Vec2;
  facing: -1 | 1;
  grounded: boolean;
  surfaceId: string | null;
  target: Vec2 | null;
  held: boolean;
}

export interface Surface {
  id: string;
  kind: SurfaceKind;
  rect: Rect;
  walkY: number;
  title?: string;
  app?: string;
  comfort?: number;
  moving?: boolean;
  velocity?: Vec2;
}

export interface WorldObject {
  id: string;
  kind: ObjectKind;
  position: Vec2;
  radius: number;
  comfort?: number;
  ownerPetId?: string;
  contents?: "food" | "water";
}

export interface NearbyPet {
  id: string;
  species: Species;
  position: Vec2;
  behavior: Behavior;
  distance: number;
  relationship: number;
}

export interface CursorState {
  position: Vec2;
  speed: number;
  distanceToPet: number;
  buttons: number;
}

export interface DesktopWindow {
  id: string;
  title: string;
  app: string;
  rect: Rect;
  visible: boolean;
  foreground: boolean;
  minimized: boolean;
}

export interface MonitorInfo {
  id: string;
  rect: Rect;
  workArea: Rect;
  primary: boolean;
  scaleFactor: number;
}

export interface WorldSnapshot {
  nowMs: number;
  dtMs: number;
  userActivity: UserActivity;
  cursor: CursorState;
  surfaces: Surface[];
  objects: WorldObject[];
  nearbyPets: NearbyPet[];
  windows: DesktopWindow[];
  monitors: MonitorInfo[];
  foregroundApp: string | null;
  secondsSinceNewWindow: number;
  currentSurface: Surface | null;
  interactionMode: boolean;
  idleSeconds: number;
  locked: boolean;
  batteryLevel: number | null;
  charging: boolean;
}

export interface DecisionScore {
  behavior: Behavior;
  score: number;
  reason: string;
  targetId?: string;
  targetPosition?: Vec2;
}

export interface Decision {
  behavior: Behavior;
  score: number;
  reason: string;
  targetId?: string;
  targetPosition?: Vec2;
  allScores: DecisionScore[];
}

export interface Relationship {
  familiarity: number;
  trust: number;
  affection: number;
  irritation: number;
  rivalry: number;
}

export type SocialEncounterKind = "greet" | "play" | "fight" | "cuddle" | "share" | "steal";

export interface EpisodicMemory {
  id: string;
  atMs: number;
  kind: "petting" | "play" | "sleep" | "surface" | "social" | "fright" | "discovery";
  subjectId?: string;
  surfaceId?: string;
  app?: string;
  valence: number;
  salience: number;
  note: string;
}

export interface PetState {
  id: string;
  name: string;
  species: Species;
  personality: Personality;
  drives: Drives;
  affect: Affect;
  body: BodyState;
  behavior: Behavior;
  behaviorSinceMs: number;
  behaviorTargetId: string | null;
  ageSeconds: number;
  bond: number;
  lastInteractionMs: number;
  frustration: number;
  boredom: number;
  novelty: number;
  habitStrength: number;
  favoriteSurfaceId: string | null;
}

export interface PetSave {
  version: 1;
  state: PetState;
  memories: EpisodicMemory[];
  surfacePreferences: Record<string, number>;
  appPreferences: Record<string, number>;
  toyPreferences?: Record<string, number>;
  relationships: Record<string, number | Relationship>;
}

export type MarkingPattern = "uniform" | "tuxedo" | "tabby" | "patched";

export interface SheetAnimation { row: number; frames: number; fps?: number; }

/**
 * Declarative sprite-sheet spec. A sheet is a horizontal strip of rows; each row is
 * one animation loop of equally sized frames. Behaviors without a matching animation
 * fall back through aliases to `default`.
 */
export interface SpriteSheet {
  src: string;
  frameWidth: number;
  frameHeight: number;
  fps?: number;
  default: SheetAnimation;
  animations: Record<string, SheetAnimation>;
}

export interface PetAppearance {
  coat: string;
  accent: string;
  eye: string;
  scale: number;
  sheet?: SpriteSheet;
  markings?: MarkingPattern;
}

export interface PetRecord {
  save: PetSave;
  appearance: PetAppearance;
  /** Serialized PetDiary state (v2 persistence) */
  diary?: unknown;
  /** Serialized RoutineManager state (v2 persistence) */
  routines?: unknown;
}

export interface PetOSSettings {
  enabled: boolean;
  interactionMode: boolean;
  debug: boolean;
  reducedMotion: boolean;
  privacyLevel: 0 | 1 | 2 | 3;
  maxFps: 30 | 60;
  sound: boolean;
  soundVolume: number;
  quietHours: boolean;
  cortexProvider: "off" | "ollama";
}
