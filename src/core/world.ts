import { distance } from "./math.js";
import type { DesktopWindow, MonitorInfo, PetState, Surface, Vec2, WorldObject, WorldSnapshot } from "./types.js";

export function surfacesFromDesktop(monitors: MonitorInfo[], windows: DesktopWindow[], objects: WorldObject[] = []): Surface[] {
  const surfaces: Surface[] = [];
  for (const monitor of monitors) {
    const bottomInset = Math.max(0, monitor.rect.y + monitor.rect.height - (monitor.workArea.y + monitor.workArea.height));
    const topInset = Math.max(0, monitor.workArea.y - monitor.rect.y);
    if (bottomInset > 0) {
      // Taskbar docked to the bottom edge of this monitor.
      surfaces.push({
        id: `taskbar:${monitor.id}`,
        kind: "taskbar",
        rect: { x: monitor.workArea.x, y: monitor.workArea.y + monitor.workArea.height, width: monitor.workArea.width, height: bottomInset },
        walkY: monitor.workArea.y + monitor.workArea.height,
        comfort: .45
      });
    } else if (topInset > 0) {
      // Taskbar docked to the top edge; its lower border is the walkable line.
      const walkY = monitor.rect.y + topInset;
      surfaces.push({
        id: `taskbar:${monitor.id}`,
        kind: "taskbar",
        rect: { x: monitor.workArea.x, y: monitor.rect.y, width: monitor.workArea.width, height: topInset },
        walkY,
        comfort: .45
      });
    } else {
      // Hidden taskbar (or side-docked, where horizontal walking does not apply): raw floor.
      surfaces.push({
        id: `floor:${monitor.id}`,
        kind: "monitor_floor",
        rect: { x: monitor.rect.x, y: monitor.rect.y + monitor.rect.height - 2, width: monitor.rect.width, height: 2 },
        walkY: monitor.rect.y + monitor.rect.height - 2,
        comfort: .3
      });
    }
  }
  for (const win of windows) {
    if (!win.visible || win.minimized || win.rect.width < 120 || win.rect.height < 80) continue;
    surfaces.push({ id: `window:${win.id}`, kind: "window", rect: win.rect, walkY: win.rect.y, title: win.title, app: win.app, comfort: .22 });
  }
  for (const obj of objects) {
    if (obj.kind === "bed" || obj.kind === "box" || obj.kind === "tunnel") {
      surfaces.push({ id: `object:${obj.id}`, kind: "furniture", rect: { x: obj.position.x - obj.radius, y: obj.position.y - obj.radius, width: obj.radius * 2, height: obj.radius * 2 }, walkY: obj.position.y - obj.radius, comfort: obj.comfort ?? .8 });
    } else if (obj.kind === "perch") {
      const barY = obj.position.y - obj.radius * 1.7;
      surfaces.push({ id: `object:${obj.id}`, kind: "furniture", rect: { x: obj.position.x - obj.radius * .7, y: barY, width: obj.radius * 1.4, height: 5 }, walkY: barY, comfort: obj.comfort ?? .55 });
    }
  }
  return surfaces.sort((a,b) => a.walkY - b.walkY);
}

export function nearestSurface(position: Vec2, surfaces: Surface[], maxDistance = 80): Surface | null {
  let best: { s: Surface; d: number } | null = null;
  for (const s of surfaces) {
    const x = Math.max(s.rect.x, Math.min(s.rect.x + s.rect.width, position.x));
    const d = Math.hypot(position.x - x, position.y - s.walkY);
    if (d <= maxDistance && (!best || d < best.d)) best = { s, d };
  }
  return best?.s ?? null;
}

export function buildWorldForPet(base: Omit<WorldSnapshot, "nearbyPets" | "currentSurface" | "cursor"> & { cursorPosition: Vec2; cursorSpeed: number; cursorButtons?: number }, pet: PetState, others: PetState[]): WorldSnapshot {
  const currentSurface = pet.body.surfaceId ? base.surfaces.find(s => s.id === pet.body.surfaceId) ?? null : nearestSurface(pet.body.position, base.surfaces);
  return {
    ...base,
    currentSurface,
    nearbyPets: others.filter(p => p.id !== pet.id).map(other => ({
      id: other.id,
      species: other.species,
      position: { ...other.body.position },
      behavior: other.behavior,
      distance: distance(other.body.position, pet.body.position),
      relationship: 0
    })),
    cursor: {
      position: base.cursorPosition,
      speed: base.cursorSpeed,
      distanceToPet: distance(base.cursorPosition, pet.body.position),
      buttons: base.cursorButtons ?? 0
    }
  };
}

export function calmDesktop(nowMs = 0): WorldSnapshot {
  const monitor: MonitorInfo = { id:"primary", rect:{x:0,y:0,width:1920,height:1080}, workArea:{x:0,y:0,width:1920,height:1040}, primary:true, scaleFactor:1 };
  const surfaces = surfacesFromDesktop([monitor], []);
  return {
    nowMs, dtMs:16, userActivity:"active",
    cursor:{position:{x:960,y:520},speed:0,distanceToPet:500,buttons:0},
    surfaces, objects:[], nearbyPets:[], windows:[], monitors:[monitor], foregroundApp:null,
    secondsSinceNewWindow:999, currentSurface:surfaces[0] ?? null, interactionMode:false,
    idleSeconds:0, locked:false, batteryLevel:null, charging:true
  };
}
