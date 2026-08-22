import type { PetOSSettings, PetRecord, WorldObject } from "./types.js";

export interface PersistedAppState { version:1; pets:PetRecord[]; objects:WorldObject[]; settings:PetOSSettings; }
export const DEFAULT_SETTINGS:PetOSSettings={enabled:true,interactionMode:false,debug:false,reducedMotion:false,privacyLevel:1,maxFps:60,sound:true,soundVolume:.7,quietHours:false,cortexProvider:"off",cortexApiKey:"",cortexModel:"",autostart:false,focusMode:false,focusWorkMinutes:25,focusBreakMinutes:5,updateManifestUrl:""};
export const APP_VERSION="0.2.0";

/** Pure update-manifest comparison so it is unit-testable without network. */
export function isUpdateAvailable(currentVersion:string,manifest:unknown):{available:boolean;latest:string;notes:string}{
  const m=(manifest??{}) as {version?:unknown;notes?:unknown};
  if(typeof m.version!=="string"||!/^\d+\.\d+\.\d+/.test(m.version))return{available:false,latest:"",notes:"manifest missing a semver 'version'"};
  const pa=currentVersion.split(".").map(Number),pb=m.version.split(".").map(Number);
  let newer=false;
  for(let i=0;i<3;i++){const a=pa[i]??0,b=pb[i]??0;if(b>a){newer=true;break;}if(a>b)break;}
  return{available:newer,latest:m.version,notes:typeof m.notes==="string"?m.notes:""};
}

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
    sound: raw?.sound ?? true,
    soundVolume: typeof raw?.soundVolume === "number" ? Math.max(0, Math.min(1, raw.soundVolume)) : .7,
    quietHours: raw?.quietHours ?? false,
    cortexProvider: ["ollama","openai","openrouter","gemini","anthropic"].includes(raw?.cortexProvider as string) ? raw!.cortexProvider as PetOSSettings["cortexProvider"] : "off",
    cortexApiKey: typeof raw?.cortexApiKey === "string" ? raw.cortexApiKey : "",
    cortexModel: typeof raw?.cortexModel === "string" ? raw.cortexModel : "",
    autostart: raw?.autostart ?? false,
    focusMode: raw?.focusMode ?? false,
    focusWorkMinutes: Number.isFinite(raw?.focusWorkMinutes) ? Math.max(1, Math.min(120, raw!.focusWorkMinutes!)) : 25,
    focusBreakMinutes: Number.isFinite(raw?.focusBreakMinutes) ? Math.max(1, Math.min(60, raw!.focusBreakMinutes!)) : 5,
    updateManifestUrl: typeof raw?.updateManifestUrl === "string" ? raw.updateManifestUrl : ""
  };
}

export class BrowserPersistence {
  private saves = 0;

  constructor(private readonly key = "petos:state:v1", private readonly backupKey = "petos:state:v1:backup") {}

  load(): PersistedAppState | null {
    // Primary first, then the most recent known-good backup if the primary is corrupt.
    for (const storageKey of [this.key, this.backupKey]) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as LegacyState;
        if (!parsed || typeof parsed !== "object") continue;
        if ((parsed.version ?? 0) > CURRENT_VERSION) return null;
        const state: PersistedAppState = {
          version: CURRENT_VERSION,
          pets: Array.isArray(parsed.pets) ? parsed.pets as PetRecord[] : [],
          objects: Array.isArray(parsed.objects) ? parsed.objects as WorldObject[] : [],
          settings: migrateSettings(parsed.settings)
        };
        if (storageKey === this.backupKey) console.warn("PetOS: primary state was unreadable — restored from backup");
        return state;
      } catch { /* try next source */ }
    }
    return null;
  }

  save(state: PersistedAppState): void {
    const json = JSON.stringify({ ...state, version: CURRENT_VERSION });
    try {
      localStorage.setItem(this.key, json);
      this.saves++;
      if (this.saves % 5 === 0) {
        try { localStorage.setItem(this.backupKey, json); } catch { /* backup is best-effort */ }
      }
    } catch {
      /* persistence is best-effort */
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.key);
      localStorage.removeItem(this.backupKey);
    } catch { /* ignore */ }
  }

  export(): string {
    const state = this.load();
    if (!state) return "null";
    // Backups are commonly shared for troubleshooting. Provider credentials are
    // machine-local secrets and must never hitch a ride in an exported file.
    return JSON.stringify({ ...state, settings: { ...state.settings, cortexApiKey: "" } }, null, 2);
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
