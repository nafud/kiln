/* Interactive content widgets (experimental).

   Progressive enhancement over static writeup content: a page drops an
   empty <div class="kiln-widget" data-widget="NAME"></div> after the
   static example it animates, and this script hydrates it. With JS off
   the div is empty and the static block above it stands alone, so the
   reproducible example is never lost.

   Mounting follows the same rules as the other scripts: idempotent and
   re-run via KilnUtils.onPageChange (navigation.instant swaps the
   content DOM), lazy (no work on pages without a widget), and a node is
   marked once mounted so a re-run never double-hydrates it.

   Widgets are pure vanilla JS. The keygen and the register/flags
   stepper both reimplement the CFB1 derivation verified on that page
   (byte = (((i + 0x5A) ^ c) + 0x13) & 0xFF); the stepper walks the
   byte-wide AL sequence the routine actually runs. Keeping these in
   step with the page is the price of a self-checking document. */

(function () {
  "use strict";

  /* ---------- shared helpers ---------- */

  const hex2 = function (n) {
    return (n & 0xff).toString(16).toUpperCase().padStart(2, "0");
  };
  const hex8 = function (n) {
    return "0x" + (n >>> 0).toString(16).toUpperCase().padStart(8, "0");
  };
  /* x86 parity flag: set when the low byte has an even number of 1s. */
  const parity = function (n) {
    let bits = 0;
    for (let i = 0; i < 8; i++) bits += (n >> i) & 1;
    return bits % 2 === 0 ? 1 : 0;
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------- CFB1 keygen ---------- */

  /* The page algorithm, verbatim. Returns the serial, or an Error-like
     string for inputs the real keygen rejects. */
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
    root.appendChild(el("div", "kiln-widget-caption", "// live keygen — edit the username"));

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

  /* ---------- CFB1 register / flags stepper ---------- */

  /* The byte-wide transform the derivation routine runs per character.
     Each step mutates the machine state and names the register it
     touched (for the highlight) and whether it sets flags. AL is the
     low byte of EAX throughout, as in the disassembly. */
  const STEPPER_PROGRAM = [
    {
      text: "lea  eax, [rbp+0x5a]",
      note: "eax = i + 0x5A",
      reg: "eax",
      run: function (st) {
        st.eax = (st.i + 0x5a) >>> 0;
      },
    },
    {
      text: "xor  al, [rcx+rbp]",
      note: "al ^= username[i]",
      reg: "eax",
      flags: true,
      run: function (st) {
        const r = ((st.eax & 0xff) ^ st.ch) & 0xff;
        st.eax = (st.eax & ~0xff) | r;
        st.flags = { CF: 0, OF: 0, SF: (r & 0x80) >> 7, ZF: r === 0 ? 1 : 0, PF: parity(r) };
      },
    },
    {
      text: "add  al, 0x13",
      note: "al += 0x13 (wraps at 8 bits)",
      reg: "eax",
      flags: true,
      run: function (st) {
        const a = st.eax & 0xff;
        const sum = a + 0x13;
        const r = sum & 0xff;
        st.eax = (st.eax & ~0xff) | r;
        st.flags = {
          CF: sum > 0xff ? 1 : 0,
          OF: (~(a ^ 0x13) & (a ^ r) & 0x80) !== 0 ? 1 : 0,
          SF: (r & 0x80) >> 7,
          ZF: r === 0 ? 1 : 0,
          PF: parity(r),
        };
      },
    },
    {
      text: "movzx edi, al",
      note: "edi = the byte, 0..255",
      reg: "edi",
      run: function (st) {
        st.edi = st.eax & 0xff;
      },
    },
  ];

  const FLAG_NAMES = ["ZF", "SF", "CF", "OF", "PF"];

  function mountStepper(root) {
    root.appendChild(
      el("div", "kiln-widget-caption", "// step the per-character transform (rbp = i)")
    );

    /* inputs: the character and its position i */
    const controls = el("div", "kiln-widget-controls");
    const charField = el("label", "kiln-widget-field");
    charField.appendChild(el("span", "kiln-widget-label", "char"));
    const charInput = el("input", "kiln-widget-input kiln-widget-input--char");
    charInput.type = "text";
    charInput.maxLength = 1;
    charInput.spellcheck = false;
    charInput.value = "t";
    charField.appendChild(charInput);
    controls.appendChild(charField);

    const iField = el("label", "kiln-widget-field");
    iField.appendChild(el("span", "kiln-widget-label", "i"));
    const iInput = el("input", "kiln-widget-input kiln-widget-input--i");
    iInput.type = "number";
    iInput.min = "0";
    iInput.value = "0";
    iField.appendChild(iInput);
    controls.appendChild(iField);

    const stepBtn = el("button", "kiln-widget-btn", "step");
    const runBtn = el("button", "kiln-widget-btn", "run");
    const resetBtn = el("button", "kiln-widget-btn", "reset");
    controls.appendChild(stepBtn);
    controls.appendChild(runBtn);
    controls.appendChild(resetBtn);
    root.appendChild(controls);

    /* the instruction listing */
    const asm = el("div", "kiln-widget-asm");
    const asmLines = STEPPER_PROGRAM.map(function (ins, i) {
      const line = el("div", "kiln-widget-asm-line");
      line.appendChild(el("span", "kiln-widget-asm-ptr", ""));
      line.appendChild(el("span", "kiln-widget-asm-text", ins.text));
      line.appendChild(el("span", "kiln-widget-asm-note", "; " + ins.note));
      asm.appendChild(line);
      return line;
    });
    root.appendChild(asm);

    /* register cards (reuse the site's register-grid/-card) */
    const grid = el("div", "register-grid kiln-widget-regs");
    const regDefs = [
      ["RBP", "i", "loop index"],
      ["[RCX+RBP]", "ch", "username[i]"],
      ["EAX", "eax", "AL is the low byte"],
      ["EDI", "edi", "output byte"],
    ];
    const regValues = {};
    regDefs.forEach(function (def) {
      const card = el("div", "register-card");
      card.appendChild(el("div", "register-name", def[0]));
      const value = el("div", "kiln-reg-value");
      card.appendChild(value);
      card.appendChild(el("div", "register-desc", def[2]));
      grid.appendChild(card);
      regValues[def[1]] = { card: card, value: value };
    });
    root.appendChild(grid);

    /* flags row */
    const flagsRow = el("div", "kiln-widget-flags");
    const flagEls = {};
    FLAG_NAMES.forEach(function (name) {
      const chip = el("span", "kiln-flag", name);
      flagsRow.appendChild(chip);
      flagEls[name] = chip;
    });
    root.appendChild(flagsRow);

    /* ---- state + rendering ---- */
    let st, pc;

    function reset() {
      const raw = charInput.value.length ? charInput.value.charCodeAt(0) : 0;
      const i = Math.max(0, parseInt(iInput.value, 10) || 0);
      st = { i: i, ch: raw & 0xff, eax: 0, edi: null, flags: null };
      pc = 0;
      render(null);
    }

    function renderEax() {
      const v = regValues.eax.value;
      v.textContent = "";
      const full = hex8(st.eax);
      /* split so the AL byte (last two hex digits) can be emphasized */
      v.appendChild(document.createTextNode(full.slice(0, 8)));
      const al = el("b", null, full.slice(8));
      v.appendChild(al);
    }

    function render(changedReg) {
      regValues.i.value.textContent = String(st.i);
      regValues.ch.value.textContent =
        hex8(st.ch) + " '" + (st.ch >= 0x20 && st.ch < 0x7f ? String.fromCharCode(st.ch) : "?") + "'";
      renderEax();
      regValues.edi.value.textContent = st.edi == null ? "—" : hex8(st.edi);

      Object.keys(regValues).forEach(function (k) {
        regValues[k].card.classList.toggle("register-card--active", k === changedReg);
      });

      FLAG_NAMES.forEach(function (name) {
        const set = st.flags && st.flags[name];
        flagEls[name].classList.toggle("kiln-flag--set", !!set);
      });

      asmLines.forEach(function (line, i) {
        line.classList.toggle("kiln-widget-asm-line--active", i === pc);
        line.classList.toggle("kiln-widget-asm-line--done", i < pc);
        line.querySelector(".kiln-widget-asm-ptr").textContent = i === pc ? "▶" : " ";
      });
      stepBtn.disabled = pc >= STEPPER_PROGRAM.length;
      runBtn.disabled = pc >= STEPPER_PROGRAM.length;
    }

    function step() {
      if (pc >= STEPPER_PROGRAM.length) return;
      const ins = STEPPER_PROGRAM[pc];
      ins.run(st);
      pc++;
      render(ins.reg);
    }

    stepBtn.addEventListener("click", step);
    runBtn.addEventListener("click", function () {
      while (pc < STEPPER_PROGRAM.length) step();
    });
    resetBtn.addEventListener("click", reset);
    charInput.addEventListener("input", reset);
    iInput.addEventListener("input", reset);
    reset();
  }

  /* ---------- hydration ---------- */

  const WIDGETS = {
    "cfb1-keygen": mountKeygen,
    "cfb1-stepper": mountStepper,
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
