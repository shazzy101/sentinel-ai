# Sentinel / Hadaleum Design Tokens

One-page reference for the Hadaleum spec palette, typography, and UI rules.
All CSS vars are defined in `src/index.css :root`. Tailwind aliases are in `tailwind.config.js`.

---

## Palette

| Token | CSS var | Value | Tailwind class |
|---|---|---|---|
| Background | `--hd-bg` | `#0a0a0a` | `bg-[#0a0a0a]` |
| Signal green | `--signal` | `#00ff88` | `text-signal` / `bg-signal` |
| Loss red | `--loss` | `#ff4444` | `text-loss` / `bg-loss` |
| Text primary | `--text-primary` | `#EEEEF4` (prod) / `#ffffff` (spec) | `text-text-primary` |
| Text secondary | `--text-secondary` | `#9898A8` (prod) / `#888888` (spec) | `text-text-secondary` |

> Note: The existing theme uses a "deep hadal zone" dark palette (`--bg-base: #050509`, `--text-primary: #EEEEF4`) that is deliberately richer than the flat spec values. The spec canonical vars (`--hd-bg`, `--signal`, `--loss`) are additive — they do not override the existing surface/text system. Use `--signal` / `--loss` for all new win/loss indicators.

---

## Glow Effects

| Token | CSS var | Value | Tailwind class |
|---|---|---|---|
| Signal glow | `--glow-signal` | `0 0 24px rgba(0,255,136,.25)` | `shadow-glow-signal` |
| Loss glow | `--glow-loss` | `0 0 24px rgba(255,68,68,.25)` | `shadow-glow-loss` |

Usage pattern:
```tsx
// Win card
<div className="shadow-glow-signal border border-signal/20">...</div>

// Loss card
<div className="shadow-glow-loss border border-loss/20">...</div>
```

---

## Typography

| Role | Font | Tailwind |
|---|---|---|
| Body / UI labels | Inter | `font-sans` / `font-body` |
| Display / hero headings | Bricolage Grotesque | `font-display` |
| Numbers / data / code | JetBrains Mono | `font-mono` |

> All numeric values (prices, percentages, P&L, counts) must use `font-mono` (JetBrains Mono).

---

## UI Rules (from spec)

1. **Numbers count up on first render** — use an incremental animation from 0 to the real value on mount. Duration ~600ms, easing `cubic-bezier(0.22, 1, 0.36, 1)`.
2. **Confidence as filled circles** — render as `●●●○○` (filled = confident, empty = uncertain). Never use percentage bars for confidence.
3. **Win = green glow, Loss = red glow** — use `shadow-glow-signal` for positive outcomes, `shadow-glow-loss` for negative.
4. **Skeletons, not spinners** — use `.skeleton` (shimmer gradient) for loading states. Do not use circular spinners.
5. **Mobile responsive** — all components must be responsive. Default to single-column on small screens (`sm:` breakpoint = 640px).

---

## Quick Palette Swatch

```
#0a0a0a  ████  Background (spec)
#00ff88  ████  Signal green
#ff4444  ████  Loss red
#ffffff  ████  Text (spec)
#888888  ████  Secondary text (spec)
```

---

## Existing Surface Hierarchy (do not override)

The production app uses a layered navy-black surface system:

```
--bg-base:     #050509   (deepest layer — body)
--bg-surface:  #08080F   (app shell)
--bg-card:     #0C0C16   (cards)
--bg-elevated: #11111E   (modals, popovers)
```

New components should use these for surfaces and reserve `--hd-bg` (#0a0a0a) only where the flat spec background is explicitly needed.
