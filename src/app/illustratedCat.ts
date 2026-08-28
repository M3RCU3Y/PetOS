import type { PetAppearance, PetState } from "../core/types.js";

export interface IllustratedCatPose {
  lying:boolean;
  sitting:boolean;
  crouch:number;
  bow:number;
  arch:number;
  headDip:number;
  headBob:number;
  eyeOpen:number;
  pupilX:number;
  pupilY:number;
  earBack:number;
  earTwitch:number;
  tailLift:number;
  tailWagAmp:number;
  tailFast:boolean;
  gait:number;
  legAmp:number;
  bounce:number;
  puff:boolean;
  carry:boolean;
  pawReach:number;
  grooming:boolean;
  party?:boolean;
}

const TAU=Math.PI*2;

interface CatMorph {
  head:number;
  ears:number;
  bodyLength:number;
  bodyRound:number;
  muzzle:number;
  tail:number;
}

function hash01(input:string):number{
  let h=2166136261;
  for(const ch of input){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return(h>>>0)/4294967296;
}

function morphFor(p:PetState):CatMorph{
  const v=(salt:string)=>hash01(`${p.id}:${salt}`);
  return{
    head:.95+v("head")*.11,
    ears:.9+v("ears")*.2,
    bodyLength:.95+v("length")*.1,
    bodyRound:.94+v("round")*.13,
    muzzle:.92+v("muzzle")*.16,
    tail:.9+v("tail")*.2
  };
}

function clamp(v:number,a=0,b=1):number{return Math.max(a,Math.min(b,v));}
function shade(hex:string,f:number):string{
  const clean=hex.replace("#","");
  const n=parseInt(clean.length===3?clean.split("").map(x=>x+x).join(""):clean,16);
  const ch=(v:number)=>Math.round(clamp(v*f,0,255));
  return `#${[ch((n>>16)&255),ch((n>>8)&255),ch(n&255)].map(v=>v.toString(16).padStart(2,"0")).join("")}`;
}
function rgba(hex:string,a:number):string{
  const n=parseInt(hex.replace("#",""),16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string,rot=0):void{
  c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),rot,0,TAU);c.fill();
}
function path(c:CanvasRenderingContext2D,color:string,draw:()=>void):void{c.fillStyle=color;c.beginPath();draw();c.closePath();c.fill();}

function bodyGradient(c:CanvasRenderingContext2D,a:PetAppearance,x0:number,y0:number,x1:number,y1:number):CanvasGradient{
  const g=c.createLinearGradient(x0,y0,x1,y1);
  g.addColorStop(0,shade(a.coat,1.11));
  g.addColorStop(.38,a.coat);
  g.addColorStop(1,shade(a.coat,.68));
  return g;
}

function drawEye(c:CanvasRenderingContext2D,x:number,y:number,open:number,gx:number,gy:number,color:string,far=false):void{
  if(open<.14){
    c.strokeStyle=shade(color,.35);c.lineWidth=1.15;c.lineCap="round";
    c.beginPath();c.moveTo(x-2.7,y);c.quadraticCurveTo(x,y+1,x+2.7,y);c.stroke();
    return;
  }
  const h=2.8*open;
  ellipse(c,x,y,2.65,h,shade(color,1.03));
  ellipse(c,x+clamp(gx,-1,1)*.75,y+clamp(gy,-1,1)*.45,far?.58:.7,h*.76,"#202026");
  ellipse(c,x-.75,y-.85,far?.38:.48,.48,"rgba(255,255,255,.95)");
  c.strokeStyle="rgba(28,25,28,.35)";c.lineWidth=.55;
  c.beginPath();c.ellipse(x,y,2.7,h,0,0,TAU);c.stroke();
}

function drawFace(c:CanvasRenderingContext2D,a:PetAppearance,p:IllustratedCatPose,cx:number,cy:number,m:CatMorph):void{
  const accent=shade(a.accent,1.03);
  const dark=shade(a.coat,.5);
  ellipse(c,cx+4.1,cy+3.3,6.1*m.muzzle,4.4*m.muzzle,rgba(accent,.92));
  ellipse(c,cx-1.2,cy+4.1,4.6*m.muzzle,3.8*m.muzzle,rgba(accent,.58));
  drawEye(c,cx-4.0,cy-1.6,p.eyeOpen,p.pupilX,p.pupilY,a.eye,true);
  drawEye(c,cx+3.5,cy-1.4,p.eyeOpen,p.pupilX,p.pupilY,a.eye,false);
  path(c,"#9a5b61",()=>{c.moveTo(cx+8.2,cy+2);c.lineTo(cx+11,cy+3.2);c.lineTo(cx+8.3,cy+4.7);});
  c.strokeStyle=dark;c.lineWidth=.8;c.lineCap="round";
  c.beginPath();c.moveTo(cx+9.3,cy+4.8);c.quadraticCurveTo(cx+7.7,cy+6.2,cx+5.8,cy+6.3);c.stroke();
  c.strokeStyle="rgba(255,255,255,.45)";c.lineWidth=.7;
  for(const dy of [-.9,1.1,3.1]){c.beginPath();c.moveTo(cx+7.2,cy+4.2+dy);c.quadraticCurveTo(cx+14,cy+3.4+dy,cx+18,cy+5+dy);c.stroke();}
}

