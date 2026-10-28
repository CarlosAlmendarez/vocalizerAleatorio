/**
 * Análisis de voz (shared/melody.js), usado por analisis-vocal: se "canta"
 * una melodía sintética (armónicos, vibrato, ligados, desafinación, ruido) y
 * se comprueba que salen las mismas notas, con su desvío y en su sitio.
 */
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const { createContext, seededRandom, plain } = require('./helpers');

const ctx = createContext(['pitch.js', 'melody.js'], { Float32Array, Uint8Array, ArrayBuffer, DataView, isNaN });
const { Melody } = ctx;

const HARMONICS = [1, 0.6, 0.4, 0.25, 0.15, 0.1];

/**
 * Voz sintética. parts: { midi, dur, cents, vib (cents), rate (Hz), gap (s de
 * silencio antes; 0 = ligado), glide (s de portamento desde la nota anterior),
 * dip (rearticula la misma nota bajando el volumen, sin silencio), trem
 * (oscilación de volumen junto al vibrato, 0.2 = ±20 %) }
 */
function sing(parts, sr = 48000, seed = 3) {
  const rnd = seededRandom(seed);
  const lead = 0.15;
  let t = lead;
  const plan = parts.map(p => {
    const gap = p.gap === undefined ? 0.1 : p.gap;
    t += gap;
    const seg = { ...p, gap, start: t, end: t + p.dur, cents: p.cents || 0 };
    t += p.dur;
    return seg;
  });
  const total = t + 0.15, n = Math.ceil(total * sr);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const time = i / sr;
    const k = plan.findIndex(s => time >= s.start && time < s.end);
    if (k < 0) { out[i] = (rnd() - 0.5) * 0.002; continue; }
    const s = plan[k], prev = plan[k - 1];
    let pitch = s.midi + s.cents / 100 + (s.vib || 0) / 100 * Math.sin(2 * Math.PI * (s.rate || 5.5) * (time - s.start));
    if (s.glide && prev && time - s.start < s.glide) {
      const a = (time - s.start) / s.glide;
      pitch = (prev.midi + prev.cents / 100) * (1 - a) + pitch * a;
    }
    phase += 2 * Math.PI * 440 * Math.pow(2, (pitch - 69) / 12) / sr;
    // Envolvente: ataque/caída solo donde hay silencio alrededor
    let env = 1;
    const next = plan[k + 1];
    if (s.gap > 0) env = Math.min(env, (time - s.start) / 0.03);
    if (!next || next.gap > 0) env = Math.min(env, (s.end - time) / 0.04);
    if (s.dip) env *= 1 - 0.85 * Math.exp(-Math.pow((time - s.start) / 0.03, 2));
    if (s.trem) env *= 1 + s.trem * Math.sin(2 * Math.PI * (s.rate || 5.5) * (time - s.start));
    let v = 0;
    for (let h = 0; h < HARMONICS.length; h++) v += HARMONICS[h] * Math.sin((h + 1) * phase);
    out[i] = 0.12 * Math.max(0, Math.min(1, env)) * v + (rnd() - 0.5) * 0.002;
  }
  return { samples: out, plan };
}

function analyzeSamples(samples, sr = 48000, chunk = 2048) {
  const an = Melody.createAnalyzer(sr);
  for (let i = 0; i < samples.length; i += chunk) an.push(samples.subarray(i, i + chunk));
  return { frames: an.frames, ...Melody.analyze(an.frames) };
}

function assertNotes(notes, plan, { cents = 4, edge = 0.05 } = {}) {
  assert.deepEqual(notes.map(n => n.note), plan.map(p => p.midi), 'notas detectadas');
  notes.forEach((n, i) => {
    const p = plan[i];
    assert.ok(Math.abs(n.cents - p.cents) <= cents, `nota ${i}: ${n.cents}¢, esperado ${p.cents}¢`);
    assert.ok(Math.abs(n.start - p.start) <= edge, `nota ${i}: empieza en ${n.start.toFixed(3)}, esperado ${p.start.toFixed(3)}`);
    assert.ok(Math.abs(n.end - p.end) <= edge, `nota ${i}: termina en ${n.end.toFixed(3)}, esperado ${p.end.toFixed(3)}`);
  });
}

const SCALE = [67, 69, 71, 72, 74].map(midi => ({ midi, dur: 0.4 }));   // Sol4 La4 Si4 Do5 Re5

