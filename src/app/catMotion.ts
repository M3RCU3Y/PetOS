import type { PetAppearance, PetState } from "../core/types.js";
import { drawIllustratedCat as drawPose, type IllustratedCatPose } from "./cozyCatRaster.js";

export type { IllustratedCatPose } from "./cozyCatRaster.js";

interface MotionState{
  behavior:string;
  from:IllustratedCatPose;
  last:IllustratedCatPose;
  startedAt:number;
  seenAt:number;
}

const states=new Map<string,MotionState>();
const TRANSITION_MS=190;

function family(p:IllustratedCatPose):string{
  if(p.peeking)return"peek";
  if(p.hanging)return"hang";
  if(p.vertical)return"vertical";
  if(p.pouncing)return"pounce";
  if(p.lying)return"lying";
  if(p.loaf)return"loaf";
  if(p.sitting)return"sitting";
  return"standing";
}
function lerp(a:number,b:number,t:number):number{return a+(b-a)*t;}
function eased(t:number):number{const q=Math.max(0,Math.min(1,t));return 1-Math.pow(1-q,3);}

function blend(from:IllustratedCatPose,to:IllustratedCatPose,t:number):IllustratedCatPose{
  return{
    ...to,
    crouch:lerp(from.crouch,to.crouch,t),bow:lerp(from.bow,to.bow,t),arch:lerp(from.arch,to.arch,t),
    headDip:lerp(from.headDip,to.headDip,t),headBob:lerp(from.headBob,to.headBob,t),
    eyeOpen:lerp(from.eyeOpen,to.eyeOpen,t),pupilX:lerp(from.pupilX,to.pupilX,t),pupilY:lerp(from.pupilY,to.pupilY,t),
    earBack:lerp(from.earBack,to.earBack,t),earTwitch:lerp(from.earTwitch,to.earTwitch,t),
    tailLift:lerp(from.tailLift,to.tailLift,t),tailWagAmp:lerp(from.tailWagAmp,to.tailWagAmp,t),
    gait:lerp(from.gait,to.gait,t),legAmp:lerp(from.legAmp,to.legAmp,t),bounce:lerp(from.bounce,to.bounce,t),pawReach:lerp(from.pawReach,to.pawReach,t)
  };
}

function reducedMotion():boolean{
  try{return typeof matchMedia!=="undefined"&&matchMedia("(prefers-reduced-motion: reduce)").matches;}catch{return false;}
}

/**
 * Presentation-only pose compositor. The simulation changes behavior instantly;
 * this layer makes the visible animal ease between those decisions without
 * leaking animation state back into the brain or physics.
 */
export function drawIllustratedCat(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,target:IllustratedCatPose,t:number):void{
  if(reducedMotion()){drawPose(c,p,a,target,t);return;}
  let state=states.get(p.id);
  if(!state){state={behavior:p.behavior,from:target,last:target,startedAt:t,seenAt:t};states.set(p.id,state);drawPose(c,p,a,target,t);return;}

  state.seenAt=t;
  if(state.behavior!==p.behavior){
    state.from=state.last;
    state.behavior=p.behavior;
    state.startedAt=t;
  }

  const progress=eased((t-state.startedAt)/TRANSITION_MS);
  if(progress>=1){drawPose(c,p,a,target,t);state.last=target;}
  else if(family(state.from)===family(target)){
    const visual=blend(state.from,target,progress);drawPose(c,p,a,visual,t);state.last=visual;
  }else{
    // Different silhouettes get a very short sprite-like dissolve. At 190 ms it
    // reads as softness rather than ghosting, while still avoiding a one-frame pop.
    c.save();c.globalAlpha*=1-progress;drawPose(c,p,a,state.from,t);c.restore();
    c.save();c.globalAlpha*=progress;drawPose(c,p,a,target,t);c.restore();
    state.last=progress<.5?state.from:target;
  }

  if(states.size>64){for(const[id,s]of states){if(t-s.seenAt>60_000)states.delete(id);}}
}
