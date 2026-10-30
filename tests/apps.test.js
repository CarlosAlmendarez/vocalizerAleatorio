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

function loadMetronome() {
  const ctx = createContext();
  const src = inlineScripts('metronomo').find(s => s.includes('function gapMuted'));
  run(ctx, src.slice(0, src.indexOf('// ── Fin de la lógica pura')), 'metronomo');
  return ctx;
}

test('metrónomo: agrupaciones y acentos por defecto de compases irregulares', () => {
  const ctx = loadMetronome();
  assert.deepEqual(plain(run(ctx, `parseGrouping('3+3+3+2', 11)`)), [3, 3, 3, 2]);
  assert.deepEqual(plain(run(ctx, `parseGrouping(' 2 + 2 + 3 ', 7)`)), [2, 2, 3]);
  assert.equal(run(ctx, `parseGrouping('3+3', 7)`), null, 'no suma 7');
  assert.equal(run(ctx, `parseGrouping('3+0+4', 7)`), null, 'grupo vacío');
  assert.deepEqual(plain(run(ctx, `defaultAccents(11, [3, 3, 3, 2])`)), [3, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1]);
  assert.deepEqual(plain(run(ctx, `defaultAccents(4, null)`)), [3, 1, 1, 1]);
  // Toda agrupación por defecto suma su número de pulsos
  const groups = plain(run(ctx, 'DEFAULT_GROUPS'));
  for (const [sig, g] of Object.entries(groups)) assert.equal(g.reduce((a, b) => a + b, 0), +sig.split('/')[0], sig);
});

test('metrónomo: reloj interno (compases en silencio)', () => {
  const ctx = loadMetronome();
  const fixed = plain(run(ctx, `Array.from({ length: 10 }, (_, b) => gapMuted(b, { mode: 'fixed', play: 2, mute: 3 }, {}))`));
  assert.deepEqual(fixed, [false, false, true, true, true, false, false, true, true, true]);
  // Aleatorio: los primeros suenan, nunca más de `mute` seguidos y siempre suena uno entre silencios
  for (let seed = 1; seed <= 20; seed++) {
    const seq = plain(run(ctx, `(() => { let s = ${seed}; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
        const st = {}; return Array.from({ length: 200 }, (_, b) => gapMuted(b, { mode: 'random', play: 3, mute: 2 }, st, rnd)); })()`));
    assert.deepEqual(seq.slice(0, 3), [false, false, false]);
    assert.ok(seq.some(Boolean), 'calla alguna vez');
    let run_ = 0;
    seq.forEach(m => { run_ = m ? run_ + 1 : 0; assert.ok(run_ <= 2, 'racha de silencio demasiado larga'); });
  }
});

