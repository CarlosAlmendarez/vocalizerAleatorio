/**
 * Utilidades de prueba: cargan los scripts del navegador (shared/*.js y el
 * <script> de cada app) dentro de un contexto aislado de Node, sin DOM real.
 *
 * Sin dependencias: las pruebas usan node:test y se ejecutan con
 *   node --test tests/*.test.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Contexto nuevo con window = global, y opcionalmente scripts de shared/ ya cargados. */
function createContext(sharedFiles = [], extra = {}) {
  const ctx = vm.createContext({ console, Math, JSON, Date, Array, Object, Set, Map, Promise, ...extra });
  ctx.window = ctx;
  sharedFiles.forEach(f => vm.runInContext(read('shared/' + f), ctx, { filename: 'shared/' + f }));
  return ctx;
}

/** Bloques <script> en línea (sin src) de una app. */
function inlineScripts(app) {
  const html = read(app === 'index' ? 'index.html' : `apps/${app}/index.html`);
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
}

/** Evalúa código en el contexto y devuelve el valor de la última expresión. */
function run(ctx, code, filename = 'inline') {
  return vm.runInContext(code, ctx, { filename });
}

/** Copia a valores simples de este contexto (los arrays del vm tienen otro prototipo). */
const plain = v => JSON.parse(JSON.stringify(v));

/** Generador pseudoaleatorio con semilla: las pruebas no dependen del azar. */
function seededRandom(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** localStorage en memoria para el contexto. */
function memoryStorage() {
  const data = {};
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
    _data: data,
  };
}

module.exports = { ROOT, read, createContext, inlineScripts, run, plain, seededRandom, memoryStorage };
