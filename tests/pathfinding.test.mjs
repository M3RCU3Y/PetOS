import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSurfaceGraph, planRoute } from "../dist/src/core/pathfinding.js";
import { surfacesFromDesktop } from "../dist/src/core/world.js";

test("surface graph connects taskbar to reachable window", () => {
  const monitor = { id: "primary", rect: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, primary: true, scaleFactor: 1 };
  const win = { id: "w1", title: "Editor", app: "code", rect: { x: 400, y: 800, width: 600, height: 200 }, visible: true, foreground: false, minimized: false };
  const surfaces = surfacesFromDesktop([monitor], [win]);
  const graph = buildSurfaceGraph(surfaces, 310, 220);
  const route = planRoute(graph, "taskbar:primary", "window:w1");
  assert.ok(route.length > 0, "should find a route from taskbar to window");
});

test("unreachable surface returns empty route", () => {
  const monitor = { id: "primary", rect: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, primary: true, scaleFactor: 1 };
  const farWin = { id: "far", title: "Far", app: "x", rect: { x: 5000, y: -2000, width: 200, height: 100 }, visible: true, foreground: false, minimized: false };
  const surfaces = surfacesFromDesktop([monitor], [farWin]);
  const graph = buildSurfaceGraph(surfaces, 310, 220);
  const route = planRoute(graph, "taskbar:primary", "window:far");
  assert.equal(route.length, 0);
});

test("climbers get climb edges up tall ledges that jumpers cannot use", () => {
  const monitor = { id: "primary", rect: { x: 0, y: 0, width: 1920, height: 1080 }, workArea: { x: 0, y: 0, width: 1920, height: 1040 }, primary: true, scaleFactor: 1 };
  // A window whose top is 420px above the taskbar — beyond any jump, within climbing range
  const win = { id: "tall", title: "Tall", app: "code", rect: { x: 400, y: 620, width: 600, height: 420 }, visible: true, foreground: false, minimized: false };
  const surfaces = surfacesFromDesktop([monitor], [win]);
  const jumperGraph = buildSurfaceGraph(surfaces, 310, 220);
  assert.equal(planRoute(jumperGraph, "taskbar:primary", "window:tall").length, 0, "dogs/rabbits cannot route up a tall wall");
  const climberGraph = buildSurfaceGraph(surfaces, 310, 220, true);
  const route = planRoute(climberGraph, "taskbar:primary", "window:tall");
  assert.ok(route.length > 0, "cats can route up via climbing");
  assert.equal(route[0].kind, "climb");
  assert.equal(route[0].to, "window:tall");
});
