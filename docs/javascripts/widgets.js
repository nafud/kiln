/* Interactive content widgets (experimental).

   Progressive enhancement over static content: a page drops an empty
   <div class="kiln-widget" data-widget="NAME"></div> after the block
   it animates, and this script hydrates it. With JS off the div is
   empty and the surrounding prose and code stand alone.

   Mounting follows the same rules as the other scripts: idempotent and
   re-run via KilnUtils.onPageChange (navigation.instant swaps the
   content DOM), lazy (no work on pages without a widget), and a node is
   marked once mounted so a re-run never double-hydrates it.

   Two widgets, both built on the same terminal-prompt scaffold
   (createTerm): cfb1-keygen, a live keygen for the CFB1 writeup that
   reimplements that page's verified derivation
   (byte = (((i + 0x5A) ^ c) + 0x13) & 0xFF) — keeping it in step with
   the prose is the price of a self-checking document — and
   twos-complement on CSAPP chapter 3's §3.5.4, one integer literal
   read at a chosen width as raw bits, hex, unsigned, and signed: the
   passage's same-bits-two-readings point made interactive. */

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

  /* ---------- terminal prompt scaffold ---------- */

  /* The interactive console block the widgets are built on:
     `$ <command> <input>█` with the program's output below. lineParts
     (strings and nodes) form the command before the input;
     paint(out, value) fills the output area for the current value and
     runs on every change; the returned refresh() re-paints without an
     input event, for a widget's own controls.

     Type-only prompt: caret navigation is blocked so the caret cannot
     leave the end (the block glyph is the cursor, the native caret is
     suppressed in CSS), but clipboard shortcuts (Ctrl/Cmd+A/C/X/V)
     pass through — selection is left alone for copy/cut, and a paste
     is re-pinned to the end by refresh. */
  function createTerm(lineParts, initialValue, ariaLabel, paint) {
    const term = el("div", "kiln-term");

    const line = el("div", "kiln-term-line");
    line.appendChild(el("span", "kiln-term-prompt", "$"));
    line.appendChild(document.createTextNode(" "));
    lineParts.forEach(function (part) {
      line.appendChild(
        typeof part === "string" ? document.createTextNode(part) : part
      );
    });
    const input = el("input", "kiln-term-input");
    input.type = "text";
    input.spellcheck = false;
    input.autocomplete = "off";
    input.setAttribute("aria-label", ariaLabel);
    input.value = initialValue;
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
    /* Puts the caret at the end (collapsed), unless it is already
       there. Guarded so it never disturbs a real selection it is not
       meant to touch. */
    function pinCaret() {
      const len = input.value.length;
      if (input.selectionStart !== len || input.selectionEnd !== len) {
        input.setSelectionRange(len, len);
      }
    }
    function refresh() {
      sizeInput();
      out.textContent = "";
      paint(out, input.value);
      /* Any content change (type, paste, cut, delete) returns the
         caret to the end, so the block cursor stays the insertion
         point and the next character appends. */
      if (document.activeElement === input) {
        pinCaret();
        scrollToCaret();
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

    input.addEventListener("input", refresh);
    input.addEventListener("focus", function () {
      pinCaret();
      scrollToCaret();
    });
    /* A plain click (collapsed caret) snaps to the end; a drag that
       leaves a selection is preserved so it can be copied. */
    input.addEventListener("click", function () {
      if (input.selectionStart === input.selectionEnd) pinCaret();
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
       does (a widget's own controls stop propagation to opt out). */
    term.addEventListener("click", function (event) {
      if (event.target !== input) input.focus();
    });

    refresh();
    return { term: term, refresh: refresh };
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
    const term = createTerm(
      ["python3 keygen.py "],
      "crackme",
      "username",
      function (out, value) {
        const result = cfb1Serial(value);
        if (result.error) {
          out.appendChild(el("span", "kiln-term-err", result.error));
        } else {
          out.appendChild(el("span", "kiln-term-echo", value.trim() + " "));
          out.appendChild(el("span", "kiln-term-serial", result.serial));
        }
      }
    );
    root.appendChild(term.term);
  }

  /* ---------- two's-complement readout ---------- */

  const BIT_WIDTHS = [8, 16, 32, 64];

  /* One integer literal (dec, 0x, 0b, optional leading -) read at a
     given width: the raw bit pattern plus its unsigned and signed
     interpretations. BigInt throughout, so -w64 stays exact; the sign
     is split off before BigInt() because BigInt("-0x10") throws. */
  function twosReadout(text, width) {
    const match = /^(-?)(0[xX][0-9a-fA-F]+|0[bB][01]+|[0-9]+)$/.exec(
      text.trim()
    );
    if (!match) return { error: "not an integer literal (dec, 0x, 0b)" };
    const magnitude = BigInt(match[2]);
    const value = match[1] ? -magnitude : magnitude;
    const size = 1n << BigInt(width);
    if (value >= size || value < -(size >> 1n)) {
      return { error: "does not fit in " + width + " bits" };
    }
    const raw = ((value % size) + size) % size;
    const signed = raw >= size >> 1n ? raw - size : raw;
    return {
      bits: raw.toString(2).padStart(width, "0").replace(/(.{4})(?=.)/g, "$1 "),
      hex: "0x" + raw.toString(16).padStart(width / 4, "0"),
      unsigned: raw.toString(10),
      signed: signed.toString(10),
    };
  }

  /* `$ bits -wN <value>`: the -wN flag is a real button cycling the
     width, and the output is the same bit pattern read every way the
     chapter discusses — unsigned and two's complement. */
  function mountTwosComplement(root) {
    let width = 16;

    const flag = el("button", "kiln-term-flag", "-w16");
    flag.type = "button";
    flag.setAttribute("aria-label", "cycle bit width");
    flag.addEventListener("click", function (event) {
      event.stopPropagation(); /* not a focus-the-prompt click */
      width = BIT_WIDTHS[(BIT_WIDTHS.indexOf(width) + 1) % BIT_WIDTHS.length];
      flag.textContent = "-w" + width;
      term.refresh();
    });

    const term = createTerm(
      ["bits ", flag, " "],
      "-16",
      "integer value",
      function (out, value) {
        const readout = twosReadout(value, width);
        if (readout.error) {
          out.appendChild(el("span", "kiln-term-err", readout.error));
          return;
        }
        [
          ["bits", readout.bits],
          ["hex", readout.hex],
          ["u" + width, readout.unsigned],
          ["s" + width, readout.signed],
        ].forEach(function (row, i) {
          if (i) out.appendChild(document.createTextNode("\n"));
          out.appendChild(el("span", "kiln-term-echo", row[0].padEnd(6)));
          out.appendChild(document.createTextNode(row[1]));
        });
      }
    );
    root.appendChild(term.term);
  }

  /* ---------- hydration ---------- */

  const WIDGETS = {
    "cfb1-keygen": mountKeygen,
    "twos-complement": mountTwosComplement,
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
