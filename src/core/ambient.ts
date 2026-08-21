import type { UserActivity } from "./types.js";

export interface AmbientContext {
  activity: UserActivity;
  charging: boolean;
  batteryLevel: number | null;
  idleSeconds: number;
  foregroundApp: string | null;
  hourOfDay: number;
}

export interface AmbientReaction {
  moodShift: number;
  energyShift: number;
  note: string;
}

const APP_CATEGORIES = new Map<string, string>([
  ["code", "coding"], ["devenv", "coding"], ["sublime_text", "coding"], ["notepad++", "coding"],
  ["chrome", "browsing"], ["firefox", "browsing"], ["msedge", "browsing"], ["safari", "browsing"],
  ["spotify", "music"], ["vlc", "media"], ["mpv", "media"], ["netflix", "media"],
  ["steam", "gaming"], ["epicgameslauncher", "gaming"], ["discord", "social"],
  ["slack", "work"], ["teams", "work"], ["outlook", "work"]
]);

export function categorizeApp(appName: string | null): string {
  if (!appName) return "unknown";
  const lower = appName.toLowerCase().replace(".exe", "");
  return APP_CATEGORIES.get(lower) ?? "other";
}

export function ambientReaction(ctx: AmbientContext): AmbientReaction {
  const category = categorizeApp(ctx.foregroundApp);
  if (ctx.activity === "fullscreen" || ctx.activity === "gaming") {
    return { moodShift: -.05, energyShift: -.1, note: "Keeper is focused, pet should be calm" };
  }
  if (ctx.idleSeconds > 300) {
    return { moodShift: .02, energyShift: .05, note: "User is away, pet can relax" };
  }
  if (category === "coding") {
    return { moodShift: .03, energyShift: -.03, note: "Quiet coding session, pet settles nearby" };
  }
  if (category === "music" || category === "media") {
    return { moodShift: .05, energyShift: -.08, note: "Chill media playing, pet gets drowsy" };
  }
  if (category === "gaming") {
    return { moodShift: -.02, energyShift: .12, note: "Gaming detected, pet is alert" };
  }
  if (ctx.batteryLevel !== null && ctx.batteryLevel < .2 && !ctx.charging) {
    return { moodShift: -.03, energyShift: -.06, note: "Low battery, pet conserves energy" };
  }
  const lateNight = ctx.hourOfDay >= 0 && ctx.hourOfDay < 6;
  if (lateNight) {
    return { moodShift: .01, energyShift: -.1, note: "Late night, pet feels sleepy" };
  }
  return { moodShift: 0, energyShift: 0, note: "Normal ambient conditions" };
}
