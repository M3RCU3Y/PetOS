import { SPECIES } from "../core/species.js";
import { isAdoptionAnniversary } from "../core/pet.js";
import type { WeatherKind } from "../core/weather.js";
import type { Behavior, PetAppearance, PetState, Rect, SheetAnimation, Species, SpriteSheet, Vec2, WorldObject } from "../core/types.js";

export interface RenderScene { pets:PetState[]; appearances:Map<string,PetAppearance>; objects:WorldObject[]; debug:boolean; decisions:Record<string,{behavior:string;reason:string;score:number}>; virtualBounds:Rect; cursor?:Vec2; weather?:WeatherKind; reducedMotion?:boolean; }

interface Pose {
  lying:boolean; sitting:boolean; vertical:boolean; hanging:boolean; peeking:boolean;
  crouch:number; bow:number; arch:number; headDip:number; headBob:number;
  eyeOpen:number; pupilX:number; pupilY:number; earBack:number; earTwitch:number;
  tailLift:number; tailWagAmp:number; tailFast:boolean;
  gait:number; legAmp:number; bounce:number; flap:number; preen:boolean;
  zzz:boolean; speedLines:boolean; puff:boolean; carry:boolean; pawReach:number;
  party?:boolean;
}

interface MammalShape {
  bodyLen:number; bodyH:number; legH:number; legW:number; headR:number; headX:number;
  ear:"point"|"floppy"|"tall"; tail:"curve"|"stick"|"puff"; snout:number;
}

const SHAPES:Record<string,MammalShape> = {
  cat:{bodyLen:40,bodyH:24,legH:13,legW:5,headR:13,headX:21,ear:"point",tail:"curve",snout:4},
  dog:{bodyLen:46,bodyH:26,legH:14,legW:6,headR:13,headX:23,ear:"floppy",tail:"stick",snout:8},
  rabbit:{bodyLen:34,bodyH:20,legH:10,legW:5,headR:11,headX:15,ear:"tall",tail:"puff",snout:2}
};

const TAU = Math.PI*2;

function shade(hex:string,f:number):string{
  const n=parseInt(hex.slice(1),16);
  const ch=(v:number)=>Math.round(Math.max(0,Math.min(255,v*f)));
  return `#${[ch((n>>16)&255),ch((n>>8)&255),ch(n&255)].map(v=>v.toString(16).padStart(2,"0")).join("")}`;
}
function hash01(id:string):number{let h=2166136261;for(const c of id){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;}

/* ---------- pose ---------- */

function computePose(p:PetState,t:number,phase:number,cursor?:Vec2,reducedMotion=false):Pose{
  const b=p.behavior;
  const speed=Math.abs(p.body.velocity.x);
  const fast=speed>110,walking=speed>8&&!fast;
  const airborne=!p.body.grounded;
  const sleeping=b==="sleep"||b==="cuddle";
  const motionScale=reducedMotion?.4:1;

  let eyeOpen=sleeping?0:((t/3400+phase/997)%1)>.96?.08:1;
  if(b==="startle")eyeOpen=1;
  if(b==="hide")eyeOpen=Math.min(eyeOpen,.55);

  let pupilX=0,pupilY=0;
  if(!sleeping){
    if(b==="idle"||b==="sit"||b==="perch"){pupilX=Math.sin(t/2300+phase)*.6;pupilY=Math.sin(t/3100+phase*2)*.2;}
    else if(b==="peek"){pupilX=Math.sin(t/900+phase)>.4?.9:-.9;}
    else if(b!=="walk"&&cursor){
      const dx=cursor.x-p.body.position.x,dy=cursor.y-(p.body.position.y-SPECIES[p.species].movement.bodyHeight);
      const d=Math.hypot(dx,dy)||1;
      if(d<340){pupilX=Math.max(-1,Math.min(1,dx/240));pupilY=Math.max(-1,Math.min(1,dy/240));}
    }
  }

  const earTwitch=((t/2900+phase/777)%1)<.05?2:0;
  const happy=["play_pet","play_fight","play_toy","greet_pet","zoomies","seek_user","carry_toy"].includes(b);
  const scared=b==="startle"||p.affect.stress>.6;

  return{
    lying:sleeping,
    sitting:b==="sit",
    vertical:b==="climb",
    hanging:b==="hang",
    peeking:b==="peek",
    crouch:b==="stalk"?.85:b==="hide"?.9:(b==="pounce"&&p.body.grounded)?1:b==="investigate"?.25:0,
    bow:["stretch","play_pet","play_fight"].includes(b)?1:b==="greet_pet"?.55:0,
    arch:b==="startle"?1:(scared&&b==="idle"?.3:0),
    headDip:(b==="eat"||b==="drink")?.9:(b==="investigate"&&p.body.grounded?.5:0),
    headBob:(b==="eat"||b==="drink")?Math.sin(t/170)*2*Math.min(1,speed<8?1:.3):b==="groom"?Math.sin(t/150)*2.5:0,
    eyeOpen,pupilX,pupilY,
    earBack:scared?1:(p.affect.stress>.35?.5:0),
    earTwitch,
    tailLift:happy?1:scared?-1:.3,
    tailWagAmp:happy?8:p.affect.valence>.35?5:3,
    tailFast:happy||p.affect.arousal>.7,
    gait:(t+phase)/(fast?80:140),
    legAmp:airborne?0:(fast?4:walking?3:0)*motionScale,
    bounce:airborne?0:Math.abs(Math.sin((fast?t/80:t/140)+phase))*(fast?2.5:walking?1.8:0)*motionScale,
    flap:p.species==="bird"?(airborne?Math.sin(t/70)*motionScale:(b==="zoomies"?Math.sin(t/160)*.5:Math.sin(t/300)*.15)):0,
    preen:b==="groom"&&p.species==="bird"&&Math.sin(t/700)>.3,
    zzz:sleeping,
    speedLines:reducedMotion?false:(fast&&!airborne&&(b==="zoomies"||speed>150)),
    puff:b==="startle",
    carry:b==="carry_toy",
    pawReach:b==="play_toy"?(p.body.grounded?Math.sin(t/110):0):(b==="scratch"?(Math.sin(t/90)*.5+.5):0)
  };
}

/* ---------- sprite sheets ---------- */

const ANIM_ALIAS:Record<string,string[]>={
  run:["walk"],zoomies:["run","play","walk"],chase_cursor:["chase","run","walk"],stalk:["stalk","walk"],
  pounce:["pounce","jump","idle"],jump:["jump","idle"],sleep:["lie","idle"],cuddle:["sleep","lie","idle"],
  sit:["idle"],perch:["sit","idle"],eat:["eat","drink","idle"],drink:["drink","eat","idle"],
  groom:["groom","idle"],scratch:["groom","idle"],stretch:["stretch","wake","idle"],
  startle:["startle","alert","idle"],climb:["climb","walk"],hang:["hang","climb","idle"],peek:["peek","idle"],
  hide:["hide","sleep","sit","idle"],investigate:["sniff","investigate","walk"],seek_user:["walk"],
  follow_pet:["walk"],carry_toy:["carry","walk"],play_toy:["play","idle"],play_pet:["play","run","walk"],
  play_fight:["play","fight","run","walk"],greet_pet:["greet","play","idle"],idle:[],walk:[]
};

/** Behaviors resolve to a sheet animation directly, through aliases, or to the default row. */
export function resolveSheetAnimation(sheet:SpriteSheet,behavior:string):{key:string;anim:SheetAnimation}{
  const direct=sheet.animations[behavior];
  if(direct)return{key:behavior,anim:direct};
  for(const key of ANIM_ALIAS[behavior]??[]){
    const anim=sheet.animations[key];
    if(anim)return{key,anim};
  }
  return{key:"default",anim:sheet.default};
}

const sheetCache=new Map<string,HTMLImageElement>();

/** Kick off an async load for a sheet image; drawing silently falls back until ready. */
export function preloadSheet(src:string):void{
  if(sheetCache.has(src))return;
  const img=new Image();
  img.src=src;
  sheetCache.set(src,img);
}

/* ---------- shared painters ---------- */

function rr(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,rad:number):void{
  const r=Math.min(rad,w/2,h/2);
  c.beginPath();
  c.moveTo(x+r,y);
  c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);
  c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);
  c.closePath();c.fill();
}
function tri(c:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number,x3:number,y3:number,color:string):void{
  c.fillStyle=color;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineTo(x3,y3);c.closePath();c.fill();
}

