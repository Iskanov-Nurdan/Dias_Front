# Dias Line — Split-Screen Component Specs

All values reference tokens from [`tokens.css`](./tokens.css). Prefix `--ds-`.

## Button

| Property | Default | Hover | Active | Focus | Disabled | Loading |
|---|---|---|---|---|---|---|
| **Primary** bg | `--ds-btn-primary-bg` (#e11d3f) | `--ds-btn-primary-bg-hover` (#b91538) | `--ds-btn-primary-bg-active` (#931530) | primary + ring | `--ds-btn-disabled-bg` | primary bg, 70% opacity content |
| Primary text | `--ds-btn-primary-text` (white) | white | white | white | `--ds-btn-disabled-text` | transparent (spinner overlay) |
| Primary shadow | none | `--ds-btn-primary-shadow-hover` | none, `translateY(1px)` | `--ds-shadow-focus-ring` | none | none |
| **Secondary** bg | transparent | `--ds-neutral-50` | `--ds-neutral-100` | transparent + ring | `--ds-btn-disabled-bg` | transparent |
| Secondary border | `--ds-border-on-light` | `--ds-neutral-300` | `--ds-neutral-300` | `--ds-accent` ring | `--ds-btn-disabled-border` | border-on-light |
| Secondary text | `--ds-text-on-light` | text-on-light | text-on-light | text-on-light | `--ds-btn-disabled-text` | text-on-light, 70% opacity |
| **Ghost** bg | transparent | `rgba(225,29,63,0.08)` | `rgba(225,29,63,0.14)` | transparent + ring | transparent | transparent |
| Ghost text | `--ds-accent` | accent-hover | accent-active | accent | disabled-text | accent, 70% opacity |

Sizes: `sm` 32px / `md` 40px / `lg` 48px height, radius `--ds-radius-md`, font `--ds-label-size` / `--ds-weight-semibold`.
Transition: `--ds-btn-transition` (150ms standard easing; transform uses 80ms for a snappy press).
Loading: swap label opacity to 0, center a 16px spinner (`animate-spin`, 2px border, current-color), keep button dimensions fixed, `pointer-events: none`.
Focus (keyboard only, `:focus-visible`): `box-shadow: var(--ds-shadow-focus-ring)`, no visible ring on mouse click.

## Input (text/email/password)

| State | Border | Ring | Background | Text |
|---|---|---|---|---|
| Default | `--ds-input-border` | none | `--ds-input-bg` | `--ds-input-text` |
| Hover | `--ds-input-border-hover` | none | unchanged | unchanged |
| Focus | `--ds-input-border-focus` | `--ds-input-ring-focus` | unchanged | unchanged |
| Filled | default border | none | unchanged | unchanged |
| Disabled | `--ds-border-on-light-subtle` | none | `--ds-input-bg-disabled` | `--ds-input-text-disabled` |
| Error | `--ds-input-border-error` | `--ds-input-ring-error` | unchanged | unchanged, helper text in `--ds-danger` |

Height 44px, radius `--ds-radius-md`, padding-x `--ds-space-4`, placeholder `--ds-input-placeholder`.
Error helper text: `--ds-body-sm-size`, `--ds-danger`, `--ds-space-1` gap below field, prefixed with an inline error icon.
Label: `--ds-label-size` / `--ds-weight-semibold` / `--ds-text-on-light-secondary`, `--ds-space-2` below label.

## Select

Extends Input tokens. Dropdown panel: `--ds-select-dropdown-bg`, `--ds-select-dropdown-shadow`, `--ds-select-dropdown-radius`, entrance `fade-in` + `slide-up` (base duration, decelerate easing), max-height with internal scroll.

| Option state | Background | Text |
|---|---|---|
| Default | transparent | `--ds-input-text` |
| Hover | `--ds-select-option-hover-bg` | unchanged |
| Selected | `--ds-select-option-selected-bg` | `--ds-select-option-selected-text` |
| Disabled | transparent | `--ds-input-text-disabled` |

Chevron rotates 180° on open (`--ds-duration-fast`, standard easing).

## Checkbox

| State | Box border | Box bg | Mark |
|---|---|---|---|
| Unchecked | `--ds-checkbox-border` | `--ds-checkbox-bg` | — |
| Checked | `--ds-checkbox-border-checked` | `--ds-checkbox-bg-checked` | `--ds-checkbox-check-mark` |
| Hover (unchecked) | `--ds-neutral-400` | unchanged | — |
| Focus | checkbox border + `--ds-shadow-focus-ring` | unchanged | — |
| Disabled | `--ds-checkbox-border-disabled` | `--ds-checkbox-bg-disabled` | `--ds-neutral-400` if checked |

Size 20px, radius `--ds-radius-sm`. Check-mark draws in with a 150ms `stroke-dashoffset` transition, not a hard cut.

## Card

Background `--ds-card-bg`, border `--ds-card-border`, radius `--ds-radius-xl`, padding `--ds-space-6`, shadow `--ds-card-shadow`.
Hover (only if interactive/clickable): shadow → `--ds-card-shadow-hover`, `transform: translateY(-2px)`, transition `--ds-card-transition`.
Focus (if focusable): `--ds-shadow-focus-ring` in addition to shadow.

## Modal

Overlay `--ds-modal-overlay-bg` with `fade-in` (base duration). Panel: bg `--ds-modal-bg`, radius `--ds-radius-2xl`, padding `--ds-space-8`, shadow `--ds-modal-shadow`, max-width `--ds-modal-max-width`, entrance `modal-in` (spring easing, translateY 12px → 0 + scale 0.98 → 1).
Close button: ghost button spec, `sm` size, top-right, `--ds-space-4` inset.
Focus trap required; `Escape` closes; return focus to trigger element on close.

## Navigation (header links)

| State | Text | Underline |
|---|---|---|
| Default | `--ds-nav-link-text` | none |
| Hover | `--ds-nav-link-text-hover` | none |
| Active/current | `--ds-nav-link-text-active` (accent) | 2px `--ds-nav-link-underline-active`, `--ds-space-1` below |
| Focus | hover text | + `--ds-shadow-focus-ring` on the link box, radius `--ds-radius-sm` |

Mobile menu: full-bleed panel `--ds-nav-mobile-menu-bg`, slides in from the right (`--ds-duration-slow`, decelerate), items stack with `--ds-space-2` gaps.

## Header / Hero / Footer

- **Header** — height `--ds-header-height` (72px desktop / 56px mobile), bg `--ds-header-bg` (dark panel), bottom border `--ds-header-border-bottom`, horizontal padding `--ds-header-px`. Logo left, nav center/right, primary CTA button right.
- **Hero** — lives inside the dark panel of the split layout. Eyebrow label in `--ds-hero-eyebrow-color` (`--ds-label-size`), H1 constrained to `--ds-hero-title-max-width` (560px) so it doesn't run the full panel width, body copy in `--ds-text-on-dark-secondary`. Vertical padding `--ds-hero-py-desktop` / `--ds-hero-py-mobile`.
- **Footer** — bg `--ds-footer-bg` (dark panel, matches header for a bookended feel), top border `--ds-footer-border-top`, text `--ds-footer-text`, vertical padding `--ds-footer-py`.
