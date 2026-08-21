import type { PixelRenderer } from "./renderer.js";
import type { PetOSSimulation } from "../core/simulation.js";

export class PhotographyMode {
  private flashOverlay: HTMLElement | null = null;

  constructor(private readonly renderer: PixelRenderer) {}

  capture(): string {
    // Flash effect
    this.showFlash();
    // Return data URL from the canvas
    return this.renderer.canvas.toDataURL("image/png");
  }

  download(filename?: string): void {
    const dataUrl = this.capture();
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename ?? `petos-photo-${Date.now()}.png`;
    a.click();
  }

  private showFlash(): void {
    if (this.flashOverlay) this.flashOverlay.remove();
    this.flashOverlay = document.createElement("div");
    this.flashOverlay.style.cssText = "position:fixed;inset:0;background:#fff;z-index:10001;opacity:.8;pointer-events:none;transition:opacity .3s";
    document.body.append(this.flashOverlay);
    requestAnimationFrame(() => { this.flashOverlay!.style.opacity = "0"; });
    setTimeout(() => { this.flashOverlay?.remove(); this.flashOverlay = null; }, 400);
  }
}
