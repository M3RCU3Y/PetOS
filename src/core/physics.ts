import { clamp, distance } from "./math.js";
import { buildSurfaceGraph, planRoute, type PathEdge } from "./pathfinding.js";
import { SPECIES } from "./species.js";
import type { PetState, Surface, Vec2, WorldSnapshot } from "./types.js";

const HANG_MS = 1400;
const PEEK_MS = 1200;

interface ClimbContext { winId:string; x:number; phase:"climb"|"hang"|"peek"|"pullup" }
interface FlightState { target:Vec2; startedAt:number }
const MAX_FLIGHT_MS = 7000;

export class PetPhysics {
  private routeCache = new Map<string, { targetId:string; route:PathEdge[]; stepIndex:number }>();
  private climbs = new Map<string,ClimbContext>();
  private flights = new Map<string,FlightState>();

  update(state:PetState, world:WorldSnapshot, dtMs:number):void{
    const dt=Math.min(dtMs,50)/1000;
    const profile=SPECIES[state.species].movement;
    const body=state.body;
    if(body.held){body.velocity={x:0,y:0};this.flights.delete(state.id);this.climbs.delete(state.id);return;}
    const now=world.nowMs;

    if(this.flights.has(state.id)){
      if(this.updateFlight(state,world,dt)){this.clampIntoWorld(state,world);return;}
      this.clampIntoWorld(state,world);
    }
    if(this.climbs.has(state.id)){
      if(this.updateTraversal(state,world,dt,now)){this.clampIntoWorld(state,world);return;}
    }

    const target=this.resolveTarget(state,world);
    const isBird=state.species==="bird";
    const isRabbit=state.species==="rabbit";
    const behavior=state.behavior;
    const routedTarget=this.resolveRoutedTarget(state,world,target);

    if(behavior==="climb"&&!this.climbs.has(state.id)){
      const started=this.beginClimb(state,world,target);
      if(started)return;
    }

    if(isBird&&body.grounded&&(behavior==="walk"||behavior==="investigate"||behavior==="seek_user"||behavior==="follow_pet")&&target){
      const dy=target.y-body.position.y,dx=target.x-body.position.x;
      if((Math.abs(dy)>50&&Math.abs(dx)>90)||Math.abs(dy)>140){
        this.flights.set(state.id,{target:{...target},startedAt:now});
        body.grounded=false;body.surfaceId=null;
        body.velocity={x:Math.sign(dx)*profile.runSpeed*.8,y:-profile.jumpSpeed*.55};
        return;
      }
    }

    if(isRabbit&&(behavior==="walk"||behavior==="investigate")&&body.grounded&&Math.sin(world.nowMs/300)>0.7){
      this.jump(state,target??undefined);
    }

    const locomotion=["walk","investigate","seek_user","follow_pet","play_toy","play_pet","greet_pet","hide","perch","eat","drink","scratch","carry_toy","peek","cuddle"].includes(behavior);
    const stalking=behavior==="stalk";
    const fast=["run","chase_cursor","zoomies","pounce","play_fight"].includes(behavior);

    if((target&&(locomotion||fast))||stalking){
      const tx=stalking?(target??world.cursor.position).x:target!.x;
      const ty=stalking?(target??world.cursor.position).y:target!.y;
      const dx=tx-body.position.x;
      const baseSpeed=stalking?profile.walkSpeed*.45:fast?profile.runSpeed:profile.walkSpeed;
      const speed=locomotion&&behavior==="hide"?baseSpeed*.6:baseSpeed;
      body.facing=dx<0?-1:1;
      body.velocity.x=Math.abs(dx)<(stalking?3:4)?0:Math.sign(dx)*speed;
      if(target&&Math.abs(ty-body.position.y)>42&&body.grounded&&!routedTarget&&!stalking)this.jump(state,target);
    }else if(["idle","sit","sleep","groom","stretch","startle","hang"].includes(behavior)){
      body.velocity.x*=Math.pow(.03,dt);
    }
    if(behavior==="zoomies"&&Math.abs(body.velocity.x)<20)body.velocity.x=body.facing*profile.runSpeed;
    if(!body.grounded){
      if(this.flights.has(state.id)){
        body.velocity.y+=profile.gravity*dt*.25;
      }else if(isBird&&["perch","investigate","seek_user","follow_pet","stalk"].includes(behavior)&&body.velocity.y<0){
        body.velocity.y+=profile.gravity*dt*.3;
      }else{
        body.velocity.y+=profile.gravity*dt;
      }
    }
    body.position.x+=body.velocity.x*dt;
    body.position.y+=body.velocity.y*dt;
    this.resolveCollisions(state,world.surfaces,now);
    const bounds=this.virtualBounds(world);
    body.position.x=clamp(body.position.x,bounds.x+10,bounds.x+bounds.width-10);
    if(body.position.y>bounds.y+bounds.height+160){
      const floor=world.surfaces.filter(s=>s.kind==="taskbar"||s.kind==="monitor_floor").sort((a,b)=>Math.abs(a.rect.x-body.position.x)-Math.abs(b.rect.x-body.position.x))[0];
      if(floor){body.position={x:clamp(body.position.x,floor.rect.x,floor.rect.x+floor.rect.width),y:floor.walkY};body.velocity={x:0,y:0};body.grounded=true;body.surfaceId=floor.id;}
    }
    if(target&&distance(body.position,target)<18&&locomotion)body.velocity.x=0;
  }

