import type { PetState } from "./types.js";

export interface DiaryEntry {
  id: string;
  petId: string;
  atMs: number;
  kind: "milestone" | "routine" | "social" | "discovery" | "achievement";
  title: string;
  detail: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  check: (pet: PetState, context: AchievementContext) => boolean;
}

export interface AchievementContext {
  totalSleepHours: number;
  totalPlaySessions: number;
  totalMeals: number;
  bondLevel: number;
  ageDays: number;
  surfacesExplored: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-day", name: "First Day", description: "Survived their first day on your desktop", emoji: "🎉", check: (p) => p.ageSeconds > 86400 },
  { id: "well-rested", name: "Well Rested", description: "Slept for 10+ hours total", emoji: "😴", check: (_p, c) => c.totalSleepHours >= 10 },
  { id: "playful", name: "Playful Soul", description: "Completed 20 play sessions", emoji: "🎾", check: (_p, c) => c.totalPlaySessions >= 20 },
  { id: "foodie", name: "Foodie", description: "Eaten 50 meals", emoji: "🍖", check: (_p, c) => c.totalMeals >= 50 },
  { id: "best-friend", name: "Best Friend", description: "Reached maximum bond level", emoji: "❤️", check: (p) => p.bond >= .95 },
  { id: "explorer", name: "Explorer", description: "Visited 15 different surfaces", emoji: "🗺️", check: (_p, c) => c.surfacesExplored >= 15 },
  { id: "elder", name: "Desktop Elder", description: "Lived for 30 days", emoji: "🏆", check: (p) => p.ageSeconds > 30 * 86400 },
];

export class PetDiary {
  private entries: DiaryEntry[] = [];
  private unlockedAchievements = new Set<string>();
  private stats = { sleepMs: 0, playSessions: 0, meals: 0, surfacesSeen: new Set<string>() };
  private maxEntries = 500;

  record(entry: Omit<DiaryEntry, "id">): void {
    this.entries.push({ ...entry, id: `${entry.petId}:${entry.atMs}` });
    if (this.entries.length > this.maxEntries) this.entries.splice(0, this.entries.length - this.maxEntries);
  }

  trackBehavior(behavior: string, dtMs: number): void {
    if (behavior === "sleep") this.stats.sleepMs += dtMs;
    if (["play_toy", "play_pet", "chase_cursor", "zoomies"].includes(behavior)) this.stats.playSessions += dtMs / 30_000;
    if (behavior === "eat") this.stats.meals += dtMs / 5_000;
  }

  trackSurface(surfaceId: string): void {
    this.stats.surfacesSeen.add(surfaceId);
  }

  checkAchievements(pet: PetState): Achievement[] {
    const context: AchievementContext = {
      totalSleepHours: this.stats.sleepMs / 3_600_000,
      totalPlaySessions: Math.floor(this.stats.playSessions),
      totalMeals: Math.floor(this.stats.meals),
      bondLevel: pet.bond,
      ageDays: pet.ageSeconds / 86_400,
      surfacesExplored: this.stats.surfacesSeen.size
    };
    const newlyUnlocked: Achievement[] = [];
    for (const ach of ACHIEVEMENTS) {
      if (this.unlockedAchievements.has(ach.id)) continue;
      if (ach.check(pet, context)) {
        this.unlockedAchievements.add(ach.id);
        newlyUnlocked.push(ach);
        this.record({ petId: pet.id, atMs: Date.now(), kind: "achievement", title: `${ach.emoji} ${ach.name}`, detail: ach.description });
      }
    }
    return newlyUnlocked;
  }

  get unlocked(): string[] { return [...this.unlockedAchievements]; }
  get recent(): DiaryEntry[] { return this.entries.slice(-20); }

  serialize() {
    return {
      entries: this.entries.slice(-100),
      unlocked: [...this.unlockedAchievements],
      stats: { ...this.stats, surfacesSeen: [...this.stats.surfacesSeen] }
    };
  }

  restore(data: { entries?: DiaryEntry[]; unlocked?: string[]; stats?: { sleepMs?: number; playSessions?: number; meals?: number; surfacesSeen?: string[] } }) {
    if (data.entries) this.entries = data.entries;
    if (data.unlocked) this.unlockedAchievements = new Set(data.unlocked);
    if (data.stats) {
      this.stats.sleepMs = data.stats.sleepMs ?? 0;
      this.stats.playSessions = data.stats.playSessions ?? 0;
      this.stats.meals = data.stats.meals ?? 0;
      this.stats.surfacesSeen = new Set(data.stats.surfacesSeen ?? []);
    }
  }
}
