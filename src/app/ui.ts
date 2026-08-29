import { extractPalette, extractMarkings } from "./photo.js";
import type { DiaryEntry } from "../core/diary.js";
import { renderSocialGraph, type SocialEdge } from "./social.js";
import { renderPetPreview } from "./renderer.js";
import { PhotographyMode } from "./photography.js";
import { BrowserPersistence } from "../core/persistence.js";
import { BUILTIN_PACKS, validatePackDetailed, type PetPack } from "../core/packs.js";
import { SPECIES } from "../core/species.js";
import type { MarkingPattern, PetOSSettings, Species } from "../core/types.js";

const SPECIES_DEFAULTS:Record<string,any>=Object.fromEntries(Object.entries(SPECIES).map(([k,v])=>[k,v.defaultPersonality]));
type HabitatKind="bed"|"ball"|"box"|"food"|"water"|"scratcher"|"plant"|"perch"|"tunnel";

export interface UIActions{
  onToggleInteraction(enabled:boolean):void;onToggleDebug(enabled:boolean):void;onToggleEnabled(enabled:boolean):void;
  onAddPet(pack:PetPack,name:string):void;onRemovePet(id:string):void;onAddObject(kind:HabitatKind):void;
  onPrivacyLevel(level:0|1|2|3):void;onToggleSound(enabled:boolean):void;onSoundVolume(volume:number):void;onToggleQuietHours(enabled:boolean):void;
  onCortexConfig(provider:"off"|"ollama"|"openai"|"openrouter"|"gemini"|"anthropic",apiKey:string,model:string):void;
  onToggleAutostart(enabled:boolean):void;onFocusConfig(enabled:boolean,workMinutes:number,breakMinutes:number):void;
  onUpdateManifestUrl(url:string):void;onCheckUpdates():Promise<{status:"available"|"latest"|"error";message:string}>;
  onClose?():void;onImportPack(pack:PetPack):void;onExportState():void;onImportState(json:string):boolean;onReset():void;
  onCreateCustomPet(config:{species:Species;name:string;appearance:{coat:string;accent:string;eye:string;scale:number;markings?:MarkingPattern};personality:Record<string,number>}):void;
}

export interface CreatorState{species:Species;name:string;coat:string;accent:string;eye:string;markings?:MarkingPattern;personality:Record<string,number>;}

const PERSONALITY_TRAILS:Array<{key:string;label:string;left:string;right:string}>=[
  {key:"energy",label:"Energy",left:"sleepy",right:"energetic"},{key:"curiosity",label:"Curiosity",left:"cautious",right:"curious"},
  {key:"boldness",label:"Boldness",left:"shy",right:"bold"},{key:"sociability",label:"Sociability",left:"aloof",right:"social"},
  {key:"affection",label:"Affection",left:"independent",right:"clingy"},{key:"patience",label:"Patience",left:"calm",right:"chaotic"},
  {key:"playfulness",label:"Playfulness",left:"serious",right:"playful"},{key:"independence",label:"Independence",left:"dependent",right:"independent"},
  {key:"foodDrive",label:"Food drive",left:"picky",right:"foodie"}
];

const LOOK_PRESETS:Array<{name:string;coat:string;accent:string;eye:string;markings:MarkingPattern}>=[
  {name:"Marmalade",coat:"#d98742",accent:"#f2c287",eye:"#b8cc6b",markings:"tabby"},
  {name:"Moon Tuxedo",coat:"#292a31",accent:"#f0ece3",eye:"#8fc79c",markings:"tuxedo"},
  {name:"Cream Biscuit",coat:"#c9a77f",accent:"#f1dbc0",eye:"#91ad6c",markings:"uniform"},
  {name:"Cocoa Patch",coat:"#795340",accent:"#dfb887",eye:"#d8b85f",markings:"patched"},
  {name:"Silver Tabby",coat:"#777982",accent:"#d5d0c7",eye:"#a3c6a0",markings:"tabby"},
  {name:"Cloud Point",coat:"#eadfc8",accent:"#705447",eye:"#70b9e8",markings:"patched"},
  {name:"Midnight",coat:"#22242b",accent:"#8d7d74",eye:"#d1b962",markings:"uniform"},
  {name:"Peach Patch",coat:"#c87958",accent:"#f3cbb0",eye:"#8fb58c",markings:"patched"}
];

