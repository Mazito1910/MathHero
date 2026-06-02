// =====================================================================
// MATH HERO - COMPLETE GAME SCRIPT
// =====================================================================

const $ = (id) => document.getElementById(id);
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const G = {
  level: 1,
  score: 0,
  lives: 3,
  maxLives: 3,
  taskIdx: 0,
  tasks: [],
  timeLeft: 0,
  totalTime: 15,
  timer: null,
  totalElapsed: 0,
  gameStartTime: null,
  selectedHero: null,
  playerName: '',
  trainingMode: false,
  demoMode: false,     // Präsentations-Demo: nur Level 1, 6, 10
  demoIdx: 0,          // Index in DEMO_LEVELS
  enemyHP: 5,
  enemyMaxHP: 5,
  _musicLevel: 0,
  // ── Neue Feature-Felder ──
  combo: 0,            // aktuelle Treffer-Serie
  correctTotal: 0,     // korrekte Antworten gesamt
  shield: 0,           // Schild-Power-Up: Anzahl verbleibender Schutz-Treffer
  joker: false,        // Joker aktiv: zeigt einmal die Lösung
  bonusTimeAll: 0,     // Bonus-Sekunden für ALLE verbleibenden Level
  doublePoints: false, // Doppel-Punkte aktiv (1 Aufgabe)
  extraTime: 0,        // Bonus-Sekunden für nächste Aufgabe
  powerUpUsed: false,  // Power-Up nach Level 5 bereits gezeigt
  // ── Statistik-Tracking ──
  stats: { tasks: [] }, // alle Aufgaben-Versuche des laufenden Spiels
  _taskStartTime: 0     // Zeitpunkt, zu dem die aktuelle Aufgabe gezeigt wurde
};

// =====================================================================
// SOUND SYSTEM
// =====================================================================
// =====================================================================
// SOUND SYSTEM — Tone.js
// =====================================================================
const SoundSystem = {
  _ready: false,
  _loops: [],
  _baseBpm: 96,
  lastWarningTime: 0,

  // ---- Initialisierung (einmalig nach erstem Klick) ----
  async init() {
    try {
      await Tone.start();
      if (this._ready) return;

      this._verb = new Tone.Reverb({ decay: 2.0, wet: 0.18 }).toDestination();
      var verb = this._verb;  // local alias so .connect(verb) calls below stay unchanged

      // Melodie-Synth — Triangle: warmer Synthesizer-Sound, kein Orgel-Klang
      this._mel = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.08, decay: 0.25, sustain: 0.45, release: 0.7 }
      }).connect(verb);
      this._mel.volume.value = -12;

      // Bass-Synth
      this._bass = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.08, decay: 0.25, sustain: 0.5, release: 0.8 }
      }).connect(verb);
      this._bass.volume.value = -13;

      // Pad-Akkorde
      this._pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.5, decay: 0.3, sustain: 0.7, release: 2.0 }
      }).connect(verb);
      this._pad.volume.value = -22;

      // Schlagzeug
      this._kick = new Tone.MembraneSynth({
        pitchDecay: 0.04, octaves: 6,
        envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.1 }
      }).toDestination();
      this._kick.volume.value = -10;

      this._snare = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.05 }
      }).toDestination();
      this._snare.volume.value = -18;

      // NoiseSynth + Hochpassfilter statt MetalSynth — deutlich stabiler, kein Crackling
      var _hihatHPF = new Tone.Filter({ frequency: 6000, type: 'highpass' }).toDestination();
      this._hihat = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 }
      }).connect(_hihatHPF);
      this._hihat.volume.value = -22;

      // Master-Ausgang um 4 dB absenken → verhindert Clipping bei gleichzeitigen Sounds
      try { Tone.getDestination().volume.value = -4; } catch(e) {}

      // SFX-Synths — leiser als vorher, damit Melodie nicht übertönt wird
      this._sfxH = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.25 }
      }).toDestination();
      this._sfxH.volume.value = -13;

      this._sfxL = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.005, decay: 0.14, sustain: 0.2, release: 0.25 }
      }).toDestination();
      this._sfxL.volume.value = -17;

      this._sfxBlip = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.04 }
      }).toDestination();
      this._sfxBlip.volume.value = -22;

      this._ready = true;
      this.loadVolSettings();
      this.applyMusicVolume();
      this.applySfxVolume();
    } catch (e) { /* Autoplay-Policy — startet beim ersten Klick */ }
  },

  _stopLoops() {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    this._loops.forEach(function(l) { try { l.dispose(); } catch(e) {} });
    this._loops = [];
  },

  // ── Lautstärke-Einstellungen ──────────────────────────────────────────
  _musicVol: 80,   // 0–100, wird aus localStorage geladen
  _sfxVol:   80,

  // pct → dB-Offset (100%→0dB, 50%→-6dB, 0%→stumm)
  _pctToDb(pct) {
    if (pct <= 0) return -100;
    return 20 * Math.log10(pct / 100);
  },

  applyMusicVolume() {
    var db = this._pctToDb(this._musicVol);
    try {
      if (this._mel)  this._mel.volume.value  = -12 + db;
      if (this._bass) this._bass.volume.value = -14 + db;
      if (this._pad)  this._pad.volume.value  = -18 + db;
    } catch(e) {}
  },

  applySfxVolume() {
    var db = this._pctToDb(this._sfxVol);
    try {
      if (this._kick)    this._kick.volume.value    = -10 + db;
      if (this._snare)   this._snare.volume.value   = -18 + db;
      if (this._hihat)   this._hihat.volume.value   = -22 + db;
      if (this._sfxH)    this._sfxH.volume.value    = -13 + db;
      if (this._sfxL)    this._sfxL.volume.value    = -17 + db;
      if (this._sfxBlip) this._sfxBlip.volume.value = -22 + db;
    } catch(e) {}
  },

  loadVolSettings() {
    try {
      var s = JSON.parse(localStorage.getItem('mathHeroVol') || '{}');
      if (s.music !== undefined) this._musicVol = s.music;
      if (s.sfx   !== undefined) this._sfxVol   = s.sfx;
    } catch(e) {}
  },

  saveVolSettings() {
    localStorage.setItem('mathHeroVol', JSON.stringify({ music: this._musicVol, sfx: this._sfxVol }));
  },

  // ================================================================
  // MENÜ-MUSIK — fröhlich, unaufgeregt (C-Dur, 96 BPM)
  // ================================================================
  async startMenuMusic() {
    await this.init();
    if (!this._ready) return;
    this._stopLoops();

    // Reset ALLE Synths auf weiche Menü-Werte — verhindert Clipping-Rückstände aus Tier 5
    try {
      this._mel.set({ oscillator: { type: 'triangle' },
                      envelope: { attack: 0.08, decay: 0.25, sustain: 0.55, release: 1.2 } });
      this._mel.volume.value = -14;
      if (this._bass) this._bass.set({ oscillator: { type: 'sine' },
                      envelope: { attack: 0.05, decay: 0.20, sustain: 0.60, release: 0.80 } });
      this._bass.volume.value = -15;
      if (this._pad) this._pad.set({ oscillator: { type: 'triangle' } });
      this._pad.volume.value = -20;
      if (this._verb) this._verb.wet.value = 0.32;
      // Drums: Lautstärke zurücksetzen damit kein Überlast-Zustand aus Tier 5 hängt
      if (this._kick)  this._kick.volume.value  = -10 + this._pctToDb(this._sfxVol);
      if (this._snare) this._snare.volume.value = -18 + this._pctToDb(this._sfxVol);
      if (this._hihat) this._hihat.volume.value = -22 + this._pctToDb(this._sfxVol);
    } catch(e) {}

    this._baseBpm = 84;
    Tone.Transport.bpm.value = 84;

    var m = this._mel, b = this._bass, p = this._pad;
    var k = this._kick, sn = this._snare, h = this._hihat;

    // Lively C-major melody — two 8-bar phrases that complement each other
    var mel = [
      'C4','E4','G4','E4','A4','G4','E4','C4',
      'D4','F4','A4','F4','Bb4','A4','G4','F4',
      'E4','G4','C5','B4','A4','G4','F4','E4',
      'D4','C4','E4','G4','C4',null,null,null
    ];
    // Walking bass line
    var bass = [
      'C2',null,'C2',null,'F2',null,'F2',null,
      'G2',null,'G2',null,'C2',null,'C2',null,
      'A2',null,'A2',null,'F2',null,'F2',null,
      'G2',null,'G2',null,'C2',null,null,null
    ];
    // Pad chords — held long for warmth
    var pad = [
      ['C3','E3','G3'],null,null,null,['F3','A3','C4'],null,null,null,
      ['G3','B3','D4'],null,null,null,['C3','E3','G3'],null,null,null,
      ['A3','C4','E4'],null,null,null,['F3','A3','C4'],null,null,null,
      ['G3','B3','D4'],null,null,null,['C3','E3','G3'],null,null,null
    ];
    // Kick on 1 and 3 (every 4 eighth-notes = quarter note positions)
    var kick = [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0].map(function(v){ return v?'C1':null; });
    // Snare on 2 and 4
    var snare= [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0].map(function(v){ return v?'C1':null; });
    // Hihat eighth-note pulse (quieter on off-beats)
    var hihat= ['C3','C3','C3','C3','C3','C3','C3','C3',
                'C3','C3','C3','C3','C3','C3','C3','C3'];

    function sq(cb,arr){ return new Tone.Sequence(cb,arr,'8n'); }
    var self = this;
    var loops = [
      sq(function(t,n){ if(n) m.triggerAttackRelease(n,'8n',t); }, mel),
      sq(function(t,n){ if(n) b.triggerAttackRelease(n,'4n',t); }, bass),
      sq(function(t,n){ if(n) p.triggerAttackRelease(n,'2n',t); }, pad),
      sq(function(t,n){ if(n) k.triggerAttackRelease('C1','8n',t); }, kick),
      sq(function(t,n){ if(n) sn.triggerAttackRelease('8n',t); }, snare),
      sq(function(t,n){ if(n) h.triggerAttackRelease('16n',t); }, hihat)
    ];
    loops.forEach(function(s){ s.start(0); self._loops.push(s); });
    Tone.Transport.start();
  },

  stopMenuMusic() { this._stopLoops(); },

  // ================================================================
  // LEVEL-MUSIK — 5 Tiers, jedes 2. Level spannender
  // ================================================================
  async startLevelMusic(level) {
    await this.init();
    if (!this._ready) return;
    this._stopLoops();

    var t = level <= 2 ? 1 : level <= 4 ? 2 : level <= 6 ? 3 : level <= 8 ? 4 : 5;
    this._setSynthTier(t);

    var cfg = t === 1 ? this._tier(1)
            : t === 2 ? this._tier(2)
            : t === 3 ? this._tier(3)
            : t === 4 ? this._tier(4)
            :            this._tier(5);

    this._baseBpm = cfg.bpm;
    Tone.Transport.bpm.value = cfg.bpm;
    var self = this;
    cfg.loops.forEach(function(l){ l.start(0); self._loops.push(l); });
    Tone.Transport.start();
  },

  // Klangcharakter je Tier: Alle Tiers nutzen Triangle (warmer Synth ohne Härte).
  // Steigerung entsteht durch kürzere Hüllkurve (mehr Punch) + Drums + BPM — nicht durch
  // härtere Wellenformen, die perceptuell viel lauter klingen.
  _setSynthTier(n) {
    // Triangle durchgehend → gleich wahrgenommene Lautstärke, kein Lautstärkesprung
    var env  = [null,
      { attack: 0.10, decay: 0.30, sustain: 0.50, release: 0.90 }, // T1: weich, schwebend
      { attack: 0.06, decay: 0.22, sustain: 0.45, release: 0.60 }, // T2: flüssig, warm
      { attack: 0.03, decay: 0.16, sustain: 0.40, release: 0.38 }, // T3: etwas Punch
      { attack: 0.015,decay: 0.12, sustain: 0.35, release: 0.20 }, // T4: punchy, präsent
      { attack: 0.008,decay: 0.09, sustain: 0.30, release: 0.12 }  // T5: snappy, dringend
    ];
    // Reverb nimmt ab → Sound wird trockener/direkter (Gaming-Gefühl), nicht lauter
    var wet = [null, 0.26, 0.21, 0.17, 0.13, 0.10];

    try {
      if (this._mel) {
        this._mel.set({ oscillator: { type: 'triangle' }, envelope: env[n] });
        this._mel.volume.value = -12;   // konstant über alle Tiers
      }
      if (this._bass) this._bass.set({ oscillator: { type: 'triangle' } });
      this._bass.volume.value = -14;
      if (this._verb) this._verb.wet.value = wet[n];
    } catch(e) {}
  },

  _tier(n) {
    var m = this._mel, b = this._bass, k = this._kick, s = this._snare, h = this._hihat;

    function sq(cb, arr) { return new Tone.Sequence(cb, arr, '8n'); }

    if (n === 1) {
      // Tier 1 — C-Dur, 60 BPM: traumhaft langsam, breite Noten, nur Melodie
      // Charakter: Ambient-Lullaby — sehr entspannt, fast schwebend
      return { bpm: 60, loops: [
        sq(function(t,v){ if(v) m.triggerAttackRelease(v,'4n.',t); },
          ['C3',null,'E3',null,'G3',null,'C4',null,
           'G3',null,'E3',null,'A3',null,'G3',null])
      ]};
    }
    if (n === 2) {
      // Tier 2 — F-Dur, 80 BPM: beschwingter Marsch, Walking Bass, keine Drums
      // Charakter: Fröhlich-tänzerisch — eine neue Tonart bringt Frische
      return { bpm: 80, loops: [
        sq(function(t,v){ if(v) m.triggerAttackRelease(v,'8n',t); },
          ['F3','A3','C4','F4','C4','A3','Bb3','G3',
           'F3','C4','E4','F4','D4','C4','A3',null]),
        sq(function(t,v){ if(v) b.triggerAttackRelease(v,'4n',t); },
          ['F2',null,null,null,'Bb2',null,null,null,
           'C3',null,null,null,'F2',null,null,null])
      ]};
    }
    if (n === 3) {
      // Tier 3 — a-Moll, 95 BPM: synkopiert (Offbeat-Start), Bass-Walk, Kick
      // Charakter: Treibend-nervös — Einsatz NACH dem Beat schafft Unruhe
      return { bpm: 95, loops: [
        sq(function(t,v){ if(v) m.triggerAttackRelease(v,'8n',t); },
          [null,'A3','C4',null,'E4','A4',null,'G4',
           null,'F4','E4',null,'D4','C4',null,'B3']),
        sq(function(t,v){ if(v) b.triggerAttackRelease(v,'8n',t); },
          ['A2',null,'A2','E2',null,'A2',null,'G2',
           'F2',null,'F2','C2',null,'E2',null,'A1']),
        sq(function(t,v){ if(v) k.triggerAttackRelease(v,'8n',t); },
          ['C1',null,null,'C1',null,null,'C1',null,
           'C1',null,null,'C1',null,null,'C1',null])
      ]};
    }
    if (n === 4) {
      // Tier 4 — e-Moll, 112 BPM: abst. Skalen-Läufe, Kick + Snare, dramatisch
      // Charakter: Dringend-heroisch — neue Tonart + schnelle Skala = echter Stilwechsel
      return { bpm: 112, loops: [
        sq(function(t,v){ if(v) m.triggerAttackRelease(v,'16n',t); },
          ['B4','A4','G4','F#4','E4','D4','C4','B3',
           'A3','G3','F#3','E3','F#3','G3','A3','B3']),
        sq(function(t,v){ if(v) b.triggerAttackRelease(v,'8n',t); },
          ['E2',null,'B2',null,'C3',null,'G2',null,
           'A2',null,'E2',null,'B1',null,'E2',null]),
        sq(function(t,v){ if(v) k.triggerAttackRelease(v,'8n',t); },
          ['C1',null,null,null,'C1',null,null,null,
           'C1',null,null,null,'C1',null,null,null]),
        sq(function(t,v){ if(v) s.triggerAttackRelease('16n',t); },
          [null,null,null,null,'C1',null,null,null,
           null,null,null,null,'C1',null,null,null])
      ]};
    }
    // Tier 5 — d-Moll, 112 BPM: chromat. Abstieg, saubere Drums (kein Clipping)
    // 128 BPM + 32n-Patterns → MetalSynth-Überlastung → auf 112 + 16n reduziert
    return { bpm: 112, loops: [
      sq(function(t,v){ if(v) m.triggerAttackRelease(v,'16n',t); },
        ['D4','C4','Bb3','A3','G#3','A3','C4','D4',
         'F4','A4','D5','C5','Bb4','A4','G#4','A4']),
      sq(function(t,v){ if(v) b.triggerAttackRelease(v,'8n',t); },
        ['D2',null,'A2',null,'Bb2',null,'A2',null,
         'D2',null,'F2',null,'A2',null,'Bb2',null]),
      // Kick: sauber auf Zählzeit 1 und 3 — kein Dreifach-Schlag
      sq(function(t,v){ if(v) k.triggerAttackRelease(v,'8n',t); },
        ['C1',null,null,null,'C1',null,null,null,
         'C1',null,null,null,'C1',null,null,null]),
      // Snare: '16n' statt '32n' — verhindert Clipping
      sq(function(t,v){ if(v) s.triggerAttackRelease('16n',t); },
        [null,null,null,null,'C1',null,null,null,
         null,null,null,null,'C1',null,null,null]),
      // Hihat: nur jeden 2. Achtel — MetalSynth nicht überlasten
      sq(function(t,v){ if(v) h.triggerAttackRelease('16n',t); },
        ['C1',null,'C1',null,'C1',null,'C1',null,
         'C1',null,'C1',null,'C1',null,'C1',null])
    ]};
  },

  setTempo(mult) { Tone.Transport.bpm.value = this._baseBpm * mult; },
  stopMusic()    { this._stopLoops(); },

  // ================================================================
  // SFX  (Sekunden-basierte Dauern — unabhängig vom Transport-BPM)
  // ================================================================
  playCorrect() {
    if (!this._ready) return;
    var t = Tone.now();
    this._sfxH.triggerAttackRelease('C5', 0.1, t);
    this._sfxH.triggerAttackRelease('E5', 0.1, t + 0.08);
    this._sfxH.triggerAttackRelease('G5', 0.15, t + 0.16);
  },
  playWrong() {
    if (!this._ready) return;
    var t = Tone.now();
    this._sfxL.triggerAttackRelease('A3', 0.12, t);
    this._sfxL.triggerAttackRelease('F3', 0.18, t + 0.15);
  },
  playTimeWarning() {
    if (this._ready) this._sfxBlip.triggerAttackRelease('A5', 0.05, Tone.now());
  },
  playAttack() {
    if (!this._ready) return;
    var t = Tone.now();
    this._sfxBlip.triggerAttackRelease('G4', 0.04, t);
    this._sfxBlip.triggerAttackRelease('C4', 0.08, t + 0.07);
  },
  playSuperAttack() {
    if (!this._ready) return;
    var t = Tone.now();
    ['C4','E4','G4','C5','E5','G5','C6'].forEach(function(n, i) {
      this._sfxH.triggerAttackRelease(n, 0.1, t + i * 0.07);
    }.bind(this));
  },
  playLevelComplete() {
    if (!this._ready) return;
    var t = Tone.now();
    [['G4',0],['G4',.12],['G4',.24],['C5',.38],['B4',.55],['A4',.70],
     ['G4',.86],['C5',1.0],['E5',1.16]].forEach(function(nd) {
      this._sfxH.triggerAttackRelease(nd[0], 0.15, t + nd[1]);
    }.bind(this));
  },
  playGameOver() {
    if (!this._ready) return;
    var t = Tone.now();
    [['G4',0],['F4',.30],['E4',.60],['D4',.90],['C4',1.20]].forEach(function(nd) {
      this._sfxL.triggerAttackRelease(nd[0], 0.25, t + nd[1]);
    }.bind(this));
  },
  playVictory() {
    if (!this._ready) return;
    var t = Tone.now();
    [['C5',0],['C5',.13],['C5',.26],['C5',.40],['Ab4',.55],['Bb4',.68],
     ['C5',.81],['Bb4',.91],['C5',1.01],['Eb5',1.15],['G5',1.40]].forEach(function(nd) {
      this._sfxH.triggerAttackRelease(nd[0], 0.15, t + nd[1]);
    }.bind(this));
  },
  playClick()  { if (this._ready) this._sfxBlip.triggerAttackRelease('G5', 0.05, Tone.now()); },
  playSelect() {
    if (!this._ready) return;
    var t = Tone.now();
    this._sfxH.triggerAttackRelease('A4', 0.07, t);
    this._sfxH.triggerAttackRelease('C5', 0.07, t + 0.07);
    this._sfxH.triggerAttackRelease('E5', 0.10, t + 0.14);
  },
  playLifeLost() {
    if (!this._ready) return;
    var t = Tone.now();
    this._sfxL.triggerAttackRelease('F4', 0.15, t);
    this._sfxL.triggerAttackRelease('C4', 0.30, t + 0.18);
  }
};

