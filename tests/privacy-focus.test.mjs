import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPrivacy } from "../dist/src/core/privacy.js";
import { Pet, isAdoptionAnniversary } from "../dist/src/core/pet.js";
import { calmDesktop } from "../dist/src/core/world.js";

const WINDOWS = [
  { id: "w1", title: "Secret Report.docx — Word", app: "winword.exe", rect: { x: 0, y: 0, width: 400, height: 300 }, visible: true, foreground: true, minimized: false }
];

test("Blind mode (level 0) strips app identity, titles and activity inference", () => {
  const out = applyPrivacy(0, { userActivity: "gaming", foregroundApp: "steam.exe", windows: WINDOWS });
  assert.equal(out.foregroundApp, null);
  assert.equal(out.userActivity, "active");
  assert.equal(out.windows[0].app, "");
  assert.equal(out.windows[0].title, "");
  assert.equal(out.windows[0].rect.width, 400, "geometry is preserved");
});

test("Ambient mode (level 1) passes context through", () => {
  const out = applyPrivacy(1, { userActivity: "media", foregroundApp: "vlc.exe", windows: WINDOWS });
  assert.equal(out.foregroundApp, "vlc.exe");
  assert.equal(out.userActivity, "media");
  assert.equal(out.windows[0].title, WINDOWS[0].title);
});

test("focus breaks invite pets to gather around the keeper", () => {
  const pet = new Pet({ id: "buddy", name: "Buddy", species: "dog", nowMs: 0 }, undefined);
  pet.state.behaviorSinceMs = -30_000;
  const w = calmDesktop(10_000);
  w.focusBreak = true;
  const decision = pet.tick(w, 16);
  const visit = decision.allScores.find(s => s.behavior === "seek_user" && s.reason.includes("break time"));
  assert.ok(visit, "break should offer a visit-the-keeper option");
});

test("adoption anniversaries are celebrated once with a diary entry and mood boost", () => {
  const now = Date.now();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const pet = new Pet({ id: "bday", name: "Party", species: "cat", nowMs: now }, undefined);
  pet.state.adoptedAtMs = oneYearAgo.getTime();
  assert.ok(isAdoptionAnniversary(pet.state, now), "same month/day one year later counts");
  assert.ok(!isAdoptionAnniversary({ ...pet.state, adoptedAtMs: now }, now), "the adoption day itself is not an anniversary");

  const w = calmDesktop(now);
  pet.tick(w, 16);
  const celebrated = pet.diary.recent.some(e => e.title.includes("adoption day"));
  assert.ok(celebrated, "diary should record the anniversary");
  // Second tick the same year must not duplicate it
  w.nowMs += 60_000;
  pet.state.behaviorSinceMs = -30_000;
  pet.tick(w, 16);
  const count = pet.diary.recent.filter(e => e.title.includes("adoption day")).length;
  assert.equal(count, 1, "anniversary fires once per year");
});
