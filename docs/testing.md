# Testing Guide: Twitch TV Layer Userscript

## Desktop Tampermonkey setup

1. Install Tampermonkey in Chrome/Edge/Firefox.
2. Open Tampermonkey dashboard and create a new script.
3. Paste the contents of `userscripts/twitch-tv-layer.user.js`.
4. Save and ensure the script is enabled.
5. Open `https://www.twitch.tv/` and refresh.

## Device emulation tips

- Use a desktop browser window at TV-like sizes (e.g., 1920x1080).
- In DevTools, test responsive presets approximating TV viewport dimensions.
- Increase zoom only if needed for development; keep native scale for realistic focus spacing.
- Validate behavior both logged in and logged out.

## Keyboard mapping for D-pad simulation

- `ArrowUp` = D-pad Up
- `ArrowDown` = D-pad Down
- `ArrowLeft` = D-pad Left
- `ArrowRight` = D-pad Right
- `Enter` = OK/Select
- `Backspace` or `Escape` = Back

## Checklist

### Focus behavior

- [ ] Initial focus appears on first visible card.
- [ ] Focus highlight is clearly visible from a distance.
- [ ] Focus never disappears after dynamic DOM updates.
- [ ] Focused card scales and shows shadow/glow.

### Navigation behavior

- [ ] Left/Right moves focus inside the same row.
- [ ] Up/Down jumps to nearest card in adjacent rows.
- [ ] Enter opens the focused stream/category.
- [ ] Back closes overlay first, then navigates history.

### Toggle behavior

- [ ] Chat is OFF by default.
- [ ] Sidebar is OFF by default.
- [ ] Panels are OFF by default.
- [ ] Toggling each setting updates layout instantly.
- [ ] Toggle settings persist across reload.

### Player mode behavior

- [ ] Player page appears in minimal overlay mode.
- [ ] Non-essential UI remains hidden unless enabled.
- [ ] Focus remains stable while navigating playback-related controls.
