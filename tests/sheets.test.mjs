import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveSheetAnimation } from "../dist/src/app/renderer.js";
import { validatePackDetailed, validatePackDetailed as validate, BUILTIN_PACKS } from "../dist/src/core/packs.js";

const SHEET = {
  src: "sheets/cat.png",
  frameWidth: 32,
  frameHeight: 32,
  fps: 8,
  default: { row: 0, frames: 4 },
  animations: {
    idle: { row: 0, frames: 4 },
    walk: { row: 1, frames: 6 },
    sleep: { row: 2, frames: 2, fps: 2 }
  }
};

test("sheet animations resolve directly by behavior", () => {
  const r = resolveSheetAnimation(SHEET, "walk");
  assert.equal(r.key, "walk");
  assert.equal(r.anim.row, 1);
});

test("sheet animations fall back through aliases", () => {
  assert.equal(resolveSheetAnimation(SHEET, "run").key, "walk", "run aliases to walk");
  assert.equal(resolveSheetAnimation(SHEET, "zoomies").key, "walk", "zoomies aliases through run to walk");
  assert.equal(resolveSheetAnimation(SHEET, "cuddle").anim.fps, 2, "cuddle falls back to sleep with its own fps");
});

test("behaviors with no matching or aliased animation land on default", () => {
  const minimal = {
    src: "sheets/bird.png", frameWidth: 24, frameHeight: 24,
    default: { row: 0, frames: 2 },
    animations: { fly: { row: 5, frames: 3 } }
  };
  assert.equal(resolveSheetAnimation(minimal, "carry_toy").key, "default");
  assert.equal(resolveSheetAnimation(minimal, "fly").anim.row, 5);
});

test("packs accept a valid spritesheet and markings spec", () => {
  const result = validatePackDetailed({
    id: "sheet-cat", name: "Sheet Cat", species: "cat",
    appearance: { coat: "#333333", accent: "#eeeeee", eye: "#aaffaa", scale: 1, sheet: SHEET, markings: "tuxedo" },
    tags: []
  });
  assert.equal(result.pack?.appearance.sheet?.frameWidth, 32);
  assert.equal(result.pack?.appearance.markings, "tuxedo");
  assert.deepEqual(result.errors, []);
});

test("malformed sheets are warned about but do not reject the pack", () => {
  const result = validatePackDetailed({
    id: "bad-sheet", name: "Bad Sheet", species: "dog",
    appearance: { coat: "#333333", accent: "#eeeeee", eye: "#aaffaa", scale: 1, sheet: { src: "", frameWidth: -5, frameHeight: 0 } },
    tags: []
  });
  assert.ok(result.pack);
  assert.equal(result.pack?.appearance.sheet, undefined);
  assert.ok(result.warnings.some(w => w.includes("sheet")));
});

test("sprite-demo builtin packs ship valid sheets and their art exists on disk", () => {
  const root = join(import.meta.dirname, "..");
  const pixelPacks = BUILTIN_PACKS.filter(p => p.appearance.sheet);
  assert.ok(pixelPacks.length >= 2, "cat-pixel and dog-pixel built-ins present");
  for (const pack of pixelPacks) {
    assert.ok(existsSync(join(root, "web", pack.appearance.sheet.src)), `${pack.id} sheet file must exist: ${pack.appearance.sheet.src}`);
    const anims = { ...pack.appearance.sheet.animations, default: pack.appearance.sheet.default };
    for (const anim of Object.values(anims)) {
      assert.ok(anim.row >= 0 && anim.frames >= 1, "animation rows/frames sane");
    }
    // The generated PNG header declares the exact sheet dimensions
    const png = readFileSync(join(root, "web", pack.appearance.sheet.src));
    assert.equal(png.readUInt32BE(16), pack.appearance.sheet.frameWidth * 6, "PNG width covers 6 frame columns");
    assert.equal(png.readUInt32BE(20), pack.appearance.sheet.frameHeight * 4, "PNG height covers 4 animation rows");
  }
});

test("shipped example pack JSON files validate", () => {
  const root = join(import.meta.dirname, "..");
  for (const name of ["cat-pixel.json", "dog-pixel.json"]) {
    const raw = JSON.parse(readFileSync(join(root, "web", "packs", name), "utf8"));
    const result = validate(raw);
    assert.ok(result.pack, `${name} should validate`);
    assert.ok(result.pack.appearance.sheet, `${name} carries a sheet`);
  }
});