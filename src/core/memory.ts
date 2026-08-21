import { clamp, expDecay } from "./math.js";
import type { EpisodicMemory } from "./types.js";

export class PetMemory {
  private episodes: EpisodicMemory[];
  private surfacePrefs: Map<string, number>;
  private appPrefs: Map<string, number>;
  private relationships: Map<string, number>;
  private maxEpisodes = 200;

  constructor(seed?: { memories?: EpisodicMemory[]; surfacePreferences?: Record<string, number>; appPreferences?: Record<string, number>; relationships?: Record<string, number> }) {
    this.episodes = [...(seed?.memories ?? [])];
    this.surfacePrefs = new Map(Object.entries(seed?.surfacePreferences ?? {}));
    this.appPrefs = new Map(Object.entries(seed?.appPreferences ?? {}));
    this.relationships = new Map(Object.entries(seed?.relationships ?? {}));
  }

  remember(memory: EpisodicMemory): void {
    this.episodes.push(memory);
    this.episodes.sort((a,b) => a.atMs - b.atMs);
    if (this.episodes.length > this.maxEpisodes) this.episodes.splice(0, this.episodes.length - this.maxEpisodes);
    if (memory.surfaceId) this.reinforceSurface(memory.surfaceId, memory.valence * memory.salience * .18);
    if (memory.app) this.reinforceApp(memory.app, memory.valence * memory.salience * .1);
  }

  reinforceSurface(id: string, delta: number): void { this.surfacePrefs.set(id, clamp((this.surfacePrefs.get(id) ?? 0) + delta, -1, 1)); }
  reinforceApp(id: string, delta: number): void { this.appPrefs.set(id, clamp((this.appPrefs.get(id) ?? 0) + delta, -1, 1)); }
  adjustRelationship(id: string, delta: number): void { this.relationships.set(id, clamp((this.relationships.get(id) ?? 0) + delta, -1, 1)); }
  preferenceForSurface(id: string): number { return this.surfacePrefs.get(id) ?? 0; }
  preferenceForApp(id: string): number { return this.appPrefs.get(id) ?? 0; }
  relationshipWith(id: string): number { return this.relationships.get(id) ?? 0; }
  recent(kind?: EpisodicMemory["kind"], limit = 8): EpisodicMemory[] { return this.episodes.filter(e => !kind || e.kind === kind).slice(-limit); }

  decay(dtSeconds: number): void {
    for (const [k,v] of this.surfacePrefs) this.surfacePrefs.set(k, expDecay(v, 60 * 60 * 24 * 21, dtSeconds));
    for (const [k,v] of this.appPrefs) this.appPrefs.set(k, expDecay(v, 60 * 60 * 24 * 30, dtSeconds));
  }

  favoriteSurface(): string | null {
    let best: [string, number] | null = null;
    for (const entry of this.surfacePrefs) if (!best || entry[1] > best[1]) best = entry;
    return best && best[1] > .15 ? best[0] : null;
  }

  serialize(): { memories: EpisodicMemory[]; surfacePreferences: Record<string,number>; appPreferences: Record<string,number>; relationships: Record<string,number> } {
    return {
      memories: [...this.episodes],
      surfacePreferences: Object.fromEntries(this.surfacePrefs),
      appPreferences: Object.fromEntries(this.appPrefs),
      relationships: Object.fromEntries(this.relationships)
    };
  }
}
