import type { PetState } from "../core/types.js";

interface Thought {
  petId: string;
  text: string;
  atMs: number;
  element: HTMLElement;
}

const THOUGHT_DURATION_MS = 6_000;
const THOUGHT_COOLDOWN_MS = 30_000;

export class ThoughtBubbles {
  private thoughts = new Map<string, Thought>();
  private lastShown = new Map<string, number>();

  show(pet: PetState, text: string, screenX: number, screenY: number): void {
    const now = performance.now();
    if (now - (this.lastShown.get(pet.id) ?? 0) < THOUGHT_COOLDOWN_MS) return;
    this.lastShown.set(pet.id, now);
    this.dismiss(pet.id);

    const el = document.createElement("div");
    el.className = "thought-bubble";
    el.textContent = text;
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY - 60}px`;
    document.body.append(el);
    this.thoughts.set(pet.id, { petId: pet.id, text, atMs: now, element: el });
    setTimeout(() => this.dismiss(pet.id), THOUGHT_DURATION_MS);
  }

  dismiss(petId: string): void {
    const t = this.thoughts.get(petId);
    if (t) { t.element.remove(); this.thoughts.delete(petId); }
  }

  update(pets: PetState[], offsetX: number, offsetY: number): void {
    for (const [id, thought] of this.thoughts) {
      const pet = pets.find(p => p.id === id);
      if (!pet) { this.dismiss(id); continue; }
      thought.element.style.left = `${pet.body.position.x + offsetX}px`;
      thought.element.style.top = `${pet.body.position.y + offsetY - 60}px`;
    }
  }
}

export function generateThought(pet: PetState): string | null {
  const d = pet.drives;
  const a = pet.affect;
  if (d.hunger > .8) return "I'm getting hungry…";
  if (d.thirst > .8) return "Could use some water.";
  if (d.fatigue > .75) return "So sleepy…";
  if (d.play > .85 && d.fatigue < .4) return "I want to play!";
  if (d.social > .8 && pet.bond > .3) return "I miss you.";
  if (a.stress > .5) return "Something feels off…";
  if (d.curiosity > .8) return "What's over there?";
  if (pet.boredom > .7) return "This is boring.";
  if (pet.frustration > .5) return "Hmph.";
  return null;
}