  jump(state:PetState,target?:Vec2):void{
    if(!state.body.grounded)return;
    const m=SPECIES[state.species].movement;
    state.body.velocity.y=-m.jumpSpeed;
    if(target){const dx=target.x-state.body.position.x;state.body.velocity.x=Math.sign(dx||1)*Math.min(m.runSpeed,Math.abs(dx)*1.8);}
    state.body.grounded=false;state.body.surfaceId=null;
  }

  private beginClimb(state:PetState,world:WorldSnapshot,target:Vec2|null):boolean{
    if(!state.body.grounded)return false;
    const candidates=world.surfaces.filter(s=>s.kind==="window"&&s.rect.height>60);
    let best:{s:Surface;x:number;d:number}|null=null;
    for(const s of candidates){
      const leftD=Math.abs(s.rect.x-state.body.position.x);
      const rightD=Math.abs(s.rect.x+s.rect.width-state.body.position.x);
      for(const [d,x] of [[leftD,s.rect.x],[rightD,s.rect.x+s.rect.width]] as Array<[number,number]>){
        if(d<70&&(!best||d<best.d))best={s,x,d};
      }
    }
    if(!best)return false;
    this.climbs.set(state.id,{winId:best.s.id,x:best.x,phase:"climb"});
    state.body.facing=best.x>state.body.position.x?1:-1;
    state.body.target=target?{...target}:{x:best.x,y:best.s.walkY};
    return true;
  }

  private updateTraversal(state:PetState,world:WorldSnapshot,dt:number,now:number):boolean{
    const ctx=this.climbs.get(state.id)!;
    const surface=world.surfaces.find(s=>s.id===ctx.winId);
    const body=state.body;
    if(!surface){
      this.climbs.delete(state.id);
      body.grounded=false;body.surfaceId=null;
      state.behavior="startle";
      state.behaviorSinceMs=now;
      body.target=null;
      return false;
    }
    const profile=SPECIES[state.species].movement;
    body.velocity={x:0,y:0};
    body.grounded=false;body.surfaceId=null;

    if(ctx.phase==="climb"){
      const climbSpeed=profile.walkSpeed*.75;
      body.position.x+=(ctx.x-body.position.x)*Math.min(1,dt*12);
      const goalY=body.target?body.target.y:surface.walkY;
      const desired=Math.min(goalY,surface.walkY+6);
      if(desired<body.position.y)body.position.y-=climbSpeed*dt;
      else body.position.y+=climbSpeed*dt*.7;
      if(body.position.y<=surface.walkY+4||body.position.y>=surface.rect.y+surface.rect.height+30){
        ctx.phase="hang";
        state.behavior="hang";
        state.behaviorSinceMs=now;
      }
      return true;
    }
    body.position.x+=(ctx.x-body.position.x)*Math.min(1,dt*14);
    body.position.y=surface.walkY+SPECIES[state.species].movement.bodyHeight*.55;
    if(ctx.phase==="hang"&&now-state.behaviorSinceMs>HANG_MS){
      ctx.phase="peek";
      state.behavior="peek";
      state.behaviorSinceMs=now;
    }else if(ctx.phase==="peek"&&now-state.behaviorSinceMs>PEEK_MS){
      this.climbs.delete(state.id);
      body.grounded=true;body.surfaceId=surface.id;
      body.position.y=surface.walkY;
      body.target=null;
      state.behavior="perch";
      state.behaviorSinceMs=now;
      state.behaviorTargetId=null;
    }
    return true;
  }

