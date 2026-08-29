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

interface CatMorph {
  head:number;
  ears:number;
  bodyLength:number;
  bodyRound:number;
  muzzle:number;
  tail:number;
  legs:number;
  fluff:number;
}

const TAU=Math.PI*2;
const RASTER=160;
const ORIGIN=80;
let rasterCanvas:HTMLCanvasElement|null=null;
let rasterCtx:CanvasRenderingContext2D|null=null;

function hash01(input:string):number{
  let h=2166136261;
  for(const ch of input){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return(h>>>0)/4294967296;
}

function morphFor(p:PetState):CatMorph{
  const v=(salt:string)=>hash01(`${p.id}:${salt}`);
  return{
    head:1.20+v("head")*.10,
    ears:.865+v("ears")*.13,
    bodyLength:.80+v("length")*.08,
    bodyRound:1.12+v("round")*.10,
    muzzle:1.08+v("muzzle")*.10,
    tail:.86+v("tail")*.12,
    legs:.95+v("legs")*.10,
    fluff:.15+v("fluff")*.85
  };
}

function clamp(v:number,a=0,b=1):number{return Math.max(a,Math.min(b,v));}
function rgb(hex:string):[number,number,number]{
  const clean=hex.replace("#","");
  const full=clean.length===3?clean.split("").map(x=>x+x).join(""):clean.padEnd(6,"0").slice(0,6);
  const n=parseInt(full,16)||0;
  return[(n>>16)&255,(n>>8)&255,n&255];
}
function shade(hex:string,f:number):string{
  const [r,g,b]=rgb(hex);
  const ch=(v:number)=>Math.round(clamp(v*f,0,255));
  return `#${[ch(r),ch(g),ch(b)].map(v=>v.toString(16).padStart(2,"0")).join("")}`;
}
function mix(a:string,b:string,t:number):string{
  const ar=rgb(a),br=rgb(b),q=clamp(t);
  return `rgb(${Math.round(ar[0]*(1-q)+br[0]*q)},${Math.round(ar[1]*(1-q)+br[1]*q)},${Math.round(ar[2]*(1-q)+br[2]*q)})`;
}
function rgba(hex:string,a:number):string{
  const [r,g,b]=rgb(hex);return `rgba(${r},${g},${b},${a})`;
}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string,rot=0):void{
  c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),rot,0,TAU);c.fill();
}
function path(c:CanvasRenderingContext2D,color:string,draw:()=>void):void{c.fillStyle=color;c.beginPath();draw();c.closePath();c.fill();}
function line(c:CanvasRenderingContext2D,color:string,width:number,draw:()=>void):void{c.strokeStyle=color;c.lineWidth=width;c.lineCap="round";c.lineJoin="round";c.beginPath();draw();c.stroke();}

function coatPalette(a:PetAppearance){
  return{
    hi:mix(a.coat,"#fff4df",.18),
    mid:a.coat,
    low:shade(a.coat,.72),
    deep:shade(a.coat,.52),
    accent:a.accent,
    accentHi:mix(a.accent,"#fff8ec",.22)
  };
}

function softBodyFill(c:CanvasRenderingContext2D,a:PetAppearance,x0:number,y0:number,x1:number,y1:number):CanvasGradient{
  const p=coatPalette(a),g=c.createLinearGradient(x0,y0,x1,y1);
  g.addColorStop(0,p.hi);g.addColorStop(.32,p.mid);g.addColorStop(.72,p.mid);g.addColorStop(1,p.low);return g;
}

function drawEye(c:CanvasRenderingContext2D,x:number,y:number,open:number,gx:number,gy:number,color:string,far=false):void{
  if(open<.17){
    line(c,"rgba(35,30,33,.72)",1.05,()=>{c.moveTo(x-2.35,y);c.quadraticCurveTo(x,y+.95,x+2.35,y);});
    return;
  }
  const h=Math.max(.68,2.22*open),w=far?2.08:2.32;
  ellipse(c,x,y,w,h,shade(color,.68));
  ellipse(c,x-.12,y-.04,w*.80,h*.76,color);
  ellipse(c,x+clamp(gx,-1,1)*.52,y+clamp(gy,-1,1)*.33,.36,h*.75,"#17151a");
  ellipse(c,x-.61,y-.67,.38,.36,"rgba(255,255,255,.9)");
  line(c,"rgba(32,27,31,.25)",.5,()=>{c.moveTo(x-w*.78,y-h*.5);c.quadraticCurveTo(x,y-h*1.02,x+w*.76,y-h*.46);});
}

