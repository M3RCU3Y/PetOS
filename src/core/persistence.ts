import type { PetOSSettings, PetRecord, WorldObject } from "./types.js";

export interface PersistedAppState { version:1; pets:PetRecord[]; objects:WorldObject[]; settings:PetOSSettings; }
export const DEFAULT_SETTINGS:PetOSSettings={enabled:true,interactionMode:false,debug:false,reducedMotion:false,privacyLevel:1,maxFps:60,sound:true};

const CURRENT_VERSION = 1;

interface LegacyState {
  version?: number;
  pets?: unknown[];
  objects?: unknown[];
  settings?: Partial<PetOSSettings>;
}

function migrateSettings(raw: Partial<PetOSSettings> | undefined): PetOSSettings {
  return {
    enabled: raw?.enabled ?? true,
    interactionMode: raw?.interactionMode ?? false,
    debug: raw?.debug ?? false,
    reducedMotion: raw?.reducedMotion ?? false,
    privacyLevel: (raw?.privacyLevel ?? 1) as PetOSSettings["privacyLevel"],
    maxFps: (raw?.maxFps ?? 60) as PetOSSettings["maxFps"],
    sound: raw?.sound ?? true
  };
}

export class BrowserPersistence {
  constructor(private readonly key = "petos:state:v1") {}

  load(): PersistedAppState | null {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LegacyState;
      if (!parsed || typeof parsed !== "object") return null;
      // Future migrations go here when version increments
      if ((parsed.version ?? 0) > CURRENT_VERSION) return null;
      return {
        version: CURRENT_VERSION,
        pets: Array.isArray(parsed.pets) ? parsed.pets as PetRecord[] : [],
        objects: Array.isArray(parsed.objects) ? parsed.objects as WorldObject[] : [],
        settings: migrateSettings(parsed.settings)
      };
    } catch {
      return null;
    }
  }

  save(state: PersistedAppState): void {
    try {
      localStorage.setItem(this.key, JSON.stringify({ ...state, version: CURRENT_VERSION }));
    } catch {
      /* persistence is best-effort */
    }
  }

  clear(): void {
    try { localStorage.removeItem(this.key); } catch { /* ignore */ }
  }

  export(): string {
    const state = this.load();
    return JSON.stringify(state, null, 2);
  }

  import(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== "object") return false;
      localStorage.setItem(this.key, JSON.stringify(parsed));
      return true;
    } catch {
      return false;
    }
  }
}
