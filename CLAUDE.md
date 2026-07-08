# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Kiln is a static documentation site (MkDocs + Material theme) for reverse engineering and systems programming notes — book notes, tooling cheatsheets, digital forensics course notes, and crackme writeups. Deployed to GitHub Pages at https://nafud.github.io/kiln/. It is a personal project: content is CC BY 4.0, but external contributions are not solicited — do not add contributor-facing files (CONTRIBUTING, issue/PR templates); they were deliberately removed.

## Commands

```bash
pip install -r requirements.txt   # install dependencies (or: uv venv && uv pip install -r requirements.txt)
mkdocs serve                      # local dev server at http://127.0.0.1:8000/kiln/
mkdocs build --strict             # production build into site/; fails on warnings (what CI runs)
```

Dependency versions are pinned in [requirements.txt](requirements.txt). Dependabot opens weekly PRs for pip and GitHub Actions updates — review Material theme bumps on `secondary` before promoting, since theme updates can rename internal classes that [extra.css](docs/stylesheets/extra.css) and the scripts hook into (e.g. the code-copy button changed from `.md-clipboard` to `.md-code__button` across versions).

## Branch workflow and CI

Three long-lived branches form a pipeline. Work flows strictly downward — `redact` → `secondary` → `primary` — and never skips a tier:

- `redact` — writing desk. Long-lived branch where content is written gradually (draft chapters, half-finished notes). Unfinished states are first-class here: pages may be missing from `nav`, links may dangle, strict builds may fail — none of it matters because `redact` never reaches production directly and **no CI runs on it** (by design; a mid-draft red ✗ would be noise). Preview drafts locally with `mkdocs serve`. When a piece is ready, merge `redact` into `secondary`; immediately after each promotion, merge `secondary` back into `redact` so the desk stays current — skipping the sync-back is what causes `mkdocs.yml` nav conflicts later.
- `secondary` — test/integration branch, **always promotable**. Everything on it is finished work verified with a local `mkdocs serve`; every push runs [.github/workflows/build-check.yml](.github/workflows/build-check.yml) (`mkdocs build --strict` plus the theme-internals canary), so broken links and nav mistakes fail CI before they can reach production. Small self-contained changes (typo fixes, styling, config) are committed here directly; gradual content work arrives by merging `redact`.
- `primary` — production. Pushing here triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which builds and deploys to GitHub Pages; it can be re-run manually from the Actions tab (`workflow_dispatch`). Receives only fast-forward pushes of CI-verified `secondary` states, once the user confirms: `git push origin secondary:primary`.
- Layout/content experiments that are just "to see how it looks" go on a throwaway branch (e.g. `experiment/<name>`), deleted afterwards — not commit+revert pairs on the long-lived branches.

## Structure

- [mkdocs.yml](mkdocs.yml) — site config: theme + three-way palette (light/dark/system), features (`navigation.instant`, `navigation.prune`, etc.), markdown extensions, `extra_javascript` load order, and `validation` settings. Link problems are escalated to warnings so `--strict` fails on them; the homepage is intentionally not in `nav`, so `nav.omitted_files` stays at `info`. The `nav:` section must be updated manually when adding pages or sections.
- [docs/](docs/) — all content as Markdown. Each section has an `index.md` landing page with a `.home-grid` card grid. **Everything under `docs/` gets built and published** — do not put internal/non-public files here.
- [docs/stylesheets/extra.css](docs/stylesheets/extra.css) — all custom styling: JetBrains Mono as the global font, color variables in `:root` with `[data-md-color-scheme="slate"]` dark-mode overrides, ASCII logo sizing variables, card grid, sidebar styling, scroll buttons. Notes:
    - Card rules are scoped as `.md-typeset a.home-card` — a bare `.home-card` selector loses the cascade to Material's generic `.md-typeset a` rule (transitions get replaced and cards dim on hover).
    - The "Copied to clipboard" dialog is intentionally suppressed via `[data-md-component="dialog"] { display: none }`; code-copy itself still works.
    - Do not `@import` the logo font here — ascii-logo.js injects it only on pages that render the logo.