document.addEventListener('click', async function() {
  await SoundSystem.init();
  // Menü-Musik starten falls noch nicht laufend
  var menu = document.getElementById('screen-menu');
  if (menu && menu.classList.contains('active') && Tone.Transport.state !== 'started') {
    SoundSystem.startMenuMusic();
  }
}, { once: true });

// =====================================================================
// CHARACTERS & ENEMIES
// =====================================================================
var CHARACTERS = [
  { name: 'Katzen-Hexe',      color: '#8e24aa' },
  { name: 'Power-Prinzessin', color: '#c2185b' },
  { name: 'Ritter Leo',       color: '#1565c0' },
  { name: 'Ninja',            color: '#212121' }
];

// =====================================================================
// SUPABASE — globale Highscore-Datenbank mit localStorage-Fallback
// =====================================================================
var SupabaseDB = {
  _url: 'https://budsuvkaiczmlbxqvfip.supabase.co',
  _key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1ZHN1dmthaWN6bWxieHF2ZmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MzY4NTUsImV4cCI6MjA5NTQxMjg1NX0.Ienlvt7Yn-y-vd9i2H1rTYE_85bBW1CfGIBo_sD1-n8',
  _client: null,

  // Supabase-Client einmalig erzeugen
  init: function() {
    if (this._client) return;
    if (window.supabase && window.supabase.createClient) {
      this._client = window.supabase.createClient(this._url, this._key);
    }
  },

  // True wenn Browser online UND SDK geladen
  isOnline: function() {
    return navigator.onLine && this._client !== null;
  },

  // Score in Supabase speichern; bei Fehler → Pending-Queue
  saveScore: async function(entry) {
    this.init();
    var row = {
      player_name:   entry.name,
      score:         entry.score,
      level_reached: entry.level,
      hero_index:    entry.hero
    };
    if (!this.isOnline()) {
      this._addPending(row); return false;
    }
    try {
      var res = await this._client.from('highscores').insert(row);
      if (res.error) { this._addPending(row); return false; }
      return true;
    } catch(e) {
      this._addPending(row); return false;
    }
  },

  // Top-20 Scores aus Supabase laden; null = offline → Fallback auf localStorage
  loadScores: async function(filter) {
    this.init();
    if (!this.isOnline()) return null;
    try {
      var q = this._client
        .from('highscores')
        .select('player_name, score, level_reached, hero_index, created_at')
        .order('score', { ascending: false })
        .limit(20);

      if (filter === 'today') {
        var t = new Date(); t.setHours(0,0,0,0);
        q = q.gte('created_at', t.toISOString());
      } else if (filter === 'month') {
        var m = new Date(); m.setDate(1); m.setHours(0,0,0,0);
        q = q.gte('created_at', m.toISOString());
      }

      var res = await q;
      if (res.error) return null;
      // Supabase-Format → internes Format angleichen
      return (res.data || []).map(function(r) {
        return {
          name:  r.player_name,
          score: r.score,
          level: r.level_reached,
          hero:  r.hero_index,
          date:  new Date(r.created_at).toLocaleDateString('de-DE')
        };
      });
    } catch(e) {
      return null;
    }
  },

  // Offline-gespeicherte Scores hochladen sobald wieder online
  syncPending: async function() {
    this.init();
    if (!this.isOnline()) return;
    var pending = this._getPending();
    if (!pending.length) return;
    try {
      var res = await this._client.from('highscores').insert(pending);
      if (!res.error) {
        localStorage.removeItem('mathHeroPending');
        console.log('[SupabaseDB] ' + pending.length + ' pending score(s) synced.');
      }
    } catch(e) {}
  },

  _addPending: function(row) {
    var list = this._getPending();
    list.push(row);
    localStorage.setItem('mathHeroPending', JSON.stringify(list));
  },
  _getPending: function() {
    try { return JSON.parse(localStorage.getItem('mathHeroPending')) || []; }
    catch(e) { return []; }
  }
};

// Pending-Sync auslösen wenn Browser wieder online kommt
window.addEventListener('online', function() { SupabaseDB.syncPending(); });

// Einmalige Migration: vorhandene localStorage-Scores → Supabase
async function migrateLocalScoresToSupabase() {
  // Bereits migriert oder keine lokalen Daten → überspringen
  if (localStorage.getItem('mathHeroMigrated')) return;
  var local = loadLocalScores();
  if (!local.length) { localStorage.setItem('mathHeroMigrated', '1'); return; }

  SupabaseDB.init();
  if (!SupabaseDB.isOnline()) return; // kein Internet → beim nächsten Start erneut versuchen

  // DD.MM.YYYY → ISO-Timestamp (Mitternacht)
  function parseDate(str) {
    var p = (str || '').split('.');
    if (p.length < 3) return new Date().toISOString();
    return new Date(+p[2], +p[1] - 1, +p[0]).toISOString();
  }

  var rows = local.map(function(s) {
    return {
      player_name:   s.name  || 'Held',
      score:         s.score || 0,
      level_reached: s.level || 1,
      hero_index:    s.hero  || 0,
      created_at:    parseDate(s.date)
    };
  });

  try {
    var res = await SupabaseDB._client.from('highscores').insert(rows);
    if (!res.error) {
      localStorage.setItem('mathHeroMigrated', '1');
      console.log('[Migration] ' + rows.length + ' lokale Score(s) nach Supabase übertragen.');
    }
  } catch(e) {
    console.warn('[Migration] Fehler:', e);
  }
}

// One enemy per level (10 total), name + defeat message ({name} = player name)
var ENEMIES = [
  null,
  { name: 'Baby-Blob',        msg: 'Super gemacht, {name}! Du warst viel stärker als ich! Viel Erfolg noch! 😊' },
  { name: 'Schleim',          msg: 'Wow, {name}! Ich hatte keine Chance! Mach weiter so! ⭐' },
  { name: 'Mini-Imp',         msg: 'Nicht schlecht, {name}! Aber die Nächsten sind nicht so nett wie ich... 😏' },
  { name: 'Kobold',           msg: 'Hmpf! {name} hat mich besiegt! Das nächste Mal bin ich bereit! 😤' },
  { name: 'Geist',            msg: 'Du glaubst, das wars, {name}? Die echte Herausforderung kommt noch! 👻' },
  { name: 'Stein-Golem',      msg: 'Krrk... {name}... du bist stärker als erwartet. Meine Freunde sind mächtiger! 💢' },
  { name: 'Knochen-Ritter',   msg: 'NEIN! {name} hat mich besiegt! Du... wirst... es... bereuen! 💀' },
  { name: 'Feuer-Drache',     msg: '{name}... Du wagst es?! Der Boss wird dich VERNICHTEN! 🔥😡' },
  { name: 'Schatten-Phantom', msg: 'Unmöglich... {name}... Kein Mensch schafft es so weit. Hier endet dein Weg! 👁️' },
  { name: 'Mathe-Zauberer',   msg: 'Das... ist unmöglich! {name} ist der wahre Math Hero! 🏆✨' }
];

// Progressive backgrounds per level: calm → wild/threatening (child-safe)
var LEVEL_BG = [
  null,
  'linear-gradient(180deg,#87ceeb 0%,#b8dff0 45%,#c8e6c9 100%)',            // L1 blauer Himmel
  'linear-gradient(180deg,#fffde7 0%,#ffe082 40%,#a5d6a7 100%)',             // L2 sonnige Wiese
  'linear-gradient(180deg,#ffccbc 0%,#ff8a65 40%,#6d4c41 100%)',             // L3 Herbst-Dämmerung
  'linear-gradient(180deg,#e8eaf6 0%,#7e57c2 45%,#311b92 100%)',             // L4 Abenddämmerung
  'linear-gradient(180deg,#1b5e20 0%,#0a2b0a 55%,#050a00 100%)',             // L5 Dunkler Wald
  'linear-gradient(180deg,#1a237e 0%,#0d1041 50%,#000000 100%)',             // L6 Sturmnacht
  'linear-gradient(180deg,#b71c1c 0%,#e64a19 35%,#1c0000 100%)',             // L7 Vulkan-Glut
  'linear-gradient(180deg,#0d0d0d 0%,#1a1a2e 40%,#0f3460 100%)',             // L8 Gewittersturm
  'linear-gradient(180deg,#1a0033 0%,#4a0072 45%,#0d0015 100%)',             // L9 Unterwelt
  'linear-gradient(180deg,#0d0015 0%,#1a0033 30%,#4a0008 65%,#000 100%)',   // L10 Chaos
];

