import type { WorldObservation } from "./types.js";

export function calmDesktop(nowMs: number): WorldObservation {
  return {
    nowMs,
    cursorSpeed: 35,
    cursorDistance: 500,
    userIdleSeconds: 15,
    userActivity: "light",
    secondsSinceNewWindow: null,
    currentSurface: {
      id: "taskbar:primary",
      kind: "taskbar",
      quality: 0.74,
      elevation: 0.08,
      moving: false
    },
    nearbyPetCount: 0,
    recentPettingSecondsAgo: null
  };
}
