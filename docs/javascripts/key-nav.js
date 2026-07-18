/* Keyboard navigation.

   Scrolling: T jumps to the top, D to the bottom, J/K scroll down/up a
   step, [ and ] to the previous/next h2 section on the page. Pages:
   < and > follow the previous/next page in nav order, via Material's
   footer links (the footer is display:none in extra.css but present in
   the DOM; navigation.footer is enabled solely for this), 0 goes home
   via the header logo, and 1-4 open the top-level sections in sidebar
   nav order. Clicking links, rather than assigning location, keeps
   navigation.instant in charge. H hides/reveals both
   sidebars (a body class, styled in extra.css desktop-only and
   surviving instant navigation since Material never touches body).
   M cycles the color palette by advancing Material's __palette radio
   group, the same thing its own toggle button does. ? toggles a help
   panel listing the bindings; Escape closes it.

   Material's own S (search) and P / N (prev/next page) bindings stay
   usable alongside these. Its extra search key / is swallowed by a
   capture-phase listener below so S alone owns search (it still types
   normally in inputs); its other extra search key F is taken over by
   link-hints.js for link hints. The ` jump palette is quick-jump.js;
   the help panel carries that script's home-view switch button, wired
   through the kiln:home-view-toggle event so the mode logic stays in
   one place.

   Keys are ignored while typing (inputs, textareas, contenteditable)
   and in chords with Ctrl/Alt/Meta. Scrolling is smooth unless the
   user prefers reduced motion. The help panel lives on document.body,
   so it survives navigation.instant page changes. */

(function () {
  "use strict";

  const SCROLL_STEP_PX = 160;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const HELP_ROWS = [
    ["T", "scroll to top"],
    ["D", "scroll to bottom"],
    ["J / K", "scroll down / up"],
    ["[ / ]", "previous / next heading"],
    ["< / >", "previous / next page"],
    ["0", "go home"],
    ["1", "toolkit"],
    ["2", "readings"],
    ["3", "courses"],
    ["4", "writeups"],
    ["H", "hide / show sidebars"],
    ["M", "light / dark / system"],
    ["S", "search"],
    ["`", "jump to a page"],
    ["F", "follow a link"],
    ["?", "toggle this help"],
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

  /* Advances Material's palette radio group (system, light, dark in
     mkdocs.yml order) — clicking the next input is exactly what the
     theme's own toggle button does. */
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
    const rows = HELP_ROWS.map(function (row) {
      return (
        "<div class=\"key-help-row\"><kbd>" +
        row[0] +
        "</kbd><span>" +
        row[1] +
        "</span></div>"
      );
    });
    panel.innerHTML = rows.join("");

    /* Home-view switch (cards vs jump bar). quick-jump.js owns the
       mode and handles this event; which label shows follows the html
       mode class via extra.css, so no state is tracked here. */
    const switchButton = document.createElement("button");
    switchButton.type = "button";
    switchButton.className = "key-help-switch";
    switchButton.innerHTML =
      '<span class="key-help-switch-to-jump">switch home to jump bar</span>' +
      '<span class="key-help-switch-to-cards">switch home to cards</span>';
    switchButton.addEventListener("click", function () {
      document.dispatchEvent(new CustomEvent("kiln:home-view-toggle"));
    });
    panel.appendChild(switchButton);

    document.body.appendChild(panel);
    return panel;
  }

  /* force: true opens, false closes, undefined toggles. */
  function toggleHelpPanel(force) {
    const panel = ensureHelpPanel();
    panel.classList.toggle("key-help--open", force);
  }

  /* Material also focuses search on F and /; only S should. This
     capture-phase listener runs before Material's own handler and
     swallows / outside typing contexts (inside an input the guard lets
     it through, so it still types); F is claimed by link-hints.js's own
     capture listener instead. The browser default is left alone. */
  window.addEventListener(
    "keydown",
    function (event) {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (KilnUtils.isTypingTarget(event.target)) return;
      if (event.key === "/") {
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
        document.body.classList.toggle("kiln-sidebars-hidden");
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
        /* Close-only (never creates the panel); Material owns Escape
           for its search overlay. */
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
