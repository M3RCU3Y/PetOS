import type { DesktopWindow, MonitorInfo, UserActivity, Vec2 } from "../core/types.js";

interface NativeDesktopSnapshot {
  monitors: MonitorInfo[];
  windows: DesktopWindow[];
  cursor: Vec2;
  cursor_speed: number;
  cursor_buttons: number;
  foreground_app: string | null;
  user_activity: UserActivity;
  seconds_since_new_window: number;
  idle_seconds: number;
  locked: boolean;
}

type TauriGlobal = {
  core?: { invoke<T>(command:string,args?:Record<string,unknown>):Promise<T> };
  event?: { listen<T>(event:string,cb:(e:{payload:T})=>void):Promise<()=>void> };
};

declare global { interface Window { __TAURI__?: TauriGlobal; } }

export interface DesktopBridge {
  native:boolean;
  snapshot():Promise<NativeDesktopSnapshot>;
  setInteractionMode(enabled:boolean):Promise<void>;
  setOverlayVisible(enabled:boolean):Promise<void>;
  openSettings():Promise<void>;
  onSettingsRequested(cb:()=>void):Promise<()=>void>;
}

export class TauriDesktopBridge implements DesktopBridge {
  native=true;
  private get api():TauriGlobal { if(!window.__TAURI__)throw new Error("Tauri API unavailable");return window.__TAURI__; }
  async snapshot():Promise<NativeDesktopSnapshot>{return this.api.core!.invoke<NativeDesktopSnapshot>("get_desktop_snapshot");}
  async setInteractionMode(enabled:boolean):Promise<void>{await this.api.core!.invoke("set_interaction_mode",{enabled});}
  async setOverlayVisible(enabled:boolean):Promise<void>{await this.api.core!.invoke("set_overlay_visible",{enabled});}
  async openSettings():Promise<void>{await this.api.core!.invoke("show_settings");}
  async onSettingsRequested(cb:()=>void):Promise<()=>void>{if(!this.api.event?.listen)return()=>{};return this.api.event.listen("petos://show-settings",()=>cb());}
}

export class MockDesktopBridge implements DesktopBridge {
  native=false;
  private cursor={x:900,y:700};
  private prev={x:900,y:700,t:performance.now()};
  private speed=0;
  private interaction=false;
  private listeners=new Set<()=>void>();
  private lastInputAt=performance.now();
  constructor(){
    const markInput=()=>{this.lastInputAt=performance.now();};
    window.addEventListener("pointermove",e=>{const now=performance.now(),dt=Math.max(1,now-this.prev.t);markInput();this.cursor={x:e.clientX,y:e.clientY};this.speed=Math.hypot(e.clientX-this.prev.x,e.clientY-this.prev.y)/(dt/1000);this.prev={x:e.clientX,y:e.clientY,t:now};});
    window.addEventListener("keydown",markInput);
    window.addEventListener("pointerdown",markInput);
  }
  async snapshot():Promise<NativeDesktopSnapshot>{
    if(performance.now()-this.prev.t>160)this.speed=0;
    const w=window.innerWidth,h=window.innerHeight;
    const idleSeconds=(performance.now()-this.lastInputAt)/1000;
    return{monitors:[{id:"browser",rect:{x:0,y:0,width:w,height:h},workArea:{x:0,y:0,width:w,height:h-42},primary:true,scaleFactor:devicePixelRatio}],windows:[{id:"demo-code",title:"PetOS — Visual Studio Code",app:"Code.exe",rect:{x:w*.38,y:h*.18,width:w*.52,height:h*.55},visible:true,foreground:true,minimized:false}],cursor:{...this.cursor},cursor_speed:this.speed,cursor_buttons:0,foreground_app:"Code.exe",user_activity:"active",seconds_since_new_window:999,idle_seconds:idleSeconds,locked:false};
  }
  async setInteractionMode(enabled:boolean):Promise<void>{this.interaction=enabled;void this.interaction;}
  async setOverlayVisible(_enabled:boolean):Promise<void>{}
  async openSettings():Promise<void>{for(const fn of this.listeners)fn();}
  async onSettingsRequested(cb:()=>void):Promise<()=>void>{this.listeners.add(cb);return()=>this.listeners.delete(cb);}
}

export function createDesktopBridge():DesktopBridge{return window.__TAURI__?.core?.invoke?new TauriDesktopBridge():new MockDesktopBridge();}
