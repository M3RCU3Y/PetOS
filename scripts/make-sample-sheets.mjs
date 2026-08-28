import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.PETOS_ART_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
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
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------- tiny vector-ish pixel canvas ---------- */

class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }
  set(x, y, [r, g, b, a = 255]) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (a >= 255) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = 255;
      return;
    }
    const oldA = this.data[i + 3] / 255;
    const newA = a / 255;
    const outA = newA + oldA * (1 - newA);
    if (outA <= 0) return;
    this.data[i] = Math.round((r * newA + this.data[i] * oldA * (1 - newA)) / outA);
    this.data[i + 1] = Math.round((g * newA + this.data[i + 1] * oldA * (1 - newA)) / outA);
    this.data[i + 2] = Math.round((b * newA + this.data[i + 2] * oldA * (1 - newA)) / outA);
    this.data[i + 3] = Math.round(outA * 255);
  }
  rect(x, y, w, h, color) {
    for (let yy = Math.floor(y); yy < Math.ceil(y + h); yy++) for (let xx = Math.floor(x); xx < Math.ceil(x + w); xx++) this.set(xx, yy, color);
  }
  disc(cx, cy, r, color) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, color);
    }
  }
  ellipse(cx, cy, rx, ry, color) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.set(x, y, color);
    }
  }
  line(x0, y0, x1, y1, width, color) {
    const dx = x1 - x0, dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 1.5));
    for (let i = 0; i <= steps; i++) {
      const q = i / steps;
      this.disc(x0 + dx * q, y0 + dy * q, width / 2, color);
    }
  }
  poly(points, color) {
    const minY = Math.floor(Math.min(...points.map(p => p[1])));
    const maxY = Math.ceil(Math.max(...points.map(p => p[1])));
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y) !== (yj > y)) xs.push(xi + (y - yi) * (xj - xi) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k < xs.length; k += 2) {
        const to = xs[k + 1] ?? xs[k];
        for (let x = Math.ceil(xs[k]); x <= Math.floor(to); x++) this.set(x, y, color);
      }
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

const F = 64;
const COLS = 6;
const LAYOUT = [
  ["idle", 4],
  ["walk", 6],
  ["sleep", 2],
  ["run", 6]
];

function palette(art) {
  return {
    coat: hex(art.coat),
    dark: hex(shade(art.coat, .68)),
    deep: hex(shade(art.coat, .48)),
    light: hex(shade(art.coat, 1.10)),
    accent: hex(art.accent),
    eye: hex(art.eye),
    inner: hex(art.species === "cat" ? "#d9958c" : "#9a6c57"),
    ink: hex("#2a2528"),
    nose: hex(art.species === "cat" ? "#8d5558" : "#4d352c"),
    white: [255, 255, 255],
    whisker: [238, 234, 226, 210]
  };
}

function eye(px, x, y, open, c) {
  if (open < .2) {
    px.line(x - 3, y, x + 3, y, 1.4, c.ink);
    return;
  }
  px.ellipse(x, y, 3.1, 2.8 * open, c.eye);
  px.ellipse(x + .5, y, 1.15, 2.15 * open, c.ink);
  px.disc(x - 1, y - 1, .9, c.white);
}

function catHead(px, cx, cy, pose, phase, c) {
  const blink = pose === "sleep" ? 0 : ((phase + 1) % 17 === 0 ? .08 : 1);
  px.poly([[cx - 10, cy - 7], [cx - 7, cy - 20], [cx - 1, cy - 9]], c.coat);
  px.poly([[cx + 2, cy - 9], [cx + 9, cy - 19], [cx + 11, cy - 6]], c.coat);
  px.poly([[cx - 8, cy - 10], [cx - 7, cy - 16], [cx - 3, cy - 10]], c.inner);
  px.poly([[cx + 4, cy - 10], [cx + 8, cy - 15], [cx + 9, cy - 9]], c.inner);
  px.ellipse(cx - 1, cy, 12.8, 10.7, c.dark);
  px.ellipse(cx + .5, cy - 1, 12.2, 10.1, c.coat);
  px.ellipse(cx + 5, cy + 4, 7.3, 5.2, c.light);
  px.ellipse(cx + 7, cy + 5, 5.4, 3.7, c.accent);
  px.line(cx - 5, cy - 9, cx - 4, cy - 4, 1.8, c.dark);
  px.line(cx, cy - 10, cx, cy - 4, 1.8, c.dark);
  px.line(cx + 5, cy - 8, cx + 4, cy - 4, 1.8, c.dark);
  px.line(cx - 10, cy + 1, cx - 6, cy + 3, 1.5, c.dark);
  eye(px, cx - 4, cy - 2, blink, c);
  eye(px, cx + 4, cy - 2, blink, c);
  px.poly([[cx + 10, cy + 3], [cx + 13, cy + 4.5], [cx + 10, cy + 6]], c.nose);
  px.line(cx + 12, cy + 6, cx + 8, cy + 8, 1, c.ink);
  px.line(cx + 9, cy + 4, cx + 18, cy + 2, 1, c.whisker);
  px.line(cx + 9, cy + 6, cx + 19, cy + 7, 1, c.whisker);
  px.line(cx + 8, cy + 8, cx + 17, cy + 11, 1, c.whisker);
}

