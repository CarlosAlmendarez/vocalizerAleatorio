/**
 * MusicTools — Service Worker
 * ---------------------------------------------------------------------------
 * · Páginas y código propio: RED PRIMERO (las actualizaciones llegan en cuanto
 *   hay conexión) con respaldo en caché → la app abre sin internet.
 * · Instrumentos (gleitz.github.io, 1,7–2,3 MB cada uno), la librería de
 *   soundfont y las fuentes: CACHÉ PRIMERO → tras la primera vez suenan al
 *   instante y sin conexión, en lugar de descargarse en cada visita.
 *
 * Al cambiar la lista de archivos o la estrategia, subir VERSION.
 * ---------------------------------------------------------------------------
 */
const VERSION     = 'mt-v4';
const SHELL_CACHE = VERSION + '-shell';
const ASSET_CACHE = 'mt-assets-v1';   // instrumentos/fuentes: no cambian, sobreviven a versiones

const APPS = [
  'vocalizer', 'afinador', 'acordes-guitarra', 'acordes-ukulele', 'acordes-bajo',
  'acordes-piano', 'escalas', 'metronomo', 'groove', 'transponer', 'quinta',
  'progresiones', 'entrenamiento-auditivo'
];
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'shared/design.css', 'shared/shell.js', 'shared/sound-engine.js', 'shared/note-player.js',
  'shared/transport.js', 'shared/theory.js', 'shared/audio-utils.js', 'shared/settings.js',
  'shared/pitch.js', 'shared/boot.js', 'shared/diagnostics.js',
  'shared/icons/icon-192.png', 'shared/icons/icon-512.png',
  ...APPS.map(a => 'apps/' + a + '/')
];
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/soundfont-player@0.12.0/dist/soundfont-player.js'
];
// Hosts cuyo contenido es inmutable en la práctica → caché primero
const ASSET_HOSTS = ['gleitz.github.io', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    // Uno a uno: si falta un archivo no se cae toda la instalación
    await Promise.all(SHELL.map(u => shell.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    const assets = await caches.open(ASSET_CACHE);
    await Promise.all(CDN_ASSETS.map(u => assets.add(new Request(u, { mode: 'cors' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [SHELL_CACHE, ASSET_CACHE];
    for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (ASSET_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  } else if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    // Sin red lenta eterna: si tarda más de 4 s y hay copia, usar la copia
    const res = await withTimeout(fetch(req), 4000, () => cache.match(req, { ignoreSearch: true }));
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
    if (res) return res;
  } catch (_) { /* sin conexión */ }
  const hit = await cache.match(req, { ignoreSearch: true })
           || (req.mode === 'navigate' ? await cache.match(new URL('index.html', self.registration.scope).href) : null);
  return hit || new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

function withTimeout(promise, ms, fallback) {
  return new Promise((resolve, reject) => {
    let done = false;
    const t = setTimeout(async () => {
      const alt = await fallback();
      if (alt && !done) { done = true; resolve(alt); }
    }, ms);
    promise.then(r => { if (!done) { done = true; clearTimeout(t); resolve(r); } },
                 e => { if (!done) { done = true; clearTimeout(t); reject(e); } });
  });
}

// La página puede pedir que se descarguen instrumentos para usarlos sin conexión
self.addEventListener('message', event => {
  const { type, urls } = event.data || {};
  if (type !== 'precache' || !Array.isArray(urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(ASSET_CACHE);
    const results = await Promise.all(urls.map(async u => {
      if (await cache.match(u)) return true;
      try { await cache.add(new Request(u, { mode: 'cors' })); return true; } catch (_) { return false; }
    }));
    if (event.source) event.source.postMessage({ type: 'precache-done', ok: results.filter(Boolean).length, total: urls.length });
  })());
});
