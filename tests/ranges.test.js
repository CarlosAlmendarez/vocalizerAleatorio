/**
 * Rangos de notas decodificadas: cada app declara en createNotePlayer(…, { range })
 * qué notas MIDI decodifica (ahorra memoria: el piano completo ocupa ~100 MB).
 * Una nota fuera del rango sonaría en SILENCIO, sin error visible, así que aquí
 * se calculan todas las notas que cada app puede tocar y se comparan con su rango.
 */
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const { createContext, inlineScripts, run, read, plain } = require('./helpers');

const STUBS = {
  createStore: () => ({ get: (k, d) => d, set() {}, bindInputs: () => [] }),
  createNotePlayer: () => ({ preload: () => Promise.resolve(), note() {}, ui() {}, cancel() {}, setRange: () => Promise.resolve() }),
};

/** Rango declarado en el HTML: createNotePlayer('<instrumento>', { range: [a, b] }) */
function declared(app, instrument) {
  const re = new RegExp(`createNotePlayer\\('${instrument}', \\{ range: \\[(\\d+), (\\d+)\\] \\}\\)`, 'g');
  const all = [...read(`apps/${app}/index.html`).matchAll(re)].map(m => [+m[1], +m[2]]);
  assert.ok(all.length, `${app}: no declara rango para ${instrument}`);
  return all;
}
function assertInside(label, midis, [lo, hi]) {
  const out = [...new Set(midis.filter(m => m < lo || m > hi))].sort((a, b) => a - b);
  assert.deepEqual(out, [], `${label}: notas fuera del rango ${lo}–${hi}: ${out.join(', ')}`);
}
function load(app, marker, extraShared = ['theory.js']) {
  const ctx = createContext(extraShared, STUBS);
  const src = inlineScripts(app).find(s => s.includes(marker));
  assert.ok(src, `${app}: no se encontró "${marker}"`);
  return { ctx, src };
}

// ── Instrumentos de trastes: todas las posiciones × todos los cejillos ──
for (const [app, instrument, capos] of [
  ['acordes-guitarra', 'acoustic_guitar_nylon', 7],
  ['acordes-ukulele',  'acoustic_guitar_nylon', 7],
  ['acordes-bajo',     'electric_bass_finger',  0],
]) {
  test(`${app}: toda posición con cualquier cejillo cae en el rango decodificado`, () => {
    const { ctx, src } = load(app, 'function getShapes');
    run(ctx, src.slice(0, src.indexOf('let rootIdx')), app);
    const tuning = plain(run(ctx, 'OPEN_MIDI'));
    const midis = [];
    for (const type of plain(run(ctx, 'Object.keys(CHORD_INTERVALS)'))) {
      for (let root = 0; root < 12; root++) {
        for (const v of plain(run(ctx, `getShapes(${root}, ${JSON.stringify(type)})`))) {
          for (let capo = 0; capo <= capos; capo++) {
            v.frets.forEach((f, s) => { if (f >= 0) midis.push(tuning[s] + capo + f); });
          }
        }
      }
    }
    assertInside(app, midis, declared(app, instrument)[0]);
  });
}

test('acordes-piano: todos los tipos, fundamentales e inversiones', () => {
  const { ctx, src } = load('acordes-piano', 'function currentMidis');
  run(ctx, src.slice(0, src.indexOf('function drawKeyboard')), 'acordes-piano');
  const midis = [];
  for (const type of plain(run(ctx, 'Object.keys(CHORD_INTERVALS)'))) {
    const n = run(ctx, `CHORD_INTERVALS[${JSON.stringify(type)}].length`);
    for (let root = 0; root < 12; root++) {
      for (let inv = 0; inv < n; inv++) {
        midis.push(...plain(run(ctx, `rootIdx = ${root}; chordType = ${JSON.stringify(type)}; inversion = ${inv}; currentMidis()`)));
      }
    }
  }
  assertInside('acordes-piano', midis, declared('acordes-piano', 'acoustic_grand_piano')[0]);
});

test('escalas: todas las escalas desde las 12 tónicas (y las teclas del teclado)', () => {
  const { ctx, src } = load('escalas', 'function intervalToNote');
  run(ctx, src.slice(0, src.indexOf('function buildScaleNoteSet')), 'escalas');
  const midis = [];
  for (const key of plain(run(ctx, 'Object.keys(SCALES)'))) {
    for (let root = 0; root < 12; root++) {
      plain(run(ctx, `currentRootIdx = ${root}; SCALES[${JSON.stringify(key)}].intervals.map(intervalToNote)`))
        .forEach(n => midis.push(ctx.Theory.midi(n)));
    }
  }
  for (let m = 48; m <= 71; m++) midis.push(m);   // teclado de 2 octavas desde Do3
  assertInside('escalas', midis, declared('escalas', 'acoustic_grand_piano')[0]);
});

