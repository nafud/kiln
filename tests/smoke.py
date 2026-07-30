"""Browser smoke test for the site's custom JS layer.

Runs against the built site (mkdocs build first) in headless Chromium
and exercises what the build-check canaries cannot: the jump palette
(search, grep, commands), the key bindings, the hlsearch motions, the
ASCII logo, the header nav and statusline, the widgets, the
self-hosted fonts, and the no-JS fallbacks. CI runs it after the
strict build (build-check.yml); locally:

    pip install -r requirements-dev.txt
    playwright install chromium        # once
    mkdocs build --strict
    python tests/smoke.py

KILN_CHROMIUM overrides the browser executable (for environments with
a pre-installed Chromium instead of Playwright's download).

Every step runs even after a failure, so one run reports everything;
the exit code is the number of failed steps.
"""

import contextlib
import http.server
import os
import sys
import threading

from playwright.sync_api import sync_playwright

SITE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site")
PORT = 8459
BASE = f"http://127.0.0.1:{PORT}"

failures = []
page_errors = []


@contextlib.contextmanager
def step(name):
    try:
        yield
        print(f"ok   {name}")
    except Exception as error:  # noqa: BLE001 - report and continue
        failures.append(name)
        print(f"FAIL {name}: {error}")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE, **kwargs)

    def log_message(self, *args):
        pass  # keep the test output to the step lines


def serve():
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), QuietHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def launch(p):
    executable = os.environ.get("KILN_CHROMIUM")
    return p.chromium.launch(executable_path=executable) if executable else p.chromium.launch()


def overlay_text(page):
    return page.eval_on_selector(".kiln-jump--overlay .kiln-jump-results", "el => el.textContent")


def open_overlay(page, query):
    page.keyboard.press("`")
    page.wait_for_selector(".kiln-jump--overlay.kiln-jump--open")
    page.locator(".kiln-jump--overlay .kiln-jump-input").fill(query)
    page.wait_for_timeout(120)


def close_overlay(page):
    page.keyboard.press("Escape")
    page.wait_for_timeout(60)


