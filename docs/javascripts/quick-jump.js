/* Jump-to-page palette, the site's navigation and its search.

   ` (backtick) or Ctrl/Cmd+K summons the prompt on any page — the
   homepage's inline bar when it is mounted, an overlay everywhere
   else. Material's own search UI is hidden by extra.css, and its
   s/S/F// search bindings are neutralized by key-nav.js's swallow
   listener. A typed query searches everything: pages fuzzy-matched
   by title and path rank first, then section content fills the
   remaining rows (as page › section rows landing on the anchor), so
   a term living only in body text still surfaces.
   ArrowDown/ArrowUp to pick, Enter to go. The prompt rests as a bar
   with a █ terminal cursor (steady while unfocused, blinking while
   focused) and a faint "type :h for help" placeholder; results only
   exist while a query is typed. A leading colon is vim command-line
   mode, parsed exactly and never reaching page search: :h/:help
   print the binding table (HELP_SECTIONS below), :version the deployed
   build stamp (version.json; "local build" when absent), :intro the
   vim-style welcome screen, and any unknown :name answers with
   vim's E492. That IS the site's help — the commands are its only
   trigger. A leading slash is vim's buffer search over the notes:
   /pattern greps section headings and body text case-insensitively —
   including each page's pre-heading text (intros, TL;DRs, metadata),
   which the index stores on the page-level entry and older revisions
   of this script never searched. Escape
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
  const MAX_SECTIONS_PER_PAGE = 2; /* content rows one page may occupy */

  /* The :h table, grouped into labelled sections. Each row is [keys,
     description] (keys comma-joined). The key bindings themselves live
     in key-nav.js — keep this in sync when they change. */
  const HELP_SECTIONS = [
    ["NAVIGATION", [
      [["k", "j"], "Scroll up / down"],
      [["gg", "G"], "Jump to top / bottom"],
      [["[", "]"], "Navigate headings"],
      [["<", ">"], "Navigate pages"],
      [["0"], "Home"],
    ]],
    ["SEARCH", [
      [["`"], "Search"],
      [["/pattern"], "Grep page text"],
    ]],
    ["VIEW", [
      [["s"], "Toggle sidebars"],
      [["t"], "Toggle theme"],
    ]],
    ["COMMANDS", [
      [[":intro"], "Show intro screen"],
      [[":version"], "Show build info"],
      [[":h", ":help"], "Display this help"],
    ]],
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

  /* The index's text fields carry markup remnants (code blocks arrive
     as literal <pre><code> runs and entities); matching must see the
     real text, so both are dropped once, at build. */
  function stripMarkup(html) {
    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* The search plugin splits every page into one page-level doc (no
     #fragment in its location; its text is everything before the first
     heading — intro paragraphs, TL;DR admonitions, metadata blocks)
     plus one doc per heading section. Both are kept: the page docs
     feed the title search, and each page doc's text also joins the
     section list as an "intro" section (landing on the page itself),
     so pre-heading content is never invisible to search. */
  let dataCache = null;
  function loadData() {
    if (dataCache) return Promise.resolve(dataCache);
    return loadIndex().then(function (index) {
      const base = siteBase();
      const pageTitles = {};
      index.docs.forEach(function (doc) {
        if (doc.location.indexOf("#") === -1) {
          pageTitles[doc.location] = doc.title;
        }
      });
      const pages = [];
      const sections = [];
      index.docs.forEach(function (doc) {
        const isPage = doc.location.indexOf("#") === -1;
        const pageTitle = pageTitles[doc.location.split("#")[0]] || doc.title;
        const text = stripMarkup(doc.text || "");
        if (isPage) {
          pages.push({
            title: doc.title,
            titleLower: doc.title.toLowerCase(),
            path: doc.location.replace(/\/$/, ""),
            url: new URL(doc.location, base),
          });
          if (!text) return; /* nothing before the first heading */
        }
        sections.push({
          title: doc.title,
          titleLower: doc.title.toLowerCase(),
          pageTitle: pageTitle,
          pageTitleLower: pageTitle.toLowerCase(),
          isIntro: isPage,
          text: text,
          textLower: text.toLowerCase(),
          url: new URL(doc.location, base),
        });
      });
      dataCache = { pages: pages, sections: sections };
      return dataCache;
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

  /* Whitespace-separated query terms; every one of them must match. */
  function queryTerms(query) {
    return query.toLowerCase().split(/\s+/).filter(Boolean);
  }

  /* Every term must match the page's title and path together, so
     "csapp 3" finds the chapter even though "csapp" only appears in
     the path; a term sitting in the title itself scores a little
     extra, so title hits surface above path-only ones. */
  function pageScore(terms, page) {
    const haystack = page.titleLower + " " + page.path.toLowerCase();
    let total = 0;
    for (let i = 0; i < terms.length; i++) {
      const score = termScore(terms[i], haystack);
      if (score === -Infinity) return -Infinity;
      total += score;
      if (page.titleLower.indexOf(terms[i]) !== -1) total += 2;
    }
    return total;
  }

  /* A section matches a plain query when every term appears literally
     (no subsequence scatter — body text is too big for it to mean
     anything) in its heading, its body text, or its page's title.
     Heading hits rank highest; body hits rank by length and earliness.
     Returns the score, or null for no match. */
  function sectionScore(terms, section) {
    let total = 0;
    for (let i = 0; i < terms.length; i++) {
      const term = terms[i];
      const inTitle = section.titleLower.indexOf(term) !== -1;
      const at = section.textLower.indexOf(term);
      if (!inTitle && at === -1) {
        if (section.pageTitleLower.indexOf(term) === -1) return null;
        total += 1; /* carried by the page title alone: weakest hit */
        continue;
      }
      if (inTitle) total += 30 + term.length;
      if (at !== -1) {
        total += term.length * 2 - Math.min(at, 500) * 0.01;
      }
    }
    return total;
  }

  /* Result row for a section hit: "page › section" (the page title
     alone for intro sections — their heading is the page's). */
  function sectionRow(section) {
    return {
      title: section.isIntro
        ? section.pageTitle
        : section.pageTitle + " › " + section.title,
      url: section.url,
    };
  }

  function byScoreDesc(a, b) {
    return b.score - a.score;
  }

  /* Plain-query search over everything: pages by title/path first,
     then section content to fill the remaining rows, so a term that
     only lives in body text (a function name, a constant) still
     surfaces without the /grep prefix. Content rows are deduped
     against the page rows (an intro section duplicates its page row)
     and capped per page so one long page cannot flood the list. The
     page currently open is never offered as a page row; its sections
     still are — they land on anchors. An empty query matches nothing
     (render() short-circuits it before this is called). */
  function matchAll(query, data) {
    const terms = queryTerms(query);
    if (!terms.length) return [];

    const scoredPages = [];
    data.pages.forEach(function (page) {
      if (page.url.pathname === location.pathname) return;
      const score = pageScore(terms, page);
      if (score !== -Infinity) scoredPages.push({ page: page, score: score });
    });
    scoredPages.sort(byScoreDesc);

    const rows = [];
    const perPage = {};
    scoredPages.slice(0, MAX_RESULTS).forEach(function (entry) {
      rows.push({ title: entry.page.title, url: entry.page.url });
      perPage[entry.page.url.pathname] = MAX_SECTIONS_PER_PAGE;
    });
    if (rows.length >= MAX_RESULTS) return rows;

    const scoredSections = [];
    data.sections.forEach(function (section) {
      const score = sectionScore(terms, section);
      if (score !== null) scoredSections.push({ section: section, score: score });
    });
    scoredSections.sort(byScoreDesc);
    for (let i = 0; i < scoredSections.length && rows.length < MAX_RESULTS; i++) {
      const section = scoredSections[i].section;
      const pagePath = section.url.pathname;
      const used = perPage[pagePath] || 0;
      if (used >= MAX_SECTIONS_PER_PAGE) continue;
      if (section.isIntro && used > 0) continue; /* duplicates the page row */
      perPage[pagePath] = used + 1;
      rows.push(sectionRow(section));
    }
    return rows;
  }

  /* /pattern content search, vim's buffer search over the notes:
     case-insensitive literal substring (vim 'ignorecase') against
     section headings and body text — intro sections included, so
     pre-heading content (TL;DRs, metadata blocks) greps too. Heading
     hits outrank body hits, more and earlier hits rank higher. */
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
      scored.push({ section: section, score: score });
    });
    scored.sort(byScoreDesc);
    return scored.slice(0, MAX_RESULTS).map(function (entry) {
      return sectionRow(entry.section);
    });
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
       homepage from growing a scrollbar. The floor only guards against
       degenerate measurements; it must stay below any real remaining
       space, or the clamp itself pokes past the viewport and brings
       the scrollbar back. Re-measured per paint; the overlay variant
       scrolls inside its CSS max-height instead. */
    function clampToViewport() {
      if (variant !== "inline") return;
      list.style.maxHeight = "";
      const top = list.getBoundingClientRect().top;
      list.style.maxHeight =
        Math.max(48, window.innerHeight - top - 16) + "px";
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

        /* The title is the row's whole content: "Page" for page rows,
           "Page › Section" for content rows. No right-hand column — an
           excerpt proved more noise than signal, and the path was
           redundant with the title. */
        const title = document.createElement("span");
        title.className = "kiln-jump-result-title";
        title.textContent = page.title;
        link.appendChild(title);

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
       listbox stays collapsed for AT. opts.center block-centers the
       pre (the intro screen; every other command is left-aligned
       usage text). */
    function paintOutput(lines, opts) {
      results = [];
      list.textContent = "";
      const item = document.createElement("li");
      item.className =
        "kiln-jump-help" + (opts && opts.center ? " kiln-jump-help--center" : "");
      const pre = document.createElement("pre");
      pre.textContent = lines.join("\n");
      item.appendChild(pre);
      list.appendChild(item);
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      clampToViewport();
    }

    function paintHelp() {
      /* One key column width across every section, so descriptions
         line up site-wide, not just within a section. */
      let width = 0;
      HELP_SECTIONS.forEach(function (section) {
        section[1].forEach(function (row) {
          width = Math.max(width, row[0].join(", ").length);
        });
      });
      const lines = [];
      HELP_SECTIONS.forEach(function (section, i) {
        if (i) lines.push("");
        lines.push("[ " + section[0] + " ]");
        section[1].forEach(function (row) {
          const keys = row[0].join(", ");
          lines.push("  " + keys + " ".repeat(width - keys.length + 3) + row[1]);
        });
      });
      paintOutput(lines);
    }

    /* :intro — the welcome screen: spaced KILN title, the attribution
       line, then the six top-level sections as a hex-numbered grid
       whose [0x0N] labels are the 1-6 keys that open them, and the
       live page count. Every line is centered within the widest one
       (leading spaces), and paintOutput block-centers the whole thing.
       The section names and their order match key-nav.js's 1-6
       bindings. The page count comes from the same lazily fetched
       index the search uses; the screen still renders without it if
       the fetch fails. */
    function paintIntro() {
      const seq = renderSeq;
      const SECTIONS = ["Guides", "Links", "Books", "Bookmarks", "Courses", "Writeups"];
      const paint = function (pageCount) {
        /* [0x0N] Name for the nth section (1-based key). */
        const cell = function (i) {
          return "[0x0" + (i + 1) + "] " + SECTIONS[i];
        };
        /* Three columns, two rows, column-major so the labels read
           down: 0x01/0x02, 0x03/0x04, 0x05/0x06. */
        const colWidth = [0, 1, 2].map(function (c) {
          return Math.max(cell(2 * c).length, cell(2 * c + 1).length);
        });
        const gridRow = function (r) {
          return [0, 1, 2]
            .map(function (c) {
              const s = cell(2 * c + r);
              return c === 2 ? s : s + " ".repeat(colWidth[c] - s.length);
            })
            .join("  ");
        };
        const row0 = gridRow(0);
        const row1 = gridRow(1);
        const gridWidth = Math.max(row0.length, row1.length);
        const lines = [
          "KILN".split("").join(" "),
          "A personal knowledge base and portfolio by Ravan Huseynli.",
          "",
          row0 + " ".repeat(gridWidth - row0.length),
          row1 + " ".repeat(gridWidth - row1.length),
        ];
        if (pageCount) {
          lines.push("");
          lines.push(pageCount + " pages across 6 sections");
        }
        const width = lines.reduce(function (w, l) {
          return Math.max(w, l.length);
        }, 0);
        paintOutput(
          lines.map(function (l) {
            return " ".repeat(Math.floor((width - l.length) / 2)) + l;
          }),
          { center: true }
        );
      };
      loadData().then(
        function (data) {
          if (seq === renderSeq) paint(data.pages.length);
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
    function clearResults() {
      results = [];
      list.textContent = "";
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
    }

    function render() {
      const seq = ++renderSeq;
      const query = input.value.trim();
      if (!query || query === ":") {
        clearResults();
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
          clearResults();
          return;
        }
        search(seq, function (data) {
          return matchContent(pattern, data.sections);
        });
        return;
      }
      search(seq, function (data) {
        return matchAll(query, data);
      });
    }

    /* Shared async tail of both search modes: resolve the index, drop
       the render if a newer keystroke superseded it, paint. */
    function search(seq, match) {
      loadData().then(
        function (data) {
          if (seq !== renderSeq) return;
          results = match(data);
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
