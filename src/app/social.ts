import type { PetState } from "../core/types.js";

export interface SocialEdge {
  from: string;
  to: string;
  value: number;
}

export function computeSocialEdges(pets: PetState[], relationships: Map<string, Map<string, number>>): SocialEdge[] {
  const edges: SocialEdge[] = [];
  for (let i = 0; i < pets.length; i++) {
    for (let j = i + 1; j < pets.length; j++) {
      const a = pets[i]!;
      const b = pets[j]!;
      const rel = relationships.get(a.id)?.get(b.id) ?? 0;
      edges.push({ from: a.id, to: b.id, value: rel });
    }
  }
  return edges;
}

export function renderSocialGraph(
  container: HTMLElement,
  pets: Array<{ id: string; name: string; species: string }>,
  edges: SocialEdge[]
): void {
  if (pets.length < 2) {
    container.innerHTML = "<p>Add another pet to see their social bonds.</p>";
    return;
  }
  const size = Math.min(280, container.clientWidth || 280);
  const cx = size / 2, cy = size / 2, r = size * .38;
  const positions = new Map<string, { x: number; y: number }>();
  pets.forEach((p, i) => {
    const angle = (i / pets.length) * Math.PI * 2 - Math.PI / 2;
    positions.set(p.id, { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  });
  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  for (const edge of edges) {
    const a = positions.get(edge.from), b = positions.get(edge.to);
    if (!a || !b) continue;
    const color = edge.value >= 0 ? "#5f9fc8" : "#d85b58";
    const width = Math.max(1, Math.abs(edge.value) * 4);
    const opacity = Math.min(1, Math.abs(edge.value));
    svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="${width}" opacity="${opacity}"/>`;
  }
  for (const p of pets) {
    const pos = positions.get(p.id)!;
    const emoji = p.species === "cat" ? "🐈" : p.species === "dog" ? "🐕" : p.species === "rabbit" ? "🐇" : "🐦";
    svg += `<circle cx="${pos.x}" cy="${pos.y}" r="18" fill="rgba(15,17,24,.9)" stroke="rgba(255,255,255,.12)"/>`;
    svg += `<text x="${pos.x}" y="${pos.y + 6}" text-anchor="middle" font-size="16">${emoji}</text>`;
    svg += `<text x="${pos.x}" y="${pos.y + 32}" text-anchor="middle" font-size="10" fill="#aab2ca">${escapeXml(p.name)}</text>`;
  }
  svg += "</svg>";
  container.innerHTML = svg;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}
