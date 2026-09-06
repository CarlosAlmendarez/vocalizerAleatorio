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
- **No build, lint, or test tooling exists.** Verify changes by loading the affected page
  in a browser.
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

- `shell.js` applies the stored theme (`localStorage['mt-theme']`) to `<html>` *before*
  injecting the shell to avoid a flash, and exposes a theme-cycle button.
- Canvas-based tools (tuner needle, etc.) can't use CSS vars directly: read them via
  `window.getMTThemeAccent()`, `getMTThemeInk()`, `getMTThemeAccentRgb()`, etc., and
  listen for the `mt-theme-change` window event to redraw.
- `data-layout` (`desktop`/`mobile`) is set on `<html>` from a 960px media query.

### Audio (`shared/sound-engine.js` + `shared/audio-utils.js`)
Pages that produce pitched sound load, in the `<head>`:
```html
<script src="https://cdn.jsdelivr.net/npm/soundfont-player/dist/soundfont-player.js"></script>
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

### Page load order (typical tool)
1. `<head>`: `design.css`, then optionally `soundfont-player` + `sound-engine.js`.
2. `<body data-page-id data-tool-name>` with the tool markup.
3. Inline `<script>` with the tool logic (often wrapped so it runs on `DOMContentLoaded`).
4. `shared/audio-utils.js` if used.
5. `shared/shell.js` **last**.

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
