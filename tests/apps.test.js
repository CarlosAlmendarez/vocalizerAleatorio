/**
 * Lógica musical de apps concretas: transpositor (detección de tonalidad,
 * letras vs. acordes, calidades) y progresiones (nombres por grado).
 */
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const { createContext, inlineScripts, run, plain, read } = require('./helpers');

function loadTransposer() {
  const ctx = createContext(['theory.js'], { createStore: () => ({ get: (k, d) => d, set() {} }) });
  const src = inlineScripts('transponer').find(s => s.includes('function detectKey'));
  run(ctx, src.slice(0, src.indexOf('// ── Actualizar UI')), 'transponer');
  return ctx;
}

test('transpositor: detecta la tonalidad de progresiones conocidas', () => {
  const ctx = loadTransposer();
  const key = text => {
    const d = run(ctx, `detectKey(extractChords(${JSON.stringify(text)}))`);
    return d.minor ? ctx.Theory.bestScaleRoot((d.k + 9) % 12, 'minor') + ' menor' : ctx.Theory.keyForPc(d.k) + ' mayor';
  };
  assert.equal(key('G  D  Em  C'), 'G mayor');
  assert.equal(key('C  Am  F  G'), 'C mayor');
  assert.equal(key('Am  G  F  E'), 'A menor');
  assert.equal(key('Em  C  G  D'), 'E menor');
  assert.equal(key('Bb  F  Gm  Eb'), 'Bb mayor');
  assert.equal(key('Dm7  G7  Cmaj7  Cmaj7'), 'C mayor');
});

test('transpositor: la "A" de una letra no es un acorde', () => {
  const ctx = loadTransposer();
  const chords = plain(run(ctx, `extractChords("A veces te veo\\nC   G   Am   F\\nY canto [Dm] fuerte")`));
  assert.deepEqual(chords.map(c => c.root + c.rest), ['C', 'G', 'Am', 'F', 'Dm']);
});

test('transpositor: calidad del acorde a partir del sufijo', () => {
  const ctx = loadTransposer();
  const q = s => run(ctx, `qualityOf(${JSON.stringify(s)})`);
  const cases = { m: 'min', '7': 'dom7', maj7: 'maj7', m7: 'min7', m7b5: 'm7b5', dim: 'dim', '°7': 'dim7',
                  sus4: 'sus4', sus2: 'sus2', '+': 'aug', '': 'maj', '9': 'dom7', 'm/E': 'min' };
  for (const [suffix, quality] of Object.entries(cases)) assert.equal(q(suffix), quality, `"${suffix}"`);
});

test('progresiones: acordes escritos por grado en cualquier tonalidad', () => {
  const ctx = createContext(['theory.js'], { createStore: () => ({ get: (k, d) => d, set() {} }) });
  const src = inlineScripts('progresiones').find(s => s.includes('function chordLabel'));
  run(ctx, src.slice(0, src.indexOf('function romanLabel')), 'progresiones');
  const labels = (id, key) => run(ctx, `(() => { const p = PROGRESSIONS.find(x => x.id === '${id}');
      return p.degrees.map((d, i) => chordLabel(${key}, d, p.types[i], p)).join(' '); })()`);
  assert.equal(labels('andaluz', 0), 'Cm B♭ A♭ G');
  assert.equal(labels('andaluz', 2), 'Dm C B♭ A');
  assert.equal(labels('golden', 0), 'C G Am F');
  assert.equal(labels('golden', 1), 'D♭ A♭ B♭m G♭');
  assert.equal(labels('jazz_251', 10), 'Cm F7 B♭');
});

test('micrófono en iPhone: sesión de grabación mientras se usa y reintento con "auto"', async () => {

  // iPhone simulado: getUserMedia solo funciona con la sesión 'play-and-record' o 'auto'
  const make = acceptPlayAndRecord => {
    const calls = [];
    const audioSession = { type: 'auto' };
    const ctx = createContext([], {
      document: { addEventListener() {} },
      navigator: {
        audioSession,
        mediaDevices: {
          getUserMedia: () => {
            calls.push(audioSession.type);
            const ok = audioSession.type === 'auto' || (acceptPlayAndRecord && audioSession.type === 'play-and-record');
            return ok ? Promise.resolve({ id: 'mic' })
                      : Promise.reject(Object.assign(new Error('AudioSession category is not compatible with audio capture.'), { name: 'InvalidStateError' }));
          },
        },
      },
    });
    ctx.addEventListener = () => {};
    run(ctx, read('shared/sound-engine.js') + '\n;globalThis.__se = soundEngine;', 'sound-engine.js');
    return { se: ctx.__se, audioSession, calls };
  };

  const a = make(true);
  assert.equal(a.audioSession.type, 'playback', 'por defecto, sesión de reproducción (interruptor de silencio)');
  assert.equal((await a.se.getMic({ audio: true })).id, 'mic');
  assert.deepEqual(plain(a.calls), ['play-and-record']);
  a.se.releaseMic();
  assert.equal(a.audioSession.type, 'playback');

  const b = make(false);   // iOS que solo acepta 'auto'
  assert.equal((await b.se.getMic({ audio: true })).id, 'mic');
  assert.deepEqual(plain(b.calls), ['play-and-record', 'auto']);
});
