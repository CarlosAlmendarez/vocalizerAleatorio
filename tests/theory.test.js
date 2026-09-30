/**
 * Motor de teoría (shared/theory.js): escritura de notas, escalas, acordes,
 * grados y transposición contra resultados conocidos de la teoría musical.
 */
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const { createContext, plain } = require('./helpers');
const eq = (actual, expected, msg) => assert.deepEqual(plain(actual), expected, msg);

const { Theory } = createContext(['theory.js']);

test('las 15 tonalidades mayores: cada letra una vez y armadura correcta', () => {
  const MAJOR = {
    C: 'C D E F G A B', G: 'G A B C D E F#', D: 'D E F# G A B C#', A: 'A B C# D E F# G#',
    E: 'E F# G# A B C# D#', B: 'B C# D# E F# G# A#', 'F#': 'F# G# A# B C# D# E#',
    'C#': 'C# D# E# F# G# A# B#', F: 'F G A Bb C D E', Bb: 'Bb C D Eb F G A',
    Eb: 'Eb F G Ab Bb C D', Ab: 'Ab Bb C Db Eb F G', Db: 'Db Eb F Gb Ab Bb C',
    Gb: 'Gb Ab Bb Cb Db Eb F', Cb: 'Cb Db Eb Fb Gb Ab Bb',
  };
  for (const [k, notes] of Object.entries(MAJOR)) {
    assert.equal(Theory.scale(k, 'major').notes.join(' '), notes, `${k} mayor`);
  }
});

test('tonalidades menores naturales', () => {
  const MINOR = {
    A: 'A B C D E F G', E: 'E F# G A B C D', D: 'D E F G A Bb C', 'G#': 'G# A# B C# D# E F#',
    Eb: 'Eb F Gb Ab Bb Cb Db', 'D#': 'D# E# F# G# A# B C#', C: 'C D Eb F G Ab Bb',
  };
  for (const [k, notes] of Object.entries(MINOR)) {
    assert.equal(Theory.scale(k, 'minor').notes.join(' '), notes, `${k} menor`);
  }
});

test('modos y escalas especiales', () => {
  eq(Theory.scale('A', 'harmMinor').notes, ['A', 'B', 'C', 'D', 'E', 'F', 'G#']);
  eq(Theory.scale('B', 'locrian').notes,  ['B', 'C', 'D', 'E', 'F', 'G', 'A']);
  eq(Theory.scale('D', 'dorian').notes,   ['D', 'E', 'F', 'G', 'A', 'B', 'C']);
  eq(Theory.scale('A', 'blues').notes,    ['A', 'C', 'D', 'Eb', 'E', 'G']);
});

test('la tónica elegida tiene la escritura con menos alteraciones', () => {
  const pcs = [...Array(12).keys()];
  eq(pcs.map(p => Theory.bestScaleRoot(p, 'major')),
    ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
  eq(pcs.map(p => Theory.bestScaleRoot(p, 'minor')),
    ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']);
});

test('acordes escritos por grado (sin enarmónicos incorrectos)', () => {
  const cases = [
    ['C', 'min', ['C', 'Eb', 'G']], ['F', 'min', ['F', 'Ab', 'C']], ['C', 'dim', ['C', 'Eb', 'Gb']],
    ['E', 'aug', ['E', 'G#', 'B#']], ['Bb', 'min7', ['Bb', 'Db', 'F', 'Ab']], ['B', 'dim7', ['B', 'D', 'F', 'Ab']],
    ['G', '7', ['G', 'B', 'D', 'F']], ['F#', 'm7b5', ['F#', 'A', 'C', 'E']], ['C', 'add9', ['C', 'E', 'G', 'D']],
    ['D', 'sus2', ['D', 'E', 'A']], ['A', 'sus4', ['A', 'D', 'E']],
  ];
  for (const [root, type, notes] of cases) {
    eq(Theory.chord(root, type).notes, notes, `${root} ${type}`);
  }
});

test('fundamental de acorde con la mejor escritura según el tipo', () => {
  const pcs = [...Array(12).keys()];
  eq(pcs.map(p => Theory.bestRoot(p, 'maj')), ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
  eq(pcs.map(p => Theory.bestRoot(p, 'min')), ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']);
  eq(pcs.map(p => Theory.bestRoot(p, 'dim')), ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
});

test('grados romanos', () => {
  const cases = [['C', 'bVII', 'Bb'], ['C', 'bVI', 'Ab'], ['D', 'bVI', 'Bb'], ['A', 'bVII', 'G'],
                 ['E', 'vi', 'C#'], ['F', 'IV', 'Bb'], ['Eb', 'iii', 'G'], ['C', 'vii°', 'B']];
  for (const [key, deg, root] of cases) assert.equal(Theory.degreeRoot(key, deg), root, `${deg} en ${key}`);
});

test('transposición por intervalo entre tonalidades', () => {
  assert.equal(Theory.transposeName('Bb', 'C', 'D'), 'C');
  assert.equal(Theory.transposeName('F#', 'C', 'Db'), 'G');
  assert.equal(Theory.transposeName('E', 'C', 'Db'), 'F');
  assert.equal(Theory.transposeName('A', 'C', 'Eb'), 'C');
  assert.equal(Theory.transposeName('Eb', 'C', 'Ab'), 'Cb');
  assert.equal(Theory.transposeName('F#', 'C', 'F#'), 'B#');   // 4ª aumentada: correcto por letra
});

test('MIDI y presentación', () => {
  eq([Theory.midi('C4'), Theory.midi('B#3'), Theory.midi('Cb4'), Theory.midi('A4')], [60, 60, 59, 69]);
  assert.equal(Theory.display('Eb', 'es'), 'Mi♭');
  assert.equal(Theory.display('F#4', 'en'), 'F♯4');
  assert.equal(Theory.simplify('Fbb'), 'Eb');
});
