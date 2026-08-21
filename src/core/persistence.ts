import type { PetOSSettings, PetRecord, WorldObject } from "./types.js";

export interface PersistedAppState { version:1; pets:PetRecord[]; objects:WorldObject[]; settings:PetOSSettings; }
export const DEFAULT_SETTINGS:PetOSSettings={enabled:true,interactionMode:false,debug:false,reducedMotion:false,privacyLevel:1,maxFps:60,sound:false};

export class BrowserPersistence {
  constructor(private readonly key="petos:state:v1"){}
  load():PersistedAppState|null{try{const raw=localStorage.getItem(this.key);if(!raw)return null;const parsed=JSON.parse(raw) as PersistedAppState;return parsed.version===1?parsed:null;}catch{return null;}}
  save(state:PersistedAppState):void{try{localStorage.setItem(this.key,JSON.stringify(state));}catch{/* persistence is best-effort */}}
  clear():void{try{localStorage.removeItem(this.key);}catch{/* ignore */}}
}
