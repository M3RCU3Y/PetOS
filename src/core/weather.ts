export type WeatherKind = "clear" | "cloudy" | "rainy" | "snowy" | "stormy";

export interface SeasonalEvent {
  id: string;
  name: string;
  month: number;
  day: number;
  emoji: string;
  moodBonus: number;
  energyBonus: number;
  note: string;
}

const EVENTS: SeasonalEvent[] = [
  { id: "new-year", name: "New Year", month: 1, day: 1, emoji: "🎊", moodBonus: .1, energyBonus: .05, note: "Celebrating the new year!" },
  { id: "valentines", name: "Valentine's Day", month: 2, day: 14, emoji: "💕", moodBonus: .12, energyBonus: .03, note: "Feeling extra affectionate today" },
  { id: "halloween", name: "Halloween", month: 10, day: 31, emoji: "🎃", moodBonus: .05, energyBonus: .15, note: "Spooky energy in the air" },
  { id: "christmas", name: "Christmas", month: 12, day: 25, emoji: "🎄", moodBonus: .15, energyBonus: .08, note: "Holiday cheer!" },
  { id: "new-years-eve", name: "New Year's Eve", month: 12, day: 31, emoji: "🥳", moodBonus: .1, energyBonus: .1, note: "Almost a new year!" },
];

// Deterministic weather based on date + location seed
function hashDate(date: Date): number {
  const key = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  let h = key * 2654435761;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  return ((h >>> 16) ^ h) >>> 0;
}

export function weatherFor(date: Date): WeatherKind {
  const month = date.getMonth() + 1;
  const h = hashDate(date);
  // Winter more likely snowy/cloudy, summer more clear
  if (month >= 12 || month <= 2) {
    if (h % 100 < 25) return "snowy";
    if (h % 100 < 55) return "cloudy";
    if (h % 100 < 70) return "rainy";
    if (h % 100 < 80) return "stormy";
    return "clear";
  }
  if (month >= 6 && month <= 8) {
    if (h % 100 < 60) return "clear";
    if (h % 100 < 80) return "cloudy";
    if (h % 100 < 90) return "rainy";
    if (h % 100 < 95) return "stormy";
    return "clear";
  }
  if (h % 100 < 40) return "clear";
  if (h % 100 < 65) return "cloudy";
  if (h % 100 < 85) return "rainy";
  if (h % 100 < 92) return "stormy";
  return "clear";
}

export function eventFor(date: Date): SeasonalEvent | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return EVENTS.find(e => e.month === month && e.day === day) ?? null;
}

export interface WeatherEffect {
  moodShift: number;
  energyShift: number;
  curiosityShift: number;
  label: string;
  emoji: string;
}

export function weatherEffect(weather: WeatherKind): WeatherEffect {
  switch (weather) {
    case "clear": return { moodShift: .06, energyShift: .04, curiosityShift: .05, label: "Sunny and bright", emoji: "☀️" };
    case "cloudy": return { moodShift: .01, energyShift: -.02, curiosityShift: 0, label: "Overcast skies", emoji: "☁️" };
    case "rainy": return { moodShift: -.04, energyShift: -.08, curiosityShift: -.03, label: "Rainy day coziness", emoji: "🌧️" };
    case "snowy": return { moodShift: .08, energyShift: .1, curiosityShift: .12, label: "Snow! How exciting!", emoji: "❄️" };
    case "stormy": return { moodShift: -.08, energyShift: -.05, curiosityShift: -.05, label: "Thunder is scary…", emoji: "⛈️" };
  }
}
