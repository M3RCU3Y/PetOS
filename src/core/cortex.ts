import { categorizeApp } from "./ambient.js";
import type { PetState, WorldSnapshot } from "./types.js";

export interface CortexIntention { kind:"seek_attention"|"settle"|"explore"|"play"|"none"; confidence:number; note:string; }
export interface Cortex { reflect(pet:PetState,world:WorldSnapshot):Promise<CortexIntention>; }

export class HeuristicCortex implements Cortex {
  async reflect(pet:PetState,world:WorldSnapshot):Promise<CortexIntention>{
    if(world.userActivity==="gaming"||world.userActivity==="fullscreen"||world.userActivity==="presentation") return {kind:"settle",confidence:.9,note:"Keeper protects focus"};
    if(world.locked||world.idleSeconds>600)return{kind:"settle",confidence:.8,note:"the keeper is away"};
    if(pet.drives.social>.78&&pet.bond>.35)return{kind:"seek_attention",confidence:.72,note:"strong social need and bond"};
    if(pet.drives.play>.8&&pet.drives.fatigue<.5)return{kind:"play",confidence:.7,note:"high play drive"};
    if(pet.drives.curiosity>.75)return{kind:"explore",confidence:.65,note:"curiosity is unsatisfied"};
    return{kind:"none",confidence:.5,note:"ordinary autonomous behavior"};
  }
}

/**
 * Local LLM provider (Ollama). Interprets context and suggests high-level intentions only.
 * It never micromanages movement or animation, and PetOS stays fully functional when
 * unavailable. The prompt contains ambient context categories only — never screen content.
 */
export class OllamaCortex implements Cortex {
  private readonly fallback=new HeuristicCortex();
  constructor(private readonly endpoint="http://127.0.0.1:11434",private readonly model="llama3.2"){}

  async reflect(pet:PetState,world:WorldSnapshot):Promise<CortexIntention>{
    try{
      const intention=await this.ask(pet,world);
      if(intention)return intention;
    }catch{/* offline / slow / malformed — fall through */}
    return this.fallback.reflect(pet,world);
  }

  private async ask(pet:PetState,world:WorldSnapshot):Promise<CortexIntention|null>{
    const hour=new Date(world.nowMs).getHours();
    const context=[
      `pet: ${pet.name} (${pet.species})`,
      `drives 0-1: fatigue ${pet.drives.fatigue.toFixed(2)}, hunger ${pet.drives.hunger.toFixed(2)}, play ${pet.drives.play.toFixed(2)}, social ${pet.drives.social.toFixed(2)}, curiosity ${pet.drives.curiosity.toFixed(2)}`,
      `mood: valence ${pet.affect.valence.toFixed(2)}, arousal ${pet.affect.arousal.toFixed(2)}, stress ${pet.affect.stress.toFixed(2)}`,
      `keeper activity: ${world.userActivity}${world.foregroundApp?` (${categorizeApp(world.foregroundApp)})`:""}`,
      `input idle for ${Math.round(world.idleSeconds)}s`,
      `time: ${hour}:00`,
      `current behavior: ${pet.behavior}`
    ].join("\n");
    const prompt=`You are the gentle inner voice of a small desktop pet. Given its state, decide one high-level intention. Do not describe actions in detail.\n${context}\nReply ONLY with minified JSON: {"kind":"seek_attention"|"settle"|"explore"|"play"|"none","confidence":<0-1>,"note":"<max 60 chars, first person, cozy>"}`;
    const res=await fetch(`${this.endpoint}/api/generate`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:this.model,prompt,stream:false,options:{num_predict:80,temperature:.7}}),
      signal:AbortSignal.timeout(5000)
    });
    if(!res.ok)return null;
    const data=await res.json() as {response?:string};
    const match=data.response?.match(/\{[^{}]*\}/);
    if(!match)return null;
    const parsed=JSON.parse(match[0]) as {kind?:string;confidence?:number;note?:string};
    const kinds=["seek_attention","settle","explore","play","none"];
    if(!parsed.kind||!kinds.includes(parsed.kind))return null;
    const confidence=Math.max(0,Math.min(1,Number(parsed.confidence)||.5));
    const note=(parsed.note??"").slice(0,80)||"…";
    return {kind:parsed.kind as CortexIntention["kind"],confidence,note};
  }
}

export function createCortex(provider:"off"|"ollama"):Cortex{
  return provider==="ollama"?new OllamaCortex():new HeuristicCortex();
}
