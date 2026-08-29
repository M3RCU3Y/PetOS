import type { PetState } from "../core/types.js";

function hash01(input:string):number{
  let h=2166136261;
  for(const ch of input){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return(h>>>0)/4294967296;
}

function fpsFor(p:PetState,reducedMotion:boolean):number{
  if(reducedMotion)return 7;
  const b=p.behavior,speed=Math.abs(p.body.velocity.x);
  if(!p.body.grounded||b==="pounce"||b==="zoomies"||b==="run"||speed>110)return 12;
  if(speed>8||b==="walk"||b==="stalk"||b==="investigate"||b==="seek_user")return 10;
  if(["groom","eat","drink","scratch","play_toy","stretch"].includes(b))return 9;
  return 8;
}

/**
 * A sprite-like visual clock for procedural cats.
 * World movement remains smooth, while the painted animal advances in held
 * frames like a hand-authored sprite sheet. Per-pet phase prevents a room full
 * of cats from blinking or stepping in lockstep.
 */
export function catArtTime(p:PetState,t:number,reducedMotion=false):number{
  const fps=fpsFor(p,reducedMotion),frameMs=1000/fps;
  const phase=hash01(`${p.id}:art-clock`)*frameMs;
  return Math.floor((t+phase)/frameMs)*frameMs-phase;
}