function getCharSVG(index) {
  // 0 – Katzen-Hexe (female cat wizard)
  if (index === 0) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M26 68 Q19 118 50 120 Q81 118 74 68Z" fill="#1a237e"/>'
    + '<ellipse cx="50" cy="69" rx="24" ry="12" fill="#283593"/>'
    + '<line x1="73" y1="53" x2="77" y2="112" stroke="#6d4c41" stroke-width="5" stroke-linecap="round"/>'
    + '<polygon points="73,38 67,53 73,57 79,53" fill="#80d8ff"/>'
    + '<polygon points="73,38 67,53 73,48 79,53" fill="#e3f2fd" opacity="0.7"/>'
    + '<circle cx="73" cy="47" r="7" fill="#29b6f6" opacity="0.3"/>'
    + '<ellipse cx="71" cy="83" rx="8" ry="13" fill="#283593" transform="rotate(12 71 83)"/>'
    + '<ellipse cx="76" cy="95" rx="7" ry="5" fill="#ff8f00"/>'
    + '<ellipse cx="29" cy="80" rx="8" ry="13" fill="#283593" transform="rotate(-10 29 80)"/>'
    + '<ellipse cx="23" cy="92" rx="7" ry="5" fill="#ff8f00"/>'
    + '<rect x="24" y="84" width="17" height="14" rx="2" fill="#4e342e"/>'
    + '<rect x="26" y="86" width="13" height="10" rx="1" fill="#6d4c41"/>'
    + '<text x="32" y="93" text-anchor="middle" font-size="5" fill="#f9a825" font-weight="bold">3 5</text>'
    + '<text x="32" y="99" text-anchor="middle" font-size="5" fill="#f9a825">8</text>'
    + '<path d="M28 110 Q10 118 13 124" stroke="#ff8f00" stroke-width="7" fill="none" stroke-linecap="round"/>'
    + '<circle cx="50" cy="46" r="21" fill="#ff8f00"/>'
    + '<path d="M37 35 Q41 33 44 35" stroke="#e65100" stroke-width="2" fill="none"/>'
    + '<path d="M56 35 Q60 33 63 35" stroke="#e65100" stroke-width="2" fill="none"/>'
    + '<polygon points="33,31 26,15 43,24" fill="#ff8f00"/>'
    + '<polygon points="67,31 74,15 57,24" fill="#ff8f00"/>'
    + '<polygon points="34,29 29,17 42,24" fill="#ffcdd2"/>'
    + '<polygon points="66,29 71,17 58,24" fill="#ffcdd2"/>'
    + '<ellipse cx="50" cy="27" rx="25" ry="6" fill="#6a1b9a"/>'
    + '<path d="M28 27 Q50 0 72 27Z" fill="#7b1fa2"/>'
    + '<text x="57" y="20" text-anchor="middle" font-size="10" fill="#ffd600">&#9733;</text>'
    + '<circle cx="44" cy="14" r="2.5" fill="#ffd600"/>'
    + '<circle cx="43" cy="46" r="7" fill="none" stroke="#2e7d32" stroke-width="2.5"/>'
    + '<circle cx="57" cy="46" r="7" fill="none" stroke="#2e7d32" stroke-width="2.5"/>'
    + '<line x1="50" y1="46" x2="50" y2="46" stroke="#2e7d32" stroke-width="2.5"/>'
    + '<line x1="36" y1="46" x2="36" y2="46" stroke="#2e7d32" stroke-width="2.5"/>'
    + '<circle cx="43" cy="46" r="4" fill="#a5d6a7"/>'
    + '<circle cx="57" cy="46" r="4" fill="#a5d6a7"/>'
    + '<circle cx="44" cy="46" r="2" fill="#1b5e20"/>'
    + '<circle cx="58" cy="46" r="2" fill="#1b5e20"/>'
    + '<circle cx="44.5" cy="45.5" r="0.8" fill="#fff"/>'
    + '<circle cx="58.5" cy="45.5" r="0.8" fill="#fff"/>'
    + '<ellipse cx="50" cy="54" rx="3" ry="2" fill="#e91e63"/>'
    + '<line x1="30" y1="52" x2="46" y2="54" stroke="#4e342e" stroke-width="1"/>'
    + '<line x1="30" y1="56" x2="46" y2="56" stroke="#4e342e" stroke-width="1"/>'
    + '<line x1="70" y1="52" x2="54" y2="54" stroke="#4e342e" stroke-width="1"/>'
    + '<line x1="70" y1="56" x2="54" y2="56" stroke="#4e342e" stroke-width="1"/>'
    + '<path d="M46 58 Q50 63 54 58" stroke="#bf360c" fill="none" stroke-width="1.5"/>'
    + '</svg>';

  // 1 – Power-Prinzessin (Prinzessin im Kampfmodus)
  if (index === 1) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    // ── Kampf-Kleid ────────────────────────────────────────────────────
    + '<path d="M28 68 Q21 118 50 120 Q79 118 72 68Z" fill="#c2185b"/>'
    + '<ellipse cx="50" cy="69" rx="24" ry="12" fill="#d81b60"/>'
    + '<path d="M28 70 Q50 82 72 70" stroke="#ffd600" stroke-width="2.5" fill="none"/>'
    + '<path d="M24 84 Q50 96 76 84" stroke="#ffd600" stroke-width="1.5" fill="none" opacity=".5"/>'
    // ── Körperpanzer ───────────────────────────────────────────────────
    + '<rect x="35" y="54" width="30" height="17" rx="5" fill="#880e4f"/>'
    + '<ellipse cx="50" cy="62" rx="6.5" ry="5.5" fill="#ffd600"/>'
    + '<ellipse cx="50" cy="62" rx="3.5" ry="3" fill="#fff9c4"/>'
    + '<ellipse cx="50" cy="62" rx="1.8" ry="1.8" fill="#e91e63"/>'
    + '<ellipse cx="36" cy="56" rx="8" ry="6" fill="#ad1457" transform="rotate(-18 36 56)"/>'
    + '<ellipse cx="64" cy="56" rx="8" ry="6" fill="#ad1457" transform="rotate(18 64 56)"/>'
    // ── Arme ───────────────────────────────────────────────────────────
    + '<ellipse cx="26" cy="67" rx="8" ry="13" fill="#ad1457" transform="rotate(-12 26 67)"/>'
    + '<ellipse cx="74" cy="67" rx="8" ry="13" fill="#ad1457" transform="rotate(12 74 67)"/>'
    + '<ellipse cx="20" cy="79" rx="7" ry="5" fill="#ffd6e8"/>'
    + '<ellipse cx="80" cy="79" rx="7" ry="5" fill="#ffd6e8"/>'
    // ── Magie-Szepter ──────────────────────────────────────────────────
    + '<line x1="80" y1="77" x2="92" y2="52" stroke="#7b1fa2" stroke-width="4" stroke-linecap="round"/>'
    + '<polygon points="87,47 92,39 97,47 92,55" fill="#ffd600"/>'
    + '<circle cx="92" cy="46" r="5.5" fill="#e040fb" opacity=".85"/>'
    + '<circle cx="92" cy="46" r="2.5" fill="#fff59d"/>'
    + '<circle cx="87" cy="41" r="2" fill="#e040fb" opacity=".6"/>'
    + '<circle cx="97" cy="42" r="1.5" fill="#fff59d" opacity=".7"/>'
    // ── Kopf ───────────────────────────────────────────────────────────
    + '<circle cx="50" cy="37" r="21" fill="#ffd6e8"/>'
    // ── Haare (Seiten-Strähnen) ────────────────────────────────────────
    + '<path d="M30 26 Q14 42 18 66 Q25 50 31 45" fill="#7b1fa2" opacity=".9"/>'
    + '<path d="M70 26 Q86 42 82 66 Q75 50 69 45" fill="#7b1fa2" opacity=".9"/>'
    + '<circle cx="16" cy="56" r="5.5" fill="#6a1b9a"/>'
    + '<circle cx="84" cy="56" r="5.5" fill="#6a1b9a"/>'
    + '<circle cx="16" cy="56" r="3" fill="#ce93d8"/>'
    + '<circle cx="84" cy="56" r="3" fill="#ce93d8"/>'
    + '<path d="M30 25 Q50 13 70 25 Q60 17 50 15 Q40 17 30 25" fill="#6a1b9a"/>'
    // ── Krone ─────────────────────────────────────────────────────────
    + '<polygon points="30,25 36,11 43,22 50,8 57,22 64,11 70,25" fill="#ffd600"/>'
    + '<circle cx="50" cy="9" r="3.5" fill="#e91e63"/>'
    + '<circle cx="36" cy="13" r="2.5" fill="#42a5f5"/>'
    + '<circle cx="64" cy="13" r="2.5" fill="#00e5ff"/>'
    + '<rect x="29" y="24" width="42" height="6" rx="3" fill="#ffd600"/>'
    // ── Augen ─────────────────────────────────────────────────────────
    + '<ellipse cx="42" cy="39" rx="8" ry="7" fill="white"/>'
    + '<ellipse cx="58" cy="39" rx="8" ry="7" fill="white"/>'
    + '<circle cx="42" cy="39" r="5" fill="#6a1b9a"/>'
    + '<circle cx="58" cy="39" r="5" fill="#6a1b9a"/>'
    + '<circle cx="43" cy="38" r="2" fill="#1a1a1a"/>'
    + '<circle cx="59" cy="38" r="2" fill="#1a1a1a"/>'
    + '<circle cx="44" cy="37.2" r="1" fill="white"/>'
    + '<circle cx="60" cy="37.2" r="1" fill="white"/>'
    // Wimpern
    + '<line x1="35" y1="33" x2="34" y2="30" stroke="#4a148c" stroke-width="1.5"/>'
    + '<line x1="39" y1="32" x2="39" y2="29" stroke="#4a148c" stroke-width="1.5"/>'
    + '<line x1="44" y1="32" x2="45" y2="29" stroke="#4a148c" stroke-width="1.5"/>'
    + '<line x1="55" y1="32" x2="55" y2="29" stroke="#4a148c" stroke-width="1.5"/>'
    + '<line x1="59" y1="32" x2="60" y2="29" stroke="#4a148c" stroke-width="1.5"/>'
    + '<line x1="63" y1="33" x2="64" y2="30" stroke="#4a148c" stroke-width="1.5"/>'
    // ── Nase & Mund ───────────────────────────────────────────────────
    + '<ellipse cx="50" cy="46" rx="2" ry="1.5" fill="#e8a0b4"/>'
    + '<path d="M44 50 Q50 56 56 50" stroke="#c2185b" fill="none" stroke-width="1.5"/>'
    + '<path d="M46 50.5 Q50 54 54 50.5" fill="#ff80ab"/>'
    // ── Stiefel ───────────────────────────────────────────────────────
    + '<rect x="32" y="108" width="16" height="10" rx="5" fill="#880e4f"/>'
    + '<rect x="52" y="108" width="16" height="10" rx="5" fill="#880e4f"/>'
    + '</svg>';

  // 2 – Ritter Leo (male knight)
  if (index === 2) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<rect x="35" y="93" width="14" height="20" rx="4" fill="#90a4ae"/>'
    + '<rect x="51" y="93" width="14" height="20" rx="4" fill="#90a4ae"/>'
    + '<rect x="32" y="107" width="18" height="8" rx="3" fill="#546e7a"/>'
    + '<rect x="50" y="107" width="18" height="8" rx="3" fill="#546e7a"/>'
    + '<rect x="25" y="58" width="50" height="38" rx="10" fill="#1565c0"/>'
    + '<rect x="29" y="61" width="42" height="30" rx="8" fill="#90a4ae"/>'
    + '<circle cx="50" cy="75" r="11" fill="#f9a825"/>'
    + '<text x="50" y="80" text-anchor="middle" font-size="14" fill="#e65100">&#9819;</text>'
    + '<rect x="25" y="91" width="50" height="7" rx="3" fill="#5d4037"/>'
    + '<rect x="46" y="90" width="8" height="9" rx="1" fill="#ffd600"/>'
    + '<rect x="9" y="59" width="16" height="28" rx="6" fill="#90a4ae"/>'
    + '<path d="M1 65 L17 61 L17 84 Q17 95 9 98 Q1 95 1 84Z" fill="#8d6e63" stroke="#5d4037" stroke-width="2"/>'
    + '<line x1="9" y1="61" x2="9" y2="98" stroke="#5d4037" stroke-width="2"/>'
    + '<line x1="1" y1="79" x2="17" y2="79" stroke="#5d4037" stroke-width="2"/>'
    + '<rect x="5" y="77" width="8" height="5" fill="#fff" opacity="0.25"/>'
    + '<rect x="75" y="59" width="16" height="26" rx="6" fill="#90a4ae"/>'
    + '<rect x="84" y="53" width="7" height="40" rx="3" fill="#b0bec5" stroke="#90a4ae" stroke-width="1"/>'
    + '<rect x="80" y="67" width="15" height="5" rx="2" fill="#8d6e63"/>'
    + '<rect x="85" y="91" width="6" height="9" rx="2" fill="#8d6e63"/>'
    + '<rect x="41" y="50" width="18" height="12" rx="5" fill="#ffd54f"/>'
    + '<ellipse cx="50" cy="34" rx="22" ry="22" fill="#ffd54f"/>'
    + '<circle cx="42" cy="38" r="1.5" fill="#ff8f00" opacity="0.5"/>'
    + '<circle cx="45" cy="41" r="1" fill="#ff8f00" opacity="0.5"/>'
    + '<circle cx="55" cy="38" r="1.5" fill="#ff8f00" opacity="0.5"/>'
    + '<circle cx="58" cy="41" r="1" fill="#ff8f00" opacity="0.5"/>'
    + '<path d="M28 37 Q28 11 50 11 Q72 11 72 37Z" fill="#b0bec5"/>'
    + '<rect x="28" y="33" width="44" height="9" rx="2" fill="#90a4ae"/>'
    + '<rect x="32" y="34" width="9" height="3" rx="1" fill="#546e7a"/>'
    + '<rect x="43" y="34" width="9" height="3" rx="1" fill="#546e7a"/>'
    + '<rect x="54" y="34" width="9" height="3" rx="1" fill="#546e7a"/>'
    + '<path d="M70 15 Q81 6 77 1 Q73 9 67 13Z" fill="#e53935"/>'
    + '<path d="M72 18 Q83 10 78 4 Q74 12 68 16Z" fill="#b71c1c"/>'
    + '<circle cx="41" cy="43" r="4.5" fill="#fff"/>'
    + '<circle cx="59" cy="43" r="4.5" fill="#fff"/>'
    + '<circle cx="42" cy="43" r="2.8" fill="#5d4037"/>'
    + '<circle cx="60" cy="43" r="2.8" fill="#5d4037"/>'
    + '<circle cx="42.8" cy="42.2" r="1" fill="#fff"/>'
    + '<circle cx="60.8" cy="42.2" r="1" fill="#fff"/>'
    + '<path d="M44 49 Q50 54 56 49" stroke="#e65100" fill="none" stroke-width="1.5"/>'
    + '</svg>';

  // 3 – Ninja
  return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    // ── Beine ──────────────────────────────────────────────────────────
    + '<rect x="34" y="90" width="13" height="24" rx="4" fill="#212121"/>'
    + '<rect x="53" y="90" width="13" height="24" rx="4" fill="#212121"/>'
    + '<rect x="32" y="107" width="17" height="8" rx="3" fill="#1a1a1a"/>'
    + '<rect x="51" y="107" width="17" height="8" rx="3" fill="#1a1a1a"/>'
    // ── Körper ─────────────────────────────────────────────────────────
    + '<rect x="27" y="55" width="46" height="38" rx="9" fill="#212121"/>'
    + '<rect x="27" y="78" width="46" height="7" rx="3" fill="#b71c1c"/>'
    + '<rect x="44" y="77" width="12" height="9" rx="1" fill="#c62828"/>'
    + '<text x="50" y="72" text-anchor="middle" font-size="10" fill="#b71c1c" opacity=".45" font-family="serif">&#24503;</text>'
    // Wurfstern am Gürtel
    + '<polygon points="37,82 39.5,77.5 42,82 36.5,79.5 42.5,79.5" fill="#90a4ae"/>'
    + '<polygon points="39.5,75 41.5,80.5 39.5,82.5 37.5,80.5" fill="#78909c"/>'
    // ── Katana (auf Rücken) ────────────────────────────────────────────
    + '<rect x="65" y="38" width="4.5" height="58" rx="2" fill="#546e7a" transform="rotate(12 65 38)"/>'
    + '<rect x="65.8" y="40" width="2.5" height="55" rx="1" fill="#e0e0e0" transform="rotate(12 65.8 40)"/>'
    + '<rect x="62" y="36" width="11" height="7" rx="2" fill="#795548" transform="rotate(12 62 36)"/>'
    // ── Arme ───────────────────────────────────────────────────────────
    + '<rect x="9" y="57" width="18" height="28" rx="7" fill="#212121"/>'
    + '<rect x="73" y="57" width="18" height="28" rx="7" fill="#212121"/>'
    + '<ellipse cx="18" cy="88" rx="8" ry="6" fill="#1a1a1a"/>'
    + '<ellipse cx="82" cy="88" rx="8" ry="6" fill="#1a1a1a"/>'
    // ── Halsabdeckung ─────────────────────────────────────────────────
    + '<rect x="36" y="51" width="28" height="9" rx="4" fill="#212121"/>'
    // ── Kopf ───────────────────────────────────────────────────────────
    + '<circle cx="50" cy="33" r="21" fill="#212121"/>'
    // ── Stirnband (rot mit Knoten rechts) ─────────────────────────────
    + '<rect x="29" y="26" width="42" height="9" rx="4" fill="#b71c1c"/>'
    + '<ellipse cx="75" cy="28" rx="8" ry="5" fill="#c62828" transform="rotate(-12 75 28)"/>'
    + '<rect x="72" y="27" width="5" height="18" rx="3" fill="#b71c1c" transform="rotate(-8 72 27)"/>'
    // Stirnband-Symbol
    + '<circle cx="50" cy="30" r="5" fill="#c62828"/>'
    + '<text x="50" y="34.5" text-anchor="middle" font-size="7" fill="white" font-weight="bold" font-family="serif">&#24503;</text>'
    // ── Gesichtsmaske ─────────────────────────────────────────────────
    + '<rect x="29" y="35" width="42" height="18" rx="5" fill="#212121"/>'
    + '<line x1="32" y1="39" x2="68" y2="39" stroke="#1a1a1a" stroke-width="2" opacity=".6"/>'
    + '<line x1="32" y1="44" x2="68" y2="44" stroke="#1a1a1a" stroke-width="2" opacity=".6"/>'
    // ── Augen (rot leuchtend) ─────────────────────────────────────────
    + '<ellipse cx="40" cy="40" rx="7.5" ry="5" fill="#1a1a1a"/>'
    + '<ellipse cx="60" cy="40" rx="7.5" ry="5" fill="#1a1a1a"/>'
    + '<ellipse cx="40" cy="40" rx="5" ry="3.5" fill="#b71c1c"/>'
    + '<ellipse cx="60" cy="40" rx="5" ry="3.5" fill="#b71c1c"/>'
    + '<ellipse cx="40" cy="40" rx="2.8" ry="2.2" fill="#e53935"/>'
    + '<ellipse cx="60" cy="40" rx="2.8" ry="2.2" fill="#e53935"/>'
    + '<circle cx="41" cy="39.2" r="1" fill="white" opacity=".5"/>'
    + '<circle cx="61" cy="39.2" r="1" fill="white" opacity=".5"/>'
    // Augen-Leuchtring
    + '<ellipse cx="40" cy="40" rx="7" ry="5" fill="none" stroke="#e53935" stroke-width="1" opacity=".4"/>'
    + '<ellipse cx="60" cy="40" rx="7" ry="5" fill="none" stroke="#e53935" stroke-width="1" opacity=".4"/>'
    + '</svg>';
}