export class SettingsUI{
  private panel:HTMLElement;private backdrop:HTMLElement;private petList:HTMLElement;private packSelect:HTMLSelectElement;private lifeLog:HTMLElement;
  private customPacks:PetPack[]=[];private packHashes=new Map<string,string>();private persistence:BrowserPersistence|null=null;
  private relationshipsData:Record<string,Record<string,number>>={};
  private creatorState:CreatorState={species:"cat",name:"",coat:"#d98742",accent:"#f2c287",eye:"#d7ef76",markings:"tabby",personality:{}};
  private previewTimer=0;private lookIndex=0;

  constructor(private readonly actions:UIActions,settings:PetOSSettings,persistence?:BrowserPersistence){
    this.persistence=persistence??null;
    this.panel=document.querySelector("#settings-panel")!;this.backdrop=document.querySelector("#settings-backdrop")!;this.petList=document.querySelector("#pet-list")!;this.packSelect=document.querySelector("#pack-select")!;this.lifeLog=document.querySelector("#life-log")!;
    this.panel.inert=true;this.renderPacks();this.bind(settings);this.bindCreatorStatic();this.bindCreatorSliders();this.startPreview();
  }

  private creatorAppearance(){return{coat:this.creatorState.coat,accent:this.creatorState.accent,eye:this.creatorState.eye,scale:1,...(this.creatorState.markings?{markings:this.creatorState.markings}:{})};}
  private updateCreatorCaption(label?:string):void{
    const el=document.querySelector<HTMLElement>("#creator-preview-caption");if(!el)return;
    const pattern=this.creatorState.markings??"uniform";
    el.textContent=label??`${this.creatorState.species} · ${pattern} · live procedural preview`;
  }
  private syncCreatorInputs():void{
    document.querySelector<HTMLInputElement>("#creator-coat")!.value=this.creatorState.coat;
    document.querySelector<HTMLInputElement>("#creator-accent")!.value=this.creatorState.accent;
    document.querySelector<HTMLInputElement>("#creator-eye")!.value=this.creatorState.eye;
    const markings=document.querySelector<HTMLSelectElement>("#creator-markings");if(markings)markings.value=this.creatorState.markings??"uniform";
    this.updateCreatorCaption();
  }
  private applyLook(look:(typeof LOOK_PRESETS)[number]):void{
    this.creatorState.coat=look.coat;this.creatorState.accent=look.accent;this.creatorState.eye=look.eye;this.creatorState.markings=look.markings;
    this.syncCreatorInputs();this.updateCreatorCaption(`${look.name} · ${look.markings} · live procedural preview`);
  }

  private startPreview():void{
    const canvas=document.querySelector<HTMLCanvasElement>("#creator-preview");if(!canvas)return;
    const behaviors=["idle","sit","groom","sleep","walk"];
    this.previewTimer=window.setInterval(()=>{
      if(!this.panel.classList.contains("open"))return;
      const behavior=behaviors[Math.floor(performance.now()/3600)%behaviors.length]!;
      renderPetPreview(canvas,this.creatorState.species,this.creatorAppearance(),behavior,performance.now());
    },120);
    renderPetPreview(canvas,this.creatorState.species,this.creatorAppearance(),"idle",performance.now());
    this.updateCreatorCaption();
  }

