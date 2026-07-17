/* Keyboard navigation.

   Scrolling: T jumps to the top, D to the bottom, J/K scroll down/up a
   step. Pages: < and > follow the previous/next page in nav order, via
   Material's footer links (the footer is display:none in extra.css but
   present in the DOM; navigation.footer is enabled solely for this).
   Clicking the link, rather than assigning location, keeps
   navigation.instant in charge. H hides/reveals both sidebars (a body
   class, styled in extra.css desktop-only and surviving instant
   navigation since Material never touches body). ? toggles a help
   panel listing the bindings; Escape closes it.

   Material's own bindings (S / F / / for search, P / N for prev/next
   page) are untouched and stay usable alongside these.

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
    ["< / >", "previous / next page"],
    ["H", "hide / show sidebars"],
    ["S", "search"],
    ["?", "toggle this help"],
  ];

  function scrollBehavior() {
    return reducedMotion.matches ? "auto" : "smooth";
  }

  function followPageLink(direction) {
    const link = document.querySelector(".md-footer__link--" + direction);
    if (link) link.click();
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
    document.body.appendChild(panel);
    return panel;
  }

  /* force: true opens, false closes, undefined toggles. */
  function toggleHelpPanel(force) {
    const panel = ensureHelpPanel();
    panel.classList.toggle("key-help--open", force);
  }

  function isTypingTarget(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      el.isContentEditable
    );
  }

  window.addEventListener("keydown", function (event) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (isTypingTarget(event.target)) return;

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
      case "<":
        followPageLink("prev");
        break;
      case ">":
        followPageLink("next");
        break;
      case "?":
        toggleHelpPanel();
        break;
      case "Escape":
        /* Close-only; Material owns Escape for its search overlay. */
        toggleHelpPanel(false);
        return;
      default:
        return;
    }
    event.preventDefault();
  });
})();
