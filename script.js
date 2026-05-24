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
  enemyHP: 5,          // visual HP for enemy
  enemyMaxHP: 5,
  _musicLevel: 0       // tracks which level's music is loaded; 0 = none
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

      this._hihat = new Tone.MetalSynth({
        frequency: 500,
        envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
        harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5
      }).toDestination();
      this._hihat.volume.value = -27;

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
    } catch (e) { /* Autoplay-Policy — startet beim ersten Klick */ }
  },

  _stopLoops() {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    this._loops.forEach(function(l) { try { l.dispose(); } catch(e) {} });
    this._loops = [];
  },

  // ================================================================
  // MENÜ-MUSIK — fröhlich, unaufgeregt (C-Dur, 96 BPM)
  // ================================================================
  async startMenuMusic() {
    await this.init();
    if (!this._ready) return;
    this._stopLoops();

    // Immer auf weichen Menü-Preset zurücksetzen — sonst klingt es nach hartem Game-Tier
    try {
      this._mel.set({ oscillator: { type: 'triangle' },
                      envelope: { attack: 0.10, decay: 0.28, sustain: 0.50, release: 1.0 } });
      this._mel.volume.value = -15;
      if (this._bass) this._bass.set({ oscillator: { type: 'sine' } });
      this._bass.volume.value = -16;
      if (this._verb) this._verb.wet.value = 0.28;
    } catch(e) {}

    this._baseBpm = 68;
    Tone.Transport.bpm.value = 68;

    // Ruhige, tiefe C-Dur-Melodie – fällt sanft ab und wiederholt sich variiert
    var mel  = ['G3',null,'E3','G3','C4','B3','A3',null,'G3','F3','E3',null,'D3',null,'C3',null];
    var bass = ['C2',null,null,null,'F2',null,null,null,'C2',null,null,null,'G2',null,null,null];
    var pad  = [['C3','G3'],null,null,null,['F3','A3'],null,null,null,
                ['C3','E3'],null,null,null,['G2','D3'],null,null,null];

    var m = this._mel, b = this._bass, p = this._pad;
    var s1 = new Tone.Sequence(function(t,n){ if(n) m.triggerAttackRelease(n,'8n',t); }, mel, '8n');
    var s2 = new Tone.Sequence(function(t,n){ if(n) b.triggerAttackRelease(n,'2n',t); }, bass,'8n');
    var s3 = new Tone.Sequence(function(t,n){ if(n) p.triggerAttackRelease(n,'2n',t); }, pad, '8n');
    var self = this;
    [s1,s2,s3].forEach(function(s){ s.start(0); self._loops.push(s); });
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
    // Tier 5 — d-Moll, 128 BPM: chromat. Abstieg, volle Drums + Hi-Hat, episch
    // Charakter: Episch-dramatisch — Chromatik + Gegenstimme + Hi-Hat = maximale Spannung
    return { bpm: 128, loops: [
      sq(function(t,v){ if(v) m.triggerAttackRelease(v,'16n',t); },
        ['D4','C4','Bb3','A3','G#3','A3','C4','D4',
         'F4','A4','D5','C5','Bb4','A4','G#4','A4']),
      sq(function(t,v){ if(v) b.triggerAttackRelease(v,'8n',t); },
        ['D2',null,'A2',null,'Bb2',null,'A2',null,
         'D2',null,'F2',null,'A2',null,'Bb2',null]),
      sq(function(t,v){ if(v) k.triggerAttackRelease(v,'8n',t); },
        ['C1',null,'C1',null,'C1',null,'C1',null,
         'C1','C1','C1',null,'C1',null,'C1',null]),
      sq(function(t,v){ if(v) s.triggerAttackRelease('32n',t); },
        [null,null,null,null,'C1',null,null,null,
         null,null,null,null,'C1',null,'C1',null]),
      sq(function(t,v){ if(v) h.triggerAttackRelease('C6','32n',t); },
        ['C1','C1','C1','C1','C1','C1','C1','C1',
         'C1','C1','C1','C1','C1','C1','C1','C1'])
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
  { name: 'Katzen-Hexe',  color: '#8e24aa' },   // female – cat wizard
  { name: 'Robo-Rika',    color: '#00838f' },   // female – robot
  { name: 'Ritter Leo',   color: '#1565c0' },   // male   – knight
  { name: 'Fuchs-Ranger', color: '#388e3c' }    // male   – fox scout
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

  // 1 – Robo-Rika (female robot)
  if (index === 1) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<rect x="34" y="94" width="14" height="20" rx="4" fill="#00838f"/>'
    + '<rect x="52" y="94" width="14" height="20" rx="4" fill="#00838f"/>'
    + '<rect x="30" y="107" width="19" height="8" rx="4" fill="#006064"/>'
    + '<rect x="51" y="107" width="19" height="8" rx="4" fill="#006064"/>'
    + '<circle cx="41" cy="94" r="5" fill="#7b1fa2"/>'
    + '<circle cx="59" cy="94" r="5" fill="#7b1fa2"/>'
    + '<rect x="22" y="58" width="56" height="38" rx="10" fill="#00838f"/>'
    + '<rect x="27" y="63" width="46" height="26" rx="6" fill="#00acc1"/>'
    + '<rect x="29" y="73" width="42" height="10" rx="3" fill="#006064"/>'
    + '<text x="50" y="81" text-anchor="middle" font-size="5.5" fill="#e0f7fa" font-weight="bold">ROBOTICS</text>'
    + '<circle cx="50" cy="66" r="5" fill="#e91e63"/>'
    + '<circle cx="50" cy="66" r="3" fill="#ff80ab"/>'
    + '<rect x="24" y="88" width="11" height="8" rx="2" fill="#006064"/>'
    + '<rect x="65" y="88" width="11" height="8" rx="2" fill="#006064"/>'
    + '<rect x="9" y="60" width="14" height="28" rx="6" fill="#00838f"/>'
    + '<rect x="77" y="56" width="14" height="28" rx="6" fill="#00838f"/>'
    + '<rect x="75" y="48" width="17" height="14" rx="6" fill="#00acc1"/>'
    + '<rect x="77" y="44" width="13" height="9" rx="4" fill="#7b1fa2"/>'
    + '<circle cx="24" cy="62" r="5" fill="#7b1fa2"/>'
    + '<circle cx="76" cy="62" r="5" fill="#7b1fa2"/>'
    + '<rect x="42" y="50" width="16" height="10" rx="4" fill="#00acc1"/>'
    + '<rect x="26" y="22" width="48" height="32" rx="10" fill="#00838f"/>'
    + '<rect x="26" y="22" width="48" height="9" rx="10" fill="#6a1b9a"/>'
    + '<ellipse cx="50" cy="20" rx="17" ry="7" fill="#f06292"/>'
    + '<path d="M29 27 Q27 20 33 17" stroke="#f06292" stroke-width="4" fill="none" stroke-linecap="round"/>'
    + '<path d="M71 27 Q73 20 67 17" stroke="#f06292" stroke-width="4" fill="none" stroke-linecap="round"/>'
    + '<rect x="32" y="36" width="36" height="12" rx="6" fill="#004d40"/>'
    + '<ellipse cx="42" cy="42" rx="7" ry="4" fill="#00e5ff"/>'
    + '<ellipse cx="42" cy="42" rx="4" ry="2.5" fill="#80ffff"/>'
    + '<ellipse cx="58" cy="42" rx="7" ry="4" fill="#00e5ff"/>'
    + '<ellipse cx="58" cy="42" rx="4" ry="2.5" fill="#80ffff"/>'
    + '<circle cx="26" cy="39" r="7" fill="#4527a0"/>'
    + '<circle cx="74" cy="39" r="7" fill="#4527a0"/>'
    + '<circle cx="26" cy="39" r="4" fill="#7b1fa2"/>'
    + '<circle cx="74" cy="39" r="4" fill="#7b1fa2"/>'
    + '<rect x="37" y="50" width="26" height="5" rx="2" fill="#004d40"/>'
    + '<line x1="41" y1="52" x2="41" y2="54" stroke="#00e5ff" stroke-width="1.2"/>'
    + '<line x1="46" y1="52" x2="46" y2="54" stroke="#00e5ff" stroke-width="1.2"/>'
    + '<line x1="51" y1="52" x2="51" y2="54" stroke="#00e5ff" stroke-width="1.2"/>'
    + '<line x1="56" y1="52" x2="56" y2="54" stroke="#00e5ff" stroke-width="1.2"/>'
    + '<line x1="61" y1="52" x2="61" y2="54" stroke="#00e5ff" stroke-width="1.2"/>'
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

  // 3 – Fuchs-Ranger (male fox scout)
  return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
    + '<rect x="34" y="91" width="14" height="22" rx="4" fill="#2e7d32"/>'
    + '<rect x="52" y="91" width="14" height="22" rx="4" fill="#2e7d32"/>'
    + '<rect x="31" y="106" width="18" height="8" rx="3" fill="#4e342e"/>'
    + '<rect x="51" y="106" width="18" height="8" rx="3" fill="#4e342e"/>'
    + '<rect x="28" y="60" width="44" height="34" rx="9" fill="#388e3c"/>'
    + '<rect x="44" y="60" width="12" height="22" fill="#2e7d32"/>'
    + '<rect x="27" y="88" width="46" height="7" rx="3" fill="#5d4037"/>'
    + '<rect x="46" y="87" width="8" height="9" rx="1" fill="#ffd600"/>'
    + '<rect x="68" y="65" width="15" height="22" rx="4" fill="#6d4c41"/>'
    + '<rect x="70" y="67" width="11" height="6" rx="2" fill="#8d6e63"/>'
    + '<ellipse cx="50" cy="62" rx="11" ry="8" fill="#ff8f00"/>'
    + '<rect x="12" y="61" width="17" height="13" rx="6" fill="#388e3c" transform="rotate(18 12 61)"/>'
    + '<circle cx="14" cy="77" r="7" fill="#ff8f00"/>'
    + '<circle cx="14" cy="77" r="6" fill="#f5f5f5" stroke="#9e9e9e" stroke-width="1"/>'
    + '<line x1="14" y1="72" x2="14" y2="77" stroke="#f44336" stroke-width="1.5"/>'
    + '<line x1="14" y1="77" x2="19" y2="77" stroke="#9e9e9e" stroke-width="1"/>'
    + '<circle cx="14" cy="77" r="1.5" fill="#9e9e9e"/>'
    + '<rect x="71" y="62" width="17" height="12" rx="6" fill="#388e3c" transform="rotate(-18 71 62)"/>'
    + '<ellipse cx="50" cy="40" rx="22" ry="21" fill="#ff8f00"/>'
    + '<ellipse cx="50" cy="52" rx="13" ry="9" fill="#fff9c4"/>'
    + '<ellipse cx="50" cy="48" rx="4" ry="3" fill="#1a1a1a"/>'
    + '<polygon points="35,26 29,8 44,20" fill="#ff8f00"/>'
    + '<polygon points="65,26 71,8 56,20" fill="#ff8f00"/>'
    + '<polygon points="36,24 32,11 43,20" fill="#e91e63"/>'
    + '<polygon points="64,24 68,11 57,20" fill="#e91e63"/>'
    + '<ellipse cx="50" cy="26" rx="27" ry="6" fill="#2e7d32"/>'
    + '<rect x="31" y="13" width="38" height="15" rx="4" fill="#388e3c"/>'
    + '<ellipse cx="56" cy="16" rx="6" ry="3" fill="#66bb6a" transform="rotate(-20 56 16)"/>'
    + '<circle cx="42" cy="37" r="5.5" fill="#fff"/>'
    + '<circle cx="58" cy="37" r="5.5" fill="#fff"/>'
    + '<circle cx="43" cy="37" r="3.5" fill="#5d4037"/>'
    + '<circle cx="59" cy="37" r="3.5" fill="#5d4037"/>'
    + '<circle cx="43.8" cy="36.3" r="1.1" fill="#fff"/>'
    + '<circle cx="59.8" cy="36.3" r="1.1" fill="#fff"/>'
    + '<path d="M46 52 Q50 57 54 52" stroke="#5d4037" fill="none" stroke-width="1.5"/>'
    + '<path d="M70 98 Q88 94 87 106 Q82 101 74 105Z" fill="#ff8f00"/>'
    + '<path d="M83 108 Q87 104 86 109 Q83 110 81 109Z" fill="#fff9c4"/>'
    + '</svg>';
}

function getEnemySVG(level) {
  // Level 1-2: Schleim (cute green slime)
  if (level <= 2) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
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

  // Level 3-4: Kobold (goblin)
  if (level <= 4) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
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

  // Level 5-6: Stein-Golem (stone golem)
  if (level <= 6) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
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

  // Level 7-8: Feuer-Drache (fire dragon)
  if (level <= 8) return '<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">'
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

  // Level 9-10: Mathe-Zauberer Boss (math sorcerer)
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
  // Operations per level:
  //  1-3  → nur + und −  (kleine Zahlen wachsen)
  //  4-5  → + − und selten × (kleine Einmaleins-Einführung)
  //  6-10 → + − × gleichwertig  (Einmaleins wächst mit Level)
  var ops;
  if      (level <= 3) ops = ['+', '-'];
  else if (level <= 5) ops = ['+', '+', '-', '-', '×'];   // × seltener am Anfang
  else                 ops = ['+', '-', '×'];

  var op  = ops[rnd(0, ops.length - 1)];
  var a, b, ans;

  if (op === '+') {
    var mx = 5 + level * 2;                     // Lvl1→7, Lvl5→15, Lvl10→25
    a = rnd(1, mx); b = rnd(1, mx); ans = a + b;

  } else if (op === '-') {
    var mx = 7 + level * 2;                     // Lvl1→9, Lvl5→17, Lvl10→27
    a = rnd(4, mx); b = rnd(1, a - 1); ans = a - b;

  } else {
    // Einmaleins-Tabelle wächst mit Level: Lvl4→2-3, Lvl6→2-5, Lvl10→2-10
    var tbl = Math.min(3 + Math.floor((level - 4) * 1.2), 10);
    a = rnd(2, tbl); b = rnd(2, tbl); ans = a * b;
  }

  return { text: a + ' ' + op + ' ' + b + ' = ?', answer: ans };
}

function generateTasks() {
  G.tasks = [];
  for (var i = 0; i < 5; i++) G.tasks.push(genOne(G.level));
}

// =====================================================================
// HUD
// =====================================================================
function updateHUD() {
  var lvl = $('hud-level'), scr = $('hud-score'), tsk = $('hud-task');
  if (lvl) lvl.textContent = G.level;
  if (scr) scr.textContent = G.trainingMode ? '–' : G.score;
  if (tsk) tsk.textContent = Math.min(G.taskIdx + 1, 5) + '/5';

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
  if (G.trainingMode) {
    var fill = $('time-fill'), txt = $('time-text');
    if (fill) { fill.style.width = '100%'; fill.style.background = '#4CAF50'; }
    if (txt)  txt.textContent = '∞';
    return;
  }
  G.totalTime = Math.max(13, 23 - G.level);
  G.timeLeft = G.totalTime;
  SoundSystem.lastWarningTime = 0;
  updateTimeBar(1);

  var TICK = 100;
  G.timer = setInterval(function() {
    G.timeLeft -= TICK / 1000;
    var p = G.timeLeft / G.totalTime;
    var pct = p * 100;
    updateTimeBar(p);

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

function stopTimer() {
  clearInterval(G.timer);
  SoundSystem.stopMusic();
  SoundSystem.setTempo(1);
}

// =====================================================================
// GAME LOGIC
// =====================================================================
function timeUp() {
  if (G.trainingMode) return;
  G.lives--;
  SoundSystem.playLifeLost();
  flash('rgba(255,0,0,0.35)');
  updateHUD();
  if (G.lives <= 0) {
    setTimeout(function() { stopTimer(); gameOver(); }, 400);
  } else {
    showScreen('screen-timeout');
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

  startTimer();
}

function updateSprites() {
  var ps = $('player-sprite'), es = $('enemy-sprite'), badge = $('enemy-badge');
  if (ps && G.selectedHero !== null) {
    ps.innerHTML = getCharSVG(G.selectedHero);
    var nb = $('player-name-badge');
    if (nb) nb.textContent = G.playerName || CHARACTERS[G.selectedHero].name;
  }
  if (es) {
    // keep badge
    es.innerHTML = getEnemySVG(G.level);
    var b = document.createElement('span');
    b.className = 'enemy-level-badge'; b.id = 'enemy-badge';
    b.textContent = 'LVL ' + G.level;
    es.appendChild(b);
  }
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
  clearInterval(G.timer);      // stop countdown only — music keeps running
  SoundSystem.setTempo(1);     // reset any time-warning tempo boost
  SoundSystem.playCorrect();
  var inp = $('answer-input');
  if (inp) inp.className = 'correct';

  var bonus = 10 * G.level + Math.floor(G.timeLeft * 2);
  G.score += bonus;
  flash('rgba(46,204,113,0.25)');
  updateHUD();

  G.taskIdx++;
  G.enemyHP = Math.max(0, 5 - G.taskIdx);
  updateEnemyHP();

  var isLastTask = (G.taskIdx >= 5);

  // Animate attack
  doAttackAnimation(isLastTask);

  if (isLastTask) {
    setTimeout(levelWin, isLastTask ? 900 : 400);
  } else {
    setTimeout(showTask, 450);
  }
}

function wrongAns() {
  SoundSystem.playWrong();
  flash('rgba(231,76,60,0.35)');

  if (!G.trainingMode) G.lives--;

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
}

function levelWin() {
  stopTimer();
  SoundSystem.playLevelComplete();
  G.totalElapsed = (Date.now() - G.gameStartTime) / 1000;
  var ws = $('win-score'), wl = $('win-level');
  if (ws) ws.textContent = G.score;
  if (wl) wl.textContent = G.level;
  showScreen('screen-level-complete');
}

function nextLevel() {
  G.level++;
  G.taskIdx = 0;
  if (G.level > 10) {
    victory();
  } else {
    generateTasks(); updateHUD(); updateSprites();
    showScreen('screen-game'); showTask();
  }
}

function gameOver() {
  stopTimer();
  SoundSystem.playGameOver();
  if (!G.trainingMode) autoSaveScore();
  showHighscores({ highlightScore: G.score, highlightName: G.playerName,
                   gameOverLevel: G.level, isGameOver: true });
}

function victory() {
  stopTimer();
  SoundSystem.playVictory();
  G.totalElapsed = (Date.now() - G.gameStartTime) / 1000;
  var vs = $('victory-score'), vt = $('victory-time');
  var titleEl = document.querySelector('#screen-victory .overlay-title');
  var subEl   = document.querySelector('#screen-victory .overlay-sub');
  if (G.trainingMode) {
    if (titleEl) titleEl.textContent = 'TRAINING ABGESCHLOSSEN!';
    if (subEl)   subEl.innerHTML = '🎉 Alle Level gemeistert!<br>Super gemacht!';
    if (vs) vs.textContent = '–';
  } else {
    if (titleEl) titleEl.textContent = 'ALLE LEVEL GESCHAFFT!';
    if (subEl)   subEl.innerHTML = '⭐ <span id="victory-score">' + G.score + '</span> Punkte in <span id="victory-time">' + Math.floor(G.totalElapsed) + 's</span><br>Score automatisch gespeichert!';
    if (vs) vs.textContent = G.score;
    autoSaveScore();
  }
  if (vt) vt.textContent = Math.floor(G.totalElapsed) + 's';
  showScreen('screen-victory');
}

// =====================================================================
// HIGHSCORE  (auto-save, hero stored)
// =====================================================================
function autoSaveScore() {
  var scores = loadScores();
  var entry = {
    name: G.playerName || 'Held',
    hero: G.selectedHero !== null ? G.selectedHero : 0,
    score: G.score,
    level: G.level,
    date: new Date().toLocaleDateString('de-DE')
  };
  scores.push(entry);
  scores.sort(function(a, b) { return b.score - a.score; });
  scores = scores.slice(0, 10);
  localStorage.setItem('mathHeroScores', JSON.stringify(scores));
}

function loadScores() {
  try { return JSON.parse(localStorage.getItem('mathHeroScores')) || []; }
  catch (e) { return []; }
}

function showHighscores(opts) {
  opts = opts || {};
  var list   = $('highscore-list');
  var banner = $('hs-gameover-banner');
  var retry  = $('btn-hs-retry');
  var title  = document.querySelector('#screen-highscore h2');
  if (!list) return;

  // Banner & title
  if (opts.isGameOver) {
    if (title)  title.innerHTML = '💀 GAME OVER &nbsp;·&nbsp; 🏆 HIGHSCORE';
    if (banner) {
      banner.innerHTML = 'Level&nbsp;<strong>' + opts.gameOverLevel + '</strong>&nbsp;erreicht &nbsp;·&nbsp; ⭐&nbsp;<strong>' + opts.highlightScore + '</strong>&nbsp;Punkte';
      banner.style.display = 'block';
    }
    if (retry) retry.style.display = 'inline-flex';
  } else {
    if (title)  title.innerHTML = '🏆 HIGHSCORE LISTE';
    if (banner) banner.style.display = 'none';
    if (retry)  retry.style.display = 'none';
  }

  var scores = loadScores();
  if (scores.length === 0) {
    list.innerHTML = '<p class="hs-empty">Noch keine Highscores!</p>';
  } else {
    var medals = ['🥇', '🥈', '🥉'];
    var highlighted = false;
    var html = '<table class="score-table"><tr><th>#</th><th>Held</th><th>Name</th><th>Score</th><th>Level</th><th>Datum</th></tr>';
    scores.forEach(function(s, i) {
      var heroSVG = '<div style="width:36px;height:36px;display:inline-block;">' + getCharSVG(s.hero || 0) + '</div>';
      // Highlight the first row that matches the just-earned score + name
      var isNew = !highlighted && opts.highlightScore !== undefined
                  && s.score === opts.highlightScore
                  && s.name  === opts.highlightName;
      if (isNew) highlighted = true;
      html += '<tr' + (isNew ? ' class="hs-highlight"' : '') + '>';
      html += '<td>' + (medals[i] || (i + 1)) + '</td>';
      html += '<td>' + heroSVG + '</td>';
      html += '<td>' + s.name + '</td>';
      html += '<td>' + s.score + '</td>';
      html += '<td>' + s.level + '</td>';
      html += '<td>' + s.date + '</td>';
      html += '</tr>';
    });
    html += '</table>';
    list.innerHTML = html;
  }
  showScreen('screen-highscore');
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
    html += '<div class="hero-name">' + c.name + '</div>';
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

  G.level = 1; G.score = 0; G.lives = 3; G.taskIdx = 0;
  G._musicLevel = 0;
  G.totalElapsed = 0; G.gameStartTime = Date.now();

  generateTasks(); updateHUD(); updateSprites();
  showScreen('screen-game'); showTask();
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
  G.trainingMode = false;
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
  SoundSystem.startMenuMusic();

  // --- Menu ---
  $('btn-play').addEventListener('click', function() {
    SoundSystem.playClick();
    G.trainingMode = false;
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

  // --- Timeout ---
  $('btn-retry-timeout').addEventListener('click', retryFromTimeout);

  // --- In-game exit to menu ---
  $('btn-hud-exit').addEventListener('click', goToMenu);

  // --- Game over ---
  $('btn-retry-gameover').addEventListener('click', function() {
    SoundSystem.playClick();
    G.level = 1; G.score = 0; G.lives = 3; G.taskIdx = 0;
    G._musicLevel = 0;
    G.totalElapsed = 0; G.gameStartTime = Date.now();
    generateTasks(); updateHUD(); updateSprites();
    showScreen('screen-game'); showTask();
  });
  $('btn-menu-gameover').addEventListener('click', goToMenu);

  // --- Victory ---
  $('btn-menu-victory').addEventListener('click', goToMenu);

  // --- Highscore retry (shown after game over) ---
  $('btn-hs-retry').addEventListener('click', function() {
    SoundSystem.playClick();
    G.level = 1; G.score = 0; G.lives = 3; G.taskIdx = 0;
    G._musicLevel = 0;
    G.totalElapsed = 0; G.gameStartTime = Date.now();
    generateTasks(); updateHUD(); updateSprites();
    showScreen('screen-game'); showTask();
  });

  // --- Highscore ---
  $('btn-back-highscore').addEventListener('click', goToMenu);
  $('btn-clear-scores').addEventListener('click', function() {
    if (confirm('Alle Highscores löschen?')) {
      localStorage.removeItem('mathHeroScores');
      showHighscores();
    }
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

document.addEventListener('DOMContentLoaded', initGame);
if (document.readyState === 'complete' || document.readyState === 'interactive') initGame();
