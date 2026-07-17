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

- [mkdocs.yml](mkdocs.yml) — site config: theme + three-way palette (light/dark/system), `theme.custom_dir: overrides` (the 404 template), features (`navigation.instant`, `navigation.prune`, `navigation.footer` for key-nav.js, etc.), markdown extensions, `extra_javascript` load order, and `validation` settings. Link problems are escalated to warnings so `--strict` fails on them; the homepage is intentionally not in `nav`, so `nav.omitted_files` stays at `info`. `theme.font: false` disables Material's Google-Fonts loading — JetBrains Mono comes from the `@import` in extra.css instead. The `nav:` section must be updated manually when adding pages or sections.
- [docs/](docs/) — all content as Markdown. Every folder (section and sub-section) has an `index.md` landing page — with a `.home-grid` card grid when it has child pages to point at, **except** writeup-collection landing pages (`writeups/crackmes-one/`), which list their solutions as a metadata Markdown table (`| Crackme | Difficulty | Quality | Arch |`) instead of cards. Sections nest: `Toolkit → {Guides → radare2, Links}`, `Readings → {Books → book folders, Bookmarks}`, `Writeups → {Crackmes.one, Challenges.re, Hack This Site}`. The curated-link pages (`toolkit/links/`, `readings/bookmarks/`) render their entries as single-column `| Resource |` Markdown tables — see "Adding content". **Everything under `docs/` gets built and published** — do not put internal/non-public files here.
- [docs/index.md](docs/index.md) — homepage: the ASCII-logo `pre` (with plain-text fallback + `aria-label`), the four section cards, and an attribution line tagged `{: .home-attribution }`. It deliberately has **no `# h1`** — the logo is the title, and extra.css hides the `h1` Material generates from the page title (`.md-content__inner:has(.kiln-ascii) > h1`). The attribution link is the one external link intentionally **without** the `.external-link` icon (a chain icon would be noise in a footer signature); it still opens in a new tab like every off-site link, via external-links.js.
- [docs/stylesheets/extra.css](docs/stylesheets/extra.css) — all custom styling: JetBrains Mono as the global font, color variables in `:root` with `[data-md-color-scheme="slate"]` dark-mode overrides, ASCII logo sizing variables, card grid, register cards, sidebar styling (sticky nav titles + injected gradient fade), the hex progress chip, and the key-help panel. The Material footer is hidden entirely (`.md-footer { display: none }`) — its prev/next links still feed key-nav.js. Notes:
    - Card rules are scoped as `.md-typeset a.home-card` — a bare `.home-card` selector loses the cascade to Material's generic `.md-typeset a` rule (transitions get replaced and cards dim on hover).
    - The first paragraph after a page's `h1` renders as a faint subtitle (`h1 + p` rule) — every page's intro line relies on this, except book chapters (the TL;DR admonition follows the h1, so the rule never matches) and ledes tagged `.plain-intro`, which the adjacent override renders as normal body text.
    - The "Copied to clipboard" dialog is intentionally suppressed via `[data-md-component="dialog"] { display: none }`; code-copy itself still works.
    - Do not `@import` the logo font here — ascii-logo.js injects it only on pages that render the logo.
    - The sidebar and search scroll containers carry `overscroll-behavior: contain`, so a wheel gesture that runs them to their end never chains into scrolling the main page.
    - External links out of the site are marked with `.external-link` (a trailing chain-link SVG-mask icon, tinted via `currentColor` so it matches the link color and hover) applied via `attr_list`: `[text](url){ .external-link }`. The icon applies to **all** external links in content, not just the curated-link tables; the homepage attribution is the sole deliberate exception. Do **not** add `target=_blank rel=noopener` per link — external-links.js does that automatically for every off-site anchor.
    - Homepage-only rules are gated on `:has(.kiln-ascii)` (no homepage-specific class exists): they hide Material's generated `h1` and flex-stretch the `.md-main → .md-main__inner → .md-content → .md-content__inner` chain so the attribution's `margin-top: auto` pins it to the bottom of the viewport.