test('notas separadas: cada una en su sitio y afinada (48 kHz y 44,1 kHz)', () => {
  for (const sr of [48000, 44100]) {
    const { samples, plan } = sing(SCALE, sr);
    const { notes } = analyzeSamples(samples, sr);
    assertNotes(plain(notes), plan, { cents: 3 });
  }
});

test('el vibrato (y su oscilación de volumen) no parte la nota y su centro sale bien', () => {
  const parts = [
    { midi: 64, dur: 0.8, vib: 60, rate: 5.5, trem: 0.2 },
    { midi: 67, dur: 1.0, vib: 100, rate: 4.5 },   // vibrato amplio y lento (ópera)
    { midi: 60, dur: 0.7, vib: 40, rate: 7 },
  ];
  const { samples, plan } = sing(parts);
  const { notes } = analyzeSamples(samples);
  assertNotes(plain(notes), plan, { cents: 12, edge: 0.06 });
  assert.ok(notes[1].wobble > notes[2].wobble, 'más vibrato = más "wobble"');
});

test('desafinación: la nota es la más cercana y el desvío se mide en cents', () => {
  const parts = [{ midi: 69, dur: 0.5, cents: -30 }, { midi: 65, dur: 0.5, cents: 35 }, { midi: 62, dur: 0.5, cents: -45 }];
  const { samples, plan } = sing(parts);
  const { notes } = analyzeSamples(samples);
  assertNotes(plain(notes), plan, { cents: 4 });
});

test('ligado (sin silencio, con portamento): corta entre notas', () => {
  const parts = [
    { midi: 60, dur: 0.45 },
    { midi: 62, dur: 0.45, gap: 0, glide: 0.04 },
    { midi: 64, dur: 0.45, gap: 0, glide: 0.04 },
    { midi: 65, dur: 0.45, gap: 0 },
    { midi: 64, dur: 0.45, gap: 0, glide: 0.06 },
  ];
  const { samples, plan } = sing(parts);
  const { notes } = analyzeSamples(samples);
  assertNotes(plain(notes), plan, { cents: 5, edge: 0.06 });
});

test('misma nota rearticulada sin silencio ("la-la-la"): una nota por sílaba', () => {
  const parts = [{ midi: 69, dur: 0.35 }, { midi: 69, dur: 0.35, gap: 0, dip: true }, { midi: 69, dur: 0.35, gap: 0, dip: true }];
  const { samples, plan } = sing(parts);
  const { notes } = analyzeSamples(samples);
  assert.equal(notes.length, 3, `notas: ${notes.length}`);
  notes.forEach((n, i) => assert.ok(Math.abs(n.start - plan[i].start) < 0.06, `sílaba ${i} en ${n.start.toFixed(3)}`));
});

test('voces extremas: bajo (Sol2) y soprano (Do6)', () => {
  const { samples, plan } = sing([{ midi: 43, dur: 0.5 }, { midi: 48, dur: 0.5 }, { midi: 84, dur: 0.5 }, { midi: 88, dur: 0.4 }]);
  const { notes } = analyzeSamples(samples);
  assertNotes(plain(notes), plan, { cents: 5 });
});

test('el análisis en streaming no depende del tamaño de los bloques', () => {
  const { samples } = sing(SCALE.slice(0, 3));
  const a = analyzeSamples(samples, 48000, 128).frames;
  const b = analyzeSamples(samples, 48000, 2048).frames;
  const an = Melody.createAnalyzer(48000);
  for (let i = 0, k = 0; i < samples.length; k++) { const len = [1000, 37, 4096, 511][k % 4]; an.push(samples.subarray(i, i + len)); i += len; }
  assert.equal(a.length, b.length);
  assert.equal(a.length, an.frames.length);
  for (let i = 0; i < a.length; i++) {
    for (const other of [b[i], an.frames[i]]) {
      assert.ok(Math.abs(a[i].t - other.t) < 1e-9);
      assert.ok((isNaN(a[i].midi) && isNaN(other.midi)) || Math.abs(a[i].midi - other.midi) < 1e-4, `frame ${i}`);
    }
  }
});

test('silencio y ruido no producen notas', () => {
  const rnd = seededRandom(9);
  const noise = new Float32Array(48000 * 2).map(() => (rnd() - 0.5) * 0.01);
  assert.equal(analyzeSamples(noise).notes.length, 0);
});