function getEnemySVG(level) {
  // ── Level 1: Baby-Blob ─────────────────────────────────────────────────────
  if (level === 1) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<ellipse cx="50" cy="73" rx="30" ry="28" fill="#ff8fab"/>'
    + '<ellipse cx="50" cy="71" rx="26" ry="24" fill="#ffb3c6"/>'
    + '<path d="M23 70 Q16 63 20 54" stroke="#ff8fab" stroke-width="6" fill="none" stroke-linecap="round"/>'
    + '<path d="M77 70 Q84 63 80 54" stroke="#ff8fab" stroke-width="6" fill="none" stroke-linecap="round"/>'
    + '<circle cx="38" cy="67" r="10" fill="white"/>'
    + '<circle cx="62" cy="67" r="10" fill="white"/>'
    + '<circle cx="39" cy="68" r="6" fill="#6c63ff"/>'
    + '<circle cx="63" cy="68" r="6" fill="#6c63ff"/>'
    + '<circle cx="40.5" cy="66.5" r="2.2" fill="white"/>'
    + '<circle cx="64.5" cy="66.5" r="2.2" fill="white"/>'
    + '<ellipse cx="30" cy="75" rx="5.5" ry="3.5" fill="#ff4d7d" opacity="0.45"/>'
    + '<ellipse cx="70" cy="75" rx="5.5" ry="3.5" fill="#ff4d7d" opacity="0.45"/>'
    + '<path d="M40 81 Q50 91 60 81" stroke="#c0306a" fill="none" stroke-width="2.5" stroke-linecap="round"/>'
    + '<text x="44" y="78" font-size="11" fill="#c0306a" opacity="0.35" font-weight="bold">+</text>'
    + '<text x="14" y="56" font-size="15" fill="#ffb3c6">⭐</text>'
    + '<text x="71" y="52" font-size="13" fill="#ffb3c6">✨</text>'
    + '</svg>';

  // ── Level 2: Schleim ──────────────────────────────────────────────────────
  if (level === 2) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M14 78 Q9 54 18 44 Q28 28 50 26 Q72 28 82 44 Q91 54 86 78 Q81 100 65 108 Q50 114 35 108 Q19 100 14 78Z" fill="#66bb6a"/>'
    + '<path d="M19 76 Q15 56 23 47 Q33 33 50 31 Q67 33 77 47 Q85 56 81 76 Q76 95 62 104 Q50 109 38 104 Q24 95 19 76Z" fill="#81c784"/>'
    + '<circle cx="22" cy="52" r="5" fill="#a5d6a7" opacity="0.6"/>'
    + '<circle cx="78" cy="60" r="3.5" fill="#a5d6a7" opacity="0.6"/>'
    + '<circle cx="30" cy="40" r="3" fill="#a5d6a7" opacity="0.5"/>'
    + '<ellipse cx="38" cy="62" rx="11" ry="12" fill="#fff"/>'
    + '<ellipse cx="62" cy="62" rx="11" ry="12" fill="#fff"/>'
    + '<circle cx="39" cy="63" r="6" fill="#2e7d32"/>'
    + '<circle cx="63" cy="63" r="6" fill="#2e7d32"/>'
    + '<circle cx="40" cy="61" r="2.5" fill="#fff"/>'
    + '<circle cx="64" cy="61" r="2.5" fill="#fff"/>'
    + '<circle cx="37" cy="65" r="2" fill="#1a1a1a"/>'
    + '<circle cx="61" cy="65" r="2" fill="#1a1a1a"/>'
    + '<path d="M40 78 Q50 86 60 78" stroke="#2e7d32" fill="none" stroke-width="2.5"/>'
    + '<text x="24" y="96" font-size="13" fill="#2e7d32" font-weight="bold" opacity="0.65">+</text>'
    + '<text x="63" y="94" font-size="13" fill="#2e7d32" font-weight="bold" opacity="0.65">&#x2212;</text>'
    + '<text x="43" y="108" font-size="10" fill="#2e7d32" opacity="0.6">=?</text>'
    + '</svg>';

  // ── Level 3: Mini-Imp ─────────────────────────────────────────────────────
  if (level === 3) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<rect x="33" y="96" width="13" height="22" rx="5" fill="#e53935"/>'
    + '<rect x="54" y="96" width="13" height="22" rx="5" fill="#e53935"/>'
    + '<ellipse cx="50" cy="82" rx="22" ry="26" fill="#e53935"/>'
    + '<ellipse cx="50" cy="80" rx="18" ry="22" fill="#ef9a9a"/>'
    + '<path d="M28 80 Q15 74 18 62" stroke="#e53935" stroke-width="7" fill="none" stroke-linecap="round"/>'
    + '<path d="M72 80 Q85 74 82 62" stroke="#e53935" stroke-width="7" fill="none" stroke-linecap="round"/>'
    + '<path d="M29 74 Q12 58 18 40 Q25 54 30 70Z" fill="#b71c1c" opacity="0.85"/>'
    + '<path d="M71 74 Q88 58 82 40 Q75 54 70 70Z" fill="#b71c1c" opacity="0.85"/>'
    + '<ellipse cx="50" cy="48" rx="22" ry="20" fill="#e53935"/>'
    + '<path d="M36 32 Q29 14 36 8 Q42 22 40 32Z" fill="#b71c1c"/>'
    + '<path d="M64 32 Q71 14 64 8 Q58 22 60 32Z" fill="#b71c1c"/>'
    + '<ellipse cx="41" cy="48" rx="8" ry="8.5" fill="#ffd600"/>'
    + '<ellipse cx="59" cy="48" rx="8" ry="8.5" fill="#ffd600"/>'
    + '<ellipse cx="41" cy="49" rx="4.5" ry="5" fill="#1a1a1a"/>'
    + '<ellipse cx="59" cy="49" rx="4.5" ry="5" fill="#1a1a1a"/>'
    + '<circle cx="42.5" cy="47.5" r="1.5" fill="white"/>'
    + '<circle cx="60.5" cy="47.5" r="1.5" fill="white"/>'
    + '<ellipse cx="50" cy="58" rx="4" ry="3" fill="#c62828"/>'
    + '<path d="M39 63 Q50 72 61 63" stroke="#b71c1c" fill="#ef9a9a" stroke-width="1.5"/>'
    + '<rect x="44" y="63" width="4" height="5" rx="1" fill="white"/>'
    + '<rect x="52" y="63" width="4" height="5" rx="1" fill="white"/>'
    + '<path d="M50 116 Q63 112 67 106 Q58 105 57 116" stroke="#c62828" stroke-width="4" fill="none" stroke-linecap="round"/>'
    + '<text x="43" y="81" font-size="10" fill="#b71c1c" opacity="0.4" font-weight="bold">×</text>'
    + '</svg>';

  // ── Level 4: Kobold ──────────────────────────────────────────────────────
  if (level === 4) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<rect x="34" y="90" width="13" height="22" rx="4" fill="#558b2f"/>'
    + '<rect x="53" y="90" width="13" height="22" rx="4" fill="#558b2f"/>'
    + '<ellipse cx="40" cy="114" rx="10" ry="5" fill="#33691e"/>'
    + '<ellipse cx="60" cy="114" rx="10" ry="5" fill="#33691e"/>'
    + '<rect x="27" y="57" width="46" height="36" rx="9" fill="#558b2f"/>'
    + '<rect x="31" y="59" width="38" height="28" rx="7" fill="#795548"/>'
    + '<rect x="27" y="84" width="46" height="7" rx="3" fill="#4e342e"/>'
    + '<rect x="11" y="56" width="16" height="28" rx="6" fill="#558b2f"/>'
    + '<path d="M3 62 L18 58 L18 81 Q18 92 10 95 Q2 92 2 81Z" fill="#795548" stroke="#4e342e" stroke-width="2"/>'
    + '<rect x="5" y="66" width="11" height="16" rx="1" fill="#5d4037"/>'
    + '<text x="10" y="76" text-anchor="middle" font-size="5" fill="#ffd600" font-weight="bold">8&#xD7;4</text>'
    + '<text x="10" y="82" text-anchor="middle" font-size="5" fill="#ffd600">=?</text>'
    + '<rect x="73" y="52" width="16" height="28" rx="6" fill="#558b2f"/>'
    + '<rect x="81" y="33" width="11" height="32" rx="4" fill="#4e342e"/>'
    + '<ellipse cx="86" cy="34" rx="11" ry="10" fill="#6d4c41"/>'
    + '<circle cx="80" cy="30" r="3.5" fill="#4e342e"/>'
    + '<circle cx="87" cy="28" r="3.5" fill="#4e342e"/>'
    + '<circle cx="93" cy="30" r="3.5" fill="#4e342e"/>'
    + '<ellipse cx="50" cy="51" rx="13" ry="9" fill="#558b2f"/>'
    + '<ellipse cx="50" cy="33" rx="24" ry="21" fill="#7cb342"/>'
    + '<polygon points="27,29 13,20 30,36" fill="#7cb342"/>'
    + '<polygon points="73,29 87,20 70,36" fill="#7cb342"/>'
    + '<polygon points="28,27 16,22 29,35" fill="#558b2f"/>'
    + '<polygon points="72,27 84,22 71,35" fill="#558b2f"/>'
    + '<path d="M33 23 Q41 19 45 23" stroke="#33691e" stroke-width="3.5" fill="none"/>'
    + '<path d="M55 23 Q59 19 67 23" stroke="#33691e" stroke-width="3.5" fill="none"/>'
    + '<ellipse cx="40" cy="31" rx="8" ry="7" fill="#f9a825"/>'
    + '<ellipse cx="60" cy="31" rx="8" ry="7" fill="#f9a825"/>'
    + '<circle cx="41" cy="32" r="4" fill="#1a1a1a"/>'
    + '<circle cx="61" cy="32" r="4" fill="#1a1a1a"/>'
    + '<circle cx="42" cy="30.5" r="1.3" fill="#fff"/>'
    + '<circle cx="62" cy="30.5" r="1.3" fill="#fff"/>'
    + '<ellipse cx="50" cy="40" rx="5" ry="4" fill="#558b2f"/>'
    + '<circle cx="47" cy="41" r="1.8" fill="#33691e"/>'
    + '<circle cx="53" cy="41" r="1.8" fill="#33691e"/>'
    + '<path d="M38 46 Q50 53 62 46" stroke="#33691e" fill="none" stroke-width="2"/>'
    + '<rect x="44" y="46" width="4" height="5" rx="1" fill="#fff"/>'
    + '<rect x="52" y="46" width="4" height="5" rx="1" fill="#fff"/>'
    + '</svg>';

  // ── Level 5: Geist ───────────────────────────────────────────────────────
  if (level === 5) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M18 60 Q20 28 50 24 Q80 28 82 60 L82 110 Q74 100 66 110 Q58 100 50 110 Q42 100 34 110 Q26 100 18 110Z" fill="#b0bec5"/>'
    + '<path d="M22 62 Q24 34 50 30 Q76 34 78 62 L78 104 Q71 95 64 104 Q57 95 50 104 Q43 95 36 104 Q29 95 22 104Z" fill="#cfd8dc"/>'
    + '<ellipse cx="50" cy="62" rx="24" ry="22" fill="#29b6f6" opacity="0.11"/>'
    + '<ellipse cx="38" cy="60" rx="11" ry="13" fill="#263238"/>'
    + '<ellipse cx="62" cy="60" rx="11" ry="13" fill="#263238"/>'
    + '<ellipse cx="38" cy="60" rx="7" ry="9" fill="#26c6da" opacity="0.9"/>'
    + '<ellipse cx="62" cy="60" rx="7" ry="9" fill="#26c6da" opacity="0.9"/>'
    + '<circle cx="36" cy="57" r="2.5" fill="white" opacity="0.7"/>'
    + '<circle cx="60" cy="57" r="2.5" fill="white" opacity="0.7"/>'
    + '<path d="M38 78 Q44 83 50 78 Q56 83 62 78" stroke="#546e7a" fill="none" stroke-width="3" stroke-linecap="round"/>'
    + '<polygon points="42,78 44,85 46,78" fill="#546e7a"/>'
    + '<polygon points="50,78 52,85 54,78" fill="#546e7a"/>'
    + '<circle cx="10" cy="50" r="5" fill="#90caf9" opacity="0.5"/>'
    + '<circle cx="90" cy="42" r="3.5" fill="#90caf9" opacity="0.4"/>'
    + '<circle cx="8" cy="70" r="3" fill="#90caf9" opacity="0.35"/>'
    + '<text x="5" y="44" font-size="13" fill="#90caf9" opacity="0.6">×</text>'
    + '</svg>';

  // ── Level 6: Stein-Golem ─────────────────────────────────────────────────
  if (level === 6) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<rect x="27" y="92" width="19" height="24" rx="4" fill="#78909c"/>'
    + '<rect x="54" y="92" width="19" height="24" rx="4" fill="#78909c"/>'
    + '<path d="M31 96 Q33 104 30 110" stroke="#546e7a" stroke-width="1.5" fill="none"/>'
    + '<path d="M62 99 Q60 106 63 113" stroke="#546e7a" stroke-width="1.5" fill="none"/>'
    + '<rect x="16" y="52" width="68" height="44" rx="8" fill="#90a4ae"/>'
    + '<path d="M20 62 Q36 59 50 63 Q64 60 78 63" stroke="#78909c" stroke-width="1.5" fill="none"/>'
    + '<path d="M18 73 Q32 71 50 75 Q68 71 80 74" stroke="#78909c" stroke-width="1.5" fill="none"/>'
    + '<path d="M22 86 Q38 88 50 84 Q64 87 78 84" stroke="#78909c" stroke-width="1.5" fill="none"/>'
    + '<circle cx="50" cy="72" r="15" fill="none" stroke="#29b6f6" stroke-width="1.5" opacity="0.45"/>'
    + '<text x="50" y="79" text-anchor="middle" font-size="22" fill="#29b6f6" font-weight="bold" opacity="0.85">&#x3A3;</text>'
    + '<rect x="74" y="59" width="24" height="19" rx="2" fill="#78909c" stroke="#546e7a" stroke-width="1.5"/>'
    + '<text x="86" y="67" text-anchor="middle" font-size="5" fill="#29b6f6" font-weight="bold">15&#x2212;x</text>'
    + '<text x="86" y="73" text-anchor="middle" font-size="5" fill="#29b6f6">=6</text>'
    + '<rect x="3" y="52" width="14" height="34" rx="5" fill="#90a4ae"/>'
    + '<rect x="83" y="52" width="14" height="34" rx="5" fill="#90a4ae"/>'
    + '<circle cx="16" cy="54" r="9" fill="#90a4ae"/>'
    + '<circle cx="84" cy="54" r="9" fill="#90a4ae"/>'
    + '<rect x="35" y="44" width="30" height="12" rx="6" fill="#90a4ae"/>'
    + '<rect x="23" y="20" width="54" height="30" rx="8" fill="#90a4ae"/>'
    + '<path d="M29 24 Q32 33 28 40" stroke="#78909c" stroke-width="1.5" fill="none"/>'
    + '<path d="M66 22 Q63 31 67 37" stroke="#78909c" stroke-width="1.5" fill="none"/>'
    + '<path d="M46 20 Q48 27 45 31" stroke="#78909c" stroke-width="1.5" fill="none"/>'
    + '<ellipse cx="37" cy="33" rx="10" ry="8" fill="#002171"/>'
    + '<ellipse cx="63" cy="33" rx="10" ry="8" fill="#002171"/>'
    + '<ellipse cx="37" cy="33" rx="7" ry="5" fill="#29b6f6"/>'
    + '<ellipse cx="63" cy="33" rx="7" ry="5" fill="#29b6f6"/>'
    + '<ellipse cx="37" cy="33" rx="3.5" ry="2.5" fill="#80d8ff"/>'
    + '<ellipse cx="63" cy="33" rx="3.5" ry="2.5" fill="#80d8ff"/>'
    + '<text x="50" y="27" text-anchor="middle" font-size="11" fill="#29b6f6" opacity="0.75">5</text>'
    + '<path d="M34 44 Q50 47 66 44" stroke="#546e7a" stroke-width="2.5" fill="none"/>'
    + '</svg>';

  // ── Level 7: Knochen-Ritter ──────────────────────────────────────────────
  if (level === 7) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<rect x="30" y="90" width="14" height="30" rx="5" fill="#e0e0e0"/>'
    + '<rect x="56" y="90" width="14" height="30" rx="5" fill="#e0e0e0"/>'
    + '<ellipse cx="37" cy="91" rx="9" ry="5.5" fill="#bdbdbd"/>'
    + '<ellipse cx="63" cy="91" rx="9" ry="5.5" fill="#bdbdbd"/>'
    + '<rect x="24" y="50" width="52" height="44" rx="9" fill="#bdbdbd"/>'
    + '<rect x="28" y="54" width="44" height="36" rx="7" fill="#e0e0e0"/>'
    + '<path d="M32 62 Q50 59 68 62" stroke="#bdbdbd" stroke-width="2" fill="none"/>'
    + '<path d="M30 70 Q50 67 70 70" stroke="#bdbdbd" stroke-width="2" fill="none"/>'
    + '<path d="M32 78 Q50 75 68 78" stroke="#bdbdbd" stroke-width="2" fill="none"/>'
    + '<ellipse cx="50" cy="63" rx="7" ry="5" fill="#9e9e9e" opacity="0.4"/>'
    + '<rect x="7" y="50" width="17" height="40" rx="7" fill="#bdbdbd"/>'
    + '<rect x="76" y="50" width="17" height="40" rx="7" fill="#bdbdbd"/>'
    + '<circle cx="15" cy="52" r="10" fill="#9e9e9e"/>'
    + '<circle cx="85" cy="52" r="10" fill="#9e9e9e"/>'
    + '<rect x="2" y="20" width="7" height="46" rx="3" fill="#78909c"/>'
    + '<rect x="-2" y="34" width="15" height="5" rx="2" fill="#546e7a"/>'
    + '<polygon points="2,20 5.5,8 9,20" fill="#90a4ae"/>'
    + '<ellipse cx="50" cy="32" rx="23" ry="21" fill="#e0e0e0"/>'
    + '<ellipse cx="50" cy="39" rx="16" ry="10" fill="#bdbdbd"/>'
    + '<ellipse cx="39" cy="29" rx="9" ry="10" fill="#212121"/>'
    + '<ellipse cx="61" cy="29" rx="9" ry="10" fill="#212121"/>'
    + '<ellipse cx="39" cy="30" rx="6" ry="7" fill="#e53935" opacity="0.85"/>'
    + '<ellipse cx="61" cy="30" rx="6" ry="7" fill="#e53935" opacity="0.85"/>'
    + '<circle cx="39" cy="28" r="1.8" fill="white" opacity="0.55"/>'
    + '<circle cx="61" cy="28" r="1.8" fill="white" opacity="0.55"/>'
    + '<ellipse cx="50" cy="39" rx="3.5" ry="4.5" fill="#212121"/>'
    + '<rect x="40" y="45" width="5" height="7" rx="1.5" fill="white"/>'
    + '<rect x="47" y="45" width="5" height="7" rx="1.5" fill="white"/>'
    + '<rect x="54" y="45" width="5" height="7" rx="1.5" fill="white"/>'
    + '<text x="78" y="36" font-size="13" fill="#e53935" opacity="0.75" font-weight="bold">!</text>'
    + '</svg>';

  // ── Level 8: Feuer-Drache ────────────────────────────────────────────────
  if (level === 8) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M72 88 Q94 78 96 62 Q92 73 82 80 Q88 68 84 58 Q78 70 80 83 Q74 76 72 88Z" fill="#c62828"/>'
    + '<ellipse cx="52" cy="80" rx="31" ry="26" fill="#c62828"/>'
    + '<ellipse cx="52" cy="83" rx="19" ry="17" fill="#e57373"/>'
    + '<path d="M35 75 Q42 71 49 75 Q42 79 35 75Z" fill="#b71c1c"/>'
    + '<path d="M52 70 Q59 66 66 70 Q59 74 52 70Z" fill="#b71c1c"/>'
    + '<path d="M44 86 Q51 82 57 86 Q51 90 44 86Z" fill="#b71c1c"/>'
    + '<path d="M27 62 Q4 38 7 18 Q14 33 19 26 Q17 41 25 37 Q21 51 30 50 Q25 57 27 62Z" fill="#b71c1c"/>'
    + '<path d="M27 62 Q9 47 11 26 Q15 37 19 26 Q17 41 25 37 Q21 51 30 50 Q25 57 27 62Z" fill="#c62828" opacity="0.45"/>'
    + '<line x1="27" y1="62" x2="7" y2="18" stroke="#b71c1c" stroke-width="1"/>'
    + '<line x1="27" y1="62" x2="19" y2="26" stroke="#b71c1c" stroke-width="1"/>'
    + '<line x1="27" y1="62" x2="25" y2="37" stroke="#b71c1c" stroke-width="1"/>'
    + '<path d="M30 60 Q32 42 40 36 Q48 53 35 63Z" fill="#c62828"/>'
    + '<ellipse cx="38" cy="33" rx="21" ry="16" fill="#c62828"/>'
    + '<path d="M17 36 Q12 29 17 27 Q27 33 30 37Z" fill="#e53935"/>'
    + '<ellipse cx="19" cy="30" rx="2.5" ry="1.8" fill="#b71c1c"/>'
    + '<ellipse cx="25" cy="29" rx="2.5" ry="1.8" fill="#b71c1c"/>'
    + '<path d="M44 19 Q46 7 50 5 Q48 13 46 21Z" fill="#8d6e63"/>'
    + '<path d="M53 17 Q57 6 60 4 Q57 12 55 19Z" fill="#8d6e63"/>'
    + '<ellipse cx="31" cy="30" rx="7" ry="5.5" fill="#f9a825"/>'
    + '<ellipse cx="46" cy="27" rx="7" ry="5.5" fill="#f9a825"/>'
    + '<ellipse cx="31" cy="30" rx="4" ry="3" fill="#f44336"/>'
    + '<ellipse cx="46" cy="27" rx="4" ry="3" fill="#f44336"/>'
    + '<rect x="30" y="27" width="2.5" height="7" rx="1.2" fill="#1a1a1a"/>'
    + '<rect x="45" y="24" width="2.5" height="7" rx="1.2" fill="#1a1a1a"/>'
    + '<polygon points="21,36 23,44 26,36" fill="#fff"/>'
    + '<polygon points="26,37 28,44 31,37" fill="#fff"/>'
    + '<polygon points="31,38 33,44 36,38" fill="#fff"/>'
    + '<path d="M13 35 Q5 28 5 18 Q9 26 11 22 Q9 30 13 28 Q11 34 15 32 Q13 37 13 35Z" fill="#ff8f00"/>'
    + '<path d="M13 35 Q6 29 7 20 Q10 27 12 22 Q10 30 13 28 Q12 34 13 35Z" fill="#ffd600" opacity="0.75"/>'
    + '<ellipse cx="38" cy="97" rx="13" ry="8" fill="#c62828"/>'
    + '<ellipse cx="63" cy="97" rx="13" ry="8" fill="#c62828"/>'
    + '<path d="M29 104 Q25 112 22 116" stroke="#8d6e63" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<path d="M34 106 Q31 113 29 118" stroke="#8d6e63" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<path d="M39 107 Q39 115 38 119" stroke="#8d6e63" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<text x="52" y="90" text-anchor="middle" font-size="9" fill="#ffd600" opacity="0.65">7x</text>'
    + '</svg>';

  // ── Level 9: Schatten-Phantom ────────────────────────────────────────────
  if (level === 9) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<defs>'
    + '<radialGradient id="pg" cx="50%" cy="45%" r="50%"><stop offset="0%" stop-color="#4a0072"/><stop offset="100%" stop-color="#0d0015"/></radialGradient>'
    + '</defs>'
    + '<ellipse cx="50" cy="68" rx="38" ry="46" fill="url(#pg)" opacity="0.92"/>'
    + '<path d="M12 114 Q18 95 14 80 Q22 98 20 112Z" fill="#0d0015" opacity="0.8"/>'
    + '<path d="M88 114 Q82 95 86 80 Q78 98 80 112Z" fill="#0d0015" opacity="0.8"/>'
    + '<path d="M50 114 Q36 100 30 86 Q40 99 38 112Z" fill="#1a0033" opacity="0.7"/>'
    + '<path d="M50 114 Q64 100 70 86 Q60 99 62 112Z" fill="#1a0033" opacity="0.7"/>'
    + '<ellipse cx="50" cy="60" rx="30" ry="36" fill="#1a0033"/>'
    + '<path d="M20 75 Q10 58 18 42 Q16 55 22 52 Q18 63 26 60 Q22 70 20 75Z" fill="#4a0072" opacity="0.65"/>'
    + '<path d="M80 75 Q90 58 82 42 Q84 55 78 52 Q82 63 74 60 Q78 70 80 75Z" fill="#4a0072" opacity="0.65"/>'
    + '<ellipse cx="38" cy="52" rx="10" ry="8" fill="#1a0033"/>'
    + '<ellipse cx="62" cy="52" rx="10" ry="8" fill="#1a0033"/>'
    + '<ellipse cx="38" cy="52" rx="6.5" ry="5.5" fill="#9c27b0"/>'
    + '<ellipse cx="62" cy="52" rx="6.5" ry="5.5" fill="#9c27b0"/>'
    + '<ellipse cx="38" cy="52" rx="3.5" ry="4" fill="#e040fb"/>'
    + '<ellipse cx="62" cy="52" rx="3.5" ry="4" fill="#e040fb"/>'
    + '<circle cx="38" cy="51" r="1.5" fill="white" opacity="0.7"/>'
    + '<circle cx="62" cy="51" r="1.5" fill="white" opacity="0.7"/>'
    + '<path d="M40 66 Q50 62 60 66" stroke="#4a0072" fill="none" stroke-width="2.5" stroke-linecap="round"/>'
    + '<line x1="42" y1="66" x2="42" y2="71" stroke="#6a1b9a" stroke-width="1.5"/>'
    + '<line x1="47" y1="67" x2="47" y2="72" stroke="#6a1b9a" stroke-width="1.5"/>'
    + '<line x1="53" y1="67" x2="53" y2="72" stroke="#6a1b9a" stroke-width="1.5"/>'
    + '<line x1="58" y1="66" x2="58" y2="71" stroke="#6a1b9a" stroke-width="1.5"/>'
    + '<circle cx="8" cy="48" r="5" fill="#4a0072" opacity="0.55"/>'
    + '<circle cx="92" cy="48" r="5" fill="#4a0072" opacity="0.55"/>'
    + '<circle cx="4" cy="62" r="3" fill="#7b1fa2" opacity="0.4"/>'
    + '<circle cx="96" cy="62" r="3" fill="#7b1fa2" opacity="0.4"/>'
    + '<circle cx="12" cy="38" r="2" fill="#e040fb" opacity="0.35"/>'
    + '<circle cx="88" cy="38" r="2" fill="#e040fb" opacity="0.35"/>'
    + '<text x="50" y="78" text-anchor="middle" font-size="10" fill="#e040fb" opacity="0.5" font-weight="bold">???</text>'
    + '</svg>';

  // ── Level 10: Mathe-Zauberer Boss ────────────────────────────────────────
  return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M13 46 Q5 35 9 24 Q13 34 17 31 Q13 41 19 39 Q15 47 21 45 Q17 53 13 52Z" fill="#7b1fa2" opacity="0.7"/>'
    + '<path d="M15 50 Q7 39 11 27 Q15 37 18 33 Q14 43 20 41 Q16 49 15 52Z" fill="#e040fb" opacity="0.45"/>'
    + '<path d="M87 46 Q95 35 91 24 Q87 34 83 31 Q87 41 81 39 Q85 47 79 45 Q83 53 87 52Z" fill="#7b1fa2" opacity="0.7"/>'
    + '<path d="M85 50 Q93 39 89 27 Q85 37 82 33 Q86 43 80 41 Q84 49 85 52Z" fill="#e040fb" opacity="0.45"/>'
    + '<path d="M24 61 Q16 120 50 122 Q84 120 76 61Z" fill="#1a0033"/>'
    + '<ellipse cx="50" cy="63" rx="28" ry="13" fill="#2a004a"/>'
    + '<path d="M37 70 Q39 102 41 122" stroke="#4a0072" stroke-width="1" fill="none"/>'
    + '<path d="M63 70 Q61 102 59 122" stroke="#4a0072" stroke-width="1" fill="none"/>'
    + '<path d="M25 63 Q50 74 75 63" stroke="#ffd600" stroke-width="2" fill="none"/>'
    + '<path d="M27 68 Q50 78 73 68" stroke="#ffd600" stroke-width="1" fill="none"/>'
    + '<line x1="19" y1="50" x2="23" y2="114" stroke="#4a148c" stroke-width="5" stroke-linecap="round"/>'
    + '<circle cx="19" cy="45" r="11" fill="#1a0033"/>'
    + '<circle cx="19" cy="45" r="9" fill="#7b1fa2"/>'
    + '<text x="19" y="50" text-anchor="middle" font-size="13" fill="#ffd600" font-weight="bold">&#x3A3;</text>'
    + '<circle cx="19" cy="45" r="11" fill="none" stroke="#e040fb" stroke-width="1.5" opacity="0.6"/>'
    + '<path d="M25 65 Q20 57 19 48" stroke="#2a004a" stroke-width="8" fill="none" stroke-linecap="round"/>'
    + '<path d="M75 65 Q82 57 84 48" stroke="#2a004a" stroke-width="8" fill="none" stroke-linecap="round"/>'
    + '<circle cx="84" cy="46" r="4" fill="#e040fb"/>'
    + '<circle cx="90" cy="41" r="2.5" fill="#e040fb" opacity="0.6"/>'
    + '<circle cx="88" cy="51" r="2" fill="#ffd600"/>'
    + '<rect x="72" y="70" width="22" height="16" rx="3" fill="#f5f5dc" stroke="#8d6e63" stroke-width="1"/>'
    + '<text x="83" y="79" text-anchor="middle" font-size="4.5" fill="#1a1a1a">4x&#xB2;+7</text>'
    + '<text x="83" y="84" text-anchor="middle" font-size="4.5" fill="#1a1a1a">=?</text>'
    + '<text x="87" y="49" font-size="9" fill="#9c27b0" opacity="0.75">&#x3C0;</text>'
    + '<text x="9" y="65" font-size="9" fill="#9c27b0" opacity="0.75">&#x221E;</text>'
    + '<text x="84" y="63" font-size="9" fill="#ffd600" opacity="0.65">x</text>'
    + '<path d="M27 39 Q27 10 50 8 Q73 10 73 39 Q73 51 50 53 Q27 51 27 39Z" fill="#1a0033"/>'
    + '<path d="M31 42 Q31 15 50 13 Q69 15 69 42 Q69 51 50 52 Q31 51 31 42Z" fill="#2a004a"/>'
    + '<ellipse cx="41" cy="38" rx="6" ry="5" fill="#7b1fa2"/>'
    + '<ellipse cx="59" cy="38" rx="6" ry="5" fill="#7b1fa2"/>'
    + '<ellipse cx="41" cy="38" rx="3.5" ry="3" fill="#e040fb"/>'
    + '<ellipse cx="59" cy="38" rx="3.5" ry="3" fill="#e040fb"/>'
    + '<path d="M43 47 Q50 43 57 47" stroke="#4a148c" fill="none" stroke-width="2"/>'
    + '<polygon points="44,47 46,51 48,47" fill="#fff"/>'
    + '<polygon points="52,47 54,51 56,47" fill="#fff"/>'
    + '</svg>';
}