def run(page):
    chapter = f"{BASE}/books/csapp/csapp-chapter-03/"

    with step("homepage: logo generates, inline bar mounts"):
        page.goto(BASE + "/")
        page.wait_for_selector("pre.kiln-ascii.kiln-ascii--generated", timeout=10000)
        text = page.eval_on_selector("pre.kiln-ascii", "el => el.textContent")
        assert len(text.split("\n")) > 5, "logo did not generate a grid"
        page.wait_for_selector(".kiln-jump--inline .kiln-jump-input")
        cards = page.eval_on_selector(".home-grid", "el => getComputedStyle(el).display")
        assert cards == "none", "fallback cards visible with JS on"

    with step("fonts: self-hosted JetBrains Mono, no Google origins"):
        loaded = page.evaluate(
            """() => { let ok = false; document.fonts.forEach(f => {
                 if (f.family.replace(/['\"]/g,'') === 'JetBrains Mono'
                     && f.status === 'loaded') ok = true; }); return ok; }"""
        )
        assert loaded, "JetBrains Mono face not loaded"

    with step("palette: title search finds a chapter"):
        page.goto(chapter.replace("csapp/csapp-chapter-03/", "index.html"))
        open_overlay(page, "csapp 3")
        page.wait_for_selector(".kiln-jump--overlay .kiln-jump-result")
        assert "Chapter 3" in overlay_text(page)
        status = page.eval_on_selector(".kiln-jump--overlay .kiln-jump-status", "el => el.textContent")
        assert status.endswith("results") or status.endswith("result")
        close_overlay(page)

    with step("palette: commands (:h, :x, :toc, :version, E492)"):
        page.goto(chapter)
        for query, expected in [
            (":h", "[ COMMANDS ]"),
            (":x 0x10+2", "hex  0x12"),
            (":x 0d16+2", "hex  0x12"),
            (":x -w16 -5", "s16   -5"),
            (":x -w16 -5", "hex   0xfffb"),
            (":x -w8 300", "does not fit in 8 bits"),
            (":x -w7 1", "E475: Invalid argument: -w7"),
            (":x 1 <<< 2", "E15: Invalid expression"),
            (":version", "local build"),
            (":nosuch", "E492: Not an editor command: nosuch"),
            (":themes", "E492: Not an editor command: themes"),
        ]:
            open_overlay(page, query)
            assert expected in overlay_text(page), f"{query} missing {expected!r}"
            close_overlay(page)
        # Errors are message rows: E492 must render through the same
        # row-metric element as "no matches", never the output pre.
        open_overlay(page, ":nosuch")
        err_fs = page.eval_on_selector(
            ".kiln-jump--overlay .kiln-jump-empty", "el => getComputedStyle(el).fontSize"
        )
        close_overlay(page)
        open_overlay(page, "csapp")
        page.wait_for_selector(".kiln-jump--overlay .kiln-jump-result-title")
        row_fs = page.eval_on_selector(
            ".kiln-jump--overlay .kiln-jump-result-title", "el => getComputedStyle(el).fontSize"
        )
        assert err_fs == row_fs, f"error row {err_fs} != result row {row_fs}"
        close_overlay(page)
        open_overlay(page, ":toc")
        page.wait_for_selector(".kiln-jump--overlay .kiln-jump-result")
        assert "3.5.4 Discussion" in overlay_text(page)
        close_overlay(page)

    with step("palette: :theme lists themes, applies them, t cycles pairs"):
        page.goto(chapter)
        open_overlay(page, ":theme")
        page.wait_for_selector(".kiln-jump--overlay .kiln-jump-result")
        text = overlay_text(page)
        # The current theme carries the * marker; the rows come from
        # the __palette radios, so this also guards mkdocs.yml.
        for name in [
            "light *", "dark", "tokyo day", "tokyo night", "catppuccin latte",
            "phosphor", "terminal", "nord", "vesper",
        ]:
            assert name in text, f"theme row {name!r} missing: {text!r}"
        page.keyboard.press("ArrowDown")
        page.keyboard.press("ArrowDown")
        page.keyboard.press("Enter")
        page.wait_for_timeout(200)
        scheme = page.evaluate("() => document.body.getAttribute('data-md-color-scheme')")
        assert scheme == "tokyo-day", f"tokyo day not applied: {scheme!r}"
        assert not page.evaluate(
            "() => document.querySelector('.kiln-jump--overlay').classList.contains('kiln-jump--open')"
        ), "prompt not dismissed after applying a theme"
        # The chapter prose must resolve the theme's ink, proving the
        # token block and scheme stamp connect end to end.
        ink = page.eval_on_selector(
            ".md-typeset h1", "el => getComputedStyle(el).color"
        )
        assert ink == "rgb(55, 96, 191)", f"tokyo day ink not applied: {ink!r}"
        # t steps to the next theme: tokyo night, a slate-based pair —
        # this is what breaks if cyclePalette matches scheme alone.
        page.keyboard.press("t")
        page.wait_for_timeout(200)
        pair = page.evaluate(
            "() => [document.body.getAttribute('data-md-color-scheme'),"
            " document.body.getAttribute('data-md-color-primary')]"
        )
        assert pair == ["slate", "tokyo-night"], f"t did not reach tokyo night: {pair}"
        ink = page.eval_on_selector(".md-typeset h1", "el => getComputedStyle(el).color")
        assert ink == "rgb(192, 202, 245)", f"tokyo night ink not applied: {ink!r}"
        # The list stars the slate-based pair correctly.
        open_overlay(page, ":theme")
        page.wait_for_selector(".kiln-jump--overlay .kiln-jump-result")
        assert "tokyo night *" in overlay_text(page), "pair not starred in :theme"
        # phosphor is the second slate-based pair; its ink must win
        # over the base slate block.
        for _ in range(5):
            page.keyboard.press("ArrowDown")
        page.keyboard.press("Enter")
        page.wait_for_timeout(200)
        pair = page.evaluate(
            "() => [document.body.getAttribute('data-md-color-scheme'),"
            " document.body.getAttribute('data-md-color-primary')]"
        )
        assert pair == ["slate", "phosphor"], f"phosphor not applied: {pair}"
        ink = page.eval_on_selector(".md-typeset h1", "el => getComputedStyle(el).color")
        assert ink == "rgb(51, 255, 51)", f"phosphor ink not applied: {ink!r}"
        # Restore the default theme for the steps that follow.
        open_overlay(page, ":theme")
        page.wait_for_selector(".kiln-jump--overlay .kiln-jump-result")
        page.keyboard.press("Enter")
        page.wait_for_timeout(200)
        scheme = page.evaluate("() => document.body.getAttribute('data-md-color-scheme')")
        assert scheme == "default", f"light not restored: {scheme!r}"

    with step("inline bar: theme apply and outside click reset it"):
        page.goto(BASE + "/")
        page.wait_for_selector(".kiln-jump--inline .kiln-jump-input")
        page.locator(".kiln-jump--inline .kiln-jump-input").fill(":theme")
        page.wait_for_timeout(200)
        page.keyboard.press("Enter")  # applies the selected (current) theme
        page.wait_for_timeout(200)
        val = page.eval_on_selector(".kiln-jump--inline .kiln-jump-input", "el => el.value")
        rows = page.eval_on_selector_all(
            ".kiln-jump--inline .kiln-jump-result", "els => els.length"
        )
        assert val == "" and rows == 0, (
            f"inline bar did not reset after a theme apply: {val!r}, {rows} rows"
        )
        page.locator(".kiln-jump--inline .kiln-jump-input").fill("csapp")
        page.wait_for_timeout(200)
        page.mouse.click(40, 400)  # blank space left of the content column
        page.wait_for_timeout(100)
        val = page.eval_on_selector(".kiln-jump--inline .kiln-jump-input", "el => el.value")
        rows = page.eval_on_selector_all(
            ".kiln-jump--inline .kiln-jump-result", "els => els.length"
        )
        assert val == "" and rows == 0, (
            f"outside click did not reset the inline bar: {val!r}, {rows} rows"
        )

    with step("grep + hlsearch: / arms highlights, n cycles, Escape clears"):
        page.goto(f"{BASE}/books/index.html")
        open_overlay(page, "/register")
        page.wait_for_selector(".kiln-jump--overlay .kiln-jump-result")
        page.keyboard.press("Enter")
        page.wait_for_load_state()
        page.wait_for_timeout(400)
        matches = page.evaluate("() => CSS.highlights.get('kiln-search')?.size || 0")
        assert matches > 0, "no highlights on landing page"
        page.keyboard.press("n")
        page.wait_for_timeout(400)
        assert page.evaluate("() => CSS.highlights.has('kiln-search-current')")
        page.keyboard.press("Escape")
        page.wait_for_timeout(100)
        assert page.evaluate("() => !CSS.highlights.has('kiln-search')")
        path = page.evaluate("() => location.pathname")
        page.keyboard.press("n")
        page.keyboard.press("p")
        page.wait_for_timeout(400)
        assert page.evaluate("() => location.pathname") == path, "n/p navigated"

    with step("keys: ] G gg scroll, t theme, s dead"):
        page.goto(chapter)
        page.wait_for_timeout(300)
        page.keyboard.press("]")
        page.wait_for_timeout(400)
        assert page.evaluate("() => window.scrollY") > 0, "] did not scroll"
        page.keyboard.press("G")
        page.wait_for_timeout(700)
        y_bottom = page.evaluate("() => window.scrollY")
        page.keyboard.press("g")
        page.keyboard.press("g")
        page.wait_for_timeout(700)
        assert page.evaluate("() => window.scrollY") < y_bottom, "gg did not return"
        scheme = page.evaluate("() => document.body.getAttribute('data-md-color-scheme')")
        page.keyboard.press("t")
        page.wait_for_timeout(200)
        assert page.evaluate("() => document.body.getAttribute('data-md-color-scheme')") != scheme
        page.keyboard.press("t")
        # There are no sidebars; s is a neutralized dead key — it must
        # neither focus Material's hidden search nor mark up body.
        page.keyboard.press("s")
        page.wait_for_timeout(100)
        assert page.evaluate("() => document.activeElement === document.body"), (
            "s moved focus (hidden search summoned?)"
        )
        assert page.evaluate("() => document.body.className.indexOf('kiln-') === -1"), (
            "s toggled a body class"
        )

    with step("chrome: header nav and statusline"):
        page.goto(chapter)
        page.wait_for_timeout(400)
        labels = page.eval_on_selector_all(
            ".kiln-header__nav .kiln-header__link", "els => els.map(e => e.textContent)"
        )
        assert labels == [
            "guides", "links", "books", "bookmarks", "courses", "writeups",
        ], f"header nav changed: {labels}"
        active = page.eval_on_selector_all(
            ".kiln-header__link--active", "els => els.map(e => e.textContent)"
        )
        assert active == ["books"], f"active nav item wrong: {active}"
        path = page.eval_on_selector(".kiln-status__path", "el => el.textContent")
        assert path == "~/books/csapp/csapp-chapter-03", f"statusline path: {path!r}"
        pos = page.eval_on_selector(".kiln-status__pos", "el => el.textContent")
        assert pos == "Top", f"statusline pos: {pos!r}"
        page.keyboard.press("G")
        # The scroll is smooth (key-nav.js), so poll for the settled
        # readout instead of guessing at the animation's duration.
        page.wait_for_function(
            "() => document.querySelector('.kiln-status__pos').textContent === '100%'",
            timeout=5000,
        )
        # 1 opens the first section (the nav lists exactly the six
        # sections; home belongs to 0 via the logo).
        page.keyboard.press("1")
        page.wait_for_timeout(500)
        landed = page.evaluate("() => location.pathname")
        assert landed.endswith("/guides/"), f"1 did not open guides: {landed}"
        # < and > step between the six sections along the header nav,
        # wrapping at the ends.
        page.keyboard.press(">")
        page.wait_for_timeout(500)
        landed = page.evaluate("() => location.pathname")
        assert landed.endswith("/links/"), f"> did not step to links: {landed}"
        page.keyboard.press("<")
        page.wait_for_timeout(500)
        landed = page.evaluate("() => location.pathname")
        assert landed.endswith("/guides/"), f"< did not step back to guides: {landed}"
        page.keyboard.press("<")
        page.wait_for_timeout(500)
        landed = page.evaluate("() => location.pathname")
        assert landed.endswith("/writeups/"), f"< did not wrap to writeups: {landed}"

    with step("widgets: keygen serial and two's-complement readout"):
        page.goto(f"{BASE}/writeups/crackmes-one/crackmes-one-cfb1/")
        page.wait_for_selector(".kiln-widget[data-widget='cfb1-keygen'] .kiln-term-out")
        out = page.eval_on_selector(
            ".kiln-widget[data-widget='cfb1-keygen'] .kiln-term-out", "el => el.textContent"
        )
        assert out == "crackme 4C3C5051484518", f"keygen output changed: {out!r}"
        page.goto(chapter)
        page.wait_for_selector(".kiln-widget[data-widget='twos-complement'] .kiln-term-out")
        out = page.eval_on_selector(
            ".kiln-widget[data-widget='twos-complement'] .kiln-term-out", "el => el.textContent"
        )
        assert "1111 1111 1111 0000" in out and "s16   -16" in out, f"readout changed: {out!r}"

    with step("palette typography is context-independent"):
        # The palette mounts inside .md-typeset (homepage bar) and on
        # document.body (overlay); every element must compute identical
        # type metrics in both, or context-dependent sizing bugs (the
        # E492 class) creep back.
        probe = """(scope) => {
          const sel = [".kiln-jump-prompt", ".kiln-jump-cursor",
                       ".kiln-jump-input", ".kiln-jump-result-title",
                       ".kiln-jump-empty", ".kiln-jump-help pre"];
          const out = {};
          for (const s of sel) {
            const el = document.querySelector(scope + " " + s);
            if (!el) continue;
            const c = getComputedStyle(el);
            out[s] = c.fontSize + "/" + c.lineHeight + "/" + c.fontFamily;
          }
          return out;
        }"""

        def sample(scope, fill):
            metrics = {}
            for query in fill:
                page.locator(scope + " .kiln-jump-input").fill(query)
                page.wait_for_timeout(150)
                metrics.update(page.evaluate(probe, scope))
            return metrics

        states = ["csapp", ":nosuch", ":h"]
        page.goto(f"{BASE}/books/index.html")
        page.keyboard.press("`")
        page.wait_for_selector(".kiln-jump--overlay.kiln-jump--open")
        overlay = sample(".kiln-jump--overlay", states)
        close_overlay(page)
        page.goto(BASE + "/")
        page.wait_for_selector(".kiln-jump--inline .kiln-jump-input")
        inline = sample(".kiln-jump--inline", states)
        for key in sorted(set(overlay) & set(inline)):
            assert overlay[key] == inline[key], (
                f"{key}: overlay {overlay[key]} != inline {inline[key]}"
            )
        assert len(set(overlay) & set(inline)) >= 5, "probe lost elements"

    with step("no console errors anywhere above"):
        assert not page_errors, page_errors


