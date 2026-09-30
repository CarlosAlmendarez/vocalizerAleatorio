/**
 * Vocalizer: lógica real de la app (reloj compartido, NotePlayer, teoría,
 * ajustes, micrófono) sobre un DOM y un AudioContext simulados. El tiempo
 * avanza a mano, así que las pruebas son deterministas y rápidas.
 */
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const { createContext, inlineScripts, run, read, memoryStorage } = require('./helpers');

// ── Entorno simulado ─────────────────────────────────────────────────────
function fakeElement() {
  const el = {
    innerText: '', textContent: '', innerHTML: '', value: '0', hidden: false, disabled: false,
    dataset: {}, style: { setProperty() {} }, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    options: { add() {} },
    addEventListener() {}, setAttribute() {}, getAttribute: () => null, scrollIntoView() {},
  };
  return el;
}

// Valores iniciales de los controles, como en la página real
const DEFAULTS = {
  startNote: '24', endNote: '48', pattern: 'triad', scale: 'major', vowelPattern: 'mama',
  practiceMode: 'single', tempo: '100', reference: 'none', routine: 'none',
};

function createVocalizer() {
  const els = {};
  let T = 0;
  const intervals = new Set();
  let rafs = [];
  const played = [];     // { note, time, cut }
  const ac = { state: 'running', baseLatency: 0.01, outputLatency: 0.02, sampleRate: 48000,
               get currentTime() { return T; }, addEventListener() {} };
  const instrument = {
    play(note, time) {
      if (!note) throw new Error('nota indefinida');
      const n = { note, time, cut: false, stop() { n.cut = true; } };
      played.push(n);
      return n;
    },
  };
  const soundEngine = {
    get now() { return T; }, ac, start: async () => {}, preload: async () => instrument,
    keepAwake() {}, clickAt: () => ({ stop() {} }),
  };
  const document = {
    getElementById: id => els[id] || (els[id] = Object.assign(fakeElement(), id in DEFAULTS ? { value: DEFAULTS[id] } : {})),
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
    documentElement: {}, body: {}, hidden: false,
  };

  const ctx = createContext([], {
    document, soundEngine, navigator: {}, location: { search: '', protocol: 'http:', hostname: 'localhost' },
    localStorage: memoryStorage(), Float32Array, URLSearchParams,
    Option: function (text, value) { this.text = text; this.value = String(value); },
    getComputedStyle: () => ({ getPropertyValue: () => '#9d6bff' }),
    requestAnimationFrame: f => { rafs.push(f); return rafs.length; },
    cancelAnimationFrame: () => {},
    setInterval: f => { intervals.add(f); return f; },
    clearInterval: f => { intervals.delete(f); },
    setTimeout: () => 0, clearTimeout: () => {},
    addEventListener() {},
  });
  ['transport.js', 'note-player.js', 'theory.js', 'settings.js', 'pitch.js', 'audio-utils.js']
    .forEach(f => run(ctx, read('shared/' + f), 'shared/' + f));
  run(ctx, inlineScripts('vocalizer').find(s => s.includes('function vocOnStep')), 'vocalizer');
  run(ctx, 'init()');

  const tick = (n = 1) => {
    for (let k = 0; k < n; k++) {
      T += 0.025;
      [...intervals].forEach(f => f());
      const r = rafs; rafs = [];
      r.forEach(f => f(T * 1000));
    }
  };
  const flush = () => new Promise(r => setImmediate(r));
  const state = () => run(ctx, 'state');
  const midi = n => ctx.Theory.midi(n);

  function configure({ mode = 'loop', start = 'C4', end = 'C5', pattern = 'triad', ref = 'none', routine = 'none', bpm = 120 } = {}) {
    const notes = run(ctx, 'notes');
    els.startNote.value = String(notes.indexOf(start));
    els.endNote.value   = String(notes.indexOf(end));
    Object.assign(els.pattern, { value: pattern });
    els.scale.value = 'major';
    els.vowelPattern.value = 'a';
    els.practiceMode.value = mode;
    els.reference.value = ref;
    els.routine.value = routine;
    els.tempo.value = String(bpm);
  }
  async function play() { run(ctx, 'handlePlayBtn()'); await flush(); await flush(); }
  async function runUntilIdle(maxSteps = 4000) {
    for (let i = 0; i < maxSteps && state() !== 'idle'; i += 10) { tick(10); await flush(); }
  }

  return { ctx, els, ac, played, tick, flush, state, midi, configure, play, runUntilIdle,
           setTime: t => { T = t; }, get time() { return T; } };
}

