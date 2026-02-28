// ==UserScript==
// @name         Twitch TV Layer
// @namespace    https://github.com/Sirko94/Twitch
// @version      0.1.0
// @description  Apple-TV-style Twitch UI layer with row layout, spatial navigation, and TV-focused toggles.
// @author       Sirko94
// @match        https://www.twitch.tv/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const SCRIPT_ROOT_CLASS = 'tv-layer-active';
  const STYLE_ID = 'tv-layer-style-inline-fallback';
  const UI_ROOT_ID = 'tv-layer-root';
  const STORAGE_KEY = 'tvLayerSettings';

  const DEFAULT_SETTINGS = {
    hideChat: true,
    hideSidebar: true,
    hidePanels: true
  };

  const state = {
    settings: loadSettings(),
    rowState: {
      active: false,
      focusables: [],
      rowMap: new Map(),
      focusedIndex: -1
    }
  };

  const CSS_FALLBACK = `
    #${UI_ROOT_ID} { position: relative; z-index: 40; }
    .tv-layer-row { margin: 1.4rem 0; }
    .tv-layer-row-title { color: #fff; font-size: 1.4rem; font-weight: 700; margin: 0 0 .6rem .8rem; }
    .tv-layer-row-track { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(16rem, 22rem); gap: .9rem; overflow-x: auto; padding: .4rem .8rem 1rem; }
    .tv-layer-card { display: block; color: inherit; text-decoration: none; border-radius: 14px; overflow: hidden; background: #1b1d22; outline: none; transform: scale(1); transition: transform .16s ease, box-shadow .16s ease; }
    .tv-layer-card img { width: 100%; display: block; aspect-ratio: 16/9; object-fit: cover; }
    .tv-layer-card-meta { padding: .65rem .7rem .9rem; color: #e9ecf1; font-size: .88rem; }
    .tv-layer-card:focus-visible,
    .tv-layer-card.tv-focused { transform: scale(1.06); box-shadow: 0 0 0 3px rgba(124, 194, 255, .9), 0 12px 24px rgba(0, 0, 0, .45); }
    .tv-layer-controls { position: fixed; top: 1rem; right: 1rem; z-index: 9999; display: grid; gap: .4rem; background: rgba(10,10,12,.7); border: 1px solid rgba(255,255,255,.12); border-radius: 12px; padding: .7rem; color: #fff; font: 500 12px/1.2 system-ui, sans-serif; }
    .tv-layer-controls label { display: flex; gap: .45rem; align-items: center; white-space: nowrap; }
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

  function applyToggleClasses() {
    const body = document.body;
    if (!body) return;

    body.classList.toggle('tv-hide-chat', !!state.settings.hideChat);
    body.classList.toggle('tv-hide-sidebar', !!state.settings.hideSidebar);
    body.classList.toggle('tv-hide-panels', !!state.settings.hidePanels);
    body.classList.toggle(SCRIPT_ROOT_CLASS, true);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    // Attempt local relative CSS first (works in extension/local setups that allow relative fetch).
    fetch('/userscripts/css/twitch-tv-layer.css')
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error('missing local css'))))
      .then((css) => GM_addStyle(css))
      .catch(() => {
        GM_addStyle(CSS_FALLBACK);
      })
      .finally(() => {
        const marker = document.createElement('style');
        marker.id = STYLE_ID;
        marker.textContent = '/* style marker */';
        document.head.appendChild(marker);
      });
  }

  function createControls() {
    const existing = document.querySelector('.tv-layer-controls');
    if (existing) existing.remove();

    const controls = document.createElement('section');
    controls.className = 'tv-layer-controls';
    controls.setAttribute('aria-label', 'TV Layer Toggles');

    controls.appendChild(createToggle('Hide chat', 'hideChat'));
    controls.appendChild(createToggle('Hide sidebar', 'hideSidebar'));
    controls.appendChild(createToggle('Hide panels', 'hidePanels'));

    document.body.appendChild(controls);
  }

  function createToggle(labelText, key) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!state.settings[key];
    input.addEventListener('change', () => {
      state.settings[key] = input.checked;
      saveSettings();
      applyToggleClasses();
    });

    const text = document.createElement('span');
    text.textContent = labelText;

    label.append(input, text);
    return label;
  }

  function collectCardCandidates() {
    // Prefer card-like links containing media, and avoid control links.
    const links = [...document.querySelectorAll('a[href]')];
    return links
      .filter((link) => {
        const href = link.getAttribute('href') || '';
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;
        if (href.includes('/settings') || href.includes('/subscriptions')) return false;
        if (!link.querySelector('img, video, [data-a-target="preview-card-image-link"]')) return false;
        const box = link.getBoundingClientRect();
        return box.width > 80 && box.height > 60;
      })
      .slice(0, 120);
  }

  function groupIntoRows(candidates) {
    const rowsByY = [];

    candidates.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const y = Math.round(rect.top + window.scrollY);
      const bucket = rowsByY.find((row) => Math.abs(row.y - y) < 44);
      if (bucket) {
        bucket.items.push(el);
      } else {
        rowsByY.push({ y, items: [el] });
      }
    });

    return rowsByY
      .sort((a, b) => a.y - b.y)
      .map((row) => row.items.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left))
      .filter((row) => row.length >= 3)
      .slice(0, 8);
  }

  function buildRowLayout() {
    const path = location.pathname;
    if (path !== '/' && path !== '/directory') return;

    const main = document.querySelector('main');
    if (!main) return;

    const candidates = collectCardCandidates();
    if (candidates.length < 6) return;

    const rows = groupIntoRows(candidates);
    if (!rows.length) return;

    const existing = document.getElementById(UI_ROOT_ID);
    if (existing) existing.remove();

    const root = document.createElement('section');
    root.id = UI_ROOT_ID;
    root.className = 'tv-layer-home';

    rows.forEach((items, index) => {
      const row = document.createElement('section');
      row.className = 'tv-layer-row';
      row.dataset.rowIndex = String(index);

      const title = document.createElement('h2');
      title.className = 'tv-layer-row-title';
      title.textContent = `Row ${index + 1}`;

      const track = document.createElement('div');
      track.className = 'tv-layer-row-track';

      items.forEach((item, colIndex) => {
        const card = createCard(item, index, colIndex);
        track.appendChild(card);
      });

      row.append(title, track);
      root.appendChild(row);
    });

    main.prepend(root);
    state.rowState.active = true;
    refreshFocusableMap();
    ensureFocus();
  }

  function createCard(sourceLink, rowIndex, colIndex) {
    const card = document.createElement('a');
    card.className = 'tv-layer-card';
    card.href = sourceLink.href;
    card.dataset.row = String(rowIndex);
    card.dataset.col = String(colIndex);
    card.tabIndex = -1;

    const media = sourceLink.querySelector('img, video');
    if (media) {
      const mediaClone = media.cloneNode(true);
      if (mediaClone.tagName === 'VIDEO') {
        mediaClone.muted = true;
        mediaClone.loop = true;
        mediaClone.autoplay = true;
      }
      card.appendChild(mediaClone);
    }

    const meta = document.createElement('div');
    meta.className = 'tv-layer-card-meta';
    const titleNode = sourceLink.querySelector('h3, h2, [title], p, span');
    meta.textContent = titleNode?.textContent?.trim() || sourceLink.getAttribute('aria-label') || sourceLink.href;

    card.appendChild(meta);
    return card;
  }

  function refreshFocusableMap() {
    const focusables = [...document.querySelectorAll('.tv-layer-card')].filter((el) => el.offsetParent !== null);
    const rowMap = new Map();

    focusables.forEach((el, index) => {
      const row = Number(el.dataset.row || 0);
      const col = Number(el.dataset.col || 0);
      if (!rowMap.has(row)) rowMap.set(row, []);
      rowMap.get(row).push({ el, index, row, col });
    });

    state.rowState.focusables = focusables;
    state.rowState.rowMap = rowMap;

    if (state.rowState.focusedIndex >= focusables.length) {
      state.rowState.focusedIndex = 0;
    }
  }

  function setFocusedIndex(index) {
    const focusables = state.rowState.focusables;
    if (!focusables.length) return;

    const bounded = Math.max(0, Math.min(index, focusables.length - 1));
    state.rowState.focusedIndex = bounded;

    focusables.forEach((el, i) => {
      el.classList.toggle('tv-focused', i === bounded);
      el.tabIndex = i === bounded ? 0 : -1;
    });

    const focused = focusables[bounded];
    focused.focus({ preventScroll: true });
    focused.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  function ensureFocus() {
    refreshFocusableMap();
    if (!state.rowState.focusables.length) return;

    if (state.rowState.focusedIndex < 0) {
      setFocusedIndex(0);
      return;
    }

    setFocusedIndex(state.rowState.focusedIndex);
  }

  function navigate(direction) {
    const current = state.rowState.focusables[state.rowState.focusedIndex];
    if (!current) return;

    const row = Number(current.dataset.row || 0);
    const col = Number(current.dataset.col || 0);

    if (direction === 'left' || direction === 'right') {
      const delta = direction === 'left' ? -1 : 1;
      const target = state.rowState.focusables.find((el) =>
        Number(el.dataset.row) === row && Number(el.dataset.col) === col + delta
      );
      if (target) setFocusedIndex(state.rowState.focusables.indexOf(target));
      return;
    }

    const rowDelta = direction === 'up' ? -1 : 1;
    const targetRow = state.rowState.rowMap.get(row + rowDelta);
    if (!targetRow || !targetRow.length) return;

    let best = targetRow[0];
    let bestScore = Math.abs(best.col - col);

    for (const candidate of targetRow) {
      const score = Math.abs(candidate.col - col);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    setFocusedIndex(best.index);
  }

  function handleKeydown(event) {
    if (!state.rowState.active) return;

    const keyMap = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowUp: 'up',
      ArrowDown: 'down'
    };

    if (keyMap[event.key]) {
      event.preventDefault();
      navigate(keyMap[event.key]);
      return;
    }

    if (event.key === 'Enter') {
      const focused = state.rowState.focusables[state.rowState.focusedIndex];
      if (focused) {
        event.preventDefault();
        focused.click();
      }
      return;
    }

    if (event.key === 'Escape' || event.key === 'Backspace') {
      const controls = document.querySelector('.tv-layer-controls');
      if (controls && controls.matches(':focus-within')) {
        event.preventDefault();
        ensureFocus();
        return;
      }
    }
  }

  function boot() {
    if (!document.body) return;
    ensureStyles();
    applyToggleClasses();
    createControls();
    buildRowLayout();
    ensureFocus();
  }

  const observer = new MutationObserver(() => {
    if (!document.body) return;
    applyToggleClasses();

    if (location.pathname === '/' || location.pathname === '/directory') {
      buildRowLayout();
      ensureFocus();
    }
  });

  document.addEventListener('keydown', handleKeydown, { capture: true });
  window.addEventListener('popstate', boot);
  window.addEventListener('hashchange', boot);
  window.addEventListener('load', boot);

  boot();
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