// =====================================================================
// SCREEN / UI HELPERS
// =====================================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  var screen = $(id);
  if (screen) screen.classList.add('active');
  if (id === 'screen-menu') MatrixRain.start();
  else MatrixRain.stop();
}

function flash(color) {
  var f = document.createElement('div');
  f.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;background:' + color + ';animation:flashAnim .3s forwards;border-radius:28px;';
  document.body.appendChild(f);
  setTimeout(function() { f.remove(); }, 300);
}

// ---- Enemy HP Bar ----
function updateEnemyHP() {
  var bar = $('enemy-hp-bar');
  var txt = $('enemy-hp-text');
  if (!bar) return;
  var pct = Math.max(0, G.enemyHP) / G.enemyMaxHP * 100;
  bar.style.width = pct + '%';
  if (pct > 50) bar.style.background = '#2ecc71';
  else if (pct > 20) bar.style.background = '#f39c12';
  else bar.style.background = '#e74c3c';
  if (txt) txt.textContent = G.enemyHP + '/' + G.enemyMaxHP;
}

// ---- Attack Visual ----
function doAttackAnimation(isSuper) {
  var playerSprite = $('player-sprite');
  var enemySprite  = $('enemy-sprite');
  if (!playerSprite || !enemySprite) return;

  // Remove stale classes
  playerSprite.classList.remove('attack', 'super-attack');
  enemySprite.classList.remove('enemy-hurt', 'enemy-dead');

  if (isSuper) {
    SoundSystem.playSuperAttack();
    playerSprite.classList.add('super-attack');
    // projectile burst
    spawnProjectiles(true);
    setTimeout(function() {
      enemySprite.classList.add('enemy-dead');
      spawnDefeatStars();
    }, 350);
    setTimeout(function() {
      playerSprite.classList.remove('super-attack');
    }, 700);
  } else {
    SoundSystem.playAttack();
    playerSprite.classList.add('attack');
    spawnProjectiles(false);
    setTimeout(function() {
      enemySprite.classList.add('enemy-hurt');
    }, 150);
    setTimeout(function() {
      playerSprite.classList.remove('attack');
      enemySprite.classList.remove('enemy-hurt');
    }, 400);
  }
}

function spawnDefeatStars() {
  var arena = document.querySelector('.battle-arena');
  var enemyEl = document.getElementById('enemy-sprite');
  if (!arena || !enemyEl) return;
  var aRect = arena.getBoundingClientRect();
  var eRect = enemyEl.getBoundingClientRect();
  var cx = eRect.left - aRect.left + eRect.width / 2;
  var cy = eRect.top  - aRect.top  + eRect.height / 2;
  var icons = ['⭐','🌟','✨','💫','🎉','⭐','🌟','💥'];
  icons.forEach(function(icon, i) {
    var el = document.createElement('div');
    el.textContent = icon;
    var angle = (i / icons.length) * 360;
    var dist  = 65 + Math.random() * 45;
    var dx = Math.cos(angle * Math.PI / 180) * dist;
    var dy = Math.sin(angle * Math.PI / 180) * dist;
    el.style.cssText =
      'position:absolute;left:' + cx + 'px;top:' + cy + 'px;' +
      'font-size:1.8rem;z-index:30;pointer-events:none;' +
      '--dx:' + dx + 'px;--dy:' + dy + 'px;' +
      'animation:starPop 0.9s ' + (i * 0.055) + 's both ease-out;';
    arena.appendChild(el);
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 1100 + i * 60);
  });
}

function spawnProjectiles(isSuper) {
  var arena = document.querySelector('.battle-arena');
  if (!arena) return;
  var count = isSuper ? 8 : 3;
  for (var i = 0; i < count; i++) {
    (function(idx) {
      setTimeout(function() {
        var p = document.createElement('div');
        p.className = 'projectile' + (isSuper ? ' projectile-super' : '');
        p.textContent = isSuper ? '✨' : '⚡';
        p.style.cssText = 'position:absolute;left:25%;top:' + (30 + rnd(-15, 15)) + '%;font-size:' + (isSuper ? 1.8 : 1.2) + 'rem;animation:projectileFly .4s forwards;z-index:20;pointer-events:none;';
        arena.appendChild(p);
        setTimeout(function() { p.remove(); }, 500);
      }, idx * (isSuper ? 60 : 40));
    })(i);
  }
}

// =====================================================================
// TASK GENERATION
// =====================================================================
function genOne(level) {
  // Klare Schwierigkeitsprogression je Level:
  // L1  Einfache Addition          (1–10 + 1–10)
  // L2  Einfache Subtraktion       (bis 15, Ergebnis ≥ 1)
  // L3  Gemischt + und -           (bis 20)
  // L4  Schwerere Addition         (10–40 + 10–40)
  // L5  Schwerere Subtraktion      (15–50)
  // L6  Einfache Multiplikation    (×2 bis ×5)
  // L7  Einfache Division          (÷2 bis ÷5, ganzzahlig)
  // L8  Gemischt × und ÷           (Tabellen bis 10)
  // L9  Alles gemischt, leicht-mittel (Ergebnis bis ~50)
  // L10 Alles gemischt, schwer     (Ergebnis bis 100)

  var op, a, b, ans;

  if (level === 1) {
    op = '+'; a = rnd(1, 10); b = rnd(1, 10); ans = a + b;

  } else if (level === 2) {
    op = '-'; a = rnd(2, 15); b = rnd(1, a - 1); ans = a - b;

  } else if (level === 3) {
    op = rnd(0, 1) ? '+' : '-';
    if (op === '+') { a = rnd(1, 12); b = rnd(1, 12); ans = a + b; }
    else            { a = rnd(3, 20); b = rnd(1, a - 1); ans = a - b; }

  } else if (level === 4) {
    op = '+'; a = rnd(10, 40); b = rnd(10, 40); ans = a + b;

  } else if (level === 5) {
    op = '-'; a = rnd(15, 50); b = rnd(5, a - 1); ans = a - b;

  } else if (level === 6) {
    op = '×';
    a = rnd(2, 9); b = rnd(2, 5);
    if (rnd(0, 1)) { var t = a; a = b; b = t; }  // Reihenfolge variieren
    ans = a * b;

  } else if (level === 7) {
    op = '÷'; b = rnd(2, 5); ans = rnd(2, 9); a = ans * b;

  } else if (level === 8) {
    op = rnd(0, 1) ? '×' : '÷';
    if (op === '×') { a = rnd(2, 10); b = rnd(2, 10); ans = a * b; }
    else            { b = rnd(2, 10); ans = rnd(2, 10); a = ans * b; }

  } else if (level === 9) {
    var op9 = ['+', '-', '×', '÷'][rnd(0, 3)]; op = op9;
    if      (op === '+') { a = rnd(1,  25); b = rnd(1, 25);              ans = a + b; }
    else if (op === '-') { a = rnd(5,  45); b = rnd(1, Math.min(a-1,30)); ans = a - b; }
    else if (op === '×') { a = rnd(2,  7);  b = rnd(2, 7);               ans = a * b; }
    else                 { b = rnd(2,  7);  ans = rnd(2, 7); a = ans * b; }

  } else {
    // Level 10 — alles gemischt, Ergebnis max. 100
    var op10 = ['+', '-', '×', '÷'][rnd(0, 3)]; op = op10;
    if      (op === '+') { a = rnd(10, 60); b = rnd(10, Math.min(60, 100 - a)); ans = a + b; }
    else if (op === '-') { a = rnd(20, 100); b = rnd(1, a - 1); ans = a - b; }
    else if (op === '×') { a = rnd(3, 10);  b = rnd(3, Math.floor(100 / a)); ans = a * b; }
    else                 { b = rnd(2, 10);  ans = rnd(2, 10); a = ans * b; }
  }

  return { text: a + ' ' + op + ' ' + b + ' = ?', answer: ans, op: op };
}

function _genTraining(level) {
  // Trainings-Aufgaben: mittelschwer, klar nach Rechentyp getrennt
  // L1: Addition   — 1-stellig + 2-stellig
  // L2: Subtraktion — Minuend 15–50, Subtrahend 5 bis Minuend−1
  // L3: Multiplikation — beide Faktoren 1–10
  // L4: Division   — Divisor 2–10, ganzzahliges Ergebnis 2–10
  // L5: Gemischt   — alle vier Typen zufällig
  var op, a, b, ans;
  var type = level;
  if (level === 5) type = [1, 2, 3, 4][rnd(0, 3)];

  if (type === 1) {
    op = '+';
    var s = rnd(1, 9), l = rnd(10, 99);
    a = rnd(0, 1) ? s : l;  b = (a === s) ? l : s;
    ans = s + l;
  } else if (type === 2) {
    op = '-'; a = rnd(15, 50); b = rnd(5, a - 1); ans = a - b;
  } else if (type === 3) {
    op = '×'; a = rnd(1, 10); b = rnd(1, 10);
    if (rnd(0, 1)) { var t = a; a = b; b = t; }
    ans = a * b;
  } else {
    op = '÷'; b = rnd(2, 10); ans = rnd(2, 10); a = ans * b;
  }
  return { text: a + ' ' + op + ' ' + b + ' = ?', answer: ans, op: op };
}

function generateTasks() {
  G.tasks = [];
  if (G.trainingMode) {
    for (var i = 0; i < 5; i++) G.tasks.push(_genTraining(G.level));
  } else {
    for (var i = 0; i < 5; i++) G.tasks.push(genOne(G.level));
  }
}

// =====================================================================
// HUD
// =====================================================================
function updateHUD() {
  var lvl = $('hud-level'), scr = $('hud-score'), tsk = $('hud-task');
  if (lvl) lvl.textContent = G.level;
  if (scr) scr.textContent = G.trainingMode ? '–' : G.score;
  if (tsk) tsk.textContent = Math.min(G.taskIdx + 1, 5) + '/5';
  var maxLvEl = $('hud-max-level');
  if (maxLvEl) maxLvEl.textContent = G.trainingMode ? '/5' : G.demoMode ? '/3' : '/10';
  if (G.demoMode) {
    var lvEl = $('hud-level');
    if (lvEl) lvEl.textContent = G.demoIdx + 1;
  }

  var heartsDiv = $('hud-hearts');
  if (heartsDiv) {
    if (G.trainingMode) {
      heartsDiv.innerHTML = '<span class="training-badge">📚 Training</span>';
    } else {
      var h = '';
      for (var i = 0; i < G.maxLives; i++) {
        h += '<span class="heart ' + (i < G.lives ? 'full' : 'lost') + '">' + (i < G.lives ? '❤️' : '🖤') + '</span>';
      }
      heartsDiv.innerHTML = h;
    }
  }
}

function updateTimeBar(percent) {
  var fill = $('time-fill'), text = $('time-text');
  if (fill) {
    fill.style.width = (percent * 100) + '%';
    fill.style.background = percent > 0.5 ? '#2ecc71' : percent > 0.25 ? '#f39c12' : '#e74c3c';
  }
  if (text) text.textContent = Math.ceil(G.timeLeft) + 's';
}

// =====================================================================
// TIMER
// =====================================================================
function startTimer() {
  clearInterval(G.timer);
  // Start music only when the level changes — keeps melody running continuously
  if (G.level !== G._musicLevel) {
    G._musicLevel = G.level;
    SoundSystem.startLevelMusic(G.level);
  }

  // Gegner-Position zurücksetzen und Distanz zum Spieler neu messen
  _resetEnemyPosition();
  // Kurz warten bis Reset-Transition durch ist, dann messen
  setTimeout(function() { G._enemyMaxShift = _calcEnemyShift(); }, 350);

  if (G.trainingMode) {
    var fill = $('time-fill'), txt = $('time-text');
    if (fill) { fill.style.width = '100%'; fill.style.background = '#4CAF50'; }
    if (txt)  txt.textContent = '∞';
    return;
  }
  G.totalTime = Math.max(13, 23 - G.level) + G.extraTime + G.bonusTimeAll;
  G.extraTime = 0;   // einmalig verbraucht
  G.timeLeft = G.totalTime;
  SoundSystem.lastWarningTime = 0;
  updatePowerUpHUD();
  updateTimeBar(1);

  var TICK = 100;
  G.timer = setInterval(function() {
    G.timeLeft -= TICK / 1000;
    var p = G.timeLeft / G.totalTime;
    var pct = p * 100;
    updateTimeBar(p);

    // Gegner bewegt sich auf den Spieler zu (nur Normal-Modus)
    _updateEnemyAdvance(p);

    if (pct <= 25 && pct > 12) {
      SoundSystem.setTempo(1.4);
      if (Date.now() - SoundSystem.lastWarningTime > 600) { SoundSystem.playTimeWarning(); SoundSystem.lastWarningTime = Date.now(); }
    } else if (pct <= 12) {
      SoundSystem.setTempo(1.8);
      if (Date.now() - SoundSystem.lastWarningTime > 350) { SoundSystem.playTimeWarning(); SoundSystem.lastWarningTime = Date.now(); }
    } else {
      SoundSystem.setTempo(1);
    }

    if (G.timeLeft <= 0) { clearInterval(G.timer); timeUp(); }
  }, TICK);
}

// Exakte Pixel-Distanz zwischen Gegner und Spieler messen (einmal pro Aufgabe)
function _calcEnemyShift() {
  var es = $('enemy-sprite');
  var ps = $('player-sprite');
  if (!es || !ps) return 180;
  var eRect = es.getBoundingClientRect();
  var pRect = ps.getBoundingClientRect();
  // Gegner soll den Spieler leicht überlappen (+ 30px)
  var dist = eRect.left - pRect.right + 30;
  return Math.max(dist, 80);
}

// Gegner-Position basierend auf verbleibender Zeit aktualisieren
function _updateEnemyAdvance(progress) {
  var es = $('enemy-sprite');
  if (!es) return;
  // progress = 1 (volle Zeit) → 0 (Zeit abgelaufen)
  var shift = (1 - progress) * (G._enemyMaxShift || 180);
  es.style.transform = 'translateX(-' + shift.toFixed(1) + 'px)';
}

// Gegner zurück auf Ausgangsposition
function _resetEnemyPosition() {
  var es = $('enemy-sprite');
  if (es) {
    es.style.transition = 'transform 0.3s ease';
    es.style.transform = 'translateX(0)';
    // Transition nach Reset entfernen damit spätere Timer-Updates ohne Lag wirken
    setTimeout(function() {
      if (es) es.style.transition = '';
    }, 320);
  }
}

function stopTimer() {
  clearInterval(G.timer);
  SoundSystem.stopMusic();
  SoundSystem.setTempo(1);
}

// =====================================================================
// N8N WEBHOOK (URL hier eintragen sobald Instanz verfügbar)
// =====================================================================
var N8N_WEBHOOK_URL = 'https://ki-automatisierung.startplatz-ai-hub.de/webhook/mathhero-stats';

// =====================================================================
// STATS TRACKING
// =====================================================================
function _recordTask(correct, userAnswer, timedOut) {
  var task = G.tasks[G.taskIdx];
  if (!task) return;
  var timeUsed = (Date.now() - G._taskStartTime) / 1000;
  G.stats.tasks.push({
    text:       task.text,
    op:         task.op,
    answer:     task.answer,
    userAnswer: userAnswer,
    correct:    correct,
    timedOut:   timedOut,
    timeUsed:   Math.max(0, timeUsed),
    level:      G.level
  });
}

