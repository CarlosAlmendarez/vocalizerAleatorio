/**
 * MusicTools — PSOLA
 * ---------------------------------------------------------------------------
 * Edición de una voz grabada (fase 2 de analisis-vocal), al estilo Melodyne:
 * cambiar la nota, afinarla, aplanar su vibrato, moverla en el tiempo o
 * alargarla/acortarla, SIN efecto "ardilla". TD-PSOLA: la voz se corta en
 * granos de dos periodos centrados en cada pulso glótico y se vuelven a
 * solapar más juntos (más agudo) o más separados (más grave); para el tiempo,
 * los granos se repiten (más larga) o se saltan (más corta). Cada grano
 * conserva su forma, y con ella el timbre (los formantes).
 *
 *   const shifts = Psola.shiftsFor(frames, curve, notes, edits);
 *       edits[note.i0] = { target: MIDI con decimales (altura deseada), flatten: 0..1,
 *                          ds, de: segundos que se mueven el inicio y el final de la nota }
 *       → semitonos de cambio por frame (suavizados en los bordes de cada nota)
 *   const map = Psola.timeMap(notes, edits, duration);   // null si nada se movió en el tiempo
 *   Psola.toOut(map, t) / Psola.toIn(map, t)             // instante original ↔ editado
 *   const out = Psola.render(samples, sampleRate, frames, curve, shifts, map);
 *       → Float32Array del mismo largo; fuera de lo editado, idéntico al original
 *
 * frames/curve vienen de shared/melody.js (un frame cada 10 ms). Natural hasta
 * ±3 semitonos y entre ×0,5 y ×2 de duración. Al mover una nota, su ataque
 * (consonante) y su final viajan con ella; lo que cede es el silencio de al lado.
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var UV_SEC      = 0.005;   // paso de los granos donde no hay voz
  var FADE_SEC    = 0.01;    // fundido entre lo original y lo editado
  var PAD         = 5;       // frames de margen alrededor de cada zona editada
  var ATTACK_SEC  = 0.06;    // antes de cada nota: viaja con ella (consonante, respiración)
  var RELEASE_SEC = 0.04;    // después de cada nota: ídem (cola)

  /* ── Cambio de altura por frame a partir de las ediciones de cada nota ── */
  function shiftsFor(frames, curve, notes, edits) {
    var n = frames.length, s = new Float32Array(n);
    notes.forEach(function (note) {
      var e = edits && edits[note.i0];
      if (!e || (e.target == null && !e.flatten)) return;
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

  /* ── Mapa de tiempo: pares [t editado, t original], crecientes en ambos ── */
  function timeMap(notes, edits, duration) {
    var pos = notes.map(function (n) {
      var e = (edits && edits[n.i0]) || {};
      return [n.start + (e.ds || 0), n.end + (e.de || 0)];
    });
    if (!pos.some(function (p, k) { return p[0] !== notes[k].start || p[1] !== notes[k].end; })) return null;
    var pts = [[0, 0]];
    notes.forEach(function (n, k) {
      var prevIn = k ? notes[k - 1].end : 0, prevOut = k ? pos[k - 1][1] : 0;
      var nextIn = k + 1 < notes.length ? notes[k + 1].start : duration;
      var nextOut = k + 1 < notes.length ? pos[k + 1][0] : duration;
      // 0,4 + 0,4 < 1: el ataque de una nota y la cola de la anterior nunca se cruzan
      var a = Math.max(0, Math.min(ATTACK_SEC, 0.4 * (n.start - prevIn), 0.4 * (pos[k][0] - prevOut)));
      var r = Math.max(0, Math.min(RELEASE_SEC, 0.4 * (nextIn - n.end), 0.4 * (nextOut - pos[k][1])));
      pts.push([pos[k][0] - a, n.start - a], [pos[k][0], n.start], [pos[k][1], n.end], [pos[k][1] + r, n.end + r]);
    });
    pts.push([duration, duration]);
    // Por seguridad (ediciones incoherentes): se descarta lo que retrocedería
    return pts.filter(function (p, k) {
      for (var j = 0; j < k; j++) if (p[0] < pts[j][0] || p[1] < pts[j][1]) return false;
      return true;
    });
  }

  /** Interpolación lineal por tramos de la coordenada `from` a la `to` del mapa. */
  function warp(map, t, from, to) {
    if (!map) return t;
    var a = 0, b = map.length - 1;
    if (t <= map[0][from]) return t - map[0][from] + map[0][to];
    if (t >= map[b][from]) return t - map[b][from] + map[b][to];
    while (b - a > 1) { var m = (a + b) >> 1; if (map[m][from] <= t) a = m; else b = m; }
    var d = map[b][from] - map[a][from];
    return d > 1e-9 ? map[a][to] + (t - map[a][from]) / d * (map[b][to] - map[a][to]) : map[a][to];
  }
  function toOut(map, t) { return warp(map, t, 1, 0); }
  function toIn(map, t) { return warp(map, t, 0, 1); }

  /** Zonas que cambian [muestra ini, muestra fin) en el tiempo editado; idénticas al original en los bordes. */
  function editedRegions(frames, shifts, map, sr) {
    var regs = [], a = -1, last = -Infinity, fp = 0;
    for (var i = 0; i < frames.length; i++) {
      var t = frames[i].t, src = toIn(map, t);
      while (fp + 1 < frames.length && frames[fp + 1].t <= src) fp++;
      if (Math.abs(src - t) < 1e-5 && Math.abs(shifts[fp]) < 1e-4 && Math.abs(shifts[Math.min(fp + 1, frames.length - 1)]) < 1e-4) continue;
      if (a < 0 || i - last > 2 * PAD) { if (a >= 0) regs.push([a, last]); a = i; }
      last = i;
    }
    if (a >= 0) regs.push([a, last]);
    var hop = frames.length > 1 ? frames[1].t - frames[0].t : 0.01;
    return regs.map(function (r) {
      var f0 = frames[Math.max(0, r[0] - PAD)].t, f1 = frames[Math.min(frames.length - 1, r[1] + PAD)].t;
      return [Math.max(0, Math.floor((f0 - hop / 2) * sr)), Math.ceil((f1 + hop / 2) * sr)];
    });
  }

  function render(x, sr, frames, curve, shifts, map) {
    var out = new Float32Array(x);   // copia: lo no editado queda idéntico
    if (!frames.length) return out;
    editedRegions(frames, shifts, map || null, sr).forEach(function (r) {
      var a = r[0], b = Math.min(x.length, r[1]);
      if (b - a > 16) renderRegion(x, out, sr, frames, curve, shifts, map || null, a, b);
    });
    return out;
  }

  function renderRegion(x, out, sr, frames, curve, shifts, map, a, b) {
    var n = x.length, UV = Math.max(16, Math.round(sr * UV_SEC));
    var inSmp = function (q) { return toIn(map, q / sr) * sr; };
    var outSmp = function (q) { return toOut(map, q / sr) * sr; };

    // Frame más cercano a un instante del original (las consultas avanzan en orden → puntero)
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

    // 1) Marcas de análisis en el ORIGINAL: una por periodo, en el pico de cada pulso; sin voz, cada UV
    var ia = Math.max(0, Math.floor(inSmp(a))), ib = Math.min(n, Math.ceil(inSmp(b)));
    var marks = [], i = ia, prevVoiced = false;
    while (i < ib) {
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

    // 2) Síntesis en el tiempo EDITADO: en cada punto, el grano de la marca más cercana
    //    a su instante original, colocados cada T/ratio (voz) o cada UV (sin voz)
    var maxT = marks.reduce(function (m, mk) { return Math.max(m, mk[1]); }, UV);
    var base = a - maxT, len = b - a + 2 * maxT;
    var acc = new Float32Array(len), ws = new Float32Array(len);
    var ts = Math.max(a - maxT, outSmp(marks[0][0])), mi = 0;
    fp = 0;
    while (ts < b) {
      var src = inSmp(ts);
      while (mi + 1 < marks.length && marks[mi + 1][0] <= src) mi++;
      var mk = (mi + 1 < marks.length && marks[mi + 1][0] - src < src - marks[mi][0]) ? marks[mi + 1] : marks[mi];
      var P = mk[1], voiced = mk[2];
      var ratio = voiced ? Math.pow(2, shifts[frameOf(src)] / 12) : 1;
      // Con voz, el grano sale de su pulso; sin voz, del instante exacto (repetir el mismo ruido zumbaría)
      var from = voiced ? mk[0] : Math.round(src), c = Math.round(ts);
      for (var j = -P; j <= P; j++) {
        var s = from + j, dst = c + j - base;
        if (s < 0 || s >= n || dst < 0 || dst >= len) continue;
        var w = 0.5 + 0.5 * Math.cos(Math.PI * j / P);   // Hann de dos periodos
        acc[dst] += x[s] * w;
        ws[dst] += w;
      }
      ts += voiced ? P / ratio : P;
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

  global.Psola = { shiftsFor: shiftsFor, timeMap: timeMap, toOut: toOut, toIn: toIn, render: render };

}(typeof window !== 'undefined' ? window : this));
