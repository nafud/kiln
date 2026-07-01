# Code Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on plan location:** this plan lives in top-level `superpowers/plans/`, not the skill's default `docs/superpowers/plans/` — see Task 2, which fixes exactly this kind of path being inside the published MkDocs site.

**Goal:** Fix two concrete bugs (internal docs leaking onto the live site, unpinned build dependencies) and refactor `sidebar-toggle.js` to fix a real DOM-reconciliation bug, without changing site content or appearance.

**Architecture:** Three independent, self-contained changes: (1) pin build dependencies via `requirements.txt`, (2) relocate leaked internal docs out of the MkDocs source root, (3) restructure the sidebar JS into idempotent, re-runnable init functions. No new dependencies, frameworks, or test infra are introduced — this project has no existing test suite, so verification uses direct command output and manual browser checks, matching how the project is already validated (`mkdocs build`, `mkdocs serve`).

**Tech Stack:** MkDocs + Material theme (Python), vanilla JS, GitHub Actions.

## Global Constraints

- Pin exactly `mkdocs==1.6.1` and `mkdocs-material==9.7.6` (verified current latest on PyPI at design time).
- No changes to site content, copy, or visual appearance.
- No CSS changes.
- Preserve git history when moving files — always use `git mv`, never delete-and-recreate.
- This project's brainstorming/planning docs live in top-level `superpowers/{specs,plans}/`, not `docs/superpowers/` — `docs/` is the MkDocs source root and anything under it gets published.

---

### Task 1: Pin build dependencies

**Files:**
- Create: `requirements.txt`
- Modify: `.github/workflows/deploy.yml`
- Modify: `CLAUDE.md`

**Interfaces:**
- Produces: `requirements.txt` at repo root, consumed by Task 2 and Task 3's verification steps (both need `mkdocs` installed to run `mkdocs build`/`mkdocs serve`).

- [ ] **Step 1: Create `requirements.txt`**

```
mkdocs==1.6.1
mkdocs-material==9.7.6
```

- [ ] **Step 2: Update the workflow to install from the pinned file and cache pip**

In `.github/workflows/deploy.yml`, find:

```yaml
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: |
          pip install mkdocs mkdocs-material
```

Replace with:

```yaml
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - name: Install dependencies
        run: pip install -r requirements.txt
```

- [ ] **Step 3: Update the install command documented in CLAUDE.md**

In `CLAUDE.md`, find:

```
pip install mkdocs mkdocs-material   # install dependencies
mkdocs serve                         # local dev server at http://127.0.0.1:8000
mkdocs build                         # build static site into site/
```

Replace with:

```
pip install -r requirements.txt      # install dependencies
mkdocs serve                         # local dev server at http://127.0.0.1:8000
mkdocs build                         # build static site into site/
```

- [ ] **Step 4: Install into a local venv and verify the pinned versions resolve**

Run:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/mkdocs --version
.venv/bin/pip show mkdocs-material | grep Version
```

Expected: `mkdocs, version 1.6.1` and `Version: 9.7.6`. (`.venv/` is already in `.gitignore`, so this won't get committed.)

- [ ] **Step 5: Commit**

```bash
git add requirements.txt .github/workflows/deploy.yml CLAUDE.md
git commit -m "Pin mkdocs and mkdocs-material versions for reproducible builds"
```

---

### Task 2: Relocate internal planning docs out of the published site

**Files:**
- Move: `docs/superpowers/specs/2026-06-30-dark-mode-design.md` → `superpowers/specs/2026-06-30-dark-mode-design.md`
- Move: `docs/superpowers/plans/2026-06-30-dark-mode.md` → `superpowers/plans/2026-06-30-dark-mode.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `requirements.txt` and `.venv/` from Task 1, to run `mkdocs build` for verification.

- [ ] **Step 1: Move the files, preserving history**

```bash
git mv docs/superpowers/specs/2026-06-30-dark-mode-design.md superpowers/specs/2026-06-30-dark-mode-design.md
git mv docs/superpowers/plans/2026-06-30-dark-mode.md superpowers/plans/2026-06-30-dark-mode.md
rmdir docs/superpowers/specs docs/superpowers/plans docs/superpowers
```