test('progresiones: todas las progresiones y la paleta del editor en las 12 tonalidades', () => {
  const { ctx, src } = load('progresiones', 'function getChordNotes');
  run(ctx, src.slice(0, src.indexOf('function renderMoods')), 'progresiones');
  const midis = run(ctx, `(() => {
    const out = [];
    const progs = PROGRESSIONS.concat(PB_PALETTE.map(([d, t]) => ({ degrees: [d], types: [t] })));
    for (let key = 0; key < 12; key++) for (const p of progs) p.degrees.forEach((d, i) => {
      getChordNotes(rootNote(key, d, p), p.types[i], 4).forEach(n => out.push(Theory.midi(n)));
    });
    return out;
  })()`);
  for (const range of declared('progresiones', 'acoustic_grand_piano').concat(declared('progresiones', 'acoustic_guitar_nylon'))) {
    assertInside('progresiones', plain(midis), range);
  }
});

test('entrenamiento auditivo: miles de preguntas en todos los modos, niveles y direcciones', () => {
  const { ctx, src } = load('entrenamiento-auditivo', 'function makeQuestion', ['settings.js']);
  run(ctx, 'var localStorage = { getItem: () => null, setItem() {}, removeItem() {} };');
  run(ctx, src.slice(0, src.indexOf('// ── Audio')) + src.slice(src.indexOf('function noteToMidi'), src.indexOf('async function playNote')), 'ear-a');
  run(ctx, src.slice(src.indexOf('// ── Preguntas'), src.indexOf('// ── Flujo de juego')), 'ear-b');
  const midis = run(ctx, `(() => {
    const out = [];
    for (const mode of ['notes', 'intervals', 'chords']) for (const diff of ['beginner', 'intermediate', 'expert'])
      for (const dir of ['up', 'down', 'harm']) {
        G.mode = mode; G.diff = diff; G.dir = dir;
        for (let i = 0; i < 150; i++) {
          const q = makeQuestion();
          if (q.type === 'notes') out.push(noteToMidi(q.note));
          if (q.type === 'intervals') out.push(noteToMidi(q.root), noteToMidi(q.targetNote));
          if (q.type === 'chords') CHORD_SEMITONES[q.chordType].forEach(s => out.push(noteToMidi(q.root) + s));
        }
      }
    return out;
  })()`);
  assert.ok(midis.length > 3000);
  assertInside('entrenamiento', plain(midis), declared('entrenamiento-auditivo', 'acoustic_grand_piano')[0]);
});

test('afinador: todas las cuerdas de todas las afinaciones y la cuadrícula de referencia', () => {
  const { ctx, src } = load('afinador', 'const INSTRUMENTS', []);
  run(ctx, src.slice(0, src.indexOf('let currentInstrument')), 'afinador');
  const notes = plain(run(ctx, 'Object.values(INSTRUMENTS).flatMap(i => Object.values(i.tunings).flatMap(t => t.notes))'));
  const midis = notes.map(n => createContext(['theory.js']).Theory.midi(n));
  for (let m = 60; m <= 71; m++) midis.push(m);   // botones Do4–Si4
  assertInside('afinador', midis, declared('afinador', 'acoustic_grand_piano')[0]);
});

test('círculo de quintas: acordes diatónicos y escalas de las 12 tonalidades', () => {
  const { ctx, src } = load('quinta', 'const CIRCLE');
  run(ctx, src.slice(0, src.indexOf('// ── SVG rendering')), 'quinta');
  const midis = run(ctx, `(() => {
    const out = [];
    for (const d of CIRCLE) {
      const start = 60 + Theory.pc(d.scale[0]);
      let prev = start - 1;
      d.scale.concat(d.scale[0]).forEach((n, i) => {           // misma cuenta que playScale
        let m = start + ((Theory.pc(n) - Theory.pc(d.scale[0]) + 12) % 12);
        if (i === d.scale.length) m = start + 12;
        while (m <= prev) m += 12;
        prev = m; out.push(m);
      });
      d.scale.forEach(n => [0, 4, 7].forEach(s => out.push(60 + Theory.pc(n) + s)));   // acordes
    }
    return out;
  })()`);
  assertInside('quinta', plain(midis), declared('quinta', 'acoustic_grand_piano')[0]);
});
