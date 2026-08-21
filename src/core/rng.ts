export interface RandomSource {
  next(): number;
  between(min: number, max: number): number;
  chance(probability: number): boolean;
}

export class SeededRandom implements RandomSource {
  private state: number;
  constructor(seed = 0xdecafbad) { this.state = seed >>> 0 || 1; }
  next(): number {
    let x = this.state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x1_0000_0000;
  }
  between(min: number, max: number): number { return min + (max - min) * this.next(); }
  chance(probability: number): boolean { return this.next() < probability; }
}
