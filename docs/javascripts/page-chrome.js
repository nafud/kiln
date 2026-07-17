/* Page chrome: gradient fade below the sticky sidebar title,
   scroll-to-top/bottom buttons, and the hex reading-progress readout. */

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

  /* Looks up the (possibly just-recreated) .scroll-buttons element fresh on
     every call, since navigation.instant may have removed/replaced it since
     the scroll listener was registered. */
  function updateScrollButtons() {
    const scrollButtons = document.querySelector(".scroll-buttons");
    if (!scrollButtons) return;

    scrollButtons.classList.toggle("scroll-hidden", window.scrollY <= 200);
  }

  function formatHex(value, width) {
    let s = Math.max(0, Math.round(value)).toString(16);
    while (s.length < width) s = "0" + s;
    return "0x" + s;
  }

  /* Hex reading-progress readout: the scroll offset over the full scroll
     range, styled as byte offsets (0x01f4/0x3fff). The offset pads to
     the range's hex width, so the readout never changes width while
     scrolling. Looks its element up fresh per call, like
     updateScrollButtons, and empties on unscrollable pages (where the
     cluster can never become visible anyway). The chip only shows
     around scroll activity: revealScrollProgress fades it in and
     schedules the fade-out, while its siblings keep the cluster's
     200px threshold behavior. */
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

  function makeScrollButton(label, iconSvg, onClick) {
    const button = document.createElement("button");
    button.className = "scroll-btn";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = iconSvg;
    button.addEventListener("click", onClick);
    return button;
  }

  /* Scroll-to-top/bottom buttons.
     Idempotent and safe to re-run, for the same reason as initSidebarFade. */
  function initScrollButtons() {
    if (!document.querySelector(".scroll-buttons")) {
      const container = document.createElement("div");
      container.className = "scroll-buttons scroll-hidden";
      const progress = document.createElement("span");
      progress.className = "scroll-progress";
      /* The hex offsets are visual flavor; progress isn't meaningful
         read aloud one mutation at a time. */
      progress.setAttribute("aria-hidden", "true");
      container.appendChild(progress);
      container.appendChild(
        makeScrollButton(
          "Scroll to top",
          '<svg viewBox="0 0 24 24"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>',
          function () {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        )
      );
      container.appendChild(
        makeScrollButton(
          "Scroll to bottom",
          '<svg viewBox="0 0 24 24"><path d="M12 16l6-6-1.41-1.41L12 13.17l-4.59-4.58L6 10z"/></svg>',
          function () {
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: "smooth",
            });
          }
        )
      );
      document.body.appendChild(container);
    }
    updateScrollButtons();
    updateScrollProgress();
  }

  function init() {
    initSidebarFade();
    initScrollButtons();
  }

  function onScroll() {
    updateScrollButtons();
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
     initScrollButtons recreate elements that navigation.instant's DOM
     reconciliation may have removed. */
  KilnUtils.onPageChange(init);
})();
