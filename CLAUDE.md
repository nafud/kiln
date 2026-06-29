# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Kiln is a static documentation site (MkDocs + Material theme) for reverse engineering and systems programming notes, deployed to GitHub Pages at https://skllcrshrs.github.io/kiln/.

## Commands

```bash
pip install mkdocs mkdocs-material   # install dependencies
mkdocs serve                         # local dev server at http://127.0.0.1:8000
mkdocs build                         # build static site into site/
```

Deployment is automatic: pushing to `main` triggers the GitHub Actions workflow at [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which builds and deploys to GitHub Pages.

## Structure

- [mkdocs.yml](mkdocs.yml) — site config, theme, nav, and plugin settings. The `nav:` section must be updated manually when adding new pages or sections.
- [docs/](docs/) — all content lives here as Markdown files. Each section has an `index.md` that serves as its landing page.
- [docs/stylesheets/extra.css](docs/stylesheets/extra.css) — custom styles (JetBrains Mono font, card grid on home page, sidebar, scroll buttons).
- [docs/javascripts/sidebar-toggle.js](docs/javascripts/sidebar-toggle.js) — ASCII art auto-fit, scroll-to-top/bottom buttons.

## Content sections

| Nav label | Directory | Topic |
|-----------|-----------|-------|
| Books | `docs/books/` | Reverse engineering and systems programming books |
| Tools | `docs/tools/` | Tooling notes and cheatsheets |
| Courses | `docs/courses/` | Digital forensics investigation notes |
| Writeups | `docs/writeups/` | Crackme writeup solutions |

## Markdown extensions in use

- `admonition` + `pymdownx.details` — `!!! note`, `??? tip` collapsible blocks
- `pymdownx.superfences` — fenced code blocks with language highlighting
- `pymdownx.highlight` + `pymdownx.inlinehilite` — syntax highlighting

## Adding content

To add a new top-level section:
1. Create `docs/<section>/index.md`
2. Add the section to `nav:` in [mkdocs.yml](mkdocs.yml)

To add a new page within an existing section (e.g., `docs/books/modern-x86/chapter-03.md`):
1. Create the file
2. Add it under the section in `nav:` in [mkdocs.yml](mkdocs.yml)

## Custom CSS note

Use the `.ascii-diagram` class on `<pre>` blocks for borderless, transparent ASCII diagrams:
```html
<pre class="ascii-diagram">
  +------+
  | box  |
  +------+
</pre>
```
