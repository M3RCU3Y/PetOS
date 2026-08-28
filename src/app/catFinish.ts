import type { PetAppearance, PetState } from "../core/types.js";
import type { IllustratedCatPose } from "./illustratedCat.js";

const TAU=Math.PI*2;
function clamp(v:number,a=0,b=1):number{return Math.max(a,Math.min(b,v));}
function hash01(input:string):number{let h=2166136261;for(const ch of input){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;}
function rgb(hex:string):[number,number,number]{const clean=hex.replace("#","");const full=clean.length===3?clean.split("").map(x=>x+x).join(""):clean.padEnd(6,"0").slice(0,6);const n=parseInt(full,16)||0;return[(n>>16)&255,(n>>8)&255,n&255];}
function shade(hex:string,f:number):string{const [r,g,b]=rgb(hex),ch=(v:number)=>Math.round(clamp(v*f,0,255));return`rgb(${ch(r)},${ch(g)},${ch(b)})`;}
function rgba(hex:string,a:number):string{const[r,g,b]=rgb(hex);return`rgba(${r},${g},${b},${a})`;}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string,rot=0):void{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,rot,0,TAU);c.fill();}
function line(c:CanvasRenderingContext2D,color:string,width:number,draw:()=>void):void{c.strokeStyle=color;c.lineWidth=width;c.lineCap="round";c.lineJoin="round";c.beginPath();draw();c.stroke();}

type Anchor={x:number;y:number};
function sleepCurl(p:PetState):boolean{return hash01(`${p.id}:sleep-pose`)>.42;}
function standingHead(pose:IllustratedCatPose):Anchor{const bodyY=-27+pose.crouch*7-pose.bounce;return{x:22+pose.crouch*5+pose.headDip*7,y:bodyY+1.8+pose.crouch*5+pose.headDip*10+pose.headBob};}
function headAnchor(p:PetState,pose:IllustratedCatPose,t:number):Anchor|null{
  if(pose.peeking)return{x:0,y:-10};
  if(pose.hanging)return{x:1,y:9};
  if(pose.pouncing&&!p.body.grounded)return null;
  if(pose.loaf)return{x:15,y:-20+Math.sin(t/1700)*.3};
  if(pose.lying)return sleepCurl(p)?{x:12,y:-24}:{x:17,y:-13};
  if(pose.sitting)return{x:7,y:-42+pose.headBob};
  if(pose.vertical)return null;
  return standingHead(pose);
}

function faceFinish(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number):void{
  const anchor=headAnchor(p,pose,t);if(!anchor)return;
  const {x,y}=anchor,pattern=a.markings??"tabby",deep=shade(a.coat,.47),variant=hash01(`${p.id}:face-mark`);
  if(pattern==="tabby"){
    line(c,rgba(deep,.7),.7,()=>{c.moveTo(x-4.8,y-7.4);c.lineTo(x-3.2,y-5.7);c.lineTo(x-1.8,y-7.2);c.lineTo(x-.2,y-5.5);c.lineTo(x+1.4,y-7);});
    line(c,rgba(deep,.5),.65,()=>{c.moveTo(x-9.1,y+1.2);c.lineTo(x-6.6,y+2.15);c.moveTo(x-8.7,y+3.2);c.lineTo(x-6.2,y+3.55);});
  }else if(pattern==="tuxedo"&&variant>.42){
    line(c,rgba(a.accent,.72),1.35,()=>{c.moveTo(x-1.2,y-7.2);c.quadraticCurveTo(x-.1,y-4.8,x+.3,y-2.4);});
    ellipse(c,x+8.9,y+3.05,.62,.42,"rgba(255,255,255,.48)");
  }else if(pattern==="patched"){
    const side=variant>.5?1:-1;ellipse(c,x+side*5.7,y-5.3,2.45,2.8,rgba(a.accent,.38),side*.2);
  }
  ellipse(c,x+9.15,y+2.25,.48,.32,"rgba(255,228,218,.62)");
  ellipse(c,x+8.25,y+6.05,.45,.22,"rgba(255,238,229,.27)");
}

function bodyFinish(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose):void{
  if(pose.peeking||pose.hanging||pose.pouncing||pose.vertical)return;
  const pattern=a.markings??"tabby",deep=shade(a.coat,.5),variant=hash01(`${p.id}:body-mark`);
  if(!pose.lying&&!pose.loaf&&!pose.sitting){
    const bodyY=-27+pose.crouch*7-pose.bounce;
    line(c,"rgba(255,244,224,.18)",.55,()=>{c.moveTo(-10,bodyY-2.4);c.lineTo(-5.8,bodyY-3.2);c.moveTo(-1.5,bodyY-3.3);c.lineTo(3,bodyY-3.8);});
    if(pattern==="tabby"&&variant>.32)line(c,rgba(deep,.44),.85,()=>{c.moveTo(-18,bodyY+2);c.lineTo(-15,bodyY+5.3);c.moveTo(-15,bodyY+1.2);c.lineTo(-12.2,bodyY+4.6);});
    if(pattern==="tuxedo")ellipse(c,14.3,bodyY+10.2,5.1,3.05,rgba(a.accent,.34),-.12);
  }else if(pose.loaf){
    line(c,"rgba(255,244,224,.16)",.55,()=>{c.moveTo(-8,-20.4);c.lineTo(-2,-21.4);c.moveTo(2,-20.8);c.lineTo(7,-21.5);});
  }
}

/** Tiny final accents painted inside the same low-resolution raster as the cat. */
export function drawCatFinish(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number):void{
  bodyFinish(c,p,a,pose);faceFinish(c,p,a,pose,t);
}