- [ ] **Step 2: Verify git history followed the move**

Run: `git log --follow --oneline -- superpowers/specs/2026-06-30-dark-mode-design.md`
Expected output includes the original commit `Add dark mode design spec` (in addition to the new move commit once committed).

- [ ] **Step 3: Add a note to CLAUDE.md documenting the correct location for planning docs**

In `CLAUDE.md`, find:

```
## Structure

- [mkdocs.yml](mkdocs.yml) — site config, theme, nav, and plugin settings. The `nav:` section must be updated manually when adding new pages or sections.
- [docs/](docs/) — all content lives here as Markdown files. Each section has an `index.md` that serves as its landing page.
- [docs/stylesheets/extra.css](docs/stylesheets/extra.css) — custom styles (JetBrains Mono font, card grid on home page, sidebar, scroll buttons).
- [docs/javascripts/sidebar-toggle.js](docs/javascripts/sidebar-toggle.js) — ASCII art auto-fit, scroll-to-top/bottom buttons.
```

Replace with:

```
## Structure

- [mkdocs.yml](mkdocs.yml) — site config, theme, nav, and plugin settings. The `nav:` section must be updated manually when adding new pages or sections.
- [docs/](docs/) — all content lives here as Markdown files. Each section has an `index.md` that serves as its landing page. **Everything under `docs/` gets built and published** — do not put internal/non-public files here.
- [docs/stylesheets/extra.css](docs/stylesheets/extra.css) — custom styles (JetBrains Mono font, card grid on home page, sidebar, scroll buttons).
- [docs/javascripts/sidebar-toggle.js](docs/javascripts/sidebar-toggle.js) — ASCII art auto-fit, scroll-to-top/bottom buttons.
- [superpowers/](superpowers/) — internal brainstorming specs and implementation plans (not part of the published site). Claude Code's brainstorming/writing-plans skills should write here, not under `docs/superpowers/`.
```

- [ ] **Step 4: Build the site and confirm no orphan pages are produced**

Run:

```bash
.venv/bin/mkdocs build
find site -iname "*superpowers*"
```

Expected: `mkdocs build` completes with no warnings about `superpowers/specs/...` or `superpowers/plans/...` not being in the nav, and the `find` command prints nothing (no `superpowers` output directory under `site/`).

- [ ] **Step 5: Commit**

```bash
git add superpowers/specs/2026-06-30-dark-mode-design.md superpowers/plans/2026-06-30-dark-mode.md CLAUDE.md
git add -u docs/superpowers
git commit -m "Move internal planning docs out of the published MkDocs site"
```

---

### Task 3: Refactor sidebar-toggle.js and fix the instant-navigation bug

**Files:**
- Modify: `docs/javascripts/sidebar-toggle.js`

**Interfaces:**
- Consumes: `.venv/` from Task 1 to run `mkdocs serve` for manual verification.
- Produces: no external interface — this file is only loaded by MkDocs via `extra_javascript` in `mkdocs.yml`, which is unchanged.

- [ ] **Step 1: Replace the full contents of `docs/javascripts/sidebar-toggle.js`**

Replace the entire file with:

