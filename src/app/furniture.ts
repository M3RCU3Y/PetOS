import type { WorldObject } from "../core/types.js";

export interface FurnitureTemplate {
  kind: string;
  label: string;
  emoji: string;
  radius: number;
  comfort?: number;
  contents?: "food" | "water";
  description: string;
}

export const FURNITURE_TEMPLATES: FurnitureTemplate[] = [
  { kind: "bed", label: "Bed", emoji: "🛏", radius: 38, comfort: .95, description: "Comfort +0.95 · warmth · rest" },
  { kind: "ball", label: "Ball", emoji: "●", radius: 11, description: "Chase · push · play" },
  { kind: "box", label: "Box", emoji: "▣", radius: 34, description: "Hide · security +0.6" },
  { kind: "food", label: "Food", emoji: "◒", radius: 18, contents: "food", description: "Reduces hunger" },
  { kind: "water", label: "Water", emoji: "◔", radius: 18, contents: "water", description: "Reduces thirst" },
  { kind: "scratcher", label: "Scratcher", emoji: "╫", radius: 25, description: "Cat territory maintenance" },
];

export class FurnitureEditor {
  private ghost: HTMLElement | null = null;
  private selectedTemplate: FurnitureTemplate | null = null;
  private onPlace: ((template: FurnitureTemplate, x: number, y: number) => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.selectedTemplate || e.button !== 0) return;
      if (this.onPlace && this.selectedTemplate) {
        this.onPlace(this.selectedTemplate, e.clientX, e.clientY);
        this.clearGhost();
      }
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.selectedTemplate) return;
      this.updateGhost(e.clientX, e.clientY);
    });
    canvas.addEventListener("pointerup", () => this.clearGhost());
  }

  select(template: FurnitureTemplate): void {
    this.selectedTemplate = template;
    this.createGhost();
  }

  deselect(): void {
    this.selectedTemplate = null;
    this.clearGhost();
  }

  get active(): boolean { return this.selectedTemplate !== null; }

  setPlaceHandler(fn: (template: FurnitureTemplate, x: number, y: number) => void): void {
    this.onPlace = fn;
  }

  private createGhost(): void {
    this.clearGhost();
    if (!this.selectedTemplate) return;
    this.ghost = document.createElement("div");
    this.ghost.className = "furniture-ghost";
    this.ghost.textContent = this.selectedTemplate.emoji;
    this.ghost.style.width = `${this.selectedTemplate.radius * 2}px`;
    this.ghost.style.height = `${this.selectedTemplate.radius * 2}px`;
    this.ghost.style.lineHeight = `${this.selectedTemplate.radius * 2}px`;
    document.body.append(this.ghost);
  }

  private updateGhost(x: number, y: number): void {
    if (!this.ghost) return;
    this.ghost.style.left = `${x - this.selectedTemplate!.radius}px`;
    this.ghost.style.top = `${y - this.selectedTemplate!.radius}px`;
  }

  private clearGhost(): void {
    if (this.ghost) { this.ghost.remove(); this.ghost = null; }
  }
}
