# Dias Line — Split-Screen Design System

Standalone token system for a split-screen layout (dark brand panel + light form panel), built from the Dias Line logo palette — red / black / white, accent `#e11d3f`.

**This folder is additive.** Nothing in the existing app imports it yet; no existing file was modified. Wire it in explicitly when you build the split-screen page (`import './design-system/split-screen/tokens.css'` once near the app root, or scope it to a single route's CSS module).

## Files

| File | Purpose |
|---|---|
| `tokens.json` | Source of truth — primitive → semantic → component, in the three-layer structure |
| `tokens.css` | Generated CSS custom properties (`--ds-*`), ready to import |
| `tailwind.config.js` | Tailwind theme extension mapping utilities to the CSS variables (Tailwind is **not** currently installed in this CRA project — merge this into a root config if/when it is added) |
| `components.md` | Per-component state tables (default/hover/active/focus/disabled/loading/error) |

## Layout: Header → Hero → Content → Footer

```
┌─────────────────────────── Header (dark) ───────────────────────────┐
├──────────────────────┬────────────────────────────────────────────┤
│                       │                                            │
│   Hero (dark panel)   │        Form / content (light panel)        │
│   --ds-panel-dark-*   │        --ds-panel-light-*                  │
│                       │                                            │
├──────────────────────┴────────────────────────────────────────────┤
└─────────────────────────── Footer (dark) ────────────────────────────┘
```

- Desktop (≥1440px): dark panel `--ds-panel-dark-width` (50%), light panel `--ds-panel-light-width` (50%).
- Tablet (768–1439px): dark panel narrows to `--ds-panel-dark-width-tablet` (42%), light panel grows to 58% so the form keeps breathing room.
- Below `--ds-split-stack-breakpoint` (768px): panels **stack** — dark hero on top, light form panel below, both full-width. Do not attempt a side-by-side split under 768px.

## Grid & Breakpoints

| Token | Value | Use |
|---|---|---|
| `--ds-bp-mobile` | 375px | design baseline, not a CSS breakpoint — smallest supported width |
| `--ds-bp-tablet` | 768px | `md:` in Tailwind config; panels stack below this |
| `--ds-bp-desktop` | 1440px | `lg:` in Tailwind config; container hits max-width here |
| `--ds-container-max-width` | 1440px | outer shell cap |
| `--ds-content-max-width` | 1200px | text/content measure cap inside a panel |
| `--ds-form-max-width` | 440px | form column cap — keeps inputs from stretching full-panel-width on wide screens |

Spacing is an **8px base scale** (`--ds-space-1` = 4px is the only half-step, everything else is a multiple of 8: 8/12/16/20/24/32/40/48/64/80/96/128/160). Use it for all margins, gaps, and padding — don't hand-roll pixel values.

Container horizontal padding: `--ds-container-px-mobile` (16px) → `--ds-container-px-tablet` (32px) → `--ds-container-px-desktop` (64px).

## Typography

Two families:
- **Heading** — Manrope (600/700/800), for H1–H4 and the hero eyebrow/CTA labels. Geometric and bold enough to hold its own on the dark panel.
- **Body** — Inter (400/500/600), for H5–H6, body copy, labels, inputs, nav.

| Level | Desktop size | Mobile size | Weight | Line-height |
|---|---|---|---|---|
| H1 | 48px | 32px | 800 | 1.08 |
| H2 | 36px | 26px | 700 | 1.14 |
| H3 | 28px | 22px | 700 | 1.2 |
| H4 | 22px | 19px | 600 | 1.25 |
| H5 | 18px | 17px | 600 | 1.3 |
| H6 | 16px | 16px | 600 | 1.35 |
| Body lg | 18px | — | 400 | 1.6 |
| Body | 16px | — | 400 | 1.6 |
| Body sm | 14px | — | 400 | 1.55 |
| Caption | 12px | — | 500 | 1.4 |
| Label | 13px | — | 600 | 1.3 |

Mobile sizes apply automatically below 768px via the media query in `tokens.css` — no separate mobile classes needed if you use the `--ds-h*-size` variables (or the matching Tailwind `text-h1`…`text-h6` utilities).

## Color

- **Accent** `#e11d3f` (`--ds-accent`) is the *only* saturated color in the system — everything else is black/white/gray. Use it for primary actions, the active nav state, focus rings, and the hero eyebrow. Resist using it for large fills outside buttons/CTAs; it should read as a spark against the neutral panels, matching the logo's use of red as a mark, not a background.
- Dark panel (header/hero/footer) sits on `--ds-bg-dark-panel` (#0a0a0b, near-black rather than pure black — softer under long reading).
- Light panel (form/content) sits on `--ds-bg-light-panel` (#ffffff).
- Never mix `text-on-dark-*` tokens onto a light background or vice versa — pick the token set that matches the panel you're in.

## States (all interactive components)

Every interactive component defines these seven states — see `components.md` for exact values per component:

1. **Default**
2. **Hover** — pointer-only, background/border shift, no layout shift
3. **Focus** — `:focus-visible` only (keyboard), `--ds-shadow-focus-ring` (4px, accent at 45% alpha) — never suppress this
4. **Active** — pressed/mid-interaction, one step darker than hover
5. **Disabled** — `--ds-neutral-100/200/400` triad, `cursor: not-allowed`, no hover/active response
6. **Loading** — dimensions locked, label hidden, spinner shown, `pointer-events: none`
7. **Error** (inputs/forms only) — `--ds-danger` border + ring + helper text

## Accessibility (WCAG AA)

- Body text always uses `--ds-text-on-light` (#18181b) on white or `--ds-text-on-dark` (#ffffff) on `--ds-bg-dark-panel` — both exceed 15:1.
- Muted text (`--ds-text-on-light-muted` #71717a on white, `--ds-text-on-dark-muted` #a1a1aa on #0a0a0b) both land around 4.8:1 and 7.8:1 respectively — safe for body-sized text, not just large text.
- **`--ds-accent` (#e11d3f) on white is ~4.3:1** — passes AA for large/bold text and UI components (3:1) but falls just short of the 4.5:1 body-text threshold. Use `--ds-accent-text-readable` (`--ds-red-700`, ~6.5:1) instead whenever accent-colored text runs at body size/weight (e.g. a red inline link in a paragraph). Buttons are fine with plain accent since their label is bold ≥14px.
- Focus is always visible for keyboard users via `--ds-shadow-focus-ring`; it is intentionally suppressed only on `:focus` (mouse) in favor of `:focus-visible`, never removed outright.
- Checkbox, select, and modal all support full keyboard operation (space/enter to toggle, arrow keys in dropdowns, escape + focus trap in modals) — see `components.md` for specifics.
- Respect `prefers-reduced-motion`: `tokens.css` already zeroes all `--ds-duration-*` under that media query, so any animation built from these tokens auto-disables.

## Motion

- Durations: `instant` 80ms (press feedback) → `fast` 150ms (hover/focus) → `base` 220ms (panel/card transitions, modal fade) → `slow` 360ms (mobile menu slide) → `slower` 560ms (page-level reveals only).
- Easings: `standard` for most property transitions, `decelerate` for things entering the screen, `accelerate` for things leaving, `spring` reserved for the modal entrance and other one-off delight moments — don't use spring on hover states, it reads as jittery on repeated triggers.
- Keep hover transitions to background-color/border-color/transform/box-shadow only — never transition `width`/`height`/`top`/`left` for hover (layout thrash); use `transform` instead.

## Usage

```jsx
// once, near the app root or scoped to the split-screen route
import './design-system/split-screen/tokens.css';
```

```jsx
<button
  style={{
    height: 'var(--ds-btn-height-md)',
    padding: '0 var(--ds-btn-px-md)',
    borderRadius: 'var(--ds-btn-radius)',
    background: 'var(--ds-btn-primary-bg)',
    color: 'var(--ds-btn-primary-text)',
    fontSize: 'var(--ds-btn-font-size)',
    fontWeight: 'var(--ds-btn-font-weight)',
    transition: 'var(--ds-btn-transition)',
  }}
>
  Get started
</button>
```

Or, once Tailwind is installed, merge `tailwind.config.js`'s `theme.extend` into the project config and use `bg-accent hover:bg-accent-hover text-h1 rounded-md shadow-accent` etc. directly.
