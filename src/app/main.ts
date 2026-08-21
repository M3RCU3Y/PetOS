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

const canvas=document.querySelector<HTMLCanvasElement>("#pet-canvas")!;
const renderer=new PixelRenderer(canvas);
const bridge=createDesktopBridge();
const persistence=new BrowserPersistence();
const sim=new PetOSSimulation();
let settings:PetOSSettings={...DEFAULT_SETTINGS};
let lastFrame=performance.now(),lastSave=0,lastNativePoll=0,lastNative:any=null,virtualBounds:Rect={x:0,y:0,width:innerWidth,height:innerHeight};
const sound=new SoundEngine();sound.setEnabled(settings.sound);
const prevBehaviors=new Map<string,string>();
const interactions=new InteractionManager(canvas,(target)=>{
  const pet=sim.pets.get(target.petId);
  if(!pet)return;
  const world={nowMs:Date.now(),dtMs:16,userActivity:"active" as const,cursor:{position:target.position,speed:0,distanceToPet:0,buttons:0},surfaces:[],objects:sim.objects,nearbyPets:[],windows:lastNative?.windows??[],monitors:lastNative?.monitors??[],foregroundApp:null,secondsSinceNewWindow:999,currentSurface:null,interactionMode:true};
  if(target.kind==="pet")pet.receivePetting(world,.6);
  else if(target.kind==="feed"){pet.state.drives.hunger=Math.max(0,pet.state.drives.hunger-.3);pet.state.affect.valence=Math.min(1,pet.state.affect.valence+.15);}
  else if(target.kind==="call")pet.state.body.target={...target.position};
});
const thoughts=new ThoughtBubbles();
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
let running=true,dragging:string|null=null,dragOffset={x:0,y:0};

