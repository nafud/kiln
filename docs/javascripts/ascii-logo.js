/* Generative ASCII homepage logo.

   Renders CONFIG.text with the CONFIG.fontFamily webfont onto an offscreen
   canvas, samples glyph coverage per character cell, and maps it onto an
   ASCII density ramp inside <pre class="kiln-ascii">. The grid is derived
   from the measured character cell and the available container width plus a
   viewport-height budget, so the logo always fits without scrollbars.

   The grid is generated exclusively from the real CONFIG.fontFamily
   webfont — never from a fallback font, whose different metrics and
   shapes would produce a wrong-looking logo that then sticks. Until the
   font is verifiably loaded (see ensureLogoFont) the pre keeps its
   plain-text fallback, styled as a title by extra.css;
   CONFIG.generatedClass switches it to grid sizing. Failed loads retry
   with backoff, and a late success still builds. The webfont stylesheet
   is injected from here rather than @imported in extra.css so only
   pages that render the logo pay for it.

   The logo is static by itself; pointer movement drives a shimmer animation
   whose intensity envelope eases in and out. Idempotent and safe to re-run
   on navigation.instant page changes, same as page-chrome.js. */

(function () {
  "use strict";

  const CONFIG = {
    text: "Kiln",
    fontFamily: "UnifrakturMaguntia",
    fontFallback: "serif",
    fontStylesheetUrl:
      "https://fonts.googleapis.com/css2?family=UnifrakturMaguntia&display=swap",
    fontStylesheetId: "kiln-logo-font",
    generatedClass: "kiln-ascii--generated",
    /* Density ramp for the static frame: darkest ink first, background
       (space) last. Kept short on purpose — a long ramp turns
       anti-aliased edge cells into mid-density glyph mush and the
       silhouette stops reading. */
    charRamp: "$@B%8&WM#*oa+=~-:. ",
    /* Density ramp for animated frames only: the long alphabet the
       shimmer scrambles through — close to the full printable-ASCII
       set, ordered darkest ink to background. The pointer-driven
       glitch reads as terminal noise because a displaced cell can
       land on many distinct glyphs per swing — on the short static
       ramp the same fractional swing collapses to a couple of steps
       and most frames change nothing, which reads as slow and dull.
       Cells the wave has not displaced keep their exact static glyph
       (see buildFrame), so the effect settles seamlessly back into
       the crisp frame. */
    glitchRamp: "$@B%8&WM#NHKDGERSAPVFT*oahkbdpqwmZO0QLCJUYXzcvunxrjfteysg9654327/\\|()1{}[]?=-_+~<>i!lI;:,\"^`'. ",
    referenceFontPx: 200,        /* offscreen measuring/drawing font size */
    supersample: 3,              /* canvas pixels sampled per cell axis */
    inkFill: 0.94,               /* fraction of the grid the glyphs fill */
    maxViewportHeightRatio: 0.42,/* height budget so the page never scrolls */
    /* Contrast curve: coverage below the floor is background (a bare
       few antialiased pixels must not speckle the field with dots),
       above the ceiling is solid ink; the ramp spans only the band
       between, so edges get a short gradient and interiors stay
       dense. The ceiling sits low because UnifrakturMaguntia is a
       hairline blackletter: its strokes rarely fill a whole cell, and
       a high ceiling renders the entire word in faint mid-ramp
       glyphs. */
    coverageFloor: 0.05,
    coverageCeil: 0.4,
    /* UnifrakturMaguntia is a hairline blackletter; at ASCII-grid
       resolution its thin strokes cover too little of a cell and the
       word fragments. Stroking the outline on top of the fill (width
       as a fraction of referenceFontPx) thickens every stroke
       uniformly — a synthetic semi-bold — so strokes stay continuous
       cells. */
    inkBoost: 0.035,
    staticJitter: 0.08,          /* per-cell ramp offset, as a ramp fraction */
    animAmplitude: 0.2,          /* shimmer swing, as a ramp fraction */
    animSpeedRadPerMs: 0.006,
    waveDetune: 1.7,             /* frequency ratio of the secondary wave */
    /* The shimmer intensity is an envelope that eases in on movement and
       eases out after the cursor stops, rather than snapping on/off. */
    idleDelayMs: 150,            /* movement gap treated as "cursor stopped" */
    attackMs: 120,               /* shimmer fade-in time */
    /* Fade-out after the cursor stops. Deliberately much longer than
       the attack: the smoothstepped envelope then thins the noise out
       cell by cell over a full second-plus, instead of the abrupt
       cut a short release reads as. */
    releaseMs: 1400,
    resizeDebounceMs: 150,
    probeColumns: 40,            /* sample size for character cell measuring */
    /* Webfont retry schedule: fontRetryDelayMs doubles per attempt
       (250, 500, 1000, 2000ms), riding out a slow CDN or a stylesheet
       that had not parsed when the first check ran. */
    fontLoadRetries: 4,
    fontRetryDelayMs: 250,
  };

  const state = {
    pre: null,
    cols: 0,
    rows: 0,
    baseIndices: null,  /* Int16Array: jittered static ramp index per cell */
    glitchBase: null,   /* Int16Array: the same density on the glitch ramp */
    phases: null,       /* Float32Array: per-cell animation phase */
    ink: null,          /* Uint8Array: 1 where the cell contains glyph ink */
    staticFrame: "",
    buildSignature: "", /* grid + font metrics of the last generated frame */
    rafId: 0,
    lastMoveAt: 0,
    lastTickAt: 0,
    envelope: 0, /* current shimmer intensity, 0 (static) .. 1 (full) */
  };

  /* MediaQueryList objects are live, so one instance stays correct even if
     the user toggles the OS setting. */
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function clampIndex(index) {
    return Math.min(CONFIG.charRamp.length - 1, Math.max(0, index));
  }

  function clampGlitchIndex(index) {
    return Math.min(CONFIG.glitchRamp.length - 1, Math.max(0, index));
  }

  /* Perceptual easing for the envelope: the raw phase ramps linearly, and
     a linear amplitude fade reads as an abrupt stop. Smoothstep flattens
     the curve at both ends, so the shimmer swells in and dies away. */
  function smoothstep(x) {
    return x * x * (3 - 2 * x);
  }

  /* Deterministic per-cell pseudo-random value in [0, 1). Stable across
     frames so the static logo doesn't flicker between rebuilds. */
  function cellHash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  function cssFont(px) {
    return px + 'px "' + CONFIG.fontFamily + '", ' + CONFIG.fontFallback;
  }

  /* Injects the logo webfont's stylesheet on demand (memoized), so pages
     without the logo never fetch it. Resolves true on load, false on
     error; a failed link is removed and the memo cleared, so the retry
     schedule below can re-inject a fresh one. The memo is also bypassed
     whenever the link element is gone: navigation.instant reconciles
     <head> against the target page's HTML, so leaving the homepage
     strips the injected link — and with the stylesheet go its
     CSS-connected font faces. */
  let stylesheetPromise = null;
  function loadStylesheet() {
    if (!document.getElementById(CONFIG.fontStylesheetId)) {
      stylesheetPromise = null;
    }
    if (!stylesheetPromise) {
      stylesheetPromise = new Promise(function (resolve) {
        const link = document.createElement("link");
        link.id = CONFIG.fontStylesheetId;
        link.rel = "stylesheet";
        link.href = CONFIG.fontStylesheetUrl;
        link.onload = function () {
          resolve(true);
        };
        link.onerror = function () {
          link.remove();
          stylesheetPromise = null;
          resolve(false);
        };
        document.head.appendChild(link);
      });
    }
    return stylesheetPromise;
  }

  /* True only when the logo font itself is registered and fully loaded.
     fonts.load() resolves with the faces that matched the request: an
     empty list means the @font-face was not registered at all (the
     stylesheet failed, or its CSS had not parsed yet when this ran) —
     the very race that used to slip a fallback-font render through.
     fonts.check() has the same blind spot (an unregistered family
     counts as "available"), so the matched faces are inspected. */
  function logoFontUsable() {
    if (!document.fonts || !document.fonts.load) {
      return Promise.resolve(false);
    }
    return document.fonts
      .load(cssFont(CONFIG.referenceFontPx), CONFIG.text)
      .then(function (faces) {
        return (
          faces.length > 0 &&
          faces.every(function (face) {
            return face.status === "loaded";
          })
        );
      })
      .catch(function () {
        return false;
      });
  }

  /* Second, belt-and-braces verification: the canvas must actually
     shape CONFIG.text differently with the logo font than with the
     bare fallback. Some privacy modes (canvas-fingerprint protection)
     report a webfont as loaded in document.fonts yet draw canvas text
     with a standardized font — the one failure the FontFaceSet check
     above cannot see, and exactly what puts a generic-font grid on
     screen. Genuinely different faces differ in width or bounds by
     whole pixels at the reference size; the epsilon only absorbs
     measurement noise, so a browser that refuses to shape the real
     font fails this and the text fallback stays. */
  function logoFontRendered() {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const metrics = function (font) {
      ctx.font = font;
      const m = ctx.measureText(CONFIG.text);
      return [
        m.width,
        m.actualBoundingBoxAscent || 0,
        m.actualBoundingBoxDescent || 0,
      ];
    };
    const logo = metrics(cssFont(CONFIG.referenceFontPx));
    const fallback = metrics(
      CONFIG.referenceFontPx + "px " + CONFIG.fontFallback
    );
    return logo.some(function (value, i) {
      return Math.abs(value - fallback[i]) > 0.5;
    });
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function attemptFontLoad(attempt) {
    return loadStylesheet()
      .then(logoFontUsable)
      .then(function (usable) {
        usable = usable && logoFontRendered();
        if (usable || attempt >= CONFIG.fontLoadRetries) return usable;
        return delay(CONFIG.fontRetryDelayMs << attempt).then(function () {
          return attemptFontLoad(attempt + 1);
        });
      });
  }

  /* True while the logo font's face is actually present and loaded in
     document.fonts right now. A past verification is no proof of the
     present: when navigation.instant strips the injected stylesheet
     (see loadStylesheet), the browser evicts its font faces, and a
     canvas draw after that silently falls back — the serif-logo bug
     on returning to the homepage. */
  function logoFontPresent() {
    if (!document.fonts || !document.fonts.forEach) return false;
    let present = false;
    document.fonts.forEach(function (face) {
      if (
        face.family.replace(/["']/g, "") === CONFIG.fontFamily &&
        face.status === "loaded"
      ) {
        present = true;
      }
    });
    return present;
  }

  /* Resolves true once the logo webfont is verifiably usable, running
     the retry schedule at most once at a time. Success is remembered
     only while the face is still present (see logoFontPresent);
     failure clears the attempt so any later trigger (a page revisit,
     a fonts "loadingdone" event) starts a fresh round rather than
     being stuck with a cached no. */
  let fontReady = false;
  let fontAttempt = null;
  function ensureLogoFont() {
    if (fontReady && !logoFontPresent()) fontReady = false;
    if (fontReady) return Promise.resolve(true);
    if (!fontAttempt) {
      fontAttempt = attemptFontLoad(0).then(function (usable) {
        fontReady = usable;
        fontAttempt = null;
        return usable;
      });
    }
    return fontAttempt;
  }

  /* Measures the rendered size of one monospace character cell inside the
     pre, so grid math follows whatever font/line-height the CSS defines. */
  function measureCharCell(pre) {
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute; visibility:hidden; white-space:pre; display:inline-block;";
    const row = "0".repeat(CONFIG.probeColumns);
    probe.textContent = row + "\n" + row;
    pre.appendChild(probe);
    const rect = probe.getBoundingClientRect();
    pre.removeChild(probe);
    return { width: rect.width / CONFIG.probeColumns, height: rect.height / 2 };
  }

  /* Tight ink bounding box of the logo text at the reference font size. */
  function measureInkBox(ctx) {
    ctx.font = cssFont(CONFIG.referenceFontPx);
    const m = ctx.measureText(CONFIG.text);
    const left = m.actualBoundingBoxLeft || 0;
    const right = m.actualBoundingBoxRight || m.width;
    const ascent = m.actualBoundingBoxAscent || CONFIG.referenceFontPx * 0.8;
    const descent = m.actualBoundingBoxDescent || CONFIG.referenceFontPx * 0.2;
    return {
      left: left,
      ascent: ascent,
      width: left + right,
      height: ascent + descent,
    };
  }

  function availableWidth(container) {
    const style = getComputedStyle(container);
    return (
      container.clientWidth -
      parseFloat(style.paddingLeft) -
      parseFloat(style.paddingRight)
    );
  }

  /* The logo's height budget: the viewport-ratio cap, tightened by the
     article's actual free height, or a short window grows a scrollbar
     the ratio cap alone would have allowed. The free height comes from
     the homepage's own layout mechanics (extra.css): the column is
     flex-stretched to the viewport bottom and the attribution's
     margin-top:auto absorbs exactly the unused column height, so the
     pre may grow into that slack 1:1 — its current height plus the
     auto margin's used value is the true capacity. Without the pinned
     attribution to read the slack from, the ratio cap stands alone. */
  function heightBudget(pre, container) {
    const ratioCap = window.innerHeight * CONFIG.maxViewportHeightRatio;
    const pinned = container.querySelector(".home-attribution");
    if (!pinned) return ratioCap;
    const slack = parseFloat(getComputedStyle(pinned).marginTop) || 0;
    const free = pre.getBoundingClientRect().height + slack;
    return Math.min(ratioCap, free);
  }

  /* Grid dimensions that preserve the glyph aspect ratio while fitting both
     the container width and the height budget. */
  function computeGrid(pre, cell, inkBox) {
    const container = pre.parentElement;
    if (!container) return null;

    const maxHeight = heightBudget(pre, container);
    const cellAspect = cell.height / cell.width;
    const inkAspect = inkBox.height / inkBox.width;
    const rowsForCols = function (cols) {
      return Math.max(1, Math.round((cols * inkAspect) / cellAspect));
    };

    let cols = Math.floor(availableWidth(container) / cell.width);
    let rows = rowsForCols(cols);
    /* Shrink until the height budget truly holds: rowsForCols rounds, so a
       single proportional scale-down can land a fraction of a row over. */
    while (cols > 1 && rows * cell.height > maxHeight) {
      cols = Math.min(
        cols - 1,
        Math.floor((cols * maxHeight) / (rows * cell.height))
      );
      rows = rowsForCols(cols);
    }
    if (cols < 2 || rows < 2) return null;
    return { cols: cols, rows: rows };
  }

  /* Draws the logo text into a supersampled offscreen canvas and returns the
     average glyph coverage (0..1) for every cell of the grid. */
  function sampleCoverage(canvas, ctx, grid, inkBox) {
    const ss = CONFIG.supersample;
    canvas.width = grid.cols * ss;
    canvas.height = grid.rows * ss;

    /* Resizing resets canvas state, so configure the context afterwards. */
    ctx.font = cssFont(CONFIG.referenceFontPx);
    ctx.fillStyle = "#000";
    const scaleX = (canvas.width * CONFIG.inkFill) / inkBox.width;
    const scaleY = (canvas.height * CONFIG.inkFill) / inkBox.height;
    const originX = (canvas.width - inkBox.width * scaleX) / 2 + inkBox.left * scaleX;
    const originY = (canvas.height - inkBox.height * scaleY) / 2 + inkBox.ascent * scaleY;
    ctx.setTransform(scaleX, 0, 0, scaleY, originX, originY);
    ctx.fillText(CONFIG.text, 0, 0);
    /* Synthetic semi-bold (see CONFIG.inkBoost): outline the glyphs on
       top of the fill so hairline strokes still saturate their cells. */
    if (CONFIG.inkBoost > 0) {
      ctx.strokeStyle = "#000";
      ctx.lineWidth = CONFIG.referenceFontPx * CONFIG.inkBoost;
      ctx.strokeText(CONFIG.text, 0, 0);
    }

    const alpha = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const coverage = new Float32Array(grid.cols * grid.rows);
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        let sum = 0;
        for (let sy = 0; sy < ss; sy++) {
          for (let sx = 0; sx < ss; sx++) {
            const px = x * ss + sx;
            const py = y * ss + sy;
            sum += alpha[(py * canvas.width + px) * 4 + 3];
          }
        }
        coverage[y * grid.cols + x] = sum / (ss * ss * 255);
      }
    }
    return coverage;
  }

  /* Converts coverage into per-cell render data: a jittered ramp index (for
     an organic, hand-scrambled look), an ink mask, and an animation phase. */
  function buildCells(grid, coverage) {
    const count = grid.cols * grid.rows;
    const maxIndex = CONFIG.charRamp.length - 1;
    const glitchMax = CONFIG.glitchRamp.length - 1;
    state.cols = grid.cols;
    state.rows = grid.rows;
    state.baseIndices = new Int16Array(count);
    state.glitchBase = new Int16Array(count);
    state.phases = new Float32Array(count);
    state.ink = new Uint8Array(count);

    const band = CONFIG.coverageCeil - CONFIG.coverageFloor;
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const i = y * grid.cols + x;
        const hash = cellHash(x, y);
        /* Contrast curve (see CONFIG): 0 below the floor, 1 above the
           ceiling, linear across the band between. */
        const density = Math.min(
          1,
          Math.max(0, (coverage[i] - CONFIG.coverageFloor) / band)
        );
        const isInk = density > 0;
        /* The same jittered density lands on both ramps: the short one
           renders the static frame, the long one is where the shimmer
           swings (buildFrame). */
        state.baseIndices[i] = clampIndex(
          Math.round(
            (1 - density) * maxIndex +
              (isInk ? (hash - 0.5) * CONFIG.staticJitter * maxIndex : 0)
          )
        );
        state.glitchBase[i] = clampGlitchIndex(
          Math.round(
            (1 - density) * glitchMax +
              (isInk ? (hash - 0.5) * CONFIG.staticJitter * glitchMax : 0)
          )
        );
        state.phases[i] = hash * Math.PI * 2;
        state.ink[i] = isInk ? 1 : 0;
      }
    }
  }

  /* Builds one text frame. Pass null for the static frame; pass a
     timestamp to shimmer the ink cells. Two detuned sine waves per cell
     give an organic ripple, and the swing is scaled by the current
     envelope so the shimmer eases in and out. Animated displacement
     happens on the long glitch ramp, whose alphabet is what makes the
     effect read as terminal noise; a cell the wave displaces by less
     than one step keeps its exact static glyph, so the frame converges
     on the static one as the envelope dies and the handoff is
     seamless. */
  function buildFrame(nowMs) {
    const glitchMax = CONFIG.glitchRamp.length - 1;
    const swing =
      CONFIG.animAmplitude * glitchMax * smoothstep(state.envelope);
    const angle = nowMs === null ? 0 : nowMs * CONFIG.animSpeedRadPerMs;
    const lines = [];
    for (let y = 0; y < state.rows; y++) {
      let line = "";
      for (let x = 0; x < state.cols; x++) {
        const i = y * state.cols + x;
        if (nowMs !== null && state.ink[i]) {
          const wave =
            0.7 * Math.sin(angle + state.phases[i]) +
            0.3 * Math.sin(angle * CONFIG.waveDetune + state.phases[i] * 2);
          const displacement = wave * swing;
          if (Math.abs(displacement) >= 0.5) {
            line += CONFIG.glitchRamp[
              clampGlitchIndex(state.glitchBase[i] + Math.round(displacement))
            ];
            continue;
          }
        }
        line += CONFIG.charRamp[state.baseIndices[i]];
      }
      lines.push(line);
    }
    return lines.join("\n");
  }

  /* Recomputes the grid for the current layout and repaints the static
     frame. Called on init, on (debounced) resize, and after late font
     loads; the signature guard makes redundant calls cheap. */
  function rebuild() {
    const pre = state.pre;
    if (!pre || !pre.isConnected) return;
    /* The single font gate: no path (init, resize, container resize,
       late font loads) may generate from a fallback font — the text
       fallback stays up until the real font has been verified, and a
       past verification only counts while the face is still present
       (instant navigation can evict it, see logoFontPresent). */
    if (!fontReady || !logoFontPresent()) return;

    /* Grid sizing must be measured at the generated font size, not the
       larger text-fallback size, so the class flips before probing. */
    pre.classList.add(CONFIG.generatedClass);

    const cell = measureCharCell(pre);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const inkBox = ctx ? measureInkBox(ctx) : null;
    const grid =
      cell.width && cell.height && inkBox && inkBox.width && inkBox.height
        ? computeGrid(pre, cell, inkBox)
        : null;

    if (!grid) {
      /* Cannot generate (no 2D context, degenerate metrics, tiny layout):
         restore the readable title-sized text fallback, and drop any
         stale frame so the shimmer loop cannot paint it over the
         fallback text. */
      pre.classList.remove(CONFIG.generatedClass);
      state.staticFrame = "";
      state.buildSignature = "";
      return;
    }

    /* Identical grid and font metrics produce an identical frame — skip
       the canvas work (e.g. a resize that didn't change the layout), but
       still repaint when the pre is a fresh element from an instant
       navigation and doesn't show the frame yet. */
    const signature = [
      grid.cols,
      grid.rows,
      inkBox.width.toFixed(1),
      inkBox.height.toFixed(1),
    ].join("|");
    if (
      signature === state.buildSignature &&
      pre.textContent === state.staticFrame
    ) {
      return;
    }
    state.buildSignature = signature;

    buildCells(grid, sampleCoverage(canvas, ctx, grid, inkBox));
    state.staticFrame = buildFrame(null);
    pre.textContent = state.staticFrame;
  }

  function stopAnimation() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    state.envelope = 0;
    state.lastTickAt = 0;
  }

  /* Runs while the cursor moves and through the fade-out after it stops:
     the envelope ramps toward 1 during movement (attack) and toward 0 once
     movement pauses longer than idleDelayMs (release). The loop ends only
     when the envelope has fully released, settling on the static frame. */
  function animationTick(now) {
    state.rafId = 0;
    if (!state.pre || !state.pre.isConnected || !state.staticFrame) return;

    const dt = state.lastTickAt ? now - state.lastTickAt : 0;
    state.lastTickAt = now;
    const moving = now - state.lastMoveAt < CONFIG.idleDelayMs;
    const step = moving ? dt / CONFIG.attackMs : -dt / CONFIG.releaseMs;
    state.envelope = Math.min(1, Math.max(0, state.envelope + step));

    if (!moving && state.envelope === 0) {
      state.pre.textContent = state.staticFrame; /* fully settled */
      state.lastTickAt = 0;
      return;
    }
    state.pre.textContent = buildFrame(now);
    state.rafId = requestAnimationFrame(animationTick);
  }

  function onPointerMove() {
    if (!state.pre || !state.pre.isConnected || !state.staticFrame) return;
    if (reducedMotion.matches) return;

    state.lastMoveAt = performance.now();
    if (!state.rafId) {
      state.rafId = requestAnimationFrame(animationTick);
    }
  }

  /* Idempotent entry point: re-queries the pre because navigation.instant
     replaces page content, and no-ops on pages without the logo. */
  function init() {
    const pre = document.querySelector("pre.kiln-ascii");
    state.pre = pre;
    /* A fresh pre from an instant navigation shows its text fallback;
       the previous visit's frame no longer matches it and must not be
       animated into it before rebuild() replaces it. */
    state.staticFrame = "";
    if (containerObserver) containerObserver.disconnect();
    if (!pre) {
      stopAnimation();
      return;
    }
    if (containerObserver && pre.parentElement) {
      containerObserver.observe(pre.parentElement);
    }
    /* Generate only once the logo webfont is verifiably usable AND the
       page's own fonts have settled — measureCharCell depends on the
       pre's rendered font (JetBrains Mono), and building against
       fallback metrics would produce a grid that clips or under-fills
       once the real font swaps in. On failure the text fallback simply
       stays; the loadingdone listener below retries later. */
    Promise.all([ensureLogoFont(), document.fonts && document.fonts.ready])
      .then(function (results) {
        if (results[0] && state.pre === pre && pre.isConnected) rebuild();
      });
  }

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener(
    "resize",
    KilnUtils.debounce(rebuild, CONFIG.resizeDebounceMs)
  );

  /* The grid is sized from the container width, which can change with
     no window resize (the s sidebar toggle in key-nav.js widens and
     narrows the content column): rebuild when the container itself
     resizes, once a frame exists to correct. The signature guard makes
     redundant fires cheap. */
  const containerObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(
          KilnUtils.debounce(function () {
            if (state.pre && state.pre.isConnected && state.staticFrame) {
              rebuild();
            }
          }, CONFIG.resizeDebounceMs)
        );

  /* Fonts that finish after the first build (e.g. a slow @import of the
     page font) change cell metrics; rebuilding self-heals, and the
     signature guard makes it free when nothing changed. The same event
     re-arms a failed logo-font attempt: ensureLogoFont retries from
     scratch when its last round gave up, so a font that recovers late
     still replaces the text fallback with the generated grid. */
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener("loadingdone", function () {
      if (!state.pre || !state.pre.isConnected) return;
      ensureLogoFont().then(function (usable) {
        if (usable && state.pre && state.pre.isConnected) rebuild();
      });
    });
  }

  KilnUtils.onPageChange(init);
})();
