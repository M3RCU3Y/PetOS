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
