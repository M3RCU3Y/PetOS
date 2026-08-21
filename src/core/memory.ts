import { clamp, expDecay } from "./math.js";
import type { EpisodicMemory } from "./types.js";

export class PetMemory {
  private episodes: EpisodicMemory[];
  private surfacePrefs: Map<string, number>;
  private appPrefs: Map<string, number>;
  private toyPrefs: Map<string, number>;
  private relationships: Map<string, number>;
  private maxEpisodes = 200;

  constructor(seed?: { memories?: EpisodicMemory[]; surfacePreferences?: Record<string, number>; appPreferences?: Record<string, number>; toyPreferences?: Record<string, number>; relationships?: Record<string, number> }) {
    this.episodes = [...(seed?.memories ?? [])];
    this.surfacePrefs = new Map(Object.entries(seed?.surfacePreferences ?? {}));
    this.appPrefs = new Map(Object.entries(seed?.appPreferences ?? {}));
    this.toyPrefs = new Map(Object.entries(seed?.toyPreferences ?? {}));
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
  reinforceToy(id: string, delta: number): void { this.toyPrefs.set(id, clamp((this.toyPrefs.get(id) ?? 0) + delta, -1, 1)); }
  adjustRelationship(id: string, delta: number): void { this.relationships.set(id, clamp((this.relationships.get(id) ?? 0) + delta, -1, 1)); }
  preferenceForSurface(id: string): number { return this.surfacePrefs.get(id) ?? 0; }
  preferenceForApp(id: string): number { return this.appPrefs.get(id) ?? 0; }
  preferenceForToy(id: string): number { return this.toyPrefs.get(id) ?? 0; }
  relationshipWith(id: string): number { return this.relationships.get(id) ?? 0; }
  recent(kind?: EpisodicMemory["kind"], limit = 8): EpisodicMemory[] { return this.episodes.filter(e => !kind || e.kind === kind).slice(-limit); }
  countKind(kind: EpisodicMemory["kind"], withinMs: number, nowMs: number): number {
    return this.episodes.filter(e => e.kind === kind && nowMs - e.atMs <= withinMs).length;
  }

  /** Sleep-time memory consolidation: weak old traces fade so vivid ones dominate. */
  consolidate(): void {
    if (this.episodes.length <= 120) return;
    const weak = this.episodes.findIndex(e => e.salience < .35);
    if (weak >= 0 && Date.now() - this.episodes[weak]!.atMs > 60 * 60 * 1000) this.episodes.splice(weak, 1);
  }

  decay(dtSeconds: number): void {
    for (const [k,v] of this.surfacePrefs) this.surfacePrefs.set(k, expDecay(v, 60 * 60 * 24 * 21, dtSeconds));
    for (const [k,v] of this.appPrefs) this.appPrefs.set(k, expDecay(v, 60 * 60 * 24 * 30, dtSeconds));
    for (const [k,v] of this.toyPrefs) this.toyPrefs.set(k, expDecay(v, 60 * 60 * 24 * 14, dtSeconds));
  }

  favoriteSurface(): string | null {
    let best: [string, number] | null = null;
    for (const entry of this.surfacePrefs) if (!best || entry[1] > best[1]) best = entry;
    return best && best[1] > .15 ? best[0] : null;
  }

  favoriteToy(): string | null {
    let best: [string, number] | null = null;
    for (const entry of this.toyPrefs) if (!best || entry[1] > best[1]) best = entry;
    return best && best[1] > .12 ? best[0] : null;
  }

  serialize(): { memories: EpisodicMemory[]; surfacePreferences: Record<string,number>; appPreferences: Record<string,number>; toyPreferences: Record<string,number>; relationships: Record<string,number> } {
    return {
      memories: [...this.episodes],
      surfacePreferences: Object.fromEntries(this.surfacePrefs),
      appPreferences: Object.fromEntries(this.appPrefs),
      toyPreferences: Object.fromEntries(this.toyPrefs),
      relationships: Object.fromEntries(this.relationships)
    };
  }
}
