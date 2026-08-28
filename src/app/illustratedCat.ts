import type { PetAppearance, PetState } from "../core/types.js";

export interface IllustratedCatPose {
  lying:boolean;
  sitting:boolean;
  vertical:boolean;
  hanging:boolean;
  peeking:boolean;
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
  licking:boolean;
  pouncing:boolean;
  loaf:boolean;
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
    c.strokeStyle=shade(color,.3);c.lineWidth=1.15;c.lineCap="round";
    c.beginPath();c.moveTo(x-2.8,y);c.quadraticCurveTo(x,y+1.15,x+2.8,y);c.stroke();
    return;
  }
  const h=2.9*open;
  const iris=c.createRadialGradient(x-.75,y-.8,.25,x,y,3.2);
  iris.addColorStop(0,shade(color,1.32));iris.addColorStop(.58,color);iris.addColorStop(1,shade(color,.68));
  c.fillStyle=iris;c.beginPath();c.ellipse(x,y,2.75,h,0,0,TAU);c.fill();
  c.fillStyle="#17171c";c.beginPath();c.ellipse(x+clamp(gx,-1,1)*.72,y+clamp(gy,-1,1)*.42,far?.42:.5,h*.82,0,0,TAU);c.fill();
  ellipse(c,x-.8,y-.9,far?.42:.52,.52,"rgba(255,255,255,.96)");
  ellipse(c,x+.5,y+.65,.23,.23,"rgba(255,255,255,.42)");
  c.strokeStyle="rgba(24,22,25,.45)";c.lineWidth=.65;c.beginPath();c.ellipse(x,y,2.8,h,0,0,TAU);c.stroke();
  c.strokeStyle="rgba(20,18,22,.28)";c.lineWidth=.7;c.beginPath();c.moveTo(x-2.5,y-h*.58);c.quadraticCurveTo(x,y-h*1.12,x+2.45,y-h*.52);c.stroke();
}

function drawFace(c:CanvasRenderingContext2D,a:PetAppearance,p:IllustratedCatPose,cx:number,cy:number,m:CatMorph,t:number):void{
  const accent=shade(a.accent,1.03);
  const dark=shade(a.coat,.48);
  ellipse(c,cx+4.0,cy+3.4,6.15*m.muzzle,4.45*m.muzzle,rgba(accent,.94));
  ellipse(c,cx-1.35,cy+4.15,4.7*m.muzzle,3.85*m.muzzle,rgba(accent,.6));
  drawEye(c,cx-4.0,cy-1.7,p.eyeOpen,p.pupilX,p.pupilY,a.eye,true);
  drawEye(c,cx+3.5,cy-1.5,p.eyeOpen,p.pupilX,p.pupilY,a.eye,false);
  path(c,"#a65f68",()=>{c.moveTo(cx+7.9,cy+1.8);c.quadraticCurveTo(cx+10.3,cy+1.6,cx+11.1,cy+3.1);c.quadraticCurveTo(cx+9.3,cy+4.8,cx+7.8,cy+4.3);});
  c.strokeStyle=dark;c.lineWidth=.75;c.lineCap="round";
  c.beginPath();c.moveTo(cx+9.2,cy+4.5);c.lineTo(cx+9.0,cy+5.6);c.quadraticCurveTo(cx+7.7,cy+6.7,cx+5.8,cy+6.25);c.stroke();
  c.beginPath();c.moveTo(cx+9.0,cy+5.6);c.quadraticCurveTo(cx+10.2,cy+6.7,cx+11.2,cy+6.0);c.stroke();
  const whiskerDots:Array<[number,number]>=[[3.7,3.9],[5.1,4.8],[3.4,5.5]];
  for(const [dx,dy] of whiskerDots)ellipse(c,cx+dx,cy+dy,.48,.48,rgba(dark,.52));
  if(p.licking&&Math.sin(t/145)>.15){ellipse(c,cx+8.2,cy+7.35,2.15,1.45,"#d98791",.12);ellipse(c,cx+8.6,cy+6.9,.7,.45,"rgba(255,220,226,.72)");}
  c.strokeStyle="rgba(255,255,255,.48)";c.lineWidth=.65;
  for(const dy of [-.8,1.15,3.05]){c.beginPath();c.moveTo(cx+7.0,cy+4.25+dy);c.quadraticCurveTo(cx+14.2,cy+3.2+dy,cx+18.4,cy+4.8+dy);c.stroke();}
  path(c,rgba(shade(a.coat,1.16),.38),()=>{c.moveTo(cx-10.5,cy+4);c.lineTo(cx-13.2,cy+6.2);c.lineTo(cx-9.8,cy+6.1);c.lineTo(cx-12,cy+8.1);c.lineTo(cx-7.7,cy+6.6);});
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
    c.strokeStyle="rgba(255,255,255,.22)";c.lineWidth=.55;c.lineCap="round";
    c.beginPath();c.moveTo(2.1,1);c.lineTo(3.5,-3.8);c.moveTo(3.9,.8);c.lineTo(4.8,-2.1);c.stroke();
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
  drawFace(c,a,p,cx,cy,m,t);
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
  if(p.lying){c.bezierCurveTo(x-12,y+2,x-18,y-2,x-22+sway*.25,y-8);}
  else{c.bezierCurveTo(x-11,y-3-happy*3,x-18,y-12-happy*10,x-17+sway*.25,y-19-happy*13);c.bezierCurveTo(x-16+sway*.45,y-26-happy*10,x-8+sway,y-29-happy*6,x-4+sway,y-23-happy*4);}
  c.stroke();
  c.strokeStyle=rgba(a.accent,.62);c.lineWidth=2.2*m.tail;c.beginPath();
  if(p.lying){c.moveTo(x-17,y-4);c.lineTo(x-22+sway*.25,y-8);}else{c.moveTo(x-10+sway*.7,y-28-happy*6);c.lineTo(x-4+sway,y-23-happy*4);}c.stroke();
}

