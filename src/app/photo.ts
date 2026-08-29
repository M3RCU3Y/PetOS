export interface ExtractedPalette {
  coat: string;
  accent: string;
  eye: string;
}

export type EstimatedMarking = "uniform" | "tuxedo" | "tabby" | "patched";

export interface ExtractedMarkings { pattern: EstimatedMarking; confidence: number; }

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

async function loadPixels(file: File, size = 48): Promise<{ data: Uint8ClampedArray; w: number; h: number }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  bitmap.close();
  return { data, w: size, h: size };
}

/**
 * Classifies a photo's coat pattern into one of four procedural-renderable styles.
 * Heuristic and honest about uncertainty — confidence reflects how decisive the
 * luminance structure was.
 */
export async function extractMarkings(file: File): Promise<ExtractedMarkings> {
  const { data, w } = await loadPixels(file);
  const lum: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    lum.push(luminance(data[i]!, data[i + 1]!, data[i + 2]!));
  }
  if (lum.length === 0) return { pattern: "uniform", confidence: .3 };

  // Split pixels into dark / light clusters around the midpoint
  let mean = 0;
  for (const v of lum) mean += v;
  mean /= lum.length;
  const dark = lum.filter(v => v < mean - 24);
  const light = lum.filter(v => v > mean + 24);
  const darkRatio = dark.length / lum.length;
  const lightRatio = light.length / lum.length;

  // Horizontal stripe energy: tabby coats alternate bright/dark bands frequently
  let transitions = 0;
  let samples = 0;
  for (let row = 4; row < 44; row += 6) {
    let prev = -1;
    for (let col = 0; col < w - 1; col += 2) {
      const idx = (row * w + col) * 4;
      if (data[idx + 3]! < 128) continue;
      const l = luminance(data[idx]!, data[idx + 1]!, data[idx + 2]!);
      const bucket = l > mean ? 1 : 0;
      if (prev >= 0 && bucket !== prev) transitions++;
      prev = bucket;
      samples++;
    }
  }
  const stripeEnergy = samples > 0 ? transitions / samples : 0;

  // Tuxedo: predominantly dark coat with a light chest region (lower-center brighter)
  let chest = 0;
  let chestN = 0;
  for (let y = 30; y < 46; y++) {
    for (let x = 18; x < 30; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3]! < 128) continue;
      chest += luminance(data[idx]!, data[idx + 1]!, data[idx + 2]!);
      chestN++;
    }
  }
  const chestLum = chestN > 0 ? chest / chestN : mean;

  if (stripeEnergy > .22 && Math.abs(darkRatio - lightRatio) < .35) {
    return { pattern: "tabby", confidence: Math.min(.9, .5 + stripeEnergy) };
  }
  if (darkRatio > .45 && chestLum > mean + 26) {
    return { pattern: "tuxedo", confidence: Math.min(.85, .45 + darkRatio * .5) };
  }
  if (darkRatio > .12 && lightRatio > .12 && Math.min(darkRatio, lightRatio) / Math.max(darkRatio, lightRatio) > .3) {
    return { pattern: "patched", confidence: Math.min(.8, .4 + Math.min(darkRatio, lightRatio)) };
  }
  return { pattern: "uniform", confidence: .55 };
}

export async function extractPalette(file: File): Promise<ExtractedPalette> {
  const { data } = await loadPixels(file, 64);

  // Collect color buckets
  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    if (data[i + 3]! < 128) continue;
    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count++;
    buckets.set(key, bucket);
  }

  // Sort by frequency
  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count);
  if (!sorted.length) return { coat: "#d98742", accent: "#f2c287", eye: "#d7ef76" };

  // Coat = most frequent color
  const coat = sorted[0]!;
  const coatHex = rgbToHex(coat.r / coat.count, coat.g / coat.count, coat.b / coat.count);

  // Accent = second most distinct (different hue or brightness)
  let accent = sorted[1] ?? sorted[0]!;
  for (const s of sorted.slice(1)) {
    const lumDiff = Math.abs(luminance(s.r / s.count, s.g / s.count, s.b / s.count) - luminance(coat.r / coat.count, coat.g / coat.count, coat.b / coat.count));
    if (lumDiff > 30) { accent = s; break; }
  }
  const accentHex = rgbToHex(accent.r / accent.count, accent.g / accent.count, accent.b / accent.count);

  // Eye = darkest distinct color
  let eye = sorted[sorted.length - 1]!;
  for (const s of [...sorted].reverse()) {
    const lum = luminance(s.r / s.count, s.g / s.count, s.b / s.count);
    if (lum < 80) { eye = s; break; }
  }
  const eyeHex = rgbToHex(eye.r / eye.count, eye.g / eye.count, eye.b / eye.count);

  return { coat: coatHex, accent: accentHex, eye: eyeHex };
}
