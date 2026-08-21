import { extractPalette } from "./photo.js";
import type { DiaryEntry } from "../core/diary.js";
import { computeSocialEdges, renderSocialGraph } from "./social.js";
import { BrowserPersistence } from "../core/persistence.js";
import { BUILTIN_PACKS, validatePack, type PetPack } from "../core/packs.js";
import { SPECIES } from "../core/species.js";
import type { PetOSSettings, Species } from "../core/types.js";

const SPECIES_DEFAULTS: Record<string, any> = Object.fromEntries(Object.entries(SPECIES).map(([k,v])=>[k,v.defaultPersonality]));

type HabitatKind = "bed"|"ball"|"box"|"food"|"water"|"scratcher";

export interface UIActions {
  onToggleInteraction(enabled:boolean):void;
  onToggleDebug(enabled:boolean):void;
  onToggleEnabled(enabled:boolean):void;
  onAddPet(pack:PetPack,name:string):void;
  onRemovePet(id:string):void;
  onAddObject(kind:HabitatKind):void;
  onPrivacyLevel(level:0|1|2|3):void;
  onToggleSound(enabled:boolean):void;
  onImportPack(pack:PetPack):void;
  onReset():void;
  onCreateCustomPet(config:{species:Species;name:string;appearance:{coat:string;accent:string;eye:string;scale:number};personality:Record<string,number>}):void;
}

export interface CreatorState {
  species: Species;
  name: string;
  coat: string;
  accent: string;
  eye: string;
  personality: Record<string, number>;
}

const PERSONALITY_TRAILS: Array<{ key: string; label: string; left: string; right: string }> = [
  { key: "energy", label: "Energy", left: "sleepy", right: "energetic" },
  { key: "curiosity", label: "Curiosity", left: "cautious", right: "curious" },
  { key: "boldness", label: "Boldness", left: "shy", right: "bold" },
  { key: "sociability", label: "Sociability", left: "aloof", right: "social" },
  { key: "affection", label: "Affection", left: "independent", right: "clingy" },
  { key: "patience", label: "Patience", left: "calm", right: "chaotic" },
  { key: "playfulness", label: "Playfulness", left: "serious", right: "playful" },
  { key: "independence", label: "Independence", left: "dependent", right: "independent" },
  { key: "foodDrive", label: "Food drive", left: "picky", right: "foodie" },
];

export class SettingsUI {
  private panel:HTMLElement;
  private backdrop:HTMLElement;
  private petList:HTMLElement;
  private packSelect:HTMLSelectElement;
  private lifeLog:HTMLElement;
  private customPacks:PetPack[]=[];
  private persistence:BrowserPersistence|null=null;
  private creatorState:CreatorState = { species:"cat", name:"", coat:"#d98742", accent:"#f2c287", eye:"#d7ef76", personality:{} };
  constructor(private readonly actions:UIActions,settings:PetOSSettings,persistence?:BrowserPersistence){
    this.persistence=persistence??null;
    this.panel=document.querySelector("#settings-panel")!;this.backdrop=document.querySelector("#settings-backdrop")!;this.petList=document.querySelector("#pet-list")!;this.packSelect=document.querySelector("#pack-select")!;this.lifeLog=document.querySelector("#life-log")!;
    this.renderPacks();
    this.bind(settings);
  }
  open():void{this.panel.classList.add("open");this.backdrop.classList.add("open");}
  close():void{this.panel.classList.remove("open");this.backdrop.classList.remove("open");}
  setPets(pets:{id:string;name:string;species:Species;behavior:string}[]):void{this.petList.innerHTML="";for(const p of pets){const row=document.createElement("div");row.className="pet-row";row.innerHTML=`<span><strong>${escapeHtml(p.name)}</strong><small>${p.species} · ${p.behavior}</small></span><button data-remove="${escapeHtml(p.id)}" title="Remove pet">×</button>`;this.petList.append(row);}this.petList.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach(b=>b.addEventListener("click",()=>this.actions.onRemovePet(b.dataset.remove!)));}
  setDiary(entries:DiaryEntry[]):void{
    const el=document.querySelector("#diary-list");
    if(!el)return;
    if(!entries.length){el.innerHTML="<p>Notable moments will appear here.</p>";return;}
    el.innerHTML=entries.slice(-10).reverse().map(e=>`<div class="log-row"><span>${e.title}</span><small>${e.detail}</small></div>`).join("");
  }
  setLifeLog(entries:{pet:string;atMs:number;note:string;kind:string}[]):void{
    if(!entries.length){this.lifeLog.innerHTML="<p>Your pets’ memorable moments will appear here.</p>";return;}
    this.lifeLog.innerHTML=entries.slice(-10).reverse().map(e=>`<div class="log-row"><span>${escapeHtml(e.pet)}</span><small>${escapeHtml(e.note)} · ${escapeHtml(e.kind)}</small></div>`).join("");
  }
  private bind(settings:PetOSSettings):void{
    const interaction=document.querySelector<HTMLInputElement>("#interaction-toggle")!,debug=document.querySelector<HTMLInputElement>("#debug-toggle")!,enabled=document.querySelector<HTMLInputElement>("#enabled-toggle")!;
    interaction.checked=settings.interactionMode;debug.checked=settings.debug;enabled.checked=settings.enabled;
    interaction.addEventListener("change",()=>this.actions.onToggleInteraction(interaction.checked));debug.addEventListener("change",()=>this.actions.onToggleDebug(debug.checked));enabled.addEventListener("change",()=>this.actions.onToggleEnabled(enabled.checked));
    document.querySelector("#settings-close")!.addEventListener("click",()=>this.close());this.backdrop.addEventListener("click",()=>this.close());document.querySelector("#settings-open")!.addEventListener("click",()=>this.open());
    document.querySelector("#add-pet")!.addEventListener("click",()=>{const pack=this.allPacks().find(p=>p.id===this.packSelect.value)??BUILTIN_PACKS[0]!;const input=document.querySelector<HTMLInputElement>("#pet-name")!;const name=input.value.trim()||pack.name.split(" ")[0]||"Pet";this.actions.onAddPet(pack,name);input.value="";});
    document.querySelectorAll<HTMLButtonElement>("[data-object]").forEach(b=>b.addEventListener("click",()=>this.actions.onAddObject(b.dataset.object as HabitatKind)));
    const privacy=document.querySelector<HTMLSelectElement>("#privacy-level")!;privacy.value=String(settings.privacyLevel);privacy.addEventListener("change",()=>this.actions.onPrivacyLevel(Number(privacy.value) as 0|1|2|3));
    document.querySelector("#reset-state")!.addEventListener("click",()=>{if(confirm("Reset all PetOS pets, memories and objects?"))this.actions.onReset();});
    const file=document.querySelector<HTMLInputElement>("#pack-file")!;file.addEventListener("change",async()=>{const f=file.files?.[0];if(!f)return;try{const pack=validatePack(JSON.parse(await f.text()));if(!pack)throw new Error("invalid pack");this.customPacks.push(pack);this.renderPacks();this.actions.onImportPack(pack);}catch{alert("That file is not a valid PetOS pet pack JSON.");}finally{file.value="";}});
  }
  private updateSocialGraph(pets:{id:string;name:string;species:Species;behavior:string}[]):void{
    const container=document.querySelector("#social-graph");
    if(!container)return;
    const relMap=new Map<string,Map<string,number>>();
    const edges=computeSocialEdges(pets.map(p=>({id:p.id,name:p.name,species:p.species} as any)),relMap);
    renderSocialGraph(container as HTMLElement,pets.map(p=>({id:p.id,name:p.name,species:p.species})),edges);
  }

