/* Keyboard navigation.

   Scrolling is the vim vocabulary, case-accurate: gg (a two-tap
   chord) jumps to the top, G to the bottom, lowercase j/k scroll
   down/up a step (uppercase J/K deliberately do nothing — vim gives
   them unrelated meanings), [ and ] to the previous/next h2 section
   on the page. Pages:
   < and > follow the previous/next page in nav order, via Material's
   footer links (the footer is display:none in extra.css but present in
   the DOM; navigation.footer is enabled solely for this), 0 goes home
   via the header logo, and 1-6 open the top-level categories in
   sidebar nav order. Clicking links, rather than assigning location,
   keeps navigation.instant in charge. The letter bindings are all
   strictly lowercase. Sidebars are hidden by default site-wide and
   disabled entirely on the homepage (extra.css); s reveals/re-hides
   both elsewhere (a body class, desktop-only and surviving instant
   navigation since Material never touches body). t cycles the color
   palette by advancing Material's __palette radio group (dark and
   light; the theme's own toggle button is hidden by extra.css). h
   toggles a help panel listing the bindings; Escape closes it. On the
   homepage (only), pointer movement fades in a bottom-right "Press h
   for Help" hint that fades back out when the pointer rests.

   Material's P / N (prev/next page) bindings stay usable alongside
   these. Its search UI is hidden entirely, and its search keys —
   s/S, F and / — are neutralized by a capture-phase listener below
   so nothing can summon the hidden search form: lowercase s performs
   the sidebar toggle from there, the rest are dead keys, and the
   jump palette is backtick's alone (quick-jump.js). All of them
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
     paired bindings share a line. */
  const HELP_ROWS = [
    [["gg", "G"], "Jump to Top/Bottom"],
    [["k", "j"], "Scroll Up/Down"],
    [["[", "]"], "Navigate Headings"],
    [["<", ">"], "Navigate Pages"],
    [["0"], "Home"],
    [["`"], "Search"],
    [["s"], "Toggle Sidebars"],
    [["t"], "Toggle Theme"],
    [["h"], "Keyboard Shortcuts"],
  ];

  /* Pointer-idle gap before the homepage help hint fades. */
  const HINT_IDLE_MS = 1200;

  /* Window for the second g of the gg chord (vim's timeoutlen idea). */
  const GG_CHORD_MS = 600;

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
          return "<kbd>" + escapeHtml(token) + "</kbd>";
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

  /* force: true opens, false closes, undefined toggles. An opening
     panel supersedes the homepage hint pointing at it. */
  function toggleHelpPanel(force) {
    const panel = ensureHelpPanel();
    panel.classList.toggle("key-help--open", force);
    if (panel.classList.contains("key-help--open")) {
      const hint = document.querySelector(".key-hint");
      if (hint) hint.classList.remove("key-hint--visible");
    }
  }

  function toggleSidebars() {
    document.body.classList.toggle("kiln-sidebars-shown");
  }

  /* Homepage-only hint at the help panel's own corner: fades in while
     the pointer moves and back out once it rests (same activity
     pattern as the scroll-progress chip, which is empty on the
     unscrollable homepage, so the corner is free). Never shown while
     the jump bar has focus — letter keys type into it there, so the
     hint would advertise a key that only inserts an "h" (clicking
     away, Escape or backtick blurs the bar and frees the keys).
     Attach-once on document.body; the homepage check runs per move
     because navigation.instant swaps the content out from under it. */
  function ensureHint() {
    let hint = document.querySelector(".key-hint");
    if (hint) return hint;
    hint = document.createElement("div");
    hint.className = "key-hint";
    hint.setAttribute("aria-hidden", "true");
    hint.innerHTML = "Press <kbd>h</kbd> for Help";
    document.body.appendChild(hint);
    return hint;
  }

  const restHint = KilnUtils.debounce(function () {
    const hint = document.querySelector(".key-hint");
    if (hint) hint.classList.remove("key-hint--visible");
  }, HINT_IDLE_MS);

  window.addEventListener("pointermove", function () {
    if (!document.querySelector(".md-content .kiln-ascii")) return;
    if (KilnUtils.isTypingTarget(document.activeElement)) return;
    const panel = document.querySelector(".key-help");
    if (panel && panel.classList.contains("key-help--open")) return;
    ensureHint().classList.add("key-hint--visible");
    restHint();
  });

  /* Material also focuses its (hidden) search on S, F and /. This
     capture-phase listener runs before Material's own handler and
     neutralizes all of them outside typing contexts (inside an input
     the guard lets them through, so they still type). Lowercase s
     carries the sidebar toggle and must act from here: Material's
     bubble-phase handler registered first, so a bubble-phase binding
     of ours would lose the race — the palette stays backtick's alone
     (quick-jump.js). Uppercase S, F and / are plain dead keys. The
     browser default is left alone. */
  window.addEventListener(
    "keydown",
    function (event) {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (KilnUtils.isTypingTarget(event.target)) return;
      if (event.key === "s") {
        toggleSidebars();
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (
        event.key === "S" ||
        event.key === "/" ||
        event.key === "f" ||
        event.key === "F"
      ) {
        event.stopImmediatePropagation();
      }
    },
    true
  );

  /* Timestamp of the pending first g of a gg chord. */
  let lastGAt = 0;

  window.addEventListener("keydown", function (event) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (KilnUtils.isTypingTarget(event.target)) return;

    /* The scroll motions are the vim keys, case-accurate: gg (a
       two-tap chord) and G jump, lowercase j/k step — their
       uppercase forms deliberately do nothing, as in vim they mean
       something else entirely. */
    switch (event.key) {
      case "g": {
        const now = performance.now();
        if (now - lastGAt < GG_CHORD_MS) {
          lastGAt = 0;
          window.scrollTo({ top: 0, behavior: scrollBehavior() });
        } else {
          lastGAt = now;
        }
        break;
      }
      case "G":
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: scrollBehavior(),
        });
        break;
      case "j":
        window.scrollBy({ top: SCROLL_STEP_PX, behavior: scrollBehavior() });
        break;
      case "k":
        window.scrollBy({ top: -SCROLL_STEP_PX, behavior: scrollBehavior() });
        break;
      case "h":
        toggleHelpPanel();
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
      case "t":
        cyclePalette();
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
