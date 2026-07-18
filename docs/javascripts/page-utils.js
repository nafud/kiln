/* Shared helpers for the site's page scripts.

   Loaded before the other extra_javascript files (see mkdocs.yml), which
   read `KilnUtils` from the shared global script scope. */

const KilnUtils = {
  /* Debounce, e.g. for resize handlers, to avoid layout thrashing. */
  debounce: function (fn, delay) {
    let timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
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
};
