import { categorizeApp } from "./ambient.js";
import type { PetState, WorldSnapshot } from "./types.js";

export type CortexProviderKind = "off" | "ollama" | "openai" | "openrouter" | "gemini" | "anthropic";

export interface CortexIntention { kind:"seek_attention"|"settle"|"explore"|"play"|"none"; confidence:number; note:string; }
export interface Cortex { reflect(pet:PetState,world:WorldSnapshot):Promise<CortexIntention>; }
export interface CortexOptions { apiKey?:string; model?:string }

const KINDS=["seek_attention","settle","explore","play","none"];

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

/** Extracts a validated intention from raw model text. Pure and unit-tested. */
export function parseIntention(text:string|null|undefined):CortexIntention|null{
  if(!text)return null;
  const match=text.match(/\{[^{}]*\}/);
  if(!match)return null;
  let parsed:{kind?:string;confidence?:number;note?:string};
  try{parsed=JSON.parse(match[0]);}catch{return null;}
  if(!parsed.kind||!KINDS.includes(parsed.kind))return null;
  const confidence=Math.max(0,Math.min(1,Number(parsed.confidence)||.5));
  const note=(typeof parsed.note==="string"?parsed.note:"").slice(0,80)||"…";
  return{kind:parsed.kind as CortexIntention["kind"],confidence,note};
}

/** Ambient context only — never screen content, keystrokes or document text. */
export function describeContext(pet:PetState,world:WorldSnapshot):string{
  const hour=new Date(world.nowMs).getHours();
  return [
    `pet: ${pet.name} (${pet.species})`,
    `drives 0-1: fatigue ${pet.drives.fatigue.toFixed(2)}, hunger ${pet.drives.hunger.toFixed(2)}, play ${pet.drives.play.toFixed(2)}, social ${pet.drives.social.toFixed(2)}, curiosity ${pet.drives.curiosity.toFixed(2)}`,
    `mood: valence ${pet.affect.valence.toFixed(2)}, arousal ${pet.affect.arousal.toFixed(2)}, stress ${pet.affect.stress.toFixed(2)}`,
    `keeper activity: ${world.userActivity}${world.foregroundApp?` (${categorizeApp(world.foregroundApp)})`:""}`,
    `input idle for ${Math.round(world.idleSeconds)}s`,
    `time: ${hour}:00`,
    `current behavior: ${pet.behavior}`
  ].join("\n");
}

function buildPrompt(pet:PetState,world:WorldSnapshot):string{
  return `You are the gentle inner voice of a small desktop pet. Given its state, decide one high-level intention. Do not describe actions in detail.\n${describeContext(pet,world)}\nReply ONLY with minified JSON: {"kind":"seek_attention"|"settle"|"explore"|"play"|"none","confidence":<0-1>,"note":"<max 60 chars, first person, cozy>"}`;
}

async function fetchJson(url:string,init:RequestInit,timeoutMs=6000):Promise<any>{
  const res=await fetch(url,{...init,signal:AbortSignal.timeout(timeoutMs)});
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Local LLM provider (Ollama). Interprets context and suggests high-level intentions only.
 * It never micromanages movement or animation, and PetOS stays fully functional when
 * unavailable.
 */
export class OllamaCortex implements Cortex {
  private readonly fallback=new HeuristicCortex();
  constructor(private readonly endpoint="http://127.0.0.1:11434",private readonly model="llama3.2"){}

  async reflect(pet:PetState,world:WorldSnapshot):Promise<CortexIntention>{
    try{
      const data=await fetchJson(`${this.endpoint}/api/generate`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:this.model,prompt:buildPrompt(pet,world),stream:false,options:{num_predict:80,temperature:.7}})
      });
      const parsed=parseIntention(data.response);
      if(parsed)return parsed;
    }catch{/* offline / slow / malformed */}
    return this.fallback.reflect(pet,world);
  }
}

/** OpenAI + OpenRouter share the chat-completions shape. */
export class OpenAICompatibleCortex implements Cortex {
  private readonly fallback=new HeuristicCortex();
  constructor(private readonly kind:"openai"|"openrouter",private readonly opts:CortexOptions){}

  async reflect(pet:PetState,world:WorldSnapshot):Promise<CortexIntention>{
    const apiKey=this.opts.apiKey;
    if(!apiKey)return this.fallback.reflect(pet,world);
    const base=this.kind==="openai"?"https://api.openai.com/v1":"https://openrouter.ai/api/v1";
    const model=this.opts.model||(this.kind==="openai"?"gpt-4o-mini":"openrouter/auto");
    try{
      const data=await fetchJson(`${base}/chat/completions`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},
        body:JSON.stringify({model,messages:[{role:"user",content:buildPrompt(pet,world)}],max_tokens:80,temperature:.7})
      });
      const parsed=parseIntention(data.choices?.[0]?.message?.content);
      if(parsed)return parsed;
    }catch{/* network / auth errors degrade gracefully */}
    return this.fallback.reflect(pet,world);
  }
}

export class GeminiCortex implements Cortex {
  private readonly fallback=new HeuristicCortex();
  constructor(private readonly opts:CortexOptions){}

  async reflect(pet:PetState,world:WorldSnapshot):Promise<CortexIntention>{
    const apiKey=this.opts.apiKey;
    if(!apiKey)return this.fallback.reflect(pet,world);
    const model=this.opts.model||"gemini-2.0-flash";
    try{
      const data=await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({contents:[{parts:[{text:buildPrompt(pet,world)}]}],generationConfig:{temperature:.7,maxOutputTokens:80}})
      });
      const parsed=parseIntention(data.candidates?.[0]?.content?.parts?.[0]?.text);
      if(parsed)return parsed;
    }catch{}
    return this.fallback.reflect(pet,world);
  }
}

export class AnthropicCortex implements Cortex {
  private readonly fallback=new HeuristicCortex();
  constructor(private readonly opts:CortexOptions){}

  async reflect(pet:PetState,world:WorldSnapshot):Promise<CortexIntention>{
    const apiKey=this.opts.apiKey;
    if(!apiKey)return this.fallback.reflect(pet,world);
    const model=this.opts.model||"claude-3-5-haiku-latest";
    try{
      const data=await fetchJson("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({model,max_tokens:80,messages:[{role:"user",content:buildPrompt(pet,world)}]})
      });
      const parsed=parseIntention(data.content?.[0]?.text);
      if(parsed)return parsed;
    }catch{}
    return this.fallback.reflect(pet,world);
  }
}

export function createCortex(provider:CortexProviderKind,opts:CortexOptions={}):Cortex{
  switch(provider){
    case "ollama":return new OllamaCortex(undefined,opts.model);
    case "openai":return new OpenAICompatibleCortex("openai",opts);
    case "openrouter":return new OpenAICompatibleCortex("openrouter",opts);
    case "gemini":return new GeminiCortex(opts);
    case "anthropic":return new AnthropicCortex(opts);
    default:return new HeuristicCortex();
  }
}
