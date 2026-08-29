import { test } from "node:test";
import assert from "node:assert/strict";
import { weatherFor, eventFor, weatherEffect } from "../dist/src/core/weather.js";

test("weather is deterministic for same date", () => {
  const d = new Date(2026, 5, 15);
  assert.equal(weatherFor(d), weatherFor(d));
});

test("seasonal events match dates", () => {
  const halloween = new Date(2026, 9, 31);
  const evt = eventFor(halloween);
  assert.ok(evt !== null);
  assert.equal(evt.id, "halloween");
  const normalDay = new Date(2026, 5, 15);
  assert.equal(eventFor(normalDay), null);
});

test("weather effects have correct polarity", () => {
  const clear = weatherEffect("clear");
  assert.ok(clear.moodShift > 0);
  const stormy = weatherEffect("stormy");
  assert.ok(stormy.moodShift < 0);
});