- [docs/javascripts/page-utils.js](docs/javascripts/page-utils.js) — shared `KilnUtils` global: `debounce`, and `onPageChange(fn)` which runs `fn` on load and after every `navigation.instant` page change (via Material's `document$`, falling back to `DOMContentLoaded`). Must stay **first** in `extra_javascript`; the other scripts depend on it.
- [docs/javascripts/external-links.js](docs/javascripts/external-links.js) — stamps `target="_blank"` + `rel="noopener"` on every anchor pointing at another origin (content links and the header repo link alike), so off-site links open in a new tab by default and Markdown never carries per-link `target=` attributes. Anchors with an explicit `target` keep it. Re-runs via `KilnUtils.onPageChange`; progressive enhancement — with JS off, links still work, just in the same tab.
- [docs/javascripts/page-chrome.js](docs/javascripts/page-chrome.js) — sidebar title fade and the hex reading-progress readout (`.scroll-progress`, fixed bottom-right: scroll offset over full scroll range as lowercase hex byte offsets, `0x1388/0x8d88`, offset padded to the range's width so the chip never resizes; empty on unscrollable pages). The chip shows only around scroll activity — `.scroll-progress--visible` is toggled on scroll and dropped ~1s after scrolling stops. The scroll range is cached (measured on init/resize/page change, re-synced after each scroll burst), so the per-scroll-event path never reads `scrollHeight` — that read forces a layout flush per frame during wheel scrolling. Init functions are idempotent and re-run via `KilnUtils.onPageChange` because `navigation.instant` removes injected DOM on navigation.
- [docs/javascripts/key-nav.js](docs/javascripts/key-nav.js) — keyboard navigation, replacing the former scroll-to-top/bottom buttons: `T`/`D` scroll to top/bottom, `J`/`K` step down/up, `<`/`>` follow the previous/next page in nav order, `H` hides/reveals both sidebars (`kiln-sidebars-hidden` on `body` — desktop-only in extra.css because the sidebars are off-canvas drawers below Material's 76.25em breakpoint; the class survives `navigation.instant`, so the choice holds across pages until reload), `?` toggles the `.key-help` panel (Escape closes it). Page switching clicks Material's footer prev/next links (`md-footer__link--prev/next`), which exist in the DOM only because `navigation.footer` is enabled in mkdocs.yml — the footer itself stays `display: none`; the click path keeps `navigation.instant` in charge. Keys are inert while typing and in Ctrl/Alt/Meta chords; Material's own `S`/`F`/`/`/`P`/`N` bindings stay untouched; scrolling is smooth unless `prefers-reduced-motion`. Attach-once (no per-page init); the help panel lives on `document.body`, surviving instant navigation.
- [docs/javascripts/code-copy.js](docs/javascripts/code-copy.js) — swaps the code-copy button icon to a checkmark after a copy (one delegated click listener; no per-navigation init). Material's own copy feedback is the toast dialog that extra.css hides; the checkmark is a CSS swap of the button's `::after` mask via the `md-code__button--copied` class. The restore is staged: `--leaving` fades the check out, then `--restoring` animates the copy icon back in. Swap timing is single-sourced from `--kiln-icon-swap-duration` in extra.css (the script reads it at runtime).
- [docs/javascripts/ascii-logo.js](docs/javascripts/ascii-logo.js) — generative ASCII logo (the homepage title, and the 404 page via the data attributes below). Renders `CONFIG.text` ("Kiln") in UnifrakturMaguntia on an offscreen canvas, samples glyph coverage per character cell, and maps it onto a 70-character density ramp inside `pre.kiln-ascii`, sized to fit the content width and a viewport-height budget (no scrollbars). Static until the cursor moves; pointer movement drives a shimmer whose intensity envelope eases in/out. Key facts:
    - All tunables live in the `CONFIG` object; grid resolution is `--kiln-logo-font-size` in extra.css.
    - Waits for `document.fonts.ready` before measuring (the grid is sized from the pre's rendered JetBrains Mono cell) and rebuilds on late font loads.
    - Before generation the pre shows its plain-text fallback styled as a title; the `kiln-ascii--generated` class switches it to grid sizing.
    - To change the word: `CONFIG.text` **plus** the fallback text/`aria-label` in [docs/index.md](docs/index.md). A single `pre` can override the word with `data-kiln-text` and the glyph font with `data-kiln-font` (the 404 page renders "404" in JetBrains Mono this way; a non-default font skips the Google-Fonts injection, so it must be a family the page already loads). To change the site-wide logo font: `CONFIG.fontFamily` and `CONFIG.fontStylesheetUrl`.
- [docs/javascripts/heading-shimmer.js](docs/javascripts/heading-shimmer.js) — hover shimmer for page `h1`s, the logo effect's interactive cousin: hovering the heading text scrambles its letters and digits along the logo's density ramp (same motion constants), sustains while hovered, and settles back to the exact original text after leave. The hover target is an injected inline wrapper (`.kiln-shimmer-target`), so the h1 block's empty width doesn't trigger. Substitutions are **alphanumeric-only** and every other character is a fixed point — punctuation like `-`/`/` creates soft-wrap opportunities, and changing those mid-shimmer rewraps multi-line titles and reflows the page. Respects `prefers-reduced-motion`; idempotent across `navigation.instant`.
- [overrides/404.html](overrides/404.html) — the 404 page, a Material template override (wired via `theme.custom_dir: overrides` in mkdocs.yml): blank except the ASCII-logo machinery rendering a centered, cursor-animated "404" (`data-kiln-text` on the `pre`); an empty `site_nav` block suppresses both sidebars, the header stays as the way back in. GitHub Pages serves the built `site/404.html` for any missing path — asset URLs come out root-relative (`/kiln/...`), so it renders at any depth. The centering CSS lives in extra.css under the `.kiln-ascii--404` rules; the explicit `width`/`flex` there is load-bearing (with only the small `pre` on the page, the md-grid auto margins shrink-to-fit the whole width chain and ASCII generation bails). Guarded by build-check canaries: `kiln-ascii--404` present and `md-sidebar` absent in `site/404.html`.
- [.github/](.github/) — `deploy.yml` (production deploy from `primary`), `build-check.yml` (strict build on `secondary`, plus a canary step that fails if a Material update renames theme internals our CSS/JS hook into — keep its hook list in sync when adding new `md-*` selectors), `dependabot.yml` (weekly pip + GitHub Actions update PRs). No issue/PR templates or contributor guides — see "What this is".
- Any internal planning or draft notes must live **outside** `docs/` (everything under `docs/` is published). There is no dedicated directory for them; the repo tracks only the site plus its build/CI config.
- [README.md](README.md) — repo front door, intentionally minimal: wordmark, one-line identity, badges — nothing else. The wordmark [docs/assets/images/kiln-logo-readme.svg](docs/assets/images/kiln-logo-readme.svg) is "Kiln" in UnifrakturMaguntia converted to vector outlines (no font dependency; black, with a near-white `prefers-color-scheme: dark` override). It lives under `docs/assets/images/` alongside the favicon (`kiln-logo-favicon.png`), so both are published with the site.

## Content sections

| Nav label | Directory | Topic |
|-----------|-----------|-------|
| Toolkit | `docs/toolkit/` | Authored tool guides/cheat sheets (`guides/`, e.g. Radare2) and curated external links (`links/`: tool sources + malware sample sources) |
| Readings | `docs/readings/` | Book notes (`books/`, e.g. csapp/mx86alp/pre/pba/re4b) and curated external bookmarks (`bookmarks/`: blogs/articles) |
| Courses | `docs/courses/` | Digital forensics investigation notes (`ild`/`ime`/`iwe`/`iwm`) |
| Writeups | `docs/writeups/` | Challenge solutions: Crackmes.one (`crackmes-one/`), Challenges.re (`challenges-re/`), and Hack This Site Application challenges (`hack-this-site/`) |

Cross-linking (RE4B ↔ challenges.re): the **Reverse Engineering for Beginners** notes (`readings/books/re4b/`) and the **challenges.re** writeups (`writeups/challenges-re/`) are paired — RE4B's exercises map onto challenges.re problems. Chapter 1 is the established pattern: `re4b-chapter-01.md` links its `§x.y Exercises` sections to the matching challenge anchors in `challenges-re-re4b-ch01.md`, and each solution links back to the book sections it leans on. Follow that page as the template when adding later chapters. Two rules: use **relative** links (`../../../writeups/challenges-re/challenges-re-re4b-ch01.md#anchor`), never absolute `nafud.github.io` URLs (they bypass `--strict` validation and break local preview); and never add a cross-link until **both** target pages exist — a link to a missing page fails `--strict`.

## Markdown extensions in use

- `admonition` + `pymdownx.details` — `!!! note`, `??? tip` collapsible blocks
- `attr_list` — attributes on Markdown elements
- `pymdownx.superfences` — fenced code blocks with language highlighting
- `pymdownx.highlight` + `pymdownx.inlinehilite` — Pygments syntax highlighting. Every fence carries a language, chosen by lexer fit not by loose label: `c`; `nasm` for **Intel**-syntax disassembly (`mov r8,[rbp-0x49]`, the crackme writeups) since it colors registers/hex/`;`-comments, `asm` (GAS) for **AT&T** listings (RE4B, challenges.re); `objdump` for objdump dumps; `console` for shell sessions with a `$`/`#` prompt and their output; `bash` for command cheatsheets whose `#` inline comments should grey out (the radare2 guide); `python`; `text` for raw bytes, hexdumps, ASCII diagrams, and formulas. `title="file.ext"` on a fence renders a filename header, styled in extra.css to match the surface recipe. Annotations that Pygments flags as error tokens (the plain-English notes trailing some listings) render as plain text, which is fine
- `pymdownx.tabbed` (`alternate_style: true`) — content tabs (`=== "Tab"`), e.g. the radare2/objdump alternatives in the CFB1 writeup

## File naming convention

Each folder's landing page stays named `index.md` (this keeps clean directory URLs like `/readings/books/csapp/` and drives Material's `navigation.indexes` feature; the homepage `docs/index.md` must also keep this name). Every **non-index content page is prefixed with its folder's slug** so filenames are globally unique and greppable — e.g. `readings/books/csapp/csapp-chapter-07.md`, `readings/books/pba/pba-chapter-01.md`, `writeups/crackmes-one/crackmes-one-cfb1.md`. Folder slugs are short codes: `mx86alp` (Modern x86 ALP), `ild`/`ime`/`iwe`/`iwm` (the Investigating … courses).

Tool guides are an exception to the prefix rule: each guide is its **own folder** whose entire content lives in its `index.md` (e.g. `toolkit/guides/radare2/index.md`), giving it a clean URL (`/toolkit/guides/radare2/`) and room to grow sub-pages later.

**Page heading + subtitle convention.** Every content page opens with a single `# h1`, immediately followed by one intro paragraph — extra.css's `h1 + p` rule renders that paragraph as the faint subtitle, so it must be prose, not a list or table. **Two exceptions**: book chapters carry no subtitle paragraph — the TL;DR admonition follows the h1 directly (a subtitle would only restate it; see "TL;DR" under Writing style) — and a lede tagged `{: .plain-intro }` (the radare2 guide) renders as normal body text instead of the faint subtitle. Book-chapter h1s use the uniform house style **`# Chapter N. Title`** (period after the number, e.g. `# Chapter 8. Exceptional Control Flow`) — match it when adding or replacing a chapter; incoming drafts sometimes arrive with an em-dash or a `Book — Chapter N:` prefix, normalize them. Pages must **not** carry YAML frontmatter — no page uses it; Material derives the `<title>` (`"<h1> - Kiln"`) from the h1, auto-generates `<link rel="canonical">` from `site_url`, and the page description falls back to `site_description`. (A `title:`/`canonical:`/`meta-description:` block on an incoming draft is redundant or non-functional here — strip it.)

## Writing style

Every page under `docs/` is a note from one reverse engineer to another. Two things matter most, in this order: technical accuracy and coherence. Clarity and concision serve them and never override them, so a sentence is never trimmed or smoothed at the cost of a fact. The register is textbook, not blog. Written for a competent peer who wants the result without being exhausted by it: clear, on point, dry, and easy to read from the first line to the last. This holds site-wide (book notes, tool guides, course notes, writeups), not only in writeups. For CSS and design rules see "Styling conventions".

**Voice.** Assume a competent peer. State findings, do not narrate the journey and do not teach down. No hype, no rhetorical questions, no self-congratulation ("as we can clearly see"), no tour guiding ("let's dive in", "now we will"). Prefer impersonal statements over second person. Say a thing once.

**Flow.** The prose reads as one continuous line of reasoning. Each sentence follows from the one before it, and each paragraph hands off cleanly to the next, so there are no abrupt jumps and no clunky seams. When a step depends on a fact established earlier, carry that fact forward in words rather than assuming the reader reassembles it. Concision means cutting what carries no information, not compressing what remains into fragments, arrow chains, or shorthand. A shorter note the reader has to decode twice is not shorter. Read a finished page top to bottom once; if a transition jars or a sentence lands without a reason to be there, fix it.

**No fillers.** Cut `simply`, `just`, `obviously`, `of course`, `basically`, `note that`, `it is worth noting`, `as we know`. `in order to` becomes `to`. Delete any sentence that only announces the next one. A clause carrying no fact is cut.

**Punctuation.** Two hard bans, both in prose only.

- No em dashes (`—`) and no double hyphens (`--`). Recast with a comma, parentheses, or a second sentence.
- No colons, including in a caption that introduces a code block. A bold lead-in label ends with a period (`**Storage.**`, `**In one line.**`), never a colon.
- Both bans leave content alone. Hyphens inside tokens stay (`x86-64`, `PE32+`, `case-sensitive`, `2-digit`), and so do colons inside code spans, code blocks, URLs, table syntax, and the metadata-block labels described below.

**Accuracy.** Nothing is asserted that was not checked.

- Every address, instruction, constant, offset, hash, and console line is verified against the actual file or an actual tool run. Never reconstruct output from memory or from expectation.
- A command shown must reproduce the output shown. When output is filtered for readability, show the filter (`strings -n 6 CFB1.exe | grep -E '\[[-+*]\]'`) instead of silently trimming a raw dump.
- Do not imply a tool was run when it was not, or that a binary was executed when the work was static.
- Justify an identification rather than naming it. `0x1400297a0` is `memcmp` because it takes two pointers and a length and returns zero only on full equality.
- Effects before encodings. "Each byte prints as two uppercase hex digits" first, the flag bits that cause it second.
- State assumptions in place (ASCII input, byte-wide wrap).
- Scripts are complete and runnable, with a filename, an invocation, and their real output. No fragment that errors when pasted.

**Reproducibility.** A reader holding the same file and the note must reach the same result. Derive a constant before using it (`delta(.rdata) = vaddr - paddr`), then apply it. Prefer the mechanical path a reader can repeat over a shortcut that only worked because the author already knew the answer.

**TL;DR.** A book chapter opens with a `!!! tip "TL;DR"` admonition immediately after the `# h1` (no subtitle paragraph). It is one dense, well-written paragraph carrying the chapter's load-bearing facts, so a reader gets the whole result before the detail and can decide what to read closely. Any orienting fact worth keeping (target toolchain, scope) is at most a short paragraph after the TL;DR; a general intro that carries no technical fact is cut. A chapter has **no Summary section** — the TL;DR is the summary, and a closing recap that adds nothing new is cut. [csapp-chapter-03.md](docs/readings/books/csapp/csapp-chapter-03.md) is the reference. Writeups carry their own TL;DR holding the answer (formula or key) rather than a chapter summary; see the writeup skeleton.

### Writeup skeleton

[crackmes-one-cfb1.md](docs/writeups/crackmes-one/crackmes-one-cfb1.md) and [crackmes-one-cfb2.md](docs/writeups/crackmes-one/crackmes-one-cfb2.md) are the reference implementations. The order is fixed.

1. `# h1`, the challenge name alone (`# CFB1`), no subtitle in the title.
2. Metadata block, a single paragraph of bold label and value lines joined by Markdown hard breaks (two trailing spaces), ordered Source (link to the challenge), Author, Difficulty, Quality, Language, Platform, Arch. It is the `h1 + p` paragraph, so extra.css renders it as the faint grey block. Keep it a paragraph; a table here loses the styling.
3. Intro prose, one paragraph, stating what the challenge is and what solving it takes. Each writeup stands alone and never cross-references a sibling challenge.
4. Info table, exactly `Target` (executable name only), `Image base`, `SHA-256`, and `Method` (`Static analysis. No debugger.`). No Toolchain or Tools-used rows.
5. `!!! tip "TL;DR"`, titled exactly `TL;DR`, holding the answer (formula or key) and a link to the section carrying the full script.
6. Numbered sections forming the reproducible spine. Triage, Strings, Locating main, Reading main, the challenge-specific routine, then the keygen or solver.
7. `## Appendix`, titled exactly that, an address table of the landmarks used.

There is no Summary section. The high-level statement is item 3, and the answer is item 5.

**Tool tabs.** Where a step has two tool paths, use `pymdownx.tabbed` with Radare2 first so it is the default tab, then Objdump, as `=== "Radare2"` and `=== "Objdump"` with bodies indented four spaces. Radare2 is the primary workflow and objdump is the no-frills fallback. Both bodies carry real output from that tool.

### Exercise notes

[challenges-re-re4b-ch01.md](docs/writeups/challenges-re/challenges-re-re4b-ch01.md) is the reference. Per exercise, an `## h2` carrying the number and topic, a metadata paragraph (Source link, Tags), the listing copied verbatim from the source, analysis prose, an `**In one line.**` answer, and a `**C.**` block where a C equivalent exists. Answer the questions the challenge actually asks. Where it asks three, answer three, and do not force a C equivalent onto code whose behavior is undefined.

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
| [CFB1](crackmes-one-cfb1.md) | 2.2 | 4.3 | x86-64 |
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

## Styling conventions

The design language in [extra.css](docs/stylesheets/extra.css) is settled. These invariants hold across the whole site — follow them when adding styles or styled content; do not introduce parallel systems:

- **Colors come from the tokens, never hardcoded.** Every color is one of the `--color-*` custom properties defined in `:root` (light) and re-declared under `[data-md-color-scheme="slate"]` (dark) — a raw hex value in a rule breaks one of the two palettes. The text ladder runs `--color-text-primary` (headings, card titles) → `-secondary` (body prose) → `-muted` (supporting text, nav links) → `-faint` (labels, subtitles, decorative); pick the step that matches the text's importance. The one accent is blue `#2563eb`, identical in **both** schemes (only `--color-accent-transparent`'s alpha differs), and is bridged into Material via `--md-accent-fg-color`.
- **One typeface.** JetBrains Mono is the only font for text and code alike, `@import`ed at weights 400–700 at the top of extra.css and forced (`!important`) across Material's components. Code blocks additionally disable ligatures (`font-variant-ligatures: none`) so `->` and `=>` render as typed. The sole other font is the logo's UnifrakturMaguntia, injected by ascii-logo.js on the homepage only.
- **Type scale.** Content prose 0.78rem/1.7; code blocks 0.72rem/1.55; `h1` 1.8rem with a bottom border (the only ruled heading), `h2` 1.2rem, `h3` 0.95rem; the `h1 + p` subtitle 0.76rem in faint. The recurring **label style** — 0.65rem, uppercase, letter-spacing, weight 700, faint/muted color — is shared by table header rows and the top-level sidebar section names (collapsed and expanded alike); reuse it for anything label-like rather than inventing a new treatment.
- **Surface recipe.** Every raised element — home cards, register cards, code `pre` blocks, the header, the hex progress chip — is the same construction: `--color-surface` background, 1px `--color-border` border, 4px border-radius (3px for inline code), and **flat at rest** (no box-shadow until hover; the `.key-help` popover is the one deliberate exception, since it floats over content). Backgrounds elsewhere are `--color-bg` (body, sidebars, search form).
- **Hover grammar.** Inline links fade (`opacity: 0.75`); interactive *surfaces* lift instead: border turns `--color-accent`, `translateY(-1px)` (buttons) or `-2px` (cards), and a `--color-shadow` box-shadow appears, with inner text sharpening one ladder step (card title → accent, card text muted → secondary). All transitions are 150–200ms `ease`. Block-level links must cancel the generic link fade with `opacity: 1` on hover (see the `.home-card` cascade note above), or the whole surface dims.
- **Beating Material's cascade.** Overrides of theme internals routinely need `.md-typeset`-scoped selectors or `!important` to win — that usage is deliberate, not cruft. When a new rule hooks a Material `md-*` internal class, add it to the canary list in [build-check.yml](.github/workflows/build-check.yml).
- Fixed chrome decisions, not to be reverted casually: content column capped at 900px; content tables full-width with `table-layout: fixed` and a label-style header row; Material footer hidden; "Copied to clipboard" dialog suppressed (checkmark feedback instead); scroll-to-top/bottom buttons replaced by keyboard navigation (key-nav.js); the hex progress chip bottom-right fades with scroll activity (`.scroll-progress--visible`, toggled by page-chrome.js).

## Custom CSS classes for content

Tag a page's first paragraph `{: .plain-intro }` (attr_list) to opt it out of the faint `h1 + p` subtitle styling and render it as normal body text — used by the radare2 guide's lede.

Use the `.ascii-diagram` class on `<pre>` blocks for borderless, transparent ASCII diagrams (currently unused by content, kept available):

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
