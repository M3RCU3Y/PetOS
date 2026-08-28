import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drawIllustratedCat as drawBaseCat } from "../dist/src/app/illustratedCat.js";
import { drawIllustratedCat as drawCozyCat } from "../dist/src/app/cozyCatRaster.js";
import { drawIllustratedCat as drawMotionCat } from "../dist/src/app/catMotion.js";

test("illustrated cat renderers are part of the compiled app",()=>{assert.equal(typeof drawBaseCat,"function");assert.equal(typeof drawCozyCat,"function");assert.equal(typeof drawMotionCat,"function");});

test("illustrated cats keep the cozy pixel-painted rendering contract",()=>{
  const root=join(import.meta.dirname,"..");
  const source=readFileSync(join(root,"src","app","illustratedCat.ts"),"utf8"),cozy=readFileSync(join(root,"src","app","cozyCatRaster.ts"),"utf8"),finish=readFileSync(join(root,"src","app","catFinish.ts"),"utf8");
  assert.match(source,/const RASTER=160/);assert.match(source,/imageSmoothingEnabled=false/);assert.match(source,/sleep-pose/);assert.match(source,/markings\?\?"tabby"/);
  assert.match(cozy,/ART_DENSITY=\.72/);assert.match(cozy,/imageSmoothingEnabled=false/);assert.match(cozy,/drawCatFinish/);
  assert.match(finish,/forehead M|moveTo\(x-4\.8/);assert.match(finish,/return`#\$\{/);
});

test("pose changes use anticipation, silhouette swap and landing recovery",()=>{
  const root=join(import.meta.dirname,"..");const motion=readFileSync(join(root,"src","app","catMotion.ts"),"utf8"),renderer=readFileSync(join(root,"src","app","renderer.ts"),"utf8");
  assert.match(motion,/SAME_FAMILY_MS=180/);assert.match(motion,/SILHOUETTE_MS=245/);assert.match(motion,/LANDING_MS=190/);assert.match(motion,/const swap=\.46/);assert.match(motion,/1-q\*\.17/);assert.match(motion,/lastGrounded/);assert.match(motion,/prefers-reduced-motion/);assert.match(motion,/reduceMotion\|\|systemReducedMotion/);assert.match(renderer,/from "\.\/catMotion\.js"/);
});

test("mixed renderer keeps pets in one shared depth order",()=>{
  const root=join(import.meta.dirname,"..");const renderer=readFileSync(join(root,"src","app","renderer.ts"),"utf8");
  assert.match(renderer,/ordered=\[\.\.\.scene\.pets\]\.sort/);assert.match(renderer,/legacyLayer\.render\(onePetScene\)/);assert.match(renderer,/super\.render\(\{\.\.\.scene,pets:\[\],objects:\[\]\}\)/);
});

test("transient cat feedback uses wall time and pixel effects",()=>{
  const root=join(import.meta.dirname,"..");const renderer=readFileSync(join(root,"src","app","renderer.ts"),"utf8");
  assert.match(renderer,/wallNow=Date\.now\(\)/);assert.match(renderer,/startleAge=wallNow-p\.behaviorSinceMs/);assert.match(renderer,/recentTouchAge/);assert.match(renderer,/drawPixelHeart/);assert.match(renderer,/p\.body\.held&&p\.affect\.stress/);assert.match(renderer,/p\.behavior!=="seek_user"/);
});

test("cat lab ships the final motion compositor",()=>{
  const root=join(import.meta.dirname,"..");const lab=join(root,"dist","cat-lab.html");assert.ok(existsSync(lab),"dist/cat-lab.html should be copied during npm run build");
  const html=readFileSync(lab,"utf8");assert.match(html,/drawIllustratedCat/);assert.match(html,/Procedural Cat Lab/);assert.match(html,/catMotion\.js/);assert.match(html,/SHIPPED MOTION \+ ART/);assert.match(html,/loaf/);assert.match(html,/investigate/);assert.match(html,/stretch/);assert.match(html,/pounce/);
});
