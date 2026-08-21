import type { PetState, WorldSnapshot } from "./types.js";

export interface CortexIntention { kind:"seek_attention"|"settle"|"explore"|"play"|"none"; confidence:number; note:string; }
export interface Cortex { reflect(pet:PetState,world:WorldSnapshot):Promise<CortexIntention>; }

export class HeuristicCortex implements Cortex {
  async reflect(pet:PetState,world:WorldSnapshot):Promise<CortexIntention>{
    if(world.userActivity==="gaming"||world.userActivity==="fullscreen"||world.userActivity==="presentation") return {kind:"settle",confidence:.9,note:"Keeper protects focus"};
    if(pet.drives.social>.78&&pet.bond>.35)return{kind:"seek_attention",confidence:.72,note:"strong social need and bond"};
    if(pet.drives.play>.8&&pet.drives.fatigue<.5)return{kind:"play",confidence:.7,note:"high play drive"};
    if(pet.drives.curiosity>.75)return{kind:"explore",confidence:.65,note:"curiosity is unsatisfied"};
    return{kind:"none",confidence:.5,note:"ordinary autonomous behavior"};
  }
}
