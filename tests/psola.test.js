/**
 * Edición de la altura (shared/psola.js), fase 2 de analisis-vocal: la nota
 * editada suena donde se pidió, el timbre se conserva (sin "ardilla"), el
 * vibrato se puede aplanar y lo que no se edita queda idéntico.
 */
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const { createContext, seededRandom, plain } = require('./helpers');

const { Melody, Psola } = createContext(['pitch.js', 'melody.js', 'psola.js'], { Float32Array, Uint8Array, ArrayBuffer, DataView });
const SR = 48000;

/** Voz sintética: notas { midi, dur, vib (cents) } separadas por 0,1 s; timbre con un formante en ~800 Hz. */
function voice(parts, seed = 2) {
  const rnd = seededRandom(seed);
  let t = 0.15;
  const plan = parts.map(p => { const s = { ...p, start: t + 0.1 }; t = s.start + p.dur; s.end = t; return s; });
  const n = Math.ceil((t + 0.15) * SR), x = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const time = i / SR, s = plan.find(p => time >= p.start && time < p.end);
    if (!s) { x[i] = (rnd() - 0.5) * 0.002; continue; }
    const pitch = s.midi + (s.vib || 0) / 100 * Math.sin(2 * Math.PI * 5.5 * (time - s.start));
    const f0 = 440 * Math.pow(2, (pitch - 69) / 12);
    phase += 2 * Math.PI * f0 / SR;
    const env = Math.min(1, (time - s.start) / 0.03, (s.end - time) / 0.04);
    let v = 0;
    for (let h = 1; h * f0 < 5000; h++) {
      const fh = h * f0;
      v += Math.sin(h * phase) / (1 + Math.pow((fh - 800) / 250, 2)) * (fh < 800 ? 1 : 0.8);   // resonancia fija
    }
    x[i] = 0.1 * env * v + (rnd() - 0.5) * 0.002;
  }
  return { x, plan };
}

function analyze(x) {
  const an = Melody.createAnalyzer(SR);
  an.push(x);
  const frames = an.frames;
  return { frames, ...Melody.analyze(frames) };
}

function edit(x, edits) {
  const a = analyze(x);
  const e = {};
  Object.keys(edits).forEach(k => { e[a.notes[k].i0] = edits[k]; });
  const shifts = Psola.shiftsFor(a.frames, a.curve, a.notes, e);
  return { a, out: Psola.render(x, SR, a.frames, a.curve, shifts), shifts };
}

const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)); };

