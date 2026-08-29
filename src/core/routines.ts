import { clamp } from "./math.js";
import type { PetState, WorldSnapshot } from "./types.js";

export interface RoutineStep {
  behavior: string;
  targetKind: "object" | "surface" | "cursor" | "none";
  targetFilter?: (world: WorldSnapshot) => string | null;
  maxDurationMs: number;
  note: string;
}

export interface Routine {
  id: string;
  name: string;
  species: string[] | null;
  hourRange: [number, number];
  steps: RoutineStep[];
  priority: number;
  cooldownMs: number;
}

const MORNING_ROUTINE: Routine = {
  id: "morning",
  name: "Morning stretch",
  species: null,
  hourRange: [6, 11],
  priority: .7,
  cooldownMs: 4 * 60 * 60 * 1000,
  steps: [
    { behavior: "stretch", targetKind: "none", maxDurationMs: 6_000, note: "Waking up with a good stretch" },
    { behavior: "groom", targetKind: "none", maxDurationMs: 8_000, note: "Morning grooming session" },
    { behavior: "walk", targetKind: "none", maxDurationMs: 15_000, note: "Morning patrol" },
  ]
};

const MEALTIME_ROUTINE: Routine = {
  id: "mealtime",
  name: "Meal time",
  species: null,
  hourRange: [7, 10],
  priority: .85,
  cooldownMs: 3 * 60 * 60 * 1000,
  steps: [
    { behavior: "walk", targetKind: "object", targetFilter: (w) => w.objects.find(o => o.kind === "bowl" && o.contents === "food")?.id ?? null, maxDurationMs: 30_000, note: "Heading to the food bowl" },
    { behavior: "eat", targetKind: "object", targetFilter: (w) => w.objects.find(o => o.kind === "bowl" && o.contents === "food")?.id ?? null, maxDurationMs: 10_000, note: "Eating breakfast" },
    { behavior: "drink", targetKind: "object", targetFilter: (w) => w.objects.find(o => o.kind === "bowl" && o.contents === "water")?.id ?? null, maxDurationMs: 6_000, note: "Drinking water" },
  ]
};

const EVENING_WIND_DOWN: Routine = {
  id: "evening",
  name: "Evening wind down",
  species: null,
  hourRange: [20, 23],
  priority: .6,
  cooldownMs: 6 * 60 * 60 * 1000,
  steps: [
    { behavior: "groom", targetKind: "none", maxDurationMs: 8_000, note: "Pre-bed grooming" },
    { behavior: "walk", targetKind: "object", targetFilter: (w) => w.objects.find(o => o.kind === "bed")?.id ?? null, maxDurationMs: 20_000, note: "Heading to bed" },
    { behavior: "sleep", targetKind: "object", targetFilter: (w) => w.objects.find(o => o.kind === "bed")?.id ?? null, maxDurationMs: 60_000, note: "Settling in for the night" },
  ]
};

const CAT_ZOOMIES_ROUTINE: Routine = {
  id: "cat-zoomies",
  name: "Evening zoomies",
  species: ["cat"],
  hourRange: [17, 22],
  priority: .75,
  cooldownMs: 5 * 60 * 60 * 1000,
  steps: [
    { behavior: "stretch", targetKind: "none", maxDurationMs: 4_000, note: "Preparing for zoomies" },
    { behavior: "zoomies", targetKind: "none", maxDurationMs: 12_000, note: "Zoomies!!" },
    { behavior: "run", targetKind: "none", maxDurationMs: 8_000, note: "Still zooming" },
    { behavior: "groom", targetKind: "none", maxDurationMs: 6_000, note: "Recovering from zoomies" },
  ]
};

const BIRD_MORNING_CHIRP: Routine = {
  id: "bird-morning",
  name: "Morning chirp",
  species: ["bird"],
  hourRange: [5, 9],
  priority: .8,
  cooldownMs: 4 * 60 * 60 * 1000,
  steps: [
    { behavior: "stretch", targetKind: "none", maxDurationMs: 4_000, note: "Waking up" },
    { behavior: "perch", targetKind: "none", maxDurationMs: 10_000, note: "Morning perch" },
    { behavior: "investigate", targetKind: "none", maxDurationMs: 15_000, note: "Scanning the room" },
  ]
};

export const ROUTINES: Routine[] = [MORNING_ROUTINE, MEALTIME_ROUTINE, EVENING_WIND_DOWN, CAT_ZOOMIES_ROUTINE, BIRD_MORNING_CHIRP];

export class RoutineManager {
  private activeRoutine: Routine | null = null;
  private currentStepIndex = 0;
  private stepStartedAt = 0;
  private lastCompletedAt = new Map<string, number>();

  tick(state: PetState, world: WorldSnapshot, nowMs: number): { behavior: string; targetId: string | null; note: string } | null {
    if (this.activeRoutine) {
      return this.advanceStep(world, nowMs, state);
    }

    const hour = new Date(nowMs).getHours();
    for (const routine of ROUTINES) {
      if (routine.species && !routine.species.includes(state.species)) continue;
      if (hour < routine.hourRange[0] || hour > routine.hourRange[1]) continue;
      const lastRun = this.lastCompletedAt.get(routine.id) ?? 0;
      if (nowMs - lastRun < routine.cooldownMs) continue;
      this.activeRoutine = routine;
      this.currentStepIndex = 0;
      this.stepStartedAt = nowMs;
      return this.advanceStep(world, nowMs, state);
    }
    return null;
  }

  private advanceStep(world: WorldSnapshot, nowMs: number, state: PetState): { behavior: string; targetId: string | null; note: string } | null {
    if (!this.activeRoutine) return null;
    const routine = this.activeRoutine;
    if (this.currentStepIndex >= routine.steps.length) {
      this.lastCompletedAt.set(routine.id, nowMs);
      this.activeRoutine = null;
      return null;
    }
    const step = routine.steps[this.currentStepIndex]!;
    if (nowMs - this.stepStartedAt > step.maxDurationMs) {
      this.currentStepIndex++;
      this.stepStartedAt = nowMs;
      return this.advanceStep(world, nowMs, state);
    }
    let targetId: string | null = null;
    if (step.targetKind === "object" && step.targetFilter) {
      targetId = step.targetFilter(world);
    }
    return { behavior: step.behavior, targetId, note: step.note };
  }

  get active(): string | null { return this.activeRoutine?.name ?? null; }

  interrupt(): void {
    this.activeRoutine = null;
    this.currentStepIndex = 0;
  }

  serialize(): { activeRoutineId: string | null; lastCompleted: Record<string, number> } {
    return {
      activeRoutineId: this.activeRoutine?.id ?? null,
      lastCompleted: Object.fromEntries(this.lastCompletedAt)
    };
  }

  restore(data: { activeRoutineId?: string | null; lastCompleted?: Record<string, number> }): void {
    if (data.lastCompleted) this.lastCompletedAt = new Map(Object.entries(data.lastCompleted));
    if (data.activeRoutineId) {
      const routine = ROUTINES.find(r => r.id === data.activeRoutineId);
      if (routine) { this.activeRoutine = routine; this.currentStepIndex = 0; this.stepStartedAt = 0; }
    }
  }
}
