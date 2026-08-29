export type SoundEvent =
  | "meow" | "bark" | "chirp" | "squeak" | "purr"
  | "sleep_noise" | "footstep" | "landing" | "scratch"
  | "eat" | "drink" | "toy" | "social" | "startle";

interface SoundProfile {
  freq:number;
  type:OscillatorType;
  duration:number;
  volume:number;
  sweep?:{to:number;duration:number};
}

const PROFILES:Record<SoundEvent,SoundProfile>={
  meow:{freq:510,type:"sine",duration:.3,volume:.095,sweep:{to:390,duration:.24}},
  bark:{freq:250,type:"triangle",duration:.13,volume:.085,sweep:{to:175,duration:.09}},
  chirp:{freq:1760,type:"sine",duration:.09,volume:.06,sweep:{to:2320,duration:.07}},
  squeak:{freq:860,type:"triangle",duration:.11,volume:.052,sweep:{to:1120,duration:.085}},
  purr:{freq:52,type:"triangle",duration:1.15,volume:.03},
  sleep_noise:{freq:48,type:"sine",duration:1.25,volume:.014},
  footstep:{freq:118,type:"triangle",duration:.028,volume:.014},
  landing:{freq:86,type:"triangle",duration:.075,volume:.032},
  scratch:{freq:380,type:"sawtooth",duration:.13,volume:.018,sweep:{to:290,duration:.11}},
  eat:{freq:190,type:"triangle",duration:.075,volume:.02},
  drink:{freq:330,type:"sine",duration:.055,volume:.018},
  toy:{freq:680,type:"triangle",duration:.065,volume:.024},
  social:{freq:590,type:"sine",duration:.13,volume:.03},
  startle:{freq:760,type:"triangle",duration:.055,volume:.045,sweep:{to:410,duration:.045}}
};

const SPECIES_SOUNDS:Record<string,SoundEvent[]>={
  cat:["meow","purr"],
  dog:["bark"],
  rabbit:["squeak"],
  bird:["chirp"]
};

const COOLDOWNS_MS:Record<SoundEvent,number>={
  meow:12_000,bark:10_000,chirp:8_000,squeak:10_000,purr:18_000,
  sleep_noise:45_000,footstep:800,landing:2_000,scratch:6_000,
  eat:4_000,drink:4_000,toy:5_000,social:15_000,startle:5_000
};

export class SoundEngine{
  private ctx:AudioContext|null=null;
  private lastPlayed=new Map<string,number>();
  private masterGain:GainNode|null=null;
  private enabled=true;
  private quietHours=false;
  private volume=.7;

  setEnabled(enabled:boolean):void{this.enabled=enabled;}
  setQuietHours(quiet:boolean):void{this.quietHours=quiet;}
  setVolume(volume:number):void{this.volume=Math.max(0,Math.min(1,volume));if(this.masterGain)this.masterGain.gain.value=this.volume*.5;}

  private ensureContext():AudioContext{
    if(!this.ctx){
      this.ctx=new AudioContext();
      this.masterGain=this.ctx.createGain();
      this.masterGain.gain.value=this.volume*.5;
      this.masterGain.connect(this.ctx.destination);
    }
    if(this.ctx.state==="suspended")void this.ctx.resume().catch(()=>{});
    return this.ctx;
  }

  private playPurr(ctx:AudioContext):void{
    const start=ctx.currentTime,duration=1.15;
    const bus=ctx.createGain();
    bus.gain.setValueAtTime(.001,start);
    bus.gain.linearRampToValueAtTime(.032*this.volume,start+.08);
    bus.gain.setValueAtTime(.032*this.volume,start+duration-.16);
    bus.gain.exponentialRampToValueAtTime(.001,start+duration);
    bus.connect(this.masterGain!);

    const fundamental=ctx.createOscillator(),harmonic=ctx.createOscillator();
    fundamental.type="triangle";fundamental.frequency.setValueAtTime(50+Math.random()*4,start);
    harmonic.type="sine";harmonic.frequency.setValueAtTime(100+Math.random()*7,start);
    const low=ctx.createGain(),high=ctx.createGain();low.gain.value=.68;high.gain.value=.22;
    fundamental.connect(low);harmonic.connect(high);low.connect(bus);high.connect(bus);

    // A quiet amplitude flutter gives the synthetic tone the rolling texture of a
    // purr without requiring bundled audio assets.
    const lfo=ctx.createOscillator(),lfoGain=ctx.createGain();
    lfo.type="sine";lfo.frequency.value=23+Math.random()*3;lfoGain.gain.value=.0045*this.volume;
    lfo.connect(lfoGain);lfoGain.connect(bus.gain);

    for(const osc of [fundamental,harmonic,lfo]){osc.start(start);osc.stop(start+duration);}
  }

  play(petId:string,species:string,event:SoundEvent):void{
    if(!this.enabled||this.quietHours)return;
    const key=`${petId}:${event}`,now=performance.now();
    if(now-(this.lastPlayed.get(key)??0)<(COOLDOWNS_MS[event]??5_000))return;
    this.lastPlayed.set(key,now);
    const ctx=this.ensureContext();
    if(event==="purr"){this.playPurr(ctx);return;}

    const profile=PROFILES[event];if(!profile)return;
    const osc=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime;
    const pitch=.965+Math.random()*.07;
    osc.type=profile.type;
    osc.frequency.setValueAtTime(profile.freq*pitch,start);
    if(profile.sweep)osc.frequency.exponentialRampToValueAtTime(profile.sweep.to*pitch,start+profile.sweep.duration);
    gain.gain.setValueAtTime(.001,start);
    gain.gain.linearRampToValueAtTime(profile.volume*this.volume,start+Math.min(.018,profile.duration*.2));
    gain.gain.exponentialRampToValueAtTime(.001,start+profile.duration);
    osc.connect(gain);gain.connect(this.masterGain!);osc.start(start);osc.stop(start+profile.duration);
    void species;
  }

  playSpeciesVocal(petId:string,species:string):void{
    const sounds=SPECIES_SOUNDS[species];if(!sounds?.length)return;
    const pick=sounds[Math.floor(Math.random()*sounds.length)]!;this.play(petId,species,pick);
  }

  playBehaviorSound(petId:string,species:string,behavior:string):void{
    const map:Record<string,SoundEvent>={
      sleep:"sleep_noise",groom:"purr",eat:"eat",drink:"drink",scratch:"scratch",
      play_toy:"toy",greet_pet:"social",play_pet:"social",pounce:"startle",
      chase_cursor:"footstep",run:"footstep",walk:"footstep"
    };
    const event=map[behavior];if(event)this.play(petId,species,event);
  }
}
