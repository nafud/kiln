/* Keyboard navigation.

   Scrolling: T jumps to the top, D to the bottom, J/K scroll down/up a
   step, [ and ] to the previous/next h2 section on the page. Pages:
   < and > follow the previous/next page in nav order, via Material's
   footer links (the footer is display:none in extra.css but present in
   the DOM; navigation.footer is enabled solely for this), 0 goes home
   via the header logo, and 1-6 open the top-level categories in
   sidebar nav order. Clicking links, rather than assigning location,
   keeps navigation.instant in charge. Sidebars are hidden by default
   site-wide and disabled entirely on the homepage (extra.css); H
   reveals/re-hides both elsewhere (a body class, desktop-only and
   surviving instant navigation since Material never touches body).
   M cycles the color palette by advancing Material's __palette radio
   group (dark and light; the theme's own toggle button is hidden by
   extra.css). ? toggles a help panel listing the bindings; Escape
   closes it.

   Material's P / N (prev/next page) bindings stay usable alongside
   these. Its search UI is hidden entirely: S belongs to the jump
   palette (quick-jump.js preempts Material's handler), and Material's
   two extra search keys, F and /, are swallowed by a capture-phase
   listener below so nothing can summon the hidden search form; both
   still type normally in inputs.

   Keys are ignored while typing (inputs, textareas, contenteditable)
   and in chords with Ctrl/Alt/Meta. Scrolling is smooth unless the
   user prefers reduced motion. The help panel lives on document.body,
   so it survives navigation.instant page changes. */

(function () {
  "use strict";

  const SCROLL_STEP_PX = 160;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Each row is [keys, description]; keys render as one chip each, so
     paired and ranged bindings share a line. "–" is a plain separator,
     not a chip. */
  const HELP_ROWS = [
    [["T", "D"], "top / bottom"],
    [["J", "K"], "scroll down / up"],
    [["[", "]"], "previous / next heading"],
    [["<", ">"], "previous / next page"],
    [["0"], "home"],
    [["1", "–", "6"], "categories"],
    [["S", "`"], "search"],
    [["H"], "sidebars"],
    [["M"], "light / dark"],
    [["?"], "this help"],
  ];

  function scrollBehavior() {
    return reducedMotion.matches ? "auto" : "smooth";
  }

  function followPageLink(direction) {
    const link = document.querySelector(".md-footer__link--" + direction);
    if (link) link.click();
  }

  function goHome() {
    const logo = document.querySelector(".md-header a.md-logo");
    if (logo) logo.click();
  }

  /* Opens the nth top-level section (1-based, sidebar nav order). The
     item's link is a plain <a> when collapsed and an <a> inside the
     index-link container when the section is expanded; either way the
     first descendant a.md-nav__link is the section landing page. */
  function goToSection(n) {
    const items = document.querySelectorAll(
      ".md-nav--primary > .md-nav__list > .md-nav__item"
    );
    const item = items[n - 1];
    const link = item && item.querySelector("a.md-nav__link");
    if (link) link.click();
  }

  /* Scrolls to the previous (direction -1) or next (+1) h2 section.
     The anchor line sits just below the sticky header; next is the
     first heading below it, previous the last heading above it, with a
     small tolerance so the heading currently at the anchor line is not
     re-selected. */
  function jumpToHeading(direction) {
    const headings = document.querySelectorAll(".md-content h2");
    if (!headings.length) return;

    const header = document.querySelector(".md-header");
    const offset = (header ? header.offsetHeight : 0) + 16;
    const tolerance = 4;
    let target = null;
    for (let i = 0; i < headings.length; i++) {
      const top = headings[i].getBoundingClientRect().top;
      if (direction > 0) {
        if (top > offset + tolerance) {
          target = headings[i];
          break;
        }
      } else if (top < offset - tolerance) {
        target = headings[i]; /* keep the last one above the anchor */
      }
    }
    if (!target) return;
    window.scrollTo({
      top: window.scrollY + target.getBoundingClientRect().top - offset,
      behavior: scrollBehavior(),
    });
  }

  /* Advances Material's palette radio group (dark, light in mkdocs.yml
     order) — clicking the next input is what the theme's own toggle
     button did before extra.css hid it; the radios still render because
     the palette entries keep their toggle blocks. */
  function cyclePalette() {
    const inputs = document.querySelectorAll('input[name="__palette"]');
    if (!inputs.length) return;
    let checked = 0;
    for (let i = 0; i < inputs.length; i++) {
      if (inputs[i].checked) checked = i;
    }
    inputs[(checked + 1) % inputs.length].click();
  }

  function ensureHelpPanel() {
    let panel = document.querySelector(".key-help");
    if (panel) return panel;

    panel = document.createElement("div");
    panel.className = "key-help";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Keyboard shortcuts");
    const escapeHtml = function (s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };
    const rows = HELP_ROWS.map(function (row) {
      const keys = row[0]
        .map(function (token) {
          return token === "–"
            ? '<span class="key-help-sep">–</span>'
            : "<kbd>" + escapeHtml(token) + "</kbd>";
        })
        .join("");
      return (
        '<div class="key-help-row"><span class="key-help-keys">' +
        keys +
        "</span><span>" +
        row[1] +
        "</span></div>"
      );
    });
    panel.innerHTML = rows.join("");
    document.body.appendChild(panel);
    return panel;
  }

  /* force: true opens, false closes, undefined toggles. */
  function toggleHelpPanel(force) {
    const panel = ensureHelpPanel();
    panel.classList.toggle("key-help--open", force);
  }

  /* Material also focuses its (hidden) search on F and /. This
     capture-phase listener runs before Material's own handler and
     swallows the two keys outside typing contexts (inside an input
     the guard lets them through, so they still type); S is handled
     the same way in quick-jump.js, where it opens the palette. The
     browser default is left alone. */
  window.addEventListener(
    "keydown",
    function (event) {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (KilnUtils.isTypingTarget(event.target)) return;
      if (event.key === "/" || event.key === "f" || event.key === "F") {
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener("keydown", function (event) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (KilnUtils.isTypingTarget(event.target)) return;

    switch (event.key) {
      case "t":
      case "T":
        window.scrollTo({ top: 0, behavior: scrollBehavior() });
        break;
      case "d":
      case "D":
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: scrollBehavior(),
        });
        break;
      case "j":
      case "J":
        window.scrollBy({ top: SCROLL_STEP_PX, behavior: scrollBehavior() });
        break;
      case "k":
      case "K":
        window.scrollBy({ top: -SCROLL_STEP_PX, behavior: scrollBehavior() });
        break;
      case "h":
      case "H":
        document.body.classList.toggle("kiln-sidebars-shown");
        break;
      case "[":
        jumpToHeading(-1);
        break;
      case "]":
        jumpToHeading(1);
        break;
      case "<":
        followPageLink("prev");
        break;
      case ">":
        followPageLink("next");
        break;
      case "0":
        goHome();
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
        goToSection(Number(event.key));
        break;
      case "m":
      case "M":
        cyclePalette();
        break;
      case "?":
        toggleHelpPanel();
        break;
      case "Escape": {
        /* Close-only (never creates the panel); quick-jump.js owns
           Escape inside its own inputs. */
        const panel = document.querySelector(".key-help");
        if (panel) panel.classList.remove("key-help--open");
        return;
      }
      default:
        return;
    }
    event.preventDefault();
  });
})();
