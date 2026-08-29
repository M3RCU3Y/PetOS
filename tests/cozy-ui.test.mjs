import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root=join(import.meta.dirname,"..");

test("procedural creator exposes coat patterns and curated looks",()=>{
  const html=readFileSync(join(root,"web","index.html"),"utf8");
  const ui=readFileSync(join(root,"src","app","ui.ts"),"utf8");
  assert.match(html,/creator-markings/);
  assert.match(html,/creator-randomize/);
  assert.match(html,/creator\.css/);
  assert.match(ui,/LOOK_PRESETS/);
  assert.match(ui,/Moon Tuxedo/);
  assert.match(ui,/markings:"tabby"/);
});

test("creator visual skin ships with normal web builds",()=>{
  const copy=readFileSync(join(root,"scripts","copy-static.mjs"),"utf8");
  assert.match(copy,/creator\.css/);
  const built=join(root,"dist","creator.css");
  assert.ok(existsSync(built),"dist/creator.css should be copied during npm run build");
});

test("onboarding reveals the actual live-rendered pet",()=>{
  const source=readFileSync(join(root,"src","app","onboarding.ts"),"utf8");
  assert.match(source,/renderPetPreview/);
  assert.match(source,/onboarding-preview/);
  assert.match(source,/behaviors=\["idle","sit","groom","sleep","walk"\]/);
});

test("habitat uses the same quantized art language and local occlusion",()=>{
  const habitat=readFileSync(join(root,"src","app","cozyHabitat.ts"),"utf8");
  const renderer=readFileSync(join(root,"src","app","renderer.ts"),"utf8");
  assert.match(habitat,/ART_DENSITY=\.72/);
  assert.match(habitat,/drawCozyObjectBack/);
  assert.match(habitat,/drawCozyObjectFront/);
  assert.match(renderer,/objects:\[\]/);
  assert.match(renderer,/drawCozyObjectBack/);
  assert.match(renderer,/drawCozyObjectFront/);
});
