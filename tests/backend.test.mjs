import { test } from "node:test";
import assert from "node:assert/strict";
import { isUpdateAvailable, APP_VERSION } from "../dist/src/core/persistence.js";
import { toEventRow, SCHEMA_DDL } from "../dist/src/app/sqlbridge.js";

test("update manifest comparison is semver-aware and defensive", () => {
  assert.equal(isUpdateAvailable("0.2.0", { version: "0.3.0" }).available, true);
  assert.equal(isUpdateAvailable("0.2.0", { version: "1.0.0" }).available, true);
  assert.equal(isUpdateAvailable("0.2.0", { version: "0.2.1" }).available, true);
  assert.equal(isUpdateAvailable("0.2.0", { version: "0.2.0" }).available, false);
  assert.equal(isUpdateAvailable("0.2.0", { version: "0.1.9" }).available, false);
  const bad = isUpdateAvailable(APP_VERSION, { version: "hello" });
  assert.equal(bad.available, false);
  assert.ok(bad.notes.includes("semver"));
  assert.equal(isUpdateAvailable(APP_VERSION, null).available, false);
  const good = isUpdateAvailable("0.2.0", { version: "0.3.0", notes: "big litters of fixes" });
  assert.equal(good.notes, "big litters of fixes");
});

test("episodic memories map onto normalized event rows with nulls, not undefined", () => {
  const row = toEventRow("pet-1", {
    atMs: 1234.7,
    kind: "petting",
    valence: .85,
    salience: .7,
    note: "was petted",
    subjectId: undefined,
    surfaceId: "window:code",
    app: undefined
  });
  assert.equal(row.pet_id, "pet-1");
  assert.equal(row.at_ms, 1235, "timestamps are rounded to whole ms");
  assert.equal(row.subject_id, null);
  assert.equal(row.app, null);
  assert.equal(row.surface_id, "window:code");
});

test("schema includes indexes that keep long-term event queries fast", () => {
  const joined = SCHEMA_DDL.join("\n");
  assert.ok(joined.includes("idx_events_pet_time"));
  assert.ok(joined.includes("idx_events_kind_time"));
  assert.ok(joined.includes("CREATE TABLE IF NOT EXISTS events"));
});
