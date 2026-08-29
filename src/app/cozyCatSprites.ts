import type { PetAppearance, PetState } from "../core/types.js";
import type { IllustratedCatPose } from "./illustratedCat.js";

const FRAME=96;
const DRAW_SIZE=72;

type SheetKind="orange"|"gray"|"colorpoint";
type SheetAsset={image:HTMLImageElement|null;loaded:boolean};

const sheetUrls:Record<SheetKind,string>={
  orange:new URL("../../sheets/cozy-orange-tabby.png",import.meta.url).href,
  gray:new URL("../../sheets/cozy-gray-tabby.png",import.meta.url).href,
  colorpoint:new URL("../../sheets/cozy-colorpoint.png",import.meta.url).href
};
const sheets:Record<SheetKind,SheetAsset>={orange:{image:null,loaded:false},gray:{image:null,loaded:false},colorpoint:{image:null,loaded:false}};
let requested=false;

function requestSheets():void{
  if(requested||typeof Image==="undefined")return;requested=true;
  for(const kind of Object.keys(sheets) as SheetKind[]){
    const image=new Image();sheets[kind].image=image;
    image.addEventListener("load",()=>{sheets[kind].loaded=true;},{once:true});
    image.src=sheetUrls[kind];
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

function frameFor(p:PetState,pose:IllustratedCatPose,t:number):{col:number;row:number}{
  if(pose.peeking)return{col:2,row:0};
  if(pose.pouncing&&!p.body.grounded)return{col:3,row:3};
  if(pose.lying)return{col:2,row:2};
  if(pose.loaf)return{col:1,row:2};
  if(pose.sitting)return{col:pose.grooming?3:0,row:2};
  if(pose.pouncing||p.behavior==="stalk")return{col:2,row:3};
  if(p.behavior==="stretch")return{col:1,row:3};
  if(["investigate","eat","drink","scratch","play_toy"].includes(p.behavior))return{col:0,row:3};
  if(Math.abs(p.body.velocity.x)>8)return{col:Math.floor(t/105)%4,row:1};
  return{col:Math.floor(t/720)%4,row:0};
}

/** Draws the authored sprite family; returns false while assets are unavailable. */
export function drawCozyCatSprite(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number):boolean{
  requestSheets();
  if(pose.vertical||pose.hanging)return false;
  const asset=sheets[sheetFor(a)];if(!asset.loaded||!asset.image)return false;
  const frame=frameFor(p,pose,t),size=DRAW_SIZE;
  c.save();c.imageSmoothingEnabled=false;
  c.drawImage(asset.image,frame.col*FRAME,frame.row*FRAME,FRAME,FRAME,-size*.5,-size,size,size);
  c.restore();return true;
}

export function preloadCozyCatSprites():void{requestSheets();}