function drawFace(c:CanvasRenderingContext2D,a:PetAppearance,p:IllustratedCatPose,cx:number,cy:number,m:CatMorph,t:number):void{
  const pal=coatPalette(a),happy=p.eyeOpen>.7&&p.tailLift>.55&&p.earBack<.25;
  const eyeOpen=happy?Math.min(p.eyeOpen,.82):p.eyeOpen;
  ellipse(c,cx+1.2,cy+3.6,5.45*m.muzzle,4.15*m.muzzle,rgba(pal.accentHi,.92));
  ellipse(c,cx-2.4,cy+3.7,4.1*m.muzzle,3.55*m.muzzle,rgba(pal.accent,.48));
  drawEye(c,cx-4.15,cy-1.45,eyeOpen,p.pupilX,p.pupilY,a.eye,true);
  drawEye(c,cx+3.45,cy-1.35,eyeOpen,p.pupilX,p.pupilY,a.eye,false);
  path(c,"#a9666d",()=>{c.moveTo(cx-.8,cy+2.45);c.quadraticCurveTo(cx+.7,cy+1.65,cx+2.2,cy+2.45);c.quadraticCurveTo(cx+.7,cy+3.85,cx-.8,cy+2.45);});
  line(c,rgba(pal.deep,.78),.72,()=>{c.moveTo(cx+.7,cy+3.25);c.lineTo(cx+.7,cy+4.55);c.quadraticCurveTo(cx-.7,cy+5.75,cx-2.3,cy+5.15);});
  line(c,rgba(pal.deep,.68),.64,()=>{c.moveTo(cx+.7,cy+4.55);c.quadraticCurveTo(cx+2.1,cy+5.75,cx+3.55,cy+5.15);});
  for(const [dx,dy] of [[-3.9,3.9],[-4.8,4.75],[4.25,4.0],[5.1,4.75]] as const)ellipse(c,cx+dx,cy+dy,.34,.34,rgba(pal.deep,.46));
  if(p.licking&&Math.sin(t/135)>.1){ellipse(c,cx+.9,cy+6.65,1.65,1.1,"#d98e99",.12);}
  line(c,"rgba(255,250,239,.5)",.54,()=>{
    for(const dy of [-.45,1.1]){
      c.moveTo(cx+4.6,cy+4.0+dy);c.quadraticCurveTo(cx+10.2,cy+3.4+dy,cx+13.5,cy+4.5+dy);
      c.moveTo(cx-4.3,cy+4.0+dy);c.quadraticCurveTo(cx-9.6,cy+3.5+dy,cx-12.8,cy+4.7+dy);
    }
  });
  if(m.fluff>.55){
    path(c,rgba(pal.hi,.42),()=>{c.moveTo(cx-10.5,cy+3.5);c.lineTo(cx-13.2,cy+5.0);c.lineTo(cx-10.7,cy+5.4);c.lineTo(cx-12.8,cy+7.2);c.lineTo(cx-8.3,cy+6.15);});
  }
}

function drawEars(c:CanvasRenderingContext2D,a:PetAppearance,p:IllustratedCatPose,cx:number,cy:number,t:number,m:CatMorph):void{
  const pal=coatPalette(a),flat=p.earBack,twitch=p.earTwitch>0&&Math.sin(t/55)>0?p.earTwitch:0;
  const ear=(x:number,ang:number,mirror:number)=>{
    c.save();c.translate(x,cy);c.rotate(ang);c.scale(mirror*m.ears,m.ears);
    path(c,pal.low,()=>{c.moveTo(-1,3);c.lineTo(2,-12.5-twitch);c.quadraticCurveTo(6,-6.5,7.8,4);c.lineTo(1,5);});
    path(c,rgba(a.accent,.62),()=>{c.moveTo(1,1);c.lineTo(3,-8.2-twitch*.5);c.lineTo(5.8,2.2);});
    line(c,"rgba(255,255,255,.22)",.5,()=>{c.moveTo(2.25,.6);c.lineTo(3.55,-3.7);c.moveTo(4,.7);c.lineTo(4.9,-2);});
    c.restore();
  };
  ear(cx-8,-.08-flat*.48,1);ear(cx+7,.08+flat*.48,-1);
}

