import { SPECIES } from "../core/species.js";
import type { PetAppearance, PetState, Rect, Vec2, WorldObject } from "../core/types.js";

export interface RenderScene { pets:PetState[]; appearances:Map<string,PetAppearance>; objects:WorldObject[]; debug:boolean; decisions:Record<string,{behavior:string;reason:string;score:number}>; virtualBounds:Rect; }

export class PixelRenderer {
  private ctx:CanvasRenderingContext2D;
  private dpr=1;
  constructor(readonly canvas:HTMLCanvasElement){const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas unavailable");this.ctx=ctx;this.ctx.imageSmoothingEnabled=false;this.resize();window.addEventListener("resize",()=>this.resize());}
  resize():void{this.dpr=Math.max(1,devicePixelRatio||1);const w=innerWidth,h=innerHeight;this.canvas.width=Math.floor(w*this.dpr);this.canvas.height=Math.floor(h*this.dpr);this.canvas.style.width=`${w}px`;this.canvas.style.height=`${h}px`;this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.ctx.imageSmoothingEnabled=false;}
  render(scene:RenderScene):void{const c=this.ctx;c.clearRect(0,0,innerWidth,innerHeight);const ox=-scene.virtualBounds.x,oy=-scene.virtualBounds.y;for(const object of scene.objects)this.drawObject(object,{x:object.position.x+ox,y:object.position.y+oy});for(const pet of scene.pets){const app=scene.appearances.get(pet.id)??{coat:"#d77b36",accent:"#f2bf7d",eye:"#d9ef73",scale:1};this.drawPet(pet,app,{x:pet.body.position.x+ox,y:pet.body.position.y+oy});if(scene.debug)this.drawDebug(pet,scene.decisions[pet.id],{x:pet.body.position.x+ox,y:pet.body.position.y+oy});}}
  hitTest(pet:PetState,point:Vec2,bounds:Rect):boolean{const profile=SPECIES[pet.species].movement,s=1.3;const x=pet.body.position.x-bounds.x,y=pet.body.position.y-bounds.y;return point.x>=x-profile.bodyWidth*s/2&&point.x<=x+profile.bodyWidth*s/2&&point.y>=y-profile.bodyHeight*s&&point.y<=y+8;}

  private drawPet(p:PetState,a:PetAppearance,pos:Vec2):void{
    const c=this.ctx;
    const t=performance.now();
    const moving=["walk","run","zoomies","chase_cursor"].includes(p.behavior);
    const sleeping=p.behavior==="sleep";
    const breathe=sleeping?1+Math.sin(t/600)*0.03:1;
    const scale=a.scale*breathe;
    c.save();c.translate(Math.round(pos.x),Math.round(pos.y));c.scale(p.body.facing*scale,scale);
    const bounce=moving?Math.sin(t/(["run","zoomies"].includes(p.behavior)?55:90))*2:0;c.translate(0,bounce);
    const gaitPhase=t/(p.behavior==="run"||p.behavior==="zoomies"?80:140);
    const blink=Math.sin(t/3200)>0.97?0.15:1;
    const earTwitch=Math.sin(t/2800+pos.x*0.01)>0.95?2:0;
    if(p.species==="cat")this.cat(p,a,t,gaitPhase,moving,sleeping,blink,earTwitch);
    else if(p.species==="dog")this.dog(p,a,t,gaitPhase,moving,sleeping,blink);
    else if(p.species==="rabbit")this.rabbit(p,a,t,gaitPhase,moving,sleeping,blink,earTwitch);
    else this.bird(p,a,t,moving,sleeping);
    c.restore();
  }
  private cat(p:PetState,a:PetAppearance,t:number,gait:number,moving:boolean,sleeping:boolean,blink:number,earTwitch:number):void{
    const c=this.ctx;
    if(sleeping){
      const chest=Math.sin(t/600)*1.5;
      c.fillStyle=a.coat;c.fillRect(-20,-18,38,16+chest);c.fillRect(-14,-24,17,12);
      c.fillStyle=a.accent;c.fillRect(-18,-21,4,5);c.fillRect(-3,-21,4,5);
      return;
    }
    const tailSway=Math.sin(t/400)*4;
    c.fillStyle=a.coat;c.fillRect(-20,-30,38,23);c.fillRect(8,-42,24,21);
    c.fillRect(-29,-26+tailSway*.5,11,8);c.fillRect(-35,-31+tailSway,8,6);
    c.fillRect(12,-50+earTwitch,7,11);c.fillRect(25,-50+earTwitch,7,11);
    if(moving){const legOffset=Math.sin(gait)*3;
      c.fillRect(-14,-9,7,10+legOffset);c.fillRect(8,-9,7,10-legOffset);}
    else{c.fillRect(-14,-9,7,10);c.fillRect(8,-9,7,10);}
    c.fillStyle=a.accent;c.fillRect(14,-37,15,11);
    c.fillStyle=a.eye;c.globalAlpha=blink;
    c.fillRect(18,-37,3,3);c.fillRect(26,-37,3,3);
    c.globalAlpha=1;
    if(["chase_cursor","pounce","zoomies"].includes(p.behavior)){
      c.fillStyle="#111";c.fillRect(19,-37,1,4);c.fillRect(27,-37,1,4);
    }
  }
  private dog(p:PetState,a:PetAppearance,t:number,gait:number,moving:boolean,sleeping:boolean,blink:number):void{
    const c=this.ctx;
    if(sleeping){c.fillStyle=a.coat;c.fillRect(-23,-18,42,16);c.fillRect(-14,-24,19,12);
      c.fillStyle=a.accent;c.fillRect(-18,-21,4,5);c.fillRect(-2,-21,4,5);return;}
    const tailWag=Math.sin(t/(moving?150:300))*6;
    c.fillStyle=a.coat;c.fillRect(-23,-31,42,24);c.fillRect(7,-42,28,23);
    c.fillRect(-31,-26+tailWag*.4,10,8);
    c.fillStyle=a.accent;c.fillRect(9,-48,9,17);c.fillRect(29,-47,8,16);
    c.fillRect(27,-34,14,9);
    if(moving){const legOffset=Math.sin(gait)*3.5;
      c.fillStyle=a.coat;c.fillRect(-15,-9,8,11+legOffset);c.fillRect(9,-9,8,11-legOffset);}
    else{c.fillStyle=a.coat;c.fillRect(-15,-9,8,11);c.fillRect(9,-9,8,11);}
    c.fillStyle=a.eye;c.globalAlpha=blink;c.fillRect(26,-39,3,3);c.globalAlpha=1;
  }
  private rabbit(p:PetState,a:PetAppearance,t:number,gait:number,moving:boolean,sleeping:boolean,blink:number,earTwitch:number):void{
    const c=this.ctx;
    if(sleeping){c.fillStyle=a.coat;c.fillRect(-19,-18,34,16);c.fillRect(-10,-24,17,12);
      c.fillStyle=a.accent;c.fillRect(-14,-21,4,5);c.fillRect(-2,-21,4,5);return;}
    c.fillStyle=a.coat;c.fillRect(-19,-27,34,20);c.fillRect(7,-39,22,20);
    c.fillRect(10,-61+earTwitch,7,24);c.fillRect(21,-62+earTwitch,7,25);
    c.fillStyle=a.accent;c.fillRect(12,-58,3,17);c.fillRect(23,-59,3,18);
    c.fillRect(-27,-23,9,9);c.fillStyle=a.eye;c.globalAlpha=blink;c.fillRect(22,-35,3,3);c.globalAlpha=1;
    if(moving){const hop=Math.sin(gait*1.5)*2;
      c.fillStyle=a.coat;c.fillRect(-19,-27-hop,34,20);}
  }
  private bird(p:PetState,a:PetAppearance,t:number,moving:boolean,sleeping:boolean):void{
    const c=this.ctx;
    if(sleeping){c.fillStyle=a.coat;c.fillRect(-15,-20,28,18);c.fillRect(7,-28,17,14);
      c.fillStyle=a.accent;c.fillRect(-5,-20,10,10);return;}
    const flap=moving?Math.sin(t/55)*7:Math.sin(t/300)*1.5;
    c.fillStyle=a.coat;c.fillRect(-15,-28,28,22);c.fillRect(7,-36,17,16);
    c.fillRect(-24,-25,11,6);
    c.fillStyle=a.accent;c.fillRect(-5,-28,10,12);
    c.fillRect(-10,-25-flap,7,13);
    c.fillStyle="#e0a64a";c.fillRect(23,-31,9,5);
    c.fillStyle=a.eye;c.fillRect(17,-33,3,3);
    c.fillStyle="#9a7448";c.fillRect(-3,-7,3,8);c.fillRect(7,-7,3,8);
  }
  private drawObject(o:WorldObject,p:Vec2):void{const c=this.ctx;if(o.kind==="ball"){c.beginPath();c.arc(p.x,p.y,o.radius,0,Math.PI*2);c.fillStyle="#d85b58";c.fill();}else if(o.kind==="bed"){c.fillStyle="#725b92";c.fillRect(p.x-o.radius,p.y-o.radius/2,o.radius*2,o.radius);c.fillStyle="#a58cc5";c.fillRect(p.x-o.radius*.7,p.y-o.radius*.36,o.radius*1.4,o.radius*.55);}else if(o.kind==="box"){c.fillStyle="#b9854d";c.fillRect(p.x-o.radius,p.y-o.radius,o.radius*2,o.radius*2);c.fillStyle="#8b6036";c.fillRect(p.x-o.radius*.55,p.y-o.radius*.55,o.radius*1.1,o.radius*.6);}else if(o.kind==="bowl"){c.fillStyle=o.contents==="water"?"#5f9fc8":"#b9654d";c.fillRect(p.x-o.radius,p.y-5,o.radius*2,9);c.fillStyle=o.contents==="water"?"#9ad7ee":"#d9a45f";c.fillRect(p.x-o.radius*.7,p.y-7,o.radius*1.4,4);}else if(o.kind==="scratcher"){c.fillStyle="#805a3e";c.fillRect(p.x-4,p.y-o.radius*2,8,o.radius*2);c.fillStyle="#a67a54";c.fillRect(p.x-o.radius,p.y-5,o.radius*2,7);c.fillRect(p.x-10,p.y-o.radius*2,20,5);}}
  private drawDebug(p:PetState,d:RenderScene["decisions"][string]|undefined,pos:Vec2):void{const c=this.ctx;c.save();c.font="11px ui-monospace, monospace";const text=`${p.name} • ${p.behavior} • F${p.drives.fatigue.toFixed(2)} P${p.drives.play.toFixed(2)}`;c.fillStyle="rgba(10,12,18,.78)";c.fillRect(pos.x-5,pos.y-79,Math.max(190,text.length*6.4),34);c.fillStyle="#f5f7ff";c.fillText(text,pos.x,pos.y-64);if(d){c.fillStyle="#aab2ca";c.fillText(d.reason.slice(0,42),pos.x,pos.y-51);}c.restore();}
}