// ── Pruebas ───────────────────────────────────────────────────────────────
test('subir automático: recorre la tesitura sin pasar de "Fin" y termina', async () => {
  const v = createVocalizer();
  v.configure({ mode: 'loop', start: 'C4', end: 'C5', pattern: 'triad' });
  await v.play();
  await v.runUntilIdle();
  assert.equal(v.els.progressInfo.innerText, 'Ejercicio completado ✓');
  assert.equal(v.played.length, 30, '6 repeticiones de 5 notas (bases C4 a F4)');
  assert.equal(Math.max(...v.played.map(p => v.midi(p.note))), 72, 'la nota más aguda es C5');
  assertInRange(v);
});

// Todo lo que suena debe estar dentro de las notas decodificadas (si no, sonaría en silencio)
function assertInRange(v) {
  const [lo, hi] = run(v.ctx, 'player.range.slice()');
  const out = v.played.map(p => v.midi(p.note)).filter(m => m < lo || m > hi);
  assert.deepEqual(out, [], `notas fuera del rango decodificado ${lo}–${hi}`);
}

test('bajar automático: empieza arriba y baja hasta el inicio', async () => {
  const v = createVocalizer();
  v.configure({ mode: 'loop-desc', start: 'C4', end: 'C5', pattern: 'triad' });
  await v.play();
  await v.runUntilIdle();
  assert.equal(v.played[0].note, 'F4', 'primera base: F4 (su tríada llega a C5)');
  assert.equal(v.played[v.played.length - 1].note, 'C4');
  assert.equal(v.played.length, 30);
});

test('pausa: corta lo agendado, no suena nada y retoma en la misma base', async () => {
  const v = createVocalizer();
  v.configure({ mode: 'loop', start: 'C4', end: 'C5' });
  await v.play();
  v.tick(160); await v.flush();
  const base = run(v.ctx, 'currentBaseIdx');
  run(v.ctx, 'handlePlayBtn()');                       // pausa
  assert.equal(v.state(), 'paused');
  assert.ok(v.played.some(p => p.cut), 'las notas pendientes se cortan');
  const before = v.played.length;
  v.tick(80);
  assert.equal(v.played.length, before, 'en pausa no se agendan notas');
  run(v.ctx, 'handlePlayBtn()'); await v.flush(); await v.flush();   // reanudar
  v.tick(10);
  assert.equal(v.state(), 'playing');
  assert.equal(run(v.ctx, 'currentBaseIdx'), base);
});

test('los cambios de patrón se aplican en la siguiente repetición', async () => {
  const v = createVocalizer();
  v.configure({ mode: 'loop', start: 'C4', end: 'C6', pattern: 'triad' });
  await v.play();
  v.tick(20);
  v.els.pattern.value = 'octave';
  v.tick(200);
  assert.equal(run(v.ctx, 'currentConfig.pattern'), 'octave');
  const seq = run(v.ctx, 'seq.slice()');
  assert.equal(v.midi(seq[2]) - v.midi(seq[0]), 12, 'la nueva repetición salta una octava');
});

test('audio suspendido por el sistema: no agenda nada y al volver no amontona notas', async () => {
  const v = createVocalizer();
  v.configure({ mode: 'loop', start: 'C4', end: 'C5' });
  await v.play();
  v.tick(60);
  v.ac.state = 'suspended';
  const before = v.played.length;
  v.setTime(v.time + 8);
  v.tick(20);
  assert.equal(v.played.length, before, 'nada agendado mientras está suspendido');
  v.ac.state = 'running';
  const resumedAt = v.time;
  v.tick(80);
  const after = v.played.slice(before);
  assert.ok(after.length > 0, 'retoma el ejercicio');
  // Lo atrasado NO se agenda en el pasado: sonaría todo de golpe al volver
  assert.ok(after.every(p => p.time >= resumedAt), 'notas agendadas en el pasado (ráfaga al volver)');
  for (let i = 1; i < after.length; i++) {
    assert.ok(after[i].time - after[i - 1].time > 0.01, 'notas amontonadas al volver');
  }
});