function drawMarkings(c:CanvasRenderingContext2D,a:PetAppearance,m:MammalShape,x:number,y:number,w:number,h:number):void{
  if(a.markings==="tuxedo"){
    c.fillStyle=a.accent;
    c.beginPath();c.ellipse(x+w*.72,y+h*.72,w*.16,h*.42,0,0,TAU);c.fill();
  }else if(a.markings==="tabby"){
    c.fillStyle=shade(a.coat,.7);
    for(let i=0;i<3;i++)c.fillRect(x+w*(.22+i*.22)-2,y+1,4,h*.45);
  }else if(a.markings==="patched"){
    c.fillStyle=a.accent;
    c.beginPath();c.ellipse(x+w*.25,y+h*.35,w*.14,h*.3,-.3,0,TAU);c.fill();
    c.beginPath();c.ellipse(x+w*.62,y+h*.55,w*.11,h*.26,.25,0,TAU);c.fill();
  }
}

function ears(c:CanvasRenderingContext2D,a:PetAppearance,m:MammalShape,x:number,y:number,pose:Pose,t:number):void{
  const coat=a.coat,inner=a.accent,flat=pose.earBack;
  const tw=pose.earTwitch*Math.sin(t/60)>0?pose.earTwitch:0;
  if(m.ear==="point"){
    c.save();c.translate(x+4,y+7);c.rotate(-.14-flat*.5);c.translate(-(x+4),-(y+7));
    tri(c,x,y+7,x+4,y-6-tw,x+9,y+5,coat);
    tri(c,x+2,y+4,x+4.4,y-1-tw,x+7,y+3,inner);
    c.restore();
    c.save();c.translate(x+13,y+7);c.rotate(.14+flat*.5);c.translate(-(x+13),-(y+7));
    tri(c,x+9,y+6,x+15,y-5-tw,x+19,y+7,coat);
    tri(c,x+11,y+3,x+14.4,y-tw,x+17,y+4,inner);
    c.restore();
  }else if(m.ear==="floppy"){
    const flop=shade(a.coat,.82);
    c.save();c.translate(x+2,y+5);c.rotate(-.08-flat*.95);
    c.fillStyle=flop;rr(c,-2,-2,6,13,3);
    c.restore();
    c.save();c.translate(x+15,y+5);c.rotate(.08+flat*.95);
    c.fillStyle=flop;rr(c,9,-2,6,13,3);
    c.restore();
  }else{
    c.save();c.translate(x+3,y+8);c.rotate(-.1-flat*.75);
    c.fillStyle=coat;rr(c,x-1,y-17-tw,6,25,3);
    c.fillStyle=inner;rr(c,x+.5,y-14-tw,3.2,18,1.8);
    c.restore();
    c.save();c.translate(x+14,y+8);c.rotate(.1+flat*.75);
    c.fillStyle=coat;rr(c,x+11,y-18-tw,6,26,3);
    c.fillStyle=inner;rr(c,x+12.5,y-15-tw,3.2,19,1.8);
    c.restore();
  }
}