  private bindCreator():void{
    const container=document.querySelector("#creator-sliders")!;
    container.innerHTML=PERSONALITY_TRAILS.map(t=>{
      const val=this.creatorState.personality[t.key]??SPECIES_DEFAULTS[this.creatorState.species]?.[t.key]??.5;
      return `<div class="creator-slider"><label><span>${t.label}</span><span>${t.left} — ${t.right}</span></label><input type="range" min="0" max="1" step="0.01" value="${val}" data-trait="${t.key}"></div>`;
    }).join("");
    container.querySelectorAll<HTMLInputElement>("[data-trait]").forEach(input=>{
      input.addEventListener("input",()=>{this.creatorState.personality[input.dataset.trait!]=Number(input.value);});
    });
    document.querySelectorAll<HTMLButtonElement>("[data-species]").forEach(b=>{
      b.addEventListener("click",()=>{
        this.creatorState.species=b.dataset.species as Species;
        document.querySelectorAll<HTMLButtonElement>("[data-species]").forEach(x=>x.classList.remove("primary"));
        b.classList.add("primary");
        this.creatorState.personality={};
        this.bindCreator();
      });
    });
    const coat=document.querySelector<HTMLInputElement>("#creator-coat")!,accent=document.querySelector<HTMLInputElement>("#creator-accent")!,eye=document.querySelector<HTMLInputElement>("#creator-eye")!;
    coat.value=this.creatorState.coat;accent.value=this.creatorState.accent;eye.value=this.creatorState.eye;
    coat.addEventListener("input",()=>this.creatorState.coat=coat.value);
    accent.addEventListener("input",()=>this.creatorState.accent=accent.value);
    eye.addEventListener("input",()=>this.creatorState.eye=eye.value);
    const photoInput=document.querySelector<HTMLInputElement>("#creator-photo")!;
    photoInput.addEventListener("change",async()=>{
      const f=photoInput.files?.[0];
      if(!f)return;
      try{
        const palette=await extractPalette(f);
        this.creatorState.coat=palette.coat;
        this.creatorState.accent=palette.accent;
        this.creatorState.eye=palette.eye;
        const coat=document.querySelector<HTMLInputElement>("#creator-coat")!,accent=document.querySelector<HTMLInputElement>("#creator-accent")!,eye=document.querySelector<HTMLInputElement>("#creator-eye")!;
        coat.value=palette.coat;accent.value=palette.accent;eye.value=palette.eye;
      }catch{alert("Could not read that image.");}finally{photoInput.value="";}
    });
    document.querySelector("#creator-create")!.addEventListener("click",()=>{
      const nameInput=document.querySelector<HTMLInputElement>("#creator-name")!;
      const name=nameInput.value.trim()||"Buddy";
      this.actions.onCreateCustomPet({
        species:this.creatorState.species,name,
        appearance:{coat:this.creatorState.coat,accent:this.creatorState.accent,eye:this.creatorState.eye,scale:1},
        personality:this.creatorState.personality
      });
      nameInput.value="";
    });
  }
  private allPacks():PetPack[]{return[...BUILTIN_PACKS,...this.customPacks];}
  private renderPacks():void{const selected=this.packSelect?.value;this.packSelect.innerHTML="";for(const p of this.allPacks()){const option=document.createElement("option");option.value=p.id;option.textContent=`${p.name} · ${p.species}`;this.packSelect.append(option);}if(selected&&this.allPacks().some(p=>p.id===selected))this.packSelect.value=selected;}
}
function escapeHtml(s:string):string{return s.replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]!));}