function drawEars(c:CanvasRenderingContext2D,a:PetAppearance,p:IllustratedCatPose,cx:number,cy:number,t:number,m:CatMorph):void{
  const flat=p.earBack;
  const twitch=p.earTwitch>0&&Math.sin(t/55)>0?p.earTwitch:0;
  const outer=shade(a.coat,.9),inner=rgba(a.accent,.68);
  const leftAngle=-.08-flat*.46,rightAngle=.08+flat*.46;
  const ear=(x:number,ang:number,mirror:number)=>{
    c.save();c.translate(x,cy);c.rotate(ang);c.scale(mirror*m.ears,m.ears);
    path(c,outer,()=>{c.moveTo(-1,2);c.lineTo(2,-13-twitch);c.quadraticCurveTo(6,-6,8,4);c.lineTo(1,5);});
    path(c,inner,()=>{c.moveTo(1,1);c.lineTo(3,-8-twitch*.55);c.lineTo(6,2);});
    c.restore();
  };
  ear(cx-8,leftAngle,1);ear(cx+7,rightAngle,-1);
}

function drawHead(c:CanvasRenderingContext2D,a:PetAppearance,p:IllustratedCatPose,cx:number,cy:number,t:number,m:CatMorph):void{
  c.save();
  c.translate(cx,cy);c.scale(m.head,m.head);c.translate(-cx,-cy);
  drawEars(c,a,p,cx,cy-6,t,m);
  c.fillStyle=bodyGradient(c,a,cx-12,cy-10,cx+12,cy+11);
  c.beginPath();c.ellipse(cx,cy,12.7,11.2,-.04,0,TAU);c.fill();
  ellipse(c,cx-3.6,cy-5.1,6.6,2.5,rgba(shade(a.coat,1.18),.42),-.13);
  if(a.markings==="tabby"){
    c.strokeStyle=rgba(shade(a.coat,.5),.72);c.lineWidth=1.55;c.lineCap="round";
    for(const dx of [-4,0,4]){c.beginPath();c.moveTo(cx+dx,cy-8.4);c.quadraticCurveTo(cx+dx*.78,cy-6,cx+dx*.55,cy-4.4);c.stroke();}
    c.beginPath();c.moveTo(cx-10,cy-1);c.quadraticCurveTo(cx-7,cy,cx-6,cy+2);c.stroke();
  }else if(a.markings==="tuxedo"){
    ellipse(c,cx+1.5,cy+4.3,6.6,5.2,rgba(a.accent,.9));
  }else if(a.markings==="patched"){
    ellipse(c,cx-5.2,cy-1.4,4.8,5.4,rgba(a.accent,.68),-.3);
  }
  drawFace(c,a,p,cx,cy,m);
  if(p.party){
    path(c,"#e8574f",()=>{c.moveTo(cx-5,cy-9);c.lineTo(cx,cy-25);c.lineTo(cx+5,cy-9);});
    path(c,"#ffd76e",()=>{c.moveTo(cx-2.2,cy-15);c.lineTo(cx,cy-25);c.lineTo(cx+2.2,cy-15);});
    ellipse(c,cx,cy-26,2,2,"#ffd76e");
  }
  c.restore();
}

function drawTail(c:CanvasRenderingContext2D,a:PetAppearance,p:IllustratedCatPose,t:number,x:number,y:number,m:CatMorph):void{
  const happy=p.tailLift;
  const fast=p.tailFast?115:340;
  const sway=Math.sin(t/fast)*p.tailWagAmp*.62;
  c.strokeStyle=p.puff?shade(a.coat,1.18):shade(a.coat,.77);
  c.lineWidth=(p.puff?7.6:6.1)*m.tail;c.lineCap="round";c.lineJoin="round";
  c.beginPath();c.moveTo(x,y);
  if(p.lying){
    c.bezierCurveTo(x-12,y+2,x-18,y-2,x-22+sway*.25,y-8);
  }else{
    c.bezierCurveTo(x-11,y-3-happy*3,x-18,y-12-happy*10,x-17+sway*.25,y-19-happy*13);
    c.bezierCurveTo(x-16+sway*.45,y-26-happy*10,x-8+sway,y-29-happy*6,x-4+sway,y-23-happy*4);
  }
  c.stroke();
  c.strokeStyle=rgba(a.accent,.62);c.lineWidth=2.2*m.tail;
  c.beginPath();
  if(p.lying){c.moveTo(x-17,y-4);c.lineTo(x-22+sway*.25,y-8);}else{c.moveTo(x-10+sway*.7,y-28-happy*6);c.lineTo(x-4+sway,y-23-happy*4);}
  c.stroke();
}