function face(c:CanvasRenderingContext2D,a:PetAppearance,m:MammalShape,pose:Pose,cx:number,cy:number):void{
  const eyeY=cy-1,ex1=cx-m.headR*.44,ex2=cx+m.headR*.3;
  eyeAt(c,ex1,eyeY,3.2,pose.eyeOpen,pose.pupilX,pose.pupilY,a.eye);
  eyeAt(c,ex2,eyeY,3.2,pose.eyeOpen,pose.pupilX,pose.pupilY,a.eye);
  c.fillStyle="#4a342a";
  c.beginPath();c.arc(cx+m.headR*.58,cy+2,1.9,0,TAU);c.fill();
  if(m.snout>3){
    c.fillStyle=a.accent;
    c.beginPath();c.ellipse(cx+m.headR*.52,cy+3.6,m.snout*.8,2.7,0,0,TAU);c.fill();
  }
  if(pose.eyeOpen>.2&&m.snout<=4){
    c.strokeStyle="rgba(255,255,255,.4)";c.lineWidth=.8;
    c.beginPath();
    c.moveTo(cx-m.headR*.05,cy+4);c.lineTo(cx-m.headR*.55,cy+5.5);
    c.moveTo(cx-m.headR*.05,cy+5.5);c.lineTo(cx-m.headR*.6,cy+8);
    c.stroke();
  }
}

function eyeAt(c:CanvasRenderingContext2D,x:number,y:number,r:number,open:number,px:number,py:number,color:string):void{
  if(open<.15){
    c.strokeStyle="#20242e";c.lineWidth=1.4;
    c.beginPath();c.moveTo(x-r,y);c.lineTo(x+r,y);c.stroke();
    return;
  }
  const h=r*open;
  c.fillStyle=color;
  c.beginPath();c.ellipse(x,y,r*.85,h,0,0,TAU);c.fill();
  c.fillStyle="#171a22";
  c.beginPath();c.ellipse(x+px*r*.4,y+py*h*.4,r*.42,h*.72,0,0,TAU);c.fill();
  c.fillStyle="rgba(255,255,255,.9)";
  c.beginPath();c.arc(x-r*.3-r*.15*px,y-h*.3,Math.max(.8,r*.24),0,TAU);c.fill();
}

function tailDraw(c:CanvasRenderingContext2D,a:PetAppearance,pose:Pose,m:MammalShape,t:number,base:Vec2,hanging:boolean):void{
  const coat=a.coat;
  if(m.tail==="puff"){
    c.fillStyle=a.accent;
    c.beginPath();c.arc(base.x-3,base.y-3,4.5,0,TAU);c.fill();
    return;
  }
  if(m.tail==="stick"){
    const wag=Math.sin(t/(pose.tailFast?110:300))*(pose.tailFast?1:.45);
    c.strokeStyle=coat;c.lineWidth=4.5;c.lineCap="round";
    const up=pose.lying?-2:(pose.tailLift>=0?-14:-5);
    const tip={x:base.x-13+wag*5,y:base.y+up};
    c.beginPath();c.moveTo(base.x,base.y);
    c.quadraticCurveTo(base.x-8,base.y+up*.4,tip.x,tip.y);
    c.stroke();
    c.fillStyle=a.accent;c.beginPath();c.arc(tip.x,tip.y,3,0,TAU);c.fill();
    return;
  }
  const sway=Math.sin(t/(pose.tailFast?170:380))*(pose.tailFast?7:4);
  const lift=pose.tailLift;
  const endY=hanging?base.y+10:base.y-20-lift*16;
  c.strokeStyle=pose.puff?shade(a.coat,1.3):coat;
  c.lineWidth=pose.puff?7:5;c.lineCap="round";
  c.beginPath();c.moveTo(base.x,base.y);
  c.quadraticCurveTo(base.x-10,base.y-6-lift*4,base.x-16-sway*.4,base.y-10-lift*8+(hanging?12:0));
  c.quadraticCurveTo(base.x-20,base.y-16-lift*10+(hanging?16:0),base.x-14-sway,endY);
  c.stroke();
  c.fillStyle=a.accent;c.beginPath();c.arc(base.x-14-sway,endY,2.6,0,TAU);c.fill();
}

function mammalHeadPos(pose:Pose,m:MammalShape,yTop:number):Vec2{
  if(pose.lying)return{x:-m.bodyLen*.42,y:-m.legH-m.bodyH*.3};
  if(pose.sitting)return{x:m.bodyLen*.26,y:yTop-m.bodyH*.05};
  let x=m.headX*.8+pose.crouch*7,y=yTop+m.headR*.3+pose.crouch*11;
  if(pose.headDip>0){x+=pose.headDip*8;y+=pose.headDip*(m.bodyH*.55);}
  return{x,y};
}

