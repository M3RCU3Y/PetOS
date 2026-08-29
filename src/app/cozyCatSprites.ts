import type { PetAppearance, PetState } from "../core/types.js";
import type { IllustratedCatPose } from "./illustratedCat.js";

const FRAME=96;
const DRAW_SIZE=72;
const MOTION_FRAMES=8;
const IDLE_INTERVAL_MS=125;

type SheetKind="orange"|"gray"|"colorpoint";
type SheetAsset={image:HTMLImageElement|null;loaded:boolean};
type SpriteFrame={col:number;row:number};

const sheetUrls:Record<SheetKind,string>={
  orange:new URL("../../sheets/cozy-orange-tabby.png",import.meta.url).href,
  gray:new URL("../../sheets/cozy-gray-tabby.png",import.meta.url).href,
  colorpoint:new URL("../../sheets/cozy-colorpoint.png",import.meta.url).href
};
const motionSheetUrls:Record<SheetKind,string>={
  orange:new URL("../../sheets/cozy-orange-tabby-motion.png",import.meta.url).href,
  gray:new URL("../../sheets/cozy-gray-tabby-motion.png",import.meta.url).href,
  colorpoint:new URL("../../sheets/cozy-colorpoint-motion.png",import.meta.url).href
};
const sheets:Record<SheetKind,SheetAsset>={orange:{image:null,loaded:false},gray:{image:null,loaded:false},colorpoint:{image:null,loaded:false}};
const motionSheets:Record<SheetKind,SheetAsset>={orange:{image:null,loaded:false},gray:{image:null,loaded:false},colorpoint:{image:null,loaded:false}};
let requested=false;

function requestSheets():void{
  if(requested||typeof Image==="undefined")return;requested=true;
  for(const kind of Object.keys(sheets) as SheetKind[]){
    const image=new Image();sheets[kind].image=image;
    image.addEventListener("load",()=>{sheets[kind].loaded=true;},{once:true});
    image.src=sheetUrls[kind];
    const motionImage=new Image();motionSheets[kind].image=motionImage;
    motionImage.addEventListener("load",()=>{motionSheets[kind].loaded=true;},{once:true});
    motionImage.src=motionSheetUrls[kind];
  }
}

function rgb(hex:string):[number,number,number]{
  const clean=hex.replace("#","");const full=clean.length===3?clean.split("").map(part=>part+part).join(""):clean.padEnd(6,"0").slice(0,6);
  const value=parseInt(full,16)||0;return[(value>>16)&255,(value>>8)&255,value&255];
}
function luma(hex:string):number{const[r,g,b]=rgb(hex);return r*.299+g*.587+b*.114;}
function saturation(hex:string):number{const values=rgb(hex),high=Math.max(...values),low=Math.min(...values);return high===0?0:(high-low)/high;}

function sheetFor(a:PetAppearance):SheetKind{
  const coatLuma=luma(a.coat),accentLuma=luma(a.accent);
  if(coatLuma>145&&accentLuma<coatLuma-22)return"colorpoint";
  if(a.markings==="tuxedo"||saturation(a.coat)<.16)return"gray";
  return"orange";
}

function hashPhase(id:string):number{let hash=2166136261;for(const char of id){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0)%4;}

function frameFor(p:PetState,pose:IllustratedCatPose,t:number):SpriteFrame{
  if(pose.peeking)return{col:2,row:0};
  if(pose.pouncing&&!p.body.grounded)return{col:3,row:3};
  if(pose.lying)return{col:2,row:2};
  if(pose.loaf)return{col:1,row:2};
  if(pose.sitting)return{col:pose.grooming?3:0,row:2};
  if(pose.pouncing||p.behavior==="stalk")return{col:2,row:3};
  if(p.behavior==="stretch")return{col:1,row:3};
  if(["investigate","eat","drink","scratch","play_toy"].includes(p.behavior))return{col:0,row:3};
  return{col:0,row:0};
}

function usesMotionLoop(p:PetState,pose:IllustratedCatPose):boolean{
  if(pose.peeking||pose.pouncing||pose.lying||pose.loaf||pose.sitting||pose.vertical||pose.hanging)return false;
  return !["investigate","eat","drink","scratch","play_toy","stretch","stalk"].includes(p.behavior);
}

function motionFrame(p:PetState,t:number,reducedMotion:boolean):SpriteFrame{
  const speed=Math.abs(p.body.velocity.x),moving=speed>8;
  if(reducedMotion)return{col:hashPhase(p.id),row:moving?1:0};
  const interval=moving?(speed>110?82:105):IDLE_INTERVAL_MS;
  return{col:(Math.floor(t/interval)+hashPhase(p.id))%MOTION_FRAMES,row:moving?1:0};
}

/** Plays authored, baseline-locked frames without warping the raster artwork. */
export function drawCozyCatSprite(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number,artT=t,reducedMotion=false):boolean{
  requestSheets();
  if(pose.vertical||pose.hanging)return false;
  const kind=sheetFor(a),motion=usesMotionLoop(p,pose),asset=motion?motionSheets[kind]:sheets[kind];if(!asset.loaded||!asset.image)return false;
  const frame=motion?motionFrame(p,t,reducedMotion):frameFor(p,pose,artT),size=DRAW_SIZE;
  c.save();c.imageSmoothingEnabled=false;
  c.drawImage(asset.image,frame.col*FRAME,frame.row*FRAME,FRAME,FRAME,-size*.5,-size,size,size);
  c.restore();return true;
}

export function preloadCozyCatSprites():void{requestSheets();}