function drawHead(c:CanvasRenderingContext2D,a:PetAppearance,p:IllustratedCatPose,cx:number,cy:number,t:number,m:CatMorph):void{
  const pal=coatPalette(a);c.save();c.translate(cx,cy);c.scale(m.head,m.head);c.translate(-cx,-cy);
  drawEars(c,a,p,cx,cy-6,t,m);
  ellipse(c,cx,cy,13.1,11.3,pal.low,-.035);
  c.fillStyle=softBodyFill(c,a,cx-10,cy-10,cx+11,cy+10);c.beginPath();c.ellipse(cx+.25,cy-.45,12.15,10.45,-.035,0,TAU);c.fill();
  ellipse(c,cx-3.8,cy-5.2,6.2,2.4,rgba(pal.hi,.3),-.12);
  if(markingFor(a)==="tabby"){
    line(c,rgba(pal.deep,.46),1.05,()=>{for(const dx of [-3.5,0,3.5]){c.moveTo(cx+dx,cy-8.15);c.quadraticCurveTo(cx+dx*.72,cy-6,cx+dx*.5,cy-4.55);}c.moveTo(cx-10,cy-.5);c.quadraticCurveTo(cx-7.2,cy+.1,cx-6,cy+1.9);});
  }else if(markingFor(a)==="tuxedo"){
    ellipse(c,cx+1.45,cy+4.1,6.3,5.0,rgba(a.accent,.88));
  }else if(markingFor(a)==="patched"){
    ellipse(c,cx-5.2,cy-1.25,4.5,5.1,rgba(a.accent,.62),-.26);
  }
  drawFace(c,a,p,cx,cy,m,t);
  if(p.party){path(c,"#e95c56",()=>{c.moveTo(cx-5,cy-9);c.lineTo(cx,cy-24);c.lineTo(cx+5,cy-9);});ellipse(c,cx,cy-25,1.8,1.8,"#ffd876");}
  c.restore();
}

function drawTail(c:CanvasRenderingContext2D,a:PetAppearance,p:IllustratedCatPose,t:number,x:number,y:number,m:CatMorph):void{
  const pal=coatPalette(a),lift=p.tailLift,fast=p.tailFast?118:350,sway=Math.sin(t/fast)*p.tailWagAmp*.45;
  line(c,p.puff?pal.hi:pal.low,(p.puff?7.2:5.2)*m.tail,()=>{
    c.moveTo(x,y);
    if(p.lying)c.bezierCurveTo(x-11,y+2,x-18,y-2,x-22+sway*.2,y-8);
    else if(lift<-.2)c.bezierCurveTo(x-10,y+1,x-18,y+4,x-24+sway*.3,y+1);
    else{
      c.bezierCurveTo(x-9,y-3-lift*3,x-15,y-10-lift*7,x-16+sway*.18,y-17-lift*8);
      c.bezierCurveTo(x-17+sway*.28,y-23-lift*7,x-11+sway*.42,y-28-lift*4,x-9+sway*.5,y-24-lift*2);
    }
  });
  line(c,rgba(a.accent,.48),1.55*m.tail,()=>{
    if(p.lying){c.moveTo(x-16,y-4);c.lineTo(x-22+sway*.2,y-8);}
    else if(lift<-.2){c.moveTo(x-16,y+2);c.lineTo(x-24+sway*.3,y+1);}
    else{c.moveTo(x-14+sway*.34,y-26-lift*5);c.lineTo(x-9+sway*.5,y-24-lift*2);}
  });
}

