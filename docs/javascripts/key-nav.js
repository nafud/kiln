/* Keyboard navigation and scroll discipline.

   The viewport behaves like a terminal running vim: nothing ever
   animates — every motion is an instant repaint, and all scrolling is
   quantized to whole text lines, so content appears and disappears in
   place instead of sliding. The wheel listener below extends the same
   discipline to the mouse.

   Motions, case-accurate vim: gg (a two-tap chord) jumps to the top,
   G to the bottom, lowercase j/k move one line down/up (uppercase
   J/K deliberately do nothing — vim gives them unrelated meanings),
   d/u half a page down/up (vim's Ctrl-d/Ctrl-u minus the modifier,
   which belongs to the browser), Space / Shift+Space a full page,
   [ and ] the previous/next h2 section. Pages: < and > follow the
   previous/next page in nav order, via Material's footer links (the
   footer is display:none in extra.css but present in the DOM;
   navigation.footer is enabled solely for this), 0 goes home via the
   header logo, and 1-6 open the top-level categories by clicking the
   header nav links (overrides/partials/header.html). Clicking links,
   rather than assigning location, keeps navigation.instant in
   charge. The letter bindings are all strictly lowercase. s toggles
   the right toc pane (kiln-toc-shown on body, desktop-only in
   extra.css; the left sidebar is gone entirely — the header nav
   replaced it). t cycles the color palette by advancing Material's
   __palette radio group. There is no help binding: help is the
   palette's :h/:help usage output (quick-jump.js, which also owns
   the binding table those commands print — keep it in sync when
   bindings here change).

   Material's search UI is hidden entirely, and its search keys —
   s/S, F and / — are neutralized by a capture-phase listener below
   so nothing can summon the hidden search form: lowercase s performs
   the toc toggle from there, the rest are dead keys, and the jump
   palette is backtick's alone (quick-jump.js). Material's p/n page
   keys are neutralized the same way: < and > are the page motions
   here, n/N belong to the palette's /search as vim's search-repeat
   motions (quick-jump.js owns them and registers earlier, so it wins
   the capture race while a search is armed), and p/P are plain dead
   keys (vim means paste by them). All of them still type normally in
   inputs.

   Keys are ignored while typing (inputs, textareas, contenteditable)
   and in chords with Ctrl/Alt/Meta. Listeners attach once at load;
   nothing here needs re-initialization across navigation.instant
   changes. */

