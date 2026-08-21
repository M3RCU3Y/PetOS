import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPrivacy } from "../dist/src/core/privacy.js";
import { Pet } from "../dist/src/core/pet.js";
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
