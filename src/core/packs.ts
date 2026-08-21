import type { PetAppearance, Personality, Species } from "./types.js";

export interface PetPack { id:string;name:string;version:string;species:Species;author:string;description:string;appearance:PetAppearance;personality?:Partial<Personality>;tags:string[]; }

export const BUILTIN_PACKS:PetPack[]=[
  {id:"cat-orange",name:"Orange Tabby",version:"1.0.0",species:"cat",author:"PetOS",description:"Curious, energetic orange cat.",appearance:{coat:"#d77b36",accent:"#f2bf7d",eye:"#d9ef73",scale:1},personality:{curiosity:.92,playfulness:.88,energy:.68},tags:["cat","orange","starter"]},
  {id:"cat-tuxedo",name:"Tuxedo Cat",version:"1.0.0",species:"cat",author:"PetOS",description:"Confident black-and-white cat.",appearance:{coat:"#25252d",accent:"#f0ede5",eye:"#8bd6a1",scale:1},personality:{boldness:.72,affection:.7},tags:["cat","tuxedo"]},
  {id:"dog-golden",name:"Golden Dog",version:"1.0.0",species:"dog",author:"PetOS",description:"Social, affectionate desktop dog.",appearance:{coat:"#c9924d",accent:"#efca8b",eye:"#4c321f",scale:1.05},personality:{sociability:.95,affection:.96,playfulness:.9},tags:["dog","golden"]},
  {id:"rabbit-cream",name:"Cream Rabbit",version:"1.0.0",species:"rabbit",author:"PetOS",description:"Gentle, curious rabbit.",appearance:{coat:"#e6d7bd",accent:"#caa9a4",eye:"#493c3c",scale:.95},personality:{boldness:.3,curiosity:.64},tags:["rabbit"]},
  {id:"bird-blue",name:"Blue Bird",version:"1.0.0",species:"bird",author:"PetOS",description:"Alert little desktop bird.",appearance:{coat:"#5d8fc7",accent:"#b7d2e8",eye:"#17242f",scale:.85},personality:{energy:.82,curiosity:.86},tags:["bird"]}
];

export function validatePack(value:unknown):PetPack|null{
  if(!value||typeof value!=="object")return null;const x=value as Partial<PetPack>;
  if(typeof x.id!=="string"||typeof x.name!=="string"||!["cat","dog","rabbit","bird"].includes(x.species??""))return null;
  const appearance=x.appearance;if(!appearance||typeof appearance.coat!=="string"||typeof appearance.accent!=="string"||typeof appearance.eye!=="string")return null;
  return{id:x.id,name:x.name,version:x.version??"1.0.0",species:x.species as Species,author:x.author??"Community",description:x.description??"Custom PetOS pet pack",appearance:{...appearance,scale:Number.isFinite(appearance.scale)?appearance.scale:1},...(x.personality?{personality:x.personality}:{}),tags:Array.isArray(x.tags)?x.tags:[]};
}
