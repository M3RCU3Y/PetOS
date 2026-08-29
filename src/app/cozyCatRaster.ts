import type { PetAppearance, PetState } from "../core/types.js";
import { drawIllustratedCat as drawBaseCat, type IllustratedCatPose } from "./illustratedCat.js";
import { drawCatFinish } from "./catFinish.js";

export type { IllustratedCatPose } from "./illustratedCat.js";

const SIZE=128;
const ORIGIN=64;
const ART_DENSITY=.72;
let canvas:HTMLCanvasElement|null=null;
let ctx:CanvasRenderingContext2D|null=null;

type Rgb=readonly[number,number,number];

function rgb(hex:string):Rgb{
  const clean=hex.replace("#","");
  const full=clean.length===3?clean.split("").map(part=>part+part).join(""):clean.padEnd(6,"0").slice(0,6);
  const value=parseInt(full,16)||0;
  return[(value>>16)&255,(value>>8)&255,value&255];
}

function mix(a:Rgb,b:Rgb,t:number):Rgb{
  const q=Math.max(0,Math.min(1,t));
  return[
    Math.round(a[0]*(1-q)+b[0]*q),
    Math.round(a[1]*(1-q)+b[1]*q),
    Math.round(a[2]*(1-q)+b[2]*q)
  ];
}

function shade(color:Rgb,factor:number):Rgb{return color.map(channel=>Math.round(Math.max(0,Math.min(255,channel*factor)))) as unknown as Rgb;}

function cozyPalette(a:PetAppearance):Rgb[]{
  const coat=rgb(a.coat),accent=rgb(a.accent),eye=rgb(a.eye),ink:Rgb=[55,51,57],cream:Rgb=[255,241,218];
  return[
    ink,
    mix(coat,ink,.66),
    shade(coat,.66),
    shade(coat,.82),
    coat,
    mix(coat,cream,.23),
    shade(accent,.78),
    accent,
    mix(accent,cream,.34),
    eye,
    [174,100,108],
    [246,235,218]
  ];
}

function nearestColor(r:number,g:number,b:number,palette:Rgb[]):Rgb{
  let best=palette[0]!,bestDistance=Infinity;
  for(const color of palette){
    const dr=r-color[0],dg=g-color[1],db=b-color[2];
    const distance=dr*dr*.30+dg*dg*.59+db*db*.11;
    if(distance<bestDistance){best=color;bestDistance=distance;}
  }
  return best;
}

function css(color:Rgb):string{return`rgb(${color[0]},${color[1]},${color[2]})`;}

function hash01(input:string):number{
  let hash=2166136261;
  for(const char of input){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return(hash>>>0)/4294967296;
}

function faceAnchor(p:PetState,pose:IllustratedCatPose,t:number):{x:number;y:number}|null{
  if(pose.vertical||pose.pouncing&&!p.body.grounded)return null;
  if(pose.peeking)return{x:0,y:-10+Math.sin(t/650)*.75};
  if(pose.hanging)return{x:1,y:9};
  if(pose.loaf)return{x:15,y:-20+Math.sin(t/1700)*.3};
  if(pose.lying)return hash01(`${p.id}:sleep-pose`)>.42?{x:12,y:-23}:{x:17,y:-13};
  if(pose.sitting)return{x:7,y:-38.5+pose.headBob};
  const length=.80+hash01(`${p.id}:length`)*.08,bodyY=-27+pose.crouch*7-pose.bounce;
  return{x:18+(length-.84)*10+pose.crouch*5+pose.headDip*7,y:bodyY+2+pose.crouch*5+pose.headDip*10+pose.headBob+pose.bounce*.28};
}

/** Reassert tiny facial landmarks after quantization so they never collapse into one dark blob. */
function paintPixelFace(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number):void{
  const anchor=faceAnchor(p,pose,t);if(!anchor)return;
  const x=Math.round(ORIGIN+anchor.x*ART_DENSITY),y=Math.round(ORIGIN+anchor.y*ART_DENSITY);
  const coat=rgb(a.coat),accent=rgb(a.accent),eye=rgb(a.eye),ink:Rgb=[55,51,57],pink:Rgb=[174,100,108],cream=mix(accent,[255,241,218],.32);
  c.fillStyle=css(accent);c.fillRect(x-4,y+1,9,4);c.fillRect(x-3,y+5,7,1);
  c.fillStyle=css(cream);c.fillRect(x-3,y+1,3,3);c.fillRect(x+1,y+1,3,3);
  c.fillStyle=css(ink);
  if(pose.eyeOpen<.17){c.fillRect(x-5,y-2,3,1);c.fillRect(x+3,y-2,3,1);}
  else{
    c.fillRect(x-5,y-3,3,3);c.fillRect(x+3,y-3,3,3);
    c.fillStyle=css(eye);c.fillRect(x-4,y-2,1,1);c.fillRect(x+4,y-2,1,1);
  }
  c.fillStyle=css(pink);c.fillRect(x,y+2,2,1);
  c.fillStyle=css(ink);c.fillRect(x+1,y+3,1,2);c.fillRect(x-1,y+5,2,1);c.fillRect(x+2,y+5,2,1);
  c.fillRect(x-7,y+3,2,1);c.fillRect(x+6,y+3,2,1);c.fillRect(x-8,y+5,3,1);c.fillRect(x+6,y+5,3,1);
  if((a.markings??"tabby")==="tabby"){
    const stripe=mix(shade(coat,.58),ink,.28);c.fillStyle=css(stripe);
    c.fillRect(x-3,y-7,1,3);c.fillRect(x,y-8,1,3);c.fillRect(x+3,y-7,1,3);
  }
}

/** Collapse soft vector shading into the discrete clusters and dark contour used by cozy pixel art. */
function pixelPaint(c:CanvasRenderingContext2D,a:PetAppearance):void{
  const image=c.getImageData(0,0,SIZE,SIZE),source=new Uint8ClampedArray(image.data),data=image.data;
  const mask=new Uint8Array(SIZE*SIZE),palette=cozyPalette(a),outline:Rgb=[62,58,64];
  for(let i=0;i<mask.length;i++)mask[i]=source[i*4+3]!>=42?1:0;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const pixel=y*SIZE+x,index=pixel*4;
    if(mask[pixel]){
      const color=nearestColor(source[index]!,source[index+1]!,source[index+2]!,palette);
      data[index]=color[0];data[index+1]=color[1];data[index+2]=color[2];data[index+3]=255;
      continue;
    }
    let edge=false;
    for(let oy=-1;oy<=1&&!edge;oy++)for(let ox=-1;ox<=1;ox++){
      if(ox===0&&oy===0)continue;
      const nx=x+ox,ny=y+oy;
      if(nx>=0&&nx<SIZE&&ny>=0&&ny<SIZE&&mask[ny*SIZE+nx]){edge=true;break;}
    }
    if(edge){data[index]=outline[0];data[index+1]=outline[1];data[index+2]=outline[2];data[index+3]=255;}
    else data[index+3]=0;
  }
  c.putImageData(image,0,0);
}

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
  pixelPaint(rc,a);
  paintPixelFace(rc,p,a,pose,t);
  const inv=1/ART_DENSITY;c.save();c.imageSmoothingEnabled=false;c.drawImage(canvas,-ORIGIN*inv,-ORIGIN*inv,SIZE*inv,SIZE*inv);c.restore();
}
