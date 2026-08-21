import { clamp, distance } from "./math.js";
import { buildSurfaceGraph, planRoute, type PathEdge } from "./pathfinding.js";
import { SPECIES } from "./species.js";
import type { PetState, Surface, Vec2, WorldObject, WorldSnapshot } from "./types.js";

export class PetPhysics {
  private routeCache = new Map<string, { targetId: string; route: PathEdge[]; stepIndex: number }>();
  update(state: PetState, world: WorldSnapshot, dtMs: number): void {
    const dt=Math.min(dtMs,50)/1000;
    const profile=SPECIES[state.species].movement;
    const body=state.body;
    if(body.held){body.velocity={x:0,y:0};return;}
    const target=this.resolveTarget(state,world);
    const isBird=state.species==="bird";
    const isRabbit=state.species==="rabbit";
    const routedTarget=this.resolveRoutedTarget(state,world,target);
    const behavior=state.behavior;
    const locomotion=["walk","investigate","seek_user","follow_pet","play_toy","play_pet","greet_pet","hide","perch","eat","drink","scratch"].includes(behavior);
    const fast=["run","chase_cursor","zoomies","pounce"].includes(behavior);
    if(isRabbit&&(locomotion||fast)&&body.grounded&&Math.sin(world.nowMs/300)>0.7){
      this.jump(state,target??undefined);
    }
    if(target && (locomotion||fast)){
      const dx=target.x-body.position.x;
      const speed=fast?profile.runSpeed:profile.walkSpeed;
      body.facing=dx<0?-1:1;
      body.velocity.x=Math.abs(dx)<4?0:Math.sign(dx)*speed;
      if(Math.abs(target.y-body.position.y)>42 && body.grounded && !routedTarget) this.jump(state,target);

    }else if(["idle","sit","sleep","groom","stretch"].includes(behavior)){
      body.velocity.x*=Math.pow(.03,dt);
    }
    if(behavior==="zoomies" && Math.abs(body.velocity.x)<20) body.velocity.x=body.facing*profile.runSpeed;
    if(!body.grounded){
      if(isBird&&["perch","investigate","seek_user","follow_pet"].includes(behavior)&&body.velocity.y<0){
        // Bird glides — reduced gravity while ascending toward perch
        body.velocity.y+=profile.gravity*dt*.3;
      } else {
        body.velocity.y+=profile.gravity*dt;
      }
    }
    body.position.x+=body.velocity.x*dt;
    body.position.y+=body.velocity.y*dt;
    this.resolveCollisions(state,world.surfaces);
    const bounds=this.virtualBounds(world);
    body.position.x=clamp(body.position.x,bounds.x+10,bounds.x+bounds.width-10);
    if(body.position.y>bounds.y+bounds.height+160){
      const floor=world.surfaces.filter(s=>s.kind==="taskbar"||s.kind==="monitor_floor").sort((a,b)=>Math.abs(a.rect.x-body.position.x)-Math.abs(b.rect.x-body.position.x))[0];
      if(floor){body.position={x:clamp(body.position.x,floor.rect.x,floor.rect.x+floor.rect.width),y:floor.walkY};body.velocity={x:0,y:0};body.grounded=true;body.surfaceId=floor.id;}
    }
    if(target && distance(body.position,target)<18 && locomotion) body.velocity.x=0;
  }

  jump(state:PetState,target?:Vec2):void{
    if(!state.body.grounded)return;
    const m=SPECIES[state.species].movement;
    state.body.velocity.y=-m.jumpSpeed;
    if(target){const dx=target.x-state.body.position.x;state.body.velocity.x=Math.sign(dx||1)*Math.min(m.runSpeed,Math.abs(dx)*1.8);}
    state.body.grounded=false;state.body.surfaceId=null;
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
    if(cached&&cached.targetId===targetSurface.id)return this.advanceRoute(state,cached);
    const graph=buildSurfaceGraph(world.surfaces,SPECIES[state.species].movement.jumpSpeed,220);
    const route=planRoute(graph,currentSurface,targetSurface.id);
    if(!route.length)return directTarget;
    const entry={targetId:targetSurface.id,route,stepIndex:0};
    this.routeCache.set(state.id,entry);
    return this.advanceRoute(state,entry);
  }