/** Centroide espectral (Hz, hasta 4 kHz) de una ventana: dónde está el "color" del timbre. */
function centroid(x, from) {
  const N = 4096, re = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = x[from + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  let num = 0, den = 0;
  for (let k = 1; k < N * 4000 / SR; k++) {
    let r = 0, im = 0;
    for (let i = 0; i < N; i++) { const ph = 2 * Math.PI * k * i / N; r += re[i] * Math.cos(ph); im -= re[i] * Math.sin(ph); }
    const mag = Math.hypot(r, im);
    num += mag * k * SR / N; den += mag;
  }
  return num / den;
}

test('sin ediciones, la salida es idéntica al original', () => {
  const { x } = voice([{ midi: 57, dur: 0.6 }, { midi: 60, dur: 0.6 }]);
  const a = analyze(x);
  const out = Psola.render(x, SR, a.frames, a.curve, Psola.shiftsFor(a.frames, a.curve, a.notes, {}));
  assert.equal(out.length, x.length);
  assert.ok(out.every((v, i) => v === x[i]));
});

test('mover una nota: suena en la altura pedida, con la misma duración y volumen', () => {
  for (const [midi, target] of [[57, 59], [57, 54], [64, 64.5], [52, 55], [69, 67]]) {
    const { x } = voice([{ midi, dur: 0.8 }]);
    const { a, out } = edit(x, { 0: { target } });
    assert.equal(out.length, x.length);
    const b = analyze(out);
    assert.equal(b.notes.length, 1, `${midi}→${target}: ${b.notes.length} notas`);
    const got = b.notes[0];
    assert.ok(Math.abs(got.midi - target) * 100 < 6, `${midi}→${target}: salió ${got.midi.toFixed(3)}`);
    assert.ok(Math.abs(got.start - a.notes[0].start) < 0.03 && Math.abs(got.end - a.notes[0].end) < 0.03, 'misma posición');
    const s0 = Math.round(a.notes[0].start * SR), s1 = Math.round(a.notes[0].end * SR);
    const ratio = rms(out, s0, s1) / rms(x, s0, s1);
    assert.ok(ratio > 0.8 && ratio < 1.25, `volumen ×${ratio.toFixed(2)}`);
  }
});

test('conserva el timbre (formantes): sin efecto "ardilla"', () => {
  const { x, plan } = voice([{ midi: 55, dur: 1.0 }]);
  const { out } = edit(x, { 0: { target: 58 } });   // +3 semitonos
  const at = Math.round((plan[0].start + 0.3) * SR);
  const before = centroid(x, at), after = centroid(out, at);
  // Remuestrear (ardilla) movería todo el espectro un 19 %; PSOLA deja el formante en su sitio
  assert.ok(Math.abs(after / before - 1) < 0.08, `centroide ${before.toFixed(0)} → ${after.toFixed(0)} Hz`);
});

test('aplanar el vibrato sin cambiar la nota', () => {
  const { x } = voice([{ midi: 60, dur: 1.2, vib: 60 }]);
  const before = analyze(x).notes[0];
  const { out } = edit(x, { 0: { flatten: 1 } });
  const got = analyze(out).notes[0];
  assert.ok(before.wobble > 30, `vibrato original ±${before.wobble}¢`);
  assert.ok(got.wobble < before.wobble * 0.4, `vibrato tras aplanar ±${got.wobble}¢ (antes ±${before.wobble}¢)`);
  assert.ok(Math.abs(got.midi - before.midi) * 100 < 8, 'la nota no se mueve');
});

test('editar una nota no toca las demás', () => {
  const { x } = voice([{ midi: 57, dur: 0.5 }, { midi: 60, dur: 0.5 }, { midi: 64, dur: 0.5 }]);
  const { a, out } = edit(x, { 1: { target: 62 } });
  const b = analyze(out);
  assert.deepEqual(plain(b.notes.map(n => n.note)), [57, 62, 64]);
  const firstEnd = Math.round(a.notes[0].end * SR), lastStart = Math.round(a.notes[2].start * SR);
  for (let i = 0; i < firstEnd; i++) assert.equal(out[i], x[i], `muestra ${i} cambió`);
  for (let i = lastStart; i < x.length; i++) assert.equal(out[i], x[i], `muestra ${i} cambió`);
});

test('el cambio por frame es exacto dentro de la nota y suave en los bordes', () => {
  const { x } = voice([{ midi: 57, dur: 0.6 }]);
  const a = analyze(x), n = a.notes[0];
  const s = Psola.shiftsFor(a.frames, a.curve, a.notes, { [n.i0]: { target: 59 } });
  const mid = Math.round((n.i0 + n.i1) / 2);
  assert.ok(Math.abs(s[mid] - (59 - a.curve[mid])) < 1e-4);
  for (let i = 1; i < s.length; i++) assert.ok(Math.abs(s[i] - s[i - 1]) <= 2.0 / 7 + 0.05, `salto en el frame ${i}`);
});

test('rendimiento: afinar 10 s de voz tarda mucho menos que su duración', () => {
  const parts = Array.from({ length: 16 }, (_, i) => ({ midi: 55 + (i % 7), dur: 0.5 }));
  const { x } = voice(parts);
  const a = analyze(x);
  const e = {};
  a.notes.forEach(n => { e[n.i0] = { target: n.note + 0.5, flatten: 0.5 }; });
  const t0 = Date.now();
  Psola.render(x, SR, a.frames, a.curve, Psola.shiftsFor(a.frames, a.curve, a.notes, e));
  const ms = Date.now() - t0, sec = x.length / SR;
  assert.ok(ms < sec * 1000 * 0.1, `${ms} ms para ${sec.toFixed(1)} s`);
});
