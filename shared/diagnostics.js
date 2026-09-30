/**
 * MusicTools — Diagnóstico del dispositivo
 * ---------------------------------------------------------------------------
 * Comprueba en el teléfono real lo que las pruebas automáticas no pueden:
 * audio, precisión del reloj, micrófono, modo sin conexión, almacenamiento y
 * pantalla encendida. Genera un informe de texto para copiar y enviar.
 *
 *   MTDiag.run(contenedor, { root: './' })   // desde un gesto (botón)
 *
 * Carga bajo demanda transport.js (Transport.validate) y pitch.js (YIN).
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var INSTRUMENTS = ['acoustic_grand_piano', 'acoustic_guitar_nylon', 'electric_bass_finger'];
  var INSTRUMENT_NAMES = { acoustic_grand_piano: 'piano', acoustic_guitar_nylon: 'guitarra', electric_bass_finger: 'bajo' };

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function timeout(p, ms) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('sin respuesta')); }, ms); })]);
  }

  function Report(container) {
    this.el = container;
    this.rows = [];
    container.innerHTML = '';
  }
  /** Añade o actualiza una fila: status = 'ok' | 'warn' | 'fail' | 'run' */
  Report.prototype.set = function (id, name, status, detail) {
    var row = this.rows.filter(function (r) { return r.id === id; })[0];
    if (!row) {
      row = { id: id, el: document.createElement('div') };
      row.el.className = 'diag-row';
      this.el.appendChild(row.el);
      this.rows.push(row);
    }
    row.name = name; row.status = status; row.detail = detail || '';
    var icon = { ok: '✓', warn: '!', fail: '✕', run: '…' }[status];
    row.el.dataset.status = status;
    row.el.innerHTML = '<span class="diag-icon">' + icon + '</span><span class="diag-name">' + name +
      '</span><span class="diag-detail">' + row.detail + '</span>';
  };
  Report.prototype.text = function () {
    var lines = ['Diagnóstico MusicTools · ' + new Date().toISOString().slice(0, 16).replace('T', ' ')];
    lines.push(navigator.userAgent);
    this.rows.forEach(function (r) {
      var mark = { ok: 'OK', warn: 'AVISO', fail: 'FALLO', run: '...' }[r.status];
      lines.push('[' + mark + '] ' + r.name + ': ' + r.detail.replace(/<[^>]+>/g, ''));
    });
    return lines.join('\n');
  };

  /* ── Comprobaciones ─────────────────────────────────────────────── */

  async function checkAudio(rep) {
    rep.set('audio', 'Audio', 'run', 'iniciando…');
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) { rep.set('audio', 'Audio', 'fail', 'el navegador no tiene Web Audio'); return null; }
    var ac = new AC();
    try { await timeout(ac.resume(), 2000); } catch (_) {}
    var lat = ((ac.baseLatency || 0) + (ac.outputLatency || 0)) * 1000;
    var status = ac.state !== 'running' ? 'fail' : lat > 80 ? 'warn' : 'ok';
    rep.set('audio', 'Audio', status,
      'estado ' + ac.state + ' · ' + ac.sampleRate + ' Hz' + (lat ? ' · latencia ' + Math.round(lat) + ' ms' : ' · latencia no informada') +
      (lat > 80 ? ' (alta: con audífonos Bluetooth es normal)' : ''));
    return ac;
  }

  async function checkTone(rep, ac) {
    if (!ac || ac.state !== 'running') { rep.set('tone', 'Tono de prueba', 'fail', 'sin audio'); return; }
    // La4 suave durante 1 s: la persona confirma si lo oye
    var osc = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    osc.frequency.value = 440;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t); osc.stop(t + 1.05);
    rep.set('tone', 'Tono de prueba', 'ok', 'sonó un La de 1 s · si no lo oíste, revisa volumen y modo silencio');
  }

  async function checkTiming(rep, root) {
    // 48 semicorcheas a 120 BPM = 6 s (el caso más exigente: pasos de 125 ms)
    rep.set('timing', 'Reloj de tempo', 'run', 'midiendo 6 s de semicorcheas a 120 BPM…');
    try {
      if (!global.Transport) await loadScript(root + 'shared/transport.js');
      var r = await timeout(global.Transport.validate(120, 48, { subdiv: 4 }), 12000);
      rep.set('timing', 'Reloj de tempo', r.ok ? 'ok' : 'warn',
        'variación máx. ' + r.maxJitterMs + ' ms · deriva ' + r.driftOverRunMs + ' ms · margen ' + r.minHeadroomMs + ' ms');
    } catch (e) {
      rep.set('timing', 'Reloj de tempo', 'fail', 'no se pudo medir (' + e.message + ')');
    }
  }

  async function checkMic(rep, ac, root) {
    rep.set('mic', 'Micrófono', 'run', 'pidiendo permiso…');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      rep.set('mic', 'Micrófono', 'fail', location.protocol === 'https:' ? 'no disponible en este navegador' : 'requiere HTTPS');
      return;
    }
    var stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    } catch (e) {
      rep.set('mic', 'Micrófono', 'fail', 'permiso denegado o sin micrófono (' + e.name + ')');
      return;
    }
    try {
      if (!global.Pitch) await loadScript(root + 'shared/pitch.js');
      var an = ac.createAnalyser(); an.fftSize = 4096;
      var src = ac.createMediaStreamSource(stream); src.connect(an);
      var buf = new Float32Array(an.fftSize), peak = 0, notes = {};
      rep.set('mic', 'Micrófono', 'run', 'canta o silba una nota durante 3 s…');
      for (var i = 0; i < 30; i++) {
        await sleep(100);
        an.getFloatTimeDomainData(buf);
        for (var k = 0; k < buf.length; k++) peak = Math.max(peak, Math.abs(buf[k]));
        var hz = global.Pitch.detect(buf, ac.sampleRate, 65);
        if (hz > 0) {
          var m = Math.round(global.Pitch.freqToMidi(hz));
          var name = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][m % 12] + (Math.floor(m / 12) - 1);
          notes[name] = (notes[name] || 0) + 1;
        }
      }
      src.disconnect();
      var top = Object.keys(notes).sort(function (a, b) { return notes[b] - notes[a]; })[0];
      var level = Math.round(20 * Math.log10(Math.max(peak, 1e-6)));
      if (!top) rep.set('mic', 'Micrófono', peak > 0.01 ? 'warn' : 'fail',
        'nivel ' + level + ' dB · ' + (peak > 0.01 ? 'se oye sonido pero no una nota clara' : 'no llega sonido'));
      else rep.set('mic', 'Micrófono', 'ok', 'nivel ' + level + ' dB · nota detectada ' + top);
    } finally {
      stream.getTracks().forEach(function (t) { t.stop(); });
    }
  }

  async function checkOffline(rep) {
    if (!('serviceWorker' in navigator) || !global.caches) {
      rep.set('offline', 'Sin conexión', 'warn', 'este navegador no lo permite'); return;
    }
    var reg = await navigator.serviceWorker.getRegistration();
    var keys = await caches.keys();
    var shell = keys.filter(function (k) { return k.indexOf('-shell') > 0; })[0];
    var files = shell ? (await (await caches.open(shell)).keys()).length : 0;
    var have = [];
    for (var i = 0; i < INSTRUMENTS.length; i++) {
      var url = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/' + INSTRUMENTS[i] + '-mp3.js';
      if (await caches.match(url)) have.push(INSTRUMENT_NAMES[INSTRUMENTS[i]]);
    }
    var status = !reg || !reg.active ? 'warn' : files < 10 ? 'warn' : 'ok';
    rep.set('offline', 'Sin conexión', status,
      (reg && reg.active ? 'activo' : 'aún no activo (recarga la página)') + ' · ' + files + ' archivos guardados · sonidos: ' +
      (have.length ? have.join(', ') : 'ninguno (usa "Descargar sonidos")'));
  }

  async function checkStorage(rep) {
    var ok = false;
    try { localStorage.setItem('mt-diag', '1'); ok = localStorage.getItem('mt-diag') === '1'; localStorage.removeItem('mt-diag'); } catch (_) {}
    var detail = ok ? 'los ajustes se guardan' : 'bloqueado (¿modo privado?): los ajustes no se recordarán';
    if (navigator.storage && navigator.storage.estimate) {
      var e = await navigator.storage.estimate();
      detail += ' · usado ' + (e.usage / 1048576).toFixed(1) + ' MB de ' + Math.round(e.quota / 1048576) + ' MB';
    }
    if (navigator.storage && navigator.storage.persisted) {
      detail += (await navigator.storage.persisted()) ? ' · persistente' : ' · el sistema podría borrarlo si falta espacio';
    }
    rep.set('storage', 'Almacenamiento', ok ? 'ok' : 'fail', detail);
  }

  async function checkWake(rep) {
    if (!('wakeLock' in navigator)) {
      rep.set('wake', 'Pantalla encendida', 'warn', 'no disponible: la pantalla puede apagarse mientras practicas');
      return;
    }
    try {
      var lock = await navigator.wakeLock.request('screen');
      await lock.release();
      rep.set('wake', 'Pantalla encendida', 'ok', 'disponible');
    } catch (e) {
      rep.set('wake', 'Pantalla encendida', 'warn', 'rechazada (' + e.name + '); con ahorro de batería puede fallar');
    }
  }

  function device(rep) {
    rep.set('device', 'Dispositivo', 'ok',
      screen.width + '×' + screen.height + ' · densidad ' + (global.devicePixelRatio || 1) + ' · ' +
      (navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' núcleos' : 'núcleos no informados') +
      (navigator.deviceMemory ? ' · ' + navigator.deviceMemory + ' GB' : ''));
  }

  /** Ejecuta todo. Llamar desde un toque del usuario (el audio lo exige). */
  async function run(container, opts) {
    opts = opts || {};
    var root = opts.root || './';
    var rep = new Report(container);
    device(rep);
    var ac = await checkAudio(rep);
    await checkTone(rep, ac);
    await checkTiming(rep, root);
    await checkOffline(rep).catch(function (e) { rep.set('offline', 'Sin conexión', 'fail', e.message); });
    await checkStorage(rep).catch(function (e) { rep.set('storage', 'Almacenamiento', 'fail', e.message); });
    await checkWake(rep);
    if (opts.mic && ac) await checkMic(rep, ac, root).catch(function (e) { rep.set('mic', 'Micrófono', 'fail', e.message); });
    if (ac && ac.close) ac.close().catch(function () {});
    return rep;
  }

  global.MTDiag = { run: run };

}(typeof window !== 'undefined' ? window : this));
