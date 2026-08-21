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
  seek_user: 3_000, play_pet: 3_000, play_toy: 3_000, zoomies: 4_000, carry_toy: 3_000, perch: 4_000, eat: 4_000, drink: 3_000, scratch: 3_000
};

export class PetBrain {
  private readonly objects = new ObjectPermanence();
  constructor(private readonly profile: SpeciesProfile, private readonly rng: RandomSource) {}

  decide(state: PetState, world: WorldSnapshot, memory: PetMemory): Decision {
    const age = world.nowMs - state.behaviorSinceMs;
    const minDuration = MIN_DURATION_MS[state.behavior] ?? 1200;
    if (age >= 0 && age < minDuration && !state.body.held) {
      return { behavior: state.behavior, score: 1, reason: "behavior inertia", ...(state.behaviorTargetId ? {targetId:state.behaviorTargetId}:{}), allScores: [] };
    }

    this.objects.observe(world.objects, world.nowMs);
    const scores: DecisionScore[] = [];
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

    if (world.cursor.distanceToPet < 280 && world.cursor.speed > 420) {
      const prey = clamp(world.cursor.speed/1800,0,1) * clamp(1-world.cursor.distanceToPet/330,0,1);
      add("chase_cursor", d.play*.45 + p.playfulness*.32 + prey*.5 - d.fatigue*.25, "fast nearby cursor resembles prey", { position:world.cursor.position });
      if (world.cursor.distanceToPet < 100) add("pounce", d.play*.35 + prey*.55, "cursor is within pouncing range", { position:world.cursor.position });
    }

    add("seek_user", (d.social*.5 + p.affection*.28 + (1-p.independence)*.12 + state.frustration*.18) * keeper, keeper < 1 ? "Keeper suppresses interruption" : "social drive seeks user", { position:world.cursor.position });

    if (d.play > .72 && d.fatigue < .45 && p.energy > .5) add("zoomies", d.play*.35 + p.energy*.35 + a.arousal*.18 + eveningCatBurst, "stored play energy erupts into zoomies");

    const nearestPet = [...world.nearbyPets].sort((a,b)=>a.distance-b.distance)[0];
    if (nearestPet && nearestPet.distance < 450) {
      const relation = memory.relationshipWith(nearestPet.id);
      add("follow_pet", (d.social*.26 + p.sociability*.22 + relation*.16) * keeper, "familiar nearby pet", {id:nearestPet.id,position:nearestPet.position});
      if (nearestPet.distance < 140) {
        add("greet_pet", p.sociability*.25 + d.social*.22 + relation*.2, "close social contact", {id:nearestPet.id,position:nearestPet.position});
        add("play_pet", d.play*.34 + p.playfulness*.28 + relation*.18, "social play opportunity", {id:nearestPet.id,position:nearestPet.position});
      }
    }

    const ball = world.objects.find(o => (o.kind === "ball" || o.kind === "toy"));
    if (ball) add("play_toy", d.play*.43 + p.playfulness*.33 - d.fatigue*.2, "toy available", {id:ball.id,position:ball.position});
    const food = world.objects.find(o => o.kind === "bowl" && o.contents === "food");

    if (!food && d.hunger > .6 && this.objects.knowsAbout("bowl")) {
      const remembered = this.objects.findNearest("bowl", state.body.position);
      if (remembered) add("investigate", d.hunger*.4 + .1, "remembers where food usually is", { id: remembered.id, position: remembered.lastPosition });
    }
    if (food) add("eat", d.hunger*.92 + p.foodDrive*.18, "hunger and food are available", {id:food.id,position:food.position});
    const water = world.objects.find(o => o.kind === "bowl" && o.contents === "water");
    if (water) add("drink", d.thirst*.96, "thirst and water are available", {id:water.id,position:water.position});
    const scratcher = world.objects.find(o => o.kind === "scratcher");
    if (scratcher && state.species === "cat") add("scratch", .16 + p.energy*.12 + d.play*.12, "cat maintenance and territory behavior", {id:scratcher.id,position:scratcher.position});
    const bed = world.objects.find(o => o.kind === "bed");
    if (bed && d.fatigue > .55) add("sleep", d.fatigue*.96 + (bed.comfort ?? .7)*.25, "comfortable bed available", {id:bed.id,position:bed.position});
    const box = world.objects.find(o => o.kind === "box");
    if (box && (a.stress > .55 || (state.species === "cat" && p.curiosity > .6))) add("hide", a.stress*.45 + p.curiosity*.15, "safe enclosed space available", {id:box.id,position:box.position});

    const current = world.currentSurface;
    if (current) {
      const pref = memory.preferenceForSurface(current.id);
      if (pref > .2) {
        add("sit", pref*.25 + d.comfort*.16, "learned favorite surface");
        add("sleep", pref*.2 + d.fatigue*.38, "trusted sleeping location");
      }
      if (current.kind === "window" && state.species === "cat") add("perch", p.curiosity*.15 + .12, "cat prefers elevated ledges");
    }

    if (state.species === "bird") add("perch", p.curiosity*.2 + d.comfort*.12, "bird seeks a perch");
    if (state.species === "rabbit" && a.stress > .45) add("hide", a.stress*.5 + (1-p.boldness)*.2, "rabbit security response");

    scores.sort((a,b)=>b.score-a.score);
    const top = scores[0] ?? {behavior:"idle" as Behavior,score:.2,reason:"fallback"};
    return { behavior:top.behavior, score:top.score, reason:top.reason, ...(top.targetId ? {targetId:top.targetId}:{}), ...(top.targetPosition ? {targetPosition:top.targetPosition}:{}), allScores:scores };
  }
}