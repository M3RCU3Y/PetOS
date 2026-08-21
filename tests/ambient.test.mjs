import { test } from "node:test";
import assert from "node:assert/strict";
import { categorizeApp, ambientReaction } from "../dist/src/core/ambient.js";

test("app categorization maps known apps", () => {
  assert.equal(categorizeApp("code.exe"), "coding");
  assert.equal(categorizeApp("chrome"), "browsing");
  assert.equal(categorizeApp("spotify"), "music");
  assert.equal(categorizeApp("steam"), "gaming");
  assert.equal(categorizeApp(null), "unknown");
});

test("fullscreen suppresses energy", () => {
  const r = ambientReaction({ activity: "fullscreen", charging: false, batteryLevel: null, idleSeconds: 0, foregroundApp: null, hourOfDay: 12 });
  assert.ok(r.energyShift < 0);
});

test("media makes pets drowsy", () => {
  const r = ambientReaction({ activity: "active", charging: false, batteryLevel: null, idleSeconds: 0, foregroundApp: "vlc", hourOfDay: 12 });
  assert.ok(r.energyShift < 0);
  assert.ok(r.moodShift > 0);
});
