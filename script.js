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
  enemyHP: 5,          // visual HP for enemy
  enemyMaxHP: 5
};

// =====================================================================
// SOUND SYSTEM
// =====================================================================
const SoundSystem = {
  audioCtx: null,
  bgmTimeout: null,
  currentTempo: 1,
  isPlaying: false,
  menuPlaying: false,
  menuTimeout: null,
  lastWarningTime: 0,

  init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
  },

  // Play a single note with optional vibrato
  playNote(freq, duration, type, volume, vibrato) {
    freq = freq || 440; duration = duration || 0.1;
    type = type || 'sine'; volume = volume || 0.12;
    this.init();
    var ctx = this.audioCtx;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (vibrato) {
      var lfo = ctx.createOscillator();
      var lfoGain = ctx.createGain();
      lfo.frequency.value = 5;
      lfoGain.gain.value = vibrato;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(); lfo.stop(ctx.currentTime + duration);
    }
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + duration);
  },

  // Play a chord (multiple notes at once)
  playChord(freqs, duration, type, volume) {
    var self = this;
    freqs.forEach(function(f) { self.playNote(f, duration, type, volume * 0.6); });
  },

  playCorrect() {
    var self = this;
    // Bright ascending arpeggio
    self.playNote(523, 0.1, 'triangle', 0.15);
    setTimeout(function() { self.playNote(659, 0.1, 'triangle', 0.15); }, 70);
    setTimeout(function() { self.playNote(784, 0.1, 'triangle', 0.15); }, 140);
    setTimeout(function() { self.playChord([784, 988], 0.18, 'triangle', 0.14); }, 210);
  },

  playWrong() {
    var self = this;
    self.playNote(220, 0.12, 'sawtooth', 0.15);
    setTimeout(function() { self.playNote(196, 0.18, 'sawtooth', 0.15); }, 90);
  },

  playTimeWarning() {
    this.playNote(880, 0.07, 'square', 0.09);
  },

  playAttack() {
    var self = this;
    // Swoosh + impact
    self.playNote(400, 0.05, 'sawtooth', 0.12);
    setTimeout(function() { self.playNote(200, 0.15, 'square', 0.15); }, 60);
  },

  playSuperAttack() {
    var self = this;
    // Dramatic power-up + explosion
    var notes = [330, 392, 494, 587, 659, 784, 880];
    notes.forEach(function(n, i) {
      setTimeout(function() { self.playNote(n, 0.1, 'square', 0.14); }, i * 55);
    });
    setTimeout(function() {
      self.playChord([262, 330, 392], 0.5, 'sawtooth', 0.15);
    }, notes.length * 55 + 50);
  },

  playLevelComplete() {
    var self = this;
    // Triumphant fanfare melody: G major ascending + resolution
    var melody = [
      {f:392,d:0.1},{f:392,d:0.1},{f:392,d:0.1},
      {f:523,d:0.3},{f:494,d:0.15},{f:440,d:0.15},
      {f:392,d:0.35},{f:523,d:0.12},{f:659,d:0.4}
    ];
    var t = 0;
    melody.forEach(function(n) {
      (function(note, time) {
        setTimeout(function() { self.playNote(note.f, note.d + 0.05, 'triangle', 0.15); }, time);
      })(n, t);
      t += n.d * 900;
    });
  },

  playGameOver() {
    var self = this;
    var melody = [
      {f:392,d:0.25},{f:349,d:0.25},{f:330,d:0.25},
      {f:294,d:0.35},{f:262,d:0.5}
    ];
    var t = 0;
    melody.forEach(function(n) {
      (function(note, time) {
        setTimeout(function() { self.playNote(note.f, note.d, 'sawtooth', 0.14); }, time);
      })(n, t);
      t += n.d * 1000;
    });
  },

  playVictory() {
    var self = this;
    // Full victory fanfare
    var melody = [
      {f:523,d:0.12},{f:523,d:0.12},{f:523,d:0.12},{f:523,d:0.35},
      {f:415,d:0.35},{f:466,d:0.35},
      {f:523,d:0.18},{f:466,d:0.1},{f:523,d:0.12},
      {f:659,d:0.5},{f:784,d:0.6}
    ];
    var t = 0;
    melody.forEach(function(n) {
      (function(note, time) {
        setTimeout(function() { self.playNote(note.f, note.d + 0.05, 'triangle', 0.15, 3); }, time);
      })(n, t);
      t += n.d * 850;
    });
  },

  playClick() { this.playNote(600, 0.05, 'square', 0.08); },

  playSelect() {
    var self = this;
    self.playNote(440, 0.07, 'triangle', 0.12);
    setTimeout(function() { self.playNote(550, 0.1, 'triangle', 0.14); }, 55);
    setTimeout(function() { self.playNote(660, 0.12, 'triangle', 0.14); }, 110);
  },

  playLifeLost() {
    var self = this;
    self.playNote(349, 0.18, 'sawtooth', 0.15);
    setTimeout(function() { self.playNote(262, 0.28, 'sawtooth', 0.15); }, 140);
  },

  // ---- MENU MUSIC: gentle waltz-like melody in C major ----
  startMenuMusic() {
    var self = this;
    self.stopMenuMusic();
    self.init();
    self.menuPlaying = true;

    // Melody notes + durations (ms): friendly, bouncy tune
    var melody = [
      {f:523,d:280},{f:587,d:200},{f:659,d:200},
      {f:698,d:380},{f:659,d:200},{f:587,d:200},
      {f:523,d:380},{f:494,d:200},{f:440,d:200},
      {f:392,d:380},{f:440,d:200},{f:494,d:200},
      {f:523,d:380},{f:523,d:200},{f:587,d:200},
      {f:659,d:380},{f:784,d:200},{f:740,d:200},
      {f:698,d:380},{f:659,d:200},{f:587,d:200},
      {f:523,d:600}
    ];

    // Bass notes (harmony)
    var bass = [
      {f:262,d:280},{f:0,d:200},{f:0,d:200},
      {f:349,d:380},{f:0,d:200},{f:0,d:200},
      {f:262,d:380},{f:0,d:200},{f:0,d:200},
      {f:196,d:380},{f:0,d:200},{f:0,d:200},
      {f:262,d:380},{f:0,d:200},{f:0,d:200},
      {f:330,d:380},{f:0,d:200},{f:0,d:200},
      {f:349,d:380},{f:0,d:200},{f:0,d:200},
      {f:262,d:600}
    ];

    var idx = 0;
    function playNextMenuNote() {
      if (!self.menuPlaying) return;
      var note = melody[idx];
      var b = bass[idx];
      if (note.f > 0) self.playNote(note.f, note.d / 1000 * 0.85, 'triangle', 0.1, 2);
      if (b && b.f > 0) self.playNote(b.f, b.d / 1000 * 0.75, 'sine', 0.07);
      var wait = note.d;
      idx = (idx + 1) % melody.length;
      self.menuTimeout = setTimeout(playNextMenuNote, wait);
    }
    playNextMenuNote();
  },

  stopMenuMusic() {
    this.menuPlaying = false;
    if (this.menuTimeout) { clearTimeout(this.menuTimeout); this.menuTimeout = null; }
  },

  // ---- LEVEL MUSIC: proper melodies per level tier ----
  getLevelMelody(level) {
    // Each melody: array of {f, d} — frequency (Hz), duration (ms)
    if (level <= 2) return [
      {f:262,d:300},{f:294,d:300},{f:330,d:300},{f:349,d:300},
      {f:330,d:300},{f:294,d:300},{f:262,d:400},
      {f:330,d:300},{f:349,d:300},{f:392,d:300},{f:349,d:300},
      {f:330,d:300},{f:294,d:300},{f:262,d:500}
    ];
    if (level <= 4) return [
      {f:330,d:250},{f:392,d:250},{f:440,d:250},{f:494,d:250},
      {f:440,d:250},{f:392,d:250},{f:330,d:350},
      {f:440,d:250},{f:494,d:250},{f:523,d:250},{f:494,d:250},
      {f:440,d:250},{f:392,d:250},{f:330,d:450}
    ];
    if (level <= 6) return [
      {f:392,d:200},{f:440,d:200},{f:494,d:200},{f:523,d:200},
      {f:587,d:200},{f:523,d:200},{f:494,d:200},{f:440,d:200},
      {f:392,d:300},{f:440,d:200},{f:523,d:200},{f:494,d:200},
      {f:440,d:200},{f:392,d:200},{f:349,d:200},{f:392,d:350}
    ];
    if (level <= 8) return [
      {f:494,d:160},{f:523,d:160},{f:587,d:160},{f:659,d:160},
      {f:587,d:160},{f:523,d:160},{f:494,d:160},{f:440,d:160},
      {f:523,d:220},{f:587,d:160},{f:659,d:160},{f:698,d:160},
      {f:659,d:160},{f:587,d:160},{f:523,d:160},{f:494,d:280}
    ];
    return [
      {f:587,d:130},{f:659,d:130},{f:698,d:130},{f:784,d:130},
      {f:698,d:130},{f:659,d:130},{f:587,d:130},{f:523,d:130},
      {f:659,d:170},{f:698,d:130},{f:784,d:130},{f:880,d:130},
      {f:784,d:130},{f:698,d:130},{f:659,d:130},{f:587,d:200}
    ];
  },

  startLevelMusic(level) {
    var self = this;
    self.stopMusic();
    self.init();
    self.isPlaying = true;
    self.currentTempo = 1;

    var melody = self.getLevelMelody(level);
    var idx = 0;

    var waveType = 'sine';
    if (level > 3 && level <= 6) waveType = 'triangle';
    else if (level > 6 && level <= 8) waveType = 'square';
    else if (level > 8) waveType = 'sawtooth';

    var volume = 0.07 + (level * 0.007);

    function playNext() {
      if (!self.isPlaying) return;
      var note = melody[idx];
      var dur = (note.d / 1000) / self.currentTempo;
      self.playNote(note.f, dur * 0.88, waveType, volume, level > 6 ? 4 : 0);
      idx = (idx + 1) % melody.length;
      self.bgmTimeout = setTimeout(playNext, note.d / self.currentTempo);
    }
    playNext();
  },

  setTempo(multiplier) { this.currentTempo = multiplier; },

  stopMusic() {
    this.isPlaying = false;
    if (this.bgmTimeout) { clearTimeout(this.bgmTimeout); this.bgmTimeout = null; }
    this.currentTempo = 1;
  }
};

