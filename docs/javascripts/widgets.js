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

  function mountKeygen(root) {
    root.appendChild(el("div", "kiln-widget-caption", "// Live keygen"));

    const row = el("label", "kiln-widget-field");
    row.appendChild(el("span", "kiln-widget-label", "username"));
    const input = el("input", "kiln-widget-input");
    input.type = "text";
    input.spellcheck = false;
    input.autocomplete = "off";
    input.value = "crackme";
    row.appendChild(input);
    root.appendChild(row);

    const out = el("div", "kiln-widget-output");
    out.appendChild(el("span", "kiln-widget-prompt", "»"));
    const serialEl = el("span", "kiln-widget-serial");
    out.appendChild(serialEl);
    root.appendChild(out);

    function render() {
      const result = cfb1Serial(input.value);
      if (result.error) {
        serialEl.textContent = result.error;
        out.classList.add("kiln-widget-output--error");
      } else {
        serialEl.textContent = result.serial;
        out.classList.remove("kiln-widget-output--error");
      }
    }
    input.addEventListener("input", render);
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
