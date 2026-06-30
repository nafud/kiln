# Dark Mode Design

**Date:** 2026-06-30
**Status:** Approved

## Goal

Add a light/dark mode toggle to the Kiln site header. User preference persists across page loads via localStorage.

## Approach

CSS variables refactor: consolidate all hardcoded colors in `extra.css` into CSS custom properties defined per-scheme, then convert all element rules to reference those variables. This makes both palettes easy to read and adjust in one place.

## Changes

### `mkdocs.yml`

Replace the single `palette:` object with a two-entry list. Material detects the list and renders a toggle icon in the header automatically.

```yaml
palette:
  - scheme: default
    primary: white
    accent: blue
    toggle:
      icon: material/weather-night
      name: Switch to dark mode
  - scheme: slate
    primary: black
    accent: blue
    toggle:
      icon: material/weather-sunny
      name: Switch to light mode
```

### `docs/stylesheets/extra.css`

**Step 1 — variable definitions.** Add to the top of the file (replacing the existing `:root` block):

```css
:root {
  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-border: #e5e7eb;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-text-muted: #b0b7c3;
  --color-text-faint: #c4cad4;
  --color-accent: #2563eb;
  --color-accent-transparent: rgba(37, 99, 235, 0.1);
  --color-code-bg: #f5f5f5;
  --color-table-header-bg: #f9fafb;
  --color-shadow: rgba(0, 0, 0, 0.07);
}

[data-md-color-scheme="slate"] {
  --color-bg: #1e2028;
  --color-surface: #252830;
  --color-border: #2e3138;
  --color-text-primary: #e2e4e9;
  --color-text-secondary: #9ca3af;
  --color-text-muted: #6b7280;
  --color-text-faint: #4b5563;
  --color-accent: #2563eb;
  --color-accent-transparent: rgba(37, 99, 235, 0.15);
  --color-code-bg: #1a1d24;
  --color-table-header-bg: #1a1d24;
  --color-shadow: rgba(0, 0, 0, 0.25);
}
```

**Step 2 — mechanical substitution.** Replace every hardcoded hex color in element rules with the matching variable:

| Hardcoded value | Variable |
|-----------------|----------|
| `#fafafa` | `var(--color-bg)` |
| `#ffffff` | `var(--color-surface)` |
| `#e5e7eb` | `var(--color-border)` |
| `#111827` | `var(--color-text-primary)` |
| `#6b7280` | `var(--color-text-secondary)` |
| `#b0b7c3` | `var(--color-text-muted)` |
| `#c4cad4` | `var(--color-text-faint)` |
| `#2563eb` | `var(--color-accent)` |
| `rgba(37, 99, 235, 0.1)` | `var(--color-accent-transparent)` |
| `#f5f5f5` | `var(--color-code-bg)` |
| `#f9fafb` | `var(--color-table-header-bg)` |
| `rgba(0, 0, 0, 0.07)` | `var(--color-shadow)` |
| `rgba(0, 0, 0, 0.06)` | `var(--color-shadow)` |
| `#9ca3af` | `var(--color-text-secondary)` |

**Step 3 — special cases.**

`.sidebar-title-fade` gradient: replace the hardcoded `#fafafa` with `var(--color-bg)`:
```css
background: linear-gradient(to bottom, var(--color-bg), transparent);
```

`.kiln-ascii` dark gradient: the ASCII art title uses an explicit grey gradient that needs a separate dark override so it doesn't blow out against the dark background:
```css
[data-md-color-scheme="slate"] .md-typeset pre.kiln-ascii {
  background: linear-gradient(to top, #4b5563 0%, #9ca3af 100%) !important;
}
```

### No JS changes

`sidebar-toggle.js` is color-agnostic and requires no modifications.

## Scope

- Files changed: `mkdocs.yml`, `docs/stylesheets/extra.css`
- Files unchanged: `docs/javascripts/sidebar-toggle.js`, all content files
- No new files created
