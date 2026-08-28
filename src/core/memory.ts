import { clamp, expDecay } from "./math.js";
import type { EpisodicMemory, Relationship, SocialEncounterKind } from "./types.js";

function blankRelationship():Relationship{return{familiarity:0,trust:0,affection:0,irritation:0,rivalry:0};}

export class PetMemory{
  private episodes:EpisodicMemory[];private surfacePrefs:Map<string,number>;private appPrefs:Map<string,number>;private toyPrefs:Map<string,number>;private objectPrefs:Map<string,number>;private relationships:Map<string,Relationship>;private maxEpisodes=200;
  constructor(seed?:{memories?:EpisodicMemory[];surfacePreferences?:Record<string,number>;appPreferences?:Record<string,number>;toyPreferences?:Record<string,number>;objectPreferences?:Record<string,number>;relationships?:Record<string,number|Relationship>}){
    this.episodes=[...(seed?.memories??[])];this.surfacePrefs=new Map(Object.entries(seed?.surfacePreferences??{}));this.appPrefs=new Map(Object.entries(seed?.appPreferences??{}));this.toyPrefs=new Map(Object.entries(seed?.toyPreferences??{}));this.objectPrefs=new Map(Object.entries(seed?.objectPreferences??{}));this.relationships=new Map();
    if(seed?.relationships)for(const[id,value]of Object.entries(seed.relationships))this.relationships.set(id,typeof value==="number"?{...blankRelationship(),familiarity:value}:{...blankRelationship(),...value});
  }
  remember(memory:EpisodicMemory):void{this.episodes.push(memory);this.episodes.sort((a,b)=>a.atMs-b.atMs);if(this.episodes.length>this.maxEpisodes)this.episodes.splice(0,this.episodes.length-this.maxEpisodes);if(memory.surfaceId)this.reinforceSurface(memory.surfaceId,memory.valence*memory.salience*.18);if(memory.app)this.reinforceApp(memory.app,memory.valence*memory.salience*.1);}
  reinforceSurface(id:string,delta:number):void{this.surfacePrefs.set(id,clamp((this.surfacePrefs.get(id)??0)+delta,-1,1));}
  reinforceApp(id:string,delta:number):void{this.appPrefs.set(id,clamp((this.appPrefs.get(id)??0)+delta,-1,1));}
  reinforceToy(id:string,delta:number):void{this.toyPrefs.set(id,clamp((this.toyPrefs.get(id)??0)+delta,-1,1));}
  reinforceObject(id:string,delta:number):void{this.objectPrefs.set(id,clamp((this.objectPrefs.get(id)??0)+delta,-1,1));}
  relate(id:string):Relationship{let rel=this.relationships.get(id);if(!rel){rel=blankRelationship();this.relationships.set(id,rel);}return rel;}
  noteEncounter(id:string,kind:SocialEncounterKind):void{const rel=this.relate(id),bump=(key:keyof Relationship,d:number)=>{rel[key]=clamp(rel[key]+d,-1,1);};switch(kind){case"greet":bump("familiarity",.03);bump("trust",.01);break;case"play":bump("familiarity",.04);bump("affection",.025);bump("trust",.02);bump("rivalry",-.01);break;case"fight":bump("familiarity",.03);bump("rivalry",.035);bump("irritation",.015);break;case"cuddle":case"share":bump("affection",.04);bump("trust",.03);bump("familiarity",.03);bump("irritation",-.025);break;case"steal":bump("irritation",.04);bump("rivalry",.05);break;}}
  adjustRelationship(id:string,delta:number):void{const rel=this.relate(id);rel.affection=clamp(rel.affection+delta,-1,1);rel.trust=clamp(rel.trust+delta*.6,-1,1);rel.familiarity=clamp(rel.familiarity+Math.abs(delta)*.5,-1,1);}
  preferenceForSurface(id:string):number{return this.surfacePrefs.get(id)??0;}preferenceForApp(id:string):number{return this.appPrefs.get(id)??0;}preferenceForToy(id:string):number{return this.toyPrefs.get(id)??0;}preferenceForObject(id:string):number{return this.objectPrefs.get(id)??0;}
  relationshipWith(id:string):number{const rel=this.relationships.get(id);if(!rel)return 0;return clamp(rel.familiarity*.18+rel.trust*.32+rel.affection*.38-rel.irritation*.28-rel.rivalry*.22,-1,1);}
  recent(kind?:EpisodicMemory["kind"],limit=8):EpisodicMemory[]{return this.episodes.filter(e=>!kind||e.kind===kind).slice(-limit);}countKind(kind:EpisodicMemory["kind"],withinMs:number,nowMs:number):number{return this.episodes.filter(e=>e.kind===kind&&nowMs-e.atMs<=withinMs).length;}
  consolidate():void{if(this.episodes.length<=120)return;const weak=this.episodes.findIndex(e=>e.salience<.35);if(weak>=0&&Date.now()-this.episodes[weak]!.atMs>60*60*1000)this.episodes.splice(weak,1);}
  decay(dtSeconds:number):void{for(const[k,v]of this.surfacePrefs)this.surfacePrefs.set(k,expDecay(v,60*60*24*21,dtSeconds));for(const[k,v]of this.appPrefs)this.appPrefs.set(k,expDecay(v,60*60*24*30,dtSeconds));for(const[k,v]of this.toyPrefs)this.toyPrefs.set(k,expDecay(v,60*60*24*14,dtSeconds));for(const[k,v]of this.objectPrefs)this.objectPrefs.set(k,expDecay(v,60*60*24*28,dtSeconds));}
  favoriteSurface():string|null{let best:[string,number]|null=null;for(const entry of this.surfacePrefs)if(!best||entry[1]>best[1])best=entry;return best&&best[1]>.15?best[0]:null;}
  favoriteToy():string|null{let best:[string,number]|null=null;for(const entry of this.toyPrefs)if(!best||entry[1]>best[1])best=entry;return best&&best[1]>.12?best[0]:null;}
  favoriteObject():string|null{let best:[string,number]|null=null;for(const entry of this.objectPrefs)if(!best||entry[1]>best[1])best=entry;return best&&best[1]>.15?best[0]:null;}
  relationshipsSnapshot():Record<string,number>{const out:Record<string,number>={};for(const id of this.relationships.keys())out[id]=this.relationshipWith(id);return out;}
  serialize():{memories:EpisodicMemory[];surfacePreferences:Record<string,number>;appPreferences:Record<string,number>;toyPreferences:Record<string,number>;objectPreferences:Record<string,number>;relationships:Record<string,Relationship>}{return{memories:[...this.episodes],surfacePreferences:Object.fromEntries(this.surfacePrefs),appPreferences:Object.fromEntries(this.appPrefs),toyPreferences:Object.fromEntries(this.toyPrefs),objectPreferences:Object.fromEntries(this.objectPrefs),relationships:Object.fromEntries(this.relationships)};}
}
