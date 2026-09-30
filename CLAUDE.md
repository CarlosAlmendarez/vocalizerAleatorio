# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**MusicTools** — a static, buildless multi-page web app (Spanish UI) of ~13 standalone
musician tools (vocalizer, tuner, metronome, chord dictionaries, ear training, circle of
fifths, etc.). No framework, no bundler, no `package.json`. Every tool is a single
self-contained `apps/<tool>/index.html` with its CSS in a `<style>` block and its JS in an
inline `<script>`. `index.html` at the repo root is the launcher/home screen.

## Running & deploying

- **Local dev:** serve the repo root over HTTP — e.g. `python3 -m http.server 8000` — then
  open `http://localhost:8000/`. Do **not** open files with `file://`: the tuner and any
  mic feature need `getUserMedia`, which requires `localhost` or HTTPS.
- **Tests:** `node --test tests/*.test.js` (Node ≥ 20, no dependencies, ~2 s). The deploy
  workflow runs them first and **does not publish if any fails**. They load the real browser
  code into `vm` contexts (`tests/helpers.js`) with a fake DOM/AudioContext:
  - `theory.test.js` — spelling, scales, chords, degrees, transposition.
  - `voicings.test.js` — every guitar/ukulele/bass position sounds exactly its chord.
  - `pitch.test.js` — YIN accuracy (< 2 cents, no octave errors) with seeded noise.
  - `vocalizer.test.js` — modes, pause, live changes, suspension, reference, routines, mic.
  - `apps.test.js` — transposer key detection, progression chord names.
  - `structure.test.js` — each app registered in shell `TOOLS`, home, `sw.js`; files exist.
  Arrays coming out of a `vm` context have a different prototype: compare with `plain()`.
  When fixing a bug, add a test that fails without the fix. Also load the affected page in a
  browser — there are no DOM/visual tests.
- **Deploy:** `.github/workflows/static.yml` publishes the entire repo to GitHub Pages on
  every push to `main`. The published site lives under a `/vocalizerAleatorio/` path
  prefix — keep this in mind for anything path-sensitive (see `ROOT` below).

## Architecture

### The shell (`shared/shell.js`)
Loaded last on every page (`<script src="../../shared/shell.js"></script>`, or
`shared/shell.js` from root). On load it **rewrites `document.body`**: it wraps whatever
markup the page authored inside a `.mt-shell` layout and injects the sidebar (desktop
≥960px), topbar, bottom nav, and ambient background. Consequences:

- A page's own `<body>` content is just the tool UI; the chrome is not in the HTML.
- Any script that queries/manipulates the DOM on load must run **after** `shell.js`, or
  target nodes inside `.mt-content-inner` which is where original content ends up.
- Pages identify themselves via `<body data-page-id="..." data-tool-name="...">`. The
  `data-page-id` must match an `id` in the `TOOLS` array in `shell.js`. **Adding a new
  tool requires adding an entry to `TOOLS` (and an icon to `ICONS`) in `shell.js`** plus a
  card in the root `index.html`.
- `ROOT` is computed at runtime from `window.location.pathname` by locating the `apps/`
  segment. All nav links are built relative to it, which is why the site survives the
  GitHub Pages path prefix. Non-standard directory layouts will break it.

### Theming (`shared/design.css` + `shell.js`)
Three themes — `neon` (default, dark), `minimal` (light), `amber` (dark) — selected by
`<html data-theme="...">`. `design.css` defines every theme as a block of CSS custom
properties (`--accent`, `--ink`, `--bg`, `--surface`, `--radius`, `--font-head`, …).
**Always style with these tokens, never hardcoded colors**, so all three themes work.

