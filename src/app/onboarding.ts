import { SPECIES } from "../core/species.js";
import type { Personality, Species } from "../core/types.js";

export interface OnboardingResult {
  species: Species;
  name: string;
  coat: string;
  accent: string;
  eye: string;
  personality: Partial<Personality>;
}

const SPECIES_OPTIONS: Array<{ species: Species; emoji: string; label: string; coat: string; accent: string; eye: string }> = [
  { species: "cat", emoji: "🐈", label: "Cat", coat: "#d77b36", accent: "#f2bf7d", eye: "#d9ef73" },
  { species: "dog", emoji: "🐕", label: "Dog", coat: "#a0713f", accent: "#e8d5b0", eye: "#5a4a3a" },
  { species: "rabbit", emoji: "🐇", label: "Rabbit", coat: "#e8e0d8", accent: "#f5f0ea", eye: "#c46a6a" },
  { species: "bird", emoji: "🐦", label: "Bird", coat: "#5b9bd5", accent: "#a8d0e8", eye: "#2a3a4a" }
];

const TEMPERAMENTS: Array<{ id:string; emoji:string; name:string; blurb:string; traits:Partial<Personality> }> = [
  { id:"lapcat", emoji:"😴", name:"Sleepy snuggler", blurb:"Loves naps and quiet company", traits:{ energy:.3, playfulness:.35, affection:.9, independence:.25, patience:.8 } },
  { id:"explorer", emoji:"🔍", name:"Curious explorer", blurb:"Must inspect every new window", traits:{ curiosity:.95, boldness:.7, energy:.65, independence:.6 } },
  { id:"gremlin", emoji:"🌪️", name:"Playful gremlin", blurb:"Zoomies are a lifestyle", traits:{ energy:.92, playfulness:.95, sociability:.7, patience:.25 } },
  { id:"chill", emoji:"🌿", name:"Chill companion", blurb:"Happy just hanging out nearby", traits:{ energy:.45, curiosity:.55, affection:.7, patience:.75, boldness:.5 } }
];

export function showOnboarding(container: HTMLElement): Promise<OnboardingResult> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "onboarding-overlay";
    overlay.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-eyebrow">WELCOME TO PETOS</div>
        <div class="onboarding-step" data-step="species">
          <h2>Who is moving in?</h2>
          <div class="onboarding-species">
            ${SPECIES_OPTIONS.map((s, i) => `
              <button data-species="${s.species}" data-index="${i}" class="${i === 0 ? "selected" : ""}">
                <span class="onboarding-emoji">${s.emoji}</span>
                <span>${s.label}</span>
              </button>
            `).join("")}
          </div>
          <label class="onboarding-label">Give them a name</label>
          <input id="onboarding-name" placeholder="Pet name" maxlength="24" autocomplete="off">
          <button id="onboarding-next" class="onboarding-start">Next →</button>
        </div>
        <div class="onboarding-step" data-step="temperament" style="display:none">
          <h2>And who are they, really?</h2>
          <div class="onboarding-temperaments">
            ${TEMPERAMENTS.map((t, i) => `
              <button data-temperament="${t.id}" class="${i === 0 ? "selected" : ""}">
                <span class="onboarding-emoji">${t.emoji}</span>
                <strong>${t.name}</strong>
                <small>${t.blurb}</small>
              </button>
            `).join("")}
          </div>
          <p class="onboarding-hint">Personalities grow and drift as they live on your desktop — this is just day one.</p>
          <button id="onboarding-start" class="onboarding-start">Let them in →</button>
        </div>
      </div>
    `;
    container.append(overlay);

    let selectedIndex = 0;
    let temperamentId = TEMPERAMENTS[0]!.id;
    const speciesButtons = overlay.querySelectorAll<HTMLButtonElement>("[data-species]");
    speciesButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        selectedIndex = Number(btn.dataset.index);
        speciesButtons.forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });
    const temperamentButtons = overlay.querySelectorAll<HTMLButtonElement>("[data-temperament]");
    temperamentButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        temperamentId = btn.dataset.temperament!;
        temperamentButtons.forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });

    const nameInput = overlay.querySelector<HTMLInputElement>("#onboarding-name")!;
    const finish = () => {
      const option = SPECIES_OPTIONS[selectedIndex]!;
      const name = nameInput.value.trim() || option.label;
      const traits = TEMPERAMENTS.find(t => t.id === temperamentId)?.traits ?? {};
      overlay.remove();
      resolve({ species: option.species, name, coat: option.coat, accent: option.accent, eye: option.eye, personality: traits });
    };

    overlay.querySelector("#onboarding-next")!.addEventListener("click", () => {
      overlay.querySelector('[data-step="species"]')!.setAttribute("style","display:none");
      overlay.querySelector('[data-step="temperament"]')!.removeAttribute("style");
    });
    nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") (overlay.querySelector("#onboarding-next") as HTMLElement).click(); });
    overlay.querySelector("#onboarding-start")!.addEventListener("click", finish);

    nameInput.focus();
    void SPECIES;
  });
}
