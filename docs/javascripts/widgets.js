/* Interactive content widgets (experimental).

   Progressive enhancement over static content: a page drops an empty
   <div class="kiln-widget" data-widget="NAME"></div> after the block
   it animates, and this script hydrates it. With JS off the div is
   empty and the surrounding prose and code stand alone.

   Mounting follows the same rules as the other scripts: idempotent and
   re-run via KilnUtils.onPageChange (navigation.instant swaps the
   content DOM), lazy (no work on pages without a widget), and a node is
   marked once mounted so a re-run never double-hydrates it.

   Three widgets, all built on the same terminal-prompt scaffold
   (createTerm): cfb1-keygen, a live keygen for the CFB1 writeup that
   reimplements that page's verified derivation
   (byte = (((i + 0x5A) ^ c) + 0x13) & 0xFF) — keeping it in step with
   the prose is the price of a self-checking document —
   twos-complement on CSAPP chapter 3's §3.5.4, one integer literal
   read at a chosen width as raw bits, hex, unsigned, and signed: the
   passage's same-bits-two-readings point made interactive — and
   ds-roadmap on the DS Roadmap guide, a progress tracker that turns
   the page's step lists into checklists and reports the totals. */

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

  /* One integer literal (dec, 0x, 0b, 0d, optional leading -) as a
     BigInt, or null when the text is not one. The sign is split off
     before BigInt() because BigInt("-0x10") throws, and the 0d prefix
     is stripped because BigInt does not know it. The readout itself
     is KilnUtils.twosReadout, shared with the palette's :x -wN mode. */
  function parseIntLiteral(text) {
    const match = /^(-?)(0[xX][0-9a-fA-F]+|0[bB][01]+|0[dD][0-9]+|[0-9]+)$/.exec(
      text.trim()
    );
    if (!match) return null;
    const digits = /^0[dD]/.test(match[2]) ? match[2].slice(2) : match[2];
    const magnitude = BigInt(digits);
    return match[1] ? -magnitude : magnitude;
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
      function (out, text) {
        const value = parseIntLiteral(text);
        const readout =
          value === null
            ? { error: "not an integer literal (dec, 0x, 0b, 0d)" }
            : KilnUtils.twosReadout(value, width);
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

  /* ---------- DS roadmap tracker ---------- */

  /* The DS Roadmap guide's steps are plain list items that open with a
     week token carrying the step id:
         - `W01-02`{ data-step=py-01 } [Lectures 1 and 2](…) …
     With JS off that is the whole page: a readable, linked list. This
     widget upgrades it into a tracker — every step gains a [ ]/[x]
     toggle, every list a meter, and the widget root becomes the
     dashboard: `$ roadmap --start <date>` with the week in progress,
     done-versus-plan bars, one bar per phase (an h2 holding steps),
     and the state line.

     The record ({start, done ids}) lives in localStorage only. The
     state line is its portable form, `ds1/<start>/<prefix>:<ranges>,…`
     (ids are `<prefix>-<nn>`, so `py:1-4+7` is py-01..py-04 and
     py-07); pasted at the prompt it replaces the record, which is how
     progress moves between browsers. Ids, not list positions, key the
     record, so editing the page's steps never shifts what was ticked.

     The toggles are buttons, not checkboxes: KilnUtils.isTypingTarget
     counts every <input> as a typing target, and a focused checkbox
     would switch the site's key bindings off until it lost focus. */

  const ROADMAP_KEY = "kiln.ds-roadmap.v1";
  const ROADMAP_WEEKS = 52;
  const DAY_MS = 86400000;

  function roadmapLoad() {
    try {
      const raw = JSON.parse(localStorage.getItem(ROADMAP_KEY) || "{}");
      return {
        start: typeof raw.start === "string" ? raw.start : "",
        done: Array.isArray(raw.done) ? raw.done.map(String) : [],
      };
    } catch (error) {
      return { start: "", done: [] };
    }
  }

  /* Storage can be unavailable (privacy modes, blocked site data); the
     tracker then works for the visit and says so on the state line. */
  function roadmapSave(state) {
    try {
      localStorage.setItem(ROADMAP_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      return false;
    }
  }

  /* A real calendar date as UTC midnight, or null — Date.UTC rolls
     2026-02-31 over to March, so the round trip is the validity test. */
  function parseIsoDate(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return null;
    const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
    return date.toISOString().slice(0, 10) === text ? date : null;
  }

  function isoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  /* Today as UTC midnight of the local calendar day, so week
     arithmetic against parseIsoDate never straddles a DST change. */
  function todayUtc() {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  /* ["py-01","py-02","py-04","c1-01"] -> "py:1-2+4,c1:1" */
  function encodeDone(ids) {
    const groups = new Map();
    ids.forEach(function (id) {
      const match = /^([a-z0-9]+)-(\d+)$/.exec(id);
      if (!match) return;
      if (!groups.has(match[1])) groups.set(match[1], []);
      groups.get(match[1]).push(+match[2]);
    });
    const parts = [];
    groups.forEach(function (numbers, prefix) {
      numbers.sort(function (a, b) {
        return a - b;
      });
      const runs = [];
      numbers.forEach(function (n) {
        const last = runs[runs.length - 1];
        if (last && n === last[1] + 1) last[1] = n;
        else if (!last || n !== last[1]) runs.push([n, n]);
      });
      parts.push(
        prefix +
          ":" +
          runs
            .map(function (run) {
              return run[0] === run[1] ? String(run[0]) : run[0] + "-" + run[1];
            })
            .join("+")
      );
    });
    return parts.join(",");
  }

  /* The inverse, or null when the text is not a well-formed list. */
  function decodeDone(text) {
    const ids = [];
    if (!text) return ids;
    const groups = text.split(",");
    for (let g = 0; g < groups.length; g++) {
      const match = /^([a-z0-9]+):(\d+(?:-\d+)?(?:\+\d+(?:-\d+)?)*)$/.exec(groups[g]);
      if (!match) return null;
      const runs = match[2].split("+");
      for (let r = 0; r < runs.length; r++) {
        const ends = runs[r].split("-").map(Number);
        const from = ends[0];
        const to = ends.length > 1 ? ends[1] : from;
        if (to < from || to - from > 999) return null;
        for (let n = from; n <= to; n++) {
          ids.push(match[1] + "-" + String(n).padStart(2, "0"));
        }
      }
    }
    return ids;
  }

  function encodeState(state) {
    return "ds1/" + state.start + "/" + encodeDone(state.done);
  }

  /* {start, done} from a state code, or null. */
  function decodeState(text) {
    const match = /^ds1\/(\d{4}-\d{2}-\d{2})?\/([a-z0-9:+,-]*)$/.exec(text);
    if (!match) return null;
    if (match[1] && !parseIsoDate(match[1])) return null;
    const done = decodeDone(match[2]);
    return done ? { start: match[1] || "", done: done } : null;
  }

  function meterBar(done, total, cells) {
    const filled = total ? Math.round((done / total) * cells) : 0;
    /* A started bar never reads empty and an unfinished one never
       reads full. */
    const shown =
      done > 0 && filled === 0 ? 1 : done < total && filled === cells ? cells - 1 : filled;
    return "█".repeat(shown) + "░".repeat(cells - shown);
  }

  function weekLabel(n) {
    return "W" + String(n).padStart(2, "0");
  }

  function mountRoadmap(root) {
    const scope = root.closest(".md-typeset") || document;
    const state = roadmapLoad();
    let stored = true;
    let message = "";

    /* Collect the steps in document order, grouped under the h2 (phase)
       that precedes them. */
    const steps = [];
    const phases = [];
    const lists = [];
    let phase = null;
    scope.querySelectorAll("h2, [data-step]").forEach(function (node) {
      if (node.tagName === "H2") {
        phase = { steps: [] };
        return;
      }
      const item = node.closest("li");
      const weeks = /^W(\d{2})(?:-(\d{2}))?$/.exec(node.textContent.trim());
      if (!item || !weeks || !phase) return;
      const step = {
        id: node.getAttribute("data-step"),
        item: item,
        chip: node,
        from: +weeks[1],
        to: +(weeks[2] || weeks[1]),
      };
      steps.push(step);
      if (!phase.steps.length) phases.push(phase);
      phase.steps.push(step);
      const list = item.parentElement;
      let entry = lists.find(function (candidate) {
        return candidate.list === list;
      });
      if (!entry) {
        entry = { list: list, steps: [] };
        lists.push(entry);
      }
      entry.steps.push(step);
    });
    if (!steps.length) return;

    const known = new Set(
      steps.map(function (step) {
        return step.id;
      })
    );
    const isDone = function (step) {
      return state.done.indexOf(step.id) !== -1;
    };
    const countDone = function (group) {
      return group.filter(isDone).length;
    };

    /* Upgrade each step: wrap its content so the toggle sits in its
       own column, and prepend the toggle. */
    steps.forEach(function (step) {
      const body = el("span", "kiln-step-body");
      while (step.item.firstChild) body.appendChild(step.item.firstChild);
      const box = el("button", "kiln-step-box");
      box.type = "button";
      box.setAttribute("role", "checkbox");
      box.setAttribute(
        "aria-label",
        body.textContent.replace(/\s+/g, " ").trim().slice(0, 90)
      );
      box.addEventListener("click", function () {
        const at = state.done.indexOf(step.id);
        if (at === -1) state.done.push(step.id);
        else state.done.splice(at, 1);
        message = "";
        stored = roadmapSave(state);
        sync();
      });
      step.box = box;
      step.item.classList.add("kiln-step");
      step.item.appendChild(box);
      step.item.appendChild(body);
    });

    lists.forEach(function (entry) {
      entry.list.classList.add("kiln-steps");
      entry.meter = el("div", "kiln-steps-meter");
      entry.list.parentNode.insertBefore(entry.meter, entry.list);
    });

    /* The week in progress for a start date: 1-based, 0 before the
       start, above ROADMAP_WEEKS after the end; null with no date. */
    function currentWeek() {
      const start = parseIsoDate(state.start);
      if (!start) return null;
      const days = Math.round((todayUtc() - start) / DAY_MS);
      return days < 0 ? 0 : Math.floor(days / 7) + 1;
    }

    function weekDates(from, to) {
      const start = parseIsoDate(state.start);
      if (!start) return "";
      const first = new Date(start.getTime() + (from - 1) * 7 * DAY_MS);
      const last = new Date(start.getTime() + (to * 7 - 1) * DAY_MS);
      return isoDate(first) + " to " + isoDate(last);
    }

    /* The prompt takes a start date, a state code, or nothing. Returns
       an error string for anything else. */
    function accept(text) {
      const value = text.trim();
      if (value === state.start) return "";
      if (value === "") {
        state.start = "";
      } else if (parseIsoDate(value)) {
        state.start = value;
      } else if (value.indexOf("ds1/") !== -1) {
        /* The prompt appends (the caret is pinned to the end), so a
           code pasted over an existing start date arrives as
           `<date>ds1/…`; the code is whatever follows the marker. */
        const incoming = decodeState(value.slice(value.indexOf("ds1/")));
        if (!incoming) return "not a state code";
        state.start = incoming.start;
        state.done = incoming.done.filter(function (id) {
          return known.has(id);
        });
        message = "restored " + state.done.length + " of " + steps.length + " steps";
        stored = roadmapSave(state);
        return "restored";
      } else {
        return /^\d{0,4}(-\d{0,2}){0,2}$/.test(value)
          ? "start date as YYYY-MM-DD"
          : "not a date (YYYY-MM-DD) or a state code";
      }
      message = "";
      stored = roadmapSave(state);
      return "";
    }

    function row(out, label, text, className) {
      if (out.childNodes.length) out.appendChild(document.createTextNode("\n"));
      out.appendChild(el("span", "kiln-term-echo", label.padEnd(9)));
      out.appendChild(className ? el("span", className, text) : document.createTextNode(text));
    }

    function paintDashboard(out, error) {
      const total = steps.length;
      const done = countDone(steps);
      const week = currentWeek();
      const pad = String(total).length;
      const count = function (n, of) {
        return String(n).padStart(pad) + "/" + of;
      };
      /* Bars shrink on a narrow column so a row never wraps mid-bar
         (measured at paint time; a later resize keeps the old width
         until the next repaint). */
      const narrow = root.clientWidth < 560;
      const wide = narrow ? 14 : 30;
      const short = narrow ? 8 : 20;

      if (error) row(out, "error", error, "kiln-term-err");
      if (week === null) {
        row(out, "week", "no start date. type one at the prompt as YYYY-MM-DD", "kiln-term-err");
      } else if (week === 0) {
        row(out, "week", "starts " + state.start);
      } else if (week > ROADMAP_WEEKS) {
        row(out, "week", "past " + weekLabel(ROADMAP_WEEKS) + ", ended " + weekDates(ROADMAP_WEEKS, ROADMAP_WEEKS).slice(-10));
      } else {
        row(out, "week", weekLabel(week) + " of " + ROADMAP_WEEKS + "  " + weekDates(week, week));
      }

      row(out, "done", meterBar(done, total, wide) + "  " + count(done, total) + "  " + Math.floor((done / total) * 100) + "%", "kiln-term-serial");
      if (week !== null && week > 0) {
        /* Planned = every step whose last week is already over. */
        const planned = steps.filter(function (step) {
          return step.to < week;
        }).length;
        const lead = done - planned;
        row(
          out,
          "plan",
          meterBar(planned, total, wide) +
            "  " +
            count(planned, total) +
            "  " +
            (lead === 0
              ? "on schedule"
              : Math.abs(lead) + (Math.abs(lead) === 1 ? " step " : " steps ") + (lead > 0 ? "ahead" : "behind"))
        );
      }

      out.appendChild(document.createTextNode("\n"));
      phases.forEach(function (group, index) {
        const from = Math.min.apply(null, group.steps.map(function (step) { return step.from; }));
        const to = Math.max.apply(null, group.steps.map(function (step) { return step.to; }));
        row(
          out,
          "phase " + (index + 1),
          weekLabel(from) + "-" + String(to).padStart(2, "0") + "  " +
            meterBar(countDone(group.steps), group.steps.length, short) + "  " +
            count(countDone(group.steps), group.steps.length)
        );
      });

      out.appendChild(document.createTextNode("\n"));
      row(out, "state", encodeState(state) + " ");
      const copy = el("button", "kiln-term-flag", "copy");
      copy.type = "button";
      copy.setAttribute("aria-label", "copy the state code");
      copy.addEventListener("click", function (event) {
        event.stopPropagation(); /* not a focus-the-prompt click */
        const done = function (label) {
          copy.textContent = label;
        };
        try {
          navigator.clipboard.writeText(encodeState(state)).then(
            function () { done("copied"); },
            function () { done("select and copy"); }
          );
        } catch (failure) {
          done("select and copy");
        }
      });
      out.appendChild(copy);
      if (message) row(out, "", message);
      if (!stored) row(out, "", "browser storage is unavailable, so this record ends with the visit", "kiln-term-err");
    }

    /* Repaint what lives in the page rather than in the dashboard:
       toggles, step classes, week tooltips, list meters. */
    function syncSteps() {
      const week = currentWeek();
      steps.forEach(function (step) {
        const done = isDone(step);
        step.box.textContent = done ? "[x]" : "[ ]";
        step.box.setAttribute("aria-checked", done ? "true" : "false");
        step.item.classList.toggle("kiln-step--done", done);
        step.item.classList.toggle(
          "kiln-step--now",
          !done && week !== null && week >= step.from && week <= step.to
        );
        step.item.classList.toggle("kiln-step--late", !done && week !== null && week > step.to);
        const dates = weekDates(step.from, step.to);
        if (dates) step.chip.title = dates;
        else step.chip.removeAttribute("title");
      });
      lists.forEach(function (entry) {
        const done = countDone(entry.steps);
        entry.meter.textContent =
          meterBar(done, entry.steps.length, 12) + " " + done + "/" + entry.steps.length;
      });
    }

    /* Everything that depends on the record, dashboard included. */
    function sync() {
      syncSteps();
      term.refresh();
    }

    const term = createTerm(
      ["roadmap --start "],
      state.start,
      "start date or state code",
      function (out, value) {
        const before = state.start;
        const result = accept(value);
        if (result === "restored") {
          /* A pasted state code is consumed: the prompt goes back to
             showing the start date it carried. */
          input.value = state.start;
          sync();
          return;
        }
        /* A new start date moves the week in progress, and with it
           the step highlights and tooltips. */
        if (state.start !== before) syncSteps();
        paintDashboard(out, result);
      }
    );
    const input = term.term.querySelector(".kiln-term-input");
    root.appendChild(term.term);
    sync();
  }

  /* ---------- hydration ---------- */

  const WIDGETS = {
    "cfb1-keygen": mountKeygen,
    "twos-complement": mountTwosComplement,
    "ds-roadmap": mountRoadmap,
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