function drawLeg(c:CanvasRenderingContext2D,a:PetAppearance,x:number,hipY:number,floorY:number,lift:number,front:boolean):void{
  const pawY=floorY-lift;
  const dark=shade(a.coat,.72);
  c.fillStyle=front?bodyGradient(c,a,x-3,hipY,x+3,pawY):dark;
  c.beginPath();
  c.moveTo(x-3,hipY);c.quadraticCurveTo(x-3.6,(hipY+pawY)*.56,x-2.6,pawY-2.2);
  c.quadraticCurveTo(x-1,pawY+1.2,x+3.8,pawY+.4);
  c.quadraticCurveTo(x+4.2,pawY-2.2,x+2.5,pawY-3.1);
  c.lineTo(x+2.8,hipY);c.closePath();c.fill();
  ellipse(c,x+.4,pawY-.35,4.1,2.1,shade(a.accent,1.02));
  c.strokeStyle=rgba(dark,.48);c.lineWidth=.55;
  for(const dx of [-1.1,1.2]){c.beginPath();c.moveTo(x+dx,pawY-1.1);c.lineTo(x+dx*.9,pawY+.3);c.stroke();}
}

function drawGroomPaw(c:CanvasRenderingContext2D,a:PetAppearance,t:number):void{
  const sweep=Math.sin(t/180)*.5+.5;
  const dark=shade(a.coat,.72);
  c.save();
  c.translate(7,-28);
  c.rotate(-.5-sweep*.36);
  c.fillStyle=bodyGradient(c,a,-3,-1,3,-17);
  c.beginPath();
  c.moveTo(-2.8,0);c.quadraticCurveTo(-4,-7,-2.3,-15);
  c.quadraticCurveTo(0,-18,3,-15);c.quadraticCurveTo(4,-7,2.4,0);c.closePath();c.fill();
  ellipse(c,.4,-16.2,4.3,2.8,shade(a.accent,1.02),-.1);
  c.strokeStyle=rgba(dark,.45);c.lineWidth=.55;
  c.beginPath();c.moveTo(-1,-17.2);c.lineTo(-1,-15.1);c.moveTo(1.2,-17.2);c.lineTo(1.1,-15.1);c.stroke();
  c.restore();
}

