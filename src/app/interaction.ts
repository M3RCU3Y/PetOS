import type { PetState, Vec2 } from "../core/types.js";

export type InteractionKind = "pet" | "feed" | "call" | "laser" | "wake" | "brush";

export interface InteractionTarget {
  petId: string;
  kind: InteractionKind;
  position: Vec2;
}

export class InteractionManager {
  private menu: HTMLElement | null = null;
  private laserActive = false;
  private laserPosition: Vec2 = { x: 0, y: 0 };
  private laserElement: HTMLElement | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onInteract: (target: InteractionTarget) => void
  ) {
    canvas.addEventListener("contextmenu", (e) => this.showMenu(e));
    document.addEventListener("pointerdown", (e) => {
      if (this.menu && !this.menu.contains(e.target as Node)) this.hideMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.code === "Escape") this.hideMenu();
    });
  }

  private showMenu(e: MouseEvent): void {
    e.preventDefault();
    this.hideMenu();
    const pet = this.findPetAt(e.clientX, e.clientY);
    if (!pet) return;
    this.menu = document.createElement("div");
    this.menu.className = "interaction-menu";
    this.menu.innerHTML = `
      <button data-action="pet">Pet</button>
      <button data-action="feed">Feed</button>
      <button data-action="brush">Brush</button>
      <button data-action="wake">Wake</button>
      <button data-action="call">Call</button>
    `;
    this.menu.style.left = `${e.clientX}px`;
    this.menu.style.top = `${e.clientY}px`;
    document.body.append(this.menu);
    this.menu.querySelectorAll<HTMLButtonElement>("button").forEach(btn => {
      btn.addEventListener("click", () => {
        this.onInteract({ petId: pet.id, kind: btn.dataset.action as InteractionKind, position: { x: e.clientX, y: e.clientY } });
        this.hideMenu();
      });
    });
  }

  private hideMenu(): void {
    if (this.menu) { this.menu.remove(); this.menu = null; }
  }

  private findPetAt(x: number, y: number): PetState | null {
    // This will be wired by main.ts to check actual pet positions
    return null;
  }

  setPetFinder(fn: (x: number, y: number) => PetState | null): void {
    this.findPetAt = fn;
  }

  toggleLaser(): void {
    this.laserActive = !this.laserActive;
    if (this.laserActive) {
      this.laserElement = document.createElement("div");
      this.laserElement.id = "laser-pointer";
      document.body.append(this.laserElement);
      document.addEventListener("pointermove", this.onLaserMove);
    } else {
      this.laserElement?.remove();
      this.laserElement = null;
      document.removeEventListener("pointermove", this.onLaserMove);
    }
  }

  private onLaserMove = (e: PointerEvent): void => {
    if (!this.laserElement) return;
    this.laserPosition = { x: e.clientX, y: e.clientY };
    this.laserElement.style.left = `${e.clientX - 6}px`;
    this.laserElement.style.top = `${e.clientY - 6}px`;
  };

  getLaser(): { active: boolean; position: Vec2 } {
    return { active: this.laserActive, position: { ...this.laserPosition } };
  }
}