function drawPaw(c:CanvasRenderingContext2D,a:PetAppearance,x:number,y:number,rot=0):void{
  const pal=coatPalette(a);c.save();c.translate(x,y);c.rotate(rot);ellipse(c,0,0,3.75,1.95,pal.accentHi);line(c,rgba(pal.deep,.3),.5,()=>{c.moveTo(-1.05,-.75);c.lineTo(-1.05,.4);c.moveTo(.95,-.75);c.lineTo(.95,.4);});c.restore();
}
function drawLeg(c:CanvasRenderingContext2D,a:PetAppearance,x:number,hipY:number,floorY:number,lift:number,stride:number,front:boolean,m:CatMorph):void{
  const pal=coatPalette(a),pawY=floorY-lift,legH=(pawY-hipY)*m.legs,endY=hipY+legH,pawX=x+stride;
  path(c,front?pal.mid:pal.low,()=>{
    c.moveTo(x-2.8,hipY);
    c.quadraticCurveTo(x+stride*.18-3,(hipY+endY)*.56,pawX-2.35,endY-2.1);
    c.quadraticCurveTo(pawX,endY+.35,pawX+2.8,endY-.35);
    c.quadraticCurveTo(pawX+3.0,endY-2.0,x+stride*.14+2.2,(hipY+endY)*.52);
    c.lineTo(x+2.6,hipY);
  });
  drawPaw(c,a,pawX+.25,endY-.2,clamp(stride*.035,-.15,.15));
}

function markingFor(a:PetAppearance):"uniform"|"tuxedo"|"tabby"|"patched"{return a.markings??"tabby";}

function bodyMarkings(c:CanvasRenderingContext2D,a:PetAppearance,bodyY:number):void{
  const pal=coatPalette(a),marking=markingFor(a);
  if(marking==="tabby"){
    line(c,rgba(pal.deep,.44),1.25,()=>{for(let i=0;i<4;i++){const x=-12+i*7;c.moveTo(x,bodyY-1);c.quadraticCurveTo(x+1,bodyY+3,x+3,bodyY+6.8);}c.moveTo(15,bodyY+3);c.quadraticCurveTo(18,bodyY+8,17,bodyY+11);});
  }else if(marking==="tuxedo")ellipse(c,13,bodyY+10.7,8.7,4.8,rgba(a.accent,.86),-.08);
  else if(marking==="patched"){ellipse(c,-9,bodyY+4,7,5.9,rgba(a.accent,.58),-.28);ellipse(c,9,bodyY+10.5,5.8,4.1,rgba(a.accent,.46),.2);}
}

function backTufts(c:CanvasRenderingContext2D,a:PetAppearance,bodyY:number,m:CatMorph):void{
  if(m.fluff<.5)return;const pal=coatPalette(a);for(let i=0;i<4;i++){const x=-15+i*8;path(c,rgba(pal.hi,.62),()=>{c.moveTo(x,bodyY-3);c.lineTo(x+2.2,bodyY-6.2-m.fluff);c.lineTo(x+4.2,bodyY-2.8);});}
}

function drawGroomPaw(c:CanvasRenderingContext2D,a:PetAppearance,t:number,m:CatMorph):void{
  const sweep=Math.sin(t/180)*.5+.5;c.save();c.translate(7,-28);c.rotate(-.48-sweep*.38);
  line(c,coatPalette(a).mid,5.2*m.legs,()=>{c.moveTo(0,0);c.quadraticCurveTo(-1,-8,0,-15);});drawPaw(c,a,.3,-16,-.08);c.restore();
}

function drawScratchForelegs(c:CanvasRenderingContext2D,a:PetAppearance,t:number,bodyY:number,m:CatMorph):void{
  const pal=coatPalette(a),swipe=Math.sin(t/92),reachA=Math.max(0,swipe)*3.2,reachB=Math.max(0,-swipe)*3.2;
  const arm=(x:number,yLift:number,alpha:number)=>{
    const px=x+14.5,py=bodyY-8.5-yLift;line(c,rgba(pal.mid,alpha),4.7*m.legs,()=>{c.moveTo(x,bodyY+8);c.quadraticCurveTo(x+6,bodyY+1,px,py);});drawPaw(c,a,px+.5,py,-.36);
  };
  arm(10.5,reachA,.96);arm(15.5,reachB,.9);
}

