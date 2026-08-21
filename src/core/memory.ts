import { clamp11 } from "./math.js";
import type { EpisodicMemory } from "./types.js";

export class PetMemory {
  readonly episodes: EpisodicMemory[] = [];
  private readonly surfacePreference = new Map<string, number>();

  constructor(private readonly maxEpisodes = 256) {}

  remember(memory: EpisodicMemory): void {
    this.episodes.push(memory);
    if (this.episodes.length > this.maxEpisodes) this.episodes.shift();

    const current = this.surfacePreference.get(memory.surfaceId) ?? 0;
    const learningSignal = memory.valence * 0.08;
    this.surfacePreference.set(memory.surfaceId, clamp11(current + learningSignal));
  }

  preferenceForSurface(surfaceId: string): number {
    return this.surfacePreference.get(surfaceId) ?? 0;
  }

  strongestSurfacePreferences(limit = 5): Array<{ surfaceId: string; preference: number }> {
    return [...this.surfacePreference.entries()]
      .map(([surfaceId, preference]) => ({ surfaceId, preference }))
      .sort((a, b) => b.preference - a.preference)
      .slice(0, limit);
  }
}
