/* Keyboard navigation.

   Scrolling is the vim vocabulary, case-accurate: gg (a two-tap
   chord) jumps to the top, G to the bottom, lowercase j/k scroll
   down/up a step (uppercase J/K deliberately do nothing — vim gives
   them unrelated meanings), [ and ] to the previous/next h2 section
   on the page. Pages:
   < and > follow the previous/next page in nav order, via Material's
   footer links (the footer is display:none in extra.css but present in
   the DOM; navigation.footer is enabled solely for this), 0 goes home
   via the header logo, and 1-6 open the top-level categories by
   clicking the header nav links (overrides/partials/header.html).
   Clicking links, rather than assigning location, keeps
   navigation.instant in charge. The letter bindings are all strictly
   lowercase. t cycles the color theme by advancing Material's
   __palette radio group (mkdocs.yml order; the theme's own toggle
   button is hidden by extra.css, and the palette's :themes command
   lists the same radios by name). There are no sidebars to toggle —
   the header nav is the navigation and the palette's :toc lists the
   page's headings — so s is a plain dead key below. There is no help
   binding: help is the palette's :h/:help usage output
   (quick-jump.js, which also owns the binding table those commands
   print — keep it in sync when bindings here change).

   Material's search UI is hidden entirely, and its search keys —
   s/S, F and / — are neutralized by a capture-phase listener below
   so nothing can summon the hidden search form: all of them are dead
   keys, and the jump palette is backtick's alone (quick-jump.js).
   Material's p/n page keys are neutralized the same way: < and > are
   the page motions here, n/N belong to the palette's /search as
   vim's search-repeat motions (quick-jump.js owns them and registers
   earlier, so it wins the capture race while a search is armed), and
   p/P are plain dead keys (vim means paste by them). All of them
   still type normally in inputs.

   Keys are ignored while typing (inputs, textareas, contenteditable)
   and in chords with Ctrl/Alt/Meta. Scrolling is smooth unless the
   user prefers reduced motion. Listeners attach once at load; nothing
   here needs re-initialization across navigation.instant changes. */

(function () {
  "use strict";

  const SCROLL_STEP_PX = 160;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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

  /* Opens the nth top-level section (1-based) by clicking its header
     nav link; the nav lists exactly the six sections — home is the
     [kiln] wordmark, owned by the 0 key via the logo. */
  function goToSection(n) {
    const links = document.querySelectorAll(
      ".kiln-header__nav .kiln-header__link"
    );
    const link = links[n - 1];
    if (link) link.click();
  }

  /* Scrolls to the previous (direction -1) or next (+1) h2 section.
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
    window.scrollTo({
      top: window.scrollY + target.getBoundingClientRect().top - offset,
      behavior: scrollBehavior(),
    });
  }

  /* Advances Material's palette radio group (themes in mkdocs.yml
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

  /* Material also binds keys of its own: s/S, F and / focus its
     (hidden) search, p and n switch pages. This capture-phase
     listener runs before Material's own handler and neutralizes all
     of them outside typing contexts (inside an input the guard lets
     them through, so they still type) — Material's bubble-phase
     handler registered first, so a bubble-phase swallow of ours
     would lose the race; the palette stays backtick's alone
     (quick-jump.js). n/N reach this swallow only while no /search is
     armed: quick-jump.js's capture listener registered earlier and
     claims them (search-repeat motions) with stopImmediatePropagation
     when one is. All of them are plain dead keys here, and the
     browser default is left alone. */
  window.addEventListener(
    "keydown",
    function (event) {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (KilnUtils.isTypingTarget(event.target)) return;
      if (
        event.key === "s" ||
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
