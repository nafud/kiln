/* Jump-to-page palette, the site's navigation and its search.

   ` (backtick) or Ctrl/Cmd+K summons the prompt on any page — the
   homepage's inline bar when it is mounted, an overlay everywhere
   else. Material's own search UI is hidden by extra.css, and its
   s/S/F// search bindings are neutralized by key-nav.js's swallow
   listener. Type to fuzzy-match every page by title and path,
   ArrowDown/ArrowUp to pick, Enter to go. The prompt rests as a bar
   with a █ terminal cursor (steady while unfocused, blinking while
   focused) and a faint "type :h for help" placeholder; results only
   exist while a query is typed. A leading colon is vim command-line
   mode, parsed exactly and never reaching page search: :h/:help
   print the binding table (HELP_ROWS below), :version the deployed
   build stamp (version.json; "local build" when absent), :intro the
   vim-style welcome screen, and any unknown :name answers with
   vim's E492. That IS the site's help — the commands are its only
   trigger. A leading slash is vim's buffer search over the notes:
   /pattern greps section body text (the #fragment index entries the
   page view drops) case-insensitively and returns page › section
   rows with a hit excerpt, landing on the section anchor. Escape
   (or a click on the backdrop) closes. The result
   rows are real links and navigation happens by clicking them,
   which keeps navigation.instant in charge (same rule as
   key-nav.js).

   The same component has an inline variant that always mounts on the
   homepage, under the ASCII logo with its input focused, so the
   homepage is a prompt. Its results render as a dropdown floating
   over the content below the bar (extra.css positions the list
   absolutely), so matching never changes the page height. The card
   grid in the homepage Markdown is the no-JS fallback: the pre-paint
   script in overrides/main.html stamps kiln-js on the html element,
   and extra.css hides the homepage cards under it (category landing
   pages keep their card grids — the rule is gated on the ASCII logo).

   Pages come from the search plugin's search_index.json, the same data
   Material's search uses, fetched lazily once per full page load — no
   extra build step. The overlay lives on document.body and survives
   navigation.instant; the inline variant is remounted per homepage
   visit via KilnUtils.onPageChange. */

