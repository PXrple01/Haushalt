// Zufall mit Startwert (mulberry32): beide Handys erzeugen aus demselben Seed dieselben Rätsel.
export function hashStr(s) {
  let h = 1779033703 ^ String(s).length;
  for (const ch of String(s)) {
    h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function makeRng(seed) {
  let a = hashStr(seed)();
  const next = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = () => next();
  rng.int = (a0, b0) => a0 + Math.floor(next() * (b0 - a0 + 1));
  rng.pick = (arr) => arr[Math.floor(next() * arr.length)];
  rng.shuffle = (arr) => {
    const x = arr.slice();
    for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
    return x;
  };
  rng.sample = (arr, n) => rng.shuffle(arr).slice(0, n);
  rng.chance = (p) => next() < p;
  return rng;
}