function catTail(px, x, y, pose, phase, c) {
  const sway = Math.sin((phase / 6) * Math.PI * 2);
  if (pose === "sleep") {
    px.line(x, y, x - 9, y + 3, 6.5, c.dark);
    px.line(x - 9, y + 3, x - 16, y - 2, 6, c.coat);
    px.disc(x - 16, y - 2, 3.2, c.accent);
    return;
  }
  const lift = pose === "run" ? 6 : 12;
  px.line(x, y, x - 10, y - lift, 6.5, c.dark);
  px.line(x - 10, y - lift, x - 17 + sway * 2, y - lift - 10, 6, c.coat);
  px.line(x - 17 + sway * 2, y - lift - 10, x - 12 + sway * 4, y - lift - 17, 5, c.coat);
  px.disc(x - 12 + sway * 4, y - lift - 17, 2.6, c.accent);
}

function catBodyStripes(px, bx, by, c) {
  for (let i = 0; i < 4; i++) px.line(bx + 9 + i * 7, by + 2, bx + 11 + i * 7, by + 8, 1.8, c.dark);
}

function catPaws(px, xs, y, phase, amp, c) {
  xs.forEach((x, i) => {
    const lift = ((i + phase) % 2) * amp;
    px.rect(x - 2.4, y - 10 - lift, 4.8, 10, c.coat);
    px.ellipse(x, y - lift, 3.4, 2.4, c.light);
    px.line(x - 2, y + .5 - lift, x + 2, y + .5 - lift, .8, c.dark);
  });
}

function paintCat(px, art, pose, phase) {
  const c = palette(art);
  if (pose === "sleep") {
    const breathe = phase % 2 === 0 ? 0 : 1;
    px.ellipse(31, 46, 21, 10 + breathe, c.dark);
    px.ellipse(32, 43, 22, 11 + breathe, c.coat);
    catBodyStripes(px, 12, 34, c);
    px.ellipse(37, 48, 12, 3.4, c.light);
    catTail(px, 18, 46, pose, phase, c);
    catHead(px, 18, 39, pose, phase, c);
    return;
  }

  const moving = pose === "walk" || pose === "run";
  const bob = moving && phase % 2 ? 1 : 0;
  const lean = pose === "run" ? 3 : 0;
  const bx = 13 + lean, by = 30 + bob, bw = 34, bh = 17;
  catTail(px, bx + 2, by + 11, pose, phase, c);
  px.ellipse(bx + bw * .45, by + bh * .58, bw * .56, bh * .56, c.dark);
  px.ellipse(bx + bw * .51, by + bh * .47, bw * .54, bh * .51, c.coat);
  px.ellipse(bx + bw * .62, by + bh * .26, bw * .32, bh * .24, c.light);
  catBodyStripes(px, bx, by, c);
  px.ellipse(bx + bw * .72, by + bh * .72, 7, 4.2, c.accent);
  catPaws(px, [bx + 8, bx + 16, bx + 27, bx + 34], 55, phase, pose === "walk" ? 3 : pose === "run" ? 6 : 0, c);
  catHead(px, bx + bw + 1, by + 3, pose, phase, c);
}

function dogHead(px, cx, cy, pose, phase, c) {
  const blink = pose === "sleep" ? 0 : ((phase + 2) % 19 === 0 ? .08 : 1);
  px.ellipse(cx - 8, cy - 1, 6, 11, c.dark);
  px.ellipse(cx + 8, cy - 1, 6, 11, c.dark);
  px.ellipse(cx, cy, 13.5, 11.3, c.coat);
  px.ellipse(cx + 7, cy + 5, 9, 5.5, c.accent);
  eye(px, cx - 4, cy - 2, blink, c);
  eye(px, cx + 4, cy - 2, blink, c);
  px.disc(cx + 13, cy + 4, 2, c.nose);
  px.line(cx + 12, cy + 7, cx + 8, cy + 9, 1.2, c.ink);
}

