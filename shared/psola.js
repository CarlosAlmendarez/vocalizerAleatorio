/**
 * MusicTools — PSOLA
 * ---------------------------------------------------------------------------
 * Edición de la altura de una voz grabada (fase 2 de analisis-vocal), al
 * estilo Melodyne: cambiar la nota, afinarla o aplanar su vibrato SIN efecto
 * "ardilla". TD-PSOLA: la voz se corta en granos de dos periodos centrados en
 * cada pulso glótico y se vuelven a solapar más juntos (más agudo) o más
 * separados (más grave). Cada grano conserva su forma, y con ella el timbre
 * (los formantes); la duración no cambia.
 *
 *   const shifts = Psola.shiftsFor(frames, curve, notes, edits);
 *       edits[note.i0] = { target: MIDI con decimales (altura deseada), flatten: 0..1 }
 *       → semitonos de cambio por frame (suavizados en los bordes de cada nota)
 *   const out = Psola.render(samples, sampleRate, frames, curve, shifts);
 *       → Float32Array del mismo largo; fuera de lo editado, idéntico al original
 *
 * frames/curve vienen de shared/melody.js (un frame cada 10 ms). Natural hasta
 * ±3 semitonos; más allá se nota artificial. Las zonas sin voz no se tocan.
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var UV_SEC   = 0.005;   // paso de los granos donde no hay voz
  var FADE_SEC = 0.01;    // fundido entre lo original y lo editado
  var PAD      = 5;       // frames de margen alrededor de cada zona editada

  /* ── Cambio por frame a partir de las ediciones de cada nota ── */
  function shiftsFor(frames, curve, notes, edits) {
    var n = frames.length, s = new Float32Array(n);
    notes.forEach(function (note) {
      var e = edits && edits[note.i0];
      if (!e) return;
      var target = e.target != null ? e.target : note.midi;
      var keep = 1 - Math.max(0, Math.min(1, e.flatten || 0));   // cuánto vibrato/oscilación se conserva
      for (var i = note.i0; i <= note.i1; i++) {
        var p = curve[i];
        if (isNaN(p)) continue;
        s[i] = target + (p - note.midi) * keep - p;
      }
    });
    // Suavizado (±30 ms): sin saltos bruscos de altura en los bordes de las notas
    var out = new Float32Array(n), R = 3;
    for (var i = 0; i < n; i++) {
      var sum = 0, cnt = 0;
      for (var j = Math.max(0, i - R); j <= Math.min(n - 1, i + R); j++) { sum += s[j]; cnt++; }
      out[i] = sum / cnt;
    }
    return out;
  }

  /** Zonas editadas [frameIni, frameFin] con margen; las cercanas se unen. */
  function editedRegions(shifts) {
    var regs = [], a = -1, last = -Infinity;
    for (var i = 0; i < shifts.length; i++) {
      if (Math.abs(shifts[i]) < 1e-4) continue;
      if (a < 0 || i - last > 2 * PAD) { if (a >= 0) regs.push([a, last]); a = i; }
      last = i;
    }
    if (a >= 0) regs.push([a, last]);
    return regs.map(function (r) { return [Math.max(0, r[0] - PAD), Math.min(shifts.length - 1, r[1] + PAD)]; });
  }

  function render(x, sr, frames, curve, shifts) {
    var out = new Float32Array(x);   // copia: lo no editado queda idéntico
    if (!frames.length) return out;
    var hop = frames.length > 1 ? frames[1].t - frames[0].t : 0.01;
    editedRegions(shifts).forEach(function (r) {
      var a = Math.max(0, Math.floor((frames[r[0]].t - hop / 2) * sr));
      var b = Math.min(x.length, Math.ceil((frames[r[1]].t + hop / 2) * sr));
      if (b - a > 16) renderRegion(x, out, sr, frames, curve, shifts, a, b);
    });
    return out;
  }

  function renderRegion(x, out, sr, frames, curve, shifts, a, b) {
    var n = x.length, UV = Math.max(16, Math.round(sr * UV_SEC));

    // Frame más cercano a una muestra (las consultas avanzan en orden → puntero)
    var fp = 0;
    function frameOf(smp) {
      var t = smp / sr;
      while (fp > 0 && frames[fp].t > t) fp--;
      while (fp + 1 < frames.length && Math.abs(frames[fp + 1].t - t) <= Math.abs(frames[fp].t - t)) fp++;
      return fp;
    }
    function periodAt(smp) {
      var m = curve[frameOf(smp)];
      return isNaN(m) ? 0 : Math.round(sr / (440 * Math.pow(2, (m - 69) / 12)));
    }

    // 1) Marcas de análisis: una por periodo, en el pico de cada pulso; sin voz, cada UV
    var marks = [], i = a, prevVoiced = false;
    while (i < b) {
      var T = periodAt(i);
      if (!T) { marks.push([i, UV, 0]); i += UV; prevVoiced = false; continue; }
      var lo = prevVoiced ? i - (T >> 2) : i, hi = prevVoiced ? i + (T >> 2) : i + T;
      lo = Math.max(0, lo); hi = Math.min(n - 1, hi);
      var best = lo;
      for (var k = lo; k <= hi; k++) if (x[k] > x[best]) best = k;
      if (marks.length && best <= marks[marks.length - 1][0]) best = marks[marks.length - 1][0] + T;
      marks.push([best, T, 1]);
      i = best + T;
      prevVoiced = true;
    }
    if (!marks.length) return;

    // 2) Síntesis: granos de la marca más cercana, colocados cada T/ratio
    var maxT = marks.reduce(function (m, mk) { return Math.max(m, mk[1]); }, UV);
    var base = a - maxT, len = b - a + 2 * maxT;
    var acc = new Float32Array(len), ws = new Float32Array(len);
    var ts = marks[0][0], mi = 0;
    fp = 0;
    while (ts < b) {
      while (mi + 1 < marks.length && marks[mi + 1][0] <= ts) mi++;
      var mk = (mi + 1 < marks.length && marks[mi + 1][0] - ts < ts - marks[mi][0]) ? marks[mi + 1] : marks[mi];
      var P = mk[1], ratio = mk[2] ? Math.pow(2, shifts[frameOf(ts)] / 12) : 1;
      var c = Math.round(ts);
      for (var j = -P; j <= P; j++) {
        var src = mk[0] + j, dst = c + j - base;
        if (src < 0 || src >= n || dst < 0 || dst >= len) continue;
        var w = 0.5 + 0.5 * Math.cos(Math.PI * j / P);   // Hann de dos periodos
        acc[dst] += x[src] * w;
        ws[dst] += w;
      }
      ts += mk[2] ? P / ratio : P;
    }

    // 3) Normalizar por la suma de ventanas y fundir con el original en los bordes
    var fade = Math.max(1, Math.round(sr * FADE_SEC));
    for (var q = a; q < b; q++) {
      var d = q - base;
      var y = ws[d] > 1e-3 ? acc[d] / ws[d] : x[q];
      var g = Math.min(1, (q - a) / fade, (b - 1 - q) / fade);
      out[q] = x[q] * (1 - g) + y * g;
    }
  }

  global.Psola = { shiftsFor: shiftsFor, render: render };

}(typeof window !== 'undefined' ? window : this));
