import { clamp } from "./math.js";
import type { Surface, Vec2 } from "./types.js";

export interface PathEdge {
  from: string;
  to: string;
  cost: number;
  launchPoint: Vec2;
  landingPoint: Vec2;
}

const HORIZONTAL_OVERLAP_MARGIN = 24;

function horizontalGap(a: Surface, b: Surface): number {
  const aLeft = a.rect.x;
  const aRight = a.rect.x + a.rect.width;
  const bLeft = b.rect.x;
  const bRight = b.rect.x + b.rect.width;
  if (aRight >= bLeft - HORIZONTAL_OVERLAP_MARGIN && aLeft <= bRight + HORIZONTAL_OVERLAP_MARGIN) return 0;
  return Math.max(bLeft - aRight, aLeft - bRight);
}

function edgeX(from: Surface, to: Surface): number {
  return clamp(to.rect.x + to.rect.width / 2, from.rect.x, from.rect.x + from.rect.width);
}

export function buildSurfaceGraph(surfaces: Surface[], maxJumpHeight: number, maxHorizontalGap: number): Map<string, PathEdge[]> {
  const graph = new Map<string, PathEdge[]>();
  for (const s of surfaces) graph.set(s.id, []);
  for (let i = 0; i < surfaces.length; i++) {
    for (let j = 0; j < surfaces.length; j++) {
      if (i === j) continue;
      const from: Surface = surfaces[i]!;
      const to: Surface = surfaces[j]!;
      const rise = from.walkY - to.walkY;
      const gap = horizontalGap(from, to);
      if (rise > maxJumpHeight || rise < -maxJumpHeight * .6) continue;
      if (gap > maxHorizontalGap) continue;
      const launchX = edgeX(from, to);
      const landingX = clamp(launchX, to.rect.x, to.rect.x + to.rect.width);
      const cost = Math.abs(rise) + Math.abs(landingX - launchX) + gap * 1.4;
      graph.get(from.id)!.push({
        from: from.id,
        to: to.id,
        cost,
        launchPoint: { x: launchX, y: from.walkY },
        landingPoint: { x: landingX, y: to.walkY }
      });
    }
  }
  for (const edges of graph.values()) edges.sort((a, b) => a.cost - b.cost);
  return graph;
}

export function planRoute(graph: Map<string, PathEdge[]>, fromId: string | null, toId: string): PathEdge[] {
  if (!fromId || fromId === toId) return [];
  const distances = new Map<string, number>([[fromId, 0]]);
  const previous = new Map<string, PathEdge>();
  const queue: Array<{ id: string; dist: number }> = [{ id: fromId, dist: 0 }];
  while (queue.length) {
    queue.sort((a, b) => a.dist - b.dist);
    const current = queue.shift()!;
    if (current.id === toId) break;
    for (const edge of graph.get(current.id) ?? []) {
      const nextDist = current.dist + edge.cost;
      if (nextDist < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, nextDist);
        previous.set(edge.to, edge);
        queue.push({ id: edge.to, dist: nextDist });
      }
    }
  }
  if (!distances.has(toId)) return [];
  const route: PathEdge[] = [];
  let cursor: string | undefined = toId;
  while (cursor && previous.has(cursor)) {
    const edge: PathEdge | undefined = previous.get(cursor);
    if (!edge) break;
    route.unshift(edge);
    cursor = edge.from;
  }
  return route;
}
