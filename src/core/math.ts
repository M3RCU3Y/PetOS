import type { Rect, Vec2 } from "./types.js";

export const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, value));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const center = (r: Rect): Vec2 => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
export const pointInRect = (p: Vec2, r: Rect): boolean => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
export const nearestPointOnSegmentX = (p: Vec2, r: Rect, y: number): Vec2 => ({ x: clamp(p.x, r.x, r.x + r.width), y });
export const expDecay = (value: number, halfLifeSeconds: number, dtSeconds: number): number => value * Math.pow(0.5, dtSeconds / halfLifeSeconds);
