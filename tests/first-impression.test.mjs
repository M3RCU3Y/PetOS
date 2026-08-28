import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root=join(import.meta.dirname,"..");

test("first run arrives with a small species-aware habitat",()=>{
  const main=readFileSync(join(root,"src","app","main.ts"),"utf8");
  assert.match(main,/function addStarterHabitat/);
  assert.match(main,/add\("bed",118,0,38/);
  assert.match(main,/species==="cat"/);
  assert.match(main,/add\("ball",-92,-8,11\)/);
  assert.match(main,/add\("scratcher",205,-1,25\)/);
  assert.match(main,/if\(sim\.objects\.length===0\)addStarterHabitat/);
});

test("click affection and pickup are different interactions",()=>{
  const main=readFileSync(join(root,"src","app","main.ts"),"utf8");
  assert.match(main,/dragDistance>6/);
  assert.match(main,/dragWasPickup=true/);
  assert.match(main,/pet\.receivePickup/);
  assert.match(main,/else\{\s*const worldPos=.*pet\.receivePetting/s);
  assert.doesNotMatch(main,/playSpeciesVocal\(pet\.state\.id,pet\.state\.species\).*receivePetting/s);
});

test("cat affection has a soft procedural purr instead of raw UI audio",()=>{
  const sound=readFileSync(join(root,"src","app","sound.ts"),"utf8");
  const main=readFileSync(join(root,"src","app","main.ts"),"utf8");
  assert.match(sound,/private playPurr/);
  assert.match(sound,/harmonic\.frequency/);
  assert.match(sound,/lfo\.frequency/);
  assert.match(sound,/dog:\["bark"\]/);
  assert.match(main,/sound\.play\(pet\.state\.id,pet\.state\.species,"purr"\)/);
});

test("illustrated transient effects stay in the pixel-art language",()=>{
  const renderer=readFileSync(join(root,"src","app","renderer.ts"),"utf8");
  assert.match(renderer,/drawPixelHeart/);
  assert.match(renderer,/drawPixelZ/);
  assert.match(renderer,/drawPixelBang/);
  assert.doesNotMatch(renderer,/fillText\("z"/);
  assert.doesNotMatch(renderer,/fillText\("!"/);
  assert.match(renderer,/drawIllustratedCat\(c,p,art,pose,t,reducedMotion\)/);
});
