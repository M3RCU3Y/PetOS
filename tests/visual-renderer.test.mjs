import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { drawIllustratedCat as drawBaseCat } from "../dist/src/app/illustratedCat.js";
import { drawIllustratedCat as drawCozyCat } from "../dist/src/app/cozyCatRaster.js";
import { drawIllustratedCat as drawMotionCat } from "../dist/src/app/catMotion.js";
import { catArtTime } from "../dist/src/app/catCadence.js";

const root=join(import.meta.dirname,"..");
const source=(...parts)=>readFileSync(join(root,...parts),"utf8");

test("illustrated cat renderers are part of the compiled app",()=>{
  assert.equal(typeof drawBaseCat,"function");
  assert.equal(typeof drawCozyCat,"function");
  assert.equal(typeof drawMotionCat,"function");
  assert.equal(typeof catArtTime,"function");
});

test("procedural cats use held sprite cadence while motion timing stays smooth",()=>{
  const idle={id:"cadence-idle",behavior:"idle",body:{velocity:{x:0,y:0},grounded:true}};
  const walk={id:"cadence-walk",behavior:"walk",body:{velocity:{x:75,y:0},grounded:true}};
  const run={id:"cadence-run",behavior:"run",body:{velocity:{x:240,y:0},grounded:true}};
  const countFrames=p=>new Set(Array.from({length:1000},(_,t)=>catArtTime(p,t))).size;
  assert.ok(countFrames(idle)>=8&&countFrames(idle)<=9);
  assert.ok(countFrames(walk)>=10&&countFrames(walk)<=11);
  assert.ok(countFrames(run)>=12&&countFrames(run)<=13);
  assert.notEqual(catArtTime(idle,1234),catArtTime({...idle,id:"cadence-idle-b"},1234));
  const cadence=source("src","app","catCadence.ts"),motion=source("src","app","catMotion.ts"),renderer=source("src","app","renderer.ts");
  assert.match(cadence,/art-clock/);
  assert.match(cadence,/return 8/);
  assert.match(motion,/artT=t/);
  assert.match(motion,/drawPose\(c,p,a,pose,artT\)/);
  assert.match(renderer,/catArtTime\(p,t,reducedMotion\)/);
  assert.match(renderer,/drawIllustratedCat\(c,p,art,pose,t,reducedMotion,artT\)/);
});