  private clampIntoWorld(state:PetState,world:WorldSnapshot):void{
    const b=this.virtualBounds(world);
    state.body.position.x=clamp(state.body.position.x,b.x+10,b.x+b.width-10);
    state.body.position.y=clamp(state.body.position.y,b.y-200,b.y+b.height+400);
  }

  private updateFlight(state:PetState,world:WorldSnapshot,dt:number):boolean{
    const flight=this.flights.get(state.id)!;
    const body=state.body;
    const profile=SPECIES[state.species].movement;
    if(["sleep","groom","sit"].includes(state.behavior)){this.flights.delete(state.id);return false;}
    if(world.nowMs-flight.startedAt>MAX_FLIGHT_MS){this.flights.delete(state.id);return false;}
    // If the flight target left the known desktop (monitor unplug, window closed), give up.
    const b=this.virtualBounds(world);
    if(flight.target.x<b.x-300||flight.target.x>b.x+b.width+300||flight.target.y<b.y-500||flight.target.y>b.y+b.height+600){
      this.flights.delete(state.id);
      return false;
    }
    const dx=flight.target.x-body.position.x;
    const dy=flight.target.y-body.position.y;
    body.facing=dx<0?-1:1;
    body.velocity.x=Math.sign(dx)*Math.min(profile.runSpeed*1.15,Math.abs(dx)*2.2+40);
    if(dy<-26)body.velocity.y=-95;
    else{body.velocity.y+=profile.gravity*dt*.28;if(body.velocity.y>170)body.velocity.y=170;}
    body.grounded=false;
    body.position.x+=body.velocity.x*dt;
    body.position.y+=body.velocity.y*dt;
    this.resolveCollisions(state,world.surfaces,world.nowMs);
    if(body.grounded||dy>400)this.flights.delete(state.id);
    return true;
  }

  private resolveRoutedTarget(state:PetState,world:WorldSnapshot,directTarget:Vec2|null):Vec2|null{
    if(!directTarget||!state.body.grounded)return directTarget;
    const currentSurface=state.body.surfaceId;
    if(!currentSurface)return directTarget;
    const targetSurface=world.surfaces.find(s=>{
      return directTarget.x>=s.rect.x&&directTarget.x<=s.rect.x+s.rect.width&&Math.abs(directTarget.y-s.walkY)<20;
    });
    if(!targetSurface||targetSurface.id===currentSurface)return directTarget;
    const cached=this.routeCache.get(state.id);
    if(cached&&cached.targetId===targetSurface.id)return this.advanceRoute(state,cached,world.surfaces);
    const graph=buildSurfaceGraph(world.surfaces,SPECIES[state.species].movement.jumpSpeed,220,SPECIES[state.species].climber===true);
    const route=planRoute(graph,currentSurface,targetSurface.id);
    if(!route.length)return directTarget;
    const entry={targetId:targetSurface.id,route,stepIndex:0};
    this.routeCache.set(state.id,entry);
    return this.advanceRoute(state,entry,world.surfaces);
  }

