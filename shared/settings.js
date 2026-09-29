/**
 * MusicTools — Settings
 * ---------------------------------------------------------------------------
 * Recuerda los ajustes de cada herramienta entre visitas (tesitura del
 * vocalizador, BPM del metrónomo, instrumento del afinador…). Cada app tiene
 * su propio espacio en localStorage; si el navegador lo bloquea (modo
 * privado), todo sigue funcionando, solo que sin recordar.
 *
 *   const store = createStore('metronomo');
 *   store.get('bpm', 120);            // valor guardado o el por defecto
 *   store.set('bpm', 96);
 *   store.bindInputs(['tempo', 'pattern']);  // restaura y guarda controles por id
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  function createStore(appId) {
    var key = 'mt-settings:' + appId;
    var data = {};
    try { data = JSON.parse(localStorage.getItem(key)) || {}; } catch (_) { data = {}; }

    // Escritura inmediata: es barata y un guardado diferido se perdía si el
    // usuario salía de la página justo después de cambiar algo.
    function save() {
      try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) {}
    }

    return {
      get: function (k, fallback) {
        return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : fallback;
      },
      set: function (k, v) { data[k] = v; save(); },
      has: function (k) { return Object.prototype.hasOwnProperty.call(data, k); },

      /**
       * Restaura el valor guardado de cada control (select, input, textarea,
       * checkbox) y lo guarda cuando el usuario lo cambia. Devuelve los ids
       * que se restauraron, por si la app necesita refrescar su interfaz.
       */
      bindInputs: function (ids) {
        var self = this, restored = [];
        ids.forEach(function (id) {
          var el = document.getElementById(id);
          if (!el) return;
          var k = 'input:' + id;
          if (self.has(k)) {
            var v = data[k];
            if (el.type === 'checkbox') { el.checked = !!v; restored.push(id); }
            else if (el.tagName === 'SELECT') {
              // Solo si la opción todavía existe (las listas pueden cambiar entre versiones)
              if ([].some.call(el.options, function (o) { return o.value === String(v); })) { el.value = v; restored.push(id); }
            } else { el.value = v; restored.push(id); }
          }
          var handler = function () { self.set(k, el.type === 'checkbox' ? el.checked : el.value); };
          el.addEventListener('change', handler);
          if (el.tagName !== 'SELECT') el.addEventListener('input', handler);
        });
        return restored;
      }
    };
  }

  global.createStore = createStore;

}(typeof window !== 'undefined' ? window : this));