  open():void{this.panel.inert=false;this.panel.classList.add("open");this.backdrop.classList.add("open");requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>("#settings-close")?.focus());}
  close():void{this.panel.classList.remove("open");this.backdrop.classList.remove("open");this.panel.inert=true;document.querySelector<HTMLButtonElement>("#settings-open")?.focus();this.actions.onClose?.();}
  setPets(pets:{id:string;name:string;species:Species;behavior:string}[]):void{this.petList.innerHTML="";for(const p of pets){const row=document.createElement("div");row.className="pet-row";row.innerHTML=`<span><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.species)} · ${escapeHtml(p.behavior)}</small></span><button data-remove="${escapeHtml(p.id)}" title="Remove pet">×</button>`;this.petList.append(row);}this.petList.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach(b=>b.addEventListener("click",()=>this.actions.onRemovePet(b.dataset.remove!)));this.updateSocialGraph(pets);}
  setRelationships(relationships:Record<string,Record<string,number>>):void{this.relationshipsData=relationships;}
  setFocusStatus(phase:"idle"|"work"|"break",remainingSeconds:number):void{const el=document.querySelector("#focus-status");if(!el)return;if(phase==="idle"){el.textContent="Not running.";return;}const m=Math.floor(remainingSeconds/60),s=remainingSeconds%60;el.textContent=phase==="work"?`Working — pets are resting quietly. ${m}:${String(s).padStart(2,"0")} until break.`:`Break time! Your pets are coming over. ${m}:${String(s).padStart(2,"0")}`;}
  setDiary(entries:DiaryEntry[]):void{const el=document.querySelector("#diary-list");if(!el)return;if(!entries.length){el.innerHTML="<p>Notable moments will appear here.</p>";return;}el.innerHTML=entries.slice(-10).reverse().map(e=>`<div class="log-row"><span>${escapeHtml(e.title)}</span><small>${escapeHtml(e.detail)}</small></div>`).join("");}
  setLifeLog(entries:{pet:string;atMs:number;note:string;kind:string}[]):void{if(!entries.length){this.lifeLog.innerHTML="<p>Your pets’ memorable moments will appear here.</p>";return;}this.lifeLog.innerHTML=entries.slice(-10).reverse().map(e=>`<div class="log-row"><span>${escapeHtml(e.pet)}</span><small>${escapeHtml(e.note)} · ${escapeHtml(e.kind)}</small></div>`).join("");}

  private bind(settings:PetOSSettings):void{
    const interaction=document.querySelector<HTMLInputElement>("#interaction-toggle")!,debug=document.querySelector<HTMLInputElement>("#debug-toggle")!,enabled=document.querySelector<HTMLInputElement>("#enabled-toggle")!;
    interaction.checked=settings.interactionMode;debug.checked=settings.debug;enabled.checked=settings.enabled;
    interaction.addEventListener("change",()=>this.actions.onToggleInteraction(interaction.checked));debug.addEventListener("change",()=>this.actions.onToggleDebug(debug.checked));enabled.addEventListener("change",()=>this.actions.onToggleEnabled(enabled.checked));
    document.querySelector("#settings-close")!.addEventListener("click",()=>this.close());this.backdrop.addEventListener("click",()=>this.close());document.querySelector("#settings-open")!.addEventListener("click",()=>this.open());
    document.querySelector("#add-pet")!.addEventListener("click",()=>{const pack=this.allPacks().find(p=>p.id===this.packSelect.value)??BUILTIN_PACKS[0]!;const input=document.querySelector<HTMLInputElement>("#pet-name")!;const name=input.value.trim()||pack.name.split(" ")[0]||"Pet";this.actions.onAddPet(pack,name);input.value="";});
    const privacy=document.querySelector<HTMLSelectElement>("#privacy-level")!;privacy.value=String(settings.privacyLevel);privacy.addEventListener("change",()=>this.actions.onPrivacyLevel(Number(privacy.value) as 0|1|2|3));
    document.querySelector("#reset-state")!.addEventListener("click",()=>{if(confirm("Reset all PetOS pets, memories and objects?"))this.actions.onReset();});
    const soundToggle=document.querySelector<HTMLInputElement>("#sound-toggle")!;soundToggle.checked=settings.sound;soundToggle.addEventListener("change",()=>this.actions.onToggleSound(soundToggle.checked));
    const volume=document.querySelector<HTMLInputElement>("#sound-volume")!;volume.value=String(settings.soundVolume);volume.addEventListener("input",()=>this.actions.onSoundVolume(Number(volume.value)));
    const quiet=document.querySelector<HTMLInputElement>("#quiet-hours-toggle")!;quiet.checked=settings.quietHours;quiet.addEventListener("change",()=>this.actions.onToggleQuietHours(quiet.checked));
    const autostart=document.querySelector<HTMLInputElement>("#autostart-toggle")!;if(autostart){autostart.checked=settings.autostart;autostart.addEventListener("change",()=>this.actions.onToggleAutostart(autostart.checked));}
    const focusToggle=document.querySelector<HTMLInputElement>("#focus-toggle")!,focusWork=document.querySelector<HTMLInputElement>("#focus-work")!,focusBreak=document.querySelector<HTMLInputElement>("#focus-break")!;
    if(focusToggle&&focusWork&&focusBreak){focusToggle.checked=settings.focusMode;focusWork.value=String(settings.focusWorkMinutes);focusBreak.value=String(settings.focusBreakMinutes);const emit=()=>this.actions.onFocusConfig(focusToggle.checked,Math.max(1,Number(focusWork.value)||25),Math.max(1,Number(focusBreak.value)||5));focusToggle.addEventListener("change",emit);focusWork.addEventListener("change",emit);focusBreak.addEventListener("change",emit);}
    const updateUrl=document.querySelector<HTMLInputElement>("#update-url")!;updateUrl.value=settings.updateManifestUrl;let urlDebounce=0;updateUrl.addEventListener("input",()=>{clearTimeout(urlDebounce);urlDebounce=setTimeout(()=>this.actions.onUpdateManifestUrl(updateUrl.value.trim()),500);});
    document.querySelector("#update-check")?.addEventListener("click",async()=>{const status=document.querySelector<HTMLElement>("#update-status");if(status)status.textContent="Checking…";try{const result=await this.actions.onCheckUpdates();if(status){status.textContent=result.message;status.style.color=result.status==="available"?"#8bd6a1":result.status==="error"?"#d85b58":"inherit";}}catch{if(status)status.textContent="Update check failed.";}});
    const cortex=document.querySelector<HTMLSelectElement>("#cortex-provider");if(cortex){const keyInput=document.querySelector<HTMLInputElement>("#cortex-key")!,modelInput=document.querySelector<HTMLInputElement>("#cortex-model")!;cortex.value=settings.cortexProvider;keyInput.value=settings.cortexApiKey;modelInput.value=settings.cortexModel;let debounce=0;const emit=()=>{clearTimeout(debounce);debounce=setTimeout(()=>this.actions.onCortexConfig(cortex.value as "off"|"ollama"|"openai"|"openrouter"|"gemini"|"anthropic",keyInput.value.trim(),modelInput.value.trim()),400);};cortex.addEventListener("change",emit);keyInput.addEventListener("input",emit);modelInput.addEventListener("input",emit);}
    document.querySelector("#export-state")?.addEventListener("click",()=>this.actions.onExportState());document.querySelector("#import-state")?.addEventListener("click",()=>document.querySelector<HTMLInputElement>("#import-file")?.click());
    const importFile=document.querySelector<HTMLInputElement>("#import-file");importFile?.addEventListener("change",async()=>{const f=importFile.files?.[0];if(!f)return;const json=await f.text();if(this.actions.onImportState(json))location.reload();importFile.value="";});
    const file=document.querySelector<HTMLInputElement>("#pack-file")!;file.addEventListener("change",async()=>{const f=file.files?.[0];if(!f)return;try{const text=await f.text();const result=validatePackDetailed(JSON.parse(text));if(!result.pack)throw new Error(result.errors.join("; "));this.customPacks.push(result.pack);this.packHashes.set(result.pack.id,(await this.hashText(text)).slice(0,12));this.renderPacks();this.actions.onImportPack(result.pack);}catch{alert("That file is not a valid PetOS pet pack JSON.");}finally{file.value="";}});
  }

  setGallery(urls:string[]):void{const el=document.querySelector("#photo-gallery");if(!el)return;if(!urls.length){el.innerHTML="<p>No photos yet — press 📷 Photo below to take one.</p>";return;}el.innerHTML="";urls.forEach((url,i)=>{const cell=document.createElement("div");cell.className="photo-cell";const img=document.createElement("img");img.src=url;img.alt=`PetOS snapshot ${i+1}`;img.title="Click to download";img.addEventListener("click",()=>{const a=document.createElement("a");a.href=url;a.download=`petos-photo-${i}.jpg`;a.click();});const del=document.createElement("button");del.textContent="×";del.title="Remove";del.addEventListener("click",()=>{PhotographyMode.removeFromGallery(i);this.setGallery(PhotographyMode.loadGallery());});cell.append(img,del);el.append(cell);});}
  private updateSocialGraph(pets:{id:string;name:string;species:Species;behavior:string}[]):void{const container=document.querySelector("#social-graph");if(!container)return;const edges:SocialEdge[]=[];for(let i=0;i<pets.length;i++)for(let j=i+1;j<pets.length;j++){const a=pets[i]!,b=pets[j]!;edges.push({from:a.id,to:b.id,value:this.relationshipsData[a.id]?.[b.id]??0});}renderSocialGraph(container as HTMLElement,pets,edges);}

  private bindCreatorStatic():void{
    const panel=document.querySelector("#settings-panel");
    if(panel){panel.querySelectorAll<HTMLButtonElement>("button[data-species]").forEach(b=>b.addEventListener("click",()=>{this.creatorState.species=b.dataset.species as Species;panel.querySelectorAll<HTMLButtonElement>("button[data-species]").forEach(x=>x.classList.remove("primary"));b.classList.add("primary");this.creatorState.personality={};this.bindCreatorSliders();this.updateCreatorCaption();}));}
    const coat=document.querySelector<HTMLInputElement>("#creator-coat")!,accent=document.querySelector<HTMLInputElement>("#creator-accent")!,eye=document.querySelector<HTMLInputElement>("#creator-eye")!,markings=document.querySelector<HTMLSelectElement>("#creator-markings")!;
    this.syncCreatorInputs();
    coat.addEventListener("input",()=>{this.creatorState.coat=coat.value;this.updateCreatorCaption();});accent.addEventListener("input",()=>{this.creatorState.accent=accent.value;this.updateCreatorCaption();});eye.addEventListener("input",()=>{this.creatorState.eye=eye.value;this.updateCreatorCaption();});
    markings.addEventListener("change",()=>{this.creatorState.markings=markings.value as MarkingPattern;this.updateCreatorCaption();});
    document.querySelector("#creator-randomize")?.addEventListener("click",()=>{this.lookIndex=(this.lookIndex+1)%LOOK_PRESETS.length;this.applyLook(LOOK_PRESETS[this.lookIndex]!);});
    const photoInput=document.querySelector<HTMLInputElement>("#creator-photo")!;
    photoInput.addEventListener("change",async()=>{const f=photoInput.files?.[0];if(!f)return;try{const palette=await extractPalette(f),detected=await extractMarkings(f);this.creatorState.coat=palette.coat;this.creatorState.accent=palette.accent;this.creatorState.eye=palette.eye;this.creatorState.markings=detected.pattern;this.syncCreatorInputs();const note=document.querySelector("#creator-markings-note");if(note)note.textContent=`Photo analysis: ${detected.pattern} coat pattern (${(detected.confidence*100).toFixed(0)}% confidence). The live renderer is using the extracted palette now.`;}catch{alert("Could not read that image.");}finally{photoInput.value="";}});
    document.querySelector("#creator-create")!.addEventListener("click",()=>{const nameInput=document.querySelector<HTMLInputElement>("#creator-name")!;const name=nameInput.value.trim()||"Buddy";this.actions.onCreateCustomPet({species:this.creatorState.species,name,appearance:this.creatorAppearance(),personality:this.creatorState.personality});nameInput.value="";});
  }

  private bindCreatorSliders():void{const container=document.querySelector("#creator-sliders");if(!container)return;container.innerHTML=PERSONALITY_TRAILS.map(t=>{const val=this.creatorState.personality[t.key]??SPECIES_DEFAULTS[this.creatorState.species]?.[t.key]??.5;return`<div class="creator-slider"><label><span>${t.label}</span><span>${t.left} — ${t.right}</span></label><input type="range" min="0" max="1" step="0.01" value="${val}" data-trait="${t.key}"></div>`;}).join("");container.querySelectorAll<HTMLInputElement>("[data-trait]").forEach(input=>input.addEventListener("input",()=>{this.creatorState.personality[input.dataset.trait!]=Number(input.value);}));}
  private async hashText(text:string):Promise<string>{try{const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));return[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");}catch{return"unsigned";}}
  private allPacks():PetPack[]{return[...BUILTIN_PACKS,...this.customPacks];}
  private renderPacks():void{const selected=this.packSelect?.value;this.packSelect.innerHTML="";for(const p of this.allPacks()){const option=document.createElement("option");option.value=p.id;option.textContent=`${p.name} · ${p.species}`;this.packSelect.append(option);}if(selected&&this.allPacks().some(p=>p.id===selected))this.packSelect.value=selected;const listEl=document.querySelector("#pack-list");if(listEl){listEl.innerHTML="";const rows=[...BUILTIN_PACKS.map(p=>({p,hash:"built-in",author:p.author})),...this.customPacks.map(p=>({p,hash:this.packHashes.get(p.id)??"unsigned",author:p.author}))];for(const{p,hash,author}of rows){const row=document.createElement("div");row.className="pack-row";row.innerHTML=`<span>${escapeHtml(p.name)} <small style="opacity:.55">v${escapeHtml(p.version)} · ${escapeHtml(author)}</small></span><code title="SHA-256 fingerprint (first 12 hex)">${escapeHtml(hash)}</code>`;listEl.append(row);}}}
}
function escapeHtml(s:string):string{return s.replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]!));}
