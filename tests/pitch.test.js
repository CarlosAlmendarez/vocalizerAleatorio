/**
 * Detector de altura YIN (shared/pitch.js), usado por el afinador y el
 * micrófono del vocalizador: señales sintéticas con armónicos y ruido.
 */
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const { createContext, seededRandom } = require('./helpers');

const { Pitch } = createContext(['pitch.js'], { Float32Array });
const SR = 48000;

function signal(f, size, harmonics, rnd) {
  const buf = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const t = i / SR;
    buf[i] = harmonics[0] * Math.sin(2 * Math.PI * f * t)
           + harmonics[1] * Math.sin(4 * Math.PI * f * t)
           + harmonics[2] * Math.sin(6 * Math.PI * f * t)
           + (rnd() - 0.5) * 0.05;   // ruido de fondo
  }
  return buf;
}
const cents = (a, b) => 1200 * Math.log2(a / b);

test('detecta cada semitono de 23 a 1400 Hz con error < 2 cents (sin saltos de octava)', () => {
  const rnd = seededRandom(42);
  // Rangos como los usa la app: [nota más grave, más aguda], minFreq = grave × 0,75
  const RANGES = [[30.87, 200], [82.41, 700], [196, 1400]];
  // Timbres: fundamental fuerte, 2º armónico dominante, seno puro, 3º armónico dominante
  const TIMBRES = [[1, .5, .3], [.3, 1, .4], [1, 0, 0], [.2, .6, 1]];
  let worst = 0, n = 0;
  const misses = [];
  for (const [lo, hi] of RANGES) {
    const min = lo * 0.75, size = min < 40 ? 8192 : 4096;
    for (let f = lo; f <= hi; f *= Math.pow(2, 1 / 12)) {
      for (const h of TIMBRES) {
        n++;
        const d = Pitch.detect(signal(f, size, h, rnd), SR, min);
        if (d < 0) { misses.push(f.toFixed(1)); continue; }
        worst = Math.max(worst, Math.abs(cents(d, f)));
      }
    }
  }
  assert.deepEqual(misses, [], `sin detectar: ${misses.join(', ')} Hz`);
  assert.ok(n > 400, `se esperaban >400 señales, hubo ${n}`);
  assert.ok(worst < 2, `error máximo ${worst.toFixed(2)} cents`);
});

test('silencio y ruido puro no dan una nota', () => {
  const rnd = seededRandom(7);
  assert.equal(Pitch.detect(new Float32Array(4096), SR, 60), -1, 'silencio');
  const noise = new Float32Array(4096).map(() => (rnd() - 0.5) * 0.004);
  assert.equal(Pitch.detect(noise, SR, 60), -1, 'ruido muy bajo');
});

test('freqToMidi', () => {
  assert.equal(Pitch.freqToMidi(440), 69);
  assert.ok(Math.abs(Pitch.freqToMidi(261.63) - 60) < 0.01);
});