function drawStanding(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const crouch=pose.crouch,bodyY=-27+crouch*7-pose.bounce,bodyH=18-crouch*3+Math.sin(t/900)*.18;
  drawTail(c,a,pose,t,-19*m.bodyLength,bodyY+11,m);
  const xs=[-15,-7,9,17],running=pose.legAmp>3.45,scratching=p.behavior==="scratch"&&pose.pawReach>0;
  const phases=running
    ?[pose.gait,pose.gait+.58,pose.gait+Math.PI,pose.gait+Math.PI+.58]
    :[pose.gait,pose.gait+Math.PI,pose.gait+Math.PI,pose.gait];
  for(let i=0;i<4;i++){
    if(scratching&&i>=2)continue;
    const cycle=phases[i]!,swing=Math.sin(cycle),travel=Math.cos(cycle);
    const lift=Math.max(0,swing)*pose.legAmp*(running?1.14:1.02);
    const stride=travel*pose.legAmp*(running?1.98:1.68);
    drawLeg(c,a,xs[i]!,bodyY+10,0,lift,stride,i>=2,m);
  }
  const runWave=running?Math.sin(pose.gait*2):0,runStretch=runWave*.045;
  c.save();c.translate(0,bodyY+bodyH*.5);c.scale(m.bodyLength*(1+runStretch),m.bodyRound*(1-runStretch*.34));c.translate(0,-(bodyY+bodyH*.5));
  const pal=coatPalette(a);ellipse(c,0,bodyY+8,24.2,12.2,pal.low);
  c.fillStyle=softBodyFill(c,a,-22,bodyY-5,22,bodyY+18);c.beginPath();c.ellipse(1,bodyY+6.4,22.9,11.35,-.01,0,TAU);c.fill();
  ellipse(c,8,bodyY+.9,12.0,4.3,rgba(pal.hi,.24),-.05);ellipse(c,-2,bodyY+13.3,17.3,3.1,rgba(pal.deep,.16));bodyMarkings(c,a,bodyY);backTufts(c,a,bodyY,m);c.restore();
  const hx=18+(m.bodyLength-.84)*10+pose.crouch*5+pose.headDip*7+(running?runStretch*15:0)+(scratching?1.8:0),hy=bodyY+2.0+pose.crouch*5+pose.headDip*10+pose.headBob+pose.bounce*.28+(running?Math.cos(pose.gait*2)*.28:0)-(scratching?2.2:0);
  if(scratching)drawScratchForelegs(c,a,t,bodyY,m);
  c.save();if(pose.bow>0){c.translate(hx,hy);c.rotate(.24*pose.bow);c.translate(-hx,-hy);}drawHead(c,a,pose,hx,hy,t,m);c.restore();
  if(pose.pawReach>0&&!scratching)drawLeg(c,a,20,bodyY+9,-pose.pawReach*7,0,0,true,m);
  if(pose.carry){ellipse(c,hx+12,hy+8,4,4,"#d95c5c");ellipse(c,hx+10.7,hy+6.8,1.3,1.3,"rgba(255,255,255,.38)");}
}

function drawSitting(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const pal=coatPalette(a);drawTail(c,a,pose,t,-10,-12,m);ellipse(c,-3,-18.5,15.8*m.bodyRound,19.6*m.bodyRound,pal.low,-.13);
  c.fillStyle=softBodyFill(c,a,-13,-39,14,0);c.beginPath();c.ellipse(-1.7,-19.2,14.6*m.bodyRound,18.4*m.bodyRound,-.12,0,TAU);c.fill();
  ellipse(c,-7,-7.5,9.5,6.0,rgba(pal.low,.84));ellipse(c,6,-7.3,7.2,7.0,rgba(a.accent,.45));drawPaw(c,a,2.7,-.8);drawPaw(c,a,9.8,-.8);
  if(markingFor(a)==="tabby")line(c,rgba(pal.deep,.42),1.2,()=>{for(let i=0;i<3;i++){c.moveTo(-10+i*6,-31);c.quadraticCurveTo(-7+i*6,-26,-6+i*6,-21.5);}});
  drawHead(c,a,pose,7,-38.5+pose.headBob,t,m);if(pose.grooming)drawGroomPaw(c,a,t,m);
}