// =====================================================================
// GAME LOGIC
// =====================================================================
function timeUp() {
  if (G.trainingMode) return;

  // Gegner-Angriffs-Animation: direkt beim Spieler einschlagen, dann zurück
  var es = $('enemy-sprite');
  var fullShift = G._enemyMaxShift || 180;
  if (es) {
    // Schnell zum Spieler (letztes Stück falls noch nicht ganz da)
    es.style.transition = 'transform 0.12s ease-out';
    es.style.transform = 'translateX(-' + (fullShift + 15) + 'px) scale(1.2)';
    flash('rgba(255,0,0,0.55)');
    setTimeout(function() {
      if (es) {
        // Zurückprallen
        es.style.transition = 'transform 0.28s ease-in';
        es.style.transform = 'translateX(0) scale(1)';
        setTimeout(function() { if (es) es.style.transition = ''; }, 300);
      }
    }, 220);
  }

  _recordTask(false, null, true);
  G.combo = 0;
  updateComboDisplay();
  G.lives--;
  SoundSystem.playLifeLost();
  updateHUD();
  if (G.lives <= 0) {
    setTimeout(function() { stopTimer(); gameOver(); }, 600);
  } else {
    setTimeout(function() { showScreen('screen-timeout'); }, 500);
  }
}

function showTask() {
  var taskEl = $('math-task'), inputEl = $('answer-input');
  if (taskEl && G.tasks[G.taskIdx]) taskEl.textContent = G.tasks[G.taskIdx].text;
  if (inputEl) { inputEl.value = ''; inputEl.className = ''; inputEl.focus(); }

  var dotsEl = $('task-dots');
  if (dotsEl) {
    var html = '';
    for (var i = 0; i < 5; i++) {
      var cls = 'task-dot';
      if (i < G.taskIdx) cls += ' done';
      else if (i === G.taskIdx) cls += ' active';
      html += '<div class="' + cls + '"></div>';
    }
    dotsEl.innerHTML = html;
  }
  var tsk = $('hud-task');
  if (tsk) tsk.textContent = (G.taskIdx + 1) + '/5';

  // Joker-Button anzeigen wenn aktiv
  var existingJoker = $('btn-joker');
  if (existingJoker) existingJoker.remove();
  if (G.joker) {
    var jb = document.createElement('button');
    jb.id = 'btn-joker';
    jb.className = 'btn btn-secondary btn-sm';
    jb.style.cssText = 'margin-left:.4rem;background:#f39c12;border-color:#f39c12;';
    jb.textContent = '💡 Lösung';
    jb.addEventListener('click', function() {
      var inp = $('answer-input');
      if (inp && G.tasks[G.taskIdx]) {
        inp.value = G.tasks[G.taskIdx].answer;
        inp.focus();
      }
      G.joker = false;
      jb.remove();
      updatePowerUpHUD();
    });
    var answerRow = document.querySelector('.answer-row');
    if (answerRow) answerRow.appendChild(jb);
  }

  G._taskStartTime = Date.now();
  startTimer();
}

// ── Level-Intro-Blende ────────────────────────────────────────────────────
function showLevelIntro(level, callback) {
  // Alten Aufgaben-Text sofort leeren — sonst sieht man die letzte Aufgabe des Vorlevels
  var taskEl = $('math-task'), inputEl = $('answer-input'), dotsEl = $('task-dots');
  if (taskEl)  taskEl.textContent = '';
  if (inputEl) { inputEl.value = ''; inputEl.className = ''; }
  if (dotsEl)  dotsEl.innerHTML = '';

  // Bestehenden Intro entfernen falls vorhanden
  var old = document.getElementById('level-intro');
  if (old) old.remove();

  var en = ENEMIES[level] || {};
  var div = document.createElement('div');
  div.id = 'level-intro';
  div.className = 'level-intro';
  div.innerHTML =
    '<div class="level-intro-label">LEVEL ' + level + '</div>'
  + '<div class="level-intro-enemy-wrap">' + getEnemySVG(level) + '</div>'
  + '<div class="level-intro-name">' + (en.name || '') + '</div>';

  var arena = document.querySelector('.battle-arena');
  if (arena) arena.appendChild(div);

  // Nach Animation (1.7s) aufräumen und Spiel starten
  setTimeout(function() {
    if (div.parentNode) div.remove();
    if (callback) callback();
  }, 1700);
}

// ── Floating Score-Zahl ───────────────────────────────────────────────────
function showFloatingScore(bonus, multiplier) {
  var label = '+' + bonus;
  if (multiplier >= 3)      label += ' 🔥🔥';
  else if (multiplier >= 2) label += ' 🔥';
  if (multiplier > 1)       label += ' ×' + multiplier;

  var el = document.createElement('div');
  el.className = 'floating-score';
  el.textContent = label;

  // Mittig über der Task-Box positionieren
  var taskBox = document.querySelector('.task-box');
  if (taskBox) {
    var r = taskBox.getBoundingClientRect();
    el.style.left = (r.left + r.width / 2 - 40) + 'px';
    el.style.top  = (r.top - 10) + 'px';
  } else {
    el.style.left = '50%'; el.style.top = '40%';
  }
  document.body.appendChild(el);
  setTimeout(function() { if (el.parentNode) el.remove(); }, 950);
}

// ── Combo aktualisieren ───────────────────────────────────────────────────
function updateComboDisplay() {
  var hud    = $('combo-hud');
  var flames = $('combo-flames');
  var label  = $('combo-label');
  if (!hud) return;

  var mult = comboMultiplier();
  if (G.combo < 3 || mult <= 1) {
    hud.style.display = 'none';
    return;
  }
  var fireCount = mult >= 3 ? 2 : 1;
  if (flames) flames.textContent = '🔥'.repeat(fireCount);
  if (label)  label.textContent  = '×' + mult;
  hud.style.display = '';
  // Pop-Neustart durch Clone
  hud.classList.remove('combo-hud');
  void hud.offsetWidth;
  hud.classList.add('combo-hud');
}

function comboMultiplier() {
  if (G.combo >= 5) return 3;
  if (G.combo >= 3) return 2;
  return 1;
}

// ── Aktive Power-Ups im HUD anzeigen ─────────────────────────────────────
function updatePowerUpHUD() {
  var el = $('hud-powerups');
  if (!el) return;
  var badges = [];
  if (G.shield > 0)        badges.push('<span class="pu-active-badge" title="Schild aktiv">🛡×' + G.shield + '</span>');
  if (G.joker)             badges.push('<span class="pu-active-badge" title="Joker verfügbar">💡</span>');
  if (G.bonusTimeAll > 0)  badges.push('<span class="pu-active-badge" title="+Zeit alle Level">⏱+' + G.bonusTimeAll + 's</span>');
  if (G.doublePoints)      badges.push('<span class="pu-active-badge" title="Doppelte Punkte">⭐×2</span>');
  if (G.extraTime > 0)     badges.push('<span class="pu-active-badge" title="+Zeit">⏱+' + G.extraTime + 's</span>');
  el.innerHTML = badges.join('');
  el.style.display = badges.length ? '' : 'none';
}

// ── Power-Up Auswahl zeigen ───────────────────────────────────────────────
var POWERUPS = [
  { type: 'shield2', icon: '🛡🛡', title: 'Doppelschild',      desc: '2 falsche Antworten werden ignoriert' },
  { type: 'joker',   icon: '💡',   title: 'Joker',             desc: 'Einmal die richtige Lösung anzeigen lassen' },
  { type: 'timeAll', icon: '⏱',   title: '+5s für alle Level', desc: 'Jedes Level bekommt 5 Sekunden mehr Zeit' }
];

function showPowerUp(afterCallback) {
  var choices = $('powerup-choices');
  if (!choices) { afterCallback(); return; }

  // Zufällig 3 mischen (alle 3 sind es)
  var html = '';
  POWERUPS.forEach(function(p) {
    html += '<button class="powerup-btn" data-type="' + p.type + '">'
      + '<span class="pu-icon">' + p.icon + '</span>'
      + '<span><span class="pu-title">' + p.title + '</span>'
      + '<span class="pu-desc">' + p.desc + '</span></span>'
      + '</button>';
  });
  choices.innerHTML = html;

  choices.querySelectorAll('.powerup-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      applyPowerUp(this.getAttribute('data-type'));
      showScreen('screen-game');
      afterCallback();
    }, { once: true });
  });

  showScreen('screen-powerup');
}

function applyPowerUp(type) {
  if (type === 'shield2') { G.shield = 2; }
  if (type === 'joker')   { G.joker = true; }
  if (type === 'timeAll') { G.bonusTimeAll = 5; }
  updatePowerUpHUD();
}

function setLevelBackground(level) {
  var arena = document.querySelector('.battle-arena');
  if (arena && LEVEL_BG[level]) arena.style.background = LEVEL_BG[level];
  var deco = $('level-bg-deco');
  if (deco) deco.innerHTML = getLevelBgDeco(level);
}

// ── Hintergrundgrafiken je Level ────────────────────────────────────────────
function getLevelBgDeco(level) {
  // Helfer: einfaches HTML-Tag mit Stil bauen
  function el(cls, style, inner) {
    return '<div class="' + cls + '" style="' + style + '">' + (inner || '') + '</div>';
  }
  // Wolken-Generator
  function clouds(n, opacity) {
    var h = '';
    for (var i = 0; i < n; i++) {
      var w = 70 + i * 30, ht = 28 + i * 8;
      var top = 8 + i * 14;
      var dur = 18 + i * 7;
      var delay = -(i * 6);
      h += '<div class="deco-cloud" style="width:' + w + 'px;height:' + ht + 'px;top:' + top + '%;'
         + 'animation-duration:' + dur + 's;animation-delay:' + delay + 's;opacity:' + (opacity||.8) + '">'
         + '<div style="position:absolute;width:' + Math.round(w*.55) + 'px;height:' + Math.round(ht*1.4) + 'px;'
         + 'background:white;border-radius:50%;top:-50%;left:20%"></div>'
         + '<div style="position:absolute;width:' + Math.round(w*.4) + 'px;height:' + Math.round(ht*1.3) + 'px;'
         + 'background:white;border-radius:50%;top:-40%;left:50%"></div>'
         + '</div>';
    }
    return h;
  }
  // Sterne-Generator
  function stars(n, color, minSize, maxSize) {
    var h = '';
    for (var i = 0; i < n; i++) {
      var sz = minSize + Math.random() * (maxSize - minSize) | 0;
      var dur = 1.5 + Math.random() * 2.5;
      var delay = -(Math.random() * dur);
      h += '<div class="deco-star" style="width:' + sz + 'px;height:' + sz + 'px;'
         + 'left:' + (Math.random() * 95) + '%;top:' + (Math.random() * 60) + '%;'
         + 'background:' + (color || 'white') + ';'
         + 'animation-duration:' + dur.toFixed(1) + 's;animation-delay:' + delay.toFixed(1) + 's"></div>';
    }
    return h;
  }
  // Glühaugen-Generator
  function eyes(n, color) {
    var h = '';
    for (var i = 0; i < n; i++) {
      h += '<div class="deco-eye" style="left:' + (5 + Math.random() * 85) + '%;'
         + 'top:' + (20 + Math.random() * 55) + '%;'
         + 'animation-duration:' + (2 + Math.random() * 3).toFixed(1) + 's;'
         + 'animation-delay:' + -(Math.random() * 3).toFixed(1) + 's">'
         + '<span style="background:' + (color||'#b388ff') + ';box-shadow:0 0 8px 3px ' + (color||'#b388ff') + '"></span>'
         + '<span style="background:' + (color||'#b388ff') + ';box-shadow:0 0 8px 3px ' + (color||'#b388ff') + '"></span>'
         + '</div>';
    }
    return h;
  }

  if (level === 1) {
    // Blauer Himmel: Sonne + 3 Wolken
    return el('deco-sun','width:60px;height:60px;top:8%;right:12%;background:#FFD600;')
      + clouds(3, 0.9);
  }
  if (level === 2) {
    // Sonnige Wiese: Wolken + Hügel + Sonne
    var hills = el('deco-hill','width:220px;height:100px;left:-30px;background:#66bb6a;opacity:.55')
              + el('deco-hill','width:180px;height:80px;right:-20px;background:#81c784;opacity:.5');
    return el('deco-sun','width:52px;height:52px;top:10%;left:10%;background:#FFF176;')
      + clouds(2, 0.85) + hills;
  }
  if (level === 3) {
    // Herbst-Dämmerung: fallende Blätter + Baumsilhouette
    var lc = ['#e65100','#bf360c','#f57f17','#6d4c41','#dd2c00'];
    var leaves = '';
    for (var i = 0; i < 8; i++) {
      leaves += '<div class="deco-leaf" style="left:' + (i * 12 + 2) + '%;'
        + 'background:' + lc[i % lc.length] + ';'
        + 'animation-duration:' + (4 + i * .7) + 's;animation-delay:-' + (i * 1.1) + 's"></div>';
    }
    var treeSvg = '<svg viewBox="0 0 60 130" xmlns="http://www.w3.org/2000/svg" style="width:60px;height:130px">'
      + '<rect x="27" y="80" width="6" height="50" fill="#4e342e"/>'
      + '<line x1="30" y1="100" x2="10" y2="80" stroke="#4e342e" stroke-width="3"/>'
      + '<line x1="30" y1="90" x2="50" y2="70" stroke="#4e342e" stroke-width="3"/>'
      + '<line x1="30" y1="80" x2="15" y2="60" stroke="#4e342e" stroke-width="2"/>'
      + '<line x1="30" y1="70" x2="48" y2="50" stroke="#4e342e" stroke-width="2"/>'
      + '<line x1="30" y1="60" x2="22" y2="40" stroke="#4e342e" stroke-width="2"/>'
      + '<line x1="30" y1="50" x2="38" y2="30" stroke="#4e342e" stroke-width="2"/>'
      + '</svg>';
    return leaves
      + el('deco-tree','left:2%;bottom:0;opacity:.7', treeSvg)
      + el('deco-tree','right:3%;bottom:0;opacity:.6;transform:scaleX(-1)', treeSvg);
  }
  if (level === 4) {
    // Abenddämmerung: Mond + viele Sterne
    var moon = el('deco-moon','width:50px;height:50px;top:8%;right:14%;'
      + 'background:radial-gradient(circle at 35% 35%,#fff9c4,#f9a825);');
    return moon + stars(28, 'white', 2, 4);
  }
  if (level === 5) {
    // Dunkler Wald: Baumsilhouetten + Nebel + Augen
    var pine = '<svg viewBox="0 0 70 160" xmlns="http://www.w3.org/2000/svg" style="width:70px;height:160px">'
      + '<rect x="31" y="110" width="8" height="50" fill="#1b5e20"/>'
      + '<polygon points="35,0 5,60 65,60" fill="#1b5e20"/>'
      + '<polygon points="35,25 5,90 65,90" fill="#1b5e20"/>'
      + '<polygon points="35,55 5,120 65,120" fill="#1b5e20"/>'
      + '</svg>';
    return el('deco-tree','left:-5px;bottom:0;opacity:.9', pine)
      + el('deco-tree','left:35px;bottom:0;opacity:.7;animation-delay:-2s', pine)
      + el('deco-tree','right:-5px;bottom:0;opacity:.85;transform:scaleX(-1)', pine)
      + el('deco-tree','right:35px;bottom:0;opacity:.6;transform:scaleX(-1);animation-delay:-3s', pine)
      + el('deco-fog','width:200px;height:60px;bottom:10%;left:-10%;background:rgba(144,164,174,.3)')
      + el('deco-fog','width:160px;height:50px;bottom:8%;right:5%;background:rgba(144,164,174,.25);animation-delay:-2s')
      + eyes(3, '#76ff03');
  }
  if (level === 6) {
    // Sturmnacht: Wolken + Blitz + Sterne
    var stormCloud = el('','position:absolute;width:130px;height:40px;border-radius:40px;'
      + 'background:rgba(30,30,60,.8);top:10%;left:15%')
      + el('','position:absolute;width:100px;height:35px;border-radius:40px;'
      + 'background:rgba(20,20,50,.8);top:18%;right:10%');
    var bolt = '<svg viewBox="0 0 30 70" xmlns="http://www.w3.org/2000/svg" style="width:30px;height:70px">'
      + '<polygon points="18,0 8,38 16,38 10,70 26,28 17,28 24,0" fill="#FFF59D" opacity=".95"/></svg>';
    return stormCloud
      + el('deco-lightning','top:10%;left:38%', bolt)
      + el('deco-lightning','top:8%;right:25%;animation-delay:-3.5s', bolt)
      + stars(8, 'rgba(255,255,255,.5)', 2, 3);
  }
  if (level === 7) {
    // Vulkan-Glut: Flammen + Glut + Embers
    var flameSvg = '<svg viewBox="0 0 40 80" xmlns="http://www.w3.org/2000/svg" style="width:40px;height:80px">'
      + '<path d="M20 75 Q5 55 10 35 Q14 20 8 5 Q22 22 18 38 Q25 25 30 10 Q38 30 32 50 Q35 60 20 75Z" fill="#ff6d00"/>'
      + '<path d="M20 75 Q10 58 14 42 Q18 30 14 18 Q24 30 20 45 Q26 35 28 22 Q34 38 28 54 Q26 65 20 75Z" fill="#ffd600"/>'
      + '</svg>';
    var embers = '';
    for (var i = 0; i < 10; i++) {
      embers += '<div class="deco-ember" style="left:' + (10 + Math.random() * 80) + '%;'
        + 'bottom:' + (5 + Math.random() * 20) + '%;'
        + 'background:' + (i%2===0?'#ff6d00':'#ffd600') + ';'
        + '--dx:' + (Math.random()*40-20).toFixed(0) + 'px;'
        + 'animation-duration:' + (1.5+Math.random()*2).toFixed(1) + 's;'
        + 'animation-delay:-' + (Math.random()*2).toFixed(1) + 's"></div>';
    }
    return el('deco-tree','left:0;bottom:0;opacity:.9', flameSvg)
      + el('deco-tree','right:5px;bottom:0;opacity:.85;animation-delay:-1.2s', flameSvg)
      + el('deco-lava','') + embers;
  }
  if (level === 8) {
    // Gewittersturm: Regen + Blitze + dunkle Wolken
    var rain = '';
    for (var i = 0; i < 20; i++) {
      rain += '<div class="deco-rain" style="left:' + (i * 5 + Math.random() * 4) + '%;'
        + 'height:' + (18 + Math.random() * 20) + 'px;'
        + 'animation-duration:' + (.5 + Math.random() * .4).toFixed(2) + 's;'
        + 'animation-delay:-' + (Math.random() * .8).toFixed(2) + 's;opacity:.6"></div>';
    }
    var bolt2 = '<svg viewBox="0 0 30 80" xmlns="http://www.w3.org/2000/svg" style="width:30px;height:80px">'
      + '<polygon points="20,0 8,44 17,44 8,80 28,32 18,32 26,0" fill="white" opacity=".9"/></svg>';
    return el('','position:absolute;width:100%;height:45px;top:0;background:rgba(13,13,40,.7);border-radius:0 0 40% 40%')
      + rain
      + el('deco-lightning','top:5%;left:28%',bolt2)
      + el('deco-lightning','top:3%;right:20%;animation-delay:-2.8s',bolt2);
  }
  if (level === 9) {
    // Unterwelt: Augen + Nebel + Runen-Symbole
    var runes = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ'];
    var runeHtml = '';
    for (var i = 0; i < 5; i++) {
      runeHtml += '<div style="position:absolute;font-size:' + (14+i*4) + 'px;'
        + 'color:rgba(180,0,255,' + (.2+Math.random()*.35).toFixed(2) + ');'
        + 'left:' + (5+Math.random()*85) + '%;top:' + (15+Math.random()*55) + '%;'
        + 'animation:starTwinkle ' + (2+Math.random()*3).toFixed(1) + 's ease-in-out infinite alternate;'
        + 'animation-delay:-' + (Math.random()*3).toFixed(1) + 's;font-family:serif">'
        + runes[i] + '</div>';
    }
    return el('deco-wisp','width:100px;height:60px;left:5%;top:30%;background:rgba(138,43,226,.35)')
      + el('deco-wisp','width:80px;height:50px;right:8%;top:25%;background:rgba(75,0,130,.4);animation-delay:-1.5s')
      + el('deco-fog','width:100%;height:50px;bottom:0;left:0;background:rgba(74,0,114,.4)')
      + eyes(5, '#ce93d8')
      + runeHtml;
  }
  if (level === 10) {
    // Chaos: Alles auf einmal — Embers + Wisps + Augen + Blitz + Chaos-Orbs
    var chOrbs = '';
    var orbColors = ['#e040fb','#ff1744','#ff6d00','#b388ff','#ffd600'];
    for (var i = 0; i < 5; i++) {
      chOrbs += el('deco-chaos','width:' + (60+i*20) + 'px;height:' + (60+i*20) + 'px;'
        + 'left:' + (i*18+5) + '%;top:' + (10+i*8) + '%;'
        + 'background:' + orbColors[i] + ';opacity:.25;'
        + 'animation-duration:' + (2+i*.8).toFixed(1) + 's;animation-delay:-' + (i*.7).toFixed(1) + 's');
    }
    var chBolt = '<svg viewBox="0 0 30 80" xmlns="http://www.w3.org/2000/svg" style="width:25px;height:65px">'
      + '<polygon points="18,0 7,40 15,40 7,80 26,30 17,30 24,0" fill="#e040fb" opacity=".95"/></svg>';
    var chEmbers = '';
    for (var i = 0; i < 8; i++) {
      chEmbers += '<div class="deco-ember" style="left:' + (5+Math.random()*90) + '%;bottom:10%;'
        + 'background:' + orbColors[i%orbColors.length] + ';'
        + '--dx:' + (Math.random()*50-25).toFixed(0) + 'px;'
        + 'animation-duration:' + (1+Math.random()*1.5).toFixed(1) + 's;'
        + 'animation-delay:-' + (Math.random()*2).toFixed(1) + 's;width:6px;height:6px"></div>';
    }
    return chOrbs + chEmbers
      + el('deco-lightning','top:5%;left:20%',chBolt)
      + el('deco-lightning','top:8%;right:15%;animation-delay:-1.8s',chBolt)
      + eyes(4, '#ea80fc');
  }
  return '';
}

