/* Interactive content widgets (experimental).

   Progressive enhancement over static writeup content: a page drops an
   empty <div class="kiln-widget" data-widget="NAME"></div> after the
   block it animates, and this script hydrates it. With JS off the div
   is empty and the surrounding prose and code stand alone.

   Mounting follows the same rules as the other scripts: idempotent and
   re-run via KilnUtils.onPageChange (navigation.instant swaps the
   content DOM), lazy (no work on pages without a widget), and a node is
   marked once mounted so a re-run never double-hydrates it.

   One widget so far: cfb1-keygen, a live keygen for the CFB1 writeup
   that reimplements that page's verified derivation
   (byte = (((i + 0x5A) ^ c) + 0x13) & 0xFF). Keeping it in step with
   the prose is the price of a self-checking document. */

(function () {
  "use strict";

  /* ---------- shared helpers ---------- */

  const hex2 = function (n) {
    return (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------- CFB1 keygen ---------- */

  /* The page algorithm, verbatim. Returns the serial, or an Error-like
     value for inputs the real keygen rejects. */
  function cfb1Serial(username) {
    const name = username.trim();
    if (name.length < 4) return { error: "username must be at least 4 characters" };
    let out = "";
    for (let i = 0; i < name.length; i++) {
      const byte = (((i + 0x5a) ^ name.charCodeAt(i)) + 0x13) & 0xff;
      out += hex2(byte);
    }
    return { serial: out };
  }

  /* A live console block: `$ python3 keygen.py <username>` with the
     username editable in place and the program's stdout below. */
  function mountKeygen(root) {
    const term = el("div", "kiln-term");

    const line = el("div", "kiln-term-line");
    line.appendChild(el("span", "kiln-term-prompt", "$"));
    line.appendChild(document.createTextNode(" python3 keygen.py "));
    const input = el("input", "kiln-term-input");
    input.type = "text";
    input.spellcheck = false;
    input.autocomplete = "off";
    input.setAttribute("aria-label", "username");
    input.value = "crackme";
    line.appendChild(input);
    const cursor = el("span", "kiln-term-cursor", "█");
    cursor.setAttribute("aria-hidden", "true");
    line.appendChild(cursor);
    term.appendChild(line);

    const out = el("div", "kiln-term-out");
    term.appendChild(out);

    /* Monospace, so the input fits its text exactly at value.length ch
       and the block cursor lands flush after it. */
    function sizeInput() {
      input.style.width = Math.max(1, input.value.length) + "ch";
    }
    /* Keep the caret end (and the block cursor after it) in view while
       the prompt has focus. */
    function scrollToCaret() {
      line.scrollLeft = line.scrollWidth;
    }
    function render() {
      sizeInput();
      out.textContent = "";
      const result = cfb1Serial(input.value);
      if (result.error) {
        out.appendChild(el("span", "kiln-term-err", result.error));
      } else {
        out.appendChild(el("span", "kiln-term-echo", input.value.trim() + " "));
        out.appendChild(el("span", "kiln-term-serial", result.serial));
      }
      if (document.activeElement === input) scrollToCaret();
    }
    /* Type-only prompt: the caret is pinned to the end so the block
       cursor is always where the next character lands. pinCaret snaps
       any stray selection back (guarded, so setSelectionRange doesn't
       loop through the select event it fires), and the caret-moving
       keys are blocked outright. */
    function pinCaret() {
      const len = input.value.length;
      if (input.selectionStart !== len || input.selectionEnd !== len) {
        input.setSelectionRange(len, len);
      }
    }
    const CARET_KEYS = {
      ArrowLeft: 1,
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowDown: 1,
      Home: 1,
      End: 1,
    };

    input.addEventListener("input", render);
    input.addEventListener("focus", function () {
      pinCaret();
      scrollToCaret();
    });
    ["click", "mouseup", "select"].forEach(function (ev) {
      input.addEventListener(ev, pinCaret);
    });
    /* Blur: unfocus so the site keys work again, and rewind the line so
       the command reads from the prompt. */
    input.addEventListener("blur", function () {
      line.scrollLeft = 0;
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        input.blur();
        event.preventDefault();
      } else if (CARET_KEYS[event.key]) {
        event.preventDefault();
      }
    });
    /* Click anywhere in the terminal focuses the prompt, as a terminal
       does. */
    term.addEventListener("click", function (event) {
      if (event.target !== input) input.focus();
    });

    root.appendChild(term);
    render();
  }

  /* ---------- hydration ---------- */

  const WIDGETS = {
    "cfb1-keygen": mountKeygen,
  };

  function hydrate() {
    const nodes = document.querySelectorAll(".kiln-widget:not([data-mounted])");
    nodes.forEach(function (node) {
      const mount = WIDGETS[node.getAttribute("data-widget")];
      node.setAttribute("data-mounted", "");
      if (mount) mount(node);
    });
  }

  KilnUtils.onPageChange(hydrate);
})();