function drawLeg(c:CanvasRenderingContext2D,a:PetAppearance,x:number,hipY:number,floorY:number,lift:number,front:boolean):void{
  const pawY=floorY-lift;
  const dark=shade(a.coat,.72);
  c.fillStyle=front?bodyGradient(c,a,x-3,hipY,x+3,pawY):dark;
  c.beginPath();c.moveTo(x-3,hipY);c.quadraticCurveTo(x-3.6,(hipY+pawY)*.56,x-2.6,pawY-2.2);c.quadraticCurveTo(x-1,pawY+1.2,x+3.8,pawY+.4);c.quadraticCurveTo(x+4.2,pawY-2.2,x+2.5,pawY-3.1);c.lineTo(x+2.8,hipY);c.closePath();c.fill();
  ellipse(c,x+.4,pawY-.35,4.1,2.1,shade(a.accent,1.02));
  c.strokeStyle=rgba(dark,.48);c.lineWidth=.55;for(const dx of [-1.1,1.2]){c.beginPath();c.moveTo(x+dx,pawY-1.1);c.lineTo(x+dx*.9,pawY+.3);c.stroke();}
}

function drawGroomPaw(c:CanvasRenderingContext2D,a:PetAppearance,t:number):void{
  const sweep=Math.sin(t/180)*.5+.5;
  const dark=shade(a.coat,.72);
  c.save();c.translate(7,-28);c.rotate(-.5-sweep*.36);
  c.fillStyle=bodyGradient(c,a,-3,-1,3,-17);c.beginPath();c.moveTo(-2.8,0);c.quadraticCurveTo(-4,-7,-2.3,-15);c.quadraticCurveTo(0,-18,3,-15);c.quadraticCurveTo(4,-7,2.4,0);c.closePath();c.fill();
  ellipse(c,.4,-16.2,4.3,2.8,shade(a.accent,1.02),-.1);c.strokeStyle=rgba(dark,.45);c.lineWidth=.55;c.beginPath();c.moveTo(-1,-17.2);c.lineTo(-1,-15.1);c.moveTo(1.2,-17.2);c.lineTo(1.1,-15.1);c.stroke();c.restore();
}

