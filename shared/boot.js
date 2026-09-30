/**
 * MusicTools — Boot
 * ---------------------------------------------------------------------------
 * Se carga en el <head> de cada página, justo después de design.css, ANTES
 * del primer dibujo:
 *  · Aplica el tema guardado (antes lo hacía shell.js al final de la página
 *    y con Minimal/Amber se veía un instante el tema Neón).
 *  · Carga las fuentes del tema activo sin bloquear el dibujo. Antes iban en
 *    un @import dentro de design.css, que retenía la página hasta que
 *    respondía Google Fonts, y pedía las familias de los tres temas.
 *
 * shell.js llama a window.MT_loadThemeFonts(id) al cambiar de tema.
 * ---------------------------------------------------------------------------
 */
(function () {
  'use strict';

  var FAMILIES = {
    neon:    'family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700;800',
    minimal: 'family=Inter:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;0,9..144,800;1,9..144,700',
    amber:   'family=Inter:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1'
  };
  var loaded = {};

  function addLink(rel, href, extra) {
    var l = document.createElement('link');
    l.rel = rel;
    l.href = href;
    if (extra) Object.keys(extra).forEach(function (k) { l.setAttribute(k, extra[k]); });
    document.head.appendChild(l);
    return l;
  }

  window.MT_loadThemeFonts = function (theme) {
    var fam = FAMILIES[theme] || FAMILIES.neon;
    if (loaded[fam]) return;
    loaded[fam] = true;
    // media="print" + onload: se descarga en paralelo sin bloquear el dibujo;
    // mientras tanto se ve la fuente del sistema (display=swap).
    var link = addLink('stylesheet', 'https://fonts.googleapis.com/css2?' + fam + '&display=swap', { media: 'print' });
    link.onload = function () { link.media = 'all'; };
  };

  var theme = 'neon';
  try { theme = localStorage.getItem('mt-theme') || 'neon'; } catch (e) {}
  if (!FAMILIES[theme]) theme = 'neon';
  document.documentElement.setAttribute('data-theme', theme);

  addLink('preconnect', 'https://fonts.googleapis.com');
  addLink('preconnect', 'https://fonts.gstatic.com', { crossorigin: '' });
  window.MT_loadThemeFonts(theme);
}());