def run_no_js(browser):
    with step("no-JS: fallback cards and logo title render"):
        context = browser.new_context(java_script_enabled=False)
        page = context.new_page()
        page.goto(BASE + "/")
        cards = page.eval_on_selector(".home-grid", "el => getComputedStyle(el).display")
        logo = page.eval_on_selector(
            "pre.kiln-ascii", "el => ({op: getComputedStyle(el).opacity, text: el.textContent})"
        )
        assert cards != "none", "cards hidden without JS"
        assert logo["op"] == "1" and logo["text"] == "Kiln", "logo title hidden without JS"
        links = page.eval_on_selector_all(
            ".kiln-header__nav .kiln-header__link", "els => els.length"
        )
        assert links == 6, "header nav missing without JS"
        context.close()


def main():
    if not os.path.isdir(SITE):
        print("site/ not found — run `mkdocs build --strict` first", file=sys.stderr)
        return 2
    server = serve()
    external = []
    try:
        with sync_playwright() as p:
            browser = launch(p)
            page = browser.new_page()
            page.on("pageerror", lambda e: page_errors.append(str(e)))
            page.on(
                "request",
                lambda r: external.append(r.url) if "127.0.0.1" not in r.url else None,
            )
            run(page)
            with step("self-contained: no font/CDN origins contacted"):
                fonts = [u for u in external if "fonts.g" in u]
                assert not fonts, fonts
            run_no_js(browser)
            browser.close()
    finally:
        server.shutdown()
    print(f"\n{len(failures)} failed" if failures else "\nall smoke checks passed")
    return len(failures)


if __name__ == "__main__":
    sys.exit(main())