function loadEar() {
  const ctx = createContext(['settings.js'], { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  const src = inlineScripts('entrenamiento-auditivo').find(s => s.includes('function makeQuestion'));
  run(ctx, src.slice(0, src.indexOf('// ── Audio')), 'ear-a');
  run(ctx, src.slice(src.indexOf('// ── Preguntas'), src.indexOf('// ── Flujo de juego')), 'ear-b');
  return ctx;
}

test('oído: dictado cantado — se corrige la frase, también una octava abajo', () => {
  const ctx = loadEar();
  const g = (t, s) => plain(run(ctx, `gradeMelody(${JSON.stringify(t)}, ${JSON.stringify(s)}, 50)`));
  assert.equal(g([60, 62, 64], [60.1, 61.8, 64.2]).ok, true);
  const low = g([60, 62, 64], [48.2, 50.1, 51.9]);
  assert.equal(low.ok, true, 'una octava más grave vale');
  assert.equal(low.shift, -12);
  assert.equal(g([60, 62, 64], [60, 62, 64.7]).ok, false, '70 cents fuera');
  assert.equal(g([60, 62, 64], [60, 62]).ok, false, 'falta una nota');
  assert.equal(g([60, 62, 64], [60, 62, 64, 65]).ok, false, 'una de más');
  assert.equal(g([60, 62, 64], [60, 60.2, 62, 64]).ok, true, 'una nota partida en dos cuenta como una');
  assert.equal(g([60, 60, 62], [60, 62]).ok, false, 'dos notas iguales seguidas en la frase no se pueden distinguir de una');
});

test('oído: ritmo — 4 opciones distintas, la correcta entre ellas, cada una cambia un solo pulso', () => {
  const ctx = loadEar();
  for (const diff of ['beginner', 'intermediate', 'expert']) {
    for (let i = 0; i < 60; i++) {
      const q = plain(run(ctx, `G.mode = 'rhythm'; G.diff = '${diff}'; makeQuestion()`));
      const vals = q.choices.map(c => c.value);
      assert.equal(new Set(vals).size, vals.length, 'opciones repetidas');
      assert.ok(vals.length >= 3);
      assert.ok(vals.includes(q.beats.join()), 'falta la correcta');
      assert.notEqual(q.beats[0], 'r', 'el primer pulso suena');
      for (const v of vals) assert.ok(v.split(',').filter((f, k) => f !== q.beats[k]).length <= 1, `${v} cambia más de un pulso`);
      assert.equal(q.cells.length, 16);
    }
  }
});

test('oído: escalas y frases — notas de la escala pedida, frases dentro de una voz media', () => {
  const ctx = loadEar();
  for (const diff of ['beginner', 'intermediate', 'expert']) {
    for (let i = 0; i < 60; i++) {
      const q = plain(run(ctx, `G.mode = 'scales'; G.diff = '${diff}'; makeQuestion()`));
      const st = plain(run(ctx, `SCALE_DEFS[${JSON.stringify(q.scale)}].st`));
      const root = q.notes[0];
      q.notes.forEach(m => assert.ok(st.includes((m - root) % 12), `${q.scale}: nota ${m} fuera de la escala`));
      assert.ok(q.choices.some(c => c.value === q.scale));
      const m = plain(run(ctx, `G.mode = 'melody'; G.diff = '${diff}'; makeQuestion()`));
      assert.equal(m.notes.length, { beginner: 3, intermediate: 4, expert: 5 }[diff]);
      m.notes.forEach(n => assert.ok(n >= 55 && n <= 79, `nota ${n} fuera de la voz media`));
      for (let k = 1; k < m.notes.length; k++) assert.notEqual(m.notes[k], m.notes[k - 1], 'nota repetida seguida');
    }
  }
});

test('transpositor: ChordPro — acordes encima de la letra, en línea y directivas', () => {
  const ctx = loadTransposer();
  const song = t => plain(run(ctx, `parseSong(${JSON.stringify(t)})`));
  const cp = (t, n) => run(ctx, `toChordPro(parseSong(${JSON.stringify(t)}), ${n})`);
  // Línea de acordes encima de la letra → cada acorde sobre su sílaba (por columnas)
  assert.equal(cp('G          D\nCanto bajito al amanecer', 0), '[G]Canto bajit[D]o al amanecer');
  // En línea, con directivas, coro y transposición (también {key})
  const t = '{title: Prueba}\n{key: G}\n{soc}\n[C]Y si me [G]llamas, [D7/F#]voy\n{eoc}';
  assert.equal(cp(t, 0), t);
  run(ctx, 'fromKeyIdx = 7');   // de G a A
  assert.equal(cp(t, 2), '{title: Prueba}\n{key: A}\n{soc}\n[D]Y si me [A]llamas, [E7/G#]voy\n{eoc}');
  run(ctx, 'fromKeyIdx = 0');
  // Línea solo de acordes, letra sin acordes y corchetes que no son acordes
  const s = song('Am  G  F  C\n\nHola [coro] mundo');
  assert.deepEqual(s.map(l => l.type), ['chords', 'empty', 'lyric']);
  assert.equal(s[2].segs.map(x => x.text).join(''), 'Hola [coro] mundo');
  // {key: Em} se reconoce como menor
  assert.deepEqual(plain(run(ctx, `songKey(parseSong(${JSON.stringify('{key: Em}\n[Em]la')}))`)), { k: 4, minor: true });
});
