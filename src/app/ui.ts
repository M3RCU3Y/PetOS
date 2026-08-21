import { BUILTIN_PACKS, validatePack, type PetPack } from "../core/packs.js";
import type { PetOSSettings, Species } from "../core/types.js";

export interface UIActions {
  onToggleInteraction(enabled:boolean):void;
  onToggleDebug(enabled:boolean):void;
  onToggleEnabled(enabled:boolean):void;
  onAddPet(pack:PetPack,name:string):void;
  onRemovePet(id:string):void;
  onAddObject(kind:"bed"|"ball"|"box"):void;
  onImportPack(pack:PetPack):void;
  onReset():void;
}

export class SettingsUI {
  private panel:HTMLElement;
  private backdrop:HTMLElement;
  private petList:HTMLElement;
  private packSelect:HTMLSelectElement;
  private customPacks:PetPack[]=[];
  constructor(private readonly actions:UIActions,settings:PetOSSettings){
    this.panel=document.querySelector("#settings-panel")!;this.backdrop=document.querySelector("#settings-backdrop")!;this.petList=document.querySelector("#pet-list")!;this.packSelect=document.querySelector("#pack-select")!;
    this.renderPacks();
    this.bind(settings);
  }
  open():void{this.panel.classList.add("open");this.backdrop.classList.add("open");}
  close():void{this.panel.classList.remove("open");this.backdrop.classList.remove("open");}
  setPets(pets:{id:string;name:string;species:Species;behavior:string}[]):void{this.petList.innerHTML="";for(const p of pets){const row=document.createElement("div");row.className="pet-row";row.innerHTML=`<span><strong>${escapeHtml(p.name)}</strong><small>${p.species} · ${p.behavior}</small></span><button data-remove="${escapeHtml(p.id)}" title="Remove pet">×</button>`;this.petList.append(row);}this.petList.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach(b=>b.addEventListener("click",()=>this.actions.onRemovePet(b.dataset.remove!)));}
  private bind(settings:PetOSSettings):void{
    const interaction=document.querySelector<HTMLInputElement>("#interaction-toggle")!,debug=document.querySelector<HTMLInputElement>("#debug-toggle")!,enabled=document.querySelector<HTMLInputElement>("#enabled-toggle")!;
    interaction.checked=settings.interactionMode;debug.checked=settings.debug;enabled.checked=settings.enabled;
    interaction.addEventListener("change",()=>this.actions.onToggleInteraction(interaction.checked));debug.addEventListener("change",()=>this.actions.onToggleDebug(debug.checked));enabled.addEventListener("change",()=>this.actions.onToggleEnabled(enabled.checked));
    document.querySelector("#settings-close")!.addEventListener("click",()=>this.close());this.backdrop.addEventListener("click",()=>this.close());document.querySelector("#settings-open")!.addEventListener("click",()=>this.open());
    document.querySelector("#add-pet")!.addEventListener("click",()=>{const pack=this.allPacks().find(p=>p.id===this.packSelect.value)??BUILTIN_PACKS[0]!;const input=document.querySelector<HTMLInputElement>("#pet-name")!;const name=input.value.trim()||pack.name.split(" ")[0]||"Pet";this.actions.onAddPet(pack,name);input.value="";});
    document.querySelectorAll<HTMLButtonElement>("[data-object]").forEach(b=>b.addEventListener("click",()=>this.actions.onAddObject(b.dataset.object as "bed"|"ball"|"box")));
    document.querySelector("#reset-state")!.addEventListener("click",()=>{if(confirm("Reset all PetOS pets, memories and objects?"))this.actions.onReset();});
    const file=document.querySelector<HTMLInputElement>("#pack-file")!;file.addEventListener("change",async()=>{const f=file.files?.[0];if(!f)return;try{const pack=validatePack(JSON.parse(await f.text()));if(!pack)throw new Error("invalid pack");this.customPacks.push(pack);this.renderPacks();this.actions.onImportPack(pack);}catch{alert("That file is not a valid PetOS pet pack JSON.");}finally{file.value="";}});
  }
  private allPacks():PetPack[]{return[...BUILTIN_PACKS,...this.customPacks];}
  private renderPacks():void{const selected=this.packSelect?.value;this.packSelect.innerHTML="";for(const p of this.allPacks()){const option=document.createElement("option");option.value=p.id;option.textContent=`${p.name} · ${p.species}`;this.packSelect.append(option);}if(selected&&this.allPacks().some(p=>p.id===selected))this.packSelect.value=selected;}
}
function escapeHtml(s:string):string{return s.replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]!));}
