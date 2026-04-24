# Contexto del Proyecto — MusicTools

## Árbol de directorios

```
vocalizerAleatorio/
├── .github/
│   └── workflows/
│       └── static.yml
├── apps/
│   ├── acordes-guitarra/
│   │   └── index.html
│   ├── afinador/
│   │   └── index.html
│   ├── escalas/
│   │   └── index.html
│   └── vocalizer/
│       └── index.html
├── shared/
│   ├── audio-utils.js
│   └── style.css
└── index.html
```

---

## Archivos de código fuente

---

### `index.html`

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>MusicTools</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css">
    <style>
        :root {
            --bg-dark: #1a1a2e;
            --bg-card: #16213e;
            --text-light: #e0e0e0;
            --text-muted: rgba(255,255,255,0.5);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--bg-dark);
            min-height: 100vh;
            color: white;
        }

        /* ---- Header ---- */
        .header {
            padding: 48px 24px 24px;
            text-align: center;
        }

        .header-logo {
            font-size: 48px;
            margin-bottom: 8px;
            display: flex;
            justify-content: center;
            opacity: 0.9;
        }

        .header h1 {
            font-size: 28px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }

        .header p {
            font-size: 14px;
            color: var(--text-muted);
            margin-top: 6px;
        }

        /* ---- Sección de categoría ---- */
        .section-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: var(--text-muted);
            font-weight: 700;
            padding: 0 20px;
            margin: 28px 0 12px;
        }

        /* ---- Grid de herramientas ---- */
        .tools-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            padding: 0 16px;
        }

        @media (min-width: 420px) {
            .tools-grid { padding: 0 20px; }
        }

        /* ---- Tarjeta de herramienta ---- */
        .tool-card {
            border-radius: 20px;
            padding: 20px 16px;
            text-decoration: none;
            color: white;
            display: flex;
            flex-direction: column;
            gap: 10px;
            position: relative;
            overflow: hidden;
            transition: transform 0.18s, box-shadow 0.18s;
            min-height: 150px;
        }

        .tool-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 30px rgba(0,0,0,0.4);
        }

        .tool-card:active { transform: scale(0.97); }

        .tool-card.coming-soon {
            opacity: 0.75;
            cursor: default;
        }

        .tool-card.coming-soon:hover { transform: none; box-shadow: none; }
        .tool-card.coming-soon:active { transform: none; }

        /* Gradientes por herramienta */
        .grad-vocalizer    { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .grad-afinador     { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
        .grad-acordes      { background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%); color: #1a1a2e; }
        .grad-escalas      { background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%); }
        .grad-metronomo    { background: linear-gradient(135deg, #4776e6 0%, #8e54e9 100%); }
        .grad-oidos        { background: linear-gradient(135deg, #00b4db 0%, #0083b0 100%); }

        .grad-acordes .tool-icon,
        .grad-acordes .tool-name,
        .grad-acordes .tool-desc { color: #1a1a2e; }
        .grad-acordes .badge-soon { background: rgba(0,0,0,0.15); color: #1a1a2e; }
        .grad-acordes .tool-arrow { color: rgba(0,0,0,0.4); }

        /* Decoración de fondo */
        .tool-card::before {
            content: '';
            position: absolute;
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: rgba(255,255,255,0.07);
            bottom: -30px;
            right: -20px;
        }

        .tool-card::after {
            content: '';
            position: absolute;
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: rgba(255,255,255,0.05);
            bottom: 20px;
            right: 40px;
        }

        .tool-icon {
            font-size: 28px;
            line-height: 1;
            display: flex;
            align-items: center;
        }

        .tool-icon .ti {
            font-size: inherit;
            line-height: 1;
        }

        .tool-content { flex: 1; }

        .tool-name {
            font-size: 15px;
            font-weight: 800;
            letter-spacing: -0.2px;
        }

        .tool-desc {
            font-size: 11px;
            opacity: 0.75;
            margin-top: 3px;
            line-height: 1.4;
        }

        .tool-arrow {
            font-size: 18px;
            opacity: 0.5;
            align-self: flex-end;
            display: flex;
            align-items: center;
        }

        .badge-soon {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            font-size: 9px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 20px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin-top: 4px;
        }

        /* ---- Tarjeta ancha (full width) ---- */
        .tools-grid .full-width {
            grid-column: 1 / -1;
            min-height: 120px;
            flex-direction: row;
            align-items: center;
            gap: 16px;
        }

        .full-width .tool-icon { font-size: 38px; }
        .full-width .tool-name { font-size: 18px; }
        .full-width .tool-desc { font-size: 13px; }

        /* ---- Footer ---- */
        .footer {
            text-align: center;
            padding: 32px 16px 48px;
            font-size: 12px;
            color: var(--text-muted);
        }

        .footer a { color: var(--text-muted); }
    </style>
</head>
<body>

<div class="header">
    <div class="header-logo"><i class="ti ti-music"></i></div>
    <h1>MusicTools</h1>
    <p>Herramientas para aprender y practicar música</p>
</div>

<!-- Voz -->
<div class="section-label">Voz</div>
<div class="tools-grid">
    <a class="tool-card grad-vocalizer full-width" href="apps/vocalizer/">
        <div class="tool-icon"><i class="ti ti-microphone"></i></div>
        <div class="tool-content">
            <div class="tool-name">Vocalizer</div>
            <div class="tool-desc">Ejercicios de voz con escalas, tesituras y patrones rítmicos</div>
        </div>
        <div class="tool-arrow"><i class="ti ti-chevron-right"></i></div>
    </a>
</div>

<!-- Guitarra -->
<div class="section-label">Guitarra</div>
<div class="tools-grid">
    <a class="tool-card grad-afinador" href="apps/afinador/">
        <div class="tool-icon"><i class="ti ti-guitar-pick"></i></div>
        <div class="tool-content">
            <div class="tool-name">Afinador</div>
            <div class="tool-desc">Afina por micrófono o con tonos de referencia</div>
            <div class="badge-soon">Próximamente</div>
        </div>
        <div class="tool-arrow"><i class="ti ti-chevron-right"></i></div>
    </a>

    <a class="tool-card grad-acordes" href="apps/acordes-guitarra/">
        <div class="tool-icon"><i class="ti ti-playlist"></i></div>
        <div class="tool-content">
            <div class="tool-name">Acordes</div>
            <div class="tool-desc">Diagramas y audio de acordes de guitarra</div>
            <div class="badge-soon">Próximamente</div>
        </div>
        <div class="tool-arrow"><i class="ti ti-chevron-right"></i></div>
    </a>
</div>

<!-- Teoría musical -->
<div class="section-label">Teoría musical</div>
<div class="tools-grid">
    <a class="tool-card grad-escalas" href="apps/escalas/">
        <div class="tool-icon"><i class="ti ti-piano"></i></div>
        <div class="tool-content">
            <div class="tool-name">Escalas</div>
            <div class="tool-desc">Explora escalas en el teclado con sonido</div>
        </div>
        <div class="tool-arrow"><i class="ti ti-chevron-right"></i></div>
    </a>

    <div class="tool-card grad-metronomo coming-soon">
        <div class="tool-icon"><i class="ti ti-metronome"></i></div>
        <div class="tool-content">
            <div class="tool-name">Metrónomo</div>
            <div class="tool-desc">Pulso preciso con subdivisiones y compases</div>
            <div class="badge-soon">Próximamente</div>
        </div>
        <div class="tool-arrow"><i class="ti ti-chevron-right"></i></div>
    </div>

    <div class="tool-card grad-oidos coming-soon">
        <div class="tool-icon"><i class="ti ti-headphones"></i></div>
        <div class="tool-content">
            <div class="tool-name">Entrenamiento auditivo</div>
            <div class="tool-desc">Reconoce intervalos y acordes de oído</div>
            <div class="badge-soon">Próximamente</div>
        </div>
        <div class="tool-arrow"><i class="ti ti-chevron-right"></i></div>
    </div>
</div>

<div class="footer">
    MusicTools · Herramientas libres para músicos
</div>

</body>
</html>
```

---

### `shared/style.css`

```css
/* =====================================================
   MusicTools - Estilos compartidos
   ===================================================== */
@import url('https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css');

:root {
    --bg-dark: #1a1a2e;
    --bg-card: #16213e;
    --primary: #667eea;
    --secondary: #764ba2;
    --bg-light: #f8f9fa;
    --text-dark: #333;
    --text-muted: #888;
    --card-radius: 24px;
    --shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    --shadow-sm: 0 4px 15px rgba(0, 0, 0, 0.2);
}

* { box-sizing: border-box; }

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: var(--bg-dark);
    min-height: 100vh;
    margin: 0;
    color: var(--text-dark);
}

/* ---- Contenedor de app (card centrada) ---- */
.app-card {
    background: white;
    width: 100%;
    max-width: 500px;
    min-height: 95vh;
    border-radius: var(--card-radius);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: var(--shadow);
    margin: 2.5vh auto;
}

/* ---- Barra de navegación superior ---- */
.app-nav {
    display: flex;
    align-items: center;
    padding: 10px 16px;
    background: rgba(0, 0, 0, 0.15);
    flex-shrink: 0;
}

.nav-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: rgba(255, 255, 255, 0.85);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 10px;
    border-radius: 8px;
    transition: background 0.2s;
    letter-spacing: 0.3px;
}

.nav-back:hover {
    background: rgba(255, 255, 255, 0.12);
    color: white;
}

.nav-back svg {
    width: 16px;
    height: 16px;
}

/* ---- Botones genéricos ---- */
.btn {
    border: none;
    border-radius: 12px;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.15s, opacity 0.15s;
    font-family: inherit;
}

.btn:active { transform: scale(0.97); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary {
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    color: white;
}

.btn-danger {
    background: #ff4757;
    color: white;
}

/* ---- Sección de display / cabecera de app ---- */
.display-section {
    padding: 20px;
    text-align: center;
    color: white;
    flex-shrink: 0;
    box-shadow: var(--shadow-sm);
}

/* ---- Cuerpo scrolleable ---- */
.config-body {
    flex-grow: 1;
    overflow-y: auto;
    padding: 20px;
    background: var(--bg-light);
}

/* ---- Tarjeta de sección ---- */
.section-card {
    background: white;
    border-radius: 15px;
    padding: 15px;
    margin-bottom: 15px;
    border: 1px solid #eee;
}

.section-title {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted);
    margin-bottom: 12px;
    font-weight: bold;
}

/* ---- Formularios ---- */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 5px;
    color: var(--text-dark);
}

select, input[type="text"], input[type="number"] {
    width: 100%;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid #ddd;
    font-size: 14px;
    font-family: inherit;
}

/* ---- Toggle row ---- */
.toggle-row {
    display: flex;
    background: #eee;
    border-radius: 8px;
    padding: 3px;
}

.toggle-btn {
    flex: 1;
    border: none;
    background: none;
    padding: 5px;
    font-size: 12px;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.15s;
    font-family: inherit;
}

.toggle-btn.active {
    background: white;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    font-weight: bold;
}

/* ---- Barra de acciones inferior ---- */
.action-bar {
    padding: 15px 20px;
    background: white;
    border-top: 1px solid #eee;
    display: flex;
    gap: 10px;
    flex-shrink: 0;
}

.action-bar .btn {
    flex: 1;
    padding: 15px;
}
```

---

### `shared/audio-utils.js`

```js
/**
 * MusicTools - Utilidades de audio compartidas
 * Requiere Tone.js cargado previamente en la página.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Genera un array con todas las notas en el rango de octavas dado.
 * Ej: getAllNotes(2, 5) → ['C2', 'C#2', ..., 'B5']
 */
function getAllNotes(octaveMin = 2, octaveMax = 6) {
    const notes = [];
    for (let o = octaveMin; o <= octaveMax; o++) {
        NOTE_NAMES.forEach(n => notes.push(n + o));
    }
    return notes;
}

/**
 * Inicia el contexto de audio (requerido por los navegadores antes de reproducir).
 * Debe llamarse desde un evento de usuario (click, tap).
 */
async function startAudio() {
    if (typeof Tone !== 'undefined') {
        await Tone.start();
    }
}

/**
 * Convierte un índice de nota a su frecuencia en Hz.
 * Usa A4 = 440 Hz como referencia (MIDI standard).
 * noteIndex: posición en el array de getAllNotes(2,6)
 */
function noteIndexToFreq(noteIndex, octaveMin = 2) {
    // C2 = MIDI 36
    const midiBase = 12 + (octaveMin * 12);
    const midi = midiBase + noteIndex;
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Devuelve el nombre limpio de una nota sin octava.
 * Ej: 'C#4' → 'C#'
 */
function noteBaseName(noteStr) {
    return noteStr.replace(/\d/g, '');
}
```

---

### `apps/vocalizer/index.html`

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vocalizer - MusicTools</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
    <link rel="stylesheet" href="../../shared/style.css">
    <style>
        body { display: flex; justify-content: center; align-items: flex-start; }

        .display-section {
            background: linear-gradient(135deg, #667eea, #764ba2);
        }

        .vowel-large { font-size: 80px; font-weight: 800; line-height: 1; margin: 10px 0; }
        .note-small  { font-size: 24px; opacity: 0.9; font-weight: 300; }

        .preset-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }

        .btn-mini {
            padding: 5px; font-size: 11px; background: #eee;
            border-radius: 6px; border: none; cursor: pointer;
            font-family: inherit; transition: background 0.15s, color 0.15s;
        }
        .btn-mini:hover { background: #667eea; color: white; }

        .btn-play { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
        .btn-stop { background: #ff4757; color: white; display: none; }
    </style>
</head>
<body>

<div class="app-card">

    <!-- Navegación -->
    <div class="display-section" id="display" style="padding-top:10px;">
        <div class="app-nav" style="background:none; padding: 0 4px 8px;">
            <a class="nav-back" href="../../index.html">
                <i class="ti ti-chevron-left"></i>
                MusicTools
            </a>
        </div>
        <div class="note-small" id="currentNote">Listo para cantar</div>
        <div class="vowel-large" id="currentVowel">-</div>
        <div class="note-small" id="progressInfo">Selecciona un ejercicio</div>
    </div>

    <div class="config-body">
        <div class="section-card">
            <div class="section-title">Tesitura</div>
            <div class="preset-grid">
                <button class="btn-mini" onclick="setVoicePreset('soprano')">Soprano</button>
                <button class="btn-mini" onclick="setVoicePreset('mezzosoprano')">Mezzo</button>
                <button class="btn-mini" onclick="setVoicePreset('alto')">Alto</button>
                <button class="btn-mini" onclick="setVoicePreset('tenor')">Tenor</button>
                <button class="btn-mini" onclick="setVoicePreset('baritone')">Barítono</button>
                <button class="btn-mini" onclick="setVoicePreset('bass')">Bajo</button>
            </div>
            <div class="grid-2" style="margin-top:10px">
                <div><label>Inicio</label><select id="startNote"></select></div>
                <div><label>Fin</label><select id="endNote"></select></div>
            </div>
        </div>

        <div class="section-card">
            <div class="section-title">Ejercicio</div>
            <label>Tipo de Salto</label>
            <select id="pattern">
                <option value="scale">Escala Lineal</option>
                <option value="triad">Tríada (1-3-5-3-1)</option>
                <option value="octave">Octava (1-5-8-5-1)</option>
                <option value="arpeggio">Arpegio (1-3-5-8-5-3-1)</option>
                <option value="messa">Messa di Voce (Sostenido)</option>
            </select>
            <div id="scaleGroup" style="margin-top:10px">
                <label>Escala</label>
                <select id="scale">
                    <option value="major">Mayor</option>
                    <option value="minor">Menor</option>
                </select>
            </div>
        </div>

        <div class="section-card">
            <div class="section-title">Vocales</div>
            <select id="vowelPattern">
                <option value="a">Solo A</option>
                <option value="aeiou">A - E - I - O - U</option>
                <option value="mama">Ma - Me - Mi - Mo - Mu</option>
            </select>
        </div>

        <div class="section-card">
            <div class="section-title">Ajustes</div>
            <label>Modo</label>
            <select id="practiceMode">
                <option value="single">Tocar una vez</option>
                <option value="loop">Subir Automático</option>
                <option value="loop-desc">Bajar Automático</option>
            </select>
            <div class="grid-2" style="margin-top:10px">
                <div>
                    <label>BPM: <span id="bpmVal">100</span></label>
                    <input type="range" id="tempo" min="60" max="180" value="100">
                </div>
                <div>
                    <label>Metrónomo</label>
                    <div class="toggle-row">
                        <button class="toggle-btn active" id="mOff" onclick="setMet(false)">Off</button>
                        <button class="toggle-btn" id="mOn" onclick="setMet(true)">On</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="action-bar">
        <button class="btn btn-play" id="playBtn" onclick="startExercise()">INICIAR ENTRENAMIENTO</button>
        <button class="btn btn-stop" id="stopBtn" onclick="stopExercise()">DETENER</button>
    </div>
</div>

<script src="../../shared/audio-utils.js"></script>
<script>
    const notes = getAllNotes(2, 6);
    const scales = { major: [0,2,4,5,7,9,11,12], minor: [0,2,3,5,7,8,10,12] };
    const patterns = {
        scale:   [0,1,2,3,4,5,6,7,6,5,4,3,2,1,0],
        triad:   [0,2,4,2,0],
        octave:  [0,4,7,4,0],
        arpeggio:[0,2,4,7,4,2,0],
        messa:   [0]
    };
    const vowels = { a:['A'], aeiou:['A','E','I','O','U'], mama:['Ma','Me','Mi','Mo','Mu'] };
    const voicePresets = {
        soprano:['C4','C6'], mezzosoprano:['A3','A5'], alto:['F3','F5'],
        tenor:['C3','C5'], baritone:['G2','G4'], bass:['E2','E4']
    };

    let synth, metClick, isPlaying = false, metEnabled = false, loopTimeout;

    function init() {
        const s = document.getElementById('startNote');
        const e = document.getElementById('endNote');
        notes.forEach((n, i) => {
            s.options.add(new Option(n, i));
            e.options.add(new Option(n, i));
        });
        s.value = 24; e.value = 48;

        synth    = new Tone.Synth().toDestination();
        metClick = new Tone.MembraneSynth({ volume: -10 }).toDestination();

        document.getElementById('tempo').oninput = (ev) => {
            document.getElementById('bpmVal').innerText = ev.target.value;
        };
    }

    function setVoicePreset(v) {
        document.getElementById('startNote').value = notes.indexOf(voicePresets[v][0]);
        document.getElementById('endNote').value   = notes.indexOf(voicePresets[v][1]);
    }

    function setMet(v) {
        metEnabled = v;
        document.getElementById('mOn').classList.toggle('active',  v);
        document.getElementById('mOff').classList.toggle('active', !v);
    }

    async function startExercise() {
        if (isPlaying) return;
        await startAudio();
        isPlaying = true;
        document.getElementById('playBtn').style.display = 'none';
        document.getElementById('stopBtn').style.display = 'block';

        const config = {
            start:  parseInt(document.getElementById('startNote').value),
            end:    parseInt(document.getElementById('endNote').value),
            pattern: document.getElementById('pattern').value,
            scale:   document.getElementById('scale').value,
            vowels:  document.getElementById('vowelPattern').value,
            mode:    document.getElementById('practiceMode').value,
            bpm:     parseInt(document.getElementById('tempo').value)
        };

        runSequence(config.start, config);
    }

    function runSequence(baseNoteIdx, config) {
        if (!isPlaying) return;
        if (config.mode === 'loop'      && baseNoteIdx > config.end)   return stopExercise();
        if (config.mode === 'loop-desc' && baseNoteIdx < config.start) return stopExercise();

        const scaleInt     = scales[config.scale];
        const patternGrades = patterns[config.pattern];
        const vowelList    = vowels[config.vowels];

        const sequence = patternGrades.map(grade => {
            const octaveShift  = Math.floor(grade / 8);
            const scaleDegree  = grade % 8;
            const semitoneJump = scaleInt[scaleDegree] + (octaveShift * 12);
            return notes[baseNoteIdx + semitoneJump];
        });

        const stepTime = 60 / config.bpm;
        const isMessa  = config.pattern === 'messa';
        const duration = isMessa ? 4 : stepTime;

        Tone.Transport.stop();
        Tone.Transport.cancel();

        const part = new Tone.Part((time, event) => {
            if (metEnabled) metClick.triggerAttackRelease("C2", "32n", time);
            synth.triggerAttackRelease(event.note, duration * 0.8, time);

            Tone.Draw.schedule(() => {
                document.getElementById('currentNote').innerText    = event.note;
                document.getElementById('currentVowel').innerText   = vowelList[event.i % vowelList.length];
                document.getElementById('progressInfo').innerText   = `Tonalidad base: ${notes[baseNoteIdx]}`;
            }, time);
        }, sequence.map((n, i) => [i * stepTime, { note: n, i }]));

        part.start(0);
        Tone.Transport.start();

        const nextStepDelay = (sequence.length * stepTime) + (stepTime * 2);

        if (config.mode !== 'single') {
            loopTimeout = setTimeout(() => {
                const nextIdx = config.mode === 'loop' ? baseNoteIdx + 1 : baseNoteIdx - 1;
                runSequence(nextIdx, config);
            }, nextStepDelay * 1000);
        } else {
            loopTimeout = setTimeout(stopExercise, nextStepDelay * 1000);
        }
    }

    function stopExercise() {
        isPlaying = false;
        clearTimeout(loopTimeout);
        Tone.Transport.stop();
        Tone.Transport.cancel();
        document.getElementById('playBtn').style.display = 'block';
        document.getElementById('stopBtn').style.display = 'none';
        document.getElementById('currentVowel').innerText = "-";
        document.getElementById('currentNote').innerText  = "Ejercicio detenido";
    }

    window.onload = init;
</script>
</body>
</html>
```

---

### `apps/acordes-guitarra/index.html`

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acordes Guitarra - MusicTools</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
    <link rel="stylesheet" href="../../shared/style.css">
    <style>
        body { display: flex; justify-content: center; align-items: flex-start; }

        .display-section {
            background: linear-gradient(135deg, #f7971e, #ffd200);
            color: #1a1a2e;
        }
        .display-section .nav-back { color: rgba(0,0,0,0.55); }
        .display-section .nav-back:hover { background: rgba(0,0,0,0.08); color: #1a1a2e; }

        /* Cabecera */
        .chord-header {
            display: flex;
            align-items: baseline;
            justify-content: center;
            gap: 6px;
            margin: 8px 0 2px;
        }
        .chord-name-big  { font-size: 58px; font-weight: 800; line-height: 1; color: #1a1a2e; }
        .chord-type-sup  { font-size: 20px; font-weight: 600; color: rgba(0,0,0,0.55); align-self: flex-start; margin-top: 10px; }
        .chord-notes-row { font-size: 13px; opacity: 0.6; margin-bottom: 6px; letter-spacing: 0.3px; }

        /* Diagrama */
        .diagram-wrap {
            display: flex;
            justify-content: center;
            padding: 8px 0 4px;
        }
        canvas#chordCanvas { display: block; }

        /* Strum animation */
        @keyframes strumPulse {
            0%   { transform: scale(1); }
            50%  { transform: scale(1.06); }
            100% { transform: scale(1); }
        }
        .btn-strum.strumming { animation: strumPulse 0.25s ease; }

        /* Root grid */
        .root-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 5px;
        }
        .root-btn {
            padding: 8px 2px;
            border: 1.5px solid #eee;
            border-radius: 8px;
            background: white;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            font-family: inherit;
            text-align: center;
            transition: all 0.15s;
        }
        .root-btn:hover  { border-color: #f7971e; color: #f7971e; }
        .root-btn.active { background: #f7971e; border-color: #f7971e; color: white; }

        /* Type chips */
        .type-chip {
            padding: 7px 13px;
            border-radius: 20px;
            border: 1.5px solid #ddd;
            background: white;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.15s;
            white-space: nowrap;
        }
        .type-chip:hover  { border-color: #f7971e; color: #f7971e; }
        .type-chip.active { background: #f7971e; border-color: #f7971e; color: white; }

        /* Note pills */
        .note-pills { display: flex; gap: 6px; flex-wrap: wrap; }
        .note-pill {
            padding: 5px 11px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 700;
            background: #fff3e0;
            color: #e65100;
        }
        .note-pill.root { background: #f7971e; color: white; }

        .btn-strum {
            background: linear-gradient(135deg, #f7971e, #ffd200);
            color: #1a1a2e;
            font-weight: 800;
            font-size: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
    </style>
</head>
<body>
<div class="app-card">

    <!-- Cabecera -->
    <div class="display-section" style="padding-top:10px;">
        <div class="app-nav" style="background:none; padding:0 4px 6px;">
            <a class="nav-back" href="../../index.html">
                <i class="ti ti-chevron-left"></i> MusicTools
            </a>
        </div>
        <div class="chord-header">
            <div class="chord-name-big" id="dispName">Am</div>
            <div class="chord-type-sup" id="dispType">menor</div>
        </div>
        <div class="chord-notes-row" id="dispNotes">La · Do · Mi</div>
    </div>

    <div class="config-body">

        <!-- Diagrama -->
        <div class="section-card" style="padding:12px 8px;">
            <div class="section-title" style="padding-left:8px;">Diagrama</div>
            <div class="diagram-wrap">
                <canvas id="chordCanvas" width="250" height="270"></canvas>
            </div>
        </div>

        <!-- Notas del acorde -->
        <div class="section-card">
            <div class="section-title">Notas</div>
            <div class="note-pills" id="notePills"></div>
        </div>

        <!-- Tipo de acorde -->
        <div class="section-card">
            <div class="section-title">Tipo de acorde</div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;" id="typeFilter">
                <button class="type-chip active" onclick="setType('major',this)">Mayor</button>
                <button class="type-chip" onclick="setType('minor',this)">Menor</button>
                <button class="type-chip" onclick="setType('7',this)">7ª Dom.</button>
                <button class="type-chip" onclick="setType('m7',this)">m7</button>
                <button class="type-chip" onclick="setType('maj7',this)">Maj7</button>
                <button class="type-chip" onclick="setType('sus2',this)">Sus2</button>
                <button class="type-chip" onclick="setType('sus4',this)">Sus4</button>
            </div>
        </div>

        <!-- Nota raíz -->
        <div class="section-card">
            <div class="section-title">Nota raíz</div>
            <div class="root-grid" id="rootGrid"></div>
        </div>

    </div>

    <div class="action-bar">
        <button class="btn btn-strum" id="strumBtn" onclick="strumChord()">
            <i class="ti ti-guitar-pick"></i> Rasguear acorde
        </button>
    </div>
</div>

<script src="../../shared/audio-utils.js"></script>
<script>
// ─────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────
const NOTE_EN = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTE_ES = ['Do','Do#','Re','Re#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];

// MIDI de cuerdas al aire: E2, A2, D3, G3, B3, E4
const OPEN_MIDI = [40, 45, 50, 55, 59, 64];

const CHORD_INTERVALS = {
    major: [0,4,7],
    minor: [0,3,7],
    '7':   [0,4,7,10],
    m7:    [0,3,7,10],
    maj7:  [0,4,7,11],
    sus2:  [0,2,7],
    sus4:  [0,5,7],
};

const TYPE_LABELS = {
    major:'mayor', minor:'menor', '7':'7ª', m7:'m7', maj7:'maj7', sus2:'sus2', sus4:'sus4'
};

// ─────────────────────────────────────────────
// DATOS DE ACORDES
// frets: [str6(LowE), str5(A), str4(D), str3(G), str2(B), str1(highE)]
// -1=muda, 0=al aire, n=traste
// barre: {fret, from, to} (índices de cuerda 0-5)
// ─────────────────────────────────────────────
const SHAPES = {
    // ── MAYOR ──
    'C_major':   {frets:[-1,3,2,0,1,0], baseFret:1, barre:null},
    'D_major':   {frets:[-1,-1,0,2,3,2], baseFret:1, barre:null},
    'E_major':   {frets:[0,2,2,1,0,0],  baseFret:1, barre:null},
    'F_major':   {frets:[1,3,3,2,1,1],  baseFret:1, barre:{fret:1,from:0,to:5}},
    'G_major':   {frets:[3,2,0,0,0,3],  baseFret:1, barre:null},
    'A_major':   {frets:[-1,0,2,2,2,0], baseFret:1, barre:null},
    'B_major':   {frets:[-1,2,4,4,4,2], baseFret:2, barre:{fret:2,from:1,to:5}},
    // ── MENOR ──
    'C_minor':   {frets:[-1,3,5,5,4,3], baseFret:3, barre:{fret:3,from:1,to:5}},
    'D_minor':   {frets:[-1,-1,0,2,3,1], baseFret:1, barre:null},
    'E_minor':   {frets:[0,2,2,0,0,0],  baseFret:1, barre:null},
    'F_minor':   {frets:[1,3,3,1,1,1],  baseFret:1, barre:{fret:1,from:0,to:5}},
    'G_minor':   {frets:[3,5,5,3,3,3],  baseFret:3, barre:{fret:3,from:0,to:5}},
    'A_minor':   {frets:[-1,0,2,2,1,0], baseFret:1, barre:null},
    'B_minor':   {frets:[-1,2,4,4,3,2], baseFret:2, barre:{fret:2,from:1,to:5}},
    // ── 7ª DOMINANTE ──
    'C_7':       {frets:[-1,3,2,3,1,0], baseFret:1, barre:null},
    'D_7':       {frets:[-1,-1,0,2,1,2], baseFret:1, barre:null},
    'E_7':       {frets:[0,2,0,1,0,0],  baseFret:1, barre:null},
    'F_7':       {frets:[1,3,1,2,1,1],  baseFret:1, barre:{fret:1,from:0,to:5}},
    'G_7':       {frets:[3,2,0,0,0,1],  baseFret:1, barre:null},
    'A_7':       {frets:[-1,0,2,0,2,0], baseFret:1, barre:null},
    'B_7':       {frets:[-1,2,1,2,0,2], baseFret:1, barre:null},
    // ── m7 ──
    'A_m7':      {frets:[-1,0,2,0,1,0], baseFret:1, barre:null},
    'D_m7':      {frets:[-1,-1,0,2,1,1], baseFret:1, barre:null},
    'E_m7':      {frets:[0,2,0,0,0,0],  baseFret:1, barre:null},
    'G_m7':      {frets:[3,5,3,3,3,3],  baseFret:3, barre:{fret:3,from:0,to:5}},
    'B_m7':      {frets:[-1,2,4,2,3,2], baseFret:2, barre:{fret:2,from:1,to:5}},
    'C_m7':      {frets:[-1,3,5,3,4,3], baseFret:3, barre:{fret:3,from:1,to:5}},
    'F_m7':      {frets:[1,3,1,1,1,1],  baseFret:1, barre:{fret:1,from:0,to:5}},
    // ── Maj7 ──
    'C_maj7':    {frets:[-1,3,2,0,0,0], baseFret:1, barre:null},
    'D_maj7':    {frets:[-1,-1,0,2,2,2], baseFret:1, barre:null},
    'E_maj7':    {frets:[0,2,1,1,0,0],  baseFret:1, barre:null},
    'G_maj7':    {frets:[3,2,0,0,0,2],  baseFret:1, barre:null},
    'A_maj7':    {frets:[-1,0,2,1,2,0], baseFret:1, barre:null},
    'F_maj7':    {frets:[1,3,3,2,1,0],  baseFret:1, barre:{fret:1,from:0,to:4}},
    // ── Sus2 ──
    'A_sus2':    {frets:[-1,0,2,2,0,0], baseFret:1, barre:null},
    'D_sus2':    {frets:[-1,-1,0,2,3,0], baseFret:1, barre:null},
    'E_sus2':    {frets:[0,2,4,4,0,0],  baseFret:1, barre:null},
    'G_sus2':    {frets:[3,0,0,0,3,3],  baseFret:1, barre:null},
    // ── Sus4 ──
    'A_sus4':    {frets:[-1,0,2,2,3,0], baseFret:1, barre:null},
    'D_sus4':    {frets:[-1,-1,0,2,3,3], baseFret:1, barre:null},
    'E_sus4':    {frets:[0,2,2,2,0,0],  baseFret:1, barre:null},
    'G_sus4':    {frets:[3,3,0,0,1,3],  baseFret:1, barre:null},
};

// ─────────────────────────────────────────────
// GENERADOR DE CEJILLA (para acordes sin forma predefinida)
// ─────────────────────────────────────────────
function buildBarreShape(rootIdx, type) {
    const eFret = ((rootIdx - 4) % 12 + 12) % 12 || 12;
    const aFret = ((rootIdx - 9) % 12 + 12) % 12 || 12;

    const useE = eFret <= aFret;
    const f    = useE ? eFret : aFret;

    if (useE) {
        const shapes = {
            major: [f, f+2, f+2, f+1, f,   f  ],
            minor: [f, f+2, f+2, f,   f,   f  ],
            '7':   [f, f+2, f,   f+1, f,   f  ],
            m7:    [f, f+2, f,   f,   f,   f  ],
            maj7:  [f, f+2, f+1, f+1, f,   f  ],
            sus2:  [f, f+2, f+2, f-1>=0?f-1:f, f, f],
            sus4:  [f, f+2, f+2, f+2, f,   f  ],
        };
        return { frets: shapes[type] || shapes.major, baseFret: f, barre:{fret:f,from:0,to:5} };
    } else {
        const shapes = {
            major: [-1, f, f+2, f+2, f+2, f  ],
            minor: [-1, f, f+2, f+2, f+1, f  ],
            '7':   [-1, f, f+2, f,   f+2, f  ],
            m7:    [-1, f, f+2, f,   f+1, f  ],
            maj7:  [-1, f, f+2, f+1, f+2, f  ],
            sus2:  [-1, f, f+2, f+2, f-1>=0?f-1:f, f],
            sus4:  [-1, f, f+2, f+3, f+2, f  ],
        };
        return { frets: shapes[type] || shapes.major, baseFret: f, barre:{fret:f,from:1,to:5} };
    }
}

function getShape(rootIdx, type) {
    const key = NOTE_EN[rootIdx] + '_' + type;
    return SHAPES[key] || buildBarreShape(rootIdx, type);
}

// ─────────────────────────────────────────────
// ESTADO
// ─────────────────────────────────────────────
let rootIdx = 9; // La / A
let chordType = 'minor';

// ─────────────────────────────────────────────
// AUDIO — PluckSynth acústico
// ─────────────────────────────────────────────
let plucks = null;
let fxChain = null;

function initAudio() {
    if (plucks) return;

    const verb = new Tone.Freeverb({
        roomSize:  0.22,
        dampening: 3200,
        wet:       0.10,
    }).toDestination();

    const eq = new Tone.EQ3({
        low:  4,
        mid:  1,
        high: -6,
        lowFrequency:  400,
        highFrequency: 2500,
    }).connect(verb);

    fxChain = { eq, verb };

    plucks = Array.from({length: 6}, () =>
        new Tone.PluckSynth({
            attackNoise: 0.6,
            dampening:   4200,
            resonance:   0.985,
        }).connect(eq)
    );
}

function midiToNoteName(midi) {
    const oct = Math.floor(midi / 12) - 1;
    return NOTE_EN[midi % 12] + oct;
}

async function strumChord() {
    if (Tone.context.state !== 'running') {
        await Tone.context.resume();
    }
    await Tone.start();
    initAudio();

    const shape = getShape(rootIdx, chordType);
    const btn   = document.getElementById('strumBtn');
    btn.classList.add('strumming');
    setTimeout(() => btn.classList.remove('strumming'), 260);

    shape.frets.forEach((fret, s) => {
        if (fret < 0) return;
        const note = midiToNoteName(OPEN_MIDI[s] + fret);
        setTimeout(() => plucks[s].triggerAttack(note), s * 42);
    });
}

// ─────────────────────────────────────────────
// CANVAS — DIAGRAMA DE ACORDE
// ─────────────────────────────────────────────
const CANVAS_W   = 250;
const CANVAS_H   = 270;
const STR_LEFT   = 32;
const STR_RIGHT  = 210;
const NUT_Y      = 62;
const FRET_H     = 42;
const FRET_COUNT = 4;
const STR_GAP    = (STR_RIGHT - STR_LEFT) / 5;
const MARKER_Y   = 36;
const DOT_R      = 11;

function strX(s) { return STR_LEFT + s * STR_GAP; }
function fretLineY(f) { return NUT_Y + f * FRET_H; }
function dotCenterY(f) { return fretLineY(f - 1) + FRET_H / 2; }

function drawDiagram(shape) {
    const canvas = document.getElementById('chordCanvas');
    const ctx    = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    const { frets, baseFret, barre } = shape;

    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (baseFret > 1) {
        ctx.fillStyle = '#888';
        ctx.font = 'bold 13px Segoe UI, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(baseFret + 'fr', STR_RIGHT + 8, NUT_Y + FRET_H / 2);
    }

    ctx.strokeStyle = baseFret === 1 ? '#1a1a2e' : '#bbb';
    ctx.lineWidth   = baseFret === 1 ? 7 : 1.5;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(strX(0), NUT_Y);
    ctx.lineTo(strX(5), NUT_Y);
    ctx.stroke();
    ctx.lineCap = 'butt';

    ctx.strokeStyle = '#ddd';
    ctx.lineWidth   = 1;
    for (let f = 1; f <= FRET_COUNT; f++) {
        ctx.beginPath();
        ctx.moveTo(strX(0), fretLineY(f));
        ctx.lineTo(strX(5), fretLineY(f));
        ctx.stroke();
    }

    for (let s = 0; s < 6; s++) {
        ctx.strokeStyle = '#c0c0c0';
        ctx.lineWidth   = 1 + (5 - s) * 0.18;
        ctx.beginPath();
        ctx.moveTo(strX(s), NUT_Y);
        ctx.lineTo(strX(s), fretLineY(FRET_COUNT));
        ctx.stroke();
    }

    if (barre) {
        const relFret = barre.fret - baseFret + 1;
        if (relFret >= 1 && relFret <= FRET_COUNT) {
            const by  = dotCenterY(relFret);
            const bx1 = strX(barre.from);
            const bx2 = strX(barre.to);
            const barH = DOT_R * 2;
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.roundRect(bx1 - DOT_R * 0.7, by - DOT_R, (bx2 - bx1) + DOT_R * 1.4, barH, DOT_R);
            ctx.fill();
        }
    }

    frets.forEach((fret, s) => {
        const x = strX(s);

        if (fret === -1) {
            ctx.strokeStyle = '#e53935';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x - 7, MARKER_Y - 7); ctx.lineTo(x + 7, MARKER_Y + 7);
            ctx.moveTo(x + 7, MARKER_Y - 7); ctx.lineTo(x - 7, MARKER_Y + 7);
            ctx.stroke();
            ctx.lineCap = 'butt';

        } else if (fret === 0) {
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, MARKER_Y, 8, 0, Math.PI * 2);
            ctx.stroke();

        } else {
            const relFret = fret - baseFret + 1;
            if (relFret < 1 || relFret > FRET_COUNT) return;
            if (barre && fret === barre.fret && s >= barre.from && s <= barre.to) return;

            const dy = dotCenterY(relFret);
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.arc(x, dy, DOT_R, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
    ctx.fillStyle = '#aaa';
    ctx.font = '11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    STRING_NAMES.forEach((n, s) => ctx.fillText(n, strX(s), fretLineY(FRET_COUNT) + 10));
}

// ─────────────────────────────────────────────
// RENDERIZADO DE UI
// ─────────────────────────────────────────────
function renderRootGrid() {
    const grid = document.getElementById('rootGrid');
    grid.innerHTML = '';
    NOTE_ES.forEach((name, i) => {
        const btn = document.createElement('button');
        btn.className = 'root-btn' + (i === rootIdx ? ' active' : '');
        btn.textContent = name;
        btn.onclick = () => {
            rootIdx = i;
            document.querySelectorAll('.root-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            update();
        };
        grid.appendChild(btn);
    });
}

function setType(type, btn) {
    chordType = type;
    document.querySelectorAll('.type-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    update();
}

function update() {
    const shape    = getShape(rootIdx, chordType);
    const intervals = CHORD_INTERVALS[chordType];
    const noteNames = intervals.map(i => NOTE_ES[(rootIdx + i) % 12]);

    const suffix = chordType === 'minor' ? 'm'
                 : chordType === '7'     ? '7'
                 : chordType === 'm7'    ? 'm7'
                 : chordType === 'maj7'  ? 'maj7'
                 : chordType === 'sus2'  ? 'sus2'
                 : chordType === 'sus4'  ? 'sus4'
                 : '';
    document.getElementById('dispName').textContent = NOTE_EN[rootIdx] + suffix;
    document.getElementById('dispType').textContent = TYPE_LABELS[chordType];
    document.getElementById('dispNotes').textContent = noteNames.join(' · ');

    const pillsEl = document.getElementById('notePills');
    pillsEl.innerHTML = '';
    noteNames.forEach((n, i) => {
        const pill = document.createElement('div');
        pill.className = 'note-pill' + (i === 0 ? ' root' : '');
        pill.textContent = n;
        pillsEl.appendChild(pill);
    });

    drawDiagram(shape);
}

// Init
renderRootGrid();
update();
</script>
</body>
</html>
```

---

### `apps/afinador/index.html`

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Afinador - MusicTools</title>
    <link rel="stylesheet" href="../../shared/style.css">
    <style>
        body { display: flex; justify-content: center; align-items: flex-start; }

        .display-section {
            background: linear-gradient(135deg, #11998e, #38ef7d);
        }

        .tuner-note {
            font-size: 90px;
            font-weight: 800;
            line-height: 1;
            margin: 12px 0 4px;
            letter-spacing: -2px;
        }

        .tuner-freq {
            font-size: 18px;
            opacity: 0.85;
            font-weight: 300;
        }

        .cents-bar-wrap {
            margin: 16px auto 4px;
            width: 85%;
            position: relative;
        }

        .cents-bar-bg {
            height: 10px;
            background: rgba(255,255,255,0.25);
            border-radius: 10px;
            position: relative;
            overflow: hidden;
        }

        .cents-bar-fill {
            position: absolute;
            height: 100%;
            width: 4px;
            background: white;
            border-radius: 4px;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            transition: left 0.1s ease;
        }

        .cents-center-mark {
            position: absolute;
            top: -3px;
            left: 50%;
            transform: translateX(-50%);
            width: 2px;
            height: 16px;
            background: rgba(255,255,255,0.6);
            border-radius: 1px;
        }

        .cents-labels {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            opacity: 0.7;
            margin-top: 4px;
            color: white;
        }

        .status-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: rgba(255,255,255,0.4);
            display: inline-block;
            margin-right: 6px;
            transition: background 0.2s;
        }
        .status-dot.active { background: white; box-shadow: 0 0 8px white; }

        .btn-listen {
            background: linear-gradient(135deg, #11998e, #38ef7d);
            color: white;
        }
        .btn-stop-tuner {
            background: #ff4757;
            color: white;
            display: none;
        }

        .note-ref-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
        }

        .note-ref-btn {
            padding: 8px 4px;
            font-size: 13px;
            font-weight: 600;
            background: #f0f0f0;
            border: 2px solid transparent;
            border-radius: 8px;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.15s;
            text-align: center;
        }

        .note-ref-btn:hover { background: #e0f7f4; border-color: #11998e; }
        .note-ref-btn.selected { background: #11998e; color: white; border-color: #11998e; }

        .coming-soon-badge {
            display: inline-block;
            background: rgba(255,255,255,0.2);
            color: white;
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 20px;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-top: 4px;
        }
    </style>
</head>
<body>

<div class="app-card">

    <div class="display-section" style="padding-top:10px;">
        <div class="app-nav" style="background:none; padding: 0 4px 8px;">
            <a class="nav-back" href="../../index.html">
                <i class="ti ti-chevron-left"></i>
                MusicTools
            </a>
        </div>
        <div style="font-size:15px; opacity:0.85;">
            <span class="status-dot" id="statusDot"></span>
            <span id="statusText">Inactivo</span>
        </div>
        <div class="tuner-note" id="tunerNote">--</div>
        <div class="tuner-freq" id="tunerFreq">--- Hz</div>

        <div class="cents-bar-wrap">
            <div class="cents-bar-bg">
                <div class="cents-bar-fill" id="centsBar"></div>
                <div class="cents-center-mark"></div>
            </div>
            <div class="cents-labels"><span>-50¢</span><span>0</span><span>+50¢</span></div>
        </div>

        <div class="coming-soon-badge">Próximamente</div>
    </div>

    <div class="config-body">
        <div class="section-card">
            <div class="section-title">Tono de referencia</div>
            <p style="font-size:13px; color:#666; margin:0 0 12px;">
                Pulsa cualquier nota para escuchar su tono de referencia mientras afinas.
            </p>
            <div class="note-ref-grid" id="noteRefGrid">
                <!-- generado por JS -->
            </div>
        </div>

        <div class="section-card">
            <div class="section-title">Afinación estándar</div>
            <div class="note-ref-grid">
                <button class="note-ref-btn" onclick="playRef('E2')">E2<br><small style="font-weight:400;font-size:10px;">Cuerda 6</small></button>
                <button class="note-ref-btn" onclick="playRef('A2')">A2<br><small style="font-weight:400;font-size:10px;">Cuerda 5</small></button>
                <button class="note-ref-btn" onclick="playRef('D3')">D3<br><small style="font-weight:400;font-size:10px;">Cuerda 4</small></button>
                <button class="note-ref-btn" onclick="playRef('G3')">G3<br><small style="font-weight:400;font-size:10px;">Cuerda 3</small></button>
                <button class="note-ref-btn" onclick="playRef('B3')">B3<br><small style="font-weight:400;font-size:10px;">Cuerda 2</small></button>
                <button class="note-ref-btn" onclick="playRef('E4')">E4<br><small style="font-weight:400;font-size:10px;">Cuerda 1</small></button>
            </div>
        </div>

        <div class="section-card" style="background:#fff8e1; border-color:#ffe082;">
            <div class="section-title" style="color:#f9a825;">En desarrollo</div>
            <p style="font-size:13px; color:#666; margin:0;">
                La detección de tono por micrófono estará disponible próximamente.
                Usará <strong>Web Audio API + FFT</strong> para detectar la nota en tiempo real directamente desde tu dispositivo.
            </p>
        </div>
    </div>

    <div class="action-bar">
        <button class="btn btn-listen" id="listenBtn" onclick="startListening()" disabled>
            Micrófono (próximamente)
        </button>
    </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
<script src="../../shared/audio-utils.js"></script>
<script>
    let refSynth = null;

    async function playRef(note) {
        await startAudio();
        if (!refSynth) {
            refSynth = new Tone.Synth({
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 1.5 }
            }).toDestination();
        }
        refSynth.triggerAttackRelease(note, '2n');

        document.querySelectorAll('.note-ref-btn').forEach(b => b.classList.remove('selected'));
        event.currentTarget.classList.add('selected');
        setTimeout(() => event.currentTarget.classList.remove('selected'), 800);
    }

    function startListening() {
        // Placeholder — implementación futura con getUserMedia + AnalyserNode
    }
</script>
</body>
</html>
```

---

### `apps/escalas/index.html`

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Escalas - MusicTools</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
    <link rel="stylesheet" href="../../shared/style.css">
    <style>
        body { display: flex; justify-content: center; align-items: flex-start; }

        .display-section {
            background: linear-gradient(135deg, #ee0979, #ff6a00);
        }

        .scale-name-big {
            font-size: 52px;
            font-weight: 800;
            line-height: 1.1;
            margin: 10px 0 4px;
        }

        .scale-subtitle {
            font-size: 15px;
            opacity: 0.85;
            font-weight: 300;
        }

        .piano-wrap {
            overflow-x: auto;
            padding: 10px 0 4px;
        }

        .piano {
            display: flex;
            position: relative;
            height: 90px;
            width: fit-content;
            margin: 0 auto;
        }

        .key-white {
            width: 32px;
            height: 90px;
            border: 1px solid #ccc;
            border-radius: 0 0 5px 5px;
            background: white;
            position: relative;
            cursor: pointer;
            transition: background 0.1s;
            flex-shrink: 0;
        }

        .key-white.in-scale { background: #ffb3c6; }
        .key-white.root { background: #ee0979; border-color: #c0063e; }
        .key-white.playing { background: #ff6a00 !important; box-shadow: 0 0 12px rgba(255, 106, 0, 0.7); }

        .key-black {
            width: 22px;
            height: 55px;
            background: #333;
            position: absolute;
            top: 0;
            border-radius: 0 0 4px 4px;
            z-index: 2;
            cursor: pointer;
            transition: background 0.12s;
        }

        .key-black.in-scale { background: #c0063e; }
        .key-black.root { background: #ee0979; }
        .key-black.playing { background: #ff6a00 !important; box-shadow: 0 0 10px rgba(255, 106, 0, 0.8); }

        .key-label {
            position: absolute;
            bottom: 5px;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 9px;
            font-weight: 700;
            color: #333;
        }

        .key-white.root .key-label,
        .key-white.in-scale .key-label { color: #333; }

        .scale-chip {
            padding: 7px 14px;
            border-radius: 20px;
            border: 1.5px solid #ddd;
            background: white;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            transition: all 0.15s;
        }

        .scale-chip:hover   { border-color: #ee0979; color: #ee0979; }
        .scale-chip.active  { background: #ee0979; border-color: #ee0979; color: white; }

        .scale-note-list {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        .scale-note-pill {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 700;
            background: #fce4ec;
            color: #c0063e;
            transition: background 0.15s;
        }

        .scale-note-pill.root { background: #ee0979; color: white; }
        .scale-note-pill.playing { background: #ff6a00; color: white; }

        .root-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 5px;
        }

        .root-btn {
            padding: 7px 2px;
            border: 1.5px solid #eee;
            border-radius: 8px;
            background: white;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            font-family: inherit;
            text-align: center;
            transition: all 0.15s;
        }

        .root-btn:hover  { border-color: #ee0979; color: #ee0979; }
        .root-btn.active { background: #ee0979; border-color: #ee0979; color: white; }

        .btn-play-scale {
            background: linear-gradient(135deg, #ee0979, #ff6a00);
            color: white;
        }
    </style>
</head>
<body>

<div class="app-card">

    <div class="display-section" style="padding-top:10px;">
        <div class="app-nav" style="background:none; padding: 0 4px 8px;">
            <a class="nav-back" href="../../index.html">
                <i class="ti ti-chevron-left"></i>
                MusicTools
            </a>
        </div>
        <div class="scale-subtitle" id="displayScaleType">Mayor</div>
        <div class="scale-name-big" id="displayScaleName">Do Mayor</div>
        <div class="scale-subtitle" id="displayInterval">W-W-H-W-W-W-H</div>
    </div>

    <div class="config-body">

        <div class="section-card" style="padding:12px 8px;">
            <div class="section-title" style="padding-left:8px;">Teclado</div>
            <div class="piano-wrap">
                <div class="piano" id="piano"></div>
            </div>
        </div>

        <div class="section-card">
            <div class="section-title">Notas</div>
            <div class="scale-note-list" id="noteList"></div>
        </div>

        <div class="section-card">
            <div class="section-title">Tipo de escala</div>
            <div class="filter-row" id="scaleTypeFilter" style="flex-wrap:wrap; gap:6px;">
                <button class="scale-chip active" onclick="setScaleType('mayor', this)">Mayor</button>
                <button class="scale-chip" onclick="setScaleType('menor', this)">Menor natural</button>
                <button class="scale-chip" onclick="setScaleType('pentatonica', this)">Pentatónica M</button>
                <button class="scale-chip" onclick="setScaleType('pent-menor', this)">Pentatónica m</button>
                <button class="scale-chip" onclick="setScaleType('blues', this)">Blues</button>
                <button class="scale-chip" onclick="setScaleType('dórico', this)">Dórico</button>
                <button class="scale-chip" onclick="setScaleType('frigio', this)">Frigio</button>
                <button class="scale-chip" onclick="setScaleType('lidio', this)">Lidio</button>
                <button class="scale-chip" onclick="setScaleType('mixolidio', this)">Mixolidio</button>
            </div>
        </div>

        <div class="section-card">
            <div class="section-title">Nota raíz</div>
            <div class="root-grid" id="rootGrid"></div>
        </div>

    </div>

    <div class="action-bar">
        <button class="btn btn-play-scale" id="playScaleBtn" onclick="playScale()">
            Escuchar escala
        </button>
    </div>
</div>

<script src="../../shared/audio-utils.js"></script>
<script>
    const SCALES = {
        mayor:        { label: 'Mayor',          intervals: [0,2,4,5,7,9,11,12], pattern: 'T-T-s-T-T-T-s'   },
        menor:        { label: 'Menor natural',  intervals: [0,2,3,5,7,8,10,12], pattern: 'T-s-T-T-s-T-T'   },
        pentatonica:  { label: 'Pentatónica M',  intervals: [0,2,4,7,9,12],      pattern: 'T-T-3s-T-3s'     },
        'pent-menor': { label: 'Pentatónica m',  intervals: [0,3,5,7,10,12],     pattern: '3s-T-T-3s-T'     },
        blues:        { label: 'Blues',          intervals: [0,3,5,6,7,10,12],   pattern: '3s-T-s-s-3s-T'   },
        'dórico':     { label: 'Dórico',         intervals: [0,2,3,5,7,9,10,12], pattern: 'T-s-T-T-T-s-T'   },
        frigio:       { label: 'Frigio',         intervals: [0,1,3,5,7,8,10,12], pattern: 's-T-T-T-s-T-T'   },
        lidio:        { label: 'Lidio',          intervals: [0,2,4,6,7,9,11,12], pattern: 'T-T-T-s-T-T-s'   },
        mixolidio:    { label: 'Mixolidio',      intervals: [0,2,4,5,7,9,10,12], pattern: 'T-T-s-T-T-s-T'   },
    };

    const NOTE_NAMES_ES = ['Do','Do#','Re','Re#','Mi','Fa','Fa#','Sol','Sol#','La','La#','Si'];
    const NOTE_NAMES_EN = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

    const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
    const BLACK_POSITIONS = { 1: 23, 3: 55, 6: 119, 8: 151, 10: 183 };
    const WHITE_KEY_W = 32;
    const OCT_WIDTH   = WHITE_SEMITONES.length * WHITE_KEY_W;

    let currentScaleKey = 'mayor';
    let currentRootIdx  = 0;
    let synth           = null;
    let playingTimeout  = null;
    let isPlayingScale  = false;

    function intervalToNote(interval) {
        const abs    = currentRootIdx + interval;
        const octave = 3 + Math.floor(abs / 12);
        return NOTE_NAMES_EN[abs % 12] + octave;
    }

    function buildScaleNoteSet() {
        const scale = SCALES[currentScaleKey];
        return new Set(scale.intervals.map(i => intervalToNote(i)));
    }

    function buildPiano() {
        const piano = document.getElementById('piano');
        piano.innerHTML = '';
        piano.style.width  = (OCT_WIDTH * 2) + 'px';
        piano.style.height = '90px';

        const scaleNotes = buildScaleNoteSet();

        for (let oct = 0; oct < 2; oct++) {
            WHITE_SEMITONES.forEach((semitone, wi) => {
                const noteStr = NOTE_NAMES_EN[semitone] + (3 + oct);
                const inScale = scaleNotes.has(noteStr);
                const isRoot  = semitone === currentRootIdx % 12 &&
                                (oct === 0 ? currentRootIdx < 12 : currentRootIdx >= 0);

                const key = document.createElement('div');
                key.className = 'key-white' + (isRoot ? ' root' : inScale ? ' in-scale' : '');
                key.dataset.note = noteStr;
                key.style.cssText = `left:${oct * OCT_WIDTH + wi * WHITE_KEY_W}px; position:absolute;`;

                const lbl = document.createElement('div');
                lbl.className = 'key-label';
                lbl.textContent = NOTE_NAMES_ES[semitone];
                key.appendChild(lbl);
                key.onclick = () => playNoteWithHighlight(noteStr);
                piano.appendChild(key);
            });
        }

        for (let oct = 0; oct < 2; oct++) {
            Object.entries(BLACK_POSITIONS).forEach(([st, xOff]) => {
                const semitone = parseInt(st);
                const noteStr  = NOTE_NAMES_EN[semitone] + (3 + oct);
                const inScale  = scaleNotes.has(noteStr);
                const isRoot   = semitone === currentRootIdx % 12;

                const key = document.createElement('div');
                key.className = 'key-black' + (isRoot ? ' root' : inScale ? ' in-scale' : '');
                key.dataset.note = noteStr;
                key.style.cssText = `left:${oct * OCT_WIDTH + xOff}px; position:absolute;`;
                key.onclick = () => playNoteWithHighlight(noteStr);
                piano.appendChild(key);
            });
        }
    }

    function highlightKey(noteStr, durationMs = 400) {
        const key = document.querySelector(`[data-note="${noteStr}"]`);
        if (!key) return;
        key.classList.add('playing');
        setTimeout(() => key.classList.remove('playing'), durationMs);
    }

    function clearAllHighlights() {
        document.querySelectorAll('.playing').forEach(el => el.classList.remove('playing'));
    }

    function renderNoteList() {
        const scale = SCALES[currentScaleKey];
        const list  = document.getElementById('noteList');
        list.innerHTML = '';
        scale.intervals.forEach((interval, i) => {
            const noteIdx = (currentRootIdx + interval) % 12;
            const pill    = document.createElement('div');
            pill.className = 'scale-note-pill' + (i === 0 ? ' root' : '');
            pill.id = 'pill-' + i;
            pill.textContent = NOTE_NAMES_ES[noteIdx];
            list.appendChild(pill);
        });
    }

    function renderRootGrid() {
        const grid = document.getElementById('rootGrid');
        grid.innerHTML = '';
        NOTE_NAMES_ES.forEach((name, i) => {
            const btn = document.createElement('button');
            btn.className = 'root-btn' + (i === currentRootIdx ? ' active' : '');
            btn.textContent = name;
            btn.onclick = () => {
                currentRootIdx = i;
                stopPlayback();
                document.querySelectorAll('.root-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                update();
            };
            grid.appendChild(btn);
        });
    }

    function setScaleType(key, btn) {
        currentScaleKey = key;
        stopPlayback();
        document.querySelectorAll('.scale-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        update();
    }

    function update() {
        const scale = SCALES[currentScaleKey];
        document.getElementById('displayScaleType').textContent = scale.label;
        document.getElementById('displayScaleName').textContent =
            NOTE_NAMES_ES[currentRootIdx] + ' ' + scale.label;
        document.getElementById('displayInterval').textContent = scale.pattern;
        buildPiano();
        renderNoteList();
    }

    async function playNoteWithHighlight(noteStr) {
        await startAudio();
        if (!synth) initSynth();
        synth.triggerAttackRelease(noteStr, '8n');
        if (!isPlayingScale) highlightKey(noteStr, 400);
    }

    function initSynth() {
        synth = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.6 }
        }).toDestination();
    }

    async function playScale() {
        if (isPlayingScale) return;
        await startAudio();
        if (!synth) initSynth();

        stopPlayback();
        isPlayingScale = true;

        const scale = SCALES[currentScaleKey];
        const notes = scale.intervals.map(i => intervalToNote(i));

        const btn = document.getElementById('playScaleBtn');
        btn.disabled    = true;
        btn.textContent = 'Reproduciendo...';

        let i = 0;
        function playNext() {
            clearAllHighlights();

            if (i >= notes.length) {
                isPlayingScale  = false;
                btn.disabled    = false;
                btn.textContent = 'Escuchar escala';
                return;
            }

            const pill = document.getElementById('pill-' + i);
            if (pill) pill.classList.add('playing');

            const key = document.querySelector(`[data-note="${notes[i]}"]`);
            if (key) key.classList.add('playing');

            synth.triggerAttackRelease(notes[i], '8n');
            i++;
            playingTimeout = setTimeout(playNext, 450);
        }
        playNext();
    }

    function stopPlayback() {
        if (playingTimeout) clearTimeout(playingTimeout);
        playingTimeout  = null;
        isPlayingScale  = false;
        clearAllHighlights();
        const btn = document.getElementById('playScaleBtn');
        if (btn) { btn.disabled = false; btn.textContent = 'Escuchar escala'; }
    }

    // Init
    renderRootGrid();
    update();
</script>
</body>
</html>
```

---

### `.github/workflows/static.yml`

```yaml
# Simple workflow for deploying static content to GitHub Pages
name: Deploy static content to Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```
