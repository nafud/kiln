# Kiln

[![Deploy MkDocs](https://github.com/skllcrshrs/kiln/actions/workflows/deploy.yml/badge.svg)](https://github.com/skllcrshrs/kiln/actions/workflows/deploy.yml)

A reverse engineering and systems programming knowledge base — book notes,
tooling cheatsheets, digital forensics course notes, and crackme writeups.

**Live site:** https://skllcrshrs.github.io/kiln/

## Sections

| Section  | Contents                                            |
|----------|-----------------------------------------------------|
| Books    | Reverse engineering and systems programming books   |
| Tools    | Tooling notes and cheatsheets                        |
| Courses  | Digital forensics investigation notes                |
| Writeups | Crackme writeup solutions                            |

## Local development

Built with [MkDocs](https://www.mkdocs.org/) and
[Material for MkDocs](https://squidfunk.github.io/mkdocs-material/).

```bash
# with uv
uv venv && uv pip install -r requirements.txt

# or with plain pip
pip install -r requirements.txt

mkdocs serve          # live dev server at http://127.0.0.1:8000/kiln/
mkdocs build --strict # production build into site/
```

## Branch workflow

- `secondary` — test branch; all changes land here first and are verified
  with a local `mkdocs serve`. Every push runs a strict build check in CI.
- `primary` — production; pushing here deploys to GitHub Pages via
  [deploy.yml](.github/workflows/deploy.yml).

## License

Code (JavaScript, CSS, configuration) is licensed under the
[MIT License](LICENSE). Site content under `docs/` (notes and writeups) is
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
