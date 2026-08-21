import { test } from "node:test";
import assert from "node:assert/strict";
import { PetOSSimulation } from "../dist/src/core/simulation.js";
import { Pet, SeededRandom } from "../dist/src/index.js";
import { surfacesFromDesktop } from "../dist/src/core/world.js";

const M1 = { id: "left", rect: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, primary: true, scaleFactor: 1 };
const M2 = { id: "right", rect: { x: -2560, y: -240, width: 2560, height: 1440 }, workArea: { x: -2560, y: -240, width: 2560, height: 1400 }, primary: false, scaleFactor: 1.5 };

function boundsOf(monitors) {
  const minX = Math.min(...monitors.map(m => m.rect.x));
  const minY = Math.min(...monitors.map(m => m.rect.y));
  const maxX = Math.max(...monitors.map(m => m.rect.x + m.rect.width));
  const maxY = Math.max(...monitors.map(m => m.rect.y + m.rect.height));
  return { minX, minY, maxX, maxY };
}

function makeWindows(rng, monitors, count) {
  const windows = [];
  for (let i = 0; i < count; i++) {
    const mon = monitors[Math.floor(rng.next() * monitors.length)];
    const w = 300 + Math.floor(rng.next() * 600);
    const h = 200 + Math.floor(rng.next() * 500);
    windows.push({
      id: `win${i}`,
      title: `Window ${i}`,
      app: "app.exe",
      rect: {
        x: mon.rect.x + Math.floor(rng.next() * (mon.rect.width - w)),
        y: mon.rect.y + 40 + Math.floor(rng.next() * (mon.rect.height - h - 60)),
        width: w,
        height: h
      },
      visible: true,
      foreground: false,
      minimized: false
    });
  }
  return windows;
}

test("chaotic desktop: snaps, churn, explorer restart and monitor unplug never break pets", () => {
  const rng = new SeededRandom(20260821);
  const sim = new PetOSSimulation();
  sim.addPet(new Pet({ id: "cat", name: "Cat", species: "cat", nowMs: 0, x: 900, y: 1040 }, new SeededRandom(11)));
  sim.addPet(new Pet({ id: "dog", name: "Dog", species: "dog", nowMs: 0, x: 950, y: 1040 }, new SeededRandom(12)));
  sim.addPet(new Pet({ id: "bird", name: "Bird", species: "bird", nowMs: 0, x: -1200, y: 1160 }, new SeededRandom(13)));

  let monitors = [M1, M2];
  let windows = makeWindows(rng, monitors, 5);
  let nowMs = 1000;

  const assertSane = () => {
    const b = boundsOf(monitors);
    for (const pet of sim.pets.values()) {
      const { x, y } = pet.state.body.position;
      assert.ok(Number.isFinite(x), "x must stay finite");
      assert.ok(Number.isFinite(y), "y must stay finite");
      // Generous escape margin — pets may fall but never leave known coordinate space.
      assert.ok(x > b.minX - 400 && x < b.maxX + 400, `x ${x.toFixed(0)} escaped the virtual desktop`);
      assert.ok(y > b.minY - 400 && y < b.maxY + 900, `y ${y.toFixed(0)} escaped below reality`);
    }
  };

  for (let tick = 0; tick < 1400; tick++) {
    nowMs += 16;

    if (tick === 400) {
      // Nightmare test: unplug a monitor while a bird stands on a window on it.
      monitors = [M1];
      windows = windows.filter(w => w.rect.x >= M1.rect.x && w.rect.x < M1.rect.x + M1.rect.width);
    }
    if (tick === 700) {
      monitors = [M2, M1]; // reconnect (order shuffled, like Windows does)
    }
    if (tick === 900) {
      windows = []; // Explorer restart: every window vanishes at once
    }
    if (tick === 940) {
      windows = makeWindows(rng, monitors, 4);
    }

    // Ordinary churn: move, snap or respawn windows
    if (rng.chance(.25) && windows.length) {
      const win = windows[Math.floor(rng.next() * windows.length)];
      if (rng.chance(.3)) {
        // Violent snap far across the desktop in one frame
        win.rect.x += rng.between(-700, 700);
        win.rect.y += rng.between(-300, 200);
      } else {
        win.rect.x += rng.between(-40, 40);
        win.rect.y += rng.between(-20, 20);
      }
    }
    if (rng.chance(.04)) windows.pop();
    if (rng.chance(.05)) windows = [...windows, ...makeWindows(rng, monitors, 1)];

    const cursorSpeed = rng.chance(.3) ? 1500 : 30;
    sim.tick({
      nowMs,
      dtMs: 16,
      monitors,
      windows,
      cursorPosition: { x: rng.between(0, 1920), y: rng.between(0, 1040) },
      cursorSpeed,
      cursorButtons: 0,
      userActivity: "active",
      foregroundApp: null,
      secondsSinceNewWindow: rng.chance(.05) ? 0 : 999,
      interactionMode: false,
      idleSeconds: 0,
      locked: false,
      batteryLevel: null,
      charging: true
    });
    assertSane();
  }

  // After the storm settles, everyone must find solid ground again.
  for (let tick = 0; tick < 800; tick++) {
    nowMs += 16;
    sim.tick({
      nowMs, dtMs: 16, monitors: [M1], windows: [],
      cursorPosition: { x: 960, y: 520 }, cursorSpeed: 0, cursorButtons: 0,
      userActivity: "active", foregroundApp: null, secondsSinceNewWindow: 999,
      interactionMode: false, idleSeconds: 0, locked: false, batteryLevel: null, charging: true
    });
  }
  for (const pet of sim.pets.values()) {
    assert.equal(pet.state.body.grounded, true, `${pet.state.name} should recover to solid ground`);
    const sid = pet.state.body.surfaceId;
    assert.ok(sid, `${pet.state.name} should be standing on a surface`);
    assert.ok(["taskbar:left"].includes(sid) || sid.startsWith("floor:"), `unexpected surface ${sid}`);
  }
});

test("top-docked taskbar becomes a walkable surface at the work-area boundary", () => {
  const topMonitor = { id: "t", rect: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 48, width: 1920, height: 1032 }, primary: true, scaleFactor: 1 };
  const surfaces = surfacesFromDesktop([topMonitor], []);
  const taskbar = surfaces.find(s => s.kind === "taskbar");
  assert.ok(taskbar, "top taskbar should exist");
  assert.equal(taskbar.walkY, 48, "pets walk along the taskbar's lower border");
});
