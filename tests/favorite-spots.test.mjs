import test from "node:test";
import assert from "node:assert/strict";
import { Pet, SeededRandom, calmDesktop } from "../dist/src/index.js";

function favoriteWorld(nowMs=10_000){
  const w=calmDesktop(nowMs);
  w.surfaces=[
    {id:"taskbar:primary",kind:"taskbar",rect:{x:0,y:760,width:1280,height:40},walkY:760,comfort:.25},
    {id:"window:cozy",kind:"window",rect:{x:560,y:390,width:420,height:320},walkY:390,comfort:.72,app:"Code.exe"}
  ];
  w.currentSurface=w.surfaces[0];
  w.cursor={position:{x:1100,y:500},speed:0,distanceToPet:900,buttons:0};
  w.secondsSinceNewWindow=999;
  return w;
}

test("pet deliberately returns to a learned favorite surface",()=>{
  const pet=new Pet({id:"favorite-return",name:"Mochi",species:"cat",nowMs:0,x:120,y:760},new SeededRandom(71));
  pet.memory.reinforceSurface("window:cozy",.9);
  pet.state.favoriteSurfaceId="window:cozy";
  pet.state.behaviorSinceMs=-20_000;
  pet.state.drives.social=0;
  pet.state.drives.play=.02;
  pet.state.drives.curiosity=.02;
  pet.state.drives.fatigue=.25;
  pet.state.drives.comfort=.75;
  pet.state.affect.arousal=.12;
  const decision=pet.tick(favoriteWorld(),100);
  const favorite=decision.allScores.find(s=>s.reason==="returns to a learned favorite spot");
  assert.ok(favorite,"favorite return should be scored");
  assert.equal(favorite.targetId,"window:cozy");
  assert.deepEqual(favorite.targetPosition,{x:770,y:390});
  assert.equal(decision.behavior,"walk");
});

test("tired pet settles once it reaches its favorite spot",()=>{
  const pet=new Pet({id:"favorite-sleep",name:"Bean",species:"cat",nowMs:0,x:760,y:390},new SeededRandom(72));
  pet.memory.reinforceSurface("window:cozy",.92);
  pet.state.favoriteSurfaceId="window:cozy";
  pet.state.behaviorSinceMs=-20_000;
  pet.state.drives.social=0;
  pet.state.drives.play=.01;
  pet.state.drives.curiosity=.01;
  pet.state.drives.fatigue=.82;
  pet.state.drives.comfort=.78;
  pet.state.affect.arousal=.08;
  const decision=pet.tick(favoriteWorld(),100);
  const sleep=decision.allScores.find(s=>s.reason==="returns to a trusted favorite sleeping spot");
  assert.ok(sleep,"favorite sleep should be scored near the remembered spot");
  assert.equal(sleep.targetId,"window:cozy");
  assert.equal(decision.behavior,"sleep");
});
