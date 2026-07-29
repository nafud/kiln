/* Page chrome: the statusline (vim's ruler on the frame's bottom
   border) and the header nav's active-item sync. Scrolling and page
   switching are keyboard-driven — see key-nav.js.

   The statusline is always present: left the page path relative to
   the site root (~ for the homepage), right the hex offset readout
   (0x1388/0x8d88) plus vim's position token — All when the page fits,
   Top/Bot at the ends, the percentage between. The document
   scrollbar is hidden (extra.css), so this is the position
   indicator. */

(function () {
  "use strict";

  function formatHex(value, width) {
    let s = Math.max(0, Math.round(value)).toString(16);
    while (s.length < width) s = "0" + s;
    return "0x" + s;
  }

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
  const scrollRange = { max: 0, hexWidth: 1 };

  function measureScrollRange() {
    const doc = document.documentElement;
    scrollRange.max = doc.scrollHeight - doc.clientHeight;
    scrollRange.hexWidth = Math.max(
      1,
      Math.round(scrollRange.max).toString(16).length
    );
  }

  /* vim's ruler token for the current offset. */
  function positionToken(offset, max) {
    if (max <= 0) return "All";
    if (offset <= 0) return "Top";
    if (offset >= max) return "Bot";
    return Math.min(99, Math.max(1, Math.round((offset / max) * 100))) + "%";
  }

  /* Right-hand statusline segment: hex offsets padded to the range's
     width (so the readout never changes width while scrolling) plus
     the position token. Looks its element up fresh per call, since
     navigation.instant may have replaced it since the listener was
     registered. */
  function updatePosition() {
    const pos = document.querySelector(".kiln-status__pos");
    if (!pos) return;

    if (window.scrollY > scrollRange.max) measureScrollRange();
    if (scrollRange.max <= 0) {
      pos.textContent = "All";
      return;
    }
    const offset = Math.min(window.scrollY, scrollRange.max);
    pos.textContent =
      formatHex(offset, scrollRange.hexWidth) +
      "/" +
      formatHex(scrollRange.max, scrollRange.hexWidth) +
      " " +
      positionToken(offset, scrollRange.max);
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
     this recomputes it from the current location. Home is active only
     at the site root; a section link (its index page URL) is active
     for every page under its directory. */
  function syncActiveNav() {
    const links = document.querySelectorAll(".kiln-header__nav .kiln-header__link");
    if (!links.length) return;
    const here = location.pathname.replace(/index\.html$/, "");
    links.forEach(function (link, i) {
      const target = new URL(
        link.getAttribute("href"),
        location.href
      ).pathname.replace(/index\.html$/, "");
      const dir = target.replace(/[^/]*$/, "");
      const active = i === 0 ? here === target : here.startsWith(dir);
      link.classList.toggle("kiln-header__link--active", active);
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
