/* Page chrome: the hex reading-progress readout. (Scrolling and page
   switching are keyboard-driven — see key-nav.js; the sidebar title
   fade is pure CSS in extra.css.) */

(function () {
  "use strict";

  function formatHex(value, width) {
    let s = Math.max(0, Math.round(value)).toString(16);
    while (s.length < width) s = "0" + s;
    return "0x" + s;
  }

  /* Cached scroll range for the readout. Reading scrollHeight forces a
     layout flush, so the per-scroll-event path must never touch it —
     during wheel or middle-button autoscroll that flush lands on every
     frame of a long page. The range is measured on init, resize, and
     page change instead, re-measured lazily when the observed offset
     outruns the cache, and re-synced once per scroll burst from the
     fade-out callback (off the hot path). */
  const scrollRange = { max: 0, hexWidth: 1 };

  function measureScrollRange() {
    const doc = document.documentElement;
    scrollRange.max = doc.scrollHeight - doc.clientHeight;
    scrollRange.hexWidth = Math.max(
      1,
      Math.round(scrollRange.max).toString(16).length
    );
  }

  /* Hex reading-progress readout: the scroll offset over the full scroll
     range, styled as byte offsets (0x01f4/0x3fff). The offset pads to
     the range's hex width, so the readout never changes width while
     scrolling. Looks its element up fresh per call, since
     navigation.instant may have removed/replaced it since the scroll
     listener was registered; empties on unscrollable pages. The chip
     only shows around scroll activity: revealScrollProgress fades it
     in and schedules the fade-out. */
  function updateScrollProgress() {
    const readout = document.querySelector(".scroll-progress");
    if (!readout) return false;

    if (window.scrollY > scrollRange.max) measureScrollRange();
    if (scrollRange.max <= 0) {
      readout.textContent = "";
      return false;
    }
    const offset = Math.min(window.scrollY, scrollRange.max);
    readout.textContent =
      formatHex(offset, scrollRange.hexWidth) +
      "/" +
      formatHex(scrollRange.max, scrollRange.hexWidth);
    return true;
  }

  const progressHideDelayMs = 1000;

  const fadeScrollProgress = KilnUtils.debounce(function () {
    const readout = document.querySelector(".scroll-progress");
    if (!readout) return;
    /* Scroll burst over: correct the cached range (late layout growth
       from fonts or images) before the chip fades. */
    measureScrollRange();
    updateScrollProgress();
    readout.classList.remove("scroll-progress--visible");
  }, progressHideDelayMs);

  function revealScrollProgress() {
    const readout = document.querySelector(".scroll-progress");
    if (!readout || !updateScrollProgress()) return;
    readout.classList.add("scroll-progress--visible");
    fadeScrollProgress();
  }

  /* Same idempotence contract as initSidebarFade. Created invisible;
     only scroll activity reveals it. */
  function initScrollProgress() {
    if (!document.querySelector(".scroll-progress")) {
      const progress = document.createElement("span");
      progress.className = "scroll-progress";
      /* The hex offsets are visual flavor; progress isn't meaningful
         read aloud one mutation at a time. */
      progress.setAttribute("aria-hidden", "true");
      document.body.appendChild(progress);
    }
    measureScrollRange();
    updateScrollProgress();
  }

  function onScroll() {
    revealScrollProgress();
  }

  function onResize() {
    measureScrollRange(); /* the scroll range depends on the viewport */
    updateScrollProgress();
  }

  /* These handlers look their elements up fresh on every call, so they are
     attached once here rather than re-attached per navigation. */
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", KilnUtils.debounce(onResize, 100));

  /* Re-runs on instant-navigation page changes: initScrollProgress
     recreates the readout if navigation.instant's DOM reconciliation
     removed it, and re-measures the new page's scroll range. */
  KilnUtils.onPageChange(initScrollProgress);
})();
