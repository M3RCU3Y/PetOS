import { Pet } from "../core/pet.js";
import { PetOSSimulation, type DesktopFrame } from "../core/simulation.js";
import { BrowserPersistence, DEFAULT_SETTINGS } from "../core/persistence.js";
import type { PetAppearance, PetOSSettings, Rect, WorldObject } from "../core/types.js";
import type { PetPack } from "../core/packs.js";
import { createDesktopBridge } from "./bridge.js";
import { PixelRenderer } from "./renderer.js";
import { SettingsUI } from "./ui.js";
import { SoundEngine } from "./sound.js";
import { showOnboarding } from "./onboarding.js";
import { InteractionManager, type InteractionTarget } from "./interaction.js";
import { FurnitureEditor, FURNITURE_TEMPLATES, type FurnitureTemplate } from "./furniture.js";
import { ThoughtBubbles, generateThought } from "./thoughts.js";
import { weatherFor, eventFor, weatherEffect } from "../core/weather.js";
import { createCortex } from "../core/cortex.js";
import { PhotographyMode } from "./photography.js";

const canvas=document.querySelector<HTMLCanvasElement>("#pet-canvas")!;
const renderer=new PixelRenderer(canvas);
const bridge=createDesktopBridge();
const persistence=new BrowserPersistence();
const sim=new PetOSSimulation();
let settings:PetOSSettings={...DEFAULT_SETTINGS};
let lastFrame=performance.now(),lastSave=0,lastNativePoll=0,lastNative:any=null,virtualBounds:Rect={x:0,y:0,width:innerWidth,height:innerHeight};
const sound=new SoundEngine();sound.setEnabled(settings.sound);sound.setVolume(settings.soundVolume);sound.setQuietHours(settings.quietHours);
const prevBehaviors=new Map<string,string>();
const interactions=new InteractionManager(canvas,(target)=>{
  const pet=sim.pets.get(target.petId);
  if(!pet)return;
  const world={nowMs:Date.now(),dtMs:16,userActivity:"active" as const,cursor:{position:target.position,speed:0,distanceToPet:0,buttons:0},surfaces:[],objects:sim.objects,nearbyPets:[],windows:lastNative?.windows??[],monitors:lastNative?.monitors??[],foregroundApp:null,secondsSinceNewWindow:999,currentSurface:null,interactionMode:true,idleSeconds:0,locked:false,batteryLevel:null,charging:true};
  if(target.kind==="pet")pet.receivePetting(world,.6);
  else if(target.kind==="brush")pet.brush(world);
  else if(target.kind==="wake")pet.wakeUp(world);
  else if(target.kind==="feed"){pet.state.drives.hunger=Math.max(0,pet.state.drives.hunger-.3);pet.state.affect.valence=Math.min(1,pet.state.affect.valence+.15);}
  else if(target.kind==="call"){
    const worldPoint={x:target.position.x+virtualBounds.x,y:target.position.y+virtualBounds.y};
    pet.respondToCall(world,worldPoint);
  }
});
const thoughts=new ThoughtBubbles();
const photography=new PhotographyMode(renderer);
const furniture=new FurnitureEditor(canvas);
furniture.setPlaceHandler((template,x,y)=>{
  const objectKind=template.kind==="food"||template.kind==="water"?"bowl":template.kind;
  sim.addObject({id:crypto.randomUUID(),kind:objectKind as any,position:{x:x+virtualBounds.x,y:y+virtualBounds.y},radius:template.radius,...(template.comfort?{comfort:template.comfort}:{}),...(template.contents?{contents:template.contents}:{})});
  persist();
});
document.querySelectorAll<HTMLButtonElement>("[data-object]").forEach(b=>{b.remove();});
const palette=document.querySelector("#furniture-palette")!;
palette.innerHTML=FURNITURE_TEMPLATES.map((t)=>`<button data-furniture="${t.kind}"><span class="furniture-emoji">${t.emoji}</span><span>${t.label}</span><span class="furniture-desc">${t.description}</span></button>`).join("");
palette.querySelectorAll<HTMLButtonElement>("[data-furniture]").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const template=FURNITURE_TEMPLATES.find(t=>t.kind===btn.dataset.furniture)!;
    if(furniture.active){furniture.deselect();btn.classList.remove("selected");}
    else{furniture.select(template);btn.classList.add("selected");}
  });
});
interactions.setPetFinder((x,y)=>{
  const point={x,y};
  for(const pet of [...sim.pets.values()].reverse()){if(renderer.hitTest(pet.state,point,virtualBounds))return pet.state;}
  return null;
});
let running=true,dragging:string|null=null,dragOffset={x:0,y:0},lastSocialGraphUpdate=0,lastCortexReflect=0;
let cortex=createCortex(settings.cortexProvider);

