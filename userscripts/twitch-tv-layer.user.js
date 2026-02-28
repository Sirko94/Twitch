// ==UserScript==
// @name         Twitch TV Layer
// @namespace    https://github.com/Sirko94/Twitch
// @version      0.2.0
// @description  TV-first Twitch layer with fast focus navigation and lightweight UI toggles.
// @author       Sirko94
// @match        https://www.twitch.tv/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const STORAGE_KEY = 'tvLayerSettings';
  const STYLE_MARKER_ID = 'tv-layer-style-marker';
  const TOGGLE_UI_ID = 'tv-layer-controls';
  const FOCUSABLE_SELECTOR = '.tv-focusable-card';

  const DEFAULT_SETTINGS = {
    hideChat: true,
    hideSidebar: true,
    hidePanels: true
  };

  let focusedIndex = -1;
  let routeKey = '';
  let rafScheduled = false;

  const state = {
    settings: loadSettings(),
    focusables: [],
    rowMap: new Map()
  };

  const INLINE_FALLBACK_CSS = `
    body.tv-layer-active .tv-focusable-card { border-radius: 12px; outline: none; transition: transform .14s ease, box-shadow .14s ease; }
    body.tv-layer-active .tv-focusable-card.tv-focused,
    body.tv-layer-active .tv-focusable-card:focus-visible { transform: scale(1.05); box-shadow: 0 0 0 3px rgba(130,200,255,.85), 0 10px 22px rgba(0,0,0,.35); }
    #${TOGGLE_UI_ID} { position: fixed; top: 10px; right: 10px; z-index: 9999; display: grid; gap: .4rem; background: rgba(10,10,16,.7); border-radius: 10px; padding: .6rem .7rem; color: #fff; font: 500 12px/1.2 system-ui,sans-serif; }
    #${TOGGLE_UI_ID} label { display: flex; align-items: center; gap: .4rem; }
  `;

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_MARKER_ID)) return;

    // Tampermonkey cannot reliably fetch local repo files on twitch.tv.
    // Keep remote fetch optional and always provide a small fallback to avoid blocking startup.
    fetch('https://raw.githubusercontent.com/Sirko94/Twitch/main/userscripts/css/twitch-tv-layer.css', {
      cache: 'force-cache'
    })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('css fetch failed'))))
      .then((css) => GM_addStyle(css))
      .catch(() => GM_addStyle(INLINE_FALLBACK_CSS))
      .finally(() => {
        const marker = document.createElement('style');
        marker.id = STYLE_MARKER_ID;
        marker.textContent = '/* tv-layer marker */';
        document.head.appendChild(marker);
      });
  }

  function applyToggleClasses() {
    const body = document.body;
    if (!body) return;

    body.classList.add('tv-layer-active');
    body.classList.toggle('tv-hide-chat', !!state.settings.hideChat);
    body.classList.toggle('tv-hide-sidebar', !!state.settings.hideSidebar);
    body.classList.toggle('tv-hide-panels', !!state.settings.hidePanels);
  }

  function ensureToggleUI() {
    if (!document.body) return;

    const old = document.getElementById(TOGGLE_UI_ID);
    if (old) old.remove();

    const root = document.createElement('section');
    root.id = TOGGLE_UI_ID;
    root.setAttribute('aria-label', 'TV Layer toggles');

    root.append(
      createToggle('Hide chat', 'hideChat'),
      createToggle('Hide sidebar', 'hideSidebar'),
      createToggle('Hide panels', 'hidePanels')
    );

    document.body.appendChild(root);
  }

  function createToggle(labelText, key) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    const text = document.createElement('span');

    input.type = 'checkbox';
    input.checked = !!state.settings[key];
    input.addEventListener('change', () => {
      state.settings[key] = input.checked;
      saveSettings();
      applyToggleClasses();
      scheduleRefresh();
    });

    text.textContent = labelText;
    label.append(input, text);
    return label;
  }

  function isHomeRoute() {
    return location.pathname === '/' || location.pathname === '/directory';
  }

  function clearFocusableMarks() {
    document.querySelectorAll(FOCUSABLE_SELECTOR).forEach((el) => {
      el.classList.remove('tv-focusable-card', 'tv-focused');
      el.removeAttribute('data-tv-row');
      el.removeAttribute('data-tv-col');
      el.tabIndex = -1;
    });
  }

  function collectHomeCards() {
    const main = document.querySelector('main');
    if (!main) return [];

    const anchors = [...main.querySelectorAll('a[href]')];
    return anchors
      .filter((a) => {
        const href = a.getAttribute('href') || '';
        if (!href || href.startsWith('#')) return false;
        if (href.includes('/settings') || href.includes('/downloads')) return false;
        if (!a.querySelector('img, video, [data-a-target*="preview-card"]')) return false;
        const rect = a.getBoundingClientRect();
        return rect.width > 120 && rect.height > 80;
      })
      .slice(0, 80);
  }

  function groupRows(cards) {
    const buckets = [];

    cards.forEach((card) => {
      const y = Math.round(card.getBoundingClientRect().top + window.scrollY);
      const row = buckets.find((r) => Math.abs(r.y - y) < 48);
      if (row) {
        row.items.push(card);
      } else {
        buckets.push({ y, items: [card] });
      }
    });

    return buckets
      .sort((a, b) => a.y - b.y)
      .map((row) => row.items.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left))
      .filter((row) => row.length >= 3)
      .slice(0, 10);
  }

  function refreshFocusableMap() {
    state.focusables = [...document.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => el.offsetParent !== null);
    state.rowMap = new Map();

    state.focusables.forEach((el, idx) => {
      const row = Number(el.dataset.tvRow || 0);
      const col = Number(el.dataset.tvCol || 0);
      if (!state.rowMap.has(row)) state.rowMap.set(row, []);
      state.rowMap.get(row).push({ el, idx, row, col });
    });

    if (focusedIndex >= state.focusables.length) focusedIndex = 0;
  }

  function markFocusablesFromExistingDOM() {
    clearFocusableMarks();

    if (!isHomeRoute()) {
      refreshFocusableMap();
      return;
    }

    const rows = groupRows(collectHomeCards());
    rows.forEach((row, rowIndex) => {
      row.forEach((card, colIndex) => {
        card.classList.add('tv-focusable-card');
        card.dataset.tvRow = String(rowIndex);
        card.dataset.tvCol = String(colIndex);
        card.tabIndex = -1;
      });
    });

    refreshFocusableMap();
  }

  function setFocus(index) {
    if (!state.focusables.length) return;

    focusedIndex = Math.max(0, Math.min(index, state.focusables.length - 1));
    state.focusables.forEach((el, i) => {
      const active = i === focusedIndex;
      el.classList.toggle('tv-focused', active);
      el.tabIndex = active ? 0 : -1;
    });

    const focused = state.focusables[focusedIndex];
    focused.focus({ preventScroll: true });
    focused.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  function ensureFocus() {
    refreshFocusableMap();
    if (!state.focusables.length) return;
    if (focusedIndex < 0) return setFocus(0);
    setFocus(focusedIndex);
  }

  function navigate(direction) {
    const current = state.focusables[focusedIndex];
    if (!current) return;

    const row = Number(current.dataset.tvRow || 0);
    const col = Number(current.dataset.tvCol || 0);

    if (direction === 'left' || direction === 'right') {
      const delta = direction === 'left' ? -1 : 1;
      const target = state.focusables.find((el) => Number(el.dataset.tvRow) === row && Number(el.dataset.tvCol) === col + delta);
      if (target) setFocus(state.focusables.indexOf(target));
      return;
    }

    const deltaRow = direction === 'up' ? -1 : 1;
    const nextRow = state.rowMap.get(row + deltaRow);
    if (!nextRow?.length) return;

    let best = nextRow[0];
    let score = Math.abs(best.col - col);
    for (const candidate of nextRow) {
      const candidateScore = Math.abs(candidate.col - col);
      if (candidateScore < score) {
        best = candidate;
        score = candidateScore;
      }
    }

    setFocus(best.idx);
  }

  function handleKeydown(event) {
    if (!state.focusables.length) return;

    const map = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down'
    };

    if (map[event.key]) {
      event.preventDefault();
      navigate(map[event.key]);
      return;
    }

    if (event.key === 'Enter') {
      const focused = state.focusables[focusedIndex];
      if (focused) {
        event.preventDefault();
        focused.click();
      }
      return;
    }

    if (event.key === 'Escape' || event.key === 'Backspace') {
      const controls = document.getElementById(TOGGLE_UI_ID);
      if (controls?.matches(':focus-within')) {
        event.preventDefault();
        ensureFocus();
      }
    }
  }

  function scheduleRefresh() {
    if (rafScheduled) return;
    rafScheduled = true;

    requestAnimationFrame(() => {
      rafScheduled = false;
      markFocusablesFromExistingDOM();
      ensureFocus();
    });
  }

  function handleRouteOrContentUpdate() {
    const newRouteKey = `${location.pathname}${location.search}`;
    if (newRouteKey !== routeKey) {
      routeKey = newRouteKey;
      focusedIndex = -1;
    }

    applyToggleClasses();
    scheduleRefresh();
  }

  function setupObservers() {
    const main = document.querySelector('main');
    if (!main) return;

    // Observe only the main content container to avoid full-page mutation storms.
    const observer = new MutationObserver(() => {
      scheduleRefresh();
    });

    observer.observe(main, { childList: true, subtree: true });
  }

  function boot() {
    if (!document.body) return;

    ensureStyles();
    ensureToggleUI();
    handleRouteOrContentUpdate();
    setupObservers();
  }

  document.addEventListener('keydown', handleKeydown, { capture: true });
  window.addEventListener('popstate', handleRouteOrContentUpdate);
  window.addEventListener('hashchange', handleRouteOrContentUpdate);
  window.addEventListener('load', boot);

  boot();
})();