function drawStandingBody(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const crouch=pose.crouch;
  const bodyY=-27+crouch*7-pose.bounce;
  const bodyH=18-crouch*3+Math.sin(t/900)*.22;
  const floor=0;
  drawTail(c,a,pose,t,-19*m.bodyLength,bodyY+11,m);
  const phase=pose.gait;
  const offsets=[Math.sin(phase),Math.cos(phase),Math.cos(phase),Math.sin(phase)];
  const xs=[-15,-7,9,17];
  for(let i=0;i<4;i++){const lift=Math.max(0,offsets[i]!)*pose.legAmp;drawLeg(c,a,xs[i]!,bodyY+10,floor,lift,i>=2);}
  c.save();c.translate(0,bodyY+bodyH*.5);c.scale(m.bodyLength,m.bodyRound);c.translate(0,-(bodyY+bodyH*.5));
  c.fillStyle=bodyGradient(c,a,-25,bodyY-4,25,bodyY+bodyH+5);c.beginPath();c.moveTo(-23,bodyY+7);c.bezierCurveTo(-21,bodyY-3,-8,bodyY-7,5,bodyY-5-pose.arch*4);c.bezierCurveTo(17,bodyY-5,23,bodyY+1,24,bodyY+8);c.bezierCurveTo(20,bodyY+16,10,bodyY+18,-5,bodyY+17);c.bezierCurveTo(-16,bodyY+17,-23,bodyY+14,-23,bodyY+7);c.closePath();c.fill();
  path(c,rgba(shade(a.coat,.63),.34),()=>{c.moveTo(-19,bodyY+12);c.bezierCurveTo(-4,bodyY+18,11,bodyY+17,21,bodyY+10);c.bezierCurveTo(13,bodyY+19,-9,bodyY+21,-19,bodyY+12);});ellipse(c,9,bodyY+2,13,5.3,rgba(shade(a.coat,1.18),.26),-.06);
  if(a.markings==="tabby"){c.strokeStyle=rgba(shade(a.coat,.5),.7);c.lineWidth=2;c.lineCap="round";for(let i=0;i<4;i++){const x=-12+i*7;c.beginPath();c.moveTo(x,bodyY-2);c.quadraticCurveTo(x+1,bodyY+3,x+3,bodyY+7);c.stroke();}c.beginPath();c.moveTo(15,bodyY+3);c.quadraticCurveTo(18,bodyY+8,17,bodyY+12);c.stroke();}
  else if(a.markings==="tuxedo"){ellipse(c,13,bodyY+11,9,5.2,rgba(a.accent,.92),-.08);}
  else if(a.markings==="patched"){ellipse(c,-9,bodyY+4,7.2,6.2,rgba(a.accent,.64),-.28);ellipse(c,9,bodyY+11,6,4.5,rgba(a.accent,.5),.22);}c.restore();
  const headX=22+(m.bodyLength-1)*16+pose.crouch*5+pose.headDip*7;
  const headY=bodyY+2+pose.crouch*5+pose.headDip*10+pose.headBob;
  c.save();if(pose.bow>0){c.translate(headX,headY);c.rotate(.24*pose.bow);c.translate(-headX,-headY);}drawHead(c,a,pose,headX,headY,t,m);c.restore();
  if(pose.pawReach>0){const reach=pose.pawReach*7;drawLeg(c,a,20,bodyY+9,-reach,0,true);}
  if(pose.carry){ellipse(c,headX+12,headY+8,4.1,4.1,"#d85b58");ellipse(c,headX+10.8,headY+6.8,1.4,1.4,"rgba(255,255,255,.4)");}
  if(pose.puff){for(let i=0;i<6;i++)path(c,shade(a.coat,1.18),()=>{const x=-17+i*7;c.moveTo(x,bodyY-3);c.lineTo(x+3,bodyY-9);c.lineTo(x+6,bodyY-3);});}
}

function drawSitting(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  drawTail(c,a,pose,t,-10,-13,m);c.fillStyle=bodyGradient(c,a,-15,-43,16,0);c.beginPath();c.ellipse(-3,-20,15*m.bodyRound,22*m.bodyRound,-.16,0,TAU);c.fill();ellipse(c,-8,-8,10,7,shade(a.coat,.73));ellipse(c,6,-9,8,9,rgba(a.accent,.62));drawLeg(c,a,3,-22,0,0,true);drawLeg(c,a,11,-22,0,0,true);
  if(a.markings==="tabby"){c.strokeStyle=rgba(shade(a.coat,.5),.68);c.lineWidth=2;c.lineCap="round";for(let i=0;i<3;i++){c.beginPath();c.moveTo(-11+i*6,-34);c.quadraticCurveTo(-8+i*6,-28,-7+i*6,-23);c.stroke();}}
  drawHead(c,a,pose,7,-42+pose.headBob,t,m);if(pose.grooming)drawGroomPaw(c,a,t);
}

