import type { MarkingPattern, PetAppearance, Personality, SheetAnimation, SpriteSheet, Species } from "./types.js";

const MARKINGS:MarkingPattern[]=["uniform","tuxedo","tabby","patched"];

function validateSheet(value:unknown):SpriteSheet|null{
  if(!value||typeof value!=="object")return null;
  const s=value as Partial<SpriteSheet>;
  if(typeof s.src!=="string"||!s.src.trim())return null;
  if(!Number.isFinite(s.frameWidth)||s.frameWidth!<1||!Number.isFinite(s.frameHeight)||s.frameHeight!<1)return null;
  if(!s.default||typeof s.default.row!=="number"||s.default.row<0||typeof s.default.frames!=="number"||s.default.frames<1)return null;
  const animations:Record<string,SheetAnimation>={};
  if(s.animations&&typeof s.animations==="object"){
    for(const [key,anim] of Object.entries(s.animations)){
      const a=anim as SheetAnimation;
      if(typeof a.row!=="number"||a.row<0||typeof a.frames!=="number"||a.frames<1)continue;
      animations[key]={row:a.row,frames:a.frames,...(Number.isFinite(a.fps)&&a.fps!?{fps:a.fps}:{})};
    }
  }
  return{src:s.src,frameWidth:s.frameWidth!,frameHeight:s.frameHeight!,...(Number.isFinite(s.fps)&&s.fps!?{fps:s.fps}:{}),default:{row:s.default.row,frames:s.default.frames,...(Number.isFinite(s.default.fps)&&s.default.fps!?{fps:s.default.fps}:{})},animations};
}

export interface PetPack { id:string;name:string;version:string;species:Species;author:string;description:string;appearance:PetAppearance;personality?:Partial<Personality>;tags:string[]; }

export const BUILTIN_PACKS:PetPack[]=[
  {id:"cat-orange",name:"Orange Tabby",version:"1.0.0",species:"cat",author:"PetOS",description:"Curious, energetic orange cat.",appearance:{coat:"#d77b36",accent:"#f2bf7d",eye:"#d9ef73",scale:1},personality:{curiosity:.92,playfulness:.88,energy:.68},tags:["cat","orange","starter"]},
  {id:"cat-tuxedo",name:"Tuxedo Cat",version:"1.0.0",species:"cat",author:"PetOS",description:"Confident black-and-white cat.",appearance:{coat:"#25252d",accent:"#f0ede5",eye:"#8bd6a1",scale:1},personality:{boldness:.72,affection:.7},tags:["cat","tuxedo"]},
  {id:"dog-golden",name:"Golden Dog",version:"1.0.0",species:"dog",author:"PetOS",description:"Social, affectionate desktop dog.",appearance:{coat:"#c9924d",accent:"#efca8b",eye:"#4c321f",scale:1.05},personality:{sociability:.95,affection:.96,playfulness:.9},tags:["dog","golden"]},
  {id:"rabbit-cream",name:"Cream Rabbit",version:"1.0.0",species:"rabbit",author:"PetOS",description:"Gentle, curious rabbit.",appearance:{coat:"#e6d7bd",accent:"#caa9a4",eye:"#493c3c",scale:.95},personality:{boldness:.3,curiosity:.64},tags:["rabbit"]},
  {id:"bird-blue",name:"Blue Bird",version:"1.0.0",species:"bird",author:"PetOS",description:"Alert little desktop bird.",appearance:{coat:"#5d8fc7",accent:"#b7d2e8",eye:"#17242f",scale:.85},personality:{energy:.82,curiosity:.86},tags:["bird"]},
  {id:"cat-pixel",name:"Illustrated Cat",version:"1.1.0",species:"cat",author:"PetOS",description:"Code-generated illustrated cat with layered shading and expressive motion.",appearance:{coat:"#d78a4f",accent:"#f2d1a3",eye:"#a7c96b",scale:1,markings:"tabby",sheet:{src:"sheets/cat-sample.png",frameWidth:64,frameHeight:64,fps:7,default:{row:0,frames:4},animations:{idle:{row:0,frames:4},walk:{row:1,frames:6},sleep:{row:2,frames:2,fps:2},run:{row:3,frames:6}}}},tags:["generated","illustrated","sprites","cat"]},
  {id:"dog-pixel",name:"Illustrated Dog",version:"1.1.0",species:"dog",author:"PetOS",description:"Code-generated illustrated dog with layered shading and expressive motion.",appearance:{coat:"#b7824c",accent:"#ead2a7",eye:"#5a4635",scale:1,sheet:{src:"sheets/dog-sample.png",frameWidth:64,frameHeight:64,fps:7,default:{row:0,frames:4},animations:{idle:{row:0,frames:4},walk:{row:1,frames:6},sleep:{row:2,frames:2,fps:2},run:{row:3,frames:6}}}},tags:["generated","illustrated","sprites","dog"]}
];