function drawSleeping(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const pal=coatPalette(a),breathe=Math.sin(t/620)*.55,curl=hash01(`${p.id}:sleep-pose`)>.42;
  const sleepy={...pose,eyeOpen:0,pupilX:0,pupilY:0};
  if(curl){
    c.save();c.translate(-1,-1);
    line(c,pal.low,5.4*m.tail,()=>{c.moveTo(-15,-5);c.bezierCurveTo(-26,-5,-29,-15,-22,-24);c.bezierCurveTo(-14,-34,5,-34,18,-24);c.bezierCurveTo(27,-16,24,-6,15,-3);});
    ellipse(c,-3,-17,21*m.bodyRound,(16+breathe*.55)*m.bodyRound,pal.low,-.1);
    c.fillStyle=softBodyFill(c,a,-22,-34,20,-2);c.beginPath();c.ellipse(-2,-18,19.7*m.bodyRound,(14.8+breathe*.55)*m.bodyRound,-.1,0,TAU);c.fill();
    ellipse(c,-8,-27,11,4.3,rgba(pal.hi,.2),-.15);
    if(markingFor(a)==="tabby")line(c,rgba(pal.deep,.4),1.2,()=>{for(let i=0;i<4;i++){const x=-15+i*7;c.moveTo(x,-31);c.quadraticCurveTo(x+2,-26,x+3,-22);}});
    else if(markingFor(a)==="tuxedo")ellipse(c,6,-8,9,5.2,rgba(a.accent,.78),-.2);
    else if(markingFor(a)==="patched")ellipse(c,-9,-20,7,6,rgba(a.accent,.5),-.25);
    drawHead(c,a,sleepy,12,-23,t,m);ellipse(c,13,-8,5.2,2.1,pal.accentHi,-.08);c.restore();return;
  }
  drawTail(c,a,pose,t,-7,-7,m);ellipse(c,-2,-10,24*m.bodyLength,(12+breathe)*m.bodyRound,pal.low,-.05);
  c.fillStyle=softBodyFill(c,a,-22,-23,22,-1);c.beginPath();c.ellipse(-.5,-11,22.6*m.bodyLength,(10.9+breathe)*m.bodyRound,-.05,0,TAU);c.fill();
  ellipse(c,7,-7,13,4.6,rgba(a.accent,.42),-.12);if(markingFor(a)==="tabby")line(c,rgba(pal.deep,.4),1.25,()=>{for(let i=0;i<4;i++){const x=-14+i*7;c.moveTo(x,-19);c.quadraticCurveTo(x+2,-15,x+4,-12);}});
  drawHead(c,a,sleepy,17,-13,t,m);drawPaw(c,a,18,-2.2);
}

function drawLoaf(c:CanvasRenderingContext2D,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const pal=coatPalette(a),breathe=Math.sin(t/860)*.4;c.save();c.translate(0,-1);line(c,pal.low,5.2*m.tail,()=>{c.moveTo(-18,-6);c.bezierCurveTo(-27,-3,-28,4,-18,5);c.bezierCurveTo(-8,6,4,4,10,1);});
  ellipse(c,-2,-11,22*m.bodyLength,(12+breathe)*m.bodyRound,pal.low,-.03);c.fillStyle=softBodyFill(c,a,-21,-26,20,1);c.beginPath();c.ellipse(-1,-11.5,20.9*m.bodyLength,(10.9+breathe)*m.bodyRound,-.03,0,TAU);c.fill();
  ellipse(c,6,-17,12,3.8,rgba(pal.hi,.22),-.04);if(markingFor(a)==="tabby")line(c,rgba(pal.deep,.42),1.25,()=>{for(let i=0;i<4;i++){const x=-13+i*7;c.moveTo(x,-20);c.quadraticCurveTo(x+2,-16,x+4,-12);}});else if(markingFor(a)==="tuxedo")ellipse(c,9,-5,9.4,4,rgba(a.accent,.8),-.05);else if(markingFor(a)==="patched")ellipse(c,-8,-13,6.8,4.9,rgba(a.accent,.52),-.2);
  drawPaw(c,a,7.5,-2.6);const calm={...pose,headBob:Math.sin(t/1700)*.3};drawHead(c,a,calm,15,-20+calm.headBob,t,m);c.restore();
}

