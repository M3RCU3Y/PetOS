import type { Species } from "../core/types.js";

export interface OnboardingResult {
  species: Species;
  name: string;
  coat: string;
  accent: string;
  eye: string;
}

const SPECIES_OPTIONS: Array<{ species: Species; emoji: string; label: string; coat: string; accent: string; eye: string }> = [
  { species: "cat", emoji: "🐈", label: "Cat", coat: "#d77b36", accent: "#f2bf7d", eye: "#d9ef73" },
  { species: "dog", emoji: "🐕", label: "Dog", coat: "#a0713f", accent: "#e8d5b0", eye: "#5a4a3a" },
  { species: "rabbit", emoji: "🐇", label: "Rabbit", coat: "#e8e0d8", accent: "#f5f0ea", eye: "#c46a6a" },
  { species: "bird", emoji: "🐦", label: "Bird", coat: "#5b9bd5", accent: "#a8d0e8", eye: "#2a3a4a" }
];

export function showOnboarding(container: HTMLElement): Promise<OnboardingResult> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "onboarding-overlay";
    overlay.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-eyebrow">WELCOME TO PETOS</div>
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
        <button id="onboarding-start" class="onboarding-start">Let them in →</button>
      </div>
    `;
    container.append(overlay);

    let selectedIndex = 0;
    const speciesButtons = overlay.querySelectorAll<HTMLButtonElement>("[data-species]");
    speciesButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        selectedIndex = Number(btn.dataset.index);
        speciesButtons.forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
    });

    const nameInput = overlay.querySelector<HTMLInputElement>("#onboarding-name")!;
    const startBtn = overlay.querySelector<HTMLButtonElement>("#onboarding-start")!;
    nameInput.focus();

    const finish = () => {
      const option = SPECIES_OPTIONS[selectedIndex]!;
      const name = nameInput.value.trim() || option.label;
      overlay.remove();
      resolve({ species: option.species, name, coat: option.coat, accent: option.accent, eye: option.eye });
    };

    startBtn.addEventListener("click", finish);
    nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") finish(); });
  });
}