function updateSprites() {
  var ps = $('player-sprite'), es = $('enemy-sprite');
  if (ps && G.selectedHero !== null) {
    ps.innerHTML = getCharSVG(G.selectedHero);
    var nb = $('player-name-badge');
    if (nb) nb.textContent = G.playerName || CHARACTERS[G.selectedHero].name;
  }
  if (es) {
    // Clear any lingering death/hurt animation so enemy is visible immediately
    es.classList.remove('enemy-dead', 'enemy-hurt');
    es.style.animation = 'none';
    es.offsetHeight; // reflow to flush animation
    es.style.animation = '';
    es.style.opacity = '1';
    es.style.transform = '';

    es.innerHTML = getEnemySVG(G.level);
    var b = document.createElement('span');
    b.className = 'enemy-level-badge'; b.id = 'enemy-badge';
    b.textContent = 'LVL ' + G.level;
    es.appendChild(b);

    // Show enemy name in badge
    var enb = $('enemy-name-badge');
    if (enb && ENEMIES[G.level]) enb.textContent = ENEMIES[G.level].name;
  }
  setLevelBackground(G.level);
  // reset enemy HP
  G.enemyHP = 5; G.enemyMaxHP = 5;
  updateEnemyHP();
}

function checkAnswer() {
  var inp = $('answer-input');
  if (!inp) return;
  var userAnswer = parseInt(inp.value);
  if (isNaN(userAnswer)) return;
  if (userAnswer === G.tasks[G.taskIdx].answer) correctAns();
  else wrongAns();
}

function correctAns() {
  clearInterval(G.timer);
  SoundSystem.setTempo(1);
  _resetEnemyPosition();
  SoundSystem.playCorrect();
  var inp = $('answer-input');
  if (inp) inp.className = 'correct';

  // Combo: zählt nur wenn in der ersten Hälfte der Zeit beantwortet
  var fastEnough = !G.trainingMode && (G.timeLeft >= G.totalTime / 2);
  if (fastEnough) {
    G.combo++;
  } else if (!G.trainingMode) {
    G.combo = 0;   // zu langsam → Combo bricht ab
  }
  G.correctTotal++;
  var mult = comboMultiplier();
  updateComboDisplay();

  // Punkte berechnen (Double-Points Power-Up berücksichtigen)
  var bonus = (10 * G.level + Math.floor(G.timeLeft * 2)) * mult;
  if (G.doublePoints) { bonus *= 2; G.doublePoints = false; }
  G.score += bonus;

  // Floating Score-Anzeige
  showFloatingScore(bonus, mult * (G.doublePoints ? 2 : 1));

  flash('rgba(46,204,113,0.25)');
  _recordTask(true, G.tasks[G.taskIdx].answer, false);
  updateHUD();
  updatePowerUpHUD();

  G.taskIdx++;
  G.enemyHP = Math.max(0, 5 - G.taskIdx);
  updateEnemyHP();

  var isLastTask = (G.taskIdx >= 5);
  doAttackAnimation(isLastTask);

  if (isLastTask) {
    setTimeout(levelWin, 900);
  } else {
    setTimeout(showTask, 450);
  }
}

function wrongAns() {
  // Schild-Power-Up: Fehler absorbieren
  if (G.shield > 0) {
    G.shield--;
    updatePowerUpHUD();
    var inp2 = $('answer-input');
    if (inp2) { inp2.className = 'wrong'; inp2.value = ''; setTimeout(function(){ inp2.className=''; inp2.focus(); }, 400); }
    flash('rgba(100,100,255,0.35)');
    return;
  }

  SoundSystem.playWrong();
  flash('rgba(231,76,60,0.35)');
  var _wa = $('answer-input');
  _recordTask(false, _wa ? parseInt(_wa.value) : null, false);

  // Combo zurücksetzen
  G.combo = 0;
  updateComboDisplay();

  // Spieler-Shake-Animation
  var ps = $('player-sprite');
  if (ps) {
    ps.classList.remove('player-shake');
    void ps.offsetWidth; // reflow
    ps.classList.add('player-shake');
    setTimeout(function() { ps.classList.remove('player-shake'); }, 520);
  }

  if (!G.trainingMode && !G.demoMode) G.lives--;
  if (G.demoMode) G.lives--;

  var inp = $('answer-input');
  if (inp) {
    inp.className = 'wrong';
    inp.value = '';
    setTimeout(function() { inp.className = ''; inp.focus(); }, 400);
  }
  updateHUD();

  if (!G.trainingMode && G.lives <= 0) {
    setTimeout(function() { stopTimer(); gameOver(); }, 400);
  }
  if (G.demoMode && G.lives <= 0) {
    setTimeout(function() { stopTimer(); gameOver(); }, 400);
  }
}

function levelWin() {
  stopTimer();
  SoundSystem.playLevelComplete();
  G.totalElapsed = (Date.now() - G.gameStartTime) / 1000;
  var ws = $('win-score'), wl = $('win-level');
  if (ws) ws.textContent = G.score;
  if (wl) wl.textContent = G.level;
  // Enemy defeat message with player name
  var msg = $('win-enemy-msg');
  if (msg) {
    var en = ENEMIES[G.level];
    msg.textContent = en && en.msg
      ? en.msg.replace(/\{name\}/g, G.playerName || 'Held')
      : '';
  }
  showScreen('screen-level-complete');
}

var DEMO_LEVELS = [1, 6, 10];

function nextLevel() {
  // Power-Up: nach Level 5 (Normal) oder nach Level 6 (Demo, demoIdx 1)
  var isPowerUpMoment = !G.trainingMode && !G.powerUpUsed
    && ((G.demoMode && G.demoIdx === 1) || (!G.demoMode && G.level === 5));
  if (isPowerUpMoment) {
    G.powerUpUsed = true;
    showPowerUp(function() { _doNextLevel(); });
    return;
  }
  _doNextLevel();
}

function _doNextLevel() {
  G.taskIdx = 0;

  if (G.demoMode) {
    G.demoIdx++;
    if (G.demoIdx >= DEMO_LEVELS.length) {
      victory();
    } else {
      G.level = DEMO_LEVELS[G.demoIdx];
      if (G.level === 10) {
        showBossTaunt();
      } else {
        generateTasks(); updateHUD(); updateSprites();
        showScreen('screen-game');
        showLevelIntro(G.level, showTask);
      }
    }
    return;
  }

  G.level++;
  var maxLv = G.trainingMode ? 5 : 10;
  if (G.level > maxLv) {
    victory();
  } else if (G.level === 10 && !G.trainingMode) {
    showBossTaunt();
  } else {
    generateTasks(); updateHUD(); updateSprites();
    showScreen('screen-game');
    showLevelIntro(G.level, showTask);
  }
}

function showBossTaunt() {
  var sprite = $('boss-taunt-sprite');
  if (sprite) sprite.innerHTML = getEnemySVG(10);
  var text = $('boss-taunt-text');
  var name = G.playerName || 'Held';
  if (text) text.textContent = 'Hallo ' + name + '... du dachtest, du kannst mich besiegen? Dein Weg endet HIER! 🔮';
  showScreen('screen-boss-taunt');
}

// =====================================================================
// STATS / AUSWERTUNG
// =====================================================================
function showStats(opts) {
  opts = opts || {};

  // Badge
  var badge = $('stats-result-badge');
  if (badge) {
    if (G.trainingMode)      badge.textContent = '📚 Training abgeschlossen!';
    else if (opts.isGameOver) badge.textContent = '💀 Game Over – Level ' + G.level + ' · ⭐ ' + G.score + ' Punkte';
    else                      badge.textContent = '🏆 Alle Level geschafft! ⭐ ' + G.score + ' Punkte';
  }

  var tasks        = G.stats.tasks;
  var correctTasks = tasks.filter(function(t){ return t.correct; });
  var wrongTasks   = tasks.filter(function(t){ return !t.correct; });
  var avgTime      = correctTasks.length
    ? (correctTasks.reduce(function(s,t){ return s + t.timeUsed; }, 0) / correctTasks.length)
    : 0;
  var fastestTask  = correctTasks.length
    ? correctTasks.reduce(function(a,b){ return a.timeUsed < b.timeUsed ? a : b; })
    : null;

  // Per-op breakdown (correct answers only)
  var opStats = {};
  ['+','-','×','÷'].forEach(function(op) {
    var sub = correctTasks.filter(function(t){ return t.op === op; });
    if (sub.length) {
      opStats[op] = {
        count: sub.length,
        avg:   sub.reduce(function(s,t){ return s + t.timeUsed; }, 0) / sub.length,
        min:   Math.min.apply(null, sub.map(function(t){ return t.timeUsed; }))
      };
    }
  });
  var opNames = { '+':'Addition', '-':'Subtraktion', '×':'Multiplikation', '÷':'Division' };

  var html = '<div class="stats-summary">';
  html += '<div class="stats-row"><span>✅ Richtig</span><span><strong>' + correctTasks.length + '</strong> / ' + tasks.length + '</span></div>';
  html += '<div class="stats-row"><span>⌀ Zeit / richtige Aufgabe</span><span>' + (avgTime ? avgTime.toFixed(1) + 's' : '–') + '</span></div>';
  if (fastestTask) {
    var ft = fastestTask.text.replace(' = ?', ' = ') + fastestTask.answer;
    html += '<div class="stats-row"><span>⚡ Schnellste</span><span>' + ft + ' <em>(' + fastestTask.timeUsed.toFixed(1) + 's)</em></span></div>';
  }
  html += '</div>';

  // Per-op table
  var opKeys = Object.keys(opStats);
  if (opKeys.length > 0) {
    html += '<table class="stats-table"><thead><tr><th>Rechentyp</th><th>⌀ Zeit</th><th>Schnellste</th></tr></thead><tbody>';
    opKeys.forEach(function(op) {
      var s = opStats[op];
      html += '<tr><td>' + opNames[op] + '</td><td>' + s.avg.toFixed(1) + 's</td><td>' + s.min.toFixed(1) + 's</td></tr>';
    });
    html += '</tbody></table>';
  }

  // Wrong tasks or perfect
  if (wrongTasks.length > 0) {
    html += '<div class="stats-wrong-title">❌ Falsche Aufgaben:</div><ul class="stats-wrong-list">';
    wrongTasks.forEach(function(t) {
      var taskStr = t.text.replace(' = ?', ' = ') + t.answer;
      var ua = t.timedOut ? 'Zeit abgelaufen' : ('du tipptest: ' + t.userAnswer);
      html += '<li class="stats-wrong-task">' + taskStr + ' <span class="stats-wrong-ua">(' + ua + ')</span></li>';
    });
    html += '</ul>';
  } else if (tasks.length > 0) {
    html += '<div class="stats-perfect">🌟 Alle Aufgaben korrekt beantwortet!</div>';
  }

  var content = $('stats-content');
  if (content) content.innerHTML = html;

  // Email row: nur zeigen wenn Webhook URL gesetzt
  var emailRow = document.querySelector('.stats-email-row');
  if (emailRow) emailRow.style.display = N8N_WEBHOOK_URL ? '' : 'none';
  var emailInput = $('stats-email-input');
  var sendMsg    = $('stats-send-msg');
  if (emailInput) emailInput.value = '';
  if (sendMsg)    sendMsg.textContent = '';

  showScreen('screen-stats');
}

function sendStatsEmail(email) {
  if (!N8N_WEBHOOK_URL || !email) return;
  var sendMsg = $('stats-send-msg');
  if (sendMsg) sendMsg.textContent = '⏳ Wird gesendet...';

  // Chart-Daten: Aufgabennummer → Zeit (nur richtige)
  var chartData = G.stats.tasks.map(function(t, i) {
    return { taskNr: i + 1, task: t.text.replace(' = ?',''), time: t.correct ? t.timeUsed : null, correct: t.correct };
  });

  var payload = {
    email:      email,
    playerName: G.playerName,
    score:      G.score,
    level:      G.level,
    mode:       G.trainingMode ? 'Training' : 'Normal',
    tasks:      G.stats.tasks,
    chartData:  chartData,
    date:       new Date().toLocaleString('de-DE')
  };

  fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(r) {
    if (sendMsg) sendMsg.textContent = r.ok ? '✅ Auswertung wurde gesendet!' : '❌ Fehler beim Senden (Status ' + r.status + ')';
  }).catch(function() {
    if (sendMsg) sendMsg.textContent = '❌ Verbindungsfehler – bitte erneut versuchen.';
  });
}

function gameOver() {
  stopTimer();
  SoundSystem.playGameOver();
  if (!G.trainingMode) autoSaveScore();
  showStats({ isGameOver: true });
}

// =====================================================================
// FEUERWERK — nach Level 10 Sieg
// =====================================================================
function launchFireworks() {
  var SYMBOLS = ['1','2','3','4','5','6','7','8','9','+','−','×','÷','='];
  var COLORS  = ['#FFD700','#FF4B2B','#00E5FF','#69F0AE','#E040FB','#FF8F00','#fff'];
  var W = window.innerWidth, H = window.innerHeight;

  function burst(bx, by) {
    var count = 22 + rnd(0, 12);
    for (var i = 0; i < count; i++) {
      (function(idx) {
        var el = document.createElement('div');
        el.className = 'fw-particle';
        el.textContent = SYMBOLS[rnd(0, SYMBOLS.length - 1)];
        var angle   = (idx / count) * 360 + rnd(-15, 15);
        var dist    = 55 + rnd(0, 90);
        var px      = Math.cos(angle * Math.PI / 180) * dist;
        var py      = Math.sin(angle * Math.PI / 180) * dist - rnd(10, 40);
        var dur     = (1.2 + Math.random() * .8).toFixed(2);
        var delay   = (Math.random() * .18).toFixed(2);
        el.style.cssText =
          'left:' + bx + 'px;top:' + by + 'px;' +
          '--px:' + px.toFixed(0) + 'px;--py:' + py.toFixed(0) + 'px;' +
          '--pdur:' + dur + 's;--pdelay:' + delay + 's;' +
          '--pc:' + COLORS[rnd(0, COLORS.length - 1)] + ';';
        document.body.appendChild(el);
        setTimeout(function() { if (el.parentNode) el.remove(); },
          (parseFloat(dur) + parseFloat(delay) + .1) * 1000);
      })(i);
    }
  }

  function rocket(startX, delay) {
    var el = document.createElement('div');
    el.className = 'fw-rocket';
    var dur = (.7 + Math.random() * .4).toFixed(2);
    el.textContent = '🚀';
    el.style.cssText =
      'left:' + startX + 'px;top:' + (H * .85) + 'px;' +
      '--dur:' + dur + 's;--delay:' + delay + 's;';
    document.body.appendChild(el);
    // burst wenn Rakete oben ankommt
    setTimeout(function() {
      if (el.parentNode) el.remove();
      burst(startX + 11, H * .85 - 340);
    }, (parseFloat(dur) + parseFloat(delay)) * 1000);
  }

  // 6 Wellen Raketen
  var wave = 0;
  var positions = [.15,.3,.45,.6,.75,.88];
  function fireWave() {
    if (wave >= 6) return;
    var count = 2 + rnd(0, 2);
    for (var k = 0; k < count; k++) {
      var xFrac = positions[(wave * 2 + k) % positions.length];
      rocket(W * xFrac + rnd(-30, 30), k * .18);
    }
    wave++;
    setTimeout(fireWave, 700 + rnd(0, 300));
  }
  fireWave();
}

function victory() {
  stopTimer();
  SoundSystem.playVictory();
  G.totalElapsed = (Date.now() - G.gameStartTime) / 1000;
  if (!G.trainingMode && !G.demoMode) autoSaveScore();
  if (!G.trainingMode) setTimeout(launchFireworks, 300);
  showStats({ isVictory: true });
}

// =====================================================================
// HIGHSCORE  (auto-save, hero stored)
// =====================================================================
function autoSaveScore() {
  var entry = {
    name:  G.playerName || 'Held',
    hero:  G.selectedHero !== null ? G.selectedHero : 0,
    score: G.score,
    level: G.level,
    date:  new Date().toLocaleDateString('de-DE')
  };

  // Immer lokal speichern (Fallback + Offline-Nutzung)
  var local = loadLocalScores();
  local.push(entry);
  local.sort(function(a, b) { return b.score - a.score; });
  local = local.slice(0, 20);
  localStorage.setItem('mathHeroScores', JSON.stringify(local));

  // Zusätzlich in Supabase speichern (async, im Hintergrund)
  SupabaseDB.saveScore(entry);
}

