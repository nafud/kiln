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
- `primary` — production. Pushing here triggers [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which builds (non-strict — validation already happened on `secondary`; the deploy build must not fail late) and deploys to GitHub Pages; it can be re-run manually from the Actions tab (`workflow_dispatch`). Receives only fast-forward pushes of CI-verified `secondary` states, once the user confirms: `git push origin secondary:primary`. A promotion done as a GitHub PR merge instead adds a merge commit to `primary`; after one, fast-forward `secondary` (and `redact`) to the merge commit so the next promotion fast-forwards again.
- Layout/content experiments that are just "to see how it looks" go on a throwaway branch (e.g. `experiment/<name>`), deleted afterwards — not commit+revert pairs on the long-lived branches.

## Structure

- [mkdocs.yml](mkdocs.yml) — site config: theme + three-way palette (light/dark/system), features (`navigation.instant`, `navigation.prune`, etc.), markdown extensions, `extra_javascript` load order, and `validation` settings. Link problems are escalated to warnings so `--strict` fails on them; the homepage is intentionally not in `nav`, so `nav.omitted_files` stays at `info`. `theme.font: false` disables Material's Google-Fonts loading — JetBrains Mono comes from the `@import` in extra.css instead. The `nav:` section must be updated manually when adding pages or sections.
- [docs/](docs/) — all content as Markdown. Every folder (section and sub-section) has an `index.md` landing page — with a `.home-grid` card grid when it has child pages to point at, **except** writeup-collection landing pages (`writeups/crackmes-one/`), which list their solutions as a metadata Markdown table (`| Crackme | Platform | Difficulty | Author |`) instead of cards. Sections nest: `Toolkit → {Guides → radare2, Links}`, `Readings → {Books → book folders, Bookmarks}`, `Writeups → {Crackmes.one, Challenges.re}`. The curated-link pages (`toolkit/links/`, `readings/bookmarks/`) render their entries as single-column `| Resource |` Markdown tables — see "Adding content". **Everything under `docs/` gets built and published** — do not put internal/non-public files here.
- [docs/index.md](docs/index.md) — homepage: the ASCII-logo `pre` (with plain-text fallback + `aria-label`), the four section cards, and an attribution line tagged `{: .home-attribution }`. It deliberately has **no `# h1`** — the logo is the title, and extra.css hides the `h1` Material generates from the page title (`.md-content__inner:has(.kiln-ascii) > h1`). The attribution link is the one external link intentionally **without** the `.external-link` icon (a chain icon would be noise in a footer signature); it still opens in a new tab like every off-site link, via external-links.js.
- [docs/stylesheets/extra.css](docs/stylesheets/extra.css) — all custom styling: JetBrains Mono as the global font, color variables in `:root` with `[data-md-color-scheme="slate"]` dark-mode overrides, ASCII logo sizing variables, card grid, register cards, sidebar styling (sticky nav titles + injected gradient fade), scroll buttons. The Material footer is hidden entirely (`.md-footer { display: none }`). Notes:
    - Card rules are scoped as `.md-typeset a.home-card` — a bare `.home-card` selector loses the cascade to Material's generic `.md-typeset a` rule (transitions get replaced and cards dim on hover).
    - The first paragraph after a page's `h1` renders as a faint subtitle (`h1 + p` rule) — every page's intro line relies on this.
    - The "Copied to clipboard" dialog is intentionally suppressed via `[data-md-component="dialog"] { display: none }`; code-copy itself still works.
    - Do not `@import` the logo font here — ascii-logo.js injects it only on pages that render the logo.
    - External links out of the site are marked with `.external-link` (a trailing chain-link SVG-mask icon, tinted via `currentColor` so it matches the link color and hover) applied via `attr_list`: `[text](url){ .external-link }`. The icon applies to **all** external links in content, not just the curated-link tables; the homepage attribution is the sole deliberate exception. Do **not** add `target=_blank rel=noopener` per link — external-links.js does that automatically for every off-site anchor.
    - Homepage-only rules are gated on `:has(.kiln-ascii)` (no homepage-specific class exists): they hide Material's generated `h1` and flex-stretch the `.md-main → .md-main__inner → .md-content → .md-content__inner` chain so the attribution's `margin-top: auto` pins it to the bottom of the viewport.
- [docs/javascripts/page-utils.js](docs/javascripts/page-utils.js) — shared `KilnUtils` global: `debounce`, and `onPageChange(fn)` which runs `fn` on load and after every `navigation.instant` page change (via Material's `document$`, falling back to `DOMContentLoaded`). Must stay **first** in `extra_javascript`; the other scripts depend on it.
- [docs/javascripts/external-links.js](docs/javascripts/external-links.js) — stamps `target="_blank"` + `rel="noopener"` on every anchor pointing at another origin (content links and the header repo link alike), so off-site links open in a new tab by default and Markdown never carries per-link `target=` attributes. Anchors with an explicit `target` keep it. Re-runs via `KilnUtils.onPageChange`; progressive enhancement — with JS off, links still work, just in the same tab.
- [docs/javascripts/page-chrome.js](docs/javascripts/page-chrome.js) — sidebar title fade and scroll-to-top/bottom buttons. Init functions are idempotent and re-run via `KilnUtils.onPageChange` because `navigation.instant` removes injected DOM on navigation.
- [docs/javascripts/code-copy.js](docs/javascripts/code-copy.js) — swaps the code-copy button icon to a checkmark after a copy (one delegated click listener; no per-navigation init). Material's own copy feedback is the toast dialog that extra.css hides; the checkmark is a CSS swap of the button's `::after` mask via the `md-code__button--copied` class. The restore is staged: `--leaving` fades the check out, then `--restoring` animates the copy icon back in. Swap timing is single-sourced from `--kiln-icon-swap-duration` in extra.css (the script reads it at runtime).
- [docs/javascripts/ascii-logo.js](docs/javascripts/ascii-logo.js) — generative homepage ASCII logo. Renders `CONFIG.text` ("Kiln") in UnifrakturMaguntia on an offscreen canvas, samples glyph coverage per character cell, and maps it onto a 70-character density ramp inside `pre.kiln-ascii`, sized to fit the content width and a viewport-height budget (no scrollbars). Static until the cursor moves; pointer movement drives a shimmer whose intensity envelope eases in/out. Key facts:
    - All tunables live in the `CONFIG` object; grid resolution is `--kiln-logo-font-size` in extra.css.
    - Waits for `document.fonts.ready` before measuring (the grid is sized from the pre's rendered JetBrains Mono cell) and rebuilds on late font loads.
    - Before generation the pre shows its plain-text fallback styled as a title; the `kiln-ascii--generated` class switches it to grid sizing.
    - To change the word: `CONFIG.text` **plus** the fallback text/`aria-label` in [docs/index.md](docs/index.md). To change the font: `CONFIG.fontFamily` and `CONFIG.fontStylesheetUrl`.
- [.github/](.github/) — `deploy.yml` (production deploy from `primary`), `build-check.yml` (strict build on `secondary`, plus a canary step that fails if a Material update renames theme internals our CSS/JS hook into — keep its hook list in sync when adding new `md-*` selectors), `dependabot.yml` (weekly pip + GitHub Actions update PRs). No issue/PR templates or contributor guides — see "What this is".
- Any internal planning or draft notes must live **outside** `docs/` (everything under `docs/` is published). There is no dedicated directory for them; the repo tracks only the site plus its build/CI config.
- [README.md](README.md) — repo front door, intentionally minimal: wordmark, one-line identity, badges — nothing else. The wordmark [docs/assets/images/kiln-logo-readme.svg](docs/assets/images/kiln-logo-readme.svg) is "Kiln" in UnifrakturMaguntia converted to vector outlines (no font dependency; black, with a near-white `prefers-color-scheme: dark` override). It lives under `docs/assets/images/` alongside the favicon (`kiln-logo-favicon.png`), so both are published with the site.

## Content sections

| Nav label | Directory | Topic |
|-----------|-----------|-------|
| Toolkit | `docs/toolkit/` | Authored tool guides/cheat sheets (`guides/`, e.g. Radare2) and curated external links (`links/`: tool sources + malware sample sources) |
| Readings | `docs/readings/` | Book notes (`books/`, e.g. csapp/mx86alp/pre/pba/re4b) and curated external bookmarks (`bookmarks/`: blogs/articles) |
| Courses | `docs/courses/` | Digital forensics investigation notes (`ild`/`ime`/`iwe`/`iwm`) |
| Writeups | `docs/writeups/` | Challenge solutions: Crackmes.one (`crackmes-one/`) and Challenges.re (`challenges-re/`) |

Cross-linking (RE4B ↔ challenges.re): the **Reverse Engineering for Beginners** notes (`readings/books/re4b/`) and the **challenges.re** writeups (`writeups/challenges-re/`) are paired — RE4B's exercises map onto challenges.re problems. Chapter 1 is the established pattern: `re4b-chapter-01.md` links its `§x.y Exercises` sections to the matching challenge anchors in `challenges-re-re4b-ch01.md`, and each solution links back to the book sections it leans on. Follow that page as the template when adding later chapters. Two rules: use **relative** links (`../../../writeups/challenges-re/challenges-re-re4b-ch01.md#anchor`), never absolute `nafud.github.io` URLs (they bypass `--strict` validation and break local preview); and never add a cross-link until **both** target pages exist — a link to a missing page fails `--strict`.

## Markdown extensions in use

- `admonition` + `pymdownx.details` — `!!! note`, `??? tip` collapsible blocks
- `attr_list` — attributes on Markdown elements
- `pymdownx.superfences` — fenced code blocks with language highlighting
- `pymdownx.highlight` + `pymdownx.inlinehilite` — syntax highlighting

## File naming convention

Each folder's landing page stays named `index.md` (this keeps clean directory URLs like `/readings/books/csapp/` and drives Material's `navigation.indexes` feature; the homepage `docs/index.md` must also keep this name). Every **non-index content page is prefixed with its folder's slug** so filenames are globally unique and greppable — e.g. `readings/books/csapp/csapp-chapter-07.md`, `readings/books/pba/pba-chapter-01.md`, `writeups/crackmes-one/crackmes-one-cfb1.md`. Folder slugs are short codes: `mx86alp` (Modern x86 ALP), `ild`/`ime`/`iwe`/`iwm` (the Investigating … courses).

Tool guides are an exception to the prefix rule: each guide is its **own folder** whose entire content lives in its `index.md` (e.g. `toolkit/guides/radare2/index.md`), giving it a clean URL (`/toolkit/guides/radare2/`) and room to grow sub-pages later.

**Page heading + subtitle convention.** Every content page opens with a single `# h1`, immediately followed by one intro paragraph — extra.css's `h1 + p` rule renders that paragraph as the faint subtitle, so it must be prose, not a list or table. Book-chapter h1s use the uniform house style **`# Chapter N. Title`** (period after the number, e.g. `# Chapter 8. Exceptional Control Flow`) — match it when adding or replacing a chapter; incoming drafts sometimes arrive with an em-dash or a `Book — Chapter N:` prefix, normalize them. Pages must **not** carry YAML frontmatter — no page uses it; Material derives the `<title>` (`"<h1> - Kiln"`) from the h1, auto-generates `<link rel="canonical">` from `site_url`, and the page description falls back to `site_description`. (A `title:`/`canonical:`/`meta-description:` block on an incoming draft is redundant or non-functional here — strip it.)

## Adding content

To add a new top-level section:

1. Create `docs/<section>/index.md`
2. Add the section to `nav:` in [mkdocs.yml](mkdocs.yml)

To add a new page within an existing section (e.g., `docs/readings/books/csapp/csapp-chapter-05.md` — note the folder-slug prefix; the landing page stays `index.md`):

1. Create the file, prefixed with the folder slug
2. Add it under the section in `nav:` in [mkdocs.yml](mkdocs.yml)
3. Add a card for it on the section's `index.md` landing page (href is the file's directory-URL slug, i.e. the filename without `.md`):

```html
<a class="home-card" href="<folder-slug>-<page>/">
<span class="home-card-title">Title</span>
<span class="home-card-text">One-line description.</span>
</a>
```

Exception: on writeup-collection landing pages (e.g. `writeups/crackmes-one/index.md`), step 3 is a row in the metadata table instead of a card:

```markdown
| [CFB1](crackmes-one-cfb1.md) | Windows x86-64 | Easy | pwn.by |
```

To add a tool guide: create `docs/toolkit/guides/<tool>/index.md` (the guide **is** the folder's index — see "File naming convention"), add it under `Guides:` in `nav:`, and add a card on `toolkit/guides/index.md`.

To add a curated external link (Toolkit → Links, Readings → Bookmarks): append a row to the page's single-column `| Resource |` table —

```markdown
| [Name](https://example.com/){ .external-link } |
```

(`.external-link` is only the icon — new-tab behavior is automatic via external-links.js.)

New malware sample sources go in the table under the existing `!!! warning "Curate with caution"` admonition on the Links page — that warning is mandatory and must stay. No `nav`/card changes are needed for link rows.

## Links (internal cross-references and external redirection)

Two link kinds, two rules — get them right or `--strict` / navigation breaks:

- **Internal links (page → page within the site)** are **relative Markdown links to the target `.md` file**, resolved and validated by `--strict`: `[CSAPP §3.6.3](csapp-chapter-03.md)` (same folder), `[Chapter 1](../../readings/books/re4b/re4b-chapter-01.md#152-x86-64)` (across sections, with a heading anchor). MkDocs rewrites these to the final directory URLs at build. **Never** hardcode an absolute `https://nafud.github.io/kiln/...` URL for internal targets — it skips link validation and 404s against the local `mkdocs serve`. Anchors are Material's slugified headings (lowercase, spaces→`-`, dots dropped: `### 1.5.2 x86-64` → `#152-x86-64`); after wiring cross-page anchors, confirm the `id=` exists in the built HTML. The RE4B ↔ challenges.re pair (see "Content sections") is the worked example.
- **External links (page → another origin)** are plain Markdown links tagged with the icon class: `[name](https://example.com/){ .external-link }`. New-tab **redirection is automatic** — [external-links.js](docs/javascripts/external-links.js) stamps `target="_blank" rel="noopener"` on every off-site anchor at load and after each `navigation.instant` change, so you do **not** write `target=_blank rel=noopener` per link. `.external-link` adds only the trailing chain-link icon; omit it (as the homepage attribution does) when the icon would be noise, and the link still opens in a new tab. Internal links are never redirected (external-links.js checks `origin`), so they stay in-tab.

## Custom CSS classes for content

Use the `.ascii-diagram` class on `<pre>` blocks for borderless, transparent ASCII diagrams:

```html
<pre class="ascii-diagram">
  +------+
  | box  |
  +------+
</pre>
```

Use `.register-grid` / `.register-card` for compact definition-card grids (4 columns, 2 on narrow screens; currently unused by content, kept available):

```html
<div class="register-grid">
  <div class="register-card">
    <div class="register-name">RAX</div>
    <div class="register-aliases">EAX · AX · AL / AH</div>
    <div class="register-desc">Accumulator; implicit in MUL, IMUL, DIV, IDIV</div>
  </div>
</div>
```
