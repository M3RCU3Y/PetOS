import { SPECIES } from "../core/species.js";
import { isAdoptionAnniversary } from "../core/pet.js";
import type { PetAppearance, PetState, Rect, Species, Vec2 } from "../core/types.js";
import { drawIllustratedCat, type IllustratedCatPose } from "./catMotion.js";
import { drawCozyObjectBack, drawCozyObjectFront } from "./cozyHabitat.js";
import { PixelRenderer as LegacyPixelRenderer, buildPreviewState as legacyBuildPreviewState, renderPetPreview as legacyRenderPetPreview } from "./legacyRenderer.js";
import type { RenderScene } from "./legacyRenderer.js";

export { resolveSheetAnimation, preloadSheet, buildPreviewState } from "./legacyRenderer.js";
export type { RenderScene } from "./legacyRenderer.js";

const TAU=Math.PI*2;
function hash01(id:string):number{let h=2166136261;for(const ch of id){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;}
function clamp(v:number,a=0,b=1):number{return Math.max(a,Math.min(b,v));}
function smoothstep(v:number):number{const q=clamp(v);return q*q*(3-2*q);}
function catUsesIllustratedPath(pet:PetState,appearance:PetAppearance):boolean{return pet.species==="cat"&&!appearance.sheet;}
function cozyCatAppearance(a:PetAppearance):PetAppearance{return a.markings?a:{...a,markings:"tabby"};}
function recentTouchAge(p:PetState,now=Date.now()):number{return typeof p.lastInteractionMs==="number"?now-p.lastInteractionMs:Infinity;}

function blinkOpen(t:number,phase:number,relaxed:boolean):number{
  const period=relaxed?5200:3850;
  const q=((t+phase*19)%period)/period;
  const start=relaxed?.84:.905;
  if(q<start)return 1;
  const u=(q-start)/(1-start);
  if(u<.3)return 1-smoothstep(u/.3)*.93;
  if(u<.52)return .07;
  return .07+smoothstep((u-.52)/.48)*.93;
}

function computeCatPose(p:PetState,t:number,phase:number,cursor?:Vec2,reducedMotion=false):IllustratedCatPose{
  const b=p.behavior,speed=Math.abs(p.body.velocity.x),fast=speed>110,walking=speed>8&&!fast,airborne=!p.body.grounded;
  const sleeping=b==="sleep"||b==="cuddle",feeding=b==="eat"||b==="drink",stalking=b==="stalk",investigating=b==="investigate",stretching=b==="stretch",motionScale=reducedMotion?.4:1;
  const touchAge=recentTouchAge(p),recentlyTouched=touchAge>=0&&touchAge<1100&&!p.body.held&&b!=="seek_user";
  const pleased=recentlyTouched&&p.affect.valence>.28&&p.affect.stress<.4;
  const tenseHeld=p.body.held&&p.affect.stress>.22;
  const calmIdle=b==="idle"&&p.body.grounded&&p.affect.stress<.22&&p.affect.arousal<.38;
  const idleCycle=((t+phase*11)%18_000)/18_000;
  const loaf=calmIdle&&p.affect.arousal<.31&&idleCycle>.46&&idleCycle<.77;
  const settling=calmIdle&&!loaf&&idleCycle>.31&&idleCycle<.43;
  const relaxed=sleeping||loaf||p.affect.arousal<.3||pleased;

  let eyeOpen=sleeping?0:blinkOpen(t,phase,relaxed);
  if(b==="startle")eyeOpen=1;
  if(b==="hide")eyeOpen=Math.min(eyeOpen,.55);
  if(stretching)eyeOpen=Math.min(eyeOpen,.78);
  if(pleased&&!sleeping)eyeOpen=Math.min(eyeOpen,.58);
  if(settling)eyeOpen=Math.min(eyeOpen,.88);

  let pupilX=0,pupilY=0;
  if(!sleeping){
    if(pleased){pupilX=.18;pupilY=.08;}
    else if(b==="idle"||b==="sit"||b==="perch"){
      pupilX=Math.sin(t/2450+phase)*.54;
      pupilY=Math.sin(t/3300+phase*2)*.16;
    }else if(cursor&&b!=="walk"){
      const dx=cursor.x-p.body.position.x,dy=cursor.y-(p.body.position.y-SPECIES.cat.movement.bodyHeight);
      if(Math.hypot(dx,dy)<340){pupilX=clamp(dx/240,-1,1);pupilY=clamp(dy/240,-1,1);}
    }
  }

  const happy=["play_pet","play_fight","play_toy","greet_pet","zoomies","seek_user","carry_toy"].includes(b)||pleased;
  const scared=b==="startle"||p.affect.stress>.6||tenseHeld;
  const quietTail=stalking||investigating||stretching||loaf;
  const earCycle=((t+phase*23)%7600)/7600;
  const earTwitch=earCycle>.962?Math.sin((earCycle-.962)/.038*Math.PI)*1.65:0;
  const idleTail=calmIdle?1.7:2.8;

  return{
    lying:sleeping,sitting:b==="sit"||b==="perch"||b==="groom",vertical:b==="climb",hanging:b==="hang",peeking:b==="peek",
    crouch:stalking?.85:b==="hide"?.9:feeding?.32:investigating?.38:stretching?.12:settling?.08:pleased?.06:(b==="pounce"&&p.body.grounded)?1:0,
    bow:stretching?1:["play_pet","play_fight"].includes(b)?.85:b==="greet_pet"?.55:settling?.05:pleased?.18:0,
    arch:b==="startle"?1:(scared&&b==="idle"?.3:0),
    headDip:feeding?.9:investigating?.72:stretching?.12:settling?.11:pleased?.08:0,
    headBob:feeding?Math.sin(t/170)*2:investigating?Math.sin(t/360)*.48:b==="groom"?Math.sin(t/150)*2.5:settling?Math.sin(t/540)*.28:pleased?Math.sin(t/190)*.55:0,
    eyeOpen,pupilX,pupilY,earBack:tenseHeld?1:scared?.88:(p.affect.stress>.35?.5:0),earTwitch,
    tailLift:stalking?-.42:investigating?.12:stretching?.58:pleased?1:happy?1:scared?-1:loaf?.18:.3,
    tailWagAmp:stalking?1.25:investigating?1.4:stretching?2:loaf?.7:pleased?3.8:happy?6.5:p.affect.valence>.35?idleTail:2.2,
    tailFast:quietTail?false:pleased?false:happy||p.affect.arousal>.7,
    gait:(t+phase)/(fast?80:walking?140:180),legAmp:airborne?0:(fast?4:walking?3:0)*motionScale,bounce:airborne?0:Math.abs(Math.sin((fast?t/80:t/140)+phase))*(fast?2.5:walking?1.8:0)*motionScale,
    puff:b==="startle",carry:b==="carry_toy",pawReach:b==="play_toy"?(p.body.grounded?Math.sin(t/110):0):(b==="scratch"?(Math.sin(t/90)*.5+.5):0),
    grooming:b==="groom",licking:b==="groom"||b==="drink",pouncing:b==="pounce",loaf
  };
}

function paintIllustratedCat(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pos:Vec2,t:number,cursor?:Vec2,reducedMotion=false):void{
  const pose=computeCatPose(p,t,hash01(p.id)*10000,cursor,reducedMotion);if(isAdoptionAnniversary(p,Date.now()))pose.party=true;
  const art=cozyCatAppearance(a),touchAge=recentTouchAge(p),pleased=touchAge>=0&&touchAge<1100&&!p.body.held&&p.behavior!=="seek_user"&&p.affect.valence>.28&&p.affect.stress<.4;
  let sy=1,sx=1;
  if(!p.body.grounded){sy=Math.min(1.15,1+Math.abs(p.body.velocity.y)*.00042);sx=Math.pow(sy,-.68);}
  if(pose.lying)sy*=1+Math.sin(t/620)*.018;
  if(p.behavior==="stretch"){sx*=1.08;sy*=.94;}
  if(pleased&&p.body.grounded){sx*=1.012;sy*=.992;}
  c.save();c.translate(Math.round(pos.x),Math.round(pos.y));c.scale(p.body.facing*sx*art.scale,sy*art.scale);drawIllustratedCat(c,p,art,pose,t);c.restore();
}

function drawCatShadow(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pos:Vec2):void{if(!p.body.grounded)return;c.save();c.fillStyle="rgba(0,0,0,.16)";c.beginPath();c.ellipse(pos.x,pos.y+1,25*a.scale,3.8*a.scale,0,0,TAU);c.fill();c.restore();}
function drawPixelHeart(c:CanvasRenderingContext2D,x:number,y:number,size:number,alpha:number):void{
  const s=Math.max(1,Math.round(size));c.save();c.globalAlpha=alpha;c.fillStyle="#ef8f8f";
  const blocks:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[[0,0],[2,0],[-1,1],[1,1],[3,1],[0,2],[2,2]];
  for(const [bx,by] of blocks)c.fillRect(Math.round(x+bx*s),Math.round(y+by*s),s,s);
  c.fillRect(Math.round(x+s),Math.round(y+3*s),s,s);c.restore();
}
function drawCatEffects(c:CanvasRenderingContext2D,p:PetState,pos:Vec2,t:number,scene:RenderScene):void{
  const mv=SPECIES.cat.movement,wallNow=Date.now();
  if(p.behavior==="sleep"||p.behavior==="cuddle"){
    c.textAlign="left";for(let i=0;i<3;i++){const prog=((t/1300)+i/3)%1;c.globalAlpha=(1-prog)*.6;c.fillStyle="#cfd8ec";c.font=`bold ${8+i*3}px ui-monospace,monospace`;c.fillText("z",pos.x+mv.bodyWidth*.3+prog*12,pos.y-27-prog*20-i*4);}c.globalAlpha=1;
  }
  const startleAge=wallNow-p.behaviorSinceMs;
  if(p.behavior==="startle"&&startleAge>=0&&startleAge<900){c.globalAlpha=1-startleAge/900;c.fillStyle="#ffd76e";c.font="bold 14px ui-monospace,monospace";c.textAlign="center";c.fillText("!",pos.x+p.body.facing*13,pos.y-mv.bodyHeight-18-Math.sin(startleAge/120)*2);c.globalAlpha=1;}
  const touchAge=recentTouchAge(p,wallNow);
  if(touchAge>=0&&touchAge<1050&&!p.body.held&&p.behavior!=="seek_user"&&p.affect.valence>.32&&p.affect.stress<.4){
    const q=touchAge/1050;
    for(let i=0;i<3;i++){const local=clamp(q-i*.12);if(local<=0&&i>0)continue;const drift=Math.sin((t/220)+i*2.1)*2.2;drawPixelHeart(c,pos.x+p.body.facing*(11+i*8)+drift,pos.y-48-i*8-local*14,1+i*.15,(1-local)*(.78-i*.12));}
  }
  if(p.body.held&&p.affect.stress>.22){c.save();c.strokeStyle="rgba(247,205,139,.78)";c.lineWidth=1.4;c.lineCap="square";const x=pos.x+p.body.facing*19,y=pos.y-48;for(let i=0;i<3;i++){c.beginPath();c.moveTo(x+i*5,y-i*5);c.lineTo(x+i*7+3,y-i*8-4);c.stroke();}c.restore();}
  if(scene.debug){const d=scene.decisions[p.id],text=`${p.name} • ${p.behavior} • F${p.drives.fatigue.toFixed(2)} P${p.drives.play.toFixed(2)}`;c.font="11px ui-monospace,monospace";c.textAlign="left";c.fillStyle="rgba(10,12,18,.78)";c.fillRect(pos.x-5,pos.y-86,Math.max(190,text.length*6.4),34);c.fillStyle="#f5f7ff";c.fillText(text,pos.x,pos.y-71);if(d){c.fillStyle="#aab2ca";c.fillText(d.reason.slice(0,42),pos.x,pos.y-58);}}
  c.globalAlpha=1;c.textAlign="left";
}

export class PixelRenderer extends LegacyPixelRenderer{
  private illustratedAppearances=new Map<string,PetAppearance>();private legacyCanvas:HTMLCanvasElement|null=null;private legacyLayer:LegacyPixelRenderer|null=null;
  private getLegacyLayer():LegacyPixelRenderer|null{if(typeof document==="undefined")return null;if(!this.legacyCanvas){this.legacyCanvas=document.createElement("canvas");this.legacyLayer=new LegacyPixelRenderer(this.legacyCanvas);}return this.legacyLayer;}
  override render(scene:RenderScene):void{
    this.illustratedAppearances=new Map(scene.appearances);
    super.render({...scene,pets:[],objects:[]});
    const c=this.canvas.getContext("2d");if(!c)return;
    const ox=-scene.virtualBounds.x,oy=-scene.virtualBounds.y,t=performance.now();
    const habitat=[...scene.objects].sort((a,b)=>a.position.y-b.position.y);
    for(const object of habitat)drawCozyObjectBack(c,object,{x:object.position.x+ox,y:object.position.y+oy},t);
    const ordered=[...scene.pets].sort((a,b)=>a.body.position.y-b.body.position.y);const legacyLayer=this.getLegacyLayer();const {weather:_weather,objects:_objects,pets:_pets,...petSceneBase}=scene;
    for(const pet of ordered){
      const a=scene.appearances.get(pet.id)??{coat:"#d77b36",accent:"#f2bf7d",eye:"#d9ef73",scale:1};
      if(catUsesIllustratedPath(pet,a)){const pos={x:pet.body.position.x+ox,y:pet.body.position.y+oy},cursor=scene.cursor?{x:scene.cursor.x+ox,y:scene.cursor.y+oy}:undefined;drawCatShadow(c,pet,a,pos);paintIllustratedCat(c,pet,a,pos,t,cursor,scene.reducedMotion===true);drawCatEffects(c,pet,pos,t,scene);continue;}
      if(!legacyLayer||!this.legacyCanvas)continue;const onePetScene:RenderScene={...petSceneBase,pets:[pet],objects:[]};legacyLayer.render(onePetScene);c.save();c.imageSmoothingEnabled=false;c.drawImage(this.legacyCanvas,0,0,this.legacyCanvas.width,this.legacyCanvas.height,0,0,innerWidth,innerHeight);c.restore();
    }
    for(const object of habitat)drawCozyObjectFront(c,object,{x:object.position.x+ox,y:object.position.y+oy},t);
  }
  override hitTest(pet:PetState,point:Vec2,bounds:Rect):boolean{
    const a=this.illustratedAppearances.get(pet.id)??{coat:"#d77b36",accent:"#f2bf7d",eye:"#d9ef73",scale:1};if(!catUsesIllustratedPath(pet,a))return this.legacyLayer?.hitTest(pet,point,bounds)??super.hitTest(pet,point,bounds);const x=pet.body.position.x-bounds.x,y=pet.body.position.y-bounds.y,s=a.scale;
    if(pet.behavior==="hang")return point.x>=x-28*s&&point.x<=x+28*s&&point.y>=y-28*s&&point.y<=y+58*s;if(pet.behavior==="climb")return point.x>=x-48*s&&point.x<=x+32*s&&point.y>=y-42*s&&point.y<=y+38*s;if(pet.behavior==="peek")return point.x>=x-30*s&&point.x<=x+30*s&&point.y>=y-46*s&&point.y<=y+7*s;if(pet.behavior==="pounce"&&!pet.body.grounded)return point.x>=x-52*s&&point.x<=x+55*s&&point.y>=y-48*s&&point.y<=y+15*s;return point.x>=x-35*s&&point.x<=x+39*s&&point.y>=y-64*s&&point.y<=y+5*s;
  }
}

export function renderPetPreview(canvas:HTMLCanvasElement,species:Species,appearance:PetAppearance,behavior:string,t:number):void{
  if(species!=="cat"||appearance.sheet){legacyRenderPetPreview(canvas,species,appearance,behavior,t);return;}const c=canvas.getContext("2d");if(!c)return;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);c.imageSmoothingEnabled=true;const groundY=canvas.height*.9,state=legacyBuildPreviewState(species,behavior),pos={x:canvas.width/2,y:groundY};const art=cozyCatAppearance(appearance);drawCatShadow(c,state,art,pos);paintIllustratedCat(c,state,art,pos,t);
}