function drawSleeping(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const breathe=Math.sin(t/620)*.7;drawTail(c,a,pose,t,-7,-7,m);c.fillStyle=bodyGradient(c,a,-25,-23,24,-3);c.beginPath();c.ellipse(-2,-10,25*m.bodyLength,(12+breathe)*m.bodyRound,-.06,0,TAU);c.fill();ellipse(c,7,-7,14,5.5,rgba(a.accent,.54),-.12);
  if(a.markings==="tabby"){c.strokeStyle=rgba(shade(a.coat,.5),.6);c.lineWidth=2;for(let i=0;i<4;i++){const x=-14+i*7;c.beginPath();c.moveTo(x,-20);c.quadraticCurveTo(x+2,-15,x+4,-12);c.stroke();}}
  const sleepy={...pose,eyeOpen:0,pupilX:0,pupilY:0};drawHead(c,a,sleepy,17,-13,t,m);ellipse(c,18,-2,9,2.9,shade(a.accent,1.03));
}

function drawPeeking(c:CanvasRenderingContext2D,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const bob=Math.sin(t/650)*.8;drawHead(c,a,pose,0,-10+bob,t,m);ellipse(c,-7,-.8,4.6,2.5,shade(a.accent,1.02));ellipse(c,7,-.8,4.6,2.5,shade(a.accent,1.02));c.strokeStyle=rgba(shade(a.coat,.55),.38);c.lineWidth=.55;for(const x of [-8.2,-6.3,5.8,7.8]){c.beginPath();c.moveTo(x,-1.8);c.lineTo(x,-.2);c.stroke();}
}

function drawHanging(c:CanvasRenderingContext2D,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const sway=Math.sin(t/520)*1.2;c.save();c.translate(sway,0);c.strokeStyle=shade(a.coat,.76);c.lineWidth=5.8*m.tail;c.lineCap="round";c.beginPath();c.moveTo(-3,31);c.bezierCurveTo(-10,38,-8,48,-15,53);c.stroke();c.fillStyle=bodyGradient(c,a,-9,1,9,38);c.beginPath();c.moveTo(-7,0);c.quadraticCurveTo(-10,14,-8,30);c.quadraticCurveTo(-5,39,4,38);c.quadraticCurveTo(10,28,8,1);c.lineTo(7,0);c.closePath();c.fill();
  if(a.markings==="tabby"){c.strokeStyle=rgba(shade(a.coat,.5),.6);c.lineWidth=1.7;c.lineCap="round";for(const y of [13,20,27]){c.beginPath();c.moveTo(-7,y);c.quadraticCurveTo(-2,y+2,2,y+1);c.stroke();}}
  else if(a.markings==="tuxedo"){ellipse(c,2,27,5.2,8.2,rgba(a.accent,.86));}
  drawHead(c,a,{...pose,pupilY:.65},1,9,t,m);ellipse(c,-6,-.5,4.5,2.7,shade(a.accent,1.02));ellipse(c,6,-.5,4.5,2.7,shade(a.accent,1.02));c.restore();
}

function drawLoaf(c:CanvasRenderingContext2D,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const breathe=Math.sin(t/860)*.45,dark=shade(a.coat,.7);c.save();c.translate(0,-1);c.strokeStyle=shade(a.coat,.76);c.lineWidth=5.6*m.tail;c.lineCap="round";c.beginPath();c.moveTo(-18,-6);c.bezierCurveTo(-27,-3,-28,4,-18,5);c.bezierCurveTo(-8,6,4,4,10,1);c.stroke();c.fillStyle=bodyGradient(c,a,-24,-28,23,1);c.beginPath();c.ellipse(-2,-11,23*m.bodyLength,(12+breathe)*m.bodyRound,-.03,0,TAU);c.fill();path(c,rgba(dark,.25),()=>{c.moveTo(-18,-5);c.quadraticCurveTo(-1,1,17,-5);c.quadraticCurveTo(7,3,-10,2);});ellipse(c,6,-17,13,4.3,rgba(shade(a.coat,1.18),.22),-.04);
  if(a.markings==="tabby"){c.strokeStyle=rgba(shade(a.coat,.5),.62);c.lineWidth=1.8;c.lineCap="round";for(let i=0;i<4;i++){const x=-13+i*7;c.beginPath();c.moveTo(x,-21);c.quadraticCurveTo(x+2,-16,x+4,-12);c.stroke();}}
  else if(a.markings==="tuxedo"){ellipse(c,9,-5,10,4.3,rgba(a.accent,.86),-.05);}
  else if(a.markings==="patched"){ellipse(c,-8,-13,7,5.2,rgba(a.accent,.56),-.2);}
  ellipse(c,8,-2.7,7.2,2.5,shade(a.accent,1.02));c.strokeStyle=rgba(dark,.32);c.lineWidth=.55;for(const x of [5.7,8,10.2]){c.beginPath();c.moveTo(x,-3.8);c.lineTo(x,-2);c.stroke();}const calm={...pose,headBob:Math.sin(t/1700)*.35};drawHead(c,a,calm,15,-20+calm.headBob,t,m);c.restore();
}

