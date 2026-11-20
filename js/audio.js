// Klänge werden per Web Audio erzeugt – keine fremden Tondateien nötig.

let ctx = null;
export const sound = {
  muted: localStorage.getItem("opa-muted") === "1",
  toggle() {
    this.muted = !this.muted;
    localStorage.setItem("opa-muted", this.muted ? "1" : "0");
    return this.muted;
  },
};

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// beim ersten Tippen freischalten (iOS)
window.addEventListener("pointerdown", () => { try { ac(); } catch {} }, { once: true });

function tone(freq, start, dur, { type = "sine", vol = 0.2, slide = 0, attack = 0.01 } = {}) {
  const c = ac();
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function brass(freq, start, dur, vol = 0.12) {
  tone(freq, start, dur, { type: "sawtooth", vol, attack: 0.04 });
  tone(freq * 1.005, start, dur, { type: "square", vol: vol * 0.4, attack: 0.05 });
  tone(freq / 2, start, dur, { type: "triangle", vol: vol * 0.8, attack: 0.04 });
}

export function play(name) {
  if (sound.muted) return;
  try {
    switch (name) {
      case "click": tone(660, 0, 0.08, { type: "triangle", vol: 0.12 }); break;
      case "tick": tone(1200, 0, 0.05, { type: "square", vol: 0.08 }); break;
      case "lock":
        tone(110, 0, 2.2, { type: "sawtooth", vol: 0.05, attack: 0.3 });
        tone(165, 0, 2.2, { type: "triangle", vol: 0.08, attack: 0.3 });
        for (let i = 0; i < 6; i++) tone(80, i * 0.32, 0.12, { type: "sine", vol: 0.25 });
        break;
      case "correct":
        [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.4, { type: "triangle", vol: 0.18 }));
        break;
      case "wrong":
        tone(300, 0, 0.5, { type: "sawtooth", vol: 0.12, slide: -180 });
        tone(200, 0.25, 0.7, { type: "sawtooth", vol: 0.12, slide: -120 });
        break;
      case "joker": [880, 1175].forEach((f, i) => tone(f, i * 0.08, 0.25, { type: "sine", vol: 0.15 })); break;
      case "level": [392, 523, 659, 784].forEach((f, i) => brass(f, i * 0.12, 0.35, 0.08)); break;
      case "badge": [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.3, { type: "triangle", vol: 0.14 })); break;
      case "fanfare": {
        const seq = [[392, 0, 0.18], [392, 0.2, 0.18], [392, 0.4, 0.18], [523, 0.6, 0.9], [466, 1.55, 0.2], [523, 1.8, 0.2], [659, 2.05, 0.2], [784, 2.3, 1.6]];
        seq.forEach(([f, s, d]) => brass(f, s, d, 0.1));
        [523, 659, 784].forEach((f) => brass(f, 2.3, 1.8, 0.05));
        for (let i = 0; i < 14; i++) tone(70, i * 0.11, 0.1, { type: "sine", vol: 0.2 });
        break;
      }
    }
  } catch (e) { /* Audio nicht verfügbar */ }
}

// Sprachaufnahme abspielen (gibt true zurück, wenn eine Aufnahme existiert)
let current = null;
export function playVoice(url) {
  if (!url || sound.muted) return false;
  try {
    current?.pause();
    current = new Audio(url);
    current.play().catch(() => {});
    return true;
  } catch { return false; }
}