function drawMammal(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:Pose,t:number,m:MammalShape):void{
  const coat=a.coat,dark=shade(a.coat,.72);

  if(pose.peeking){
    const bob=Math.sin(t/600)*1.5;
    ears(c,a,m,-m.headR*.62,-m.headR-6+bob,pose,t);
    c.fillStyle=coat;c.beginPath();c.arc(0,-7+bob,m.headR,0,TAU);c.fill();
    face(c,a,m,{...pose,pupilX:Math.sign(p.body.facing)*.9},0,-7+bob);
    c.fillStyle=a.accent;
    c.beginPath();c.ellipse(-m.headR*.32,0,3.5,2.5,0,0,TAU);c.ellipse(m.headR*.3,0,3.5,2.5,0,0,TAU);c.fill();
    return;
  }
  if(pose.hanging){
    c.rotate(Math.sin(t/480)*.09);
    c.fillStyle=coat;
    c.beginPath();c.ellipse(-3.5,0,3.5,3,0,0,TAU);c.ellipse(3.5,0,3.5,3,0,0,TAU);c.fill();
    tailDraw(c,a,pose,m,t,{x:-3,y:m.bodyLen*.42},true);
    c.beginPath();c.moveTo(-6,0);c.quadraticCurveTo(-9,m.bodyLen*.4,-5,m.bodyLen*.78);
    c.lineTo(m.bodyLen*.14,m.bodyLen*.78);c.quadraticCurveTo(m.bodyLen*.26,m.bodyLen*.35,7,0);c.closePath();c.fill();
    c.fillStyle=coat;c.beginPath();c.arc(2,-m.headR*.35,m.headR*.92,0,TAU);c.fill();
    ears(c,a,m,-m.headR*.55,-m.headR*.35-m.headR,pose,t);
    face(c,a,m,{...pose,pupilY:.8},2,-m.headR*.35);
    return;
  }
  if(pose.vertical)c.rotate(-Math.PI/2);

  const crouch=pose.crouch;
  const bodyH=m.bodyH*(1-crouch*.3),legH=m.legH*(1-crouch*.45);
  const yTop=-(legH+bodyH),yBot=-legH;

  if(pose.arch>0){c.translate(0,-4*pose.arch);c.rotate(-.17*pose.arch);}

  tailDraw(c,a,pose,m,t,{x:-m.bodyLen*.52,y:yBot-bodyH*.35},false);

  const legOff=[Math.sin(pose.gait),Math.cos(pose.gait),Math.cos(pose.gait),Math.sin(pose.gait)];
  const legXs=[-m.bodyLen*.46,-m.bodyLen*.24,m.bodyLen*.16,m.bodyLen*.4];
  c.fillStyle=dark;
  for(let i=0;i<4;i++){
    const lift=Math.max(0,legOff[i]!)*pose.legAmp;
    c.fillRect(legXs[i]!,yBot-legH+lift*.4,m.legW,legH-lift*.4);
  }

  if(pose.sitting){
    c.fillStyle=coat;
    c.beginPath();c.ellipse(-m.bodyLen*.16,yBot-bodyH*.42,m.bodyLen*.36,bodyH*.66,0,0,TAU);c.fill();
    c.fillRect(m.bodyLen*.04,yTop-bodyH*.18,m.bodyLen*.26,bodyH*1.02);
    c.fillStyle=a.accent;
    c.beginPath();c.ellipse(m.bodyLen*.16,-legH*.55,m.bodyLen*.09,legH*.5,0,0,TAU);c.fill();
  }else if(pose.lying){
    c.fillStyle=coat;
    c.beginPath();c.ellipse(0,yBot-2,m.bodyLen*.56,bodyH*.5,0,0,TAU);c.fill();
    c.fillStyle=a.accent;
    c.beginPath();c.ellipse(m.bodyLen*.22,yBot-2,m.bodyLen*.18,bodyH*.22,0,0,TAU);c.fill();
  }else{
    const bx=-m.bodyLen*.52,by=yTop+crouch*7,bw=m.bodyLen+4;
    c.fillStyle=coat;
    rr(c,bx,by,bw,bodyH,bodyH*.45);
    drawMarkings(c,a,m,bx,by,bw,bodyH);
    c.fillStyle=a.accent;
    c.beginPath();c.ellipse(m.bodyLen*.24,by+bodyH*.68,m.bodyLen*.15,bodyH*.28,0,0,TAU);c.fill();
  }

  if(pose.puff){
    for(let i=0;i<5;i++)tri(c,-m.bodyLen*.4+i*m.bodyLen*.18,yTop+crouch*7-1,-m.bodyLen*.34+i*m.bodyLen*.18,yTop+crouch*7-7,-m.bodyLen*.28+i*m.bodyLen*.18,yTop+crouch*7-1,shade(a.coat,1.28));
  }

  if(!pose.lying&&!pose.sitting){
    c.fillStyle=coat;
    for(let i=0;i<4;i++){
      const lift=Math.max(0,legOff[i]!)*pose.legAmp;
      c.fillRect(legXs[i]!,yBot-legH+lift,m.legW,legH-lift);
    }
  }
  if(pose.pawReach>0&&!pose.lying&&!pose.sitting){
    const reach=pose.pawReach*6;
    c.fillStyle=coat;
    c.fillRect(m.bodyLen*.32,yTop-bodyH*.15-reach,m.legW,legH*.85+reach);
  }

  const headPos=mammalHeadPos(pose,m,yTop);
  c.save();
  if(pose.bow>0)c.rotate(.3*pose.bow);
  c.translate(headPos.x,headPos.y+pose.headBob);
  if(pose.arch>0)c.rotate(-.12);
  ears(c,a,m,-m.headR*.5,-m.headR-3,pose,t);
  c.fillStyle=coat;c.beginPath();c.arc(0,0,m.headR,0,TAU);c.fill();
  face(c,a,m,pose,m.snout*.4,-m.headR*.15);
  if(pose.party){
    tri(c,-6,-m.headR-1,0,-m.headR-13,6,-m.headR-1,"#e8574f");
    tri(c,-2.5,-m.headR-5.5,0,-m.headR-13,2.5,-m.headR-5.5,"#ffd76e");
    c.fillStyle="#ffd76e";c.beginPath();c.arc(0,-m.headR-14,2.4,0,TAU);c.fill();
  }
  c.restore();

  if(pose.carry){
    c.fillStyle="#d85b58";
    c.beginPath();c.arc(headPos.x+m.headR*.8,headPos.y+m.headR*.4,4.2,0,TAU);c.fill();
  }
}

