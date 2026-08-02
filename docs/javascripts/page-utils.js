/* Shared helpers for the site's page scripts.

   Loaded before the other extra_javascript files (see mkdocs.yml), which
   read `KilnUtils` from the shared global script scope. */

const KilnUtils = {
  /* Debounce, e.g. for resize handlers, to avoid layout thrashing.
     The last call's arguments are forwarded to fn when it fires. */
  debounce: function (fn, delay) {
    let timer;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(null, args);
      }, delay);
    };
  },

  /* True when el is a typing context (inputs, textareas, selects,
     contenteditable), where the keyboard scripts (key-nav.js,
     quick-jump.js) must leave keystrokes alone. */
  isTypingTarget: function (el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      el.isContentEditable
    );
  },

  /* Site base URL, derived from the header logo's href: the logo
     links to the site root at the right relative depth on every page,
     so it doubles as the base for site-absolute URLs (page-chrome.js
     builds the statusline path from it, quick-jump.js its fetches;
     key-nav.js clicks the same element for the 0 key). */
  siteBase: function () {
    const logo = document.querySelector(".md-header a.md-logo");
    return new URL(logo ? logo.getAttribute("href") : ".", location.href);
  },

  /* The anchor line for in-page vertical positioning — just below the
     fixed header chrome. Shared by the [ ] heading motions
     (key-nav.js) and the n/N match motions (quick-jump.js), so the
     two vocabularies always agree on where "the top" is. */
  anchorOffset: function () {
    const header = document.querySelector(".md-header");
    return (header ? header.offsetHeight : 0) + 16;
  },

  /* Runs fn once the page is ready and again after every
     navigation.instant page change. Material's document$ BehaviorSubject
     emits on subscribe, so it alone covers the initial load; the
     DOMContentLoaded fallback only matters when the Material bundle (and
     with it instant navigation) is absent. Registering both would run fn
     twice on every full page load. */
  onPageChange: function (fn) {
    if (typeof document$ !== "undefined") {
      document$.subscribe(fn);
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  },

  /* Two's-complement readout shared by the CSAPP widget (widgets.js)
     and the palette's :x -wN mode (quick-jump.js): one BigInt value
     read at a width as its raw bit pattern, hex, and both integer
     interpretations, or {error} when it fits the width as neither.
     Written without BigInt literals on purpose — a parser that
     rejects them would take this whole file (and every script's
     KilnUtils) down with it, instead of failing only where BigInt is
     actually exercised. */
  twosReadout: function (value, width) {
    const one = BigInt(1);
    const size = one << BigInt(width);
    const half = size >> one;
    if (value >= size || value < -half) {
      return { error: "does not fit in " + width + " bits" };
    }
    const raw = ((value % size) + size) % size;
    const signed = raw >= half ? raw - size : raw;
    return {
      bits: raw.toString(2).padStart(width, "0").replace(/(.{4})(?=.)/g, "$1 "),
      hex: "0x" + raw.toString(16).padStart(width / 4, "0"),
      unsigned: raw.toString(10),
      signed: signed.toString(10),
    };
  },
};
