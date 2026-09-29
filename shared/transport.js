/**
 * MusicTools — Transport
 * ---------------------------------------------------------------------------
 * Reloj musical compartido por todas las apps que dependen del tempo
 * (metrónomo, groove, vocalizer, progresiones…).
 *
 * Implementa UNA sola vez el patrón "lookahead scheduler" (Chris Wilson,
 * "A Tale of Two Clocks"): un temporizador impreciso (`setInterval`) solo
 * decide QUÉ agendar, y TODO lo que suena se agenda con el reloj de
 * `AudioContext` (`ac.currentTime + n`), que es exacto a nivel de muestra.
 *
 * El paso siguiente se calcula acumulando en el dominio del reloj de audio
 * (`nextTime += stepDur`), nunca con `Date.now()` / `setTimeout`, de modo
 * que NO hay deriva aunque el hilo principal se congele o la pestaña pase
 * a segundo plano.
 *
 * Uso:
 *   const t = createTransport({
 *     getBpm: () => bpm,          // se lee vivo → cambiar el tempo aplica ya
 *     subdiv: 4,                  // pasos por negra (4 = semicorcheas)
 *     onStep: (step, audioTime, stepDur) => { ...agenda sonido en audioTime... },
 *     onDraw: (step) => { ...actualiza la UI, ya sincronizada al audio... },
 *   });
 *   await t.start();
 *   t.stop();
 *
 * Validación (desde la consola del navegador):
 *   await Transport.validate(120)   // mide la precisión real del scheduler
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  /* Desbloqueo de audio para iOS (silent switch) — mismo mecanismo que
     sound-engine.js / shell.js. Se instala una sola vez por AudioContext. */
  function installIOSUnlock(ac) {
    if (!ac || ac.__mtUnlockInstalled) return;
    ac.__mtUnlockInstalled = true;
    var unlock = function () {
      if (ac.state === 'suspended') ac.resume().catch(function () {});
      try {
        var b = ac.createBuffer(1, 1, 22050);
        var s = ac.createBufferSource();
        s.buffer = b;
        s.connect(ac.destination);
        s.start(0);
      } catch (_) {}
    };
    document.addEventListener('touchstart', unlock, { capture: true, passive: true });
    document.addEventListener('click', unlock, { capture: true });
  }

  /* Localiza el soundEngine de sound-engine.js si está en la página.
     Ojo: `const soundEngine` es un binding léxico global, NO una propiedad
     de window, así que hay que referenciarlo directo (protegido por typeof). */
  function findSoundEngine() {
    try { if (typeof soundEngine !== 'undefined' && soundEngine) return soundEngine; } catch (_) {}
    if (typeof global !== 'undefined' && global.soundEngine) return global.soundEngine;
    return null;
  }

  /* AudioContext único para las apps que NO cargan sound-engine.js
     (metrónomo, groove). Las que sí lo cargan reutilizan soundEngine.ac
     para que haya EXACTAMENTE un AudioContext por página (si no, acordes y
     batería irían en relojes distintos y se desfasarían). */
  function resolveSharedContext() {
    var se = findSoundEngine();
    if (se) {
      return Promise.resolve(se.start()).then(function () { return se.ac; });
    }
    if (!resolveSharedContext._ac) {
      var AC = global.AudioContext || global.webkitAudioContext;
      resolveSharedContext._ac = new AC();
      installIOSUnlock(resolveSharedContext._ac);
    }
    return Promise.resolve(resolveSharedContext._ac);
  }

  function Transport(opts) {
    opts = opts || {};
    this.getBpm    = opts.getBpm    || function () { return 120; };
    this.subdiv    = opts.subdiv    || 1;     // pasos por negra
    this.lookahead = opts.lookahead || 0.1;   // s que se agendan por adelantado
    this.tickMs    = opts.tickMs    || 25;    // cada cuánto despierta el scheduler
    this.onStep    = opts.onStep    || function () {};
    this.onDraw    = opts.onDraw    || null;
    this.swing     = opts.swing     || 0;     // 0..~0.6 → retrasa los pasos impares
    this.context   = opts.context   || null;  // AudioContext explícito (opcional)

    this._ac       = null;
    this._timer    = null;
    this._raf      = null;
    this._step     = 0;
    this._nextTime = 0;
    this._drawQ    = [];
    this.running   = false;

    this._tick     = this._tick.bind(this);
    this._drawLoop = this._drawLoop.bind(this);
  }

  /** AudioContext en uso (disponible tras start()). */
  Object.defineProperty(Transport.prototype, 'ctx', {
    get: function () { return this._ac; }
  });

  /** Nº de paso actual (libre, sin envolver). */
  Object.defineProperty(Transport.prototype, 'currentStep', {
    get: function () { return this._step; }
  });

  /** Duración de un paso en segundos — se lee viva en cada tick. */
  Transport.prototype._stepDur = function () {
    var bpm = +this.getBpm() || 120;
    if (bpm < 1) bpm = 1;
    return (60 / bpm) / this.subdiv;
  };

  Transport.prototype._resolveContext = function () {
    var self = this;
    if (this.context) return Promise.resolve(this.context);
    if (this._ac)     return Promise.resolve(this._ac);
    return resolveSharedContext().then(function (ac) { return ac; });
  };

  Transport.prototype.start = function () {
    var self = this;
    if (this.running) return Promise.resolve();
    return this._resolveContext().then(function (ac) {
      self._ac = ac;
      if (ac.state === 'suspended') { try { return ac.resume(); } catch (_) {} }
    }).then(function () {
      self.running   = true;
      self._step     = 0;
      self._nextTime = self._ac.currentTime + 0.06;  // pequeño colchón inicial
      self._drawQ    = [];
      self._timer    = setInterval(self._tick, self.tickMs);
      self._tick();                                   // agenda ya, sin esperar
      if (self.onDraw) self._raf = requestAnimationFrame(self._drawLoop);
    });
  };

  Transport.prototype.stop = function () {
    this.running = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._raf)   { cancelAnimationFrame(this._raf); this._raf = null; }
    this._drawQ = [];
  };

  /** Reinicia el contador de pasos sin parar el reloj. */
  Transport.prototype.resetStep = function (step) {
    this._step = step || 0;
  };

  Transport.prototype._tick = function () {
    if (!this.running || !this._ac) return;
    // Móvil: si el contexto está suspendido/interrumpido (pantalla bloqueada,
    // llamada, app en segundo plano) no se agenda nada; se espera a que vuelva.
    if (this._ac.state !== 'running') return;
    var now = this._ac.currentTime;
    // Si el hilo estuvo congelado y el reloj nos adelantó, NO agendar en
    // ráfaga todos los pasos perdidos (sonarían amontonados): retomar desde ya.
    if (this._nextTime < now - 0.05) this._nextTime = now + 0.05;
    var horizon = now + this.lookahead;
    // Se agendan todos los pasos que caen dentro de la ventana de lookahead.
    while (this._nextTime < horizon) {
      var dur = this._stepDur();
      var when = this._nextTime;
      if (this.swing && (this._step % 2 === 1)) when += dur * this.swing;

      try { this.onStep(this._step, when, dur); }
      catch (e) { console.error('[Transport] onStep', e); }

      if (this.onDraw) this._drawQ.push({ step: this._step, time: when });

      this._step += 1;
      this._nextTime += dur;   // acumulación en el reloj de audio → sin deriva
    }
  };

  Transport.prototype._drawLoop = function () {
    if (!this.running) return;
    var now = this._ac.currentTime;
    // Los callbacks visuales se disparan cuando el audio realmente llega a
    // ese paso, no antes: la UI queda clavada al sonido sin usar setTimeout.
    while (this._drawQ.length && this._drawQ[0].time <= now) {
      var item = this._drawQ.shift();
      try { this.onDraw(item.step); }
      catch (e) { console.error('[Transport] onDraw', e); }
    }
    this._raf = requestAnimationFrame(this._drawLoop);
  };

  /* -------------------------------------------------------------------------
   * Transport.validate(bpm, steps, opts)
   * Mide empíricamente la precisión del scheduler y lo reporta en consola.
   *   - maxJitterMs     : desviación máx. de un intervalo respecto al ideal
   *   - avgJitterMs     : desviación media
   *   - driftOverRunMs  : error acumulado entre el 1er y el último paso
   *   - minHeadroomMs   : margen mínimo con que se agendó un paso (>0 = sano;
   *                       <0 significaría agendar en el pasado → glitch)
   *   - ok              : true si el jitter es sub-milisegundo y no hubo
   *                       underrun
   * ---------------------------------------------------------------------- */
  Transport.validate = function (bpm, steps, opts) {
    bpm   = bpm   || 120;
    steps = steps || 64;
    opts  = opts  || {};
    var subdiv  = opts.subdiv || 1;
    var idealMs = (60 / bpm) / subdiv * 1000;

    var times = [], headroom = [];
    var t = new Transport({
      getBpm: function () { return bpm; },
      subdiv: subdiv,
      lookahead: opts.lookahead || 0.1,
      tickMs: opts.tickMs || 25,
      onStep: function (step, when) {
        times.push(when * 1000);
        headroom.push((when - t.ctx.currentTime) * 1000);
        if (times.length >= steps) t.stop();
      }
    });

    return t.start().then(function () {
      return new Promise(function (res) {
        var iv = setInterval(function () {
          if (!t.running) { clearInterval(iv); res(); }
        }, 20);
      });
    }).then(function () {
      var errs = [];
      for (var i = 1; i < times.length; i++) {
        errs.push(Math.abs((times[i] - times[i - 1]) - idealMs));
      }
      var max  = function (a) { return a.reduce(function (m, x) { return x > m ? x : m; }, -Infinity); };
      var min  = function (a) { return a.reduce(function (m, x) { return x < m ? x : m; },  Infinity); };
      var mean = function (a) { return a.reduce(function (s, x) { return s + x; }, 0) / (a.length || 1); };
      var spanErr = times.length > 1
        ? Math.abs((times[times.length - 1] - times[0]) - idealMs * (times.length - 1))
        : 0;

      var report = {
        bpm: bpm,
        steps: times.length,
        idealStepMs: +idealMs.toFixed(3),
        maxJitterMs: +max(errs).toFixed(3),
        avgJitterMs: +mean(errs).toFixed(3),
        driftOverRunMs: +spanErr.toFixed(3),
        minHeadroomMs: +min(headroom).toFixed(1),
        ok: max(errs) < 1 && min(headroom) > 0
      };
      (report.ok ? console.log : console.warn)('[Transport.validate]', report);
      return report;
    });
  };

  function createTransport(opts) { return new Transport(opts); }

  global.Transport = Transport;
  global.createTransport = createTransport;

}(typeof window !== 'undefined' ? window : this));
