/* Page chrome: the statusline (the position readout on the frame's
   bottom border) and the header nav's active-item sync. Scrolling and
   page switching are keyboard-driven — see key-nav.js.

   The statusline is always present: left the page path relative to
   the site root (~ for the homepage), right the position token — All
   when the page fits, Top at the start, otherwise the percentage
   through 100% at the bottom. The document scrollbar is hidden
   (extra.css), so this is the position indicator. */

(function () {
  "use strict";

  /* Site base from the header logo's href — the same derivation
     quick-jump.js uses; the logo links to the site root at the right
     relative depth on every page. */
  function siteBase() {
    const logo = document.querySelector(".md-header a.md-logo");
    return new URL(logo ? logo.getAttribute("href") : ".", location.href);
  }

  /* Cached scroll range for the readout. Reading scrollHeight forces a
     layout flush, so the per-scroll-event path must never touch it —
     during wheel autoscroll that flush lands on every frame of a long
     page. The range is measured on init, resize, and page change,
     re-measured lazily when the observed offset outruns the cache, and
     re-synced once per scroll burst (off the hot path). */
  const scrollRange = { max: 0 };

  function measureScrollRange() {
    const doc = document.documentElement;
    scrollRange.max = doc.scrollHeight - doc.clientHeight;
  }

  /* The ruler token for the current offset: All when the page fits,
     Top at the start, otherwise the percentage — held to 99% until
     the bottom is actually reached, so 100% always means the end of
     the page and never a rounding artifact. */
  function positionToken(offset, max) {
    if (max <= 0) return "All";
    if (offset <= 0) return "Top";
    if (offset >= max) return "100%";
    return Math.min(99, Math.max(1, Math.round((offset / max) * 100))) + "%";
  }

  /* Right-hand statusline segment: the position token alone. Looks
     its element up fresh per call, since navigation.instant may have
     replaced it since the listener was registered. */
  function updatePosition() {
    const pos = document.querySelector(".kiln-status__pos");
    if (!pos) return;

    if (window.scrollY > scrollRange.max) measureScrollRange();
    const offset = Math.min(window.scrollY, scrollRange.max);
    pos.textContent = positionToken(offset, scrollRange.max);
  }

  /* Left-hand segment: the page path below the site root, ~-prefixed
     like a shell prompt; the homepage is plain ~. */
  function updatePath() {
    const path = document.querySelector(".kiln-status__path");
    if (!path) return;
    const base = siteBase().pathname;
    let rel = location.pathname.startsWith(base)
      ? location.pathname.slice(base.length)
      : location.pathname;
    rel = decodeURIComponent(rel).replace(/\/+$/, "");
    path.textContent = rel ? "~/" + rel : "~";
  }

  /* Header nav active marker. The header is rendered once per full
     load and navigation.instant does not re-render it, so the
     Jinja-stamped active class goes stale on instant page changes;
     this recomputes it from the current location. A section link
     (its index page URL) is active for every page under its
     directory; on the homepage no item is active. */
  function syncActiveNav() {
    const links = document.querySelectorAll(".kiln-header__nav .kiln-header__link");
    if (!links.length) return;
    const here = location.pathname.replace(/index\.html$/, "");
    links.forEach(function (link) {
      const target = new URL(
        link.getAttribute("href"),
        location.href
      ).pathname.replace(/index\.html$/, "");
      const dir = target.replace(/[^/]*$/, "");
      link.classList.toggle("kiln-header__link--active", here.startsWith(dir));
    });
  }

  /* Re-syncs the cached range once per scroll burst, catching late
     layout growth (fonts, images) without touching scrollHeight on
     the hot path. */
  const settleScrollRange = KilnUtils.debounce(function () {
    measureScrollRange();
    updatePosition();
  }, 250);

  /* Idempotence contract as before: created only if missing, re-run
     per page change because navigation.instant removes injected DOM. */
  function initStatusline() {
    if (!document.querySelector(".kiln-status")) {
      const bar = document.createElement("div");
      bar.className = "kiln-status";
      /* Chrome flavor; the path duplicates the URL and progress isn't
         meaningful read aloud one mutation at a time. */
      bar.setAttribute("aria-hidden", "true");
      const path = document.createElement("span");
      path.className = "kiln-status__path";
      const pos = document.createElement("span");
      pos.className = "kiln-status__pos";
      bar.appendChild(path);
      bar.appendChild(pos);
      document.body.appendChild(bar);
    }
    measureScrollRange();
    updatePath();
    updatePosition();
    syncActiveNav();
  }

  function onScroll() {
    updatePosition();
    settleScrollRange();
  }

  function onResize() {
    measureScrollRange(); /* the scroll range depends on the viewport */
    updatePosition();
  }

  /* These handlers look their elements up fresh on every call, so they
     are attached once here rather than re-attached per navigation. */
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", KilnUtils.debounce(onResize, 100));

  KilnUtils.onPageChange(initStatusline);
})();