const loaded=persistence.load();
if(loaded){settings={...DEFAULT_SETTINGS,...loaded.settings};for(const rec of loaded.pets){try{const pet=Pet.fromSave(rec.save);pet.restoreExtras(rec);sim.addPet(pet,rec.appearance);}catch{}}for(const obj of loaded.objects)sim.addObject(obj);}
if(sim.pets.size===0){
  void showOnboarding(document.body).then(result=>{
    const spawn={x:virtualBounds.x+virtualBounds.width/2,y:virtualBounds.y+virtualBounds.height-60};
    sim.addPet(new Pet({id:crypto.randomUUID(),name:result.name,species:result.species,nowMs:Date.now(),x:spawn.x,y:spawn.y,personality:result.personality}),{coat:result.coat,accent:result.accent,eye:result.eye,scale:1});
    persist();
  });
}

const ui=new SettingsUI({
  onToggleInteraction(enabled){settings.interactionMode=enabled;void bridge.setInteractionMode(enabled);document.body.classList.toggle("interaction",enabled);persist();},
  onToggleDebug(enabled){settings.debug=enabled;persist();},
  onToggleEnabled(enabled){settings.enabled=enabled;running=enabled;void bridge.setOverlayVisible(enabled);persist();},
  onAddPet(pack,name){addPet(pack,name);},onRemovePet(id){sim.removePet(id);persist();},
  onAddObject(kind){const pet=[...sim.pets.values()][0];const p=pet?.state.body.position??{x:virtualBounds.x+virtualBounds.width/2,y:virtualBounds.y+virtualBounds.height*.8};const objectKind=kind==="food"||kind==="water"?"bowl":kind;const radius=kind==="bed"?38:kind==="box"?34:kind==="scratcher"?25:kind==="ball"?11:18;sim.addObject({id:crypto.randomUUID(),kind:objectKind,position:{x:p.x+80,y:p.y-(kind==="ball"?10:0)},radius,...(kind==="bed"?{comfort:.95}:{}),...((kind==="food"||kind==="water")?{contents:kind}:{})});persist();},
  onPrivacyLevel(level){settings.privacyLevel=level;persist();},
  onToggleSound(enabled){settings.sound=enabled;sound.setEnabled(enabled);persist();},
  onSoundVolume(volume){settings.soundVolume=volume;sound.setVolume(volume);persist();},
  onToggleQuietHours(enabled){settings.quietHours=enabled;sound.setQuietHours(enabled);persist();},
  onCortexProvider(provider){settings.cortexProvider=provider;cortex=createCortex(provider);persist();},
  onImportPack(){/* imported packs live in this UI session; pets persist with resolved appearance/personality */},
  onExportState(){const json=persistence.export();const blob=new Blob([json],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`petos-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  onImportState(json){return persistence.import(json);},
  onReset(){persistence.clear();location.reload();},
  onCreateCustomPet(config){const spawn={x:virtualBounds.x+120+Math.random()*Math.max(100,virtualBounds.width-240),y:virtualBounds.y+virtualBounds.height-60};const pet=new Pet({id:crypto.randomUUID(),name:config.name,species:config.species,nowMs:Date.now(),x:spawn.x,y:spawn.y,personality:config.personality});sim.addPet(pet,config.appearance);persist();}
},settings,persistence);

document.querySelector("#photo-btn")?.addEventListener("click",()=>photography.download());
void bridge.setInteractionMode(settings.interactionMode);document.body.classList.toggle("interaction",settings.interactionMode);void bridge.onSettingsRequested(()=>ui.open());

function addPet(pack:PetPack,name:string):void{const spawn={x:virtualBounds.x+120+Math.random()*Math.max(100,virtualBounds.width-240),y:virtualBounds.y+virtualBounds.height-60};const init={id:crypto.randomUUID(),name,species:pack.species,nowMs:Date.now(),x:spawn.x,y:spawn.y,...(pack.personality?{personality:pack.personality}:{})};const pet=new Pet(init);sim.addPet(pet,pack.appearance);persist();}
function persist():void{persistence.save({version:1,pets:sim.records(),objects:sim.objects,settings});lastSave=performance.now();}

async function refreshNative(now:number):Promise<void>{if(now-lastNativePoll<100)return;lastNativePoll=now;try{lastNative=await bridge.snapshot();virtualBounds=boundsFromMonitors(lastNative.monitors);}catch(err){console.warn("PetOS desktop snapshot failed",err);}}
function boundsFromMonitors(monitors:any[]):Rect{if(!monitors?.length)return{x:0,y:0,width:innerWidth,height:innerHeight};const x=Math.min(...monitors.map(m=>m.rect.x)),y=Math.min(...monitors.map(m=>m.rect.y)),r=Math.max(...monitors.map(m=>m.rect.x+m.rect.width)),b=Math.max(...monitors.map(m=>m.rect.y+m.rect.height));return{x,y,width:r-x,height:b-y};}

let batteryLevel:number|null=null,batteryCharging=true;
interface BatteryManagerLike{level:number;charging:boolean;addEventListener(type:string,cb:()=>void):void;}
if("getBattery" in navigator){
  void (navigator as unknown as {getBattery():Promise<BatteryManagerLike>}).getBattery().then(battery=>{
    const sync=()=>{batteryLevel=battery.level;batteryCharging=battery.charging;};
    sync();
    battery.addEventListener("levelchange",sync);
    battery.addEventListener("chargingchange",sync);
  }).catch(()=>{});
}
function mediaPlaying():boolean{try{return navigator.mediaSession?.playbackState==="playing";}catch{return false;}}

const CORTEX_PHRASES:Record<string,string[]>={
  seek_attention:["I could use a little attention…","Where did everyone go?"],
  settle:["Time to just be cozy.","Everything is calm right now."],
  explore:["Something over there looks interesting.","Let me check that out."],
  play:["Play with me!","I've got so much energy!"]
};
async function reflectCortex():Promise<void>{
  for(const pet of sim.pets.values()){
    try{
      const world={nowMs:Date.now(),dtMs:16,userActivity:lastNative?.user_activity??"active",cursor:{position:lastNative?.cursor??{x:0,y:0},speed:0,distanceToPet:200,buttons:0},surfaces:[],objects:sim.objects,nearbyPets:[],windows:lastNative?.windows??[],monitors:lastNative?.monitors??[],foregroundApp:lastNative?.foreground_app??null,secondsSinceNewWindow:999,currentSurface:null,interactionMode:false,idleSeconds:lastNative?.idle_seconds??0,locked:lastNative?.locked??false,batteryLevel,charging:batteryCharging};
      const intention=await cortex.reflect(pet.state,world);
      if(intention.kind==="none"||intention.confidence<.55)continue;
      const phrases=[intention.note,...CORTEX_PHRASES[intention.kind]??[]];
      thoughts.show(pet.state,phrases[0]!,pet.state.body.position.x+virtualBounds.x,pet.state.body.position.y+virtualBounds.y);
    }catch{/* cortex is best-effort */}
  }
}

async function frame(now:number):Promise<void>{const dt=Math.min(100,now-lastFrame);lastFrame=now;if(running&&settings.enabled&&!document.hidden){
      if(!sim.shouldTick(dt)){requestAnimationFrame(frame);return;}
      await refreshNative(now);if(lastNative){
        const activity:DesktopFrame["userActivity"]=lastNative.locked?"idle":mediaPlaying()&&lastNative.user_activity==="active"?"media":lastNative.user_activity;
        const laser=interactions.getLaser();
        const cursorPosition=laser.active&&laser.position?{x:laser.position.x+virtualBounds.x,y:laser.position.y+virtualBounds.y}:lastNative.cursor;
        const input:DesktopFrame={nowMs:Date.now(),dtMs:dt,monitors:lastNative.monitors,windows:lastNative.windows,cursorPosition,cursorSpeed:laser.active?900:lastNative.cursor_speed,cursorButtons:lastNative.cursor_buttons,userActivity:activity,foregroundApp:lastNative.foreground_app,secondsSinceNewWindow:lastNative.seconds_since_new_window,interactionMode:settings.interactionMode,idleSeconds:lastNative.idle_seconds??0,locked:lastNative.locked??false,batteryLevel,charging:batteryCharging};
        const state=sim.tick(input);
      for(const pet of sim.pets.values()){const prev=prevBehaviors.get(pet.state.id);if(prev&&prev!==pet.state.behavior)sound.playBehaviorSound(pet.state.id,pet.state.species,pet.state.behavior);prevBehaviors.set(pet.state.id,pet.state.behavior);}
      const focusGuard=activity==="fullscreen"||activity==="gaming"||activity==="presentation";
      sound.setQuietHours(settings.quietHours||focusGuard);
      if(Math.random()<.008){for(const pet of sim.pets.values()){const text=generateThought(pet.state);if(text)thoughts.show(pet.state,text,pet.state.body.position.x+virtualBounds.x,pet.state.body.position.y+virtualBounds.y);}}
      thoughts.update(state.pets,virtualBounds.x,virtualBounds.y);
      if(now-lastSocialGraphUpdate>2500){lastSocialGraphUpdate=now;const relData:Record<string,Record<string,number>>={};for(const pet of sim.pets.values())relData[pet.state.id]=pet.memory.relationshipsSnapshot();ui.setRelationships(relData);}
      if(now-lastCortexReflect>30_000&&!lastNative?.locked){lastCortexReflect=now;void reflectCortex();}
      renderer.render({pets:state.pets,appearances:sim.appearances,objects:state.objects,debug:settings.debug,decisions:state.decisions,virtualBounds,cursor:lastNative?.cursor});ui.setPets(state.pets.map(p=>({id:p.id,name:p.name,species:p.species,behavior:p.behavior})));ui.setDiary([...sim.pets.values()].flatMap(p=>p.diary.recent.map(e=>({...e}))));
      ui.setLifeLog([...sim.pets.values()].flatMap(p=>p.memory.recent(undefined,5).map(m=>({pet:p.state.name,atMs:m.atMs,note:m.note,kind:m.kind}))).sort((a,b)=>a.atMs-b.atMs));}}
  if(now-lastSave>10_000)persist();requestAnimationFrame(frame);}
requestAnimationFrame(frame);

canvas.addEventListener("pointerdown",e=>{if(!settings.interactionMode)return;const point={x:e.clientX,y:e.clientY};const pet=[...sim.pets.values()].reverse().find(p=>renderer.hitTest(p.state,point,virtualBounds));if(!pet)return;dragging=pet.state.id;const worldX=e.clientX+virtualBounds.x,worldY=e.clientY+virtualBounds.y;dragOffset={x:pet.state.body.position.x-worldX,y:pet.state.body.position.y-worldY};pet.state.body.held=true;pet.state.body.grounded=false;pet.receivePickup({nowMs:Date.now(),dtMs:16,userActivity:"active",cursor:{position:{x:worldX,y:worldY},speed:0,distanceToPet:0,buttons:0},surfaces:[],objects:sim.objects,nearbyPets:[],windows:lastNative?.windows??[],monitors:lastNative?.monitors??[],foregroundApp:null,secondsSinceNewWindow:999,currentSurface:null,interactionMode:true,idleSeconds:0,locked:false,batteryLevel:null,charging:true});canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener("pointermove",e=>{if(!dragging)return;const pet=sim.pets.get(dragging);if(!pet)return;pet.state.body.position={x:e.clientX+virtualBounds.x+dragOffset.x,y:e.clientY+virtualBounds.y+dragOffset.y};});
canvas.addEventListener("pointerup",e=>{if(!dragging)return;const pet=sim.pets.get(dragging);if(pet){pet.state.body.held=false;pet.state.body.velocity={x:(e.movementX||0)*18,y:Math.min(0,(e.movementY||0)*10)};pet.state.body.surfaceId=null;sound.playSpeciesVocal(pet.state.id,pet.state.species);pet.receivePetting({nowMs:Date.now(),dtMs:16,userActivity:"active",cursor:{position:{x:e.clientX+virtualBounds.x,y:e.clientY+virtualBounds.y},speed:0,distanceToPet:0,buttons:0},surfaces:[],objects:sim.objects,nearbyPets:[],windows:lastNative?.windows??[],monitors:lastNative?.monitors??[],foregroundApp:lastNative?.foreground_app??null,secondsSinceNewWindow:999,currentSurface:null,interactionMode:true,idleSeconds:0,locked:false,batteryLevel:null,charging:true},.5);}dragging=null;canvas.releasePointerCapture(e.pointerId);persist();});

window.addEventListener("keydown",e=>{if(e.ctrlKey&&e.shiftKey&&e.code==="KeyP"){settings.interactionMode=!settings.interactionMode;void bridge.setInteractionMode(settings.interactionMode);document.body.classList.toggle("interaction",settings.interactionMode);persist();}if(e.ctrlKey&&e.shiftKey&&e.code==="KeyL")interactions.toggleLaser();if(e.code==="Escape")ui.close();});