function drawAirbornePounce(c:CanvasRenderingContext2D,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const dark=shade(a.coat,.7);c.save();c.translate(1,-10);c.rotate(-.055);c.strokeStyle=shade(a.coat,.76);c.lineWidth=5.8*m.tail;c.lineCap="round";c.lineJoin="round";c.beginPath();c.moveTo(-23,-8);c.bezierCurveTo(-34,-12,-42,-8,-48,-13);c.stroke();c.strokeStyle=rgba(a.accent,.55);c.lineWidth=1.9*m.tail;c.beginPath();c.moveTo(-39,-9.5);c.lineTo(-48,-13);c.stroke();c.fillStyle=bodyGradient(c,a,-27,-23,27,-3);c.beginPath();c.ellipse(0,-12,27*m.bodyLength,10.5*m.bodyRound,-.03,0,TAU);c.fill();ellipse(c,7,-16,15,4.4,rgba(shade(a.coat,1.18),.24),-.04);path(c,rgba(dark,.28),()=>{c.moveTo(-20,-8);c.quadraticCurveTo(-2,-1,20,-7);c.quadraticCurveTo(4,1,-13,-2);});
  if(a.markings==="tabby"){c.strokeStyle=rgba(shade(a.coat,.5),.68);c.lineWidth=1.9;c.lineCap="round";for(let i=0;i<4;i++){const x=-13+i*7;c.beginPath();c.moveTo(x,-21);c.quadraticCurveTo(x+2,-16,x+4,-12);c.stroke();}}
  else if(a.markings==="tuxedo"){ellipse(c,10,-6,10,4.7,rgba(a.accent,.88),-.08);}
  else if(a.markings==="patched"){ellipse(c,-8,-14,7,5.3,rgba(a.accent,.58),-.18);}
  const limb=(x1:number,y1:number,x2:number,y2:number,front:boolean)=>{c.strokeStyle=front?a.coat:dark;c.lineWidth=5.2;c.lineCap="round";c.beginPath();c.moveTo(x1,y1);c.quadraticCurveTo((x1+x2)*.5,y1+1,x2,y2);c.stroke();ellipse(c,x2+1,y2,4.1,2.2,shade(a.accent,1.02),.08);};limb(16,-10,38,-5,true);limb(13,-15,34,-12,true);limb(-17,-7,-32,-1,false);limb(-20,-14,-34,-9,false);const focused={...pose,eyeOpen:1,pupilX:.72,pupilY:.05,earBack:.08};drawHead(c,a,focused,24,-17,t,m);c.restore();
}

export function drawIllustratedCat(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number):void{
  const m=morphFor(p);c.save();if(pose.arch>0)c.translate(0,-2.5*pose.arch);if(pose.pouncing&&!p.body.grounded)drawAirbornePounce(c,a,pose,t,m);else if(pose.loaf)drawLoaf(c,a,pose,t,m);else if(pose.peeking)drawPeeking(c,a,pose,t,m);else if(pose.hanging)drawHanging(c,a,pose,t,m);else if(pose.vertical){c.rotate(-Math.PI/2);drawStandingBody(c,p,a,pose,t,m);}else if(pose.lying)drawSleeping(c,p,a,pose,t,m);else if(pose.sitting)drawSitting(c,p,a,pose,t,m);else drawStandingBody(c,p,a,pose,t,m);c.restore();
}