function dogTail(px, x, y, pose, phase, c) {
  const wag = Math.sin((phase / 6) * Math.PI * 2) * (pose === "run" ? 5 : 3);
  if (pose === "sleep") {
    px.line(x, y, x - 13, y + 1, 6, c.coat);
    px.disc(x - 13, y + 1, 3, c.accent);
    return;
  }
  px.line(x, y, x - 11, y - 7, 6, c.coat);
  px.line(x - 11, y - 7, x - 17, y - 12 + wag, 5, c.light);
}

function paintDog(px, art, pose, phase) {
  const c = palette(art);
  if (pose === "sleep") {
    const breathe = phase % 2;
    px.ellipse(32, 45, 23, 10 + breathe, c.dark);
    px.ellipse(33, 42, 22, 11 + breathe, c.coat);
    dogTail(px, 18, 46, pose, phase, c);
    dogHead(px, 19, 39, pose, phase, c);
    px.ellipse(39, 48, 12, 3.2, c.accent);
    return;
  }
  const bob = (pose === "walk" || pose === "run") && phase % 2 ? 1 : 0;
  const lean = pose === "run" ? 3 : 0;
  const bx = 11 + lean, by = 29 + bob, bw = 38, bh = 19;
  dogTail(px, bx + 2, by + 12, pose, phase, c);
  px.ellipse(bx + bw * .48, by + bh * .58, bw * .56, bh * .57, c.dark);
  px.ellipse(bx + bw * .52, by + bh * .46, bw * .55, bh * .52, c.coat);
  px.ellipse(bx + bw * .69, by + bh * .66, 9, 5, c.accent);
  const amp = pose === "walk" ? 3 : pose === "run" ? 6 : 0;
  [bx + 9, bx + 18, bx + 30, bx + 38].forEach((x, i) => {
    const lift = ((i + phase) % 2) * amp;
    px.rect(x - 2.7, 45 - lift, 5.4, 10 + lift, c.coat);
    px.ellipse(x, 55 - lift, 3.7, 2.5, c.accent);
  });
  dogHead(px, bx + bw + 1, by + 4, pose, phase, c);
}

function paintFrame(px, art, pose, phase) {
  if (art.species === "cat") paintCat(px, art, pose, phase);
  else paintDog(px, art, pose, phase);
}

function makeSheet(art) {
  const rows = LAYOUT.length;
  const px = new Pix(COLS * F, rows * F);
  LAYOUT.forEach(([pose], row) => {
    for (let col = 0; col < COLS; col++) {
      const tmp = new Pix(F, F);
      paintFrame(tmp, art, pose, col);
      for (let y = 0; y < F; y++) {
        tmp.data.copy(px.data, ((row * F + y) * px.w + col * F) * 4, y * F * 4, (y + 1) * F * 4);
      }
    }
  });
  return { buffer: encodePng(px.w, px.h, px.data), layout: LAYOUT };
}

function sheetSpec(file, layout) {
  return {
    src: file,
    frameWidth: F,
    frameHeight: F,
    fps: 7,
    default: { row: 0, frames: layout[0][1] },
    animations: Object.fromEntries(layout.map(([pose, frames], row) => [pose, { row, frames, ...(pose === "sleep" ? { fps: 2 } : {}) }]))
  };
}

const SPECIES_ART = [
  { id: "cat", species: "cat", name: "Illustrated Cat", coat: "#d78a4f", accent: "#f2d1a3", eye: "#a7c96b" },
  { id: "dog", species: "dog", name: "Illustrated Dog", coat: "#b7824c", accent: "#ead2a7", eye: "#5a4635" }
];

for (const art of SPECIES_ART) {
  const file = `${art.id}-sample.png`;
  const { buffer, layout } = makeSheet(art);
  writeFileSync(join(outDir, file), buffer);
  console.log(`wrote web/sheets/${file} (${buffer.length} bytes, ${F}x${F} frames)`);

  const pack = {
    id: `${art.id}-pixel`,
    name: art.name,
    version: "1.1.0",
    species: art.species,
    author: "PetOS",
    description: "Code-generated illustrated sprite pack with layered shading and expressive motion.",
    appearance: { coat: art.coat, accent: art.accent, eye: art.eye, scale: 1, ...(art.species === "cat" ? { markings: "tabby" } : {}), sheet: sheetSpec(`sheets/${file}`, layout) },
    tags: ["generated", "illustrated", "sprites", art.species]
  };
  const packPath = join(root, "web", "packs", `${art.id}-pixel.json`);
  mkdirSync(dirname(packPath), { recursive: true });
  writeFileSync(packPath, JSON.stringify(pack, null, 2));
  console.log(`wrote web/packs/${art.id}-pixel.json`);
}