function drawBird(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:Pose,t:number):void{
  const coat=a.coat,dark=shade(a.coat,.72),beak="#e0a64a";
  const breathe=pose.lying?Math.sin(t/500)*.06:0;

  if(!pose.lying&&p.body.grounded){
    c.strokeStyle="#9a7448";c.lineWidth=1.6;
    c.beginPath();c.moveTo(-3,-6);c.lineTo(-3,0);c.moveTo(3,-6);c.lineTo(3,0);c.stroke();
    c.beginPath();c.moveTo(-6,0);c.lineTo(0,0);c.moveTo(0,0);c.lineTo(6,0);c.stroke();
  }
  c.save();
  if(pose.preen)c.rotate(.5);
  if(pose.lying){
    c.fillStyle=coat;
    c.beginPath();c.ellipse(0,-8,12,9*(1+breathe),0,0,TAU);c.fill();
    c.beginPath();c.arc(-4,-14,7,0,TAU);c.fill();
    c.strokeStyle="#20242e";c.lineWidth=1.3;
    c.beginPath();c.moveTo(-7,-15);c.lineTo(-2,-15);c.stroke();
    c.restore();return;
  }
  c.translate(0,-pose.bounce);
  c.fillStyle=dark;
  tri(c,-7,-17,-19,-11+pose.flap*3,-8,-7,coat);
  c.fillStyle=coat;
  c.beginPath();c.ellipse(0,-15,11,14*(1+breathe*.4),pose.flap*.06,0,TAU);c.fill();
  c.fillStyle=a.accent;
  c.beginPath();c.ellipse(1,-11,6.5,8,0,0,TAU);c.fill();
  const flying=!p.body.grounded;
  if(flying||Math.abs(pose.flap)>.3){
    c.save();c.translate(-2,-18);c.rotate(-.5+pose.flap*.9);
    c.fillStyle=dark;c.beginPath();c.ellipse(-6,0,10,4.5,0,0,TAU);c.fill();
    c.restore();
  }else{
    c.fillStyle=dark;
    c.beginPath();c.ellipse(-2,-15,5,8,.25,0,TAU);c.fill();
  }
  c.fillStyle=coat;
  c.beginPath();c.arc(3,-27,7.5,0,TAU);c.fill();
  tri(c,9,-29,16,-26.5,9,-24,beak);
  tri(c,0,-33,2,-37,4,-32,shade(a.coat,1.25));
  eyeAt(c,5,-28,2.6,pose.eyeOpen,pose.pupilX,pose.pupilY,a.eye);
  c.restore();
}

/** Draw a pet's current sheet frame inside an already-facing-flipped transform. */
function drawSheetFrame(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,t:number):boolean{
  const sheet=a.sheet;
  if(!sheet)return false;
  preloadSheet(sheet.src);
  const img=sheetCache.get(sheet.src);
  if(!img||!img.complete||!img.naturalWidth)return false;
  const {anim}=resolveSheetAnimation(sheet,p.behavior);
  const fps=anim.fps??sheet.fps??8;
  const phase=hash01(p.id)*4000;
  const idx=Math.floor((t+phase)/1000*fps)%Math.max(1,anim.frames);
  const fw=sheet.frameWidth,fh=sheet.frameHeight;
  c.drawImage(img,idx*fw,anim.row*fh,fw,fh,-fw/2,-fh,fw,fh);
  return true;
}

interface LandingInfo { at:number; vy:number }

/** Full pet painter: transform, squash/stretch, sheet-or-procedural body. */
function paintPetInto(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pos:Vec2,t:number,landing:LandingInfo|null,cursor?:Vec2,reducedMotion=false):void{
  const pose=computePose(p,t,hash01(p.id)*10000,cursor,reducedMotion);
  if(isAdoptionAnniversary(p,Date.now()))pose.party=true;

  let sy=1,sx=1;
  if(!p.body.grounded){sy=Math.min(1.16,1+Math.abs(p.body.velocity.y)*.00045);sx=Math.pow(sy,-.7);}
  if(landing){
    const age=t-landing.at;
    if(age<220){const q=(1-age/220)*Math.min(1,(landing.vy-260)/900+.25);sy*=1-q*.3;sx*=1+q*.24;}
  }
  if(pose.lying)sy*=1+Math.sin(t/(p.behavior==="sleep"?620:420))*.03;

  c.save();c.translate(Math.round(pos.x),Math.round(pos.y));c.scale(p.body.facing*sx*a.scale,sy*a.scale);
  if(drawSheetFrame(c,p,a,t)){c.restore();return;}
  if(p.species==="bird")drawBird(c,p,a,pose,t);
  else drawMammal(c,p,a,pose,t,SHAPES[p.species]!);
  c.restore();
}

/* ---------- weather ---------- */

const WEATHER_PARTICLES=90;

