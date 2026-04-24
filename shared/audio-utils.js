/**
 * MusicTools - Utilidades de audio compartidas.
 * Requiere sound-engine.js (soundEngine) cargado previamente en la página.
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
 * Activa el contexto de audio (requerido por los navegadores antes de reproducir).
 * Debe llamarse desde un evento de usuario (click, tap).
 */
async function startAudio() {
    await soundEngine.start();
}

/**
 * Convierte un índice de nota a su frecuencia en Hz.
 * Usa A4 = 440 Hz como referencia (MIDI standard).
 */
function noteIndexToFreq(noteIndex, octaveMin = 2) {
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
