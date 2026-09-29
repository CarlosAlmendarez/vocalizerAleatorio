/**
 * MusicTools — Theory
 * ---------------------------------------------------------------------------
 * Base de teoría musical compartida: una sola fuente de verdad para escribir
 * notas, acordes, escalas, grados y digitaciones. Antes cada app nombraba las
 * notas con una tabla de sostenidos (Fa mayor salía con "La#", Do menor con
 * "D#") y tenía formas de acordes escritas a mano sin verificar.
 *
 * Reglas que aplica:
 *  · Cada intervalo se escribe por GRADO: una 3ª siempre usa la letra que está
 *    dos letras arriba (Do → Mi♭, nunca Re#). En escalas de 7 notas cada letra
 *    aparece una vez.
 *  · Entre enarmónicos (C#/D♭…) se elige la escritura con menos alteraciones
 *    y sin dobles alteraciones.
 *  · Las digitaciones de guitarra/ukulele/bajo se BUSCAN y verifican: solo
 *    suenan notas del acorde y están todas las necesarias.
 *
 *   Theory.chord('C', 'min')              → { symbol:'Cm', notes:['C','Eb','G'], … }
 *   Theory.bestRoot(1, 'maj')             → 'Db'   (Db F Ab en vez de C# E# G#)
 *   Theory.scale('F', 'major').notes      → ['F','G','A','Bb','C','D','E']
 *   Theory.degreeRoot('C', 'bVII')        → 'Bb'
 *   Theory.transposeName('Bb', 'C', 'D')  → 'C'
 *   Theory.display('Eb', 'es')            → 'Mi♭'
 *   Theory.findVoicing({ tuning, pcs, … }) → { frets, baseFret, barre }
 * ---------------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var LETTERS   = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  var LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  var ES        = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  var ACC_ASCII = { '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' };
  var ACC_UNI   = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };

  function mod(n, m) { return ((n % m) + m) % m; }

  /* ── Notas ─────────────────────────────────────────────────────────── */

  /** 'Eb4' → { letter:2, acc:-1, pc:3, octave:4 }  (acepta b, bb, #, ##, x, ♭, ♯) */
  function parse(name) {
    var m = /^([A-Ga-g])(bb|𝄫|##|x|𝄪|b|♭|#|♯)?(-?\d+)?$/.exec(String(name).trim());
    if (!m) return null;
    var letter = LETTERS.indexOf(m[1].toUpperCase());
    var a = m[2] || '';
    var acc = (a === 'b' || a === '♭') ? -1 : (a === 'bb' || a === '𝄫') ? -2
            : (a === '#' || a === '♯') ? 1 : (a === '##' || a === 'x' || a === '𝄪') ? 2 : 0;
    return {
      letter: letter, acc: acc,
      pc: mod(LETTER_PC[letter] + acc, 12),
      octave: m[3] !== undefined ? parseInt(m[3], 10) : null
    };
  }

  /** Nota con letra fija y clase de altura dada → 'Eb', 'E#', 'Fbb'… */
  function spell(letter, pc) {
    var acc = mod(pc - LETTER_PC[letter] + 6, 12) - 6;   // −6..5
    if (acc < -2 || acc > 2) return null;
    return LETTERS[letter] + ACC_ASCII[acc];
  }

  function pc(name) { var p = parse(name); return p ? p.pc : -1; }

  /** Número MIDI de 'C4' (= 60). La octava sigue la letra: B#3 = 60, Cb4 = 59. */
  function midi(name) {
    var p = parse(name);
    if (!p || p.octave === null) return null;
    return (p.octave + 1) * 12 + LETTER_PC[p.letter] + p.acc;
  }

  /** Para mostrar: display('Eb','es') → 'Mi♭'; display('F#4','en') → 'F♯4' */
  function display(name, lang) {
    var p = parse(name);
    if (!p) return name;
    var base = lang === 'es' ? ES[LETTERS[p.letter]] : LETTERS[p.letter];
    return base + ACC_UNI[p.acc] + (p.octave !== null ? p.octave : '');
  }

  /** Cuántas alteraciones "cuesta" leer una lista de notas (dobles pesan más). */
  function cost(names) {
    return names.reduce(function (s, n) {
      var a = Math.abs(parse(n).acc);
      return s + (a === 2 ? 5 : a);
    }, 0);
  }

  /** Escribe una nota a partir de otra + [semitonos, grado] ('grado' 1 = unísono, 3 = tercera…). */
  function fromRoot(rootName, iv) {
    var r = parse(rootName);
    var letter = mod(r.letter + (iv[1] - 1), 7);
    return spell(letter, mod(r.pc + iv[0], 12));
  }

  /** Nota con alteraciones dobles → su enarmónico más simple (Fbb → Eb). */
  function simplify(name) {
    var p = parse(name);
    if (!p || Math.abs(p.acc) < 2) return name;
    var cands = [];
    for (var d = -1; d <= 1; d++) {
      var s = spell(mod(p.letter + d, 7), p.pc);
      if (s) cands.push(s);
    }
    cands.sort(function (a, b) { return cost([a]) - cost([b]); });
    return cands[0] + (p.octave !== null ? p.octave : '');
  }

  // Candidatas para cada clase de altura como fundamental
  var ROOT_CANDIDATES = [
    ['C'], ['C#', 'Db'], ['D'], ['D#', 'Eb'], ['E'], ['F'],
    ['F#', 'Gb'], ['G'], ['G#', 'Ab'], ['A'], ['A#', 'Bb'], ['B']
  ];

  /** Nombres enarmónicos de una clase de altura: enharmonics(1) → ['C#','Db']; (0) → ['C'] */
  function enharmonics(p) { return ROOT_CANDIDATES[mod(p, 12)].slice(); }

  /** Etiqueta HTML para botones de fundamental: "Do♯" con "Re♭" debajo en las teclas negras. */
  function rootButtonLabel(p, lang) {
    var e = enharmonics(p);
    if (e.length === 1) return display(e[0], lang);
    return display(e[0], lang) + '<span class="enh-alt">' + display(e[1], lang) + '</span>';
  }

  /* ── Acordes ───────────────────────────────────────────────────────── */
  // ivs: [semitonos, grado]. El grado decide la letra (b3 = 3ª menor → "Eb" en Do).
  var CHORDS = {
    maj:  { name: 'Mayor',             sym: '',     ivs: [[0,1],[4,3],[7,5]],          deg: ['1','3','5'] },
    min:  { name: 'Menor',             sym: 'm',    ivs: [[0,1],[3,3],[7,5]],          deg: ['1','♭3','5'] },
    dim:  { name: 'Disminuido',        sym: '°',    ivs: [[0,1],[3,3],[6,5]],          deg: ['1','♭3','♭5'] },
    aug:  { name: 'Aumentado',         sym: '+',    ivs: [[0,1],[4,3],[8,5]],          deg: ['1','3','♯5'] },
    sus2: { name: 'Suspendido 2',      sym: 'sus2', ivs: [[0,1],[2,2],[7,5]],          deg: ['1','2','5'] },
    sus4: { name: 'Suspendido 4',      sym: 'sus4', ivs: [[0,1],[5,4],[7,5]],          deg: ['1','4','5'] },
    dom7: { name: 'Séptima dominante', sym: '7',    ivs: [[0,1],[4,3],[7,5],[10,7]],   deg: ['1','3','5','♭7'] },
    maj7: { name: 'Mayor 7',           sym: 'maj7', ivs: [[0,1],[4,3],[7,5],[11,7]],   deg: ['1','3','5','7'] },
    min7: { name: 'Menor 7',           sym: 'm7',   ivs: [[0,1],[3,3],[7,5],[10,7]],   deg: ['1','♭3','5','♭7'] },
    m7b5: { name: 'Semidisminuido',    sym: 'm7♭5', ivs: [[0,1],[3,3],[6,5],[10,7]],   deg: ['1','♭3','♭5','♭7'] },
    dim7: { name: 'Disminuido 7',      sym: '°7',   ivs: [[0,1],[3,3],[6,5],[9,7]],    deg: ['1','♭3','♭5','𝄫7'] }
  };
  // Alias usados por las apps
  var CHORD_ALIAS = { major: 'maj', minor: 'min', '7': 'dom7', m7: 'min7' };
  function chordDef(type) { return CHORDS[CHORD_ALIAS[type] || type] || null; }

  /** Fundamental con la mejor escritura para ese acorde (pc 1 + maj → 'Db'; + min → 'C#'). */
  function bestRoot(rootPc, type) {
    var def = chordDef(type) || CHORDS.maj;
    var cands = ROOT_CANDIDATES[mod(rootPc, 12)];
    return pickBest(cands, function (r) { return def.ivs.map(function (iv) { return fromRoot(r, iv); }); }, rootPc);
  }

  function pickBest(cands, notesOf, rootPc) {
    var best = null, bestCost = Infinity;
    cands.forEach(function (r) {
      var ns = notesOf(r);
      if (ns.some(function (n) { return !n; })) return;
      var c = cost(ns);
      // Empate (F#/Gb, D#m/Ebm): bemol, salvo F# que es la forma habitual.
      var tieBreak = (c === bestCost) && (rootPc === 6 ? r.indexOf('#') > 0 : r.indexOf('b') > 0);
      if (c < bestCost || tieBreak) { best = r; bestCost = c; }
    });
    return best || cands[0];
  }

  /** Acorde escrito: chord('Eb','min7') → { root:'Eb', symbol:'Ebm7', notes:['Eb','Gb','Bb','Db'], … } */
  function chord(rootName, type) {
    var def = chordDef(type);
    if (!def) return null;
    var notes = def.ivs.map(function (iv) { return fromRoot(rootName, iv); });
    return {
      root: rootName, type: type, name: def.name,
      symbol: rootName + def.sym, suffix: def.sym,
      notes: notes, degrees: def.deg.slice(),
      pcs: notes.map(pc), semitones: def.ivs.map(function (iv) { return iv[0]; })
    };
  }

  /* ── Escalas ───────────────────────────────────────────────────────── */
  var SCALES = {
    major:      { name: 'Mayor',          ivs: [[0,1],[2,2],[4,3],[5,4],[7,5],[9,6],[11,7]] },
    minor:      { name: 'Menor natural',  ivs: [[0,1],[2,2],[3,3],[5,4],[7,5],[8,6],[10,7]] },
    harmMinor:  { name: 'Menor armónica', ivs: [[0,1],[2,2],[3,3],[5,4],[7,5],[8,6],[11,7]] },
    dorian:     { name: 'Dórico',         ivs: [[0,1],[2,2],[3,3],[5,4],[7,5],[9,6],[10,7]] },
    phrygian:   { name: 'Frigio',         ivs: [[0,1],[1,2],[3,3],[5,4],[7,5],[8,6],[10,7]] },
    lydian:     { name: 'Lidio',          ivs: [[0,1],[2,2],[4,3],[6,4],[7,5],[9,6],[11,7]] },
    mixolydian: { name: 'Mixolidio',      ivs: [[0,1],[2,2],[4,3],[5,4],[7,5],[9,6],[10,7]] },
    locrian:    { name: 'Locrio',         ivs: [[0,1],[1,2],[3,3],[5,4],[6,5],[8,6],[10,7]] },
    pentMajor:  { name: 'Pentatónica mayor', ivs: [[0,1],[2,2],[4,3],[7,5],[9,6]] },
    pentMinor:  { name: 'Pentatónica menor', ivs: [[0,1],[3,3],[5,4],[7,5],[10,7]] },
    blues:      { name: 'Blues',          ivs: [[0,1],[3,3],[5,4],[6,5],[7,5],[10,7]] }   // ♭5 = "blue note"
  };

  /** Escala escrita desde una fundamental dada: scale('F','major').notes → [..'Bb'..] */
  function scale(rootName, type) {
    var def = SCALES[type];
    if (!def) return null;
    var notes = def.ivs.map(function (iv) { return fromRoot(rootName, iv); });
    return { root: rootName, name: def.name, notes: notes, semitones: def.ivs.map(function (iv) { return iv[0]; }) };
  }

  /** Mejor escritura de la tónica para una escala (pc 10 + major → 'Bb'; pc 8 + minor → 'G#'). */
  function bestScaleRoot(rootPc, type) {
    var def = SCALES[type] || SCALES.major;
    var cands = ROOT_CANDIDATES[mod(rootPc, 12)];
    return pickBest(cands, function (r) { return def.ivs.map(function (iv) { return fromRoot(r, iv); }); }, rootPc);
  }

  /* ── Grados (números romanos) ─────────────────────────────────────── */
  var ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };
  var MAJOR_SEMI = [0, 2, 4, 5, 7, 9, 11];

  /** Fundamental de un grado en una tonalidad: degreeRoot('C','bVII') → 'Bb'; ('A','bVI') → 'F' */
  function degreeRoot(keyName, roman) {
    var m = /^(b|♭|#|♯)?([ivIV]+)/.exec(roman);
    if (!m) return keyName;
    var deg = ROMAN[m[2].toUpperCase()];
    var acc = (m[1] === 'b' || m[1] === '♭') ? -1 : (m[1] === '#' || m[1] === '♯') ? 1 : 0;
    return fromRoot(keyName, [MAJOR_SEMI[deg - 1] + acc, deg]);
  }

  /* ── Transposición ─────────────────────────────────────────────────── */

  /** Transpone una nota por el intervalo que separa dos tonalidades (conserva la lógica de letras). */
  function transposeName(name, fromKey, toKey) {
    var n = parse(name), a = parse(fromKey), b = parse(toKey);
    if (!n || !a || !b) return name;
    var letter = mod(n.letter + (b.letter - a.letter), 7);
    var out = spell(letter, mod(n.pc + (b.pc - a.pc), 12));
    return out ? simplify(out) : name;
  }

  /** Tonalidad destino con buena escritura: keyForPc(10) → 'Bb'; keyForPc(6) → 'F#'. */
  function keyForPc(p, type) { return bestScaleRoot(p, type || 'major'); }

  /* ── Digitaciones para instrumentos de trastes ─────────────────────── */
  /**
   * Busca la digitación más cómoda que suene SOLO notas del acorde.
   * opts: tuning   [midi por cuerda, de grave a aguda en el diagrama]
   *       pcs      clases de altura del acorde (la 1ª es la fundamental)
   *       optional clases que se pueden omitir (p. ej. la 5ª en acordes de 4 notas)
   *       rootInBass  la nota más grave debe ser la fundamental
   *       allowMute   se pueden apagar cuerdas en los extremos
   *       minStrings  cuerdas mínimas que suenan
   *       maxSpan     separación máxima entre trastes pisados (3 = 4 trastes)
   *       maxFret     traste más alto a considerar
   */
  function findVoicing(opts) {
    var tuning = opts.tuning, n = tuning.length;
    var root = opts.pcs[0];
    var allowed = {};
    opts.pcs.forEach(function (p) { allowed[p] = true; });
    var required = opts.pcs.filter(function (p) { return (opts.optional || []).indexOf(p) < 0; });
    var maxSpan = opts.maxSpan || 3, maxFret = opts.maxFret || 14;
    var minStrings = opts.minStrings || Math.min(n, 3);
    var best = null, bestScore = Infinity;

    for (var pos = 0; pos <= maxFret - maxSpan; pos++) {
      var lo = Math.max(1, pos), hi = pos + maxSpan;
      var options = tuning.map(function (open) {
        var o = [];
        if (opts.allowMute) o.push(-1);
        if (pos <= 3 && allowed[mod(open, 12)]) o.push(0);   // cuerdas al aire solo en posiciones bajas
        for (var f = lo; f <= hi; f++) if (allowed[mod(open + f, 12)]) o.push(f);
        return o;
      });
      var frets = new Array(n);
      (function rec(s) {
        if (s === n) { consider(frets.slice(), pos); return; }
        for (var i = 0; i < options[s].length; i++) { frets[s] = options[s][i]; rec(s + 1); }
      })(0);
    }
    return best;

    function consider(fr, pos) {
      // Cuerdas apagadas solo en los extremos (no en medio)
      var first = 0, last = n - 1;
      while (first < n && fr[first] < 0) first++;
      while (last >= 0 && fr[last] < 0) last--;
      if (first > last) return;
      for (var s = first; s <= last; s++) if (fr[s] < 0) return;
      var sounding = last - first + 1;
      if (sounding < minStrings) return;

      var present = {}, lowest = Infinity, lowestPc = -1;
      for (s = first; s <= last; s++) {
        var m = tuning[s] + fr[s];
        present[mod(m, 12)] = true;
        if (m < lowest) { lowest = m; lowestPc = mod(m, 12); }
      }
      for (var i = 0; i < required.length; i++) if (!present[required[i]]) return;
      if (opts.rootInBass && lowestPc !== root) return;

      var fretted = fr.filter(function (f) { return f > 0; });
      var minF = fretted.length ? Math.min.apply(null, fretted) : 0;
      var maxF = fretted.length ? Math.max.apply(null, fretted) : 0;
      if (maxF - minF > maxSpan) return;

      // Dedos: sin cejilla hasta 4 notas pisadas; con cejilla en el traste más bajo
      var barre = null, fingers = fretted.length;
      if (fingers > 4) {
        var bs = -1, be = -1;
        for (s = first; s <= last; s++) if (fr[s] === minF) { if (bs < 0) bs = s; be = s; }
        for (s = bs; s <= be; s++) if (fr[s] < minF) return;   // la cejilla no puede pasar por cuerdas al aire
        fingers = 1 + fretted.filter(function (f) { return f > minF; }).length;
        if (fingers > 4) return;
        barre = { fret: minF, from: bs, to: be };
      }

      var missingOptional = opts.pcs.filter(function (p) { return !present[p]; }).length;
      // Cuerdas al aire: naturales en acordes de posición abierta (todo ≤ traste 3);
      // mezcladas con trastes altos por encima de una cuerda pisada resultan incómodas.
      var opens = 0, awkwardOpens = 0, seenFretted = false;
      for (s = first; s <= last; s++) {
        if (fr[s] > 0) seenFretted = true;
        else if (fr[s] === 0) { opens++; if (seenFretted && maxF >= 3) awkwardOpens++; }
      }
      var score = minF * 1.0 + (maxF - minF) * 1.2 - sounding * 1.3
                + (barre ? 0.8 : 0) + missingOptional * 2.5
                + awkwardOpens * 1.2 - (maxF <= 3 ? opens * 0.3 : 0);
      if (score < bestScore) {
        bestScore = score;
        var baseFret = maxF <= (opts.visibleFrets || 4) ? 1 : minF;
        best = { frets: fr, baseFret: baseFret, barre: barre };
      }
    }
  }

  /** ¿Una digitación suena exactamente las notas del acorde? (para validar tablas escritas a mano) */
  function checkVoicing(frets, tuning, pcs, optional, rootInBass) {
    var allowed = {}, present = {}, lowest = Infinity, lowestPc = -1;
    pcs.forEach(function (p) { allowed[p] = true; });
    for (var s = 0; s < frets.length; s++) {
      if (frets[s] < 0) continue;
      var m = tuning[s] + frets[s];
      if (!allowed[mod(m, 12)]) return false;
      present[mod(m, 12)] = true;
      if (m < lowest) { lowest = m; lowestPc = mod(m, 12); }
    }
    var ok = pcs.every(function (p) { return present[p] || (optional || []).indexOf(p) >= 0; });
    return ok && (!rootInBass || lowestPc === pcs[0]);
  }

  global.Theory = {
    LETTERS: LETTERS, ES: ES, CHORDS: CHORDS, SCALES: SCALES,
    parse: parse, spell: spell, pc: pc, midi: midi, display: display, simplify: simplify,
    fromRoot: fromRoot, enharmonics: enharmonics, rootButtonLabel: rootButtonLabel, bestRoot: bestRoot, bestScaleRoot: bestScaleRoot, chordDef: chordDef,
    chord: chord, scale: scale, degreeRoot: degreeRoot,
    transposeName: transposeName, keyForPc: keyForPc,
    findVoicing: findVoicing, checkVoicing: checkVoicing
  };

}(typeof window !== 'undefined' ? window : this));
