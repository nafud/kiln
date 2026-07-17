/* Page chrome: gradient fade below the sticky sidebar title and the
   hex reading-progress readout. (Scrolling and page switching are
   keyboard-driven — see key-nav.js.) */

(function () {
  "use strict";

  /* Gradient fade below the sticky sidebar title.
     Idempotent and safe to re-run: navigation.instant reconciles the DOM
     against freshly fetched page content, which doesn't include this
     injected element, so it must be re-created after every navigation. */
  function initSidebarFade() {
    const primaryNav = document.querySelector(
      ".md-sidebar--primary .md-nav--primary"
    );
    const navTitle = primaryNav && primaryNav.querySelector(".md-nav__title");
    if (!navTitle) return;

    let fade = navTitle.parentNode.querySelector(".sidebar-title-fade");
    if (!fade) {
      fade = document.createElement("div");
      fade.className = "sidebar-title-fade";
      navTitle.parentNode.insertBefore(fade, navTitle.nextSibling);
    }
    fade.style.top = navTitle.offsetHeight + "px";
  }

  function formatHex(value, width) {
    let s = Math.max(0, Math.round(value)).toString(16);
    while (s.length < width) s = "0" + s;
    return "0x" + s;
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

    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    if (max <= 0) {
      readout.textContent = "";
      return false;
    }
    const width = Math.round(max).toString(16).length;
    readout.textContent =
      formatHex(window.scrollY, width) + "/" + formatHex(max, width);
    return true;
  }

  const progressHideDelayMs = 1000;

  const fadeScrollProgress = KilnUtils.debounce(function () {
    const readout = document.querySelector(".scroll-progress");
    if (readout) readout.classList.remove("scroll-progress--visible");
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
    updateScrollProgress();
  }

  function init() {
    initSidebarFade();
    initScrollProgress();
  }

  function onScroll() {
    revealScrollProgress();
  }

  function onResize() {
    initSidebarFade();
    updateScrollProgress(); /* the scroll range depends on the viewport */
  }

  /* These handlers look their elements up fresh on every call, so they are
     attached once here rather than re-attached per navigation. */
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", KilnUtils.debounce(onResize, 100));

  /* Re-runs on instant-navigation page changes: initSidebarFade and
     initScrollProgress recreate elements that navigation.instant's DOM
     reconciliation may have removed. */
  KilnUtils.onPageChange(init);
})();
