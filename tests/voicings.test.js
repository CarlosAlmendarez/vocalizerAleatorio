/**
 * Digitaciones de guitarra, ukulele y bajo: cada posición que muestra la app
 * debe sonar SOLO notas del acorde y todas las necesarias (la 5ª justa se
 * puede omitir en acordes de 4 notas), con la fundamental en el bajo cuando
 * el instrumento lo permite. Se prueba la lógica real de cada app.
 */
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const { createContext, inlineScripts, run } = require('./helpers');

const APPS = [
  { app: 'acordes-guitarra', rootInBass: true,  minPositions: 2 },
  { app: 'acordes-ukulele',  rootInBass: false, minPositions: 2 },   // afinación reentrante
  { app: 'acordes-bajo',     rootInBass: true,  minPositions: 1 },
];
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Carga la parte de datos y digitaciones de la app (hasta el estado de la UI). */
function loadApp(app) {
  const ctx = createContext(['theory.js'], { createStore: () => ({ get: (k, d) => d, set() {} }) });
  const src = inlineScripts(app).find(s => s.includes('function getShapes'));
  assert.ok(src, `${app}: no se encontró getShapes`);
  run(ctx, src.slice(0, src.indexOf('let rootIdx')), app);
  return ctx;
}

for (const { app, rootInBass, minPositions } of APPS) {
  test(`${app}: todas las posiciones de todos los acordes suenan exactamente el acorde`, () => {
    const ctx = loadApp(app);
    const types = run(ctx, 'Object.keys(CHORD_INTERVALS)');
    const tuning = run(ctx, 'OPEN_MIDI');
    const errors = [];
    let positions = 0;
    for (const type of types) {
      for (let root = 0; root < 12; root++) {
        const c = run(ctx, `chordFor(${root}, ${JSON.stringify(type)})`);
        const optional = c.pcs.length === 4 && c.semitones[2] === 7 ? [c.pcs[2]] : [];
        const list = run(ctx, `getShapes(${root}, ${JSON.stringify(type)})`);
        if (list.length < minPositions) errors.push(`${NAMES[root]} ${type}: solo ${list.length} posición(es)`);
        for (const v of list) {
          positions++;
          if (!ctx.Theory.checkVoicing(v.frets, tuning, c.pcs, optional, rootInBass)) {
            errors.push(`${NAMES[root]} ${type}: ${JSON.stringify(v.frets)} suena notas incorrectas`);
          }
          if (v.frets.some(f => f > 24 || f < -1)) errors.push(`${NAMES[root]} ${type}: traste imposible`);
        }
      }
    }
    assert.deepEqual(errors, [], errors.slice(0, 10).join('\n'));
    assert.ok(positions > 100, `${app}: se esperaban cientos de posiciones, hubo ${positions}`);
  });
}

test('acordes-guitarra: con cejillo la forma es la del acorde "de abajo"', () => {
  const ctx = loadApp('acordes-guitarra');
  run(ctx, 'var rootIdx = 9, chordType = "major"; capo = 2;');   // La mayor con cejillo en 2
  assert.equal(run(ctx, 'shapeRootIdx()'), 7);                   // forma de Sol
  const shape = run(ctx, 'getShape(shapeRootIdx(), "major")');
  const tuning = run(ctx, 'OPEN_MIDI');
  const sounding = shape.frets.map((f, s) => f < 0 ? null : (tuning[s] + 2 + f) % 12).filter(x => x !== null);
  assert.ok(sounding.every(pc => [9, 1, 4].includes(pc)), 'con el cejillo debe sonar La mayor (La, Do#, Mi)');
});

test('findVoicings devuelve posiciones en zonas distintas del mástil', () => {
  const { Theory } = createContext(['theory.js']);
  const c = Theory.chord('A', 'min');
  const vs = Theory.findVoicings({ tuning: [40, 45, 50, 55, 59, 64], pcs: c.pcs, rootInBass: true, allowMute: true, minStrings: 4 }, 4);
  assert.ok(vs.length >= 3);
  for (let i = 1; i < vs.length; i++) {
    for (let j = 0; j < i; j++) assert.ok(Math.abs(vs[i].position - vs[j].position) >= 3, 'posiciones demasiado cercanas');
  }
});

test('control negativo: el comprobador rechaza formas incorrectas', () => {
  const { Theory } = createContext(['theory.js']);
  const GUITAR = [40, 45, 50, 55, 59, 64];
  const C = Theory.chord('C', 'maj').pcs;
  assert.equal(Theory.checkVoicing([-1, 3, 2, 0, 1, 0], GUITAR, C, [], true), true,  'Do abierto es correcto');
  assert.equal(Theory.checkVoicing([0, 2, 2, 1, 0, 0], GUITAR, C, [], true), false, 'Mi mayor no es Do');
  assert.equal(Theory.checkVoicing([-1, 3, 4, 5, 4, 3], GUITAR, Theory.chord('C', 'dim').pcs, [], true), false,
    'el antiguo Do° de la app (con Sol) debe rechazarse');
  assert.equal(Theory.checkVoicing([3, 2, 0, 0, 0, 3], GUITAR, C, [], true), false, 'bajo en Sol: no es Do en fundamental');
});