const loaded=persistence.load();
if(loaded){settings={...DEFAULT_SETTINGS,...loaded.settings};for(const rec of loaded.pets){try{sim.addPet(Pet.fromSave(rec.save),rec.appearance);}catch{}}for(const obj of loaded.objects)sim.addObject(obj);}
if(sim.pets.size===0){
  void showOnboarding(document.body).then(result=>{
    const spawn={x:virtualBounds.x+virtualBounds.width/2,y:virtualBounds.y+virtualBounds.height-60};
    sim.addPet(new Pet({id:crypto.randomUUID(),name:result.name,species:result.species,nowMs:Date.now(),x:spawn.x,y:spawn.y}),{coat:result.coat,accent:result.accent,eye:result.eye,scale:1});
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
  onImportPack(){/* imported packs live in this UI session; pets persist with resolved appearance/personality */},
  onReset(){persistence.clear();location.reload();},
  onCreateCustomPet(config){const spawn={x:virtualBounds.x+120+Math.random()*Math.max(100,virtualBounds.width-240),y:virtualBounds.y+virtualBounds.height-60};const pet=new Pet({id:crypto.randomUUID(),name:config.name,species:config.species,nowMs:Date.now(),x:spawn.x,y:spawn.y,personality:config.personality});sim.addPet(pet,config.appearance);persist();}
},settings,persistence);

void bridge.setInteractionMode(settings.interactionMode);document.body.classList.toggle("interaction",settings.interactionMode);void bridge.onSettingsRequested(()=>ui.open());

function addPet(pack:PetPack,name:string):void{const spawn={x:virtualBounds.x+120+Math.random()*Math.max(100,virtualBounds.width-240),y:virtualBounds.y+virtualBounds.height-60};const init={id:crypto.randomUUID(),name,species:pack.species,nowMs:Date.now(),x:spawn.x,y:spawn.y,...(pack.personality?{personality:pack.personality}:{})};const pet=new Pet(init);sim.addPet(pet,pack.appearance);persist();}
function persist():void{persistence.save({version:1,pets:sim.records(),objects:sim.objects,settings});lastSave=performance.now();}

async function refreshNative(now:number):Promise<void>{if(now-lastNativePoll<100)return;lastNativePoll=now;try{lastNative=await bridge.snapshot();virtualBounds=boundsFromMonitors(lastNative.monitors);}catch(err){console.warn("PetOS desktop snapshot failed",err);}}
function boundsFromMonitors(monitors:any[]):Rect{if(!monitors?.length)return{x:0,y:0,width:innerWidth,height:innerHeight};const x=Math.min(...monitors.map(m=>m.rect.x)),y=Math.min(...monitors.map(m=>m.rect.y)),r=Math.max(...monitors.map(m=>m.rect.x+m.rect.width)),b=Math.max(...monitors.map(m=>m.rect.y+m.rect.height));return{x,y,width:r-x,height:b-y};}

async function frame(now:number):Promise<void>{const dt=Math.min(100,now-lastFrame);lastFrame=now;if(running&&settings.enabled){
      if(!sim.shouldTick(dt)){requestAnimationFrame(frame);return;}
      await refreshNative(now);if(lastNative){const input:DesktopFrame={nowMs:Date.now(),dtMs:dt,monitors:lastNative.monitors,windows:lastNative.windows,cursorPosition:lastNative.cursor,cursorSpeed:lastNative.cursor_speed,cursorButtons:lastNative.cursor_buttons,userActivity:lastNative.user_activity,foregroundApp:lastNative.foreground_app,secondsSinceNewWindow:lastNative.seconds_since_new_window,interactionMode:settings.interactionMode};const state=sim.tick(input);
      for(const pet of sim.pets.values()){const prev=prevBehaviors.get(pet.state.id);if(prev&&prev!==pet.state.behavior)sound.playBehaviorSound(pet.state.id,pet.state.species,pet.state.behavior);prevBehaviors.set(pet.state.id,pet.state.behavior);}
      if(Math.random()<.008){for(const pet of sim.pets.values()){const text=generateThought(pet.state);if(text)thoughts.show(pet.state,text,pet.state.body.position.x+virtualBounds.x,pet.state.body.position.y+virtualBounds.y);}}
      thoughts.update(state.pets,virtualBounds.x,virtualBounds.y);
      renderer.render({pets:state.pets,appearances:sim.appearances,objects:state.objects,debug:settings.debug,decisions:state.decisions,virtualBounds});ui.setPets(state.pets.map(p=>({id:p.id,name:p.name,species:p.species,behavior:p.behavior})));ui.setDiary([...sim.pets.values()].flatMap(p=>p.diary.recent.map(e=>({...e}))));
      ui.setLifeLog([...sim.pets.values()].flatMap(p=>p.memory.recent(undefined,5).map(m=>({pet:p.state.name,atMs:m.atMs,note:m.note,kind:m.kind}))).sort((a,b)=>a.atMs-b.atMs));}}
  if(now-lastSave>10_000)persist();requestAnimationFrame(frame);}
requestAnimationFrame(frame);

canvas.addEventListener("pointerdown",e=>{if(!settings.interactionMode)return;const point={x:e.clientX,y:e.clientY};const pet=[...sim.pets.values()].reverse().find(p=>renderer.hitTest(p.state,point,virtualBounds));if(!pet)return;dragging=pet.state.id;const worldX=e.clientX+virtualBounds.x,worldY=e.clientY+virtualBounds.y;dragOffset={x:pet.state.body.position.x-worldX,y:pet.state.body.position.y-worldY};pet.state.body.held=true;pet.state.body.grounded=false;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener("pointermove",e=>{if(!dragging)return;const pet=sim.pets.get(dragging);if(!pet)return;pet.state.body.position={x:e.clientX+virtualBounds.x+dragOffset.x,y:e.clientY+virtualBounds.y+dragOffset.y};});
canvas.addEventListener("pointerup",e=>{if(!dragging)return;const pet=sim.pets.get(dragging);if(pet){pet.state.body.held=false;pet.state.body.velocity={x:(e.movementX||0)*18,y:Math.min(0,(e.movementY||0)*10)};pet.state.body.surfaceId=null;sound.playSpeciesVocal(pet.state.id,pet.state.species);pet.receivePetting({nowMs:Date.now(),dtMs:16,userActivity:"active",cursor:{position:{x:e.clientX+virtualBounds.x,y:e.clientY+virtualBounds.y},speed:0,distanceToPet:0,buttons:0},surfaces:[],objects:sim.objects,nearbyPets:[],windows:lastNative?.windows??[],monitors:lastNative?.monitors??[],foregroundApp:lastNative?.foreground_app??null,secondsSinceNewWindow:999,currentSurface:null,interactionMode:true},.5);}dragging=null;canvas.releasePointerCapture(e.pointerId);persist();});

window.addEventListener("keydown",e=>{if(e.ctrlKey&&e.shiftKey&&e.code==="KeyP"){settings.interactionMode=!settings.interactionMode;void bridge.setInteractionMode(settings.interactionMode);document.body.classList.toggle("interaction",settings.interactionMode);persist();}if(e.code==="Escape")ui.close();});
