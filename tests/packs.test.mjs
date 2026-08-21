import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVersions, isCompatible, validatePackDetailed } from "../dist/src/core/packs.js";

test("version comparison works", () => {
  assert.ok(compareVersions("2.0.0", "1.0.0") > 0);
  assert.ok(compareVersions("1.0.0", "1.1.0") < 0);
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
});

test("compatibility check", () => {
  const pack = { id: "t", name: "T", version: "1.5.0", species: "cat", author: "", description: "", appearance: { coat: "#fff", accent: "#fff", eye: "#000", scale: 1 }, tags: [] };
  assert.ok(isCompatible(pack, "1.0.0"));
  assert.ok(!isCompatible(pack, "2.0.0"));
});

test("detailed validation catches issues", () => {
  const bad = validatePackDetailed({ id: "", species: "dragon" });
  assert.ok(bad.errors.length > 0);
  assert.equal(bad.pack, null);

  const warn = validatePackDetailed({ id: "ok", name: "OK", species: "cat", appearance: { coat: "red", accent: "#fff", eye: "#000" } });
  assert.ok(warn.pack !== null);
  assert.ok(warn.warnings.length > 0);
});
