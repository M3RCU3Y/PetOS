export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
export const clamp11 = (value: number): number => Math.max(-1, Math.min(1, value));
export const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;
