/**
 * Letras (apps/letras): silabeo del español, métrica (sinalefa y ley del acento
 * final) y rima consonante/asonante contra versos y palabras conocidos.
 */
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const { createContext, inlineScripts, run, plain } = require('./helpers');

const ctx = createContext();
const src = inlineScripts('letras').find(s => s.includes('function syllabify'));
run(ctx, src.slice(0, src.indexOf('// ── Fin de la lógica pura')), 'letras');
const syl = w => plain(run(ctx, `syllabify(${JSON.stringify(w)})`));
const scan = l => plain(run(ctx, `scanLine(${JSON.stringify(l)})`));

test('silabeo: diptongos, hiatos, u muda, y final y grupos consonánticos', () => {
  const cases = {
    'canción': 'can-ción', cielo: 'cie-lo', 'día': 'dí-a', 'país': 'pa-ís', poeta: 'po-e-ta', cuidado: 'cui-da-do',
    guitarra: 'gui-ta-rra', 'pingüino': 'pin-güi-no', ahora: 'a-ho-ra', hambre: 'ham-bre', instante: 'ins-tan-te',
    obstruir: 'obs-truir', calle: 'ca-lle', muchacho: 'mu-cha-cho', quiero: 'quie-ro', 'pájaro': 'pá-ja-ro',
    estoy: 'es-toy', muy: 'muy', huevo: 'hue-vo', 'averigüéis': 'a-ve-ri-güéis',
  };
  for (const [w, want] of Object.entries(cases)) assert.equal(syl(w).syl.join('-'), want, w);
});

test('acento: tilde, llanas (vocal, n, s) y agudas (otra consonante, y final)', () => {
  const stressFromEnd = w => { const r = syl(w); return r.syl.length - 1 - r.stress; };
  assert.equal(stressFromEnd('canción'), 0);
  assert.equal(stressFromEnd('reloj'), 0);
  assert.equal(stressFromEnd('estoy'), 0);
  assert.equal(stressFromEnd('lunes'), 1);
  assert.equal(stressFromEnd('árbol'), 1);
  assert.equal(stressFromEnd('cantan'), 1);
  assert.equal(stressFromEnd('pájaro'), 2);
});

test('métrica de versos conocidos', () => {
  const verses = [
    ['En un lugar de la Mancha', 8],                       // Cervantes
    ['Verde que te quiero verde', 8],                      // Lorca
    ['Caminante, no hay camino,', 8],                      // Machado: sinalefa a través de la h
    ['se hace camino al andar.', 8],                       // aguda: +1
    ['Juventud, divino tesoro,', 9],                       // Darío
    ['En el silencio sólo se escuchaba', 11],
    ['Puedo escribir los versos más tristes esta noche', 14],   // Neruda
    ['el pájaro', 3],                                      // esdrújula: −1
    ['Canta y ríe', 4],                                    // "y" entre vocales
  ];
  for (const [line, n] of verses) assert.equal(scan(line).count, n, `${line} → ${scan(line).parts.map(p => p.text).join('-')}`);
  assert.equal(scan('se hace camino al andar').end, 'aguda');
  assert.equal(scan('[G]Verde que te [D]quiero verde').count, 8, 'los acordes entre corchetes no cuentan');
  assert.equal(scan('...'), null);
});

test('rima consonante y asonante (con seseo)', () => {
  const t = (a, b) => run(ctx, `rhymeType(${JSON.stringify(a)}, ${JSON.stringify(b)})`);
  assert.equal(t('canción', 'corazón'), 'consonante');
  assert.equal(t('cielo', 'suelo'), 'consonante');
  assert.equal(t('casa', 'taza'), 'consonante');
  assert.equal(t('amor', 'dolor'), 'consonante');
  assert.equal(t('luna', 'pluma'), 'asonante');
  assert.equal(t('verde', 'duerme'), 'asonante');
  assert.equal(t('vida', 'día'), 'asonante');
  assert.equal(t('árboles', 'sábanas'), null, 'en las esdrújulas cuentan la tónica y la última: a-e frente a a-a');
  assert.equal(t('mar', 'luna'), null);
});

test('esquema de rima y nombre de la estrofa', () => {
  const scheme = ws => plain(run(ctx, `rhymeScheme(${JSON.stringify(ws)})`)).join('');
  assert.equal(scheme(['amor', 'canción', 'corazón', 'dolor']), 'ABBA');
  assert.equal(scheme(['luna', 'cielo', 'cuna', 'suelo']), 'ABAB');
  assert.equal(scheme(['luna', 'cielo', 'pluma', 'suelo']), 'aBaB', 'luna/pluma solo riman en asonante');
  assert.equal(scheme(['huellas', 'más', 'camino', 'andar']), '-a-a', 'más/andar: asonante (-as / -ar)');
  assert.equal(scheme(['verde', 'ramas', 'mar', 'montaña']), '-a-a');
  assert.equal(run(ctx, `stanzaName([8, 8, 8, 8], ['A', 'B', 'B', 'A'])`), 'Redondilla');
  assert.equal(run(ctx, `stanzaName([11, 11, 11, 11], ['A', 'B', 'A', 'B'])`), 'Serventesio');
});
