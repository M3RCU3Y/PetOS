import { distance } from "./math.js";
import type { Vec2, WorldObject, WorldSnapshot } from "./types.js";

interface ObjectRecord {
  id: string;
  kind: string;
  lastSeenAt: number;
  lastPosition: Vec2;
}

export class ObjectPermanence {
  private known = new Map<string, ObjectRecord>();
  private misses = new Map<string, number>();
  private giveUpUntil = new Map<string, number>();

  observe(objects: WorldObject[], nowMs: number): void {
    for (const obj of objects) {
      this.known.set(obj.id, { id: obj.id, kind: obj.kind, lastSeenAt: nowMs, lastPosition: { ...obj.position } });
      if (this.misses.has(obj.id)) { this.misses.delete(obj.id); this.giveUpUntil.delete(obj.id); }
    }
    // Forget objects not seen recently (simulating memory decay)
    const staleMs = 5 * 60 * 1000;
    for (const [id, rec] of this.known) {
      if (!objects.find(o => o.id === id) && nowMs - rec.lastSeenAt > staleMs) {
        this.known.delete(id);
      }
    }
  }

  /** Called when the pet reaches where it remembered an object and it isn't there. */
  recordMiss(id: string, nowMs: number): number {
    const count = (this.misses.get(id) ?? 0) + 1;
    this.misses.set(id, count);
    if (count >= 3) this.giveUpUntil.set(id, nowMs + 120_000);
    return count;
  }

  missCount(id: string): number { return this.misses.get(id) ?? 0; }

  gaveUp(id: string, nowMs: number): boolean { return nowMs < (this.giveUpUntil.get(id) ?? 0); }

  findNearest(kind: string, position: Vec2): ObjectRecord | null {
    let best: ObjectRecord | null = null;
    let bestDist = Infinity;
    for (const rec of this.known.values()) {
      if (rec.kind !== kind) continue;
      const d = distance(rec.lastPosition, position);
      if (d < bestDist) { bestDist = d; best = rec; }
    }
    return best;
  }

  knowsAbout(kind: string): boolean {
    for (const rec of this.known.values()) if (rec.kind === kind) return true;
    return false;
  }

  serialize(): Record<string, { kind: string; x: number; y: number }> {
    return Object.fromEntries([...this.known.entries()].map(([id, r]) => [id, { kind: r.kind, x: r.lastPosition.x, y: r.lastPosition.y }]));
  }

  restore(data: Record<string, { kind: string; x: number; y: number }>): void {
    this.known.clear();
    for (const [id, r] of Object.entries(data)) {
      this.known.set(id, { id, kind: r.kind, lastSeenAt: 0, lastPosition: { x: r.x, y: r.y } });
    }
  }
}
