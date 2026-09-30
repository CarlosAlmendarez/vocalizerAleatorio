/**
 * Estructura del sitio: que cada herramienta esté registrada en todos los
 * sitios necesarios y que no falte ningún archivo que las páginas o el
 * Service Worker esperan. Errores de este tipo no rompen el código, pero
 * dejan una app fuera del menú o sin funcionar sin conexión.
 */
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const { ROOT, read, inlineScripts } = require('./helpers');

const APPS = fs.readdirSync(path.join(ROOT, 'apps')).filter(d => fs.existsSync(path.join(ROOT, 'apps', d, 'index.html')));
const shell = read('shared/shell.js');
const sw    = read('sw.js');
const home  = read('index.html');

test('hay herramientas', () => assert.ok(APPS.length >= 13, `solo ${APPS.length} apps`));

for (const app of APPS) {
  test(`${app}: registrada en el menú, el inicio y el modo sin conexión`, () => {
    const html = read(`apps/${app}/index.html`);
    const pageId = (/data-page-id="([^"]+)"/.exec(html) || [])[1];
    assert.equal(pageId, app, 'data-page-id debe coincidir con la carpeta');
    assert.match(shell, new RegExp(`id:\\s*'${app}'`), 'falta en TOOLS de shell.js');
    assert.ok(home.includes(`href="apps/${app}/`), 'falta su tarjeta en index.html');
    assert.ok(sw.includes(`'${app}'`), 'falta en APPS de sw.js (no funcionaría sin conexión)');
  });

  test(`${app}: scripts existentes, shell.js al final y JavaScript válido`, () => {
    const html = read(`apps/${app}/index.html`);
    const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
    for (const src of srcs.filter(s => !/^https?:/.test(s))) {
      assert.ok(fs.existsSync(path.join(ROOT, 'apps', app, src)), `no existe ${src}`);
    }
    assert.ok(srcs.length && srcs[srcs.length - 1].endsWith('shared/shell.js'), 'shell.js debe cargarse al final');
    inlineScripts(app).forEach((code, i) => {
      assert.doesNotThrow(() => new Function(code), `error de sintaxis en el script ${i + 1}`);
    });
  });
}

test('sw.js: todos los archivos del modo sin conexión existen', () => {
  const list = (/const SHELL = \[([\s\S]*?)\];/.exec(sw) || [])[1] || '';
  const files = [...list.matchAll(/'([^']+)'/g)].map(m => m[1]).filter(f => f !== './');
  assert.ok(files.length > 5);
  for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), `sw.js lista ${f}, que no existe`);
});

test('todos los shared/*.js están en la caché sin conexión', () => {
  const shared = fs.readdirSync(path.join(ROOT, 'shared')).filter(f => f.endsWith('.js'));
  for (const f of shared) assert.ok(sw.includes(`'shared/${f}'`), `sw.js no guarda shared/${f}`);
});

test('JavaScript compartido e inicio sin errores de sintaxis', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'shared')).filter(f => f.endsWith('.js'))) {
    assert.doesNotThrow(() => new Function(read('shared/' + f)), `shared/${f}`);
  }
  assert.doesNotThrow(() => new Function(sw), 'sw.js');
  inlineScripts('index').forEach(code => assert.doesNotThrow(() => new Function(code), 'index.html'));
  assert.doesNotThrow(() => JSON.parse(read('manifest.webmanifest')), 'manifest.webmanifest');
});

test('secciones del menú inferior existen en el inicio', () => {
  for (const id of ['tools', 'practice', 'settings']) assert.ok(home.includes(`id="${id}"`), `falta #${id}`);
});