export function validatePack(value:unknown):PetPack|null{
  if(!value||typeof value!=="object")return null;const x=value as Partial<PetPack>;
  if(typeof x.id!=="string"||typeof x.name!=="string"||!["cat","dog","rabbit","bird"].includes(x.species??""))return null;
  const appearance=x.appearance;if(!appearance||typeof appearance.coat!=="string"||typeof appearance.accent!=="string"||typeof appearance.eye!=="string")return null;
  return{id:x.id,name:x.name,version:x.version??"1.0.0",species:x.species as Species,author:x.author??"Community",description:x.description??"Custom PetOS pet pack",appearance:{...appearance,scale:Number.isFinite(appearance.scale)?appearance.scale:1},...(x.personality?{personality:x.personality}:{}),tags:Array.isArray(x.tags)?x.tags:[]};
}

export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va !== vb) return va - vb;
  }
  return 0;
}

export function isCompatible(pack: PetPack, minVersion: string): boolean {
  return compareVersions(pack.version, minVersion) >= 0;
}

export interface PackValidationResult {
  pack: PetPack | null;
  errors: string[];
  warnings: string[];
}

export function validatePackDetailed(value: unknown): PackValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!value || typeof value !== "object") {
    return { pack: null, errors: ["Not a valid JSON object"], warnings };
  }
  const x = value as Partial<PetPack>;
  if (typeof x.id !== "string" || !x.id.trim()) errors.push("Missing or empty 'id'");
  if (typeof x.name !== "string" || !x.name.trim()) errors.push("Missing or empty 'name'");
  if (!["cat", "dog", "rabbit", "bird"].includes(x.species ?? "")) errors.push(`Invalid species '${x.species}' — must be cat, dog, rabbit, or bird`);
  let sheet: SpriteSheet | undefined;
  if (x.appearance && "sheet" in x.appearance) {
    const validated = validateSheet(x.appearance.sheet);
    if (validated) sheet = validated;
    else warnings.push("appearance.sheet is present but malformed — falling back to procedural art");
  }
  const markings = MARKINGS.includes(x.appearance?.markings as MarkingPattern) ? x.appearance!.markings : undefined;
  if (x.appearance?.markings && !markings) warnings.push(`Unknown markings '${x.appearance.markings}' — must be uniform, tuxedo, tabby, or patched`);
  if (!x.appearance || typeof x.appearance.coat !== "string") errors.push("Missing appearance.coat");
  else if (!/^#[0-9a-fA-F]{6}$/.test(x.appearance.coat)) warnings.push("appearance.coat should be a hex color like #ff0000");
  if (!x.appearance || typeof x.appearance.accent !== "string") errors.push("Missing appearance.accent");
  if (!x.appearance || typeof x.appearance.eye !== "string") errors.push("Missing appearance.eye");
  if (x.version && !/^\d+\.\d+\.\d+$/.test(x.version)) warnings.push("Version should follow semver (e.g. 1.0.0)");
  if (x.personality) {
    for (const [key, val] of Object.entries(x.personality)) {
      if (typeof val !== "number" || val < 0 || val > 1) warnings.push(`Personality.${key} should be a number between 0 and 1`);
    }
  }
  if (errors.length) return { pack: null, errors, warnings };
  const { sheet:_rawSheet, markings:_rawMarkings, ...cleanAppearance } = x.appearance!;
  return {
    pack: {
      id: x.id!, name: x.name!, version: x.version ?? "1.0.0",
      species: x.species as Species,
      author: x.author ?? "Community",
      description: x.description ?? "Custom PetOS pet pack",
      appearance: { ...cleanAppearance, scale: Number.isFinite(cleanAppearance.scale) ? cleanAppearance.scale : 1, ...(sheet?{sheet}:{}), ...(markings?{markings}:{}) },
      ...(x.personality ? { personality: x.personality } : {}),
      tags: Array.isArray(x.tags) ? x.tags : []
    },
    errors, warnings
  };
}