document.addEventListener('click', function() { SoundSystem.init(); }, { once: true });

// =====================================================================
// CHARACTERS & ENEMIES
// =====================================================================
var CHARACTERS = [
  { name: 'Mathe-Magier', color: '#9b59b6' },
  { name: 'Zahlen-Ninja', color: '#2c3e50' },
  { name: 'Rechen-Ritter', color: '#3498db' },
  { name: 'Formel-Fee',    color: '#e91e63' }
];

function getCharSVG(index) {
  if (index === 0) return '<svg viewBox="0 0 100 100"><circle cx="50" cy="65" r="25" fill="#9b59b6"/><circle cx="50" cy="40" r="18" fill="#ffd93d"/><polygon points="50,5 35,40 65,40" fill="#3498db"/><circle cx="44" cy="38" r="3" fill="#000"/><circle cx="56" cy="38" r="3" fill="#000"/><path d="M45 48 Q50 52 55 48" stroke="#000" fill="none" stroke-width="2"/></svg>';
  if (index === 1) return '<svg viewBox="0 0 100 100"><circle cx="50" cy="60" r="28" fill="#2c3e50"/><circle cx="50" cy="38" r="20" fill="#ffd93d"/><rect x="25" y="32" width="50" height="12" fill="#2c3e50"/><circle cx="42" cy="36" r="4" fill="#fff"/><circle cx="58" cy="36" r="4" fill="#fff"/><circle cx="42" cy="36" r="2" fill="#000"/><circle cx="58" cy="36" r="2" fill="#000"/></svg>';
  if (index === 2) return '<svg viewBox="0 0 100 100"><circle cx="50" cy="60" r="28" fill="#3498db"/><circle cx="50" cy="35" r="22" fill="#95a5a6"/><rect x="30" y="20" width="40" height="8" fill="#7f8c8d"/><circle cx="42" cy="38" r="4" fill="#000"/><circle cx="58" cy="38" r="4" fill="#000"/><rect x="42" y="48" width="16" height="4" fill="#7f8c8d"/></svg>';
  return '<svg viewBox="0 0 100 100"><ellipse cx="30" cy="45" rx="15" ry="25" fill="rgba(255,182,193,0.6)"/><ellipse cx="70" cy="45" rx="15" ry="25" fill="rgba(255,182,193,0.6)"/><circle cx="50" cy="60" r="22" fill="#e91e63"/><circle cx="50" cy="38" r="16" fill="#ffd93d"/><circle cx="45" cy="36" r="3" fill="#000"/><circle cx="55" cy="36" r="3" fill="#000"/><path d="M46 44 Q50 48 54 44" stroke="#000" fill="none" stroke-width="2"/></svg>';
}

