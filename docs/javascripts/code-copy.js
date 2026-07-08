/* Swap the code-copy button icon to a checkmark after a copy.

   Material's own copy feedback in this theme is the "Copied to clipboard"
   dialog, which extra.css intentionally hides. This restores a quieter
   inline confirmation. Mask swaps are discrete, so the restore is staged
   for smoothness (see extra.css for the animations):

     click            -> +copied            check animates in
     after copiedMs   -> +leaving           check fades out
     after swapMs     -> -copied -leaving   copy icon animates back in
                         +restoring
     after swapMs     -> -restoring         settled

   Uses one delegated listener on the document, so it survives
   navigation.instant page changes without re-initialization. */

(function () {
  "use strict";

  const CONFIG = {
    buttonSelector: '.md-code__button[data-md-type="copy"]',
    copiedClass: "md-code__button--copied",
    leavingClass: "md-code__button--leaving",
    restoringClass: "md-code__button--restoring",
    copiedMs: 2000, /* how long the checkmark stays */
    /* Swap timing is owned by extra.css so the phase timers can never
       drift from the kiln-icon-in/out animation durations. */
    swapDurationProperty: "--kiln-icon-swap-duration",
    swapFallbackMs: 250,
  };

  const timers = new WeakMap();

  /* Reads the animation duration from the stylesheet (e.g. "250ms" or
     "0.25s"); falls back if the custom property is missing. */
  function swapDurationMs() {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(CONFIG.swapDurationProperty)
      .trim();
    const ms = value.endsWith("ms")
      ? parseFloat(value)
      : parseFloat(value) * 1000;
    return Number.isFinite(ms) && ms > 0 ? ms : CONFIG.swapFallbackMs;
  }

  function setPhase(button, timeoutId) {
    timers.set(button, timeoutId);
  }

  function clearPhase(button) {
    clearTimeout(timers.get(button));
    timers.delete(button);
  }

  document.addEventListener("click", function (event) {
    const button = event.target.closest(CONFIG.buttonSelector);
    if (!button) return;

    clearPhase(button);
    button.classList.remove(CONFIG.leavingClass, CONFIG.restoringClass);
    button.classList.add(CONFIG.copiedClass);

    const swapMs = swapDurationMs();
    setPhase(button, setTimeout(function () {
      button.classList.add(CONFIG.leavingClass); /* fade the check out */

      setPhase(button, setTimeout(function () {
        button.classList.remove(CONFIG.copiedClass, CONFIG.leavingClass);
        button.classList.add(CONFIG.restoringClass); /* copy icon back in */

        setPhase(button, setTimeout(function () {
          button.classList.remove(CONFIG.restoringClass);
          timers.delete(button);
        }, swapMs));
      }, swapMs));
    }, CONFIG.copiedMs));
  });
})();
