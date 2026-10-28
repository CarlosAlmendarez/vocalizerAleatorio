/**
 * MusicTools — Melody
 * ---------------------------------------------------------------------------
 * Análisis de una voz grabada: la curva de afinación continua y las notas
 * que se cantaron (los "blobs" al estilo Melodyne). Lo usa analisis-vocal.
 *
 *   const an = Melody.createAnalyzer(ac.sampleRate);
 *   an.push(float32Chunk)   → frames nuevos { t, midi (NaN = sin voz), rms }
 *   an.frames               → todos los frames (uno cada 10 ms)
 *
 *   const { curve, notes } = Melody.analyze(an.frames);
 *       curve[i]  altura limpia del frame i (MIDI con decimales, NaN = silencio)
 *       notes     [{ start, end, i0, i1, midi, note, cents, wobble, level }]
 *   Melody.keyOf(notes)        → { tonic: pc, type: 'major'|'minor', score } o null
 *   Melody.stats(notes, 25)    → { count, inTune, meanCents, low, high, worst }
 *   Melody.toMidiFile(notes)   → Uint8Array (.mid)
 *   Melody.toWav(samples, sr)  → Uint8Array (.wav, 16 bits)
 *
 * Coste: se diezma a ~24 kHz antes de YIN (la voz no pasa de ~1400 Hz), así
 * cada frame cuesta ~4 veces menos que a 48 kHz (y a 16 kHz el error en los
 * agudos llegaba a 8 cents; a 24 kHz es ≤ 2 hasta Re6) y el análisis va en vivo
 * incluso en teléfonos. Requiere shared/pitch.js.
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var VOICE_MIN_HZ = 65;      // ~Do2
  var VOICE_MAX_HZ = 1400;    // ~Fa6
  var ANALYSIS_RATE = 24000;

  /* ── Análisis en streaming ─────────────────────────────────────────── */

  /** FIR pasa-bajos (sinc con ventana de Blackman), cutoff en ciclos/muestra. */
  function lowpass(taps, cutoff) {
    var h = new Float32Array(taps), M = taps - 1, sum = 0, n;
    for (n = 0; n < taps; n++) {
      var x = n - M / 2;
      var sinc = x === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x);
      var w = 0.42 - 0.5 * Math.cos(2 * Math.PI * n / M) + 0.08 * Math.cos(4 * Math.PI * n / M);
      h[n] = sinc * w;
      sum += h[n];
    }
    for (n = 0; n < taps; n++) h[n] /= sum;
    return h;
  }

  function Analyzer(sampleRate, opts) {
    opts = opts || {};
    this.sampleRate = sampleRate;
    this.factor  = Math.max(1, Math.round(sampleRate / ANALYSIS_RATE));
    this.rate    = sampleRate / this.factor;
    this.minFreq = opts.minFreq || VOICE_MIN_HZ;
    this.hop     = Math.round(this.rate * (opts.hopSec || 0.01));
    this.win     = Math.ceil(2.6 * this.rate / this.minFreq);   // ≥ 2 periodos de la nota más grave
    this.taps    = this.factor > 1 ? lowpass(32 * this.factor + 1, 0.4 / this.factor) : null;
    this.delay   = this.taps ? (this.taps.length - 1) / 2 : 0;  // retardo del filtro (muestras de entrada)
    this.frames  = [];
    this._pend   = new Float32Array(0);
    this._ring   = new Float32Array(this.win);
    this._frame  = new Float32Array(this.win);
    this._w = 0; this._count = 0; this._sinceHop = this.hop;
    // Umbral de voz ADAPTATIVO: 3× el ruido de fondo (percentil 5 del volumen de
    // los últimos 10 s), nunca menos de minRms. El umbral fijo de Pitch.detect
    // (0,012) perdía la voz cuando el micrófono entra bajo (iPhone sin control
    // automático de ganancia).
    this.minRms  = opts.minRms || 0.0015;   // ≈ −56 dBFS
    this.noise   = this.minRms;
    this._hist   = new Float32Array(1000);
    this._histN  = 0;
  }

  /** Añade muestras (cualquier tamaño de bloque) y devuelve los frames nuevos. */
  Analyzer.prototype.push = function (chunk) {
    var out = [];
    if (!this.taps) {
      for (var j = 0; j < chunk.length; j++) this._add(chunk[j], out);
      return out;
    }
    var buf = new Float32Array(this._pend.length + chunk.length);
    buf.set(this._pend, 0);
    buf.set(chunk, this._pend.length);
    var h = this.taps, N = h.length, D = this.factor, i = 0;
    for (; i + N <= buf.length; i += D) {
      var y = 0;
      for (var k = 0; k < N; k++) y += h[k] * buf[i + k];
      this._add(y, out);
    }
    this._pend = buf.slice(i);
    return out;
  };

  Analyzer.prototype._add = function (y, out) {
    this._ring[this._w] = y;
    this._w = (this._w + 1) % this.win;
    this._count++;
    this._sinceHop++;
    if (this._count < this.win || this._sinceHop < this.hop) return;
    this._sinceHop = 0;

    // Volumen solo de la mitad central (~20 ms): con la ventana entera (40 ms)
    // se suavizaban las caídas entre sílabas de una misma nota
    var f = this._frame, win = this.win, q1 = win >> 2, q3 = win - q1, rms = 0, all = 0;
    for (var j = 0; j < win; j++) {
      var v = this._ring[(this._w + j) % win];
      f[j] = v;
      all += v * v;
      if (j >= q1 && j < q3) rms += v * v;
    }
    all = Math.sqrt(all / win);
    this._trackNoise(all);
    var hz = -1;
    if (all >= Math.max(this.minRms, this.noise * 3)) {
      // Normalizado: YIN no depende del volumen, pero Pitch.detect descarta lo flojo
      var g = 0.1 / all;
      for (j = 0; j < win; j++) f[j] *= g;
      hz = Pitch.detect(f, this.rate, this.minFreq);
    }
    var center = (this._count - win / 2) * this.factor + this.delay;   // en muestras de entrada
    var frame = {
      t: center / this.sampleRate,
      midi: hz >= this.minFreq && hz <= VOICE_MAX_HZ ? Pitch.freqToMidi(hz) : NaN,
      rms: Math.sqrt(rms / (q3 - q1))
    };
    this.frames.push(frame);
    out.push(frame);
  };

  /** Ruido de fondo = percentil 5 del volumen reciente (se recalcula cada 25 frames). */
  Analyzer.prototype._trackNoise = function (rms) {
    var h = this._hist, n = this._histN++;
    h[n % h.length] = rms;
    n++;
    if (n % 25 !== 0 && n !== 10) return;
    var s = Array.prototype.slice.call(h, 0, Math.min(n, h.length)).sort(function (a, b) { return a - b; });
    this.noise = Math.max(this.minRms, s[Math.floor(s.length * 0.05)]);
  };

  function createAnalyzer(sampleRate, opts) { return new Analyzer(sampleRate, opts); }

  /* ── Limpieza de la curva y separación en notas ───────────────────── */

  function median(a) {
    if (!a.length) return NaN;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /** Tramos de frames con voz: [[i0, i1], …] (ambos inclusive). */
  function voicedRuns(m) {
    var runs = [], start = -1;
    for (var i = 0; i <= m.length; i++) {
      var v = i < m.length && !isNaN(m[i]);
      if (v && start < 0) start = i;
      if (!v && start >= 0) { runs.push([start, i - 1]); start = -1; }
    }
    return runs;
  }

  /**
   * opts: minDur   duración mínima de una nota (s, 0.08)
   *       jump     salto (semitonos) respecto a la media de la nota para cortar (0.7)
   */
  function analyze(frames, opts) {
    opts = opts || {};
    var minDur = opts.minDur || 0.08;
    var jump   = opts.jump || 0.7;
    var n = frames.length;
    var hop = n > 1 ? frames[1].t - frames[0].t : 0.01;
    var m = new Array(n), r = new Array(n), i, j, k;
    for (i = 0; i < n; i++) { m[i] = frames[i].midi; r[i] = frames[i].rms; }

    // 1) Errores de octava: un frame a ±12/24 semitonos de sus vecinos se pliega
    var fixed = m.slice();
    for (i = 0; i < n; i++) {
      if (isNaN(m[i])) continue;
      var near = [];
      for (j = Math.max(0, i - 10); j <= Math.min(n - 1, i + 10); j++) if (j !== i && !isNaN(m[j])) near.push(m[j]);
      if (near.length < 5) continue;
      var med = median(near);
      var oct = Math.round((m[i] - med) / 12);
      if (oct !== 0 && Math.abs(m[i] - 12 * oct - med) < 2) fixed[i] = m[i] - 12 * oct;
    }
    m = fixed;

    // 2) Islas de voz de menos de 40 ms: ruido, no notas
    voicedRuns(m).forEach(function (run) {
      if (run[1] - run[0] + 1 < 4) for (var q = run[0]; q <= run[1]; q++) m[q] = NaN;
    });

    // 3) Huecos de hasta 30 ms dentro de una nota: se interpolan (la curva no se corta)
    var runs = voicedRuns(m);
    for (k = 1; k < runs.length; k++) {
      var a = runs[k - 1][1], b = runs[k][0];
      if (b - a - 1 <= 3 && Math.abs(m[a] - m[b]) < 1) {
        for (j = a + 1; j < b; j++) m[j] = m[a] + (m[b] - m[a]) * (j - a) / (b - a);
      }
    }
    runs = voicedRuns(m);

    // 4) Curva: mediana de 5 frames (quita picos sueltos sin redondear el vibrato)
    var curve = new Array(n).fill(NaN);
    runs.forEach(function (run) {
      for (var q = run[0]; q <= run[1]; q++) {
        var w = [];
        for (var p = Math.max(run[0], q - 2); p <= Math.min(run[1], q + 2); p++) w.push(m[p]);
        curve[q] = median(w);
      }
    });

    // 5) Notas: dentro de cada tramo se corta cuando la altura SUAVIZADA (≈170 ms,
    //    anula un vibrato de 4–7 Hz) se aleja de la media de la nota actual.
    var segs = [];
    runs.forEach(function (run) {
      var lo = run[0], hi = run[1], s = [];
      for (var q = lo; q <= hi; q++) {
        var sum = 0, cnt = 0;
        for (var p = Math.max(lo, q - 8); p <= Math.min(hi, q + 8); p++) { sum += curve[p]; cnt++; }
        s[q - lo] = sum / cnt;
      }
      var start = lo, acc = 0, accN = 0, out = 0, first = -1;
      for (q = lo; q <= hi; q++) {
        var mean = accN ? acc / accN : curve[q];
        if (q - start >= 5 && Math.abs(s[q - lo] - mean) > jump) {
          if (out++ === 0) first = q;
          if (out >= 4) {
            // Punto de corte: donde la curva cruza el punto medio entre las dos alturas
            var target = curve[q], mid = (mean + target) / 2, dir = target > mean ? 1 : -1;
            var cut = q;
            for (p = Math.max(start + 3, first - 8); p <= q; p++) {
              if ((curve[p] - mid) * dir >= 0) { cut = p; break; }
            }
            segs.push([start, cut - 1]);
            start = cut; acc = 0; accN = 0; out = 0;
            for (p = cut; p <= q; p++) { acc += curve[p]; accN++; }
            continue;
          }
        } else {
          out = 0;
        }
        acc += curve[q]; accN++;
      }
      segs.push([start, hi]);
    });

    // 6) Misma nota rearticulada sin silencio ("la-la-la"): caída de volumen en medio
    var minLen = Math.max(4, Math.round(minDur / hop));
    var rs = r.map(function (_, q) {
      var sum = 0, cnt = 0;
      for (var p = Math.max(0, q - 1); p <= Math.min(n - 1, q + 1); p++) { sum += r[p]; cnt++; }
      return sum / cnt;
    });
    function splitDips(seg) {
      var a = seg[0], b = seg[1];
      if (b - a + 1 < 2 * minLen) return [seg];
      var best = -1, bestRatio = 0.55;
      for (var q = a + minLen; q <= b - minLen; q++) {
        if (!(rs[q] <= rs[q - 1] && rs[q] <= rs[q + 1])) continue;
        var left = 0, right = 0, p;
        for (p = a; p < q; p++) left = Math.max(left, rs[p]);
        for (p = q + 1; p <= b; p++) right = Math.max(right, rs[p]);
        var ratio = rs[q] / Math.min(left, right);
        if (ratio < bestRatio) { bestRatio = ratio; best = q; }
      }
      if (best < 0) return [seg];
      return splitDips([a, best - 1]).concat(splitDips([best + 1, b]));
    }
    segs = segs.reduce(function (all, sg) { return all.concat(splitDips(sg)); }, []);

    // 7) Propiedades de cada nota (sin el ataque ni la caída: 15 % a cada lado)
    var notes = [];
    segs.forEach(function (sg) {
      var a = sg[0], b = sg[1], len = b - a + 1;
      if (len * hop < minDur) return;
      var trim = Math.floor(len * 0.15), sum = 0, cnt = 0, level = 0, q;
      for (q = a + trim; q <= b - trim; q++) { sum += curve[q]; cnt++; }
      for (q = a; q <= b; q++) level = Math.max(level, r[q]);
      var midi = sum / cnt, v = 0;
      for (q = a + trim; q <= b - trim; q++) v += (curve[q] - midi) * (curve[q] - midi);
      var note = Math.round(midi);
      notes.push({
        start: frames[a].t - hop / 2,
        end: frames[b].t + hop / 2,
        i0: a, i1: b,
        midi: midi,
        note: note,
        cents: Math.round((midi - note) * 100),
        wobble: Math.round(Math.sqrt(v / cnt) * 100),   // desviación típica en cents (vibrato o inestabilidad)
        level: level
      });
    });
    return { curve: curve, notes: notes };
  }

  /* ── Tonalidad (perfiles de Krumhansl-Kessler) ─────────────────────── */
  var PROFILES = {
    major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
    minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
  };

  function correlation(x, y) {
    var mx = 0, my = 0, i;
    for (i = 0; i < 12; i++) { mx += x[i] / 12; my += y[i] / 12; }
    var sxy = 0, sxx = 0, syy = 0;
    for (i = 0; i < 12; i++) {
      sxy += (x[i] - mx) * (y[i] - my);
      sxx += (x[i] - mx) * (x[i] - mx);
      syy += (y[i] - my) * (y[i] - my);
    }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
  }

  /** Tonalidad más probable, ponderando cada nota por su duración. null si hay pocos datos. */
  function keyOf(notes) {
    var hist = new Array(12).fill(0), distinct = {};
    notes.forEach(function (nt) {
      var pc = ((nt.note % 12) + 12) % 12;
      hist[pc] += nt.end - nt.start;
      distinct[pc] = true;
    });
    if (notes.length < 4 || Object.keys(distinct).length < 3) return null;
    var best = null;
    ['major', 'minor'].forEach(function (type) {
      for (var t = 0; t < 12; t++) {
        var rot = [];
        for (var i = 0; i < 12; i++) rot[i] = hist[(i + t) % 12];
        var sc = correlation(rot, PROFILES[type]);
        if (!best || sc > best.score) best = { tonic: t, type: type, score: sc };
      }
    });
    return best;
  }

  /* ── Resumen ──────────────────────────────────────────────────────── */
  function stats(notes, tol) {
    tol = tol || 25;
    var total = 0, ok = 0, signed = 0, low = Infinity, high = -Infinity;
    notes.forEach(function (nt) {
      var d = nt.end - nt.start;
      total += d;
      if (Math.abs(nt.cents) <= tol) ok += d;
      signed += nt.cents * d;
      low = Math.min(low, nt.note);
      high = Math.max(high, nt.note);
    });
    var worst = notes.map(function (nt, i) { return i; })
      .filter(function (i) { return Math.abs(notes[i].cents) > tol; })
      .sort(function (a, b) { return Math.abs(notes[b].cents) - Math.abs(notes[a].cents); })
      .slice(0, 5);
    return {
      count: notes.length,
      inTune: total ? ok / total : 0,
      meanCents: total ? Math.round(signed / total) : 0,
      low: notes.length ? low : null,
      high: notes.length ? high : null,
      worst: worst
    };
  }

  /* ── Exportar ─────────────────────────────────────────────────────── */

  /** Archivo MIDI (formato 0, 120 BPM): cada nota con su inicio, duración y volumen. */
  function toMidiFile(notes, opts) {
    opts = opts || {};
    var bpm = opts.bpm || 120, ppq = 480;
    var ticksPerSec = ppq * bpm / 60;
    var maxLevel = notes.reduce(function (mx, nt) { return Math.max(mx, nt.level); }, 0) || 1;
    var ev = [];
    notes.forEach(function (nt) {
      var on = Math.round(nt.start * ticksPerSec), off = Math.max(on + 1, Math.round(nt.end * ticksPerSec));
      var vel = Math.max(1, Math.min(127, Math.round(40 + 87 * nt.level / maxLevel)));
      var key = Math.max(0, Math.min(127, nt.note));
      ev.push({ t: on, d: [0x90, key, vel] }, { t: off, d: [0x80, key, 0] });
    });
    ev.sort(function (a, b) { return a.t - b.t || (a.d[0] === 0x80 ? -1 : 1); });

    var trk = [];
    function varLen(v) {
      var bytes = [v & 0x7f];
      while ((v >>= 7)) bytes.unshift((v & 0x7f) | 0x80);
      trk.push.apply(trk, bytes);
    }
    var us = Math.round(60000000 / bpm);
    trk.push(0x00, 0xff, 0x51, 0x03, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff);
    trk.push(0x00, 0xc0, 52);   // programa 53 GM: "Choir Aahs"
    var last = 0;
    ev.forEach(function (e) { varLen(e.t - last); last = e.t; trk.push.apply(trk, e.d); });
    trk.push(0x00, 0xff, 0x2f, 0x00);

    var head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (ppq >> 8) & 0xff, ppq & 0xff,
                0x4d, 0x54, 0x72, 0x6b,
                (trk.length >>> 24) & 0xff, (trk.length >> 16) & 0xff, (trk.length >> 8) & 0xff, trk.length & 0xff];
    return new Uint8Array(head.concat(trk));
  }

  /** WAV mono de 16 bits. */
  function toWav(samples, sampleRate) {
    var n = samples.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Uint8Array(buf);
  }

  global.Melody = {
    VOICE_MIN_HZ: VOICE_MIN_HZ, VOICE_MAX_HZ: VOICE_MAX_HZ,
    createAnalyzer: createAnalyzer, analyze: analyze, keyOf: keyOf, stats: stats,
    toMidiFile: toMidiFile, toWav: toWav
  };

}(typeof window !== 'undefined' ? window : this));