test('referencia de acorde antes de cada repetición', async () => {
  const v = createVocalizer();
  v.configure({ mode: 'loop', start: 'C4', end: 'A4', pattern: 'triad', ref: 'chord' });
  await v.play();
  await v.runUntilIdle();
  const first3 = v.played.slice(0, 3);
  assert.deepEqual(first3.map(p => p.note), ['C4', 'E4', 'G4'], 'acorde de Do antes de cantar');
  assert.ok(first3.every(p => p.time === first3[0].time), 'el acorde suena junto');
  assert.equal(v.played.length, 3 * (3 + 5), '3 repeticiones de referencia (3) + tríada (5)');
  assertInRange(v);
});

test('rutina de agilidad: encadena 3 ejercicios sin detenerse', async () => {
  const v = createVocalizer();
  v.configure({ mode: 'loop', start: 'C4', end: 'E5', routine: 'agility' });
  await v.play();
  const patterns = [], firstBase = {};
  for (let i = 0; i < 2000 && v.state() !== 'idle'; i++) {
    v.tick(10); await v.flush();
    const p = run(v.ctx, 'currentConfig.pattern');
    if (patterns[patterns.length - 1] !== p) { patterns.push(p); firstBase[p] = run(v.ctx, 'notes[currentBaseIdx]'); }
  }
  assert.deepEqual(patterns, ['arpeggio', 'scale', 'octave']);
  // El 2º ejercicio es "escala ↓": debe empezar arriba (E5 − octava = E4), no en C4
  assert.equal(firstBase.scale, 'E4', 'el ejercicio descendente de la rutina empieza en su nota más alta');
  assert.equal(firstBase.octave, 'C4', 'el ejercicio ascendente vuelve a empezar abajo');
  assert.equal(v.els.progressInfo.innerText, 'Rutina completada ✓');
  const t = v.played.map(p => p.time);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] - t[i - 1] > 0.01, 'notas amontonadas');
});

test('messa di voce: la nota sostenida no se pisa con la siguiente', async () => {
  const v = createVocalizer();
  v.configure({ mode: 'loop-desc', start: 'C4', end: 'E4', pattern: 'messa' });
  await v.play();
  await v.runUntilIdle();
  assert.deepEqual(v.played.map(p => p.note), ['E4', 'D#4', 'D4', 'C#4', 'C4']);
  assertInRange(v);
  const t = v.played.map(p => p.time);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] - t[i - 1] >= 4, 'separación menor que la nota de 4 s');
});

test('micrófono: evalúa la afinación contra la nota que suena (tolera octavas)', () => {
  const v = createVocalizer();
  const E4 = 329.63;
  run(v.ctx, "micOn = true; state = 'playing'; micTarget = 64; micBuf = new Float32Array(4096);");
  const sing = hz => {
    v.ctx.__hz = hz;
    run(v.ctx, `micAnalyser = { getFloatTimeDomainData: b => { for (let i = 0; i < b.length; i++)
        b[i] = 0.5 * Math.sin(2 * Math.PI * __hz * i / 48000) + 0.2 * Math.sin(4 * Math.PI * __hz * i / 48000); } };
        micLast = -1000; micLoop(0);`);
    return { state: v.els.pitchBox.dataset.state, text: v.els.pitchCents.textContent };
  };
  assert.deepEqual(sing(E4 / 2 * Math.pow(2, 10 / 1200)), { state: 'ok',    text: 'afinado · -1 oct' });
  assert.deepEqual(sing(E4 * Math.pow(2, -40 / 1200)),    { state: 'close', text: 'bajo -40¢' });
  assert.deepEqual(sing(E4 * Math.pow(2, 80 / 1200)),     { state: 'off',   text: 'alto +80¢' });
});

test('rango decodificado: tesitura en el límite agudo con referencia de acorde', async () => {
  const v = createVocalizer();
  v.configure({ mode: 'loop', start: 'A6', end: 'B6', pattern: 'messa', ref: 'chord' });
  await v.play();
  await v.runUntilIdle();
  assert.ok(v.played.length > 0);
  assertInRange(v);
});
