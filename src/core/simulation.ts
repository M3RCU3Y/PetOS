import { Pet } from "./pet.js";
import { PetPhysics, nudgeToy } from "./physics.js";
import { buildWorldForPet, surfacesFromDesktop } from "./world.js";
import type { DesktopWindow, MonitorInfo, PetRecord, PetState, UserActivity, Vec2, WorldObject } from "./types.js";

export interface DesktopFrame { nowMs:number; dtMs:number; monitors:MonitorInfo[]; windows:DesktopWindow[]; cursorPosition:Vec2; cursorSpeed:number; cursorButtons:number; userActivity:UserActivity; foregroundApp:string|null; secondsSinceNewWindow:number; interactionMode:boolean; idleSeconds:number; locked:boolean; batteryLevel:number|null; charging:boolean; focusBreak?:boolean; }
export interface SimFrame { pets:PetState[]; objects:WorldObject[]; decisions:Record<string,{behavior:string;reason:string;score:number}>; }

export class PetOSSimulation {
  readonly pets=new Map<string,Pet>();
  readonly appearances=new Map<string,PetRecord["appearance"]>();
  readonly objects:WorldObject[]=[];
  private readonly physics=new PetPhysics();
  private previousSurfaces=new Map<string,{x:number;y:number;walkY:number}>();

  addPet(pet:Pet,appearance:PetRecord["appearance"]={coat:"#d98742",accent:"#f2c287",eye:"#d7ef76",scale:1}):void{this.pets.set(pet.state.id,pet);this.appearances.set(pet.state.id,appearance);}
  removePet(id:string):void{this.pets.delete(id);this.appearances.delete(id);}
  addObject(object:WorldObject):void{this.objects.push(object);}
  removeObject(id:string):void{const i=this.objects.findIndex(o=>o.id===id);if(i>=0)this.objects.splice(i,1);}

  private tickAccumulator=0;
  private lastAllSleeping=false;

  shouldTick(dtMs:number):boolean{
    const allSleeping=[...this.pets.values()].length>0&&[...this.pets.values()].every(p=>p.state.behavior==="sleep");
    this.lastAllSleeping=allSleeping;
    const interval=allSleeping?200:16;
    this.tickAccumulator+=dtMs;
    if(this.tickAccumulator>=interval){this.tickAccumulator=0;return true;}
    return false;
  }

  tick(frame:DesktopFrame):SimFrame{
    const states=[...this.pets.values()].map(p=>p.state);
    const surfaces=surfacesFromDesktop(frame.monitors,frame.windows,this.objects);
    // A pet attached to a window rides that window instead of being left behind.
    // This is computed before cognition so its perceived world already reflects the move.
    for(const surface of surfaces){
      const previous=this.previousSurfaces.get(surface.id);
      if(previous){
        const dx=surface.rect.x-previous.x,dy=surface.walkY-previous.walkY;
          if(Math.abs(dx)+Math.abs(dy)>.01){
            const dtSec=Math.max(frame.dtMs,1)/1000;
            const speed=Math.hypot(dx,dy)/dtSec;
            surface.moving=true;surface.velocity={x:dx/dtSec,y:dy/dtSec};
            for(const pet of this.pets.values()){
              if(pet.state.body.grounded&&pet.state.body.surfaceId===surface.id){
                // Smooth drags are ridden out; abrupt snaps/teleports startle pets off.
                if((Math.abs(dx)+Math.abs(dy)>150||speed>6000)&&pet.state.behavior!=="startle"){
                  pet.startleReaction(frame.nowMs,"the ground lurched beneath them");
                  pet.state.body.grounded=false;pet.state.body.surfaceId=null;
                  pet.state.body.velocity={x:Math.sign(dx||1)*160,y:-230};
                }else{
                  pet.state.body.position.x+=dx;pet.state.body.position.y+=dy;
                }
              }
            }
          }
      }
    }
    this.previousSurfaces=new Map(surfaces.map(s=>[s.id,{x:s.rect.x,y:s.rect.y,walkY:s.walkY}]));
    const decisions:Record<string,{behavior:string;reason:string;score:number}>={};
    for(const pet of this.pets.values()){
      const world=buildWorldForPet({nowMs:frame.nowMs,dtMs:frame.dtMs,userActivity:frame.userActivity,surfaces,objects:this.objects,windows:frame.windows,monitors:frame.monitors,foregroundApp:frame.foregroundApp,secondsSinceNewWindow:frame.secondsSinceNewWindow,interactionMode:frame.interactionMode,idleSeconds:frame.idleSeconds,locked:frame.locked,batteryLevel:frame.batteryLevel,charging:frame.charging,focusBreak:frame.focusBreak??false,cursorPosition:frame.cursorPosition,cursorSpeed:frame.cursorSpeed,cursorButtons:frame.cursorButtons},pet.state,states);
      for(const other of world.nearbyPets)other.relationship=pet.memory.relationshipWith(other.id);
      const d=pet.tick(world,frame.dtMs);decisions[pet.state.id]={behavior:d.behavior,reason:d.reason,score:d.score};
      this.physics.update(pet.state,world,frame.dtMs);
      const toy=d.targetId?this.objects.find(o=>o.id===d.targetId&&(o.kind==="ball"||o.kind==="toy")):undefined;
      if(toy&&pet.state.behavior==="play_toy"&&Math.hypot(toy.position.x-pet.state.body.position.x,toy.position.y-pet.state.body.position.y)<45){
        nudgeToy(toy,pet.state.body.position,{x:toy.position.x+pet.state.body.facing*40,y:toy.position.y});
        pet.memory.reinforceToy(toy.id,.012);
      }
      const socialKind=({greet_pet:"greet",play_pet:"play",play_fight:"fight",cuddle:"cuddle",follow_pet:"greet"} as Record<string,import("./types.js").SocialEncounterKind>)[pet.state.behavior];
      if(socialKind&&d.targetId&&world.nearbyPets.find(o=>o.id===d.targetId)?.distance!<95){
        pet.noteEncounter(d.targetId,socialKind,frame.nowMs);
        const other=this.pets.get(d.targetId);
        if(other&&other!==pet){
          other.memory.noteEncounter(pet.state.id,socialKind);
        }
      }
    }
    return{pets:[...this.pets.values()].map(p=>p.state),objects:this.objects,decisions};
  }

  records():PetRecord[]{return[...this.pets.values()].map(p=>({save:p.save(),appearance:this.appearances.get(p.state.id)??{coat:"#d98742",accent:"#f2c287",eye:"#d7ef76",scale:1},...p.exportExtras()}));}
}