/** Gentle ambient weather over the desktop. Deterministic per time slice; no state kept. */
function drawWeather(c:CanvasRenderingContext2D,weather:WeatherKind,t:number,reducedMotion:boolean,bounds:Rect):void{
  const W=bounds.width,H=bounds.height;
  if(weather==="clear")return;
  c.save();
  if(weather==="cloudy"||weather==="stormy"){
    c.fillStyle="rgba(40,50,70,.10)";
    for(let i=0;i<6;i++){
      const cx=((hash01(`cloud${i}`)*1.7*W)+(reducedMotion?t*.004:t*.014))%(W+420)-210;
      const cy=40+hash01(`cloudy${i}`)*H*.3;
      const r=60+hash01(`cloudr${i}`)*80;
      c.beginPath();c.ellipse(cx,cy,r,r*.38,0,0,TAU);c.fill();
    }
  }
  if(weather==="rainy"||weather==="stormy"){
    const count=reducedMotion?30:WEATHER_PARTICLES;
    c.strokeStyle="rgba(150,180,220,.34)";c.lineWidth=1.4;c.lineCap="round";
    const speed=reducedMotion?120:520;
    c.beginPath();
    for(let i=0;i<count;i++){
      const px=hash01(`rx${i}`)*(W+160)-80+((t*(.02+hash01(`rd${i}`)*.03))%40);
      const cycle=(t*.001*speed/16+hash01(`ro${i}`)*H)%H;
      const py=cycle;
      c.moveTo(px,py);c.lineTo(px-4,py+13);
    }
    c.stroke();
  }
  if(weather==="snowy"){
    const count=reducedMotion?24:70;
    c.fillStyle="rgba(240,246,255,.8)";
    for(let i=0;i<count;i++){
      const drift=Math.sin(t/1400+i)*22*(reducedMotion?.3:1);
      const cycle=((t*.00004*(30+hash01(`sv${i}`)*40))+hash01(`so${i}`))%1;
      const px=(hash01(`sx${i}`)*W+drift+W)%W;
      const py=cycle*H;
      const r=1.4+hash01(`sr${i}`)*2.2;
      c.beginPath();c.arc(px,py,r,0,TAU);c.fill();
    }
  }
  if(weather==="stormy"&&!reducedMotion){
    // Rare, brief lightning flicker
    const flashPhase=(t%9000);
    if(flashPhase<140){
      c.fillStyle=`rgba(230,238,255,${.28*(1-flashPhase/140)})`;
      c.fillRect(0,0,W,H);
    }
  }
  c.restore();
}

/* ---------- preview ---------- */

export function buildPreviewState(species:Species,behavior:string):PetState{
  return {
    id:`preview:${species}`,name:"",species,
    personality:{energy:.5,curiosity:.6,boldness:.5,sociability:.5,affection:.5,patience:.5,playfulness:.6,independence:.4,foodDrive:.5},
    drives:{fatigue:.2,hunger:.2,thirst:.2,play:.3,social:.3,curiosity:.4,comfort:.6},
    affect:{valence:.4,arousal:.35,stress:.05},
    body:{position:{x:0,y:0},velocity:{x:behavior==="walk"?60:0,y:0},facing:1,grounded:!["jump"].includes(behavior),surfaceId:null,target:null,held:false},
    behavior:behavior as Behavior,behaviorSinceMs:-99999,behaviorTargetId:null,ageSeconds:100,bond:.4,lastInteractionMs:0,adoptedAtMs:Date.now()-180*86_400_000,
    frustration:0,boredom:0,novelty:0,habitStrength:0,favoriteSurfaceId:null
  };
}

export function renderPetPreview(canvas:HTMLCanvasElement,species:Species,appearance:PetAppearance,behavior:string,t:number):void{
  const c=canvas.getContext("2d");
  if(!c)return;
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,0,canvas.width,canvas.height);
  c.imageSmoothingEnabled=false;
  const groundY=canvas.height*.92;
  const mv=SPECIES[species].movement;
  c.fillStyle="rgba(0,0,0,.18)";
  c.beginPath();c.ellipse(canvas.width/2,groundY+1,mv.bodyWidth*.44*appearance.scale,3.5,0,0,TAU);c.fill();
  const state=buildPreviewState(species,behavior);
  paintPetInto(c,state,appearance,{x:canvas.width/2,y:groundY},t,null);
}

/* ---------- renderer ---------- */

export class PixelRenderer {
  private ctx:CanvasRenderingContext2D;
  private dpr=1;
  private landing=new Map<string,LandingInfo>();
  private wasGrounded=new Map<string,boolean>();
  private pendingVy=new Map<string,number>();
  private lastAppearances=new Map<string,PetAppearance>();
  private hitCanvas:HTMLCanvasElement|null=null;
  private hitCtx:CanvasRenderingContext2D|null=null;

  constructor(readonly canvas:HTMLCanvasElement){
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("Canvas unavailable");
    this.ctx=ctx;this.ctx.imageSmoothingEnabled=false;this.resize();
    window.addEventListener("resize",()=>this.resize());
  }
  resize():void{
    this.dpr=Math.max(1,devicePixelRatio||1);
    const w=innerWidth,h=innerHeight;
    this.canvas.width=Math.floor(w*this.dpr);this.canvas.height=Math.floor(h*this.dpr);
    this.canvas.style.width=`${w}px`;this.canvas.style.height=`${h}px`;
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.ctx.imageSmoothingEnabled=false;
  }

