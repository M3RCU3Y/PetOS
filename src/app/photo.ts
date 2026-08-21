export interface ExtractedPalette {
  coat: string;
  accent: string;
  eye: string;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export async function extractPalette(file: File): Promise<ExtractedPalette> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

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

  bitmap.close();
  return { coat: coatHex, accent: accentHex, eye: eyeHex };
}
