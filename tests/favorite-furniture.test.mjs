import test from "node:test";
import assert from "node:assert/strict";
import { Pet, PetMemory, SeededRandom, calmDesktop } from "../dist/src/index.js";

test("furniture preference survives memory serialization",()=>{
  const memory=new PetMemory();
  memory.reinforceObject("bed:window",.62);
  memory.reinforceObject("box:quiet",.28);
  const restored=new PetMemory(memory.serialize());
  assert.equal(restored.preferenceForObject("bed:window"),.62);
  assert.equal(restored.preferenceForObject("box:quiet"),.28);
  assert.equal(restored.favoriteObject(),"bed:window");
});

test("tiny autonomous furniture gains are not frame-rate dependent",()=>{
  const memory=new PetMemory();
  memory.reinforceObject("bed:slow-burn",.012);
  memory.reinforceObject("bed:slow-burn",.012);
  memory.reinforceObject("bed:slow-burn",.012);
  assert.equal(memory.preferenceForObject("bed:slow-burn"),.012);
  memory.reinforceObject("bed:slow-burn",.3);
  assert.equal(memory.preferenceForObject("bed:slow-burn"),.312);
});

test("a tired pet deliberately picks its learned bed",()=>{
  const pet=new Pet({id:"bed-loyalist",name:"Mochi",species:"cat",nowMs:0,x:280,y:700},new SeededRandom(93));
  pet.memory.reinforceObject("bed:favorite",.82);
  pet.state.behaviorSinceMs=-30_000;
  pet.state.drives.fatigue=.9;pet.state.drives.play=.01;pet.state.drives.social=.01;pet.state.drives.curiosity=.01;pet.state.drives.comfort=.65;pet.state.affect.arousal=.06;pet.state.affect.stress=.02;
  const world=calmDesktop(40_000);
  world.secondsSinceNewWindow=999;
  world.cursor={position:{x:1100,y:500},speed:0,distanceToPet:900,buttons:0};
  world.objects=[
    {id:"bed:first",kind:"bed",position:{x:430,y:700},radius:38,comfort:.9},
    {id:"bed:favorite",kind:"bed",position:{x:820,y:700},radius:38,comfort:.9}
  ];
  const decision=pet.tick(world,100);
  assert.equal(decision.behavior,"sleep");
  assert.equal(decision.targetId,"bed:favorite");
  assert.match(decision.reason,/favorite bed/);
});

test("old saves without objectPreferences still load as neutral",()=>{
  const memory=new PetMemory({surfacePreferences:{"window:a":.2}});
  assert.equal(memory.preferenceForObject("bed:any"),0);
  assert.equal(memory.favoriteObject(),null);
});
