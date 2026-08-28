import type { PetAppearance, PetState } from "../core/types.js";
import { drawIllustratedCat as drawBaseCat, type IllustratedCatPose } from "./illustratedCat.js";
import { drawCatFinish } from "./catFinish.js";

export type { IllustratedCatPose } from "./illustratedCat.js";

const SIZE=128;
const ORIGIN=64;
const ART_DENSITY=.72;
let canvas:HTMLCanvasElement|null=null;
let ctx:CanvasRenderingContext2D|null=null;

function artContext():CanvasRenderingContext2D|null{
  if(typeof document==="undefined")return null;
  if(!canvas){canvas=document.createElement("canvas");canvas.width=SIZE;canvas.height=SIZE;ctx=canvas.getContext("2d");}
  return ctx;
}

/** Final low-density art pass shared by desktop, onboarding, creator and Cat Lab. */
export function drawIllustratedCat(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number):void{
  const rc=artContext();
  if(!rc||!canvas){drawBaseCat(c,p,a,pose,t);drawCatFinish(c,p,a,pose,t);return;}
  rc.setTransform(1,0,0,1,0,0);rc.clearRect(0,0,SIZE,SIZE);rc.imageSmoothingEnabled=false;
  rc.save();rc.translate(ORIGIN,ORIGIN);rc.scale(ART_DENSITY,ART_DENSITY);drawBaseCat(rc,p,a,pose,t);drawCatFinish(rc,p,a,pose,t);rc.restore();
  const inv=1/ART_DENSITY;c.save();c.imageSmoothingEnabled=false;c.drawImage(canvas,-ORIGIN*inv,-ORIGIN*inv,SIZE*inv,SIZE*inv);c.restore();
}
