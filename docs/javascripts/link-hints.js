/* Link hints: follow any visible link from the keyboard.

   F overlays a short label on every link in the viewport (home cards,
   table rows, cross-references, sidebar and header links alike); typing
   a label clicks its link, so internal links stay with
   navigation.instant and external ones keep the target="_blank" that
   external-links.js stamped. Escape cancels, Backspace untypes, and any
   scroll, resize, or mouse press cancels too, since the labels are
   pinned to viewport positions that those invalidate.

   F used to be one of Material's extra search keys; key-nav.js used to
   swallow it so S alone owned search, and this script now takes the key
   over instead (the capture-phase listener runs before Material's
   handler). Labels are fixed-length and generated home-row first, so no
   label is a prefix of another. Attach-once: the listener lives on
   window and the label layer is rebuilt per activation, so
   navigation.instant needs no re-init. */

(function () {
  "use strict";

  const ALPHABET = "asdfghjklqwertyuiopzxcvbnm";

  let hints = []; /* [{ label, link, chip }] while active, else empty */
  let typed = "";
  let layer = null;

  function active() {
    return layer !== null;
  }

  /* Links that are actually visible: laid out, inside the viewport, and
     not visibility-hidden (display:none ancestors already yield an
     empty rect — that is what excludes the hidden Material footer). */
  function visibleLinks() {
    const links = [];
    document.querySelectorAll("a[href]").forEach(function (link) {
      const rect = link.getBoundingClientRect();
      if (!rect.width && !rect.height) return;
      if (
        rect.bottom < 0 ||
        rect.right < 0 ||
        rect.top > window.innerHeight ||
        rect.left > window.innerWidth
      ) {
        return;
      }
      if (getComputedStyle(link).visibility === "hidden") return;
      links.push(link);
    });
    return links;
  }

  /* n fixed-length labels in alphabet order. A single shared length
     keeps the set prefix-free, so a completed label is unambiguous. */
  function makeLabels(n) {
    let length = 1;
    while (Math.pow(ALPHABET.length, length) < n) length++;
    const labels = [];
    for (let i = 0; i < n; i++) {
      let label = "";
      let x = i;
      for (let k = 0; k < length; k++) {
        label = ALPHABET[x % ALPHABET.length] + label;
        x = Math.floor(x / ALPHABET.length);
      }
      labels.push(label);
    }
    return labels;
  }

  /* Repaints every chip against the typed prefix: mismatches drop out,
     matches show the typed part highlighted. */
  function refresh() {
    hints.forEach(function (hint) {
      if (hint.label.indexOf(typed) !== 0) {
        hint.chip.classList.add("kiln-hint--dead");
        return;
      }
      hint.chip.classList.remove("kiln-hint--dead");
      hint.chip.textContent = "";
      const done = document.createElement("span");
      done.className = "kiln-hint-typed";
      done.textContent = typed;
      hint.chip.appendChild(done);
      hint.chip.appendChild(
        document.createTextNode(hint.label.slice(typed.length))
      );
    });
  }

  function activate() {
    const links = visibleLinks();
    if (!links.length) return;

    layer = document.createElement("div");
    layer.className = "kiln-hints";
    layer.setAttribute("aria-hidden", "true");

    const labels = makeLabels(links.length);
    hints = links.map(function (link, i) {
      const chip = document.createElement("span");
      chip.className = "kiln-hint";
      /* First client rect, not the bounding box: a link wrapped across
         lines gets its chip at the start of its first line. The top
         clamp compensates for the -55% translate in extra.css, so
         chips on header links are not clipped by the viewport edge. */
      const rect = link.getClientRects()[0] || link.getBoundingClientRect();
      chip.style.left = Math.max(0, rect.left - 2) + "px";
      chip.style.top = Math.max(12, rect.top) + "px";
      layer.appendChild(chip);
      return { label: labels[i], link: link, chip: chip };
    });

    typed = "";
    refresh();
    document.body.appendChild(layer);

    window.addEventListener("scroll", deactivate, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", deactivate);
    window.addEventListener("mousedown", deactivate, true);
  }

  function deactivate() {
    if (!active()) return;
    layer.remove();
    layer = null;
    hints = [];
    typed = "";
    window.removeEventListener("scroll", deactivate, true);
    window.removeEventListener("resize", deactivate);
    window.removeEventListener("mousedown", deactivate, true);
  }

  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  window.addEventListener(
    "keydown",
    function (event) {
      if (!active()) {
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        if (KilnUtils.isTypingTarget(event.target)) return;
        if (event.key === "f" || event.key === "F") {
          consume(event); /* keep the key from Material's search focus */
          activate();
        }
        return;
      }

      if (event.ctrlKey || event.altKey || event.metaKey) {
        deactivate(); /* chord: cancel and let the browser have it */
        return;
      }
      if (event.key === "Escape") {
        deactivate();
        consume(event);
        return;
      }
      if (event.key === "Backspace") {
        typed = typed.slice(0, -1);
        refresh();
        consume(event);
        return;
      }

      const key = event.key.toLowerCase();
      if (key.length === 1 && ALPHABET.indexOf(key) !== -1) {
        const next = typed + key;
        const matches = hints.filter(function (hint) {
          return hint.label.indexOf(next) === 0;
        });
        consume(event);
        if (!matches.length) {
          deactivate(); /* stray key: bail rather than trap typing */
        } else if (matches.length === 1 && matches[0].label === next) {
          const link = matches[0].link;
          deactivate();
          link.click();
        } else {
          typed = next;
          refresh();
        }
        return;
      }

      /* Any other key cancels; swallowed so half-typed hint state never
         leaks a scroll or a page switch. */
      deactivate();
      consume(event);
    },
    true
  );
})();
