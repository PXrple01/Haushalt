// Töne werden live erzeugt (Web Audio), keine Sound-Dateien nötig. Abschaltbar in den Einstellungen.
import { prefs } from './store.js';

let ac = null;
let master = null;

function ctx() {
  if (!prefs.get('sound')) return null;
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      // iOS 17+: Stummschalter des Handys respektieren
      if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    } catch { /* egal */ }
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.32;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

// Erste Berührung schaltet den Ton frei (Browser-Regel)
export function unlockAudio() {
  const once = () => { ctx(); window.removeEventListener('pointerdown', once, true); window.removeEventListener('keydown', once, true); };
  window.addEventListener('pointerdown', once, true);
  window.addEventListener('keydown', once, true);
}

function tone(freq, { at = 0, dur = 0.14, type = 'sine', vol = 0.5, slide = 0, attack = 0.008 } = {}) {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise({ at = 0, dur = 0.25, vol = 0.18, from = 1800, to = 400 } = {}) {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + at;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

export const sfx = {
  tap: () => tone(N(84), { dur: 0.06, type: 'triangle', vol: 0.18 }),
  pop: () => { tone(N(79), { dur: 0.09, type: 'sine', vol: 0.35, slide: 500 }); },
  good: () => { tone(N(84), { dur: 0.16, vol: 0.4 }); tone(N(88), { at: 0.07, dur: 0.22, vol: 0.38 }); tone(N(96), { at: 0.07, dur: 0.18, type: 'triangle', vol: 0.12 }); },
  bad: () => { tone(N(50), { dur: 0.26, type: 'triangle', vol: 0.5, slide: -40 }); tone(N(43), { at: 0.05, dur: 0.3, type: 'sine', vol: 0.35, slide: -20 }); },
  whoosh: () => noise({ dur: 0.35, vol: 0.16, from: 600, to: 3000 }),
  click: () => { noise({ dur: 0.05, vol: 0.25, from: 3000, to: 2000 }); tone(N(91), { dur: 0.08, vol: 0.25 }); },
  join: () => { tone(N(76), { dur: 0.12, vol: 0.3 }); tone(N(83), { at: 0.09, dur: 0.18, vol: 0.3 }); },
  send: () => { tone(N(81), { dur: 0.08, vol: 0.25, slide: 300 }); },
  win: () => {
    [72, 76, 79, 84].forEach((n, i) => tone(N(n), { at: i * 0.09, dur: 0.2, vol: 0.36, type: 'triangle' }));
    [84, 88, 91].forEach((n) => tone(N(n), { at: 0.42, dur: 0.6, vol: 0.22 }));
  },
  lose: () => { [67, 64, 60].forEach((n, i) => tone(N(n), { at: i * 0.18, dur: 0.26, vol: 0.32, type: 'triangle' })); tone(N(55), { at: 0.56, dur: 0.6, vol: 0.3, type: 'triangle', slide: -30 }); },
  heart: () => { tone(N(48), { dur: 0.12, vol: 0.5, slide: -10 }); tone(N(48), { at: 0.2, dur: 0.14, vol: 0.4, slide: -10 }); },
  sparkle: () => [96, 100, 103, 108].forEach((n, i) => tone(N(n), { at: i * 0.045, dur: 0.12, vol: 0.14 })),
  flip: () => tone(N(88), { dur: 0.05, type: 'square', vol: 0.06 }),
  draw: () => noise({ dur: 0.42, vol: 0.05, from: 2600, to: 1500 }),
  tick: () => tone(N(98), { dur: 0.035, type: 'square', vol: 0.05 }),
  buzz: () => { tone(N(41), { dur: 0.55, type: 'square', vol: 0.12, slide: -8 }); tone(N(46), { dur: 0.55, type: 'triangle', vol: 0.18 }); },
  splash: () => { noise({ dur: 0.5, vol: 0.22, from: 1200, to: 300 }); tone(N(70), { dur: 0.12, vol: 0.12, slide: -300 }); },
  boom: () => { noise({ dur: 0.7, vol: 0.3, from: 900, to: 80 }); tone(N(36), { dur: 0.6, type: 'sine', vol: 0.4, slide: -30 }); },
  unlock: () => { tone(N(79), { dur: 0.08, vol: 0.25, type: 'triangle' }); tone(N(86), { at: 0.08, dur: 0.1, vol: 0.25, type: 'triangle' }); noise({ at: 0.04, dur: 0.12, vol: 0.12, from: 4000, to: 2500 }); },
  note: (n) => { tone(N(n), { dur: 0.55, type: 'sine', vol: 0.3 }); tone(N(n + 12), { dur: 0.32, type: 'triangle', vol: 0.06 }); },
  door: () => { noise({ dur: 0.8, vol: 0.14, from: 380, to: 90 }); tone(N(38), { dur: 0.7, type: 'triangle', vol: 0.22, slide: -8 }); },
  key: () => tone(N(98 + Math.floor(Math.random() * 5)), { dur: 0.018, type: 'square', vol: 0.02 }),
  crack: () => { noise({ dur: 0.12, vol: 0.2, from: 3200, to: 900 }); tone(N(62), { at: 0.02, dur: 0.12, type: 'triangle', vol: 0.18, slide: -60 }); },
};

// Vibration (nur Android-Browser; iPhone ignoriert das)
export function haptic(pattern = 12) {
  if (!prefs.get('haptics')) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; // erst nach der ersten Berührung
  try { navigator.vibrate?.(pattern); } catch { /* egal */ }
}