function getEnemySVG(level) {
  if (level <= 2) return '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="#27ae60"/><circle cx="38" cy="42" r="8" fill="#fff"/><circle cx="62" cy="42" r="8" fill="#fff"/><circle cx="38" cy="42" r="4" fill="#000"/><circle cx="62" cy="42" r="4" fill="#000"/><ellipse cx="50" cy="65" rx="15" ry="8" fill="#2ecc71"/></svg>';
  if (level <= 4) return '<svg viewBox="0 0 100 100"><circle cx="50" cy="55" r="30" fill="#8e44ad"/><circle cx="40" cy="45" r="10" fill="#fff"/><circle cx="60" cy="45" r="10" fill="#fff"/><circle cx="40" cy="45" r="5" fill="#e74c3c"/><circle cx="60" cy="45" r="5" fill="#e74c3c"/><path d="M35 70 Q50 80 65 70" stroke="#fff" fill="none" stroke-width="3"/></svg>';
  if (level <= 6) return '<svg viewBox="0 0 100 100"><polygon points="50,10 90,90 10,90" fill="#e74c3c"/><circle cx="40" cy="55" r="8" fill="#fff"/><circle cx="60" cy="55" r="8" fill="#fff"/><circle cx="40" cy="55" r="4" fill="#000"/><circle cx="60" cy="55" r="4" fill="#000"/><rect x="35" y="72" width="30" height="8" fill="#c0392b"/></svg>';
  if (level <= 8) return '<svg viewBox="0 0 100 100"><rect x="20" y="30" width="60" height="50" rx="10" fill="#3498db"/><circle cx="35" cy="50" r="8" fill="#fff"/><circle cx="65" cy="50" r="8" fill="#fff"/><circle cx="35" cy="50" r="4" fill="#f00"/><circle cx="65" cy="50" r="4" fill="#f00"/><rect x="30" y="68" width="40" height="5" fill="#2980b9"/></svg>';
  return '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="#f39c12"/><circle cx="35" cy="40" r="10" fill="#000"/><circle cx="65" cy="40" r="10" fill="#000"/><circle cx="35" cy="40" r="5" fill="#f00"/><circle cx="65" cy="40" r="5" fill="#f00"/><path d="M30 65 L50 75 L70 65" stroke="#c0392b" fill="none" stroke-width="4"/></svg>';
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
  var ops, max;
  if (level <= 2)      { ops = ['+', '-']; max = 8 + level; }
  else if (level <= 4) { ops = ['+', '-']; max = 15; }
  else if (level <= 6) { ops = ['+', '-', '×']; max = 12; }
  else                 { ops = ['+', '-', '×', '÷']; max = 12; }

  var op = ops[rnd(0, ops.length - 1)];
  var a, b, ans;
  if (op === '+') { a = rnd(1, max); b = rnd(1, Math.min(15, max)); ans = a + b; }
  else if (op === '-') { a = rnd(2, max); b = rnd(1, a - 1); ans = a - b; }
  else if (op === '×') { a = rnd(1, Math.min(10, Math.ceil(max/2)+1)); b = rnd(1, Math.min(10, Math.ceil(max/2)+1)); ans = a * b; }
  else { b = rnd(1, 10); ans = rnd(1, 10); a = b * ans; }
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
  if (scr) scr.textContent = G.score;
  if (tsk) tsk.textContent = Math.min(G.taskIdx + 1, 5) + '/5';

  var heartsDiv = $('hud-hearts');
  if (heartsDiv) {
    var h = '';
    for (var i = 0; i < G.maxLives; i++) {
      h += '<span class="heart ' + (i < G.lives ? 'full' : 'lost') + '">' + (i < G.lives ? '❤️' : '🖤') + '</span>';
    }
    heartsDiv.innerHTML = h;
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
  G.totalTime = Math.max(8, 18 - G.level);
  G.timeLeft = G.totalTime;
  SoundSystem.lastWarningTime = 0;
  SoundSystem.startLevelMusic(G.level);
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
  G.lives--;
  SoundSystem.playLifeLost();
  flash('rgba(255,0,0,0.35)');
  updateHUD();
  if (G.lives <= 0) gameOver();
  else showScreen('screen-timeout');
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
  stopTimer();
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
  // Lose a life on wrong answer
  G.lives--;
  SoundSystem.playWrong();
  flash('rgba(231,76,60,0.35)');

  var inp = $('answer-input');
  if (inp) {
    inp.className = 'wrong';
    inp.value = '';
    setTimeout(function() { inp.className = ''; inp.focus(); }, 400);
  }
  updateHUD();

  if (G.lives <= 0) {
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
  var gs = $('gameover-score'), gl = $('gameover-level');
  if (gs) gs.textContent = G.score;
  if (gl) gl.textContent = G.level;
  // auto-save with known player name
  autoSaveScore();
  showScreen('screen-gameover');
}

function victory() {
  stopTimer();
  SoundSystem.playVictory();
  G.totalElapsed = (Date.now() - G.gameStartTime) / 1000;
  var vs = $('victory-score'), vt = $('victory-time');
  if (vs) vs.textContent = G.score;
  if (vt) vt.textContent = Math.floor(G.totalElapsed) + 's';
  // auto-save
  autoSaveScore();
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

function showHighscores() {
  var list = $('highscore-list');
  if (!list) return;
  var scores = loadScores();

  if (scores.length === 0) {
    list.innerHTML = '<p class="hs-empty">Noch keine Highscores!</p>';
  } else {
    var medals = ['🥇', '🥈', '🥉'];
    var html = '<table class="score-table"><tr><th>#</th><th>Held</th><th>Name</th><th>Score</th><th>Level</th><th>Datum</th></tr>';
    scores.forEach(function(s, i) {
      var heroSVG = '<div style="width:36px;height:36px;display:inline-block;">' + getCharSVG(s.hero || 0) + '</div>';
      html += '<tr>';
      html += '<td>' + (medals[i] || (i + 1)) + '</td>';
      html += '<td>' + heroSVG + '</td>';
      html += '<td>' + s.name + '</td>';
      html += '<td style="color:var(--primary);font-family:var(--font-title)">' + s.score + '</td>';
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
    renderHeroSelect();
    // Prefill name if returning
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

  // --- Game over ---
  $('btn-retry-gameover').addEventListener('click', function() {
    SoundSystem.playClick();
    G.level = 1; G.score = 0; G.lives = 3; G.taskIdx = 0;
    G.totalElapsed = 0; G.gameStartTime = Date.now();
    generateTasks(); updateHUD(); updateSprites();
    showScreen('screen-game'); showTask();
  });
  $('btn-menu-gameover').addEventListener('click', goToMenu);

  // --- Victory ---
  $('btn-menu-victory').addEventListener('click', goToMenu);

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