```javascript
/* ASCII art auto-fit */

function fitKilnAscii() {
  const pre = document.querySelector("pre.kiln-ascii");
  if (!pre) return;

  pre.style.fontSize = "1rem";

  const container = pre.parentElement;
  if (!container) return;

  const available = container.clientWidth;
  const scrollW = pre.scrollWidth;

  if (scrollW > 0 && scrollW > available) {
    const current = parseFloat(getComputedStyle(pre).fontSize);
    pre.style.fontSize = (current * (available / scrollW) * 0.98) + "px";
  }
}

/* Debounce resize handler to avoid layout thrashing */
function debounce(fn, delay) {
  let timer;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

/* Gradient fade below sticky sidebar title.
   Idempotent and safe to re-run: navigation.instant reconciles the DOM
   against freshly fetched page content, which doesn't include this
   injected element, so it must be re-created after every navigation. */
function initSidebarFade() {
  const primaryNav = document.querySelector('.md-sidebar--primary .md-nav--primary');
  const navTitle = primaryNav && primaryNav.querySelector('.md-nav__title');
  if (!navTitle) return;

  let fade = navTitle.parentNode.querySelector('.sidebar-title-fade');
  if (!fade) {
    fade = document.createElement('div');
    fade.className = 'sidebar-title-fade';
    navTitle.parentNode.insertBefore(fade, navTitle.nextSibling);
  }
  fade.style.top = navTitle.offsetHeight + 'px';
}

/* Scroll-to-top/bottom buttons.
   Idempotent and safe to re-run, for the same reason as initSidebarFade. */
function initScrollButtons() {
  if (document.querySelector('.scroll-buttons')) return;

  const scrollButtons = document.createElement("div");
  scrollButtons.className = "scroll-buttons scroll-hidden";

  const upArrowSvg = '<svg viewBox="0 0 24 24"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>';
  const downArrowSvg = '<svg viewBox="0 0 24 24"><path d="M12 16l6-6-1.41-1.41L12 13.17l-4.59-4.58L6 10z"/></svg>';

  const topBtn = document.createElement("button");
  topBtn.className = "scroll-btn";
  topBtn.setAttribute("aria-label", "Scroll to top");
  topBtn.title = "Scroll to top";
  topBtn.innerHTML = upArrowSvg;

  const bottomBtn = document.createElement("button");
  bottomBtn.className = "scroll-btn";
  bottomBtn.setAttribute("aria-label", "Scroll to bottom");
  bottomBtn.title = "Scroll to bottom";
  bottomBtn.innerHTML = downArrowSvg;

  scrollButtons.appendChild(topBtn);
  scrollButtons.appendChild(bottomBtn);
  document.body.appendChild(scrollButtons);

  topBtn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  bottomBtn.addEventListener("click", function () {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  });

  function updateScrollButtons() {
    if (window.scrollY > 200) {
      scrollButtons.classList.remove("scroll-hidden");
    } else {
      scrollButtons.classList.add("scroll-hidden");
    }
  }

  window.addEventListener("scroll", updateScrollButtons);
  updateScrollButtons();
}

function init() {
  fitKilnAscii();
  initSidebarFade();
  initScrollButtons();
}

document.addEventListener("DOMContentLoaded", function () {
  init();
  window.addEventListener("resize", debounce(function () {
    fitKilnAscii();
    initSidebarFade();
  }, 100));
});

/* Re-run on instant-navigation page changes: fitKilnAscii recalculates for
   the new page's content, and initSidebarFade/initScrollButtons recreate
   elements that navigation.instant's DOM reconciliation may have removed. */
if (typeof document$ !== 'undefined') {
  document$.subscribe(init);
}
```

- [ ] **Step 2: Check the file for syntax errors**

Run: `node --check docs/javascripts/sidebar-toggle.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Manually verify in a browser that the bug is fixed**

Run: `.venv/bin/mkdocs serve` in the background, then in a browser:

1. Open `http://127.0.0.1:8000`. Confirm the ASCII art title renders and the scroll buttons appear after scrolling down 200px (same as before this change).
2. Click a sidebar link to navigate to a different page (e.g. Books) **without** a full page reload (this exercises `navigation.instant`).
3. Scroll down on the new page and confirm the scroll-to-top/bottom buttons still appear.
4. Confirm the sidebar title still has its gradient fade beneath it.
5. Navigate to a second and third page the same way, confirming the buttons and fade persist every time — this is the regression this task fixes.

Stop the server with Ctrl+C when done.

- [ ] **Step 4: Commit**

```bash
git add docs/javascripts/sidebar-toggle.js
git commit -m "Refactor sidebar-toggle.js into idempotent init functions, fix instant-nav bug"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers spec section 2 (dependency pinning), Task 2 covers spec section 1 (content leak), Task 3 covers spec section 3 (JS refactor + bug fix). All three spec sections have a corresponding task.
- **No placeholders:** every step has literal file contents, exact commands, and exact expected output — no "add appropriate handling" or "similar to Task N" references.
- **Type/name consistency:** `initSidebarFade`, `initScrollButtons`, `fitKilnAscii`, `init`, and `debounce` are the only functions introduced, used consistently within Task 3's single file — no cross-task function references.