  render(scene:RenderScene):void{
    const c=this.ctx;c.clearRect(0,0,innerWidth,innerHeight);
    const ox=-scene.virtualBounds.x,oy=-scene.virtualBounds.y;
    if(scene.weather)drawWeather(c,scene.weather,performance.now(),scene.reducedMotion===true,scene.virtualBounds);
    this.lastAppearances=new Map(scene.appearances);
    for(const object of scene.objects)this.drawObject(object,{x:object.position.x+ox,y:object.position.y+oy});
    const ordered=[...scene.pets].sort((a,b)=>a.body.position.y-b.body.position.y);
    const t=performance.now();
    for(const pet of ordered){
      const app=scene.appearances.get(pet.id)??{coat:"#d77b36",accent:"#f2bf7d",eye:"#d9ef73",scale:1};
      if(app.sheet)preloadSheet(app.sheet.src);
      const pos={x:pet.body.position.x+ox,y:pet.body.position.y+oy};
      const cursorScreen={x:(scene.cursor?.x??pos.x)+ox,y:(scene.cursor?.y??pos.y)+oy};
      const mv=SPECIES[pet.species].movement;

      const was=this.wasGrounded.get(pet.id);
      if(was===false&&pet.body.grounded){
        this.landing.set(pet.id,{at:t,vy:this.pendingVy.get(pet.id)??0});
        this.pendingVy.delete(pet.id);
      }
      this.wasGrounded.set(pet.id,pet.body.grounded);
      if(!pet.body.grounded)this.pendingVy.set(pet.id,Math.max(this.pendingVy.get(pet.id)??0,Math.abs(pet.body.velocity.y)));
      const pose=computePose(pet,t,hash01(pet.id)*10000);

      if(pet.body.grounded&&!pose.peeking){
        c.fillStyle="rgba(0,0,0,.18)";
        c.beginPath();c.ellipse(pos.x,pos.y+1,mv.bodyWidth*.44,3.5,0,0,TAU);c.fill();
      }
      if(pose.speedLines){
        c.strokeStyle="rgba(180,190,210,.5)";c.lineWidth=2;c.lineCap="round";
        for(let i=0;i<3;i++){
          const y=pos.y-mv.bodyHeight*.45-i*7,x1=pos.x-pet.body.facing*(mv.bodyWidth*.55+i*8);
          c.globalAlpha=.42-i*.12;c.beginPath();c.moveTo(x1,y);c.lineTo(x1-pet.body.facing*(12+i*5),y);c.stroke();
        }
        c.globalAlpha=1;
      }
      paintPetInto(c,pet,app,pos,t,this.landing.get(pet.id)??null,cursorScreen,scene.reducedMotion===true);

      if(pose.zzz){
        c.textAlign="left";
        for(let i=0;i<3;i++){
          const prog=((t/1300)+i/3)%1;
          c.globalAlpha=(1-prog)*.6;
          c.fillStyle="#cfd8ec";
          c.font=`bold ${8+i*3}px ui-monospace,monospace`;
          c.fillText("z",pos.x+mv.bodyWidth*.28+prog*12,pos.y-24-prog*20-i*4);
        }
        c.globalAlpha=1;
      }
      if(pet.behavior==="startle"&&t-pet.behaviorSinceMs<900){
        c.globalAlpha=1-(t-pet.behaviorSinceMs)/900;
        c.fillStyle="#ffd76e";c.font="bold 14px ui-monospace,monospace";c.textAlign="center";
        c.fillText("!",pos.x+pet.body.facing*10,pos.y-mv.bodyHeight-14-Math.sin((t-pet.behaviorSinceMs)/120)*2);
        c.globalAlpha=1;c.textAlign="left";
      }
      const land=this.landing.get(pet.id);
      if(land){
        const age=t-land.at;
        if(age<260&&land.vy>320){
          c.fillStyle="rgb(200,205,220)";
          const k=age/260;
          for(let i=0;i<3;i++){
            c.globalAlpha=(1-k)*.35;
            c.beginPath();c.arc(pos.x+(i-1)*7*k*3,pos.y-1-k*3,1.5+k*4,0,TAU);c.fill();
          }
          c.globalAlpha=1;
        }else if(age>600)this.landing.delete(pet.id);
      }
      if(scene.debug)this.drawDebug(pet,scene.decisions[pet.id],pos);
    }
  }

  /** Bounding-box quick reject followed by true per-pixel alpha sampling. */
  hitTest(pet:PetState,point:Vec2,bounds:Rect):boolean{
    const app=this.lastAppearances.get(pet.id)??{coat:"#d77b36",accent:"#f2bf7d",eye:"#d9ef73",scale:1};
    const mv=SPECIES[pet.species].movement,s=1.3*app.scale;
    const x=pet.body.position.x-bounds.x,y=pet.body.position.y-bounds.y;
    if(point.x<x-mv.bodyWidth*s/2||point.x>x+mv.bodyWidth*s/2||point.y<y-mv.bodyHeight*s||point.y>y+8)return false;

    const W=160,H=160;
    if(!this.hitCanvas){
      this.hitCanvas=document.createElement("canvas");
      this.hitCanvas.width=W;this.hitCanvas.height=H;
      this.hitCtx=this.hitCanvas.getContext("2d",{willReadFrequently:true});
      if(!this.hitCtx)return true;
    }
    const hc=this.hitCtx!;
    hc.setTransform(1,0,0,1,0,0);
    hc.clearRect(0,0,W,H);
    const sx=pet.body.position.x-bounds.x,sy=pet.body.position.y-bounds.y;
    hc.translate(W/2-(sx-point.x),H/2-(sy-point.y));
    paintPetInto(hc,pet,app,{x:sx,y:sy},performance.now(),null);
    const px=hc.getImageData(W/2,H/2,1,1).data;
    return px[3]!==undefined&&px[3]>24;
  }

