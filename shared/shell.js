/**
 * MusicTools — Shell
 * - Injects sidebar + topbar + bottom-nav into each page
 * - Auto layout switch: desktop (≥960px) sidebar / mobile bottom-nav
 * - 3-theme switcher: neon · minimal · amber, persisted in localStorage
 * - Font preloading for all 3 display fonts
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* THEME SYSTEM                                                         */
  /* ------------------------------------------------------------------ */
  var THEMES = ['neon', 'minimal', 'amber'];
  var THEME_META = {
    neon:    { name: 'Neón',    shortName: 'N', accent: '#9d6bff', nextAccent: '#e85a3c' },
    minimal: { name: 'Minimal', shortName: 'M', accent: '#e85a3c', nextAccent: '#f0a854' },
    amber:   { name: 'Amber',   shortName: 'A', accent: '#f0a854', nextAccent: '#9d6bff' },
  };

  function getStoredTheme() {
    try { return localStorage.getItem('mt-theme') || 'neon'; } catch(e) { return 'neon'; }
  }

  function storeTheme(id) {
    try { localStorage.setItem('mt-theme', id); } catch(e) {}
  }

  function nextThemeId(id) {
    var idx = THEMES.indexOf(id);
    return THEMES[(idx + 1) % THEMES.length];
  }

  function applyTheme(id) {
    document.documentElement.setAttribute('data-theme', id);
    storeTheme(id);
    updateThemeBtn(id);
    // Notify canvas-based apps so they can redraw
    try { window.dispatchEvent(new CustomEvent('mt-theme-change', { detail: { theme: id } })); } catch(e) {}
  }

  function updateThemeBtn(id) {
    var btn = document.getElementById('mt-theme-btn');
    if (!btn) return;
    var meta = THEME_META[id];
    var nextMeta = THEME_META[nextThemeId(id)];
    btn.innerHTML =
      '<span class="mt-dot" style="background:' + meta.accent + ';box-shadow:0 0 8px ' + meta.accent + '60;"></span>' +
      '<span class="mt-dot" style="background:' + nextMeta.accent + ';opacity:0.45;width:8px;height:8px;"></span>' +
      '<span class="theme-label">' + meta.name + '</span>';
    btn.title = 'Tema: ' + meta.name + ' → ' + nextMeta.name;
  }

  /* ------------------------------------------------------------------ */
  /* SVG ICONS                                                            */
  /* ------------------------------------------------------------------ */
  var ICONS = {
    logo:      '<path d="M4 12h3l2-6 3 12 3-9 2 3h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    home:      '<path d="M3 11 12 4l9 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10v10h14V10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 20v-6h4v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    grid:      '<rect x="3" y="3" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="3" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="13" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="13" y="13" width="8" height="8" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    clock:     '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    settings:  '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    chevL:     '<path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    bell:      '<path d="M18 17H6l2-3V9a4 4 0 0 1 8 0v5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 21h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    mic:       '<rect x="9" y="3" width="6" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 18v3M8 21h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    tuning:    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 5v7l4.5 2.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    chord:     '<path d="M4 4h16M4 9h16M4 14h16M4 19h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="9" cy="9" r="1.6" fill="currentColor"/><circle cx="14" cy="14" r="1.6" fill="currentColor"/>',
    uke:       '<circle cx="12" cy="16" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 11V4M10 4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    bass:      '<path d="M6 14a5 5 0 1 0 10 0 5 5 0 1 0-10 0" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M11 10V3l5 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    piano:     '<rect x="3" y="5" width="18" height="14" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 5v10M13 5v10M18 5v10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    metronome: '<path d="M8 3h8l3 18H5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 21 9 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    headphones:'<path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="3" y="13" width="5" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="16" y="13" width="5" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    flame:     '<path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 2-3 2-6 2 1 2 3 2 3s0-3 0-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 14a4 4 0 0 0 8 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  };

  function svg(name, size) {
    size = size || 20;
    var paths = ICONS[name] || '';
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none">' + paths + '</svg>';
  }

  /* ------------------------------------------------------------------ */
  /* NAVIGATION CONFIG                                                    */
  /* ------------------------------------------------------------------ */
  var ROOT = (function () {
    var path = window.location.pathname.replace(/\\/g, '/');
    var parts = path.split('/').filter(Boolean);
    // Find project root by looking for apps/ segment
    var appsIdx = parts.indexOf('apps');
    if (appsIdx >= 0) {
      return Array(parts.length - appsIdx).fill('..').join('/') + '/';
    }
    // Check if we're in the root (index.html)
    var vocIdx = parts.findIndex(function(p) { return p.toLowerCase() === 'vocalizeraleatorio'; });
    if (vocIdx >= 0 && parts.length === vocIdx + 1) return './';
    // fallback: count depth based on apps/ presence in URL
    if (path.indexOf('/apps/') >= 0) return '../../';
    return './';
  }());

  var TABS = [
    { id: 'home',     label: 'Inicio',       icon: 'home',     href: ROOT + 'index.html' },
    { id: 'tools',    label: 'Herramientas', icon: 'grid',     href: ROOT + 'index.html#tools' },
    { id: 'practice', label: 'Práctica',     icon: 'clock',    href: ROOT + 'index.html#practice' },
    { id: 'settings', label: 'Ajustes',      icon: 'settings', href: ROOT + 'index.html#settings' },
  ];

  var TOOLS = [
    { id: 'vocalizer',              name: 'Vocalizer',          icon: 'mic',        href: ROOT + 'apps/vocalizer/' },
    { id: 'afinador',               name: 'Afinador',           icon: 'tuning',     href: ROOT + 'apps/afinador/' },
    { id: 'acordes-guitarra',       name: 'Acordes Guitarra',   icon: 'chord',      href: ROOT + 'apps/acordes-guitarra/' },
    { id: 'acordes-ukulele',        name: 'Acordes Ukulele',    icon: 'uke',        href: ROOT + 'apps/acordes-ukulele/' },
    { id: 'acordes-bajo',           name: 'Acordes Bajo',       icon: 'bass',       href: ROOT + 'apps/acordes-bajo/' },
    { id: 'escalas',                name: 'Escalas',            icon: 'piano',      href: ROOT + 'apps/escalas/' },
    { id: 'metronomo',              name: 'Metrónomo',          icon: 'metronome',  href: ROOT + 'apps/metronomo/' },
    { id: 'entrenamiento-auditivo', name: 'Entrenamiento auditivo', icon: 'headphones', href: ROOT + 'apps/entrenamiento-auditivo/' },
  ];

  function currentPageId() {
    var path = window.location.pathname.replace(/\\/g, '/');
    for (var i = 0; i < TOOLS.length; i++) {
      if (path.indexOf('/' + TOOLS[i].id + '/') >= 0) return TOOLS[i].id;
    }
    var pid = document.body.getAttribute('data-page-id');
    if (pid) return pid;
    return 'home';
  }

  function currentTabId(pageId) {
    if (pageId === 'home') return 'home';
    for (var i = 0; i < TOOLS.length; i++) {
      if (TOOLS[i].id === pageId) return 'tools';
    }
    return 'home';
  }

  /* ------------------------------------------------------------------ */
  /* BUILD SHELL HTML                                                     */
  /* ------------------------------------------------------------------ */
  function buildShell() {
    var pageId   = currentPageId();
    var tabId    = currentTabId(pageId);
    var tool     = null;
    for (var i = 0; i < TOOLS.length; i++) { if (TOOLS[i].id === pageId) { tool = TOOLS[i]; break; } }
    var toolName = document.body.getAttribute('data-tool-name') || (tool ? tool.name : null);
    var themeId  = getStoredTheme();
    var meta     = THEME_META[themeId];
    var nextMeta = THEME_META[nextThemeId(themeId)];

    // Theme switcher button HTML
    var themeSwitcherHtml =
      '<button id="mt-theme-btn" class="mt-theme-btn" onclick="window.__mtCycleTheme()" aria-label="Cambiar tema">' +
        '<span class="mt-dot" style="background:' + meta.accent + ';box-shadow:0 0 8px ' + meta.accent + '60;"></span>' +
        '<span class="mt-dot" style="background:' + nextMeta.accent + ';opacity:0.45;width:8px;height:8px;"></span>' +
        '<span class="theme-label">' + meta.name + '</span>' +
      '</button>';

    // Sidebar
    var sidebarTabs = TABS.map(function(tab) {
      return '<a href="' + tab.href + '" class="mt-sidebar-btn' + (tab.id === tabId ? ' active' : '') + '">' +
        svg(tab.icon, 18) + tab.label + '</a>';
    }).join('');

    var sidebarTools = TOOLS.map(function(t) {
      return '<a href="' + t.href + '" class="mt-sidebar-tool' + (t.id === pageId ? ' active' : '') + '">' +
        svg(t.icon, 15) + t.name + '</a>';
    }).join('');

    var sidebar =
      '<aside class="mt-sidebar">' +
        '<a href="' + ROOT + 'index.html" class="mt-sidebar-brand">' +
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="color:var(--accent)">' + ICONS.logo + '</svg>' +
          '<span class="mt-brand-text">MusicTools</span>' +
        '</a>' +
        sidebarTabs +
        '<div class="mt-sidebar-label">Herramientas</div>' +
        '<div style="display:flex;flex-direction:column;gap:2px;">' + sidebarTools + '</div>' +
        '<div class="mt-sidebar-streak">' +
          '<div class="streak-icon">' + svg('flame', 18) + '</div>' +
          '<div class="streak-title">Sigue practicando</div>' +
          '<div class="streak-sub">Abre una herramienta y empieza.</div>' +
        '</div>' +
      '</aside>';

    // Topbar
    var topbarContent;
    if (toolName) {
      topbarContent =
        '<div class="mt-topbar-back">' +
          '<a href="' + ROOT + 'index.html" class="mt-icon-btn" title="Volver">' + svg('chevL', 18) + '</a>' +
          '<div class="mt-back-info">' +
            '<div class="back-label">Herramienta</div>' +
            '<div class="back-title">' + toolName + '</div>' +
          '</div>' +
        '</div>' +
        themeSwitcherHtml +
        '<button class="mt-icon-btn" title="Notificaciones">' + svg('bell', 18) + '</button>';
    } else {
      topbarContent =
        '<a href="' + ROOT + 'index.html" class="mt-topbar-brand">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="color:var(--accent)">' + ICONS.logo + '</svg>' +
          '<span style="font-family:var(--font-head);font-weight:800;font-size:16px;letter-spacing:-0.02em;">MusicTools</span>' +
        '</a>' +
        '<div class="mt-topbar-spacer"></div>' +
        '<div class="mt-topbar-search desktop-only">' +
          svg('search', 16) +
          '<span>Buscar herramienta, escala, acorde…</span>' +
          '<kbd>⌘K</kbd>' +
        '</div>' +
        themeSwitcherHtml +
        '<button class="mt-icon-btn" title="Notificaciones">' + svg('bell', 18) + '</button>';
    }

    // Bottom nav
    var navItems = TABS.map(function(tab) {
      return '<a href="' + tab.href + '" class="mt-nav-item' + (tab.id === tabId ? ' active' : '') + '">' +
        svg(tab.icon, 22) +
        '<span class="nav-label">' + tab.label + '</span>' +
      '</a>';
    }).join('');

    return {
      sidebar:   sidebar,
      topbar:    '<header class="mt-topbar">' + topbarContent + '</header>',
      bottomNav: '<nav class="mt-bottomnav">' + navItems + '</nav>',
      ambient:   '<div class="mt-ambient"></div>',
    };
  }

  /* ------------------------------------------------------------------ */
  /* INJECT SHELL                                                         */
  /* ------------------------------------------------------------------ */
  function injectShell() {
    var parts = buildShell();
    var existing = document.body.innerHTML;
    document.body.innerHTML =
      parts.ambient +
      '<div class="mt-shell">' +
        parts.sidebar +
        '<div class="mt-main">' +
          parts.topbar +
          '<main class="mt-content">' +
            '<div class="mt-content-inner">' +
              existing +
            '</div>' +
          '</main>' +
        '</div>' +
      '</div>' +
      parts.bottomNav;
  }

  /* ------------------------------------------------------------------ */
  /* EXPOSE GLOBALS                                                       */
  /* ------------------------------------------------------------------ */
  window.__mtCycleTheme = function() {
    var current = getStoredTheme();
    applyTheme(nextThemeId(current));
  };

  // Expose for canvas-based apps
  window.getMTThemeAccent = function() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  };
  window.getMTThemeAccentRgb = function() {
    return getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
  };
  window.getMTThemeInk = function() {
    return getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
  };
  window.getMTThemeMuted = function() {
    return getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
  };
  window.getMTThemeBorder = function() {
    return getComputedStyle(document.documentElement).getPropertyValue('--border').trim();
  };
  window.getMTThemeId = function() { return getStoredTheme(); };

  /* ------------------------------------------------------------------ */
  /* LAYOUT AUTO-DETECT                                                   */
  /* ------------------------------------------------------------------ */
  function applyLayout() {
    var isDesktop = window.matchMedia('(min-width: 960px)').matches;
    document.documentElement.setAttribute('data-layout', isDesktop ? 'desktop' : 'mobile');
  }

  /* ------------------------------------------------------------------ */
  /* INIT                                                                 */
  /* ------------------------------------------------------------------ */
  function init() {
    // 1. Apply stored theme FIRST (before shell injection, to avoid flash)
    var storedTheme = getStoredTheme();
    document.documentElement.setAttribute('data-theme', storedTheme);

    // 2. Inject shell
    injectShell();

    // 3. Layout detection
    applyLayout();
    window.addEventListener('resize', applyLayout);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
