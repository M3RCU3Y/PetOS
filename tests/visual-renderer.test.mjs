import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drawIllustratedCat } from "../dist/src/app/illustratedCat.js";

test("illustrated cat renderer is part of the compiled app", () => {
  assert.equal(typeof drawIllustratedCat, "function");
});

test("cat lab ships with local web builds", () => {
  const root = join(import.meta.dirname, "..");
  const lab = join(root, "dist", "cat-lab.html");
  assert.ok(existsSync(lab), "dist/cat-lab.html should be copied during npm run build");
  const html = readFileSync(lab, "utf8");
  assert.match(html, /drawIllustratedCat/);
  assert.match(html, /Procedural Cat Lab/);
});
