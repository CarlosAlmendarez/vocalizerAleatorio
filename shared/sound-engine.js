/**
 * SoundEngine — Motor de audio unificado basado en soundfont-player + Web Audio API.
 *
 * Singleton global `soundEngine` compartido por todas las apps de MusicTools.
 * El AudioContext se crea solo tras interacción del usuario (política Chrome/Safari).
 * Los instrumentos se cargan una sola vez y quedan cacheados en memoria.
 *
 * Requiere: soundfont-player cargado previamente en la página.
 *
 * iOS Silent Mode: el primer touchstart en cualquier parte de la pantalla
 * ejecuta un buffer silencioso que desbloquea el AudioContext y permite
 * que el audio suene aunque el interruptor de silencio esté activado.
 */
class SoundEngine {
    constructor() {
        this._ac    = null;   // AudioContext (único, compartido)
        this._cache = {};     // { instrumentName: Promise<Instrument> }
        this._initIOSUnlock();
    }

    /**
     * Registra listeners de gestos para desbloquear el AudioContext lo antes
     * posible — antes incluso de que el usuario pulse un botón de reproducción.
     * El buffer silencioso es el mecanismo estándar para pasar por encima del
     * hardware silent switch de iOS.
     */
    _initIOSUnlock() {
        const onGesture = () => {
            if (!this._ac) {
                this._ac = new (window.AudioContext || window.webkitAudioContext)();
            }
            // Si está suspendido (nuevo contexto o vuelta de segundo plano) → reanudar
            if (this._ac.state !== 'running') {
                this._ac.resume().catch(() => {});
            }
            // Buffer silencioso de 1 muestra: señal a iOS de que el audio es intencional.
            // Esto permite reproducir con el silent switch activado.
            try {
                const buf = this._ac.createBuffer(1, 1, 22050);
                const src = this._ac.createBufferSource();
                src.buffer = buf;
                src.connect(this._ac.destination);
                src.start(0);
            } catch (_) {}
        };
        // capture:true → se ejecuta antes que cualquier otro handler
        // passive:true → no bloquea el scroll en móvil
        document.addEventListener('touchstart', onGesture, { capture: true, passive: true });
        document.addEventListener('click',      onGesture, { capture: true });
    }

    // Inicializa o reanuda el AudioContext. Debe llamarse desde un gesto del usuario.
    async start() {
        if (!this._ac) {
            this._ac = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._ac.state === 'suspended') {
            await this._ac.resume();
        }
    }

    get ac()  { return this._ac; }
    get now() { return this._ac ? this._ac.currentTime : 0; }

    // Devuelve un instrumento listo para tocar (carga desde CDN si es la primera vez).
    async get(name) {
        await this.start();
        if (typeof Soundfont === 'undefined') {
            throw new Error(
                'soundfont-player no está disponible. ' +
                'Comprueba la consola de red (F12 → Network) para ver si ' +
                'soundfont-player.js cargó correctamente.'
            );
        }
        if (!this._cache[name]) {
            this._cache[name] = Soundfont.instrument(this._ac, name);
        }
        return this._cache[name];
    }

    /**
     * Reproduce una nota.
     * @param {string} name       - Nombre del instrumento GM (e.g. 'acoustic_grand_piano')
     * @param {string} note       - Nota en notación científica (e.g. 'C4', 'D#3')
     * @param {object} [options]
     *   @param {number} [options.delay=0]    - Retraso en segundos desde ahora
     *   @param {number} [options.duration=1] - Duración en segundos
     *   @param {number} [options.gain=1]     - Volumen (0–1)
     * @returns {Promise<AudioBufferSourceNode>}
     */
    async play(name, note, { delay = 0, duration = 1, gain = 1 } = {}) {
        const inst = await this.get(name);
        return inst.play(note, this._ac.currentTime + delay, { duration, gain });
    }

    /**
     * Programa un click de metrónomo en un momento absoluto del AudioContext.
     * Usa un oscilador nativo (sin cargar soundfont).
     * @param {number} absoluteTime - Tiempo absoluto del AudioContext (ac.currentTime + X)
     */
    clickAt(absoluteTime) {
        if (!this._ac) return;
        const osc  = this._ac.createOscillator();
        const gain = this._ac.createGain();
        osc.frequency.value = 1000;
        osc.connect(gain);
        gain.connect(this._ac.destination);
        gain.gain.setValueAtTime(0.25, absoluteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, absoluteTime + 0.04);
        osc.start(absoluteTime);
        osc.stop(absoluteTime + 0.05);
    }

    // Versión con delay relativo (shorthand de clickAt).
    click(delay = 0) {
        this.clickAt(this.now + delay);
    }
}

const soundEngine = new SoundEngine();
