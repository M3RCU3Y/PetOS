import { PetBrain } from "./brain.js";
import { clamp, lerp } from "./math.js";
import { PetMemory } from "./memory.js";
import { SeededRandom, type RandomSource } from "./rng.js";
import { SPECIES, personalityFor } from "./species.js";
import { ambientReaction, categorizeApp } from "./ambient.js";
import type { Decision, EpisodicMemory, PetSave, PetState, Personality, Species, WorldSnapshot } from "./types.js";

export interface PetInit { id:string; name:string; species:Species; nowMs:number; personality?:Partial<Personality>; x?:number; y?:number; }

export class Pet {
  readonly memory: PetMemory;
  state: PetState;
  private readonly brain: PetBrain;
  private readonly rng: RandomSource;
  private lastRememberedBehavior: string;

  constructor(init: PetInit, rng: RandomSource = new SeededRandom(hashString(init.id))) {
    this.rng = rng;
    const profile = SPECIES[init.species];
    this.state = {
      id:init.id, name:init.name, species:init.species, personality:personalityFor(init.species,init.personality),
      drives:{fatigue:.18,hunger:.12,thirst:.1,play:.42,social:.24,curiosity:.5,comfort:.55},
      affect:{valence:.35,arousal:.35,stress:.05},
      body:{position:{x:init.x ?? 300,y:init.y ?? 700},velocity:{x:0,y:0},facing:1,grounded:true,surfaceId:null,target:null,held:false},
      behavior:"idle", behaviorSinceMs:init.nowMs, behaviorTargetId:null, ageSeconds:0,bond:.15,lastInteractionMs:init.nowMs,favoriteSurfaceId:null,frustration:0,boredom:.1,novelty:0,habitStrength:0
    };
    this.memory = new PetMemory();
    this.brain = new PetBrain(profile,rng);
    this.lastRememberedBehavior = this.state.behavior;
  }

  static fromSave(save: PetSave, rng?:RandomSource): Pet {
    const pet = new Pet({id:save.state.id,name:save.state.name,species:save.state.species,nowMs:save.state.behaviorSinceMs,personality:save.state.personality,x:save.state.body.position.x,y:save.state.body.position.y}, rng);
    pet.state = structuredClone(save.state);
    const persisted = new PetMemory(save);
    (pet as {memory:PetMemory}).memory = persisted;
    return pet;
  }

  tick(world: WorldSnapshot, dtMs = world.dtMs): Decision {
    const dt = Math.min(dtMs, 1000) / 1000;
    this.updateDrives(world,dt);
    this.updateAffect(world,dt);
    this.memory.decay(dt);
    const decision = this.brain.decide(this.state,world,this.memory);
    if (decision.behavior !== this.state.behavior) {
      this.state.behavior = decision.behavior;
      this.state.behaviorSinceMs = world.nowMs;
      this.state.behaviorTargetId = decision.targetId ?? null;
      this.state.body.target = decision.targetPosition ? {...decision.targetPosition} : null;
    } else if (decision.targetPosition) this.state.body.target = {...decision.targetPosition};
    this.state.ageSeconds += dt;
    this.updateCognition(world,dt);
    this.state.favoriteSurfaceId = this.memory.favoriteSurface();
    this.maybeRememberBehavior(world);
    return decision;
  }

  private updateDrives(world:WorldSnapshot,dt:number):void {
    const reaction=ambientReaction({
      activity:world.userActivity,
      charging:false,
      batteryLevel:null,
      idleSeconds:0,
      foregroundApp:world.foregroundApp,
      hourOfDay:new Date(world.nowMs).getHours()
    });
    this.state.affect.valence=clamp(this.state.affect.valence+reaction.moodShift*dt*.02,-1,1);
    this.state.drives.fatigue=clamp(this.state.drives.fatigue-reaction.energyShift*dt*.001);
    const d=this.state.drives,p=this.state.personality,b=this.state.behavior;
    d.fatigue = clamp(d.fatigue + dt*(.00045 + p.energy*.0003) - (b==="sleep"?dt*.0085:0));
    d.hunger = clamp(d.hunger + dt*.00022 - (b==="eat"?dt*.02:0));
    d.thirst = clamp(d.thirst + dt*.0003 - (b==="drink"?dt*.025:0));
    d.play = clamp(d.play + dt*.00055*(.5+p.playfulness) - (["chase_cursor","play_toy","play_pet","zoomies","pounce","scratch"].includes(b)?dt*.005:0));
    d.social = clamp(d.social + dt*.00035*(.5+p.sociability) - (["seek_user","play_pet","greet_pet","follow_pet"].includes(b)?dt*.0035:0));
    d.curiosity = clamp(d.curiosity + dt*.00042*(.5+p.curiosity) - (["investigate","walk","perch"].includes(b)?dt*.0025:0));
    const surfaceComfort = world.currentSurface?.comfort ?? .25;
    d.comfort = clamp(lerp(d.comfort,surfaceComfort,b==="sleep"?dt*.02:dt*.003));
  }

