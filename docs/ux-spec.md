# UX Spec: Twitch TV Layer

## Design direction

- Visual style: Apple TV inspired, with YouTube TV-like horizontal content rows.
- Emphasis: large, legible cards, smooth focus transitions, and low cognitive load.
- Background: soft dark gradient with subtle overlays to preserve stream artwork visibility.
- Content model: homepage transformed into rows of media cards grouped by section intent.

## Layout model

1. **Hero + rows**
   - Optional top hero region reserved for featured stream/category context.
   - Main content is a stacked list of horizontal rows.
2. **Row structure**
   - Row title on the left.
   - Horizontal card rail beneath the title.
   - Cards maintain consistent dimensions and spacing.
3. **Card behavior**
   - Poster/thumbnail first.
   - Stream title and channel metadata secondary.
   - Focused card scales up slightly and glows.

## Focus and navigation rules

- Navigation method is spatial and D-pad compatible.
- Only one focus target can be active at a time.
- Focus must never be lost:
  - On page load, first visible card receives focus.
  - If focused item disappears, nearest visible item is focused.
- Arrow navigation:
  - Left/Right: move within current row.
  - Up/Down: move to nearest card in adjacent row using column affinity.
- Enter/OK:
  - Activates focused item (opens stream/category).
- Back (Escape/Backspace):
  - Closes transient overlays first.
  - Falls back to browser history when no overlay is active.

## Default toggles

Toggles are exposed in a compact overlay menu and persisted via localStorage.

- **Chat**: off by default
- **Sidebar**: off by default
- **Panels**: off by default

Behavior expectations:
- Toggling is immediate without page reload.
- Hidden areas do not consume focus.
- Main card rows expand to use reclaimed space.

## Player mode behavior

When entering a stream/watch view, the UI should move into TV player mode:

- Prefer fullscreen-like, distraction-free composition.
- Keep overlays minimal and non-intrusive.
- Avoid persistent side UI unless explicitly enabled.
- Preserve reliable D-pad focus and activation for playback-adjacent controls.

## Accessibility and readability

- High-contrast focus ring and clear active state.
- Minimum readable text sizing for 10-foot usage.
- Motion is smooth but brief; avoid excessive animation.