function drawPeeking(c:CanvasRenderingContext2D,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{const bob=Math.sin(t/650)*.75;drawHead(c,a,pose,0,-10+bob,t,m);drawPaw(c,a,-7,-.7);drawPaw(c,a,7,-.7);}
function drawHanging(c:CanvasRenderingContext2D,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const pal=coatPalette(a),sway=Math.sin(t/520)*1.1;c.save();c.translate(sway,0);line(c,pal.low,5.2*m.tail,()=>{c.moveTo(-3,31);c.bezierCurveTo(-10,38,-8,48,-15,53);});
  ellipse(c,0,20,9.2,20,pal.low);c.fillStyle=softBodyFill(c,a,-8,1,8,38);c.beginPath();c.ellipse(.2,19,8.1,18.5,0,0,TAU);c.fill();
  if(markingFor(a)==="tuxedo")ellipse(c,2,27,5,8,rgba(a.accent,.78));else if(markingFor(a)==="tabby")line(c,rgba(pal.deep,.48),1.35,()=>{for(const y of [13,20,27]){c.moveTo(-6,y);c.quadraticCurveTo(-1,y+2,3,y+1);}});
  drawHead(c,a,{...pose,pupilY:.65},1,9,t,m);drawPaw(c,a,-6,-.5);drawPaw(c,a,6,-.5);c.restore();
}
function drawPounce(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number,m:CatMorph):void{
  const pal=coatPalette(a),vy=p.body.velocity.y;
  const launch=clamp((-vy-35)/185),descent=clamp((vy-25)/190),apex=clamp(1-Math.max(launch,descent*.72));
  const pitch=-.045+clamp(vy/1600,-.055,.07);
  c.save();c.translate(1,-10);c.rotate(pitch);
  line(c,pal.low,5.0*m.tail,()=>{c.moveTo(-23,-8);c.bezierCurveTo(-34,-12+launch*3,-42,-8+descent*2,-48,-13+descent*4);});
  const bodyStretch=1+apex*.035-launch*.025;
  ellipse(c,0,-12,26*m.bodyLength*bodyStretch,10.6*m.bodyRound,pal.low,-.03);
  c.fillStyle=softBodyFill(c,a,-25,-22,25,-3);c.beginPath();c.ellipse(1,-12.6,24.8*m.bodyLength*bodyStretch,9.6*m.bodyRound,-.03,0,TAU);c.fill();bodyMarkings(c,a,-20);
  const limb=(x1:number,y1:number,x2:number,y2:number,front:boolean)=>{line(c,front?pal.mid:pal.low,4.8*m.legs,()=>{c.moveTo(x1,y1);c.quadraticCurveTo((x1+x2)*.5,y1+1,x2,y2);});drawPaw(c,a,x2+1,y2,.08);};
  const foreReach=1-launch*.28+descent*.08,hindTuck=launch*.52;
  limb(16,-10,16+(38-16)*foreReach,-5+descent*4,true);
  limb(13,-15,13+(34-13)*foreReach,-12+descent*3,true);
  limb(-17,-7,-32+hindTuck*8,-1-launch*4,false);
  limb(-20,-14,-34+hindTuck*9,-9-launch*3,false);
  drawHead(c,a,{...pose,eyeOpen:1,pupilX:.7,pupilY:.05+descent*.14,earBack:.08+launch*.08},24,-17+descent*.6,t,m);c.restore();
}

function drawVectorCat(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number):void{
  const m=morphFor(p);c.save();if(pose.arch>0)c.translate(0,-2.5*pose.arch);
  if(pose.pouncing&&!p.body.grounded)drawPounce(c,p,a,pose,t,m);
  else if(pose.loaf)drawLoaf(c,a,pose,t,m);
  else if(pose.peeking)drawPeeking(c,a,pose,t,m);
  else if(pose.hanging)drawHanging(c,a,pose,t,m);
  else if(pose.vertical){c.rotate(-Math.PI/2);drawStanding(c,p,a,pose,t,m);}
  else if(pose.lying)drawSleeping(c,p,a,pose,t,m);
  else if(pose.sitting)drawSitting(c,p,a,pose,t,m);
  else drawStanding(c,p,a,pose,t,m);
  c.restore();
}

function getRaster():CanvasRenderingContext2D|null{
  if(typeof document==="undefined")return null;
  if(!rasterCanvas){rasterCanvas=document.createElement("canvas");rasterCanvas.width=RASTER;rasterCanvas.height=RASTER;rasterCtx=rasterCanvas.getContext("2d");}
  return rasterCtx;
}

export function drawIllustratedCat(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pose:IllustratedCatPose,t:number):void{
  const rc=getRaster();if(!rc||!rasterCanvas){drawVectorCat(c,p,a,pose,t);return;}
  rc.setTransform(1,0,0,1,0,0);rc.clearRect(0,0,RASTER,RASTER);rc.imageSmoothingEnabled=true;rc.save();rc.translate(ORIGIN,ORIGIN);drawVectorCat(rc,p,a,pose,t);rc.restore();
  c.save();c.imageSmoothingEnabled=false;c.drawImage(rasterCanvas,-ORIGIN,-ORIGIN);c.restore();
}