  private updateAffect(world:WorldSnapshot,dt:number):void {
    const a=this.state.affect,d=this.state.drives,b=this.state.behavior;
    const positive = (["play_pet","play_toy","greet_pet","sleep","groom","scratch","eat","drink"].includes(b)? .55: .32) + this.state.bond*.16;
    a.valence = clamp(lerp(a.valence,positive,dt*.07),-1,1);
    const desiredArousal = ["run","zoomies","chase_cursor","pounce"].includes(b)?.86:b==="sleep"?.05:.3+d.play*.18;
    a.arousal = clamp(lerp(a.arousal,desiredArousal,dt*.12));
    const threat = world.userActivity==="fullscreen" && world.cursor.distanceToPet<80 && world.cursor.speed>1400 ? .5:0;
    a.stress = clamp(lerp(a.stress,threat,dt*.18));
  }

  receivePetting(world:WorldSnapshot,intensity=.5):void {
    const amount=clamp(intensity);
    this.state.bond=clamp(this.state.bond+amount*.012);
    this.state.drives.social=clamp(this.state.drives.social-amount*.08);
    this.state.affect.valence=clamp(this.state.affect.valence+amount*.12,-1,1);
    this.state.lastInteractionMs=world.nowMs;
    this.remember({kind:"petting",atMs:world.nowMs,valence:.85,salience:.7*amount,note:"The user gave affectionate attention",...(world.currentSurface?{surfaceId:world.currentSurface.id}:{}),...(world.foregroundApp?{app:world.foregroundApp}:{})});
  }

  frighten(world:WorldSnapshot, note="sudden movement"):void {
    this.state.affect.stress=clamp(this.state.affect.stress+.35);
    this.state.affect.arousal=clamp(this.state.affect.arousal+.25);
    this.remember({kind:"fright",atMs:world.nowMs,valence:-.6,salience:.7,note});
  }

  rememberSocial(otherId:string, world:WorldSnapshot, valence=.5):void {
    this.memory.adjustRelationship(otherId,valence*.018);
    this.remember({kind:"social",subjectId:otherId,atMs:world.nowMs,valence,salience:.4,note:"Social encounter with another pet"});
  }

  private updateCognition(world:WorldSnapshot,dt:number):void {
    const s=this.state;
    // Boredom builds when doing low-stimulation behaviors for too long
    const stimulating=["chase_cursor","pounce","zoomies","play_toy","play_pet","investigate","run"];
    if(stimulating.includes(s.behavior)){
      s.boredom=clamp(s.boredom-dt*.004);
      s.frustration=clamp(s.frustration-dt*.002);
    } else if(["idle","sit"].includes(s.behavior)){
      s.boredom=clamp(s.boredom+dt*.0006);
    } else {
      s.boredom=clamp(s.boredom+dt*.00015);
    }
    // Frustration builds when drives are high but behavior doesn't address them
    const unmet=Math.max(0,s.drives.hunger-.7)+Math.max(0,s.drives.thirst-.7)+Math.max(0,s.drives.play-.8);
    if(unmet>0&&!["eat","drink","play_toy","chase_cursor"].includes(s.behavior))s.frustration=clamp(s.frustration+dt*unmet*.002);
    else s.frustration=clamp(s.frustration-dt*.0015);
    // Novelty spikes when a new window appears or surface changes
    if(world.secondsSinceNewWindow<4)s.novelty=clamp(s.novelty+dt*.08);
    else s.novelty=clamp(s.novelty-dt*.002);
    // Habit strength grows with repeated same-behavior-on-same-surface patterns
    if(world.currentSurface&&world.currentSurface.id===s.favoriteSurfaceId&&["sleep","sit","groom"].includes(s.behavior))s.habitStrength=clamp(s.habitStrength+dt*.0004);
    else s.habitStrength=clamp(s.habitStrength-dt*.0001);
  }

  private maybeRememberBehavior(world:WorldSnapshot):void {
    if (this.lastRememberedBehavior===this.state.behavior) return;
    this.lastRememberedBehavior=this.state.behavior;
    if (this.state.behavior==="sleep" && world.currentSurface) this.remember({kind:"sleep",atMs:world.nowMs,valence:.5,salience:.35,surfaceId:world.currentSurface.id,note:"Settled down to sleep"});
    if (this.state.behavior==="investigate" && world.currentSurface) this.remember({kind:"discovery",atMs:world.nowMs,valence:.25,salience:.3,surfaceId:world.currentSurface.id,note:"Investigated a desktop surface"});
  }

  private remember(input:Omit<EpisodicMemory,"id">):void { this.memory.remember({id:`${this.state.id}:${input.atMs}:${this.rng.next().toString(36).slice(2,7)}`,...input}); }
  save():PetSave { const mem=this.memory.serialize(); return {version:1,state:structuredClone(this.state),...mem}; }
}

function hashString(text:string):number { let h=2166136261; for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);} return h>>>0; }
