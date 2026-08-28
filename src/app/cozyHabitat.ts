import type { Vec2, WorldObject } from "../core/types.js";

const SOURCE=144;
const ART_DENSITY=.72;
const LOGICAL=SOURCE/ART_DENSITY;
let raster:HTMLCanvasElement|null=null;
let rasterCtx:CanvasRenderingContext2D|null=null;

function ensureRaster():CanvasRenderingContext2D|null{
  if(typeof document==="undefined")return null;
  if(!raster){raster=document.createElement("canvas");raster.width=SOURCE;raster.height=SOURCE;rasterCtx=raster.getContext("2d");}
  return rasterCtx;
}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string,rot=0):void{c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),rot,0,Math.PI*2);c.fill();}
function rect(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string):void{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function line(c:CanvasRenderingContext2D,color:string,width:number,draw:()=>void):void{c.strokeStyle=color;c.lineWidth=width;c.lineCap="round";c.lineJoin="round";c.beginPath();draw();c.stroke();}

function drawBack(c:CanvasRenderingContext2D,o:WorldObject,t:number):void{
  const r=o.radius;
  if(o.kind==="bed"){
    ellipse(c,0,1,r*1.08,r*.26,"rgba(58,43,34,.18)");ellipse(c,0,-7,r,r*.44,"#806d83");ellipse(c,0,-10,r*.78,r*.3,"#b59aae");ellipse(c,-8,-14,r*.48,r*.15,"#c9b4c0",-.08);line(c,"rgba(86,64,78,.28)",1.4,()=>{c.moveTo(-r*.48,-8);c.quadraticCurveTo(0,-2,r*.46,-9);});
  }else if(o.kind==="bowl"){
    ellipse(c,0,0,r*1.05,r*.22,"rgba(63,46,34,.16)");const body=o.contents==="water"?"#6795a8":"#a86653",inside=o.contents==="water"?"#a9d9df":"#d9a268";c.fillStyle=body;c.beginPath();c.moveTo(-r,-10);c.lineTo(r,-10);c.lineTo(r*.7,0);c.lineTo(-r*.7,0);c.closePath();c.fill();ellipse(c,0,-10,r*.84,3.1,inside);ellipse(c,-r*.24,-11.2,r*.28,.9,"rgba(255,255,255,.32)");
  }else if(o.kind==="box"){
    ellipse(c,0,1,r*1.02,r*.2,"rgba(54,38,27,.16)");rect(c,-r,-r*1.35,r*2,r*1.35,"#b88350");rect(c,-r,-r*1.35,r*2,5,"#8e633d");c.fillStyle="#66482f";c.beginPath();c.moveTo(-r,-r*1.35);c.lineTo(-r*.54,-r*1.58);c.lineTo(r*.55,-r*1.58);c.lineTo(r,-r*1.35);c.closePath();c.fill();rect(c,-r*.55,-r*.72,r*.34,r*.72,"rgba(129,82,43,.46)");
  }else if(o.kind==="scratcher"){
    ellipse(c,0,1,r*.92,r*.2,"rgba(55,40,30,.15)");rect(c,-r*.9,-5,r*1.8,7,"#9b724d");rect(c,-4,-r*2.05,8,r*2.05,"#8b6649");rect(c,-r*.55,-r*2.12,r*1.1,5,"#a77b55");for(let y=-r*1.82;y<-12;y+=5)rect(c,-4,y,8,2,"#c19b70");
  }else if(o.kind==="plant"){
    ellipse(c,0,1,r*.82,r*.19,"rgba(50,42,29,.14)");rect(c,-r*.48,-r*.66,r*.96,r*.66,"#9d7051");rect(c,-r*.54,-r*.7,r*1.08,5,"#b88461");ellipse(c,-r*.3,-r*1.22,r*.28,r*.67,"#66845d",-.48);ellipse(c,r*.32,-r*1.2,r*.28,r*.65,"#718f61",.5);ellipse(c,0,-r*1.46,r*.23,r*.62,"#7a9b68",0);ellipse(c,-r*.05,-r*1.12,r*.22,r*.5,"#789865",.22);ellipse(c,r*.42,-r*.98,r*.2,r*.48,"#5f8059",.72);line(c,"rgba(225,235,191,.25)",1,()=>{c.moveTo(0,-r*.72);c.lineTo(0,-r*1.88);});
  }else if(o.kind==="perch"){
    ellipse(c,0,1,r*.75,r*.17,"rgba(56,42,30,.14)");rect(c,-2.5,-r*1.65,5,r*1.65,"#78583e");rect(c,-r*.72,-4,r*1.44,4,"#8f6a48");rect(c,-r*.78,-r*1.72,r*1.56,5,"#a27950");
  }else if(o.kind==="tunnel"){
    ellipse(c,0,1,r*1.02,r*.2,"rgba(49,40,34,.15)");c.fillStyle="#73879c";c.beginPath();c.arc(0,0,r,Math.PI,0);c.closePath();c.fill();c.fillStyle="#35424d";c.beginPath();c.arc(0,0,r*.72,Math.PI,0);c.closePath();c.fill();line(c,"rgba(211,221,228,.24)",1.2,()=>{c.arc(0,0,r*.86,Math.PI+.18,-.18);});
  }else if(o.kind==="ball"||o.kind==="toy"){
    const bounce=Math.sin(t/430+o.position.x*.01)*.35;ellipse(c,0,1,r*1.04,r*.28,"rgba(50,38,30,.14)");ellipse(c,0,-r+bounce,r,r*.94,"#b95650");ellipse(c,-r*.26,-r*1.28+bounce,r*.48,r*.34,"#d47569");ellipse(c,-r*.42,-r*1.42+bounce,r*.16,r*.14,"rgba(255,238,224,.52)");
  }
}

function drawFront(c:CanvasRenderingContext2D,o:WorldObject):void{
  const r=o.radius;
  if(o.kind==="bed"){
    c.fillStyle="#756276";c.beginPath();c.moveTo(-r,-7);c.quadraticCurveTo(-r*.65,r*.18,0,r*.28);c.quadraticCurveTo(r*.67,r*.18,r,-7);c.lineTo(r*.82,-2);c.quadraticCurveTo(0,r*.48,-r*.82,-2);c.closePath();c.fill();line(c,"rgba(221,196,211,.28)",1.1,()=>{c.moveTo(-r*.64,-1);c.quadraticCurveTo(0,r*.22,r*.63,-1);});
  }else if(o.kind==="bowl"){
    const body=o.contents==="water"?"#557f93":"#925744";c.fillStyle=body;c.beginPath();c.moveTo(-r*.92,-9);c.lineTo(r*.92,-9);c.lineTo(r*.68,0);c.lineTo(-r*.68,0);c.closePath();c.fill();line(c,"rgba(255,238,217,.22)",1,()=>{c.moveTo(-r*.66,-7.5);c.lineTo(r*.66,-7.5);});
  }else if(o.kind==="box"){
    rect(c,-r,-r*.52,r*2,r*.52,"#a97343");rect(c,-r,-r*.52,r*2,4,"#c0915c");
  }else if(o.kind==="tunnel"){
    c.fillStyle="#64798e";c.beginPath();c.moveTo(-r,0);c.quadraticCurveTo(0,r*.22,r,0);c.lineTo(r*.72,0);c.quadraticCurveTo(0,r*.1,-r*.72,0);c.closePath();c.fill();
  }
}

function rasterPass(target:CanvasRenderingContext2D,o:WorldObject,pos:Vec2,t:number,front:boolean):void{
  const c=ensureRaster();if(!c||!raster)return;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,SOURCE,SOURCE);c.imageSmoothingEnabled=false;c.setTransform(ART_DENSITY,0,0,ART_DENSITY,SOURCE/2,SOURCE/2);if(front)drawFront(c,o);else drawBack(c,o,t);target.save();target.imageSmoothingEnabled=false;target.drawImage(raster,pos.x-LOGICAL/2,pos.y-LOGICAL/2,LOGICAL,LOGICAL);target.restore();
}

export function drawCozyObjectBack(c:CanvasRenderingContext2D,o:WorldObject,pos:Vec2,t:number):void{rasterPass(c,o,pos,t,false);}
export function drawCozyObjectFront(c:CanvasRenderingContext2D,o:WorldObject,pos:Vec2,t:number):void{rasterPass(c,o,pos,t,true);}
