import type { PetAppearance, PetState } from "../core/types.js";
import { drawIllustratedCat as drawPose, type IllustratedCatPose } from "./cozyCatRaster.js";

export type { IllustratedCatPose } from "./cozyCatRaster.js";

interface MotionState{signature:string;from:IllustratedCatPose;last:IllustratedCatPose;startedAt:number;seenAt:number;lastGrounded:boolean;landingAt:number;}
const states=new Map<string,MotionState>();
const SAME_FAMILY_MS=180;
const SILHOUETTE_MS=245;
const LANDING_MS=190;

function family(p:IllustratedCatPose):string{if(p.peeking)return"peek";if(p.hanging)return"hang";if(p.vertical)return"vertical";if(p.pouncing)return"pounce";if(p.lying)return"lying";if(p.loaf)return"loaf";if(p.sitting)return"sitting";return"standing";}
function signature(p:PetState,pose:IllustratedCatPose):string{return`${p.behavior}:${family(pose)}`;}
function clamp(v:number,a=0,b=1):number{return Math.max(a,Math.min(b,v));}
function lerp(a:number,b:number,t:number):number{return a+(b-a)*t;}
function eased(t:number):number{const q=clamp(t);return 1-Math.pow(1-q,3);}
function smoothstep(t:number):number{const q=clamp(t);return q*q*(3-2*q);}
function blend(from:IllustratedCatPose,to:IllustratedCatPose,t:number):IllustratedCatPose{return{...to,crouch:lerp(from.crouch,to.crouch,t),bow:lerp(from.bow,to.bow,t),arch:lerp(from.arch,to.arch,t),headDip:lerp(from.headDip,to.headDip,t),headBob:lerp(from.headBob,to.headBob,t),eyeOpen:lerp(from.eyeOpen,to.eyeOpen,t),pupilX:lerp(from.pupilX,to.pupilX,t),pupilY:lerp(from.pupilY,to.pupilY,t),earBack:lerp(from.earBack,to.earBack,t),earTwitch:lerp(from.earTwitch,to.earTwitch,t),tailLift:lerp(from.tailLift,to.tailLift,t),tailWagAmp:lerp(from.tailWagAmp,to.tailWagAmp,t),gait:lerp(from.gait,to.gait,t),legAmp:lerp(from.legAmp,to.legAmp,t),bounce:lerp(from.bounce,to.bounce,t),pawReach:lerp(from.pawReach,to.pawReach,t)};}
function systemReducedMotion():boolean{try{return typeof matchMedia!=="undefined"&&matchMedia("(prefers-reduced-motion: reduce)").matches;}catch{return false;}}

function drawWithKinetics(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number,state:MotionState,alpha=1):void{
  const landingAge=t-state.landingAt;
  const landing=landingAge>=0&&landingAge<LANDING_MS?1-smoothstep(landingAge/LANDING_MS):0;
  const speed=clamp(Math.abs(p.body.velocity.x)/420);
  const activeGrounded=p.body.grounded&&!pose.lying&&!pose.loaf&&!pose.sitting&&!pose.hanging&&!pose.peeking;
  const lean=activeGrounded?speed*.035:0;
  c.save();c.globalAlpha*=alpha;
  if(landing>0){c.translate(0,landing*1.8);c.scale(1+landing*.105,1-landing*.12);}
  if(lean>0)c.rotate(lean);
  drawPose(c,p,a,pose,t);c.restore();
}

/** Presentation-only motion: the brain remains instantaneous while the visible animal anticipates, contacts and recovers. */
export function drawIllustratedCat(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,target:IllustratedCatPose,t:number,reduceMotion=false):void{
  if(reduceMotion||systemReducedMotion()){drawPose(c,p,a,target,t);return;}
  const sig=signature(p,target);let state=states.get(p.id);
  if(!state){state={signature:sig,from:target,last:target,startedAt:t,seenAt:t,lastGrounded:p.body.grounded,landingAt:-Infinity};states.set(p.id,state);drawPose(c,p,a,target,t);return;}
  state.seenAt=t;if(!state.lastGrounded&&p.body.grounded)state.landingAt=t;state.lastGrounded=p.body.grounded;
  if(state.signature!==sig){state.from=state.last;state.signature=sig;state.startedAt=t;}
  const sameFamily=family(state.from)===family(target),duration=sameFamily?SAME_FAMILY_MS:SILHOUETTE_MS,linear=clamp((t-state.startedAt)/duration),progress=eased(linear);
  if(progress>=1){drawWithKinetics(c,p,a,target,t,state);state.last=target;}
  else if(sameFamily){const visual=blend(state.from,target,progress);drawWithKinetics(c,p,a,visual,t,state);state.last=visual;}
  else{
    const swap=.46;
    if(linear<swap){const q=smoothstep(linear/swap);c.save();c.translate(0,q*2.6);c.scale(1+q*.07,1-q*.17);drawWithKinetics(c,p,a,state.from,t,state,1-q*.08);c.restore();state.last=state.from;}
    else{const q=smoothstep((linear-swap)/(1-swap));c.save();c.translate(0,(1-q)*2.6);c.scale(1+(1-q)*.07,.83+(q*.17));drawWithKinetics(c,p,a,target,t,state,.92+q*.08);c.restore();state.last=target;}
  }
  if(states.size>64){for(const[id,s]of states){if(t-s.seenAt>60_000)states.delete(id);}}
}
