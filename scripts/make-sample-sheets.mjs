import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "web", "sheets");
mkdirSync(outDir, { recursive: true });

/* ---------- minimal PNG encoder (RGBA, no dependencies) ---------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- tiny pixel canvas ---------- */

class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }
  set(x, y, [r, g, b, a = 255]) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (a === 255) {
      this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255;
    } else {
      // cheap alpha blend over whatever is there
      const d = this.data;
      const na = a / 255;
      d[i] = Math.round(d[i] * (1 - na) + r * na);
      d[i + 1] = Math.round(d[i + 1] * (1 - na) + g * na);
      d[i + 2] = Math.round(d[i + 2] * (1 - na) + b * na);
      d[i + 3] = Math.min(255, d[i + 3] + a);
    }
  }
  rect(x, y, w, h, color) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, color);
  }
  disc(cx, cy, r, color) {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, color);
    }
  }
}

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
function shade(c, f) {
  const v = hex(c).map(n => Math.max(0, Math.min(255, Math.round(n * f))));
  return `#${v.map(n => n.toString(16).padStart(2, "0")).join("")}`;
}

/* ---------- frame painter: one 32x32 side-view critter frame ---------- */

const F = 32;

function paintFrame(px, { coat, accent, eye }, pose, phase) {
  const coatC = hex(coat), darkC = hex(shade(coat, .68)), accC = hex(accent), eyeC = hex(eye), blk = [20, 22, 30];
  const bob = pose === "walk" || pose === "run" ? (phase % 2 === 0 ? 1 : 0) : 0;
  const legA = pose === "walk" ? [0, 2, 2, 0][phase % 4] : pose === "run" ? [0, 3, 3, 0][phase % 4] : 0;
  const lean = pose === "run" ? 3 : 0;

  if (pose === "sleep") {
    px.rect(6, 22, 20, 7, coatC);           // loaf body
    px.rect(7, 27, 18, 2, accC);            // belly
    px.disc(11, 21, 5, coatC);              // head resting
    px.rect(12, 21, 3, 1, blk);             // closed eye
    px.rect(8, 15, 3, 4, coatC);            // ear
    px.disc(26, 25, 3, accC);               // tail curl
    return;
  }

  const bodyY = 17 - bob;
  px.rect(7 + lean, bodyY, 17, 9, coatC);                       // torso
  px.rect(9 + lean, bodyY + 7, 12, 2, accC);                    // belly stripe
  // legs
  const legs = [[10, legA], [14, 2 - legA], [19, 2 - legA], [23, legA]];
  for (const [lx, off] of legs) px.rect(lx + lean, bodyY + 8, 2, 4 + off, darkC);
  // tail
  if (pose === "run") { px.rect(3 + lean, bodyY - 3, 5, 3, coatC); px.set(2 + lean, bodyY - 4, accC); }
  else { px.rect(3, bodyY + 2, 4, 2, coatC); px.set(2, bodyY + 1, accC); }
  // head
  const hx = 24 + lean, hy = bodyY - 3;
  px.disc(hx, hy, 5, coatC);
  px.rect(hx - 3, hy - 9, 3, 5, coatC);       // ear 1
  px.rect(hx + 1, hy - 9, 3, 5, coatC);       // ear 2
  px.rect(hx - 3, hy - 7, 2, 2, accC);
  px.disc(hx + 3, hy - 1, 1.6, eyeC);         // eye
  px.set(hx + 3, hy - 2, [255, 255, 255]);    // shine
  px.set(hx + 7, hy + 1, [40, 34, 30]); // nose
}

/* ---------- sheet assembly ---------- */

function makeSheet(palette) {
  const cols = 6, rows = 4;
  const px = new Pix(cols * F, rows * F);
  const layout = [
    ["idle", 4],
    ["walk", 6],
    ["sleep", 2],
    ["run", 6]
  ];
  layout.forEach(([pose], row) => {
    for (let col = 0; col < cols; col++) {
      const ox = col * F, oy = row * F;
      const tmp = new Pix(F, F);
      paintFrame(tmp, palette, pose, col);
      tmp.data.copy(px.data, (oy * cols * F + ox) * 4, 0, F * F * 4);
    }
  });
  return { buffer: encodePng(px.w, px.h, px.data), layout };
}

function sheetSpec(file, layout) {
  return {
    src: file,
    frameWidth: F,
    frameHeight: F,
    fps: 6,
    default: { row: 0, frames: layout[0][1] },
    animations: Object.fromEntries(layout.map(([pose, frames], row) => [pose, { row, frames, ...(pose === "sleep" ? { fps: 2 } : {}) }]))
  };
}

const SPECIES_ART = [
  { id: "cat", name: "Pixel Cat", coat: "#d77b36", accent: "#f2bf7d", eye: "#d9ef73" },
  { id: "dog", name: "Pixel Dog", coat: "#a0713f", accent: "#e8d5b0", eye: "#5a4a3a" }
];

for (const art of SPECIES_ART) {
  const file = `${art.id}-sample.png`;
  const { buffer, layout } = makeSheet(art);
  writeFileSync(join(outDir, file), buffer);
  console.log(`wrote web/sheets/${file} (${buffer.length} bytes)`);

  const pack = {
    id: `${art.id}-pixel`,
    name: `${art.name} (sprite demo)`,
    version: "1.0.0",
    species: art.id,
    author: "PetOS",
    description: "Generated sprite-sheet demonstrating the PetOS art pipeline.",
    appearance: { coat: art.coat, accent: art.accent, eye: art.eye, scale: 1, sheet: sheetSpec(`sheets/${file}`, layout) },
    tags: ["sample", "sprites"]
  };
  const packPath = join(root, "web", "packs", `${art.id}-pixel.json`);
  mkdirSync(dirname(packPath), { recursive: true });
  writeFileSync(packPath, JSON.stringify(pack, null, 2));
  console.log(`wrote web/packs/${art.id}-pixel.json`);
}