test('errores de octava y frames sueltos se corrigen', () => {
  const { samples, plan } = sing(SCALE.slice(0, 3));
  const frames = plain(analyzeSamples(samples).frames).map(f => ({ ...f, midi: f.midi === null ? NaN : f.midi }));
  // Saltos de octava de un frame dentro de cada nota y un "pitido" aislado en el silencio
  const firstVoiced = frames.findIndex(f => !isNaN(f.midi));
  [10, 20, 31].forEach(d => { frames[firstVoiced + d].midi += 12; });
  frames[firstVoiced + 45].midi -= 12;
  frames[5].midi = 90; frames[6].midi = 90;
  const { notes } = Melody.analyze(frames);
  assertNotes(plain(notes), plan, { cents: 3 });
});

test('tonalidad: Re mayor, La menor armónica y pocos datos', () => {
  const mk = (midis, durs) => midis.map((note, i) => ({ note, start: i, end: i + (durs ? durs[i] : 1) }));
  const dMaj = Melody.keyOf(mk([62, 64, 66, 67, 69, 71, 73, 74, 69, 66, 62, 69, 62], [2, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 2]));
  assert.deepEqual(plain(dMaj).tonic, 2); assert.equal(dMaj.type, 'major');
  const aMin = Melody.keyOf(mk([69, 71, 72, 74, 76, 77, 80, 81, 76, 72, 69, 64, 69], [2, 1, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 2]));
  assert.equal(aMin.tonic, 9); assert.equal(aMin.type, 'minor');
  assert.equal(Melody.keyOf(mk([60, 62])), null);
});

test('resumen: afinadas, tendencia y peores notas', () => {
  const notes = [
    { note: 60, cents: 5, start: 0, end: 1 },
    { note: 62, cents: 40, start: 1, end: 2 },
    { note: 64, cents: -10, start: 2, end: 4 },
    { note: 67, cents: 60, start: 4, end: 5 },
  ];
  const s = plain(Melody.stats(notes, 25));
  assert.equal(s.count, 4);
  assert.equal(s.inTune, 0.6);
  assert.equal(s.meanCents, 17);   // (5·1 + 40·1 − 10·2 + 60·1) / 5
  assert.equal(s.low, 60); assert.equal(s.high, 67);
  assert.deepEqual(s.worst, [3, 1]);
});

test('exportar: MIDI válido con una nota por cada nota cantada, y WAV', () => {
  const notes = [{ note: 60, start: 0.2, end: 0.7, level: 0.1 }, { note: 64, start: 0.8, end: 1.5, level: 0.05 }];
  const mid = Melody.toMidiFile(notes);
  assert.equal(String.fromCharCode(...mid.slice(0, 4)), 'MThd');
  assert.equal(String.fromCharCode(...mid.slice(14, 18)), 'MTrk');
  const len = (mid[18] << 24) | (mid[19] << 16) | (mid[20] << 8) | mid[21];
  assert.equal(len, mid.length - 22, 'longitud de la pista');
  // Recorre la pista y recoge los note-on
  const ons = [];
  for (let i = 22; i < mid.length;) {
    while (mid[i] & 0x80) i++; i++;            // delta
    const st = mid[i];
    if (st === 0xff) { i += 3 + mid[i + 2]; continue; }
    if (st === 0xc0) { i += 2; continue; }
    if ((st & 0xf0) === 0x90) ons.push(mid[i + 1]);
    i += 3;
  }
  assert.deepEqual(ons, [60, 64]);

  const wav = Melody.toWav(new Float32Array([0, 0.5, -1, 1]), 48000);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), 'RIFF');
  assert.equal(wav.length, 44 + 8);
});

test('rendimiento: 10 s de voz se analizan mucho más rápido que en tiempo real', () => {
  const { samples } = sing(Array.from({ length: 20 }, (_, i) => ({ midi: 60 + (i % 8), dur: 0.4 })));
  const t0 = Date.now();
  const { frames } = analyzeSamples(samples);
  Melody.analyze(frames);
  const ms = Date.now() - t0, sec = samples.length / 48000;
  assert.ok(ms < sec * 1000 * 0.25, `${ms} ms para ${sec.toFixed(1)} s de audio`);
});