(function () {
  "use strict";

  const MAX_RESULTS = 8;

  /* The keyboard bindings and : commands the :h table prints, [keys,
     description] per row (keys comma-joined, descriptions lowercase).
     The key bindings themselves live in key-nav.js — keep this table
     in sync when they change. */
  const HELP_ROWS = [
    [["gg", "G"], "jump to top / bottom"],
    [["k", "j"], "scroll up / down"],
    [["[", "]"], "navigate headings"],
    [["<", ">"], "navigate pages"],
    [["0"], "home"],
    [["`"], "search"],
    [["s"], "toggle sidebars"],
    [["t"], "toggle theme"],
    [["/pattern"], "search inside pages"],
    [[":version"], "show build info"],
    [[":intro"], "show intro screen"],
    [[":h", ":help"], "display this help"],
  ];

  /* ---------- page data ---------- */

  /* The header logo links to the site root on every page, at the right
     relative depth, so it doubles as the base for site-absolute URLs
     (key-nav.js clicks the same element for the 0 key). */
  function siteBase() {
    const logo = document.querySelector(".md-header a.md-logo");
    return new URL(logo ? logo.getAttribute("href") : ".", location.href);
  }

  /* One fetch of the search plugin's index feeds both views below.
     Cached for the lifetime of the full page load; a failed fetch
     clears the cache so a later open retries. */
  let indexPromise = null;
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(new URL("search/search_index.json", siteBase()))
        .then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        })
        .catch(function (error) {
          indexPromise = null;
          throw error;
        });
    }
    return indexPromise;
  }

  /* Pages: index entries without a #fragment — what typed queries
     fuzzy-match. */
  let pagesCache = null;
  function loadPages() {
    if (pagesCache) return Promise.resolve(pagesCache);
    return loadIndex().then(function (index) {
      const base = siteBase();
      pagesCache = index.docs
        .filter(function (doc) {
          return doc.location.indexOf("#") === -1;
        })
        .map(function (doc) {
          return {
            title: doc.title,
            path: doc.location.replace(/\/$/, ""),
            url: new URL(doc.location, base),
          };
        });
      return pagesCache;
    });
  }

  /* Sections: the #fragment entries the pages view drops — heading
     plus body text, what /pattern greps. The owning page's title is
     resolved from the pages pass (page entries precede their
     sections in the index). */
  let sectionsCache = null;
  function loadSections() {
    if (sectionsCache) return Promise.resolve(sectionsCache);
    return loadIndex().then(function (index) {
      const base = siteBase();
      const pageTitles = {};
      index.docs.forEach(function (doc) {
        if (doc.location.indexOf("#") === -1) {
          pageTitles[doc.location] = doc.title;
        }
      });
      sectionsCache = index.docs
        .filter(function (doc) {
          return doc.location.indexOf("#") !== -1;
        })
        .map(function (doc) {
          const pageLocation = doc.location.split("#")[0];
          /* The index's text field carries markup remnants (code
             blocks arrive as literal <pre><code> runs and entities);
             excerpts must read as prose, so both are dropped here,
             once, at build. */
          const text = (doc.text || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, " ")
            .trim();
          return {
            title: doc.title,
            titleLower: doc.title.toLowerCase(),
            pageTitle: pageTitles[pageLocation] || pageLocation,
            text: text,
            textLower: text.toLowerCase(),
            url: new URL(doc.location, base),
          };
        });
      return sectionsCache;
    });
  }

  /* Fetches the build stamp deploy.yml writes next to the site
     (version.json). null means the file is absent — every local
     mkdocs serve — and :version reports a local build; caching the
     null is fine, the answer cannot change within a page load. */
  let versionPromise = null;
  function loadVersion() {
    if (!versionPromise) {
      versionPromise = fetch(new URL("version.json", siteBase()))
        .then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.json();
        })
        .catch(function () {
          return null;
        });
    }
    return versionPromise;
  }

  /* ---------- fuzzy matching ---------- */

  const BOUNDARY = /[\s/\-._]/;

  /* One query term against one haystack; no match is -Infinity. A
     literal substring hit is checked first and always outranks the
     fallback: greedy left-to-right subsequence matching finds the
     earliest scatter, not the tightest one, so on its own it prefers
     "Chapter 3 ... repreSentAtion ..." over a compact "csapp" sitting
     later in the path. In both branches boundary-aligned hits score
     extra and spread costs a little. */
  function termScore(term, text) {
    const at = text.indexOf(term);
    if (at !== -1) {
      let score = term.length * 3;
      if (at === 0 || BOUNDARY.test(text[at - 1])) score += 4;
      return score;
    }
    let score = 0;
    let from = 0;
    let prev = -2;
    for (let i = 0; i < term.length; i++) {
      const hit = text.indexOf(term[i], from);
      if (hit === -1) return -Infinity;
      score += 1;
      if (hit === prev + 1) score += 2;
      if (hit === 0 || BOUNDARY.test(text[hit - 1])) score += 2;
      score -= Math.min((hit - from) * 0.02, 1);
      prev = hit;
      from = hit + 1;
    }
    return score;
  }

  /* Whitespace-separated terms must all match, each against title and
     path together, so "csapp 3" finds the chapter even though "csapp"
     only appears in the path. */
  function pageScore(query, page) {
    const haystack = (page.title + " " + page.path).toLowerCase();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    let total = 0;
    for (let i = 0; i < terms.length; i++) {
      const score = termScore(terms[i], haystack);
      if (score === -Infinity) return -Infinity;
      total += score;
    }
    return total;
  }

  /* The page currently open is never offered. An empty query matches
     nothing — the prompt stays a clean bar until typed into (render()
     short-circuits it before this is called). */
  function matchPages(query, pages) {
    const candidates = pages.filter(function (page) {
      return page.url.pathname !== location.pathname;
    });
    const scored = [];
    candidates.forEach(function (page) {
      const score = pageScore(query, page);
      if (score !== -Infinity) scored.push({ page: page, score: score });
    });
    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    return scored.slice(0, MAX_RESULTS).map(function (entry) {
      return entry.page;
    });
  }

  /* /pattern content search, vim's buffer search over the notes:
     case-insensitive literal substring (vim 'ignorecase') against
     section headings and body text. Heading hits outrank body hits,
     more and earlier hits rank higher. Results are shaped like page
     rows, with an excerpt around the first hit in the path slot. */
  function matchContent(pattern, sections) {
    const needle = pattern.toLowerCase();
    const scored = [];
    sections.forEach(function (section) {
      const inTitle = section.titleLower.indexOf(needle) !== -1;
      const at = section.textLower.indexOf(needle);
      if (!inTitle && at === -1) return;
      let count = 0;
      let from = at;
      while (from !== -1 && count < 20) {
        count++;
        from = section.textLower.indexOf(needle, from + needle.length);
      }
      const score =
        (inTitle ? 100 : 0) +
        count * 5 -
        (at === -1 ? 0 : Math.min(at, 500) * 0.01);
      scored.push({ section: section, score: score, at: at });
    });
    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    return scored.slice(0, MAX_RESULTS).map(function (entry) {
      const section = entry.section;
      return {
        title: section.pageTitle + " › " + section.title,
        path: contentExcerpt(section, entry.at, needle),
        url: section.url,
      };
    });
  }

  function contentExcerpt(section, at, needle) {
    if (at === -1) return section.text.slice(0, 60);
    const start = Math.max(0, at - 24);
    const end = at + needle.length + 36;
    return (
      (start > 0 ? "…" : "") +
      section.text.slice(start, end) +
      (end < section.text.length ? "…" : "")
    );
  }

  /* ---------- palette component ---------- */

  /* Builds one palette instance ("overlay" or "inline" — same markup
     and behavior, extra.css positions them differently). onDismiss runs
     on Escape; the overlay closes, the inline variant just blurs. */
  function createPalette(variant, onDismiss) {
    const listId = "kiln-jump-results-" + variant;

    const root = document.createElement("div");
    root.className = "kiln-jump kiln-jump--" + variant;

    const panel = document.createElement("div");
    panel.className = "kiln-jump-panel";

    const row = document.createElement("label");
    row.className = "kiln-jump-row";

    const prompt = document.createElement("span");
    prompt.className = "kiln-jump-prompt";
    prompt.textContent = "»";
    prompt.setAttribute("aria-hidden", "true");

    /* Terminal-style resting cursor. extra.css keeps it steady while
       the prompt is unfocused, blinks it on focus (the Linux console
       convention), and hides it (handing off to the native caret)
       once a query is typed — the typed/empty switch is driven by
       :placeholder-shown, so the placeholder below must stay
       non-empty. */
    const cursor = document.createElement("span");
    cursor.className = "kiln-jump-cursor";
    cursor.textContent = "█";
    cursor.setAttribute("aria-hidden", "true");

    const input = document.createElement("input");
    input.className = "kiln-jump-input";
    input.type = "text";
    input.spellcheck = false;
    input.autocomplete = "off";
    input.placeholder = "type :h for help";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-label", "Jump to a page");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);

    const list = document.createElement("ul");
    list.className = "kiln-jump-results";
    list.id = listId;
    list.setAttribute("role", "listbox");

    row.appendChild(prompt);
    row.appendChild(cursor);
    row.appendChild(input);
    panel.appendChild(row);
    panel.appendChild(list);
    root.appendChild(panel);

    let results = [];
    let selected = 0;
    let renderSeq = 0;

    function showMessage(text) {
      list.textContent = "";
      const item = document.createElement("li");
      item.className = "kiln-jump-empty";
      item.textContent = text;
      list.appendChild(item);
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      clampToViewport();
    }

    function paintSelection() {
      const items = list.children;
      for (let i = 0; i < items.length; i++) {
        items[i].classList.toggle("kiln-jump-result--active", i === selected);
        items[i].setAttribute("aria-selected", i === selected);
      }
      input.setAttribute("aria-activedescendant", listId + "-" + selected);
      const active = items[selected];
      if (active && active.scrollIntoView) {
        active.scrollIntoView({ block: "nearest" });
      }
    }

    /* The inline dropdown floats over the page, but an absolutely
       positioned box still extends the document's scroll extent when it
       reaches past the bottom — clamping it to the viewport keeps the
       homepage from growing a scrollbar. Re-measured per paint; the
       overlay variant scrolls inside its CSS max-height instead. */
    function clampToViewport() {
      if (variant !== "inline") return;
      list.style.maxHeight = "";
      const top = list.getBoundingClientRect().top;
      list.style.maxHeight =
        Math.max(120, window.innerHeight - top - 16) + "px";
    }

    function paintResults() {
      list.textContent = "";
      results.forEach(function (page, i) {
        const item = document.createElement("li");
        item.className = "kiln-jump-result";
        item.id = listId + "-" + i;
        item.setAttribute("role", "option");

        const link = document.createElement("a");
        link.href = page.url.href;

        const title = document.createElement("span");
        title.className = "kiln-jump-result-title";
        title.textContent = page.title;

        const path = document.createElement("span");
        path.className = "kiln-jump-result-path";
        path.textContent = page.path || "/";

        link.appendChild(title);
        link.appendChild(path);
        item.appendChild(link);
        list.appendChild(item);
      });
      input.setAttribute("aria-expanded", results.length ? "true" : "false");
      clampToViewport();
      paintSelection();
    }

    /* One pre of monospace text in the dropdown — the shared body of
       every : command's output, so the command line answers in kind.
       Not options: results stays empty, Arrow/Enter are inert and the
       listbox stays collapsed for AT. A line is a string, or an array
       of DOM nodes for the few dim spans the intro screen needs. */
    function paintOutput(lines) {
      results = [];
      list.textContent = "";
      const item = document.createElement("li");
      item.className = "kiln-jump-help";
      const pre = document.createElement("pre");
      lines.forEach(function (line, i) {
        if (i) pre.appendChild(document.createTextNode("\n"));
        if (typeof line === "string") {
          pre.appendChild(document.createTextNode(line));
        } else {
          line.forEach(function (node) {
            pre.appendChild(node);
          });
        }
      });
      item.appendChild(pre);
      list.appendChild(item);
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      clampToViewport();
    }

    function paintHelp() {
      const rows = HELP_ROWS.map(function (row) {
        return { keys: row[0].join(", "), label: row[1] };
      });
      const width = rows.reduce(function (w, r) {
        return Math.max(w, r.keys.length);
      }, 0);
      paintOutput(
        rows.map(function (r) {
          return "  " + r.keys + " ".repeat(width - r.keys.length + 3) + r.label;
        })
      );
    }

    /* :intro — the vim welcome screen, Kiln edition. The page count
       comes from the same lazily fetched index the search uses; the
       screen still renders if the fetch fails, just without the
       stats line. The dimmed <Enter> tokens mirror vim's. */
    function paintIntro() {
      const seq = renderSeq;
      const paint = function (pageCount) {
        const dim = function (t) {
          const span = document.createElement("span");
          span.className = "kiln-jump-dim";
          span.textContent = t;
          return span;
        };
        const text = function (t) {
          return document.createTextNode(t);
        };
        const typeRows = [
          [":help", "for help"],
          [":version", "for build info"],
          ["/pattern", "to search the notes"],
        ];
        const cmdWidth = typeRows.reduce(function (w, r) {
          return Math.max(w, r[0].length);
        }, 0);
        const typeRow = function (cmd, desc) {
          return [
            text("type  " + cmd),
            dim("<Enter>"),
            text(" ".repeat(cmdWidth - cmd.length + 3) + desc),
          ];
        };
        const lines = [
          "      KILN - a personal knowledge base",
          "",
          "             by Ravan Huseynli",
          "",
        ]
          .concat(
            typeRows.map(function (r) {
              return typeRow(r[0], r[1]);
            })
          );
        if (pageCount) {
          lines.push("");
          lines.push("        " + pageCount + " pages across 6 sections");
        }
        paintOutput(lines);
      };
      loadPages().then(
        function (pages) {
          if (seq === renderSeq) paint(pages.length);
        },
        function () {
          if (seq === renderSeq) paint(null);
        }
      );
    }

    function paintVersion() {
      const seq = renderSeq;
      loadVersion().then(function (version) {
        if (seq !== renderSeq) return;
        paintOutput(
          version
            ? ["KILN build " + version.commit + " (" + version.date + ")"]
            : ["KILN local build"]
        );
      });
    }

    /* The : command line, vim dialect. Exact names only; anything
       unknown gets vim's own error. A bare colon does nothing, as in
       vim. Runs before page search, so a leading colon never reaches
       the fuzzy matcher. */
    function runCommand(name) {
      if (name === "h" || name === "help") paintHelp();
      else if (name === "intro") paintIntro();
      else if (name === "version") paintVersion();
      else paintOutput(["E492: Not an editor command: " + name]);
    }

    /* The fetch resolves asynchronously; the sequence guard drops a
       stale render finishing after a newer keystroke's. An empty
       query (or a bare colon) clears the list synchronously and
       skips the fetch, so the index is not even loaded until the
       first real keystroke; : input goes to the command line and
       never reaches page search. */
    function render() {
      const seq = ++renderSeq;
      const query = input.value.trim();
      if (!query || query === ":") {
        results = [];
        list.textContent = "";
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        return;
      }
      if (query.charAt(0) === ":") {
        runCommand(query.slice(1));
        return;
      }
      if (query.charAt(0) === "/") {
        /* Content search from two typed characters on; a lone slash
           (or one letter) stays a clean bar, like the empty query. */
        const pattern = query.slice(1);
        if (pattern.length < 2) {
          results = [];
          list.textContent = "";
          input.setAttribute("aria-expanded", "false");
          input.removeAttribute("aria-activedescendant");
          return;
        }
        loadSections().then(
          function (sections) {
            if (seq !== renderSeq) return;
            results = matchContent(pattern, sections);
            selected = 0;
            if (results.length) paintResults();
            else showMessage("no matches");
          },
          function () {
            if (seq !== renderSeq) return;
            results = [];
            showMessage("page index unavailable");
          }
        );
        return;
      }
      loadPages().then(
        function (pages) {
          if (seq !== renderSeq) return;
          results = matchPages(input.value, pages);
          selected = 0;
          if (results.length) paintResults();
          else showMessage("no matches");
        },
        function () {
          if (seq !== renderSeq) return;
          results = [];
          showMessage("page index unavailable");
        }
      );
    }

    function openSelected() {
      const item = list.children[selected];
      const link = item && item.querySelector("a");
      if (link) link.click();
    }

    input.addEventListener("input", render);

    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (results.length) {
          const step = event.key === "ArrowDown" ? 1 : -1;
          selected = (selected + step + results.length) % results.length;
          paintSelection();
        }
        event.preventDefault();
      } else if (event.key === "Enter") {
        openSelected();
        event.preventDefault();
      } else if (event.key === "Escape") {
        onDismiss();
        event.preventDefault();
        event.stopPropagation();
      }
    });

    return {
      root: root,
      input: input,
      reset: function () {
        input.value = "";
        render();
      },
    };
  }

  /* ---------- overlay ---------- */

  let overlay = null;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = createPalette("overlay", closeOverlay);
    overlay.root.addEventListener("click", function (event) {
      if (event.target === overlay.root) closeOverlay();
    });
    document.body.appendChild(overlay.root);
    return overlay;
  }

  function overlayOpen() {
    return !!overlay && overlay.root.classList.contains("kiln-jump--open");
  }

  function openOverlay() {
    ensureOverlay();
    overlay.root.classList.add("kiln-jump--open");
    overlay.reset();
    overlay.input.focus();
  }

  function closeOverlay() {
    if (!overlayOpen()) return;
    overlay.root.classList.remove("kiln-jump--open");
    overlay.input.blur();
  }

  /* Puts the caret in the nearest prompt: the homepage's inline bar
     when one is mounted, the overlay everywhere else. ` and
     Ctrl/Cmd+K both funnel here. */
  function openPrompt() {
    const inline = document.querySelector(".kiln-jump--inline .kiln-jump-input");
    if (inline) inline.focus();
    else openOverlay();
  }


  /* Capture phase, matching key-nav.js's swallow listener (which
     neutralizes Material's own s/S/F// search bindings — lowercase s
     toggles the sidebars there, the palette is backtick's alone). */
  window.addEventListener(
    "keydown",
    function (event) {
      const inPalette =
        event.target instanceof Element && event.target.closest(".kiln-jump");

      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        if (event.key === "k" || event.key === "K") {
          if (overlayOpen()) closeOverlay();
          else openPrompt();
          event.preventDefault();
        }
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      if (event.key === "`") {
        /* Toggle from anywhere except foreign typing contexts (the
           palette's own input still closes/blurs on backtick, so the key
           reads as enter-and-leave-the-prompt). */
        if (KilnUtils.isTypingTarget(event.target) && !inPalette) return;
        if (overlayOpen()) closeOverlay();
        else if (inPalette) event.target.blur();
        else openPrompt();
        event.preventDefault();
      }
    },
    true
  );

  /* ---------- homepage prompt ---------- */

  /* Mounts the inline palette on the homepage, recognized by the
     ASCII logo (the same gate the homepage CSS uses).
     navigation.instant replaces the content DOM, so this runs on
     every page change; leaving the homepage discards the mount with
     the rest of the content. */
  function syncHomepage() {
    const ascii = document.querySelector(".md-content .kiln-ascii");
    if (!ascii || document.querySelector(".kiln-jump--inline")) return;
    const inline = createPalette("inline", function () {
      inline.input.blur();
    });
    ascii.insertAdjacentElement("afterend", inline.root);
    inline.reset();
    inline.input.focus();
  }

  KilnUtils.onPageChange(function () {
    closeOverlay();
    syncHomepage();
  });
})();