(function () {
  "use strict";

  /* Window for the second g of the gg chord (vim's timeoutlen idea). */
  const GG_CHORD_MS = 600;

  /* Wheel notches translate to this many lines, the terminal default. */
  const WHEEL_LINES = 3;

  /* Lines of overlap a full-page motion keeps for continuity (vim's
     Ctrl-f leaves two). */
  const PAGE_OVERLAP_LINES = 2;

  /* One text line in pixels — the content's line height, which every
     motion is a multiple of. Cached per full load; the metric is a
     stylesheet constant, not per-page state. */
  let lineHeightPx = 0;
  function lineHeight() {
    if (!lineHeightPx) {
      const content = document.querySelector(".md-typeset") || document.body;
      lineHeightPx = parseFloat(getComputedStyle(content).lineHeight) || 24;
    }
    return lineHeightPx;
  }

  /* The viewport's capacity in whole lines, minus the overlap. */
  function pageLines() {
    const chrome = 2 * 32; /* frame chrome above and below the content */
    const usable = Math.max(window.innerHeight - chrome, lineHeight());
    return Math.max(
      1,
      Math.floor(usable / lineHeight()) - PAGE_OVERLAP_LINES
    );
  }

  function scrollLines(count) {
    window.scrollBy(0, count * lineHeight());
  }

  function followPageLink(direction) {
    const link = document.querySelector(".md-footer__link--" + direction);
    if (link) link.click();
  }

  function goHome() {
    const logo = document.querySelector(".md-header a.md-logo");
    if (logo) logo.click();
  }

  /* Opens the nth top-level section (1-based) by clicking its header
     nav link; index 0 is home, owned by the 0 key via the logo. */
  function goToSection(n) {
    const links = document.querySelectorAll(
      ".kiln-header__nav .kiln-header__link"
    );
    const link = links[n];
    if (link) link.click();
  }

  /* Jumps to the previous (direction -1) or next (+1) h2 section.
     The anchor line sits just below the top chrome; next is the first
     heading below it, previous the last heading above it, with a
     small tolerance so the heading currently at the anchor line is
     not re-selected. */
  function jumpToHeading(direction) {
    const headings = document.querySelectorAll(".md-content h2");
    if (!headings.length) return;

    const offset = 48;
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
    window.scrollTo(
      0,
      window.scrollY + target.getBoundingClientRect().top - offset
    );
  }

  /* Advances Material's palette radio group (light, dark in mkdocs.yml
     order) — clicking the next input is what the theme's own toggle
     button did before extra.css hid it; the radios still render because
     the palette entries keep their toggle blocks. The current index is
     read from the scheme actually applied to <body>, not from a checked
     radio: on a fresh visit Material stamps the default scheme on body
     but leaves every radio unchecked, so seeding from `.checked` would
     misjudge the current palette and the first press could land on the
     scheme already showing (the dead-first-press the t key used to
     have). */
  function cyclePalette() {
    const inputs = document.querySelectorAll('input[name="__palette"]');
    if (!inputs.length) return;
    const current = document.body.getAttribute("data-md-color-scheme");
    let index = 0;
    for (let i = 0; i < inputs.length; i++) {
      if (inputs[i].getAttribute("data-md-color-scheme") === current) {
        index = i;
        break;
      }
    }
    inputs[(index + 1) % inputs.length].click();
  }

  function toggleToc() {
    document.body.classList.toggle("kiln-toc-shown");
  }

  /* True when a wheel gesture over this target belongs to an inner
     scroll container (palette results, the toc pane, a code block's
     horizontal overflow) rather than the document. Vertical wheel
     motion claims any vertically scrollable ancestor; horizontal
     containers only claim a gesture that is itself horizontal. */
  function inInnerScroller(target, deltaX, deltaY) {
    let el = target instanceof Element ? target : null;
    const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
    while (el && el !== document.body && el !== document.documentElement) {
      const style = getComputedStyle(el);
      if (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + 1
      ) {
        return true;
      }
      if (
        horizontal &&
        (style.overflowX === "auto" || style.overflowX === "scroll") &&
        el.scrollWidth > el.clientWidth + 1
      ) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  /* Wheel quantizer: deltas accumulate and the document jumps
     WHEEL_LINES at a time, instantly — a notch repaints the text in
     place, a trackpad glide becomes discrete steps. Ctrl+wheel stays
     the browser's zoom; gestures over inner scrollers stay native. */
  let wheelAccumulator = 0;
  window.addEventListener(
    "wheel",
    function (event) {
      if (event.ctrlKey) return;
      if (event.defaultPrevented) return;
      if (inInnerScroller(event.target, event.deltaX, event.deltaY)) return;
      event.preventDefault();
      const lh = lineHeight();
      const scale = event.deltaMode === 1 ? lh : event.deltaMode === 2 ? window.innerHeight : 1;
      wheelAccumulator += event.deltaY * scale;
      const step = WHEEL_LINES * lh;
      while (Math.abs(wheelAccumulator) >= step) {
        const sign = wheelAccumulator > 0 ? 1 : -1;
        scrollLines(sign * WHEEL_LINES);
        wheelAccumulator -= sign * step;
      }
    },
    { passive: false }
  );

  /* Material also binds keys of its own: S, F and / focus its
     (hidden) search, p and n switch pages. This capture-phase
     listener runs before Material's own handler and neutralizes all
     of them outside typing contexts (inside an input the guard lets
     them through, so they still type). Lowercase s carries the toc
     toggle and must act from here: Material's bubble-phase handler
     registered first, so a bubble-phase binding of ours would lose
     the race — the palette stays backtick's alone (quick-jump.js).
     n/N reach this swallow only while no /search is armed:
     quick-jump.js's capture listener registered earlier and claims
     them (search-repeat motions) with stopImmediatePropagation when
     one is. The rest are plain dead keys, and the browser default is
     left alone. */
  window.addEventListener(
    "keydown",
    function (event) {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (KilnUtils.isTypingTarget(event.target)) return;
      if (event.key === "s") {
        toggleToc();
        event.preventDefault();
        event.stopImmediatePropagation();
      } else if (
        event.key === "S" ||
        event.key === "/" ||
        event.key === "f" ||
        event.key === "F" ||
        event.key === "n" ||
        event.key === "N" ||
        event.key === "p" ||
        event.key === "P"
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

    /* Any key other than g cancels a pending gg chord, as in vim —
       g j g must not read as gg. */
    if (event.key !== "g") lastGAt = 0;

    switch (event.key) {
      case "g": {
        const now = performance.now();
        if (now - lastGAt < GG_CHORD_MS) {
          lastGAt = 0;
          window.scrollTo(0, 0);
        } else {
          lastGAt = now;
        }
        break;
      }
      case "G":
        window.scrollTo(0, document.documentElement.scrollHeight);
        break;
      case "j":
      case "ArrowDown":
        scrollLines(1);
        break;
      case "k":
      case "ArrowUp":
        scrollLines(-1);
        break;
      case "d":
        scrollLines(Math.ceil(pageLines() / 2));
        break;
      case "u":
        scrollLines(-Math.ceil(pageLines() / 2));
        break;
      case " ":
      case "PageDown":
        scrollLines(event.shiftKey ? -pageLines() : pageLines());
        break;
      case "PageUp":
        scrollLines(-pageLines());
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
      default:
        return;
    }
    event.preventDefault();
  });
})();