- `shared/boot.js` (in every page's `<head>`, right after `design.css`) applies the stored
  theme (`localStorage['mt-theme']`) before first paint — `shell.js` runs at the end of the
  body, too late to avoid a flash — and loads **only the active theme's** Google Fonts without
  blocking render. Never put a font `@import` back in `design.css` (it blocks first paint);
  `shell.js` calls `MT_loadThemeFonts(id)` on theme change and exposes the theme button.
- Canvas-based tools (tuner needle, etc.) can't use CSS vars directly: read them via
  `window.getMTThemeAccent()`, `getMTThemeInk()`, `getMTThemeAccentRgb()`, etc., and
  listen for the `mt-theme-change` window event to redraw.
- `data-layout` (`desktop`/`mobile`) is set on `<html>` from a 960px media query.

### Audio (`shared/sound-engine.js` + `shared/audio-utils.js`)
Pages that produce pitched sound load, in the `<head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/soundfont-player@0.12.0/dist/soundfont-player.js"></script>
<script src="../../shared/sound-engine.js"></script>
```
- `soundEngine` is a **global singleton** wrapping one shared `AudioContext`. Instruments
  (General MIDI names like `acoustic_grand_piano`) are lazy-loaded from CDN and cached.
  Use `soundEngine.play(instrument, note, {delay, duration, gain})`,
  `soundEngine.clickAt(absoluteTime)` / `.click(delay)` for metronome ticks.
- The `AudioContext` is only created/resumed on a user gesture (browser policy).
  `sound-engine.js` **and** `shell.js` both register capture-phase `touchstart`/`click`
  listeners that play a silent 1-sample buffer — this is the iOS silent-switch unlock; do
  not remove it.
- `audio-utils.js` (loaded separately, after the inline script tag in some pages) has
  note-name helpers: `getAllNotes`, `noteIndexToFreq`, `noteBaseName`, `NOTE_NAMES`.

### Tempo / timing (`shared/transport.js`)
Any tool that plays something on a beat (metronome, groove, vocalizer, progresiones)
**must** drive it with `createTransport(...)` — never `setInterval`/`setTimeout` chains,
which drift. It's the "lookahead scheduler" pattern (a coarse timer only decides *what* to
schedule; every sound is placed with `ac.currentTime + n`, sample-accurate; the next step
is accumulated in the audio-clock domain so there is zero drift).

```js
const t = createTransport({
  getBpm: () => bpm,                    // read live → tempo changes apply within ~100ms
  subdiv: 4,                            // steps per quarter note (4 = 16ths)
  onStep: (step, audioTime, stepDur) => { /* schedule audio AT audioTime */ },
  onDraw: (step) => { /* UI — already gated to audio time, no setTimeout */ },
});
await t.start();  t.stop();  t.subdiv = 2;  t.resetStep(0);
```

- Loads **after** `sound-engine.js` when present, and reuses `soundEngine`'s AudioContext
  (`soundEngine` is a global lexical `const`, not a `window` property — `transport.js`
  finds it by bare reference). Apps without `sound-engine.js` get their own single context.
  One AudioContext per page is required: two would drift against each other.
- `onStep` gets a free-running step counter — modulo it to your pattern length yourself.
- `onDraw` payloads: stash per-step data in your own queue in `onStep`, drain one per
  `onDraw` call (see `vocalizer` `uiQ`).
- **Validate timing** from the browser console: `await Transport.validate(120)` →
  `{ maxJitterMs, driftOverRunMs, minHeadroomMs, ok }`. Healthy = jitter/drift ~0,
  headroom > 0.
- Metronome BPM is always the click rate regardless of meter denominator (6/8 at 120 =
  120 clicks/min); `beatUnit` is display-only.

### Playing notes (`shared/note-player.js`)
The layer between `sound-engine.js` and each app: *what* note sounds *when*, and what the
screen shows at that moment. Load it after `sound-engine.js` (and `transport.js` if used).

```js
const player = createNotePlayer('acoustic_grand_piano');
player.onStatus(s => …);        // 'loading' | 'ready' | 'suspended' | 'error'
player.preload();               // on page load — first Play doesn't wait for the network
await player.ready();           // from the Play gesture: instrument loaded + context running
player.note('C4', t, { dur, gain });  player.click(t);   // t = AudioContext time
player.ui(t, () => …);          // UI callback fired when the audio reaches t
player.cancel();                // stops only what THIS player scheduled
```

- With `transport.js`, schedule inside `onStep` via `player.note/click/ui`; don't pass
  `onDraw` or keep your own UI queue.
- For one-off phrases (scales, chords) use `player.now + n` offsets — never `setTimeout`.
- Reference implementation: `apps/vocalizer` (play/pause/stop, live config, engine status).
- Every pitched app uses it (escalas, acordes-*, afinador, entrenamiento-auditivo,
  progresiones, vocalizer): don't call `soundEngine.get()` / `inst.play()` directly in new code.
