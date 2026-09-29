/**
 * MusicTools — NotePlayer
 * ---------------------------------------------------------------------------
 * Capa entre el audio (sound-engine.js) y cada app: "qué nota suena, cuándo,
 * y qué se ve en pantalla en ese momento". Antes cada app lo resolvía a su
 * manera (setTimeout, colas propias, pianoInst.stop() global…).
 *
 *   const player = createNotePlayer('acoustic_grand_piano');
 *   player.onStatus(s => …);          // 'loading' | 'ready' | 'suspended' | 'error'
 *   player.preload();                 // descarga el instrumento sin esperar a Play
 *   await player.ready();             // instrumento listo + audio activo
 *   player.note('C4', t, { dur, gain });   // t = tiempo del AudioContext ('duration' también vale)
 *   player.click(t);                  // click de metrónomo
 *   player.ui(t, () => …);            // callback visual cuando el audio llega a t
 *   player.cancel();                  // corta SOLO lo agendado por este player
 *   player.now                         // reloj de audio
 *   player.latencyMs                   // latencia de salida estimada (o null)
 *
 * Los tiempos siempre son del reloj de audio: se combina con transport.js
 * (que decide cuándo) o se usa sola para frases cortas (escalas, acordes).
 * Requiere: soundfont-player + sound-engine.js cargados antes.
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  function NotePlayer(instrument) {
    this.instrument = instrument;
    this.status     = 'idle';
    this._inst      = null;
    this._loading   = null;
    this._nodes     = [];   // { node, end } notas y clicks agendados
    this._uiQ       = [];   // { time, fn } ordenada por tiempo
    this._raf       = null;
    this._listeners = [];
    this._watchedAc = null;
    this._drain     = this._drain.bind(this);
  }

  Object.defineProperty(NotePlayer.prototype, 'now', {
    get: function () { return soundEngine.now; }
  });

  /** Latencia de salida (ms) si el navegador la informa; útil para mostrar. */
  Object.defineProperty(NotePlayer.prototype, 'latencyMs', {
    get: function () {
      var ac = soundEngine.ac;
      if (!ac) return null;
      var s = (ac.baseLatency || 0) + (ac.outputLatency || 0);
      return s > 0 ? Math.round(s * 1000) : null;
    }
  });

  NotePlayer.prototype.onStatus = function (fn) {
    this._listeners.push(fn);
    fn(this.status);
  };

  NotePlayer.prototype._setStatus = function (s) {
    if (s === this.status) return;
    this.status = s;
    this._listeners.forEach(function (fn) {
      try { fn(s); } catch (e) { console.error('[NotePlayer] onStatus', e); }
    });
  };

  /* Refleja en el estado cuando el sistema suspende o reanuda el audio
     (pantalla bloqueada, llamada, otra app de audio…). */
  NotePlayer.prototype._watchContext = function () {
    var ac = soundEngine.ac, self = this;
    if (!ac || this._watchedAc === ac) return;
    this._watchedAc = ac;
    ac.addEventListener('statechange', function () { self._syncStatus(); });
  };

  NotePlayer.prototype._syncStatus = function () {
    if (!this._inst) return;
    var ac = soundEngine.ac;
    this._setStatus(ac && ac.state === 'running' ? 'ready' : 'suspended');
  };

  /** Descarga el instrumento (sin gesto del usuario). Idempotente. */
  NotePlayer.prototype.preload = function () {
    var self = this;
    if (this._inst) return Promise.resolve(this._inst);
    if (this._loading) return this._loading;
    this._setStatus('loading');
    this._loading = Promise.resolve()
      .then(function () { return soundEngine.preload(self.instrument); })
      .then(function (inst) {
        self._inst = inst;
        self._loading = null;
        self._watchContext();
        self._syncStatus();
        return inst;
      }, function (err) {
        self._loading = null;
        self._setStatus('error');
        throw err;
      });
    return this._loading;
  };

  /** Instrumento cargado y AudioContext activo. Llamar desde un gesto (Play). */
  NotePlayer.prototype.ready = function () {
    var self = this;
    return Promise.resolve(soundEngine.start())
      .then(function () { return self.preload(); })
      .then(function () { self._syncStatus(); return self; });
  };

  NotePlayer.prototype._prune = function () {
    var now = this.now;
    if (this._nodes.length > 48) {
      this._nodes = this._nodes.filter(function (n) { return n.end > now; });
    }
  };

  NotePlayer.prototype.note = function (note, time, opts) {
    if (!this._inst || !note) return null;
    opts = opts || {};
    var dur  = opts.dur != null ? opts.dur : (opts.duration != null ? opts.duration : 1);
    var node = this._inst.play(note, time, { duration: dur, gain: opts.gain != null ? opts.gain : 0.9 });
    if (node) this._nodes.push({ node: node, end: time + dur + 1 });   // +1 s de release
    this._prune();
    return node;
  };

  NotePlayer.prototype.click = function (time) {
    var osc = soundEngine.clickAt(time);
    if (osc) this._nodes.push({ node: osc, end: time + 0.1 });
    this._prune();
    return osc;
  };

  /** Ejecuta fn cuando el audio llega a `time` (vía requestAnimationFrame). */
  NotePlayer.prototype.ui = function (time, fn) {
    var q = this._uiQ, i = q.length;
    while (i > 0 && q[i - 1].time > time) i--;   // inserción ordenada
    q.splice(i, 0, { time: time, fn: fn });
    if (!this._raf) this._raf = requestAnimationFrame(this._drain);
  };

  NotePlayer.prototype._drain = function () {
    this._raf = null;
    var now = this.now;
    while (this._uiQ.length && this._uiQ[0].time <= now) {
      var item = this._uiQ.shift();
      try { item.fn(); } catch (e) { console.error('[NotePlayer] ui', e); }
    }
    if (this._uiQ.length) this._raf = requestAnimationFrame(this._drain);
  };

  /** Corta todo lo agendado por este player (notas, clicks y cola visual). */
  NotePlayer.prototype.cancel = function () {
    var now = this.now;
    this._nodes.forEach(function (n) { try { n.node.stop(now); } catch (_) {} });
    this._nodes = [];
    this._uiQ = [];
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  };

  global.NotePlayer = NotePlayer;
  global.createNotePlayer = function (instrument) { return new NotePlayer(instrument); };

}(typeof window !== 'undefined' ? window : this));
