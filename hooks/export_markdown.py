"""MkDocs hook: publish each page's Markdown source alongside its HTML.

Every docs/**/*.md is copied into the built site at the page's URL plus
"index.md" (mirroring the use_directory_urls layout), e.g.:

    docs/books/re4b/index.md            -> site/books/re4b/index.md
    docs/books/modern-x86/chapter-01.md -> site/books/modern-x86/chapter-01/index.md

The page-actions menu (docs/javascripts/page-actions.js) links to these for
"View as Markdown" and for the "Open in ChatGPT / Claude" prompts.
"""

import os
import shutil


def on_post_build(config):
    docs_dir = config["docs_dir"]
    site_dir = config["site_dir"]

    for root, _dirs, files in os.walk(docs_dir):
        for name in files:
            if not name.endswith(".md"):
                continue
            src = os.path.join(root, name)
            rel_base, _ = os.path.splitext(os.path.relpath(src, docs_dir))
            if os.path.basename(rel_base) == "index":
                dest_rel = os.path.join(os.path.dirname(rel_base), "index.md")
            else:
                dest_rel = os.path.join(rel_base, "index.md")
            dest = os.path.join(site_dir, dest_rel)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copyfile(src, dest)
