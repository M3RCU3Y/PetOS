import { SPECIES } from "../core/species.js";
import { isAdoptionAnniversary } from "../core/pet.js";
import type { PetAppearance, PetState, Rect, Species, Vec2 } from "../core/types.js";
import { drawIllustratedCat, type IllustratedCatPose } from "./illustratedCat.js";
import {
  PixelRenderer as LegacyPixelRenderer,
  buildPreviewState as legacyBuildPreviewState,
  renderPetPreview as legacyRenderPetPreview
} from "./legacyRenderer.js";
import type { RenderScene } from "./legacyRenderer.js";

export { resolveSheetAnimation, preloadSheet, buildPreviewState } from "./legacyRenderer.js";
export type { RenderScene } from "./legacyRenderer.js";

const TAU=Math.PI*2;
function hash01(id:string):number{
  let h=2166136261;
  for(const ch of id){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
  return(h>>>0)/4294967296;
}

function catUsesIllustratedPath(pet:PetState,appearance:PetAppearance):boolean{
  return pet.species==="cat"&&!appearance.sheet;
}

function computeCatPose(p:PetState,t:number,phase:number,cursor?:Vec2,reducedMotion=false):IllustratedCatPose{
  const b=p.behavior;
  const speed=Math.abs(p.body.velocity.x);
  const fast=speed>110;
  const walking=speed>8&&!fast;
  const airborne=!p.body.grounded;
  const sleeping=b==="sleep"||b==="cuddle";
  const feeding=b==="eat"||b==="drink";
  const stalking=b==="stalk";
  const motionScale=reducedMotion?.4:1;

  let eyeOpen=sleeping?0:((t/3400+phase/997)%1)>.96?.08:1;
  if(b==="startle")eyeOpen=1;
  if(b==="hide")eyeOpen=Math.min(eyeOpen,.55);

  let pupilX=0,pupilY=0;
  if(!sleeping){
    if(b==="idle"||b==="sit"||b==="perch"){
      pupilX=Math.sin(t/2300+phase)*.6;
      pupilY=Math.sin(t/3100+phase*2)*.2;
    }else if(cursor&&b!=="walk"){
      const dx=cursor.x-p.body.position.x;
      const dy=cursor.y-(p.body.position.y-SPECIES.cat.movement.bodyHeight);
      if(Math.hypot(dx,dy)<340){
        pupilX=Math.max(-1,Math.min(1,dx/240));
        pupilY=Math.max(-1,Math.min(1,dy/240));
      }
    }
  }

  const happy=["play_pet","play_fight","play_toy","greet_pet","zoomies","seek_user","carry_toy"].includes(b);
  const scared=b==="startle"||p.affect.stress>.6;
  return{
    lying:sleeping,
    sitting:b==="sit"||b==="perch"||b==="groom",
    vertical:b==="climb",
    hanging:b==="hang",
    peeking:b==="peek",
    crouch:stalking?.85:b==="hide"?.9:feeding?.32:(b==="pounce"&&p.body.grounded)?1:b==="investigate"?.25:0,
    bow:["stretch","play_pet","play_fight"].includes(b)?1:b==="greet_pet"?.55:0,
    arch:b==="startle"?1:(scared&&b==="idle"?.3:0),
    headDip:feeding?.9:(b==="investigate"&&p.body.grounded?.5:0),
    headBob:feeding?Math.sin(t/170)*2:b==="groom"?Math.sin(t/150)*2.5:0,
    eyeOpen,pupilX,pupilY,
    earBack:scared?1:(p.affect.stress>.35?.5:0),
    earTwitch:((t/2900+phase/777)%1)<.05?2:0,
    tailLift:stalking?-.42:happy?1:scared?-1:.3,
    tailWagAmp:stalking?1.25:happy?8:p.affect.valence>.35?5:3,
    tailFast:stalking?false:happy||p.affect.arousal>.7,
    gait:(t+phase)/(fast?80:140),
    legAmp:airborne?0:(fast?4:walking?3:0)*motionScale,
    bounce:airborne?0:Math.abs(Math.sin((fast?t/80:t/140)+phase))*(fast?2.5:walking?1.8:0)*motionScale,
    puff:b==="startle",
    carry:b==="carry_toy",
    pawReach:b==="play_toy"?(p.body.grounded?Math.sin(t/110):0):(b==="scratch"?(Math.sin(t/90)*.5+.5):0),
    grooming:b==="groom",
    licking:b==="groom"||b==="drink",
    pouncing:b==="pounce"
  };
}

function paintIllustratedCat(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pos:Vec2,t:number,cursor?:Vec2,reducedMotion=false):void{
  const pose=computeCatPose(p,t,hash01(p.id)*10000,cursor,reducedMotion);
  if(isAdoptionAnniversary(p,Date.now()))pose.party=true;

  let sy=1,sx=1;
  if(!p.body.grounded){
    sy=Math.min(1.15,1+Math.abs(p.body.velocity.y)*.00042);
    sx=Math.pow(sy,-.68);
  }
  if(pose.lying)sy*=1+Math.sin(t/620)*.018;

  c.save();
  c.translate(Math.round(pos.x),Math.round(pos.y));
  c.scale(p.body.facing*sx*a.scale,sy*a.scale);
  drawIllustratedCat(c,p,a,pose,t);
  c.restore();
}

function drawCatShadow(c:CanvasRenderingContext2D,p:PetState,a:PetAppearance,pos:Vec2):void{
  if(!p.body.grounded)return;
  c.save();
  c.fillStyle="rgba(0,0,0,.16)";
  c.beginPath();
  c.ellipse(pos.x,pos.y+1,25*a.scale,3.8*a.scale,0,0,TAU);
  c.fill();
  c.restore();
}

function drawCatEffects(c:CanvasRenderingContext2D,p:PetState,pos:Vec2,t:number,scene:RenderScene):void{
  const mv=SPECIES.cat.movement;
  if(p.behavior==="sleep"||p.behavior==="cuddle"){
    c.textAlign="left";
    for(let i=0;i<3;i++){
      const prog=((t/1300)+i/3)%1;
      c.globalAlpha=(1-prog)*.6;
      c.fillStyle="#cfd8ec";
      c.font=`bold ${8+i*3}px ui-monospace,monospace`;
      c.fillText("z",pos.x+mv.bodyWidth*.3+prog*12,pos.y-27-prog*20-i*4);
    }
    c.globalAlpha=1;
  }
  if(p.behavior==="startle"&&t-p.behaviorSinceMs<900){
    c.globalAlpha=1-(t-p.behaviorSinceMs)/900;
    c.fillStyle="#ffd76e";
    c.font="bold 14px ui-monospace,monospace";
    c.textAlign="center";
    c.fillText("!",pos.x+p.body.facing*13,pos.y-mv.bodyHeight-18);
    c.globalAlpha=1;
  }
  if(scene.debug){
    const d=scene.decisions[p.id];
    const text=`${p.name} • ${p.behavior} • F${p.drives.fatigue.toFixed(2)} P${p.drives.play.toFixed(2)}`;
    c.font="11px ui-monospace,monospace";
    c.textAlign="left";
    c.fillStyle="rgba(10,12,18,.78)";
    c.fillRect(pos.x-5,pos.y-86,Math.max(190,text.length*6.4),34);
    c.fillStyle="#f5f7ff";
    c.fillText(text,pos.x,pos.y-71);
    if(d){c.fillStyle="#aab2ca";c.fillText(d.reason.slice(0,42),pos.x,pos.y-58);}
  }
  c.globalAlpha=1;
  c.textAlign="left";
}

export class PixelRenderer extends LegacyPixelRenderer{
  private illustratedAppearances=new Map<string,PetAppearance>();

  override render(scene:RenderScene):void{
    this.illustratedAppearances=new Map(scene.appearances);
    const illustrated:PetState[]=[];
    const legacy:PetState[]=[];
    for(const pet of scene.pets){
      const appearance=scene.appearances.get(pet.id)??{coat:"#d77b36",accent:"#f2bf7d",eye:"#d9ef73",scale:1};
      if(catUsesIllustratedPath(pet,appearance))illustrated.push(pet);
      else legacy.push(pet);
    }

    super.render({...scene,pets:legacy});
    if(!illustrated.length)return;

    const c=this.canvas.getContext("2d");
    if(!c)return;
    const ox=-scene.virtualBounds.x,oy=-scene.virtualBounds.y;
    const t=performance.now();
    illustrated.sort((a,b)=>a.body.position.y-b.body.position.y);
    for(const pet of illustrated){
      const a=scene.appearances.get(pet.id)??{coat:"#d77b36",accent:"#f2bf7d",eye:"#d9ef73",scale:1};
      const pos={x:pet.body.position.x+ox,y:pet.body.position.y+oy};
      const cursor=scene.cursor?{x:scene.cursor.x+ox,y:scene.cursor.y+oy}:undefined;
      drawCatShadow(c,pet,a,pos);
      paintIllustratedCat(c,pet,a,pos,t,cursor,scene.reducedMotion===true);
      drawCatEffects(c,pet,pos,t,scene);
    }
  }

  override hitTest(pet:PetState,point:Vec2,bounds:Rect):boolean{
    const a=this.illustratedAppearances.get(pet.id)??{coat:"#d77b36",accent:"#f2bf7d",eye:"#d9ef73",scale:1};
    if(!catUsesIllustratedPath(pet,a))return super.hitTest(pet,point,bounds);
    const x=pet.body.position.x-bounds.x;
    const y=pet.body.position.y-bounds.y;
    const s=a.scale;
    if(pet.behavior==="hang")return point.x>=x-28*s&&point.x<=x+28*s&&point.y>=y-28*s&&point.y<=y+58*s;
    if(pet.behavior==="climb")return point.x>=x-48*s&&point.x<=x+32*s&&point.y>=y-42*s&&point.y<=y+38*s;
    if(pet.behavior==="peek")return point.x>=x-30*s&&point.x<=x+30*s&&point.y>=y-46*s&&point.y<=y+7*s;
    if(pet.behavior==="pounce"&&!pet.body.grounded)return point.x>=x-52*s&&point.x<=x+55*s&&point.y>=y-48*s&&point.y<=y+15*s;
    return point.x>=x-35*s&&point.x<=x+39*s&&point.y>=y-64*s&&point.y<=y+5*s;
  }
}

export function renderPetPreview(canvas:HTMLCanvasElement,species:Species,appearance:PetAppearance,behavior:string,t:number):void{
  if(species!=="cat"||appearance.sheet){
    legacyRenderPetPreview(canvas,species,appearance,behavior,t);
    return;
  }
  const c=canvas.getContext("2d");
  if(!c)return;
  c.setTransform(1,0,0,1,0,0);
  c.clearRect(0,0,canvas.width,canvas.height);
  c.imageSmoothingEnabled=true;
  const groundY=canvas.height*.9;
  const state=legacyBuildPreviewState(species,behavior);
  const pos={x:canvas.width/2,y:groundY};
  drawCatShadow(c,state,appearance,pos);
  paintIllustratedCat(c,state,appearance,pos,t);
}
