import type { PersistedAppState } from "../core/persistence.js";
import type { PetRecord, WorldObject } from "../core/types.js";

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

function getInvoke(): Invoke | null {
  const tauri = (window as unknown as { __TAURI__?: { core?: { invoke: Invoke } } }).__TAURI__;
  return tauri?.core?.invoke ?? null;
}

export interface SqlDatabase {
  select<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<T[]>;
  execute(sql: string, values?: unknown[]): Promise<void>;
}

const DB_LABEL = "sqlite:petos.db";

/**
 * Opens the PetOS SQLite database through the Tauri SQL plugin's raw invoke surface.
 * We call `plugin:sql|*` commands directly because this project ships unbundled ES
 * modules and cannot import the plugin's npm client. Returns null in the browser
 * habitat or whenever the plugin is unavailable — callers must fall back gracefully.
 */
export async function openPetosDb(): Promise<SqlDatabase | null> {
  const invoke = getInvoke();
  if (!invoke) return null;
  try {
    await invoke("plugin:sql|load", { db: DB_LABEL });
    const db: SqlDatabase = {
      async select<T>(sql: string, values: unknown[] = []): Promise<T[]> {
        return invoke<T[]>("plugin:sql|select", { db: DB_LABEL, sql, values });
      },
      async execute(sql: string, values: unknown[] = []): Promise<void> {
        await invoke("plugin:sql|execute", { db: DB_LABEL, sql, values });
      }
    };
    await ensureSchema(db);
    return db;
  } catch (err) {
    console.warn("PetOS SQLite unavailable — staying on the JSON store", err);
    return null;
  }
}

export const SCHEMA_DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    species TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    state_json TEXT NOT NULL,
    appearance_json TEXT NOT NULL,
    memory_json TEXT NOT NULL,
    diary_json TEXT,
    routines_json TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS objects (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    radius REAL NOT NULL,
    comfort REAL,
    contents TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pet_id TEXT NOT NULL,
    at_ms INTEGER NOT NULL,
    kind TEXT NOT NULL,
    valence REAL,
    salience REAL,
    note TEXT,
    subject_id TEXT,
    surface_id TEXT,
    app TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_events_pet_time ON events(pet_id, at_ms)`,
  `CREATE INDEX IF NOT EXISTS idx_events_kind_time ON events(kind, at_ms)`
];

async function ensureSchema(db: SqlDatabase): Promise<void> {
  for (const ddl of SCHEMA_DDL) await db.execute(ddl);
}

/* ---------- state load/save ---------- */

export async function loadStateFromDb(db: SqlDatabase): Promise<PersistedAppState | null> {
  try {
    const petRows = await db.select<Record<string, unknown>>(`SELECT * FROM pets`);
    const objectRows = await db.select<Record<string, unknown>>(`SELECT * FROM objects`);
    const settingRows = await db.select<{ key: string; value_json: string }>(`SELECT key, value_json FROM settings`);
    if (!petRows.length && !settingRows.length && !objectRows.length) return null;

    const pets: PetRecord[] = petRows.map(r => ({
      save: JSON.parse(String(r.state_json)),
      appearance: JSON.parse(String(r.appearance_json)),
      ...(r.diary_json ? { diary: JSON.parse(String(r.diary_json)) } : {}),
      ...(r.routines_json ? { routines: JSON.parse(String(r.routines_json)) } : {})
    }));
    const objects: WorldObject[] = objectRows.map(r => ({
      id: String(r.id),
      kind: r.kind as WorldObject["kind"],
      position: { x: Number(r.x), y: Number(r.y) },
      radius: Number(r.radius),
      ...(r.comfort === null || r.comfort === undefined ? {} : { comfort: Number(r.comfort) }),
      ...(r.contents ? { contents: r.contents as "food" | "water" } : {})
    }));
    const settingsJson = settingRows.find(s => s.key === "app")?.value_json;
    return {
      version: 1,
      pets,
      objects,
      settings: settingsJson ? JSON.parse(settingsJson) : {}
    };
  } catch (err) {
    console.warn("PetOS SQLite read failed", err);
    return null;
  }
}

export async function saveStateToDb(db: SqlDatabase, state: PersistedAppState): Promise<void> {
  await db.execute(`DELETE FROM objects`);
  await db.execute(`DELETE FROM pets`);
  for (const obj of state.objects) {
    await db.execute(
      `INSERT OR REPLACE INTO objects (id,kind,x,y,radius,comfort,contents) VALUES (?,?,?,?,?,?,?)`,
      [obj.id, obj.kind, obj.position.x, obj.position.y, obj.radius, obj.comfort ?? null, obj.contents ?? null]
    );
  }
  for (const rec of state.pets) {
    const mem = rec.save;
    await db.execute(
      `INSERT OR REPLACE INTO pets (id,name,species,updated_at,state_json,appearance_json,memory_json,diary_json,routines_json)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        rec.save.state.id,
        rec.save.state.name,
        rec.save.state.species,
        Date.now(),
        JSON.stringify(rec.save),
        JSON.stringify(rec.appearance),
        JSON.stringify({
          memories: mem.memories,
          surfacePreferences: mem.surfacePreferences,
          appPreferences: mem.appPreferences,
          toyPreferences: mem.toyPreferences ?? {},
          relationships: mem.relationships
        }),
        rec.diary ? JSON.stringify(rec.diary) : null,
        rec.routines ? JSON.stringify(rec.routines) : null
      ]
    );
  }
  await db.execute(
    `INSERT OR REPLACE INTO settings (key,value_json) VALUES ('app',?)`,
    [JSON.stringify(state.settings)]
  );
}

/* ---------- normalized episodic history ---------- */

export interface EventRow {
  pet_id: string;
  at_ms: number;
  kind: string;
  valence: number | null;
  salience: number | null;
  note: string | null;
  subject_id: string | null;
  surface_id: string | null;
  app: string | null;
}

/** Maps an episodic memory onto the normalized event row shape. Pure and unit-tested. */
export function toEventRow(petId: string, memory: {
  atMs: number; kind: string; valence?: number; salience?: number; note?: string;
  subjectId?: string; surfaceId?: string; app?: string;
}): EventRow {
  return {
    pet_id: petId,
    at_ms: Math.round(memory.atMs),
    kind: memory.kind,
    valence: typeof memory.valence === "number" ? memory.valence : null,
    salience: typeof memory.salience === "number" ? memory.salience : null,
    note: memory.note ?? null,
    subject_id: memory.subjectId ?? null,
    surface_id: memory.surfaceId ?? null,
    app: memory.app ?? null
  };
}

/**
 * Appends each pet's memories newer than the caller-tracked watermark.
 * Returns the advanced watermarks so the next flush stays incremental.
 */
export async function appendNewEvents(db: SqlDatabase, pets: PetRecord[], watermarks: Record<string, number>): Promise<Record<string, number>> {
  const next = { ...watermarks };
  for (const rec of pets) {
    const id = rec.save.state.id;
    const since = watermarks[id] ?? 0;
    const fresh = rec.save.memories.filter(m => m.atMs > since);
    if (!fresh.length) continue;
    for (const m of fresh) {
      const row = toEventRow(id, m);
      await db.execute(
        `INSERT INTO events (pet_id,at_ms,kind,valence,salience,note,subject_id,surface_id,app) VALUES (?,?,?,?,?,?,?,?,?)`,
        [row.pet_id, row.at_ms, row.kind, row.valence, row.salience, row.note, row.subject_id, row.surface_id, row.app]
      );
    }
    next[id] = Math.max(since, ...fresh.map(m => m.atMs));
  }
  return next;
}