  private drawObject(o:WorldObject,p:Vec2):void{
    const c=this.ctx;
    if(o.kind==="ball"){
      c.fillStyle="#b94846";c.beginPath();c.ellipse(p.x,p.y,o.radius,o.radius*.92,0,0,TAU);c.fill();
      c.fillStyle="#d85b58";c.beginPath();c.ellipse(p.x-o.radius*.25,p.y-o.radius*.3,o.radius*.55,o.radius*.45,0,0,TAU);c.fill();
      c.fillStyle="rgba(255,255,255,.55)";c.beginPath();c.arc(p.x-o.radius*.35,p.y-o.radius*.42,o.radius*.16,0,TAU);c.fill();
    }else if(o.kind==="bed"){
      c.fillStyle="rgba(0,0,0,.15)";c.beginPath();c.ellipse(p.x,p.y,o.radius,o.radius*.3,0,0,TAU);c.fill();
      c.fillStyle="#725b92";c.beginPath();c.ellipse(p.x,p.y-3,o.radius,o.radius*.42,0,0,TAU);c.fill();
      c.fillStyle="#a58cc5";c.beginPath();c.ellipse(p.x,p.y-5,o.radius*.72,o.radius*.26,0,0,TAU);c.fill();
    }else if(o.kind==="box"){
      c.fillStyle="rgba(0,0,0,.15)";c.fillRect(p.x-o.radius,p.y-2,o.radius*2,3);
      c.fillStyle="#b9854d";c.fillRect(p.x-o.radius,p.y-o.radius*1.6,o.radius*2,o.radius*1.6);
      c.fillStyle="#8b6036";c.fillRect(p.x-o.radius,p.y-o.radius*1.6,o.radius*2,4);
      c.fillStyle="#a5713f";c.fillRect(p.x-o.radius*.55,p.y-o.radius*.9,o.radius*.35,o.radius*.9);
    }else if(o.kind==="bowl"){
      c.fillStyle=o.contents==="water"?"#5f9fc8":"#b9654d";
      c.beginPath();c.moveTo(p.x-o.radius,p.y-8);c.lineTo(p.x+o.radius,p.y-8);c.lineTo(p.x+o.radius*.7,p.y);c.lineTo(p.x-o.radius*.7,p.y);c.closePath();c.fill();
      c.fillStyle=o.contents==="water"?"#9ad7ee":"#d9a45f";
      c.beginPath();c.ellipse(p.x,p.y-8,o.radius*.78,2.6,0,0,TAU);c.fill();
    }else if(o.kind==="scratcher"){
      c.fillStyle="#805a3e";c.fillRect(p.x-4,p.y-o.radius*2,8,o.radius*2);
      c.fillStyle="#a67a54";c.fillRect(p.x-o.radius,p.y-5,o.radius*2,7);
      c.fillRect(p.x-10,p.y-o.radius*2,20,5);
    }else if(o.kind==="plant"){
      c.fillStyle="#8b6036";
      c.beginPath();c.moveTo(p.x-o.radius*.6,p.y);c.lineTo(p.x+o.radius*.6,p.y);c.lineTo(p.x+o.radius*.42,p.y-o.radius*.7);c.lineTo(p.x-o.radius*.42,p.y-o.radius*.7);c.closePath();c.fill();
      c.fillStyle="#3f7d4c";
      c.beginPath();c.ellipse(p.x-o.radius*.35,p.y-o.radius*1.15,o.radius*.34,o.radius*.6,-.5,0,TAU);c.fill();
      c.beginPath();c.ellipse(p.x+o.radius*.35,p.y-o.radius*1.15,o.radius*.34,o.radius*.6,.5,0,TAU);c.fill();
      c.fillStyle="#4f9d5f";
      c.beginPath();c.ellipse(p.x,p.y-o.radius*1.4,o.radius*.26,o.radius*.55,0,0,TAU);c.fill();
    }else if(o.kind==="perch"){
      c.fillStyle="#7a5b3e";c.fillRect(p.x-2.5,p.y-o.radius*1.7,5,o.radius*1.7);
      c.fillRect(p.x-o.radius*.7,p.y-4,o.radius*1.4,4);
      c.fillStyle="#9a7448";
      c.fillRect(p.x-o.radius*.7,p.y-o.radius*1.75,o.radius*1.4,5);
      c.fillStyle="#6b4e33";c.fillRect(p.x-o.radius*.7,p.y-o.radius*1.75,o.radius*1.4,1.5);
    }else if(o.kind==="tunnel"){
      c.fillStyle="#5e7d9a";
      c.beginPath();c.arc(p.x,p.y,o.radius,Math.PI,0);c.closePath();c.fill();
      c.fillStyle="#2c3944";
      c.beginPath();c.arc(p.x,p.y,o.radius*.72,Math.PI,0);c.closePath();c.fill();
      c.strokeStyle="#48607a";c.lineWidth=3;
      c.beginPath();c.arc(p.x,p.y,o.radius,Math.PI,0);c.stroke();
    }else{
      c.fillStyle="#888";c.beginPath();c.arc(p.x,p.y,o.radius,0,TAU);c.fill();
    }
  }

  private drawDebug(p:PetState,d:RenderScene["decisions"][string]|undefined,pos:Vec2):void{
    const c=this.ctx;c.save();c.font="11px ui-monospace, monospace";
    const text=`${p.name} • ${p.behavior} • F${p.drives.fatigue.toFixed(2)} P${p.drives.play.toFixed(2)}`;
    c.fillStyle="rgba(10,12,18,.78)";c.fillRect(pos.x-5,pos.y-79,Math.max(190,text.length*6.4),34);
    c.fillStyle="#f5f7ff";c.fillText(text,pos.x,pos.y-64);
    if(d){c.fillStyle="#aab2ca";c.fillText(d.reason.slice(0,42),pos.x,pos.y-51);}
    c.restore();
  }
}