function drawStandingBody(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const crouch=pose.crouch;
  const bodyY=-27+crouch*7-pose.bounce;
  const bodyH=18-crouch*3;
  const floor=0;
  drawTail(c,a,pose,t,-19*m.bodyLength,bodyY+11,m);

  const phase=pose.gait;
  const offsets=[Math.sin(phase),Math.cos(phase),Math.cos(phase),Math.sin(phase)];
  const xs=[-15,-7,9,17];
  for(let i=0;i<4;i++){
    const lift=Math.max(0,offsets[i]!)*pose.legAmp;
    drawLeg(c,a,xs[i]!,bodyY+10,floor,lift,i>=2);
  }

  c.save();
  c.translate(0,bodyY+bodyH*.5);
  c.scale(m.bodyLength,m.bodyRound);
  c.translate(0,-(bodyY+bodyH*.5));
  c.fillStyle=bodyGradient(c,a,-25,bodyY-4,25,bodyY+bodyH+5);
  c.beginPath();
  c.moveTo(-23,bodyY+7);
  c.bezierCurveTo(-21,bodyY-3,-8,bodyY-7,5,bodyY-5-pose.arch*4);
  c.bezierCurveTo(17,bodyY-5,23,bodyY+1,24,bodyY+8);
  c.bezierCurveTo(20,bodyY+16,10,bodyY+18,-5,bodyY+17);
  c.bezierCurveTo(-16,bodyY+17,-23,bodyY+14,-23,bodyY+7);
  c.closePath();c.fill();

  path(c,rgba(shade(a.coat,.63),.34),()=>{c.moveTo(-19,bodyY+12);c.bezierCurveTo(-4,bodyY+18,11,bodyY+17,21,bodyY+10);c.bezierCurveTo(13,bodyY+19,-9,bodyY+21,-19,bodyY+12);});
  ellipse(c,9,bodyY+2,13,5.3,rgba(shade(a.coat,1.18),.26),-.06);

  if(a.markings==="tabby"){
    c.strokeStyle=rgba(shade(a.coat,.5),.7);c.lineWidth=2;c.lineCap="round";
    for(let i=0;i<4;i++){const x=-12+i*7;c.beginPath();c.moveTo(x,bodyY-2);c.quadraticCurveTo(x+1,bodyY+3,x+3,bodyY+7);c.stroke();}
    c.beginPath();c.moveTo(15,bodyY+3);c.quadraticCurveTo(18,bodyY+8,17,bodyY+12);c.stroke();
  }else if(a.markings==="tuxedo"){
    ellipse(c,13,bodyY+11,9,5.2,rgba(a.accent,.92),-.08);
  }else if(a.markings==="patched"){
    ellipse(c,-9,bodyY+4,7.2,6.2,rgba(a.accent,.64),-.28);
    ellipse(c,9,bodyY+11,6,4.5,rgba(a.accent,.5),.22);
  }
  c.restore();

  const headX=22+(m.bodyLength-1)*16+pose.crouch*5+pose.headDip*7;
  const headY=bodyY+2+pose.crouch*5+pose.headDip*10+pose.headBob;
  c.save();
  if(pose.bow>0){c.translate(headX,headY);c.rotate(.24*pose.bow);c.translate(-headX,-headY);}
  drawHead(c,a,pose,headX,headY,t,m);
  c.restore();

  if(pose.pawReach>0){
    const reach=pose.pawReach*7;
    drawLeg(c,a,20,bodyY+9,-reach,0,true);
  }
  if(pose.carry){ellipse(c,headX+12,headY+8,4.1,4.1,"#d85b58");ellipse(c,headX+10.8,headY+6.8,1.4,1.4,"rgba(255,255,255,.4)");}
  if(pose.puff){
    for(let i=0;i<6;i++)path(c,shade(a.coat,1.18),()=>{const x=-17+i*7;c.moveTo(x,bodyY-3);c.lineTo(x+3,bodyY-9);c.lineTo(x+6,bodyY-3);});
  }
}

function drawSitting(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  drawTail(c,a,pose,t,-10,-13,m);
  c.fillStyle=bodyGradient(c,a,-15,-43,16,0);
  c.beginPath();c.ellipse(-3,-20,15*m.bodyRound,22*m.bodyRound,-.16,0,TAU);c.fill();
  ellipse(c,-8,-8,10,7,shade(a.coat,.73));
  ellipse(c,6,-9,8,9,rgba(a.accent,.62));
  drawLeg(c,a,3,-22,0,0,true);drawLeg(c,a,11,-22,0,0,true);
  if(a.markings==="tabby"){
    c.strokeStyle=rgba(shade(a.coat,.5),.68);c.lineWidth=2;c.lineCap="round";
    for(let i=0;i<3;i++){c.beginPath();c.moveTo(-11+i*6,-34);c.quadraticCurveTo(-8+i*6,-28,-7+i*6,-23);c.stroke();}
  }
  drawHead(c,a,pose,7,-42+pose.headBob,t,m);
  if(pose.grooming)drawGroomPaw(c,a,t);
}

function drawSleeping(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const breathe=Math.sin(t/620)*.7;
  drawTail(c,a,pose,t,-7,-7,m);
  c.fillStyle=bodyGradient(c,a,-25,-23,24,-3);
  c.beginPath();c.ellipse(-2,-10,25*m.bodyLength,(12+breathe)*m.bodyRound,-.06,0,TAU);c.fill();
  ellipse(c,7,-7,14,5.5,rgba(a.accent,.54),-.12);
  if(a.markings==="tabby"){
    c.strokeStyle=rgba(shade(a.coat,.5),.6);c.lineWidth=2;
    for(let i=0;i<4;i++){const x=-14+i*7;c.beginPath();c.moveTo(x,-20);c.quadraticCurveTo(x+2,-15,x+4,-12);c.stroke();}
  }
  const sleepy={...pose,eyeOpen:0,pupilX:0,pupilY:0};
  drawHead(c,a,sleepy,17,-13,t,m);
  ellipse(c,18,-2,9,2.9,shade(a.accent,1.03));
}

export function drawIllustratedCat(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number):void{
  const m=morphFor(p);
  c.save();
  if(pose.arch>0)c.translate(0,-2.5*pose.arch);
  if(pose.lying)drawSleeping(c,p,a,pose,t,m);
  else if(pose.sitting)drawSitting(c,p,a,pose,t,m);
  else drawStandingBody(c,p,a,pose,t,m);
  c.restore();
}