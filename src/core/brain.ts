import { clamp } from "./math.js";
import type { Behavior, Decision, DecisionScore, PetState, WorldSnapshot } from "./types.js";
import type { SpeciesProfile } from "./species.js";
import type { PetMemory } from "./memory.js";
import { ObjectPermanence } from "./objectMemory.js";
import type { RandomSource } from "./rng.js";

const BASE: Record<Behavior, number> = {
  idle:.24, walk:.2, run:.02, sit:.2, sleep:.02, groom:.05, stretch:.035,
  investigate:.02, chase_cursor:0, pounce:0, seek_user:.01, zoomies:0,
  jump:.01, climb:0, perch:.02, hide:0, eat:0, drink:0,
  play_toy:0, carry_toy:0, follow_pet:0, play_pet:0, greet_pet:0, scratch:0,
  stalk:0, startle:0, hang:0, peek:0, cuddle:0, play_fight:0
};
const MIN_DURATION_MS: Partial<Record<Behavior, number>> = {
  sleep: 14_000, groom: 4_000, sit: 3_000, idle: 1_800, chase_cursor: 2_000, investigate: 2_600,
  seek_user: 3_000, play_pet: 3_000, play_toy: 3_000, zoomies: 4_000, carry_toy: 3_000, perch: 4_000, eat: 4_000, drink: 3_000, scratch: 3_000,
  stalk: 2_200, startle: 1_100, climb: 1_600, hang: 1_300, peek: 1_250, cuddle: 6_000, play_fight: 4_000
};

export class PetBrain {
  private readonly objects = new ObjectPermanence();
  private seeking:{ objectId:string; position:{x:number;y:number}; kind:string }|null = null;
  constructor(private readonly profile: SpeciesProfile, private readonly rng: RandomSource) {}

  decide(state: PetState, world: WorldSnapshot, memory: PetMemory): Decision {
    const age = world.nowMs - state.behaviorSinceMs;
    const minDuration = MIN_DURATION_MS[state.behavior] ?? 1200;
    if (age >= 0 && age < minDuration && !state.body.held) {
      return { behavior: state.behavior, score: 1, reason: "behavior inertia", ...(state.behaviorTargetId ? {targetId:state.behaviorTargetId}:{}), allScores: [] };
    }

    this.objects.observe(world.objects, world.nowMs);    const scores: DecisionScore[] = [];
    const add = (behavior: Behavior, value: number, reason: string, target?: { id?: string; position?: {x:number;y:number} }) => {
      const bias = this.profile.behaviorBias[behavior] ?? 0;
      const noise = this.rng.between(-.045, .045);
      const score = clamp(BASE[behavior] + value + bias + noise, 0, 1.5);
      scores.push({ behavior, score, reason, ...(target?.id ? { targetId: target.id } : {}), ...(target?.position ? { targetPosition: target.position } : {}) });
    };

    const p = state.personality, d = state.drives, a = state.affect;
    const hour = new Date(world.nowMs).getHours();
    const nocturnalRest = (hour >= 0 && hour < 6) ? .12 : 0;
    const eveningCatBurst = state.species === "cat" && (hour >= 18 || hour < 1) ? .08 : 0;
    const keeper = world.userActivity === "fullscreen" || world.userActivity === "gaming" || world.userActivity === "presentation" ? .12 : 1;
    const calm = 1 - a.stress;

    add("sleep", d.fatigue * .9 + d.comfort * .12 + (1-p.energy)*.15 + nocturnalRest - a.arousal*.18, "sleep pressure, comfort and circadian rhythm");
    add("groom", calm*.14 + d.comfort*.12 + p.patience*.1, "self-maintenance while calm");
    add("stretch", d.fatigue*.08 + calm*.08, "body maintenance");
    add("idle", calm*.16 + p.patience*.09, "observe the environment");
    add("sit", calm*.13 + d.comfort*.1, "settle nearby");
    add("walk", d.curiosity*.25 + p.curiosity*.16 + p.energy*.08 + state.boredom*.22, "low-cost exploration" + (state.boredom > .5 ? " (bored)" : ""));
    add("run", p.energy*.12 + a.arousal*.16 + d.play*.1 + state.frustration*.14, "high arousal movement" + (state.frustration > .4 ? " (frustrated)" : ""));

    if (world.secondsSinceNewWindow < 8) {
      const newest = world.windows.at(-1);
      add("investigate", d.curiosity*.5 + p.curiosity*.35 + state.novelty*.15, "a new desktop surface appeared", newest ? { id:`window:${newest.id}`, position:{x:newest.rect.x+newest.rect.width/2,y:newest.rect.y} } : undefined);
    }

    if (world.cursor.distanceToPet < 340 && world.cursor.speed > 380) {
      const prey = clamp(world.cursor.speed/1800,0,1) * clamp(1-world.cursor.distanceToPet/380,0,1);
      if (world.cursor.distanceToPet < 130) {
        add("chase_cursor", d.play*.45 + p.playfulness*.32 + prey*.5 - d.fatigue*.25, "fast nearby cursor resembles prey", { position:world.cursor.position });
        if (world.cursor.distanceToPet < 90) add("pounce", d.play*.35 + prey*.55, "cursor is within pouncing range", { position:world.cursor.position });
      } else {
        const stalker = state.species === "cat" ? .22 : 0;
        add("stalk", d.play*.3 + p.playfulness*.24 + prey*.42 + stalker - d.fatigue*.2, "prey spotted — closing in slowly", { position:world.cursor.position });
      }
    }

    add("seek_user", (d.social*.5 + p.affection*.28 + (1-p.independence)*.12 + state.frustration*.18) * keeper, keeper < 1 ? "Keeper suppresses interruption" : "social drive seeks user", { position:world.cursor.position });

    if (world.focusBreak) {
      add("seek_user", .3 + state.bond*.2 + d.social*.2, "break time — going to sit with the keeper", { position:world.cursor.position });
      add("sit", .12, "keeping the keeper company on break");
    }

    if (d.play > .72 && d.fatigue < .45 && p.energy > .5) add("zoomies", d.play*.35 + p.energy*.35 + a.arousal*.18 + eveningCatBurst, "stored play energy erupts into zoomies");

    const nearestPet = [...world.nearbyPets].sort((a,b)=>a.distance-b.distance)[0];
    if (nearestPet) {
      const rel = memory.relate(nearestPet.id);

      if (nearestPet.distance < 320 && rel.familiarity < .18) {
        add("investigate", d.curiosity*.3 + p.curiosity*.22 + .06, "curious about the newcomer", {id:nearestPet.id, position:nearestPet.position});
      }
      if ((rel.irritation > .45 || rel.rivalry > .55) && nearestPet.distance < 180) {
        const away = { x: state.body.position.x + (state.body.position.x - nearestPet.position.x)*2, y: state.body.position.y };
        add("walk", rel.rivalry*.3 + rel.irritation*.3, "keeps distance from a rival", { position: away });
      }

      if (nearestPet.distance < 450) {
        add("follow_pet", (d.social*.26 + p.sociability*.22 + memory.relationshipWith(nearestPet.id)*.16) * keeper, "familiar nearby pet", {id:nearestPet.id,position:nearestPet.position});
        if (nearestPet.distance < 140) {
          add("greet_pet", p.sociability*.25 + d.social*.22 + memory.relationshipWith(nearestPet.id)*.2, "close social contact", {id:nearestPet.id,position:nearestPet.position});
          add("play_pet", d.play*.34 + p.playfulness*.28 + memory.relationshipWith(nearestPet.id)*.18, "social play opportunity", {id:nearestPet.id,position:nearestPet.position});
          if (nearestPet.behavior === "sleep" && rel.trust > .18 && d.fatigue > .4) {
            add("cuddle", d.fatigue*.34 + rel.affection*.32 + rel.trust*.18, "sleeps piled beside a trusted friend", {id:nearestPet.id, position:nearestPet.position});
          }
          if (p.playfulness > .55 && d.play > .45 && (rel.rivalry > .25 || d.play > .75)) {
            add("play_fight", d.play*.32 + rel.rivalry*.24 + p.playfulness*.2, "wrestles with a sparring partner", {id:nearestPet.id, position:nearestPet.position});
          }
        }
      }
    }

    const ball = world.objects.find(o => (o.kind === "ball" || o.kind === "toy"));
    if (ball) {
      const toyPref = memory.preferenceForToy(ball.id) + (memory.favoriteToy() === ball.id ? .08 : 0);
      add("play_toy", d.play*.43 + p.playfulness*.33 - d.fatigue*.2 + toyPref*.18, toyPref > .1 ? "a familiar favorite toy" : "toy available", {id:ball.id,position:ball.position});
    }
    const food = world.objects.find(o => o.kind === "bowl" && o.contents === "food");

    // Resolve an in-progress seek: did the remembered object turn out to be there?
    if (this.seeking) {
      const found = world.objects.find(o => o.id === this.seeking!.objectId);
      if (found) {
        this.seeking = null;
      } else {
        const arrived = Math.hypot(state.body.position.x-this.seeking.position.x, state.body.position.y-this.seeking.position.y) < 60;
        if (arrived && world.nowMs - state.behaviorSinceMs > 1500) {
          const missCount = this.objects.recordMiss(this.seeking.objectId, world.nowMs);
          if (missCount >= 3) {
            this.seeking = null;
          } else {
            const spread = 70 + this.rng.between(0,90)*missCount;
            const searchPos = { x:this.seeking.position.x + this.rng.between(-spread,spread), y:this.seeking.position.y };
            add("investigate", .55 + d.hunger*.3, `it should be here… searching nearby (${missCount})`, { id:`search:${this.seeking.objectId}:${missCount}`, position:searchPos });
            scores.sort((a,b)=>b.score-a.score);
            const top = scores[0]!;
            return { behavior:top.behavior, score:top.score, reason:top.reason, ...(top.targetId?{targetId:top.targetId}:{}), ...(top.targetPosition?{targetPosition:top.targetPosition}:{}), allScores:scores };
          }
        }
      }
    }

    if (!food && d.hunger > .6 && this.objects.knowsAbout("bowl")) {
      const remembered = this.objects.findNearest("bowl", state.body.position);
      if (remembered && !this.objects.gaveUp(remembered.id, world.nowMs)) {
        this.seeking = { objectId:remembered.id, position:{...remembered.lastPosition}, kind:"bowl" };
        add("investigate", d.hunger*.45 + .12, "remembers where food usually is", { id: remembered.id, position: remembered.lastPosition });
      } else if (remembered && this.objects.gaveUp(remembered.id, world.nowMs)) {
        state.frustration = clamp(state.frustration + .02);
      }
    }
    if (food) add("eat", d.hunger*.92 + p.foodDrive*.18, "hunger and food are available", {id:food.id,position:food.position});
    const water = world.objects.find(o => o.kind === "bowl" && o.contents === "water");
    if (water) add("drink", d.thirst*.96, "thirst and water are available", {id:water.id,position:water.position});
    const scratcher = world.objects.find(o => o.kind === "scratcher");
    if (scratcher && state.species === "cat") add("scratch", .16 + p.energy*.12 + d.play*.12, "cat maintenance and territory behavior", {id:scratcher.id,position:scratcher.position});
    const bed = world.objects.find(o => o.kind === "bed");
    if (bed && d.fatigue > .55) {
      const occupant = world.nearbyPets.find(o => Math.hypot(o.position.x-bed.position.x, o.position.y-bed.position.y) < 55);
      if (occupant) {
        const rel = memory.relate(occupant.id);
        if (rel.rivalry > .35 || rel.irritation > .4) {
          add("play_fight", d.fatigue*.18 + rel.rivalry*.32 + p.boldness*.14, "contests the occupied bed", {id:occupant.id, position:{...bed.position}});
        } else {
          add("sleep", d.fatigue*.9 + rel.trust*.16 + (bed.comfort ?? .7)*.2, "shares a warm bed with a friend", {id:bed.id, position:bed.position});
        }
      } else {
        add("sleep", d.fatigue*.96 + (bed.comfort ?? .7)*.25, "comfortable bed available", {id:bed.id,position:bed.position});
      }
    }
    const hidey = world.objects.find(o => o.kind === "box" || o.kind === "tunnel" || o.kind === "plant");
    if (hidey && (a.stress > .55 || (state.species === "cat" && p.curiosity > .6) || (state.species === "rabbit" && a.stress > .45))) add("hide", a.stress*.45 + p.curiosity*.15, "safe enclosed space available", {id:hidey.id,position:hidey.position});
    const perchObj = world.objects.find(o => o.kind === "perch");
    if (perchObj && state.species === "bird") add("perch", d.comfort*.16 + p.curiosity*.14 + .1, "a proper perch to rest on", {id:perchObj.id,position:perchObj.position});
    if (a.stress > .4 && d.fatigue < .7) {
      const cozy = [...world.objects].filter(o=>o.kind==="bed").sort((x,y)=>(y.comfort??0)-(x.comfort??0))[0];
      const comfySurface = [...world.surfaces].filter(s=>(s.comfort??.2)>.5).sort((x,y)=>(y.comfort??0)-(x.comfort??0))[0];
      if (cozy) add("sit", a.stress*.4 + (cozy.comfort??.8)*.3, "seeks somewhere safe and soft", {id:cozy.id,position:cozy.position});
      else if (comfySurface) add("walk", a.stress*.3, "seeks a calmer corner", { id:comfySurface.id, position:{x:comfySurface.rect.x+comfySurface.rect.width/2,y:comfySurface.walkY} });
    }

    const current = world.currentSurface;
    if (current) {
      const pref = memory.preferenceForSurface(current.id);
      if (pref > .2) {
        add("sit", pref*.25 + d.comfort*.16, "learned favorite surface");
        add("sleep", pref*.2 + d.fatigue*.38, "trusted sleeping location");
      }
      if (current.kind === "window" && state.species === "cat") add("perch", p.curiosity*.15 + .12, "cat prefers elevated ledges");

      if (state.species === "cat" || state.species === "bird") {
        const above = world.surfaces.filter(s =>
          s.kind === "window" && s.rect.height > 70 &&
          (current.walkY - s.walkY) > 60 && (current.walkY - s.walkY) < 320 &&
          !(state.body.position.x < s.rect.x - 40 || state.body.position.x > s.rect.x + s.rect.width + 40)
        );
        const best = above[0];
        if (best) {
          const sideX = state.body.position.x < best.rect.x ? best.rect.x : best.rect.x + best.rect.width;
          add("climb", p.curiosity*.22 + d.curiosity*.16 + d.play*.1, "spied a higher ledge worth climbing", { id:best.id, position:{x:sideX,y:current.walkY} });
        }
      }
      // Learned avoidance: a surface that once frightened the pet loses appeal
      const frights = memory.recent("fright", 12).filter(f => f.surfaceId === current.id);
      if (frights.length && pref < .3) {
        add("walk", .12 + frights.length*.05, "uneasy about this spot", { position:{x:world.cursor.position.x,y:current.walkY} });
      }
    }

    if (state.species === "bird") add("perch", p.curiosity*.2 + d.comfort*.12, "bird seeks a perch");
    if (state.species === "rabbit" && a.stress > .45) add("hide", a.stress*.5 + (1-p.boldness)*.2, "rabbit security response");

    scores.sort((a,b)=>b.score-a.score);
    const top = scores[0] ?? {behavior:"idle" as Behavior,score:.2,reason:"fallback"};
    return { behavior:top.behavior, score:top.score, reason:top.reason, ...(top.targetId ? {targetId:top.targetId}:{}), ...(top.targetPosition ? {targetPosition:top.targetPosition}:{}), allScores:scores };
  }
}