test("illustrated cats keep the cozy pixel-painted rendering contract",()=>{
  const cat=source("src","app","illustratedCat.ts"),cozy=source("src","app","cozyCatRaster.ts"),finish=source("src","app","catFinish.ts"),renderer=source("src","app","renderer.ts");
  assert.match(cat,/const RASTER=160/);
  assert.match(cat,/imageSmoothingEnabled=false/);
  assert.match(cat,/sleep-pose/);
  assert.match(cat,/markings\?\?"tabby"/);
  assert.match(cat,/rgba\(pal\.deep,\.44\),1\.25/);
  assert.match(cozy,/ART_DENSITY=\.72/);
  assert.match(cozy,/imageSmoothingEnabled=false/);
  assert.match(cozy,/drawCatFinish/);
  assert.match(finish,/moveTo\(x-4\.8/);
  assert.match(finish,/rgba\(deep,\.62\),\.65/);
  assert.match(renderer,/ILLUSTRATED_CAT_SCALE=1\.23/);
});

test("authored locomotion uses baseline-locked eight-frame loops without raster warping",()=>{
  const cat=source("src","app","illustratedCat.ts"),sprites=source("src","app","cozyCatSprites.ts");
  assert.match(cat,/pawX=x\+stride/);
  assert.match(cat,/vy=p\.body\.velocity\.y/);
  assert.match(cat,/foreReach=1-launch\*\.28\+descent\*\.08/);
  assert.match(cat,/hindTuck=launch\*\.52/);
  assert.match(sprites,/MOTION_FRAMES=8/);
  assert.match(sprites,/IDLE_INTERVAL_MS=125/);
  assert.match(sprites,/speed>110\?82:105/);
  assert.match(sprites,/motionSheetUrls/);
  assert.match(sprites,/hashPhase/);
  assert.doesNotMatch(sprites,/applyMotion/);
  assert.doesNotMatch(sprites,/c\.rotate\(/);
  assert.match(sprites,/pose\.pouncing&&!p\.body\.grounded/);
  assert.match(sprites,/col:3,row:3/);
  assert.match(sprites,/reducedMotion/);
});

test("pose changes use anticipation, one pounce landing and recovery",()=>{
  const motion=source("src","app","catMotion.ts"),renderer=source("src","app","renderer.ts");
  assert.match(motion,/SAME_FAMILY_MS=180/);
  assert.match(motion,/SILHOUETTE_MS=245/);
  assert.match(motion,/LANDING_MS=190/);
  assert.match(motion,/const swap=\.46/);
  assert.match(motion,/pounce-air/);
  assert.match(motion,/fromFamily/);
  assert.match(motion,/lastGrounded/);
  assert.match(motion,/prefers-reduced-motion/);
  assert.match(motion,/reduceMotion\|\|systemReducedMotion/);
  assert.match(renderer,/from "\.\/catMotion\.js"/);
});

test("feeding and scratching approach objects before animating contact",()=>{
  const renderer=source("src","app","renderer.ts"),physics=source("src","core","physics.ts");
  assert.match(renderer,/feedingSettled=feeding&&stationary/);
  assert.match(renderer,/scratchingSettled=b==="scratch"&&stationary/);
  assert.match(renderer,/scratchingSettled\?\(\.12\+/);
  assert.match(physics,/state\.behavior==="eat"\|\|state\.behavior==="drink"/);
  assert.match(physics,/object\.position\.x-dir\*24/);
  assert.match(physics,/state\.behavior==="scratch"/);
  assert.match(physics,/object\.position\.x-dir\*28/);
});

test("mixed renderer keeps pets in one shared depth order",()=>{
  const renderer=source("src","app","renderer.ts");
  assert.match(renderer,/ordered=\[\.\.\.scene\.pets\]\.sort/);
  assert.match(renderer,/legacyLayer\.render\(onePetScene\)/);
  assert.match(renderer,/super\.render\(\{\.\.\.scene,pets:\[\],objects:\[\]\}\)/);
});

test("transient cat feedback uses wall time and pixel effects",()=>{
  const renderer=source("src","app","renderer.ts");
  assert.match(renderer,/wallNow=Date\.now\(\)/);
  assert.match(renderer,/startleAge=wallNow-p\.behaviorSinceMs/);
  assert.match(renderer,/recentTouchAge/);
  assert.match(renderer,/drawPixelHeart/);
  assert.match(renderer,/drawPixelZ/);
  assert.match(renderer,/drawPixelBang/);
  assert.match(renderer,/p\.body\.held&&p\.affect\.stress/);
  assert.match(renderer,/p\.behavior!=="seek_user"/);
});

test("cat lab ships the authored sprite families and held-art clock",()=>{
  const lab=join(root,"dist","cat-lab.html");
  assert.ok(existsSync(lab),"dist/cat-lab.html should be copied during npm run build");
  const html=readFileSync(lab,"utf8");
  assert.match(html,/drawIllustratedCat/);
  assert.match(html,/Cozy Cat Lab/);
  assert.match(html,/drawCozyCatSprite/);
  assert.match(html,/cozyCatSprites\.js/);
  assert.match(html,/catMotion\.js/);
  assert.match(html,/catCadence\.js/);
  assert.match(html,/catArtTime/);
  assert.match(html,/SHIPPED SPRITES \+ MOTION \+ CADENCE/);
  assert.match(html,/loaf/);
  assert.match(html,/investigate/);
  assert.match(html,/stretch/);
  assert.match(html,/pounce/);
});