- Call `preload()` at script top level (the first tap then doesn't wait for the CDN) and
  `cancel()` before re-triggering a strum/question so sounds don't pile up.

### Music theory (`shared/theory.js`)
Single source of truth for note spelling, chords, scales, roman degrees, transposition and
fretted voicings. **Never name notes from a fixed sharps/flats table** — that is how Fa mayor
ended up showing "La#" and Do menor "D#". Everything is spelled by scale degree (a 3rd always
uses the letter two steps up) and enharmonic roots pick the spelling with fewest accidentals.

```js
Theory.chord(Theory.bestRoot(pc, 'min'), 'min')   // { symbol, notes:['C#','E','G#'], pcs, degrees }
Theory.scale(Theory.bestScaleRoot(pc, 'major'), 'major').notes
Theory.degreeRoot('C', 'bVII')        // 'Bb'
Theory.transposeName('Bb', 'C', 'D')  // 'C'  (by key-to-key interval, not by semitone table)
Theory.display('Eb4', 'es')           // 'Mi♭4'  — use for anything shown to the user
Theory.rootButtonLabel(pc, 'es')      // 'Do♯' + <span class="enh-alt">Re♭</span>
Theory.findVoicing({ tuning, pcs, optional, rootInBass, allowMute, minStrings })
Theory.findVoicings(opts, 4)         // up to 4 positions in different neck areas, best first
Theory.checkVoicing(frets, tuning, pcs, optional, rootInBass)
```

- Only a *perfect* 5th may be `optional` (m7♭5 / °7 need their ♭5).
- Chord apps use a hand-written `SHAPES` entry only if `checkVoicing` confirms it sounds exactly
  the chord; otherwise `findVoicing` computes one. Don't add shapes without that guard.
- Playback still uses MIDI/sharp names; spelling is for display (and `Theory.pc()` for pitch).

### Page load order (typical tool)
1. `<head>`: `design.css`, `boot.js`, then optionally `soundfont-player` + `sound-engine.js`.
   Keep soundfont-player pinned to the same version everywhere (also in `sw.js`); a test enforces it.
2. `<body data-page-id data-tool-name>` with the tool markup.
3. Inline `<script>` with the tool logic (often wrapped so it runs on `DOMContentLoaded`).
4. `shared/audio-utils.js` if used.
5. `shared/shell.js` **last**.

### Pitch detection (`shared/pitch.js`)
`Pitch.detect(float32Samples, sampleRate, minFreq)` → Hz or -1 (YIN; ≤1 cent error in tests),
`Pitch.freqToMidi(hz)`. Used by the tuner and the vocalizer's microphone. Keep `minFreq` as high
as the use case allows (lowest string × 0.75, ~65 Hz for voice): cost grows with the period.

### Shell API (`window.MT`, from `shell.js`)
- `MT.keepAwake(true|false)` — screen wake lock while practising (`soundEngine.keepAwake` delegates here).
- Space bar: define a global `function mtPlayToggle() {}` in the app; the shell calls it
  (ignored while typing in inputs).
- `MT.setTheme(id)`, `MT.getTheme()`, `MT.THEMES`, `MT.filterTools(q)`, `MT.precacheInstruments([...])`.
- Home page sections `#tools`, `#practice`, `#settings` back the bottom-nav tabs.
- Colors: use tokens; for alpha use `rgba(var(--accent-rgb|--success-rgb|--danger-rgb), a)`.

### Saved settings (`shared/settings.js`)
Each tool remembers its settings between visits in `localStorage['mt-settings:<app>']`:
```js
const store = createStore('metronomo');
store.get('bpm', 120); store.set('bpm', 96);
store.bindInputs(['pattern', 'tempo']);   // restores + saves form controls by id
```
Restore on load by calling the app's own setters (so the UI stays in sync) and `store.set`
inside those setters. Values changed by code (no `change` event) must be saved explicitly.
Storage can throw (private mode) — `settings.js` already swallows that.

### Offline / installable app (`sw.js` + `manifest.webmanifest`)
`shell.js` injects the manifest/icons and registers `sw.js` (scope = repo root, works under
the GitHub Pages prefix). Own files: **network-first** with cache fallback, so deploys show up
immediately. Instruments (`gleitz.github.io`, 1.7–2.3 MB each), the soundfont library and fonts:
**cache-first**. When adding a new shared file or app, add it to `SHELL`/`APPS` in `sw.js` and
bump `VERSION`. `MT.precacheInstruments([...])` downloads instruments for offline use (the home
page has a button for it). Headless Edge's `--virtual-time-budget` stalls on service workers:
test them through the DevTools protocol in real time instead.

## Conventions

- UI copy and code comments are in **Spanish**. Match this.
- Vanilla ES (no modules, no `import`); scripts share the global scope. IIFEs are used to
  avoid leaking helpers.
- Reuse the design-system component classes already in `design.css` (`.btn`,
  `.btn-primary`, `.glass`, `.section-card`, `.section-label`, `.tool-card-nm`,
  `.note-pill`, `.diff-pill`, piano-key classes, etc.) before writing new CSS.
- `shared/style.css` is **legacy and unused** (old Tabler-icons-based design); every page
  now uses `design.css`. Don't add to `style.css`.
- `contexto_proyecto.md` is a generated source snapshot for external context sharing, and
  is **stale** (only reflects an early 4-app version). Don't treat it as documentation and
  don't hand-maintain it.
