# Code Cleanup: Content Leak, Dependency Pinning, JS Refactor

## Context

A code review of the Kiln repo (custom JS/CSS, GitHub Actions workflow, mkdocs.yml, and docs/ content) surfaced two concrete bugs and one clarity/robustness issue in the hand-written frontend code. No security vulnerabilities were found in the CSS, and no changes to site content or visual appearance are in scope — this is a bug-fix and code-clarity pass only.

## 1. Content leak: internal docs published on the live site

`docs/superpowers/specs/2026-06-30-dark-mode-design.md` and `docs/superpowers/plans/2026-06-30-dark-mode.md` live inside `docs/`, which is the MkDocs source root. They aren't listed in `nav:` in `mkdocs.yml`, so they don't appear in site navigation — but `mkdocs build` still compiles them to HTML and publishes them at guessable URLs on the live GitHub Pages site. Internal planning artifacts are being unintentionally exposed publicly.

**Fix:** `git mv` both files (and their parent dirs) from `docs/superpowers/{specs,plans}/` to a new top-level `superpowers/{specs,plans}/` directory, outside the MkDocs source root, preserving git history. Add a short note to `CLAUDE.md` documenting that this project's brainstorming/planning docs live in top-level `superpowers/`, not `docs/superpowers/`, so future sessions don't reintroduce the leak.

## 2. Unpinned build dependencies

`.github/workflows/deploy.yml` runs `pip install mkdocs mkdocs-material` with no version constraints. A new upstream release of either package can silently change or break the deployed site on the next push to `primary`, with no lockfile to reproduce a previously-working build.

**Fix:**
- Add `requirements.txt` at the repo root pinning `mkdocs==1.6.1` and `mkdocs-material==9.7.6` (current latest on PyPI, verified at design time).
- Update `deploy.yml`'s install step to `pip install -r requirements.txt`, and add `cache: pip` to the `actions/setup-python` step for faster, reproducible installs.
- Update the install command shown in `CLAUDE.md`'s Commands section to match (`pip install -r requirements.txt`).

## 3. JS refactor and bug fix: `docs/javascripts/sidebar-toggle.js`

Three unrelated concerns — ASCII-art auto-fit, sidebar title fade, and scroll-to-top/bottom buttons — are crammed into one anonymous `DOMContentLoaded` callback. Two consequences:

- **Real bug:** `mkdocs.yml` enables `navigation.instant`, which does DOM reconciliation against freshly-fetched page content on in-app navigation. The scroll-buttons `<div>` (appended to `document.body`) and the sidebar-title-fade `<div>` (inserted into the primary nav) are created only once, at initial `DOMContentLoaded`. Neither exists in the HTML fetched for subsequent page navigations, so Material's instant-navigation reconciliation is expected to remove them — meaning the scroll buttons and sidebar fade likely vanish permanently after the user's first in-app navigation. Only `fitKilnAscii` is currently re-run on `document$.subscribe`.
- **Minor bug:** the sidebar-title-fade's `top` offset is computed once from `navTitle.offsetHeight` and never recalculated, so it can drift out of alignment if the title's height changes (e.g. on resize/reflow).

**Fix:** Restructure the file into named, single-purpose functions with the same net behavior and visual output:

- `fitKilnAscii()` — unchanged logic.
- `initSidebarFade()` — creates the fade element only if it doesn't already exist (idempotent), and recomputes its `top` offset each time it runs.
- `initScrollButtons()` — creates the scroll buttons only if they don't already exist (idempotent); wiring for click/scroll listeners stays the same.
- A single `init()` that calls all three, run on `DOMContentLoaded` **and** on every `document$` navigation event (matching the existing pattern already used for `fitKilnAscii`), and on `resize` for the fade recalculation.

This preserves current visual appearance and behavior exactly when navigation.instant hasn't kicked in yet (i.e., on first load, matches today), and fixes the disappearing-UI bug for subsequent navigations.

## Out of scope

- No CSS changes. The `!important` usage in `extra.css` is standard practice for overriding Material's own specificity and is not a workaround to remove.
- No content/copy changes anywhere in `docs/`.
- No visual/appearance changes — this is a correctness and clarity pass.

## Verification

- `mkdocs build` succeeds with no new warnings about orphaned pages.
- Manually verify in a local `mkdocs serve` session: navigate between at least two pages via in-app links and confirm the scroll buttons and sidebar fade remain present after navigation (this is the regression the fix targets, and needs live-browser verification since it depends on Material's client-side navigation behavior).
- `git log --follow` on the relocated spec/plan files confirms history is preserved through the move.
