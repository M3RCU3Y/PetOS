import type { PixelRenderer } from "./renderer.js";

const GALLERY_KEY = "petos:gallery:v1";
const GALLERY_MAX = 6;

export class PhotographyMode {
  private flashOverlay: HTMLElement | null = null;

  constructor(private readonly renderer: PixelRenderer) {}

  capture(): string {
    this.showFlash();
    return this.renderer.canvas.toDataURL("image/png");
  }

  /** Full-resolution PNG the user can keep. */
  download(filename?: string): void {
    const dataUrl = this.capture();
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename ?? `petos-photo-${Date.now()}.png`;
    a.click();
  }

  /** Saves a compact JPEG thumbnail into the persistent gallery ring buffer. */
  saveToGallery(): string | null {
    try {
      const src = this.renderer.canvas;
      const thumb = document.createElement("canvas");
      thumb.width = Math.max(1, Math.round(src.width * .3));
      thumb.height = Math.max(1, Math.round(src.height * .3));
      const ctx = thumb.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(src, 0, 0, thumb.width, thumb.height);
      const small = thumb.toDataURL("image/jpeg", .8);
      const list = [small, ...PhotographyMode.loadGallery()].slice(0, GALLERY_MAX);
      try {
        localStorage.setItem(GALLERY_KEY, JSON.stringify(list));
      } catch {
        list.pop();
        try { localStorage.setItem(GALLERY_KEY, JSON.stringify(list)); } catch { /* give up quietly */ }
      }
      return small;
    } catch {
      return null;
    }
  }

  static loadGallery(): string[] {
    try {
      const raw = localStorage.getItem(GALLERY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
    } catch {
      return [];
    }
  }

  static removeFromGallery(index: number): void {
    const list = PhotographyMode.loadGallery();
    list.splice(index, 1);
    try { localStorage.setItem(GALLERY_KEY, JSON.stringify(list)); } catch { /* ignore */ }
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
