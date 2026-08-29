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

test("long user idle lets the pet relax", () => {
  const r = ambientReaction({ activity: "idle", charging: true, batteryLevel: null, idleSeconds: 600, foregroundApp: null, hourOfDay: 12 });
  assert.ok(r.energyShift > 0);
});

test("low battery away from a charger conserves energy", () => {
  const r = ambientReaction({ activity: "active", charging: false, batteryLevel: .12, idleSeconds: 0, foregroundApp: null, hourOfDay: 12 });
  assert.ok(r.energyShift < 0);
  assert.ok(r.moodShift <= 0);
});

test("locked workstation reads as keeper-away calm", () => {
  // main.ts maps locked → idleSeconds floor of 300s
  const r = ambientReaction({ activity: "idle", charging: true, batteryLevel: null, idleSeconds: Math.max(0, 300), foregroundApp: null, hourOfDay: 14 });
  assert.ok(r.energyShift >= 0);
});