  private advanceRoute(state:PetState,entry:{targetId:string;route:PathEdge[];stepIndex:number},surfaces:Surface[]):Vec2|null{
    if(entry.stepIndex>=entry.route.length){this.routeCache.delete(state.id);return null;}
    const edge:PathEdge|undefined=entry.route[entry.stepIndex];
    if(!edge){this.routeCache.delete(state.id);return null;}
    const body=state.body;
    if(body.surfaceId===edge.from){
      if(Math.abs(body.position.x-edge.launchPoint.x)<16){
        if(edge.kind==="climb"){
          const target=surfaces.find(s=>s.id===edge.to);
          if(target){
            this.climbs.set(state.id,{winId:edge.to,x:edge.launchPoint.x,phase:"climb"});
            body.grounded=false;body.surfaceId=null;
            body.target={x:edge.landingPoint.x,y:target.walkY};
            state.behavior="climb";
            state.behaviorSinceMs=Date.now();
            entry.stepIndex++;
            if(entry.stepIndex>=entry.route.length)this.routeCache.delete(state.id);
            return null;
          }
        }
        this.jump(state,edge.landingPoint);
        entry.stepIndex++;
        if(entry.stepIndex>=entry.route.length){this.routeCache.delete(state.id);return null;}
        const next:PathEdge|undefined=entry.route[entry.stepIndex];
        if(!next){this.routeCache.delete(state.id);return null;}
        return next.landingPoint;
      }
      return edge.launchPoint;
    }
    entry.stepIndex++;
    if(entry.stepIndex>=entry.route.length){this.routeCache.delete(state.id);return null;}
    const nextStep:PathEdge|undefined=entry.route[entry.stepIndex];
    if(!nextStep){this.routeCache.delete(state.id);return null;}
    return nextStep.launchPoint;
  }

  private resolveTarget(state:PetState,world:WorldSnapshot):Vec2|null{
    if(state.body.target)return state.body.target;
    const targetId=state.behaviorTargetId;
    if(targetId){
      const object=world.objects.find(o=>o.id===targetId);if(object)return object.position;
      const pet=world.nearbyPets.find(p=>p.id===targetId);if(pet)return pet.position;
      const surface=world.surfaces.find(s=>s.id===targetId);if(surface)return{x:surface.rect.x+surface.rect.width/2,y:surface.walkY};
    }
    if(["chase_cursor","pounce","seek_user","stalk"].includes(state.behavior))return world.cursor.position;
    return null;
  }

  private resolveCollisions(state:PetState,surfaces:Surface[],nowMs:number):void{
    const body=state.body;
    if(body.velocity.y<0)return;
    let landing:Surface|null=null;
    let best=Infinity;
    for(const s of surfaces){
      if(body.position.x<s.rect.x-8||body.position.x>s.rect.x+s.rect.width+8)continue;
      const dy=s.walkY-body.position.y;
      if(dy>=-8&&dy<best&&dy<36){best=dy;landing=s;}
    }
    if(landing){
      const impact=body.velocity.y;
      body.position.y=landing.walkY;body.velocity.y=0;body.grounded=true;body.surfaceId=landing.id;
      if(impact>560&&!["sleep","eat","drink","startle","cuddle"].includes(state.behavior)){
        state.behavior="startle";
        state.behaviorSinceMs=nowMs;
        state.body.target=null;
      }
    }
    else if(body.grounded){
      const s=body.surfaceId?surfaces.find(x=>x.id===body.surfaceId):undefined;
      if(!s||body.position.x<s.rect.x-10||body.position.x>s.rect.x+s.rect.width+10){body.grounded=false;body.surfaceId=null;}
    }
  }

  private virtualBounds(world:WorldSnapshot){
    if(!world.monitors.length)return{x:0,y:0,width:1920,height:1080};
    const minX=Math.min(...world.monitors.map(m=>m.rect.x)),minY=Math.min(...world.monitors.map(m=>m.rect.y));
    const maxX=Math.max(...world.monitors.map(m=>m.rect.x+m.rect.width)),maxY=Math.max(...world.monitors.map(m=>m.rect.y+m.rect.height));
    return{x:minX,y:minY,width:maxX-minX,height:maxY-minY};
  }
}

export function nudgeToy(object:{position:{x:number;y:number}},from:Vec2,to:Vec2):void{
  const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy)||1;
  object.position.x+=dx/len*12;object.position.y+=dy/len*6;
}