// Nur lokale Scores (localStorage)
function loadLocalScores() {
  try { return JSON.parse(localStorage.getItem('mathHeroScores')) || []; }
  catch (e) { return []; }
}

// Aktuell aktiver Zeitfilter im Highscore-Screen
var _hsFilter = 'all';
// Optionen merken (z.B. highlightScore nach Game Over)
var _hsOpts   = {};

function showHighscores(opts) {
  _hsOpts = opts || {};
  _hsFilter = 'all';
  _applyHsFilterButtons();
  _renderHsHeader();
  showScreen('screen-highscore');
  _loadAndRenderScores();
}

// Header / Banner je nach Kontext (Game Over vs. normaler Aufruf)
function _renderHsHeader() {
  var banner = $('hs-gameover-banner');
  var retry  = $('btn-hs-retry');
  var title  = document.querySelector('#screen-highscore h2');
  if (_hsOpts.isGameOver) {
    if (title)  title.innerHTML = '💀 GAME OVER &nbsp;·&nbsp; 🏆 HIGHSCORE';
    if (banner) {
      banner.innerHTML = 'Level&nbsp;<strong>' + _hsOpts.gameOverLevel + '</strong>&nbsp;erreicht &nbsp;·&nbsp; ⭐&nbsp;<strong>' + _hsOpts.highlightScore + '</strong>&nbsp;Punkte';
      banner.style.display = 'block';
    }
    if (retry) retry.style.display = 'inline-flex';
  } else {
    if (title)  title.innerHTML = '🏆 HIGHSCORE LISTE';
    if (banner) banner.style.display = 'none';
    if (retry)  retry.style.display = 'none';
  }
}

// Scores laden (Supabase wenn online, sonst localStorage) und Tabelle rendern
async function _loadAndRenderScores() {
  var list  = $('highscore-list');
  var badge = $('hs-source-badge');
  if (!list) return;

  list.innerHTML = '<p class="hs-loading">⏳ Lädt...</p>';

  var scores = await SupabaseDB.loadScores(_hsFilter);
  var isOnline = scores !== null;

  if (!isOnline) {
    // Offline: lokale Scores, bei Filter "today"/"month" selbst filtern
    scores = _filterLocalScores(loadLocalScores(), _hsFilter);
    if (badge) badge.textContent = '📴 Offline – lokale Scores';
  } else {
    if (badge) badge.textContent = '🌐 Online – globale Rangliste';
  }

  _renderScoreTable(list, scores);
}

// Lokale Scores nach Zeitraum filtern
function _filterLocalScores(scores, filter) {
  if (filter === 'all') return scores;
  var now = new Date();
  return scores.filter(function(s) {
    // Datum gespeichert als "TT.MM.JJJJ" (de-DE)
    var parts = (s.date || '').split('.');
    if (parts.length < 3) return false;
    var d = new Date(+parts[2], +parts[1] - 1, +parts[0]);
    if (filter === 'today') {
      return d.toDateString() === now.toDateString();
    }
    if (filter === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    return true;
  });
}

// HTML-Tabelle aus Score-Array aufbauen
function _renderScoreTable(list, scores) {
  if (!scores || scores.length === 0) {
    list.innerHTML = '<p class="hs-empty">Keine Scores für diesen Zeitraum!</p>';
    return;
  }
  var medals = ['🥇', '🥈', '🥉'];
  var highlighted = false;
  var html = '<table class="score-table">'
    + '<tr><th>#</th><th>Held</th><th>Name</th><th>Score</th><th>Level</th><th>Datum</th></tr>';
  scores.forEach(function(s, i) {
    var heroSVG = '<div style="width:36px;height:36px;display:inline-block;">' + getCharSVG(s.hero || 0) + '</div>';
    var isNew = !highlighted
      && _hsOpts.highlightScore !== undefined
      && s.score === _hsOpts.highlightScore
      && s.name  === _hsOpts.highlightName;
    if (isNew) highlighted = true;
    html += '<tr' + (isNew ? ' class="hs-highlight"' : '') + '>';
    html += '<td>' + (medals[i] || (i + 1)) + '</td>';
    html += '<td>' + heroSVG + '</td>';
    html += '<td>' + (s.name || '?') + '</td>';
    html += '<td>' + s.score + '</td>';
    html += '<td>' + s.level + '</td>';
    html += '<td>' + (s.date || '–') + '</td>';
    html += '</tr>';
  });
  html += '</table>';
  list.innerHTML = html;
}

// Aktiven Filter-Button visuell markieren
function _applyHsFilterButtons() {
  document.querySelectorAll('.hs-filter-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === _hsFilter);
  });
}

// =====================================================================
// HERO SELECT
// =====================================================================
function renderHeroSelect() {
  var grid = $('hero-grid');
  if (!grid) return;
  var html = '';
  CHARACTERS.forEach(function(c, i) {
    var sel = (i === G.selectedHero) ? ' selected' : '';
    html += '<div class="hero-card' + sel + '" data-index="' + i + '">';
    html += '<div class="hero-svg">' + getCharSVG(i) + '</div>';
    html += '</div>';
  });
  grid.innerHTML = html;
  grid.querySelectorAll('.hero-card').forEach(function(card) {
    card.addEventListener('click', function() {
      selectHero(parseInt(this.getAttribute('data-index')));
    });
  });
}

function selectHero(index) {
  G.selectedHero = index;
  SoundSystem.playSelect();
  renderHeroSelect();
  tryEnableStart();
}

function tryEnableStart() {
  var btn = $('btn-start-game');
  if (!btn) return;
  var nameOk = (G.playerName.trim().length > 0);
  var heroOk = (G.selectedHero !== null);
  btn.disabled = !(nameOk && heroOk);
  if (nameOk && heroOk) btn.classList.add('ready');
  else btn.classList.remove('ready');
}

// =====================================================================
// GAME START
// =====================================================================
function startGame() {
  if (G.selectedHero === null || !G.playerName.trim()) return;
  SoundSystem.stopMenuMusic();
  SoundSystem.playClick();

  G.level = G.demoMode ? DEMO_LEVELS[0] : 1;
  G.score = 0; G.lives = 3; G.taskIdx = 0;
  G._musicLevel = 0;
  G.combo = 0; G.correctTotal = 0;
  G.shield = 0; G.joker = false; G.bonusTimeAll = 0; G.doublePoints = false; G.extraTime = 0; G.powerUpUsed = false;
  G.totalElapsed = 0; G.gameStartTime = Date.now();
  G.stats = { tasks: [] }; G.demoIdx = 0;

  generateTasks(); updateHUD(); updateSprites();
  updateComboDisplay(); updatePowerUpHUD();
  showScreen('screen-game');
  showLevelIntro(G.level, showTask);
}

function retryFromTimeout() {
  SoundSystem.playClick();
  showScreen('screen-game');
  showTask();
}

function goToMenu() {
  stopTimer();
  SoundSystem.stopMusic();
  SoundSystem.playClick();
  G.selectedHero = null; G.playerName = '';
  G.trainingMode = false; G.demoMode = false;
  G._musicLevel = 0;
  tryEnableStart();
  showScreen('screen-menu');
  SoundSystem.startMenuMusic();
}

// =====================================================================
// MATRIX RAIN (nur Startbildschirm)
// =====================================================================
var MatrixRain = (function () {
  var canvas = null, ctx = null, animId = null, drops = [];
  var FS = 16, CW = 18;
  var CHARS = '0123456789+-×÷=?';

  function init() {
    canvas = document.getElementById('matrix-canvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    return true;
  }

  function resize() {
    var p = canvas.parentElement;
    canvas.width  = p.offsetWidth  || 940;
    canvas.height = p.offsetHeight || 660;
    var cols = Math.floor(canvas.width / CW);
    drops = [];
    for (var i = 0; i < cols; i++) {
      drops[i] = -Math.floor(Math.random() * (canvas.height / FS));
    }
  }

  function draw() {
    ctx.fillStyle = 'rgba(22,33,62,0.10)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = FS + 'px monospace';
    for (var i = 0; i < drops.length; i++) {
      var y = drops[i] * FS;
      if (y >= 0) {
        var c = CHARS[Math.floor(Math.random() * CHARS.length)];
        ctx.fillStyle = '#ccffcc';
        ctx.fillText(c, i * CW, y);
      }
      drops[i]++;
      if (drops[i] * FS > canvas.height && Math.random() > 0.975) {
        drops[i] = -Math.floor(Math.random() * 10);
      }
    }
  }

  return {
    start: function () {
      if (!canvas && !init()) return;
      resize();
      if (animId) clearInterval(animId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      animId = setInterval(draw, 50);
    },
    stop: function () {
      if (animId) { clearInterval(animId); animId = null; }
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
})();

// =====================================================================
// INIT
// =====================================================================
function initGame() {
  showScreen('screen-menu');
  // Audio nicht hier starten — erst nach Nutzer-Interaktion erlaubt.
  // Musik startet beim ersten Klick/Taste über den Listener am Ende der Datei.

  // --- Menu ---
  $('btn-play').addEventListener('click', function() {
    SoundSystem.playClick();
    G.trainingMode = false; G.demoMode = false;
    var startBtn = $('btn-start-game');
    if (startBtn) startBtn.innerHTML = 'SPIELEN ▶';
    renderHeroSelect();
    var ni = $('hero-name-input');
    if (ni) ni.value = G.playerName || '';
    showScreen('screen-hero-select');
  });

  $('btn-training').addEventListener('click', function() {
    SoundSystem.playClick();
    G.trainingMode = true;
    var startBtn = $('btn-start-game');
    if (startBtn) startBtn.innerHTML = 'TRAINING ▶';
    renderHeroSelect();
    var ni = $('hero-name-input');
    if (ni) ni.value = G.playerName || '';
    showScreen('screen-hero-select');
  });

  $('btn-demo').addEventListener('click', function() {
    SoundSystem.playClick();
    G.trainingMode = false; G.demoMode = false;
    G.demoMode = true;
    var startBtn = $('btn-start-game');
    if (startBtn) startBtn.innerHTML = '🎤 DEMO ▶';
    renderHeroSelect();
    var ni = $('hero-name-input');
    if (ni) ni.value = G.playerName || '';
    showScreen('screen-hero-select');
  });

  $('btn-highscore').addEventListener('click', function() {
    SoundSystem.playClick();
    showHighscores();
  });

  // --- Hero Select ---
  var heroNameInput = $('hero-name-input');
  if (heroNameInput) {
    heroNameInput.addEventListener('input', function() {
      G.playerName = this.value.trim();
      tryEnableStart();
    });
  }

  $('btn-start-game').addEventListener('click', startGame);
  $('btn-back-menu').addEventListener('click', function() {
    SoundSystem.playClick();
    G.selectedHero = null;
    showScreen('screen-menu');
    SoundSystem.startMenuMusic();
  });

  // --- Game screen ---
  $('btn-submit').addEventListener('click', checkAnswer);
  $('answer-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') checkAnswer();
  });

  // --- Level complete ---
  $('btn-next-level').addEventListener('click', nextLevel);

  // Enter-Taste bestätigt "WEITER" auf dem Level-Complete-Screen
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    var active = document.querySelector('.screen.active');
    if (!active) return;
    switch (active.id) {
      case 'screen-hero-select':
        var startBtn = $('btn-start-game');
        if (startBtn && !startBtn.disabled) startBtn.click();
        break;
      case 'screen-level-complete': nextLevel(); break;
      case 'screen-boss-taunt':     $('btn-boss-accept').click(); break;
      case 'screen-timeout':        $('btn-retry-timeout').click(); break;
      case 'screen-gameover':       $('btn-retry-gameover').click(); break;
      case 'screen-victory':        $('btn-menu-victory').click(); break;
      case 'screen-powerup':        break; // Auswahl nötig — kein Enter
    }
  });

  // --- Boss taunt screen ---
  $('btn-boss-accept').addEventListener('click', function() {
    SoundSystem.playClick();
    generateTasks(); updateHUD(); updateSprites();
    showScreen('screen-game');
    showLevelIntro(G.level, showTask);
  });

  // --- Timeout ---
  $('btn-retry-timeout').addEventListener('click', retryFromTimeout);

  // --- In-game exit to menu ---
  $('btn-hud-exit').addEventListener('click', goToMenu);

  // --- Game over ---
  $('btn-retry-gameover').addEventListener('click', function() {
    SoundSystem.playClick();
    G.level = 1; G.score = 0; G.lives = 3; G.taskIdx = 0;
    G._musicLevel = 0;
    G.combo = 0; G.correctTotal = 0;
    G.shield = 0; G.joker = false; G.bonusTimeAll = 0; G.doublePoints = false; G.extraTime = 0; G.powerUpUsed = false;
    G.totalElapsed = 0; G.gameStartTime = Date.now();
    G.stats = { tasks: [] }; G.demoIdx = 0;
    generateTasks(); updateHUD(); updateSprites();
    updateComboDisplay(); updatePowerUpHUD();
    showScreen('screen-game');
    showLevelIntro(G.level, showTask);
  });
  $('btn-menu-gameover').addEventListener('click', goToMenu);

  // --- Victory ---
  $('btn-menu-victory').addEventListener('click', goToMenu);

  // --- Highscore retry (shown after game over) ---
  $('btn-hs-retry').addEventListener('click', function() {
    SoundSystem.playClick();
    G.level = 1; G.score = 0; G.lives = 3; G.taskIdx = 0;
    G._musicLevel = 0;
    G.combo = 0; G.correctTotal = 0;
    G.shield = 0; G.joker = false; G.bonusTimeAll = 0; G.doublePoints = false; G.extraTime = 0; G.powerUpUsed = false;
    G.totalElapsed = 0; G.gameStartTime = Date.now();
    G.stats = { tasks: [] }; G.demoIdx = 0;
    generateTasks(); updateHUD(); updateSprites();
    updateComboDisplay(); updatePowerUpHUD();
    showScreen('screen-game');
    showLevelIntro(G.level, showTask);
  });

  // --- Stats screen ---
  $('btn-stats-retry').addEventListener('click', function() {
    SoundSystem.playClick();
    G.level = 1; G.score = 0; G.lives = 3; G.taskIdx = 0;
    G._musicLevel = 0;
    G.combo = 0; G.correctTotal = 0;
    G.shield = 0; G.joker = false; G.bonusTimeAll = 0; G.doublePoints = false; G.extraTime = 0; G.powerUpUsed = false;
    G.totalElapsed = 0; G.gameStartTime = Date.now();
    G.stats = { tasks: [] }; G.demoIdx = 0;
    generateTasks(); updateHUD(); updateSprites();
    updateComboDisplay(); updatePowerUpHUD();
    SoundSystem.startLevelMusic(1);
    showScreen('screen-game');
    showLevelIntro(G.level, showTask);
  });
  $('btn-stats-hs').addEventListener('click', function() {
    SoundSystem.playClick();
    showHighscores();
  });
  $('btn-stats-menu').addEventListener('click', goToMenu);
  $('btn-stats-send').addEventListener('click', function() {
    var emailInput = $('stats-email-input');
    var email = emailInput ? emailInput.value.trim() : '';
    if (!email) {
      var msg = $('stats-send-msg');
      if (msg) msg.textContent = '⚠️ Bitte eine gültige E-Mail eingeben.';
      return;
    }
    sendStatsEmail(email);
  });

  // --- Highscore ---
  $('btn-back-highscore').addEventListener('click', goToMenu);
  $('btn-clear-scores').addEventListener('click', function() {
    if (confirm('Lokale Scores löschen?\n(Online-Scores bleiben global gespeichert.)')) {
      localStorage.removeItem('mathHeroScores');
      localStorage.removeItem('mathHeroPending');
      var list = $('highscore-list');
      var badge = $('hs-source-badge');
      if (list) list.innerHTML = '<p class="hs-empty">Lokale Scores gelöscht 🗑</p>';
      if (badge) badge.textContent = '🗑 Gelöscht – klicke einen Filter für Online-Scores';
    }
  });

  // --- Volume Settings ---
  $('btn-settings').addEventListener('click', function() {
    SoundSystem.loadVolSettings();
    var sm = $('slider-music'), ss = $('slider-sfx');
    var vm = $('vol-music-val'), vs = $('vol-sfx-val');
    if (sm) { sm.value = SoundSystem._musicVol; vm.textContent = SoundSystem._musicVol + '%'; }
    if (ss) { ss.value = SoundSystem._sfxVol;   vs.textContent = SoundSystem._sfxVol   + '%'; }
    $('volume-modal').style.display = 'flex';
  });
  $('btn-vol-close').addEventListener('click', function() {
    $('volume-modal').style.display = 'none';
  });
  $('slider-music').addEventListener('input', function() {
    SoundSystem._musicVol = +this.value;
    $('vol-music-val').textContent = this.value + '%';
    SoundSystem.applyMusicVolume();
    SoundSystem.saveVolSettings();
  });
  $('slider-sfx').addEventListener('input', function() {
    SoundSystem._sfxVol = +this.value;
    $('vol-sfx-val').textContent = this.value + '%';
    SoundSystem.applySfxVolume();
    SoundSystem.saveVolSettings();
  });

  // --- Zeitraum-Filter (Gesamt / Heute / Monat) ---
  document.querySelectorAll('.hs-filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      _hsFilter = this.getAttribute('data-filter');
      _applyHsFilterButtons();
      _loadAndRenderScores();
    });
  });
}

// Projectile keyframe style
(function() {
  var style = document.createElement('style');
  style.textContent = [
    '@keyframes floatUp{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-60px)}}',
    '@keyframes projectileFly{0%{transform:translateX(0) scale(1);opacity:1}100%{transform:translateX(200%) scale(0.5);opacity:0}}',
    '.sprite-wrap.super-attack{animation:superAttack .7s ease;}',
    '@keyframes superAttack{0%{transform:scale(1) translateX(0)}30%{transform:scale(1.25) translateX(30px)}60%{transform:scale(1.1) translateX(60px)}100%{transform:scale(1) translateX(0)}}'
  ].join('');
  document.head.appendChild(style);
})();

// Auto-start menu music as early as possible.
// Most browsers block audio until user gesture; we attempt eagerly and fall back.
function _tryAutoMusic() {
  if (SoundSystem._menuMusicStarted) return;
  SoundSystem._menuMusicStarted = true;
  Tone.start().then(function() {
    SoundSystem.startMenuMusic();
  }).catch(function(){});
}

// First-interaction fallback: fires once on any click/key/touch
(function() {
  function onFirstInteraction() {
    _tryAutoMusic();
    document.removeEventListener('click', onFirstInteraction, true);
    document.removeEventListener('keydown', onFirstInteraction, true);
    document.removeEventListener('touchstart', onFirstInteraction, true);
  }
  document.addEventListener('click', onFirstInteraction, true);
  document.addEventListener('keydown', onFirstInteraction, true);
  document.addEventListener('touchstart', onFirstInteraction, true);
})();

var _gameInitialized = false;
function _initOnce() {
  if (_gameInitialized) return;
  _gameInitialized = true;
  initGame();
  // Kein Audio-Start hier — Browser blockiert das vor Nutzer-Interaktion.
  // Der erste-Interaktion-Listener unten übernimmt das.
  SupabaseDB.init();
  migrateLocalScoresToSupabase();
}

document.addEventListener('DOMContentLoaded', _initOnce);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  _initOnce();
}
