export type SoundEvent =
  | "meow" | "bark" | "chirp" | "squeak" | "purr"
  | "sleep_noise" | "footstep" | "landing" | "scratch"
  | "eat" | "drink" | "toy" | "social" | "startle";

interface SoundProfile {
  freq: number;
  type: OscillatorType;
  duration: number;
  volume: number;
  sweep?: { to: number; duration: number };
}

const PROFILES: Record<SoundEvent, SoundProfile> = {
  meow: { freq: 520, type: "sine", duration: .28, volume: .12, sweep: { to: 380, duration: .22 } },
  bark: { freq: 280, type: "square", duration: .12, volume: .1, sweep: { to: 180, duration: .08 } },
  chirp: { freq: 1800, type: "sine", duration: .08, volume: .07, sweep: { to: 2400, duration: .06 } },
  squeak: { freq: 900, type: "triangle", duration: .1, volume: .06, sweep: { to: 1200, duration: .08 } },
  purr: { freq: 28, type: "sine", duration: .8, volume: .05 },
  sleep_noise: { freq: 22, type: "sine", duration: 1.2, volume: .025 },
  footstep: { freq: 120, type: "triangle", duration: .03, volume: .02 },
  landing: { freq: 90, type: "triangle", duration: .06, volume: .04 },
  scratch: { freq: 400, type: "sawtooth", duration: .15, volume: .03, sweep: { to: 300, duration: .12 } },
  eat: { freq: 200, type: "triangle", duration: .08, volume: .03 },
  drink: { freq: 350, type: "sine", duration: .06, volume: .025 },
  toy: { freq: 700, type: "square", duration: .06, volume: .03 },
  social: { freq: 600, type: "sine", duration: .12, volume: .04 },
  startle: { freq: 800, type: "square", duration: .05, volume: .06, sweep: { to: 400, duration: .04 } }
};

const SPECIES_SOUNDS: Record<string, SoundEvent[]> = {
  cat: ["meow", "purr"],
  dog: ["bark", "purr"],
  rabbit: ["squeak"],
  bird: ["chirp"]
};

const COOLDOWNS_MS: Record<SoundEvent, number> = {
  meow: 12_000, bark: 10_000, chirp: 8_000, squeak: 10_000, purr: 30_000,
  sleep_noise: 45_000, footstep: 800, landing: 2_000, scratch: 6_000,
  eat: 4_000, drink: 4_000, toy: 5_000, social: 15_000, startle: 5_000
};

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private lastPlayed = new Map<string, number>();
  private masterGain: GainNode | null = null;
  private enabled = true;
  private quietHours = false;
  private volume = .7;

  setEnabled(enabled: boolean): void { this.enabled = enabled; }
  setQuietHours(quiet: boolean): void { this.quietHours = quiet; }
  setVolume(volume: number): void { this.volume = Math.max(0, Math.min(1, volume)); if (this.masterGain) this.masterGain.gain.value = this.volume * .5; }

  play(petId: string, species: string, event: SoundEvent): void {
    if (!this.enabled || this.quietHours) return;
    const key = `${petId}:${event}`;
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? 0) < (COOLDOWNS_MS[event] ?? 5_000)) return;
    this.lastPlayed.set(key, now);

    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume * .5;
      this.masterGain.connect(this.ctx.destination);
    }
    // Autoplay policy: the context starts suspended until the page has had a
    // user gesture. Resume on demand so early sounds are not lost forever.
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});

    const profile = PROFILES[event];
    if (!profile) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = profile.type;
    osc.frequency.setValueAtTime(profile.freq, ctx.currentTime);
    if (profile.sweep) {
      osc.frequency.exponentialRampToValueAtTime(profile.sweep.to, ctx.currentTime + profile.sweep.duration);
    }
    gain.gain.setValueAtTime(profile.volume * this.volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + profile.duration);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + profile.duration);
  }

  playSpeciesVocal(petId: string, species: string): void {
    const sounds = SPECIES_SOUNDS[species];
    if (!sounds?.length) return;
    const pick = sounds[Math.floor(Math.random() * sounds.length)]!;
    this.play(petId, species, pick);
  }

  playBehaviorSound(petId: string, species: string, behavior: string): void {
    const map: Record<string, SoundEvent> = {
      sleep: "sleep_noise", groom: "purr", eat: "eat", drink: "drink",
      scratch: "scratch", play_toy: "toy", greet_pet: "social", play_pet: "social",
      pounce: "startle", chase_cursor: "footstep", run: "footstep", walk: "footstep"
    };
    const event = map[behavior];
    if (event) this.play(petId, species, event);
  }
}