  private advanceRoute(state:PetState,entry:{targetId:string;route:PathEdge[];stepIndex:number}):Vec2|null{
    if(entry.stepIndex>=entry.route.length){this.routeCache.delete(state.id);return null;}
    const edge: PathEdge | undefined = entry.route[entry.stepIndex];
    if (!edge) { this.routeCache.delete(state.id); return null; }
    const body=state.body;
    if(body.surfaceId===edge.from){
      if(Math.abs(body.position.x-edge.launchPoint.x)<16){
        this.jump(state,edge.landingPoint);
        entry.stepIndex++;
        if(entry.stepIndex>=entry.route.length){this.routeCache.delete(state.id);return null;}
        const next: PathEdge | undefined = entry.route[entry.stepIndex];
        if (!next) { this.routeCache.delete(state.id); return null; }
        return next.landingPoint;
      }
      return edge.launchPoint;
    }
    entry.stepIndex++;
    if(entry.stepIndex>=entry.route.length){this.routeCache.delete(state.id);return null;}
    const nextStep: PathEdge | undefined = entry.route[entry.stepIndex];
    if (!nextStep) { this.routeCache.delete(state.id); return null; }
    return nextStep.launchPoint;
  }

  private resolveTarget(state:PetState,world:WorldSnapshot):Vec2|null{
    if(state.body.target)return state.body.target;
    const targetId=state.behaviorTargetId;
    if(targetId){
      const object=world.objects.find(o=>o.id===targetId); if(object)return object.position;
      const pet=world.nearbyPets.find(p=>p.id===targetId); if(pet)return pet.position;
      const surface=world.surfaces.find(s=>s.id===targetId); if(surface)return {x:surface.rect.x+surface.rect.width/2,y:surface.walkY};
    }
    if(state.behavior==="chase_cursor"||state.behavior==="pounce"||state.behavior==="seek_user")return world.cursor.position;
    return null;
  }

  private resolveCollisions(state:PetState,surfaces:Surface[]):void{
    const body=state.body;
    if(body.velocity.y<0)return;
    let landing:Surface|null=null;
    let best=Infinity;
    for(const s of surfaces){
      if(body.position.x<s.rect.x-8||body.position.x>s.rect.x+s.rect.width+8)continue;
      const dy=s.walkY-body.position.y;
      if(dy>=-8&&dy<best&&dy<36){best=dy;landing=s;}
    }
    if(landing){body.position.y=landing.walkY;body.velocity.y=0;body.grounded=true;body.surfaceId=landing.id;}
    else if(body.grounded){const s=body.surfaceId?surfaces.find(x=>x.id===body.surfaceId):undefined;if(!s||body.position.x<s.rect.x-10||body.position.x>s.rect.x+s.rect.width+10){body.grounded=false;body.surfaceId=null;}}
  }

  private virtualBounds(world:WorldSnapshot){
    if(!world.monitors.length)return{x:0,y:0,width:1920,height:1080};
    const minX=Math.min(...world.monitors.map(m=>m.rect.x)),minY=Math.min(...world.monitors.map(m=>m.rect.y));
    const maxX=Math.max(...world.monitors.map(m=>m.rect.x+m.rect.width)),maxY=Math.max(...world.monitors.map(m=>m.rect.y+m.rect.height));
    return{x:minX,y:minY,width:maxX-minX,height:maxY-minY};
  }
}

export function nudgeToy(object:WorldObject,from:Vec2,to:Vec2):void{
  const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy)||1;
  object.position.x+=dx/len*12;object.position.y+=dy/len*6;
}