- [docs/javascripts/page-utils.js](docs/javascripts/page-utils.js) — shared `KilnUtils` global: `debounce`, and `onPageChange(fn)` which runs `fn` on load and after every `navigation.instant` page change (via Material's `document$`, falling back to `DOMContentLoaded`). Must stay **first** in `extra_javascript`; the other scripts depend on it.
- [docs/javascripts/page-chrome.js](docs/javascripts/page-chrome.js) — sidebar title fade and scroll-to-top/bottom buttons. Init functions are idempotent and re-run via `KilnUtils.onPageChange` because `navigation.instant` removes injected DOM on navigation.
- [docs/javascripts/code-copy.js](docs/javascripts/code-copy.js) — swaps the code-copy button icon to a checkmark after a copy (one delegated click listener; no per-navigation init). Material's own copy feedback is the toast dialog that extra.css hides; the checkmark is a CSS swap of the button's `::after` mask via the `md-code__button--copied` class. The restore is staged: `--leaving` fades the check out, then `--restoring` animates the copy icon back in. Swap timing is single-sourced from `--kiln-icon-swap-duration` in extra.css (the script reads it at runtime).
- [docs/javascripts/ascii-logo.js](docs/javascripts/ascii-logo.js) — generative homepage ASCII logo. Renders `CONFIG.text` ("Kiln") in UnifrakturMaguntia on an offscreen canvas, samples glyph coverage per character cell, and maps it onto a 70-character density ramp inside `pre.kiln-ascii`, sized to fit the content width and a viewport-height budget (no scrollbars). Static until the cursor moves; pointer movement drives a shimmer whose intensity envelope eases in/out. Key facts:
    - All tunables live in the `CONFIG` object; grid resolution is `--kiln-logo-font-size` in extra.css.
    - Waits for `document.fonts.ready` before measuring (the grid is sized from the pre's rendered JetBrains Mono cell) and rebuilds on late font loads.
    - Before generation the pre shows its plain-text fallback styled as a title; the `kiln-ascii--generated` class switches it to grid sizing.
    - To change the word: `CONFIG.text` **plus** the fallback text/`aria-label` in [docs/index.md](docs/index.md). To change the font: `CONFIG.fontFamily` and `CONFIG.fontStylesheetUrl`.
- [superpowers/](superpowers/) — internal brainstorming specs and implementation plans (not part of the published site). Claude Code's brainstorming/writing-plans skills should write here, not under `docs/`. Delete plans/specs once the planned work has shipped.
- [.github/](.github/) — `deploy.yml` (production deploy from `primary`), `build-check.yml` (strict build on `secondary`, plus a canary step that fails if a Material update renames theme internals our CSS/JS hook into — keep its hook list in sync when adding new `md-*` selectors), `dependabot.yml` (weekly pip + GitHub Actions update PRs).
- [README.md](README.md) — repo front door, intentionally minimal: wordmark, one-line identity, badges — nothing else. The wordmark [docs/assets/images/kiln-logo-readme.svg](docs/assets/images/kiln-logo-readme.svg) is "Kiln" in UnifrakturMaguntia converted to vector outlines (no font dependency; black, with a near-white `prefers-color-scheme: dark` override). It lives under `docs/assets/images/` alongside the favicon (`kiln-logo-favicon.png`), so both are published with the site.

## Content sections

| Nav label | Directory | Topic |
|-----------|-----------|-------|
| Books | `docs/books/` | Reverse engineering and systems programming books |
| Tools | `docs/tools/` | Tooling notes and cheatsheets |
| Courses | `docs/courses/` | Digital forensics investigation notes |
| Writeups | `docs/writeups/` | Crackme writeup solutions |

## Markdown extensions in use

- `admonition` + `pymdownx.details` — `!!! note`, `??? tip` collapsible blocks
- `attr_list` — attributes on Markdown elements
- `pymdownx.superfences` — fenced code blocks with language highlighting
- `pymdownx.highlight` + `pymdownx.inlinehilite` — syntax highlighting

## File naming convention

Each folder's landing page stays named `index.md` (this keeps clean directory URLs like `/books/csapp/` and drives Material's `navigation.indexes` feature; the homepage `docs/index.md` must also keep this name). Every **non-index content page is prefixed with its folder's slug** so filenames are globally unique and greppable — e.g. `books/csapp/csapp-chapter-07.md`, `books/pba/pba-chapter-01.md`, `writeups/crackmes-one/crackmes-one-cfb1.md`. Folder slugs are short codes: `mx86alp` (Modern x86 ALP), `rsore` (Reversing: Secrets of RE), `ild`/`ime`/`iwe`/`iwm` (the Investigating … courses).

## Adding content

To add a new top-level section:

1. Create `docs/<section>/index.md`
2. Add the section to `nav:` in [mkdocs.yml](mkdocs.yml)

To add a new page within an existing section (e.g., `docs/books/csapp/csapp-chapter-05.md` — note the folder-slug prefix; the landing page stays `index.md`):

1. Create the file, prefixed with the folder slug
2. Add it under the section in `nav:` in [mkdocs.yml](mkdocs.yml)
3. Add a card for it on the section's `index.md` landing page (href is the file's directory-URL slug, i.e. the filename without `.md`):

```html
<a class="home-card" href="<folder-slug>-<page>/">
<span class="home-card-title">Title</span>
<span class="home-card-text">One-line description.</span>
</a>
```

## Custom CSS note

Use the `.ascii-diagram` class on `<pre>` blocks for borderless, transparent ASCII diagrams:

```html
<pre class="ascii-diagram">
  +------+
  | box  |
  +------+
</pre>
```
