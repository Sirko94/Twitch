# Twitch TV Layer Userscript

A userscript project that transforms Twitch into a modern, TV-first interface inspired by Apple TV and YouTube TV. The initial version focuses on a row-based browsing layout, strong spatial navigation behavior, and clean viewing defaults suitable for remote control navigation.

## Local testing (desktop/PC with Tampermonkey)

1. Install Tampermonkey in your desktop browser.
2. Create a new userscript and paste `userscripts/twitch-tv-layer.user.js`.
3. Open Twitch (`https://www.twitch.tv/`) and refresh.
4. Use keyboard controls to emulate a TV remote:
   - Arrow keys: D-pad navigation
   - Enter: OK/Select
   - Backspace or Escape: Back behavior (close overlay / fallback browser back)
5. Verify default layout behavior:
   - Chat hidden by default
   - Sidebar hidden by default
   - Panels hidden by default

## Android TV WebView integration (future)

This repository is structured so the userscript and CSS can later be reused in an Android TV WebView shell:

- Keep UI logic isolated in the userscript.
- Keep visual rules isolated in `/userscripts/css`.
- Introduce platform-specific key-mapping and lifecycle hooks later.
- Add remote-safe performance budgets once WebView integration starts.

- Performance note: this version decorates existing Twitch cards instead of cloning/rebuilding large DOM sections, which keeps page load and navigation responsive on low-power TV hardware.
