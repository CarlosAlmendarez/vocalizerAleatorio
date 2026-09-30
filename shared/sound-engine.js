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
        // Safari 16.4+: sesión de reproducción → suena aunque el interruptor de silencio esté activado
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) {}
        this._initIOSUnlock();
        this._initLifecycle();
    }

    /**
     * En móvil el AudioContext se suspende/interrumpe al bloquear la pantalla,
     * recibir una llamada o cambiar de app. Al volver lo reanudamos.
     */
    _initLifecycle() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible') return;
            if (this._ac && this._ac.state !== 'running') this._ac.resume().catch(() => {});
        });
        window.addEventListener('pageshow', () => {
            if (this._ac && this._ac.state !== 'running') this._ac.resume().catch(() => {});
        });
    }

    /**
     * Mantiene la pantalla encendida mientras se practica. La implementación
     * vive en shell.js (MT.keepAwake) para que la usen también las apps sin
     * motor de sonido (metrónomo, groove).
     */
    keepAwake(on) {
        if (window.MT && window.MT.keepAwake) window.MT.keepAwake(on);
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
        if (this._ac.state !== 'running') {
            // 'suspended' o 'interrupted' (iOS). No bloquear para siempre si iOS no responde.
            await Promise.race([
                this._ac.resume().catch(() => {}),
                new Promise(r => setTimeout(r, 1500))
            ]);
        }
    }

    get ac()  { return this._ac; }
    get now() { return this._ac ? this._ac.currentTime : 0; }

    // Devuelve un instrumento listo para tocar (carga desde CDN si es la primera vez).
    async get(name) {
        await this.start();
        return this._load(name);
    }

    /**
     * Descarga y decodifica un instrumento SIN esperar un gesto del usuario.
     * Crea el AudioContext (queda suspendido hasta el primer toque, que ya
     * lo reanuda _initIOSUnlock), así el primer Play no tiene que esperar la red.
     */
    preload(name, range) {
        if (!this._ac) {
            this._ac = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this._load(name, range);
    }

    /**
     * range = [midiMín, midiMáx] opcional: decodifica solo esas notas. El piano
     * completo son 88 notas y ~100 MB de audio sin comprimir en memoria; las
     * apps de acordes solo usan 2 octavas (~27 MB). Las notas fuera del rango
     * suenan en silencio, así que el rango debe cubrir todo lo que la app toca.
     */
    _load(name, range) {
        if (typeof Soundfont === 'undefined') {
            throw new Error(
                'soundfont-player no está disponible. ' +
                'Comprueba la consola de red (F12 → Network) para ver si ' +
                'soundfont-player.js cargó correctamente.'
            );
        }
        const key = range ? name + '|' + range[0] + '-' + range[1] : name;
        if (!this._cache[key]) {
            const opts = range ? { notes: SoundEngine.noteNames(range[0], range[1]) } : undefined;
            this._cache[key] = Soundfont.instrument(this._ac, name, opts).catch(err => {
                delete this._cache[key];   // permitir reintentar si falló la red
                throw err;
            });
        }
        return this._cache[key];
    }

    // Olvida un instrumento cargado (p. ej. un rango que ya no se usa) para liberar memoria
    release(name, range) {
        delete this._cache[range ? name + '|' + range[0] + '-' + range[1] : name];
    }

    // Nombres tal como vienen en los archivos de soundfont (bemoles: 'Db4')
    static noteNames(lo, hi) {
        const F = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const out = [];
        for (let m = Math.max(21, lo); m <= Math.min(108, hi); m++) out.push(F[m % 12] + (Math.floor(m / 12) - 1));
        return out;
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
     * @returns {OscillatorNode|undefined} el nodo, por si se quiere cancelar con .stop()
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
        return osc;
    }

    // Versión con delay relativo (shorthand de clickAt).
    click(delay = 0) {
        this.clickAt(this.now + delay);
    }
}

const soundEngine = new SoundEngine();
