/* Generative ASCII homepage logo.

   Renders CONFIG.text with the CONFIG.fontFamily webfont onto an offscreen
   canvas, samples glyph coverage per character cell, and maps it onto an
   ASCII density ramp inside <pre class="kiln-ascii">. The grid is derived
   from the measured character cell and the available container width plus a
   viewport-height budget, so the logo always fits without scrollbars.

   The grid is generated exclusively from the real CONFIG.fontFamily
   webfont — never from a fallback font, whose different metrics and
   shapes would produce a wrong-looking logo that then sticks. The font
   ships embedded in this file as a data: URI (CONFIG.fontDataUrl, a
   tiny subset holding only CONFIG.text's glyphs) and is registered
   through the FontFace API, so no network fetch stands between first
   paint and the build. Until verification succeeds (see ensureLogoFont)
   the pre keeps its plain-text fallback, styled as a title by
   extra.css; CONFIG.generatedClass switches it to grid sizing.

   The logo is static by itself; pointer movement drives a shimmer animation
   whose intensity envelope eases in and out. A page's first generated
   frame enters through the same machinery, starting at full envelope and
   decaying, so the logo materializes out of glitch noise instead of
   snapping from the text fallback (see rebuild). Idempotent and safe to
   re-run on navigation.instant page changes, same as page-chrome.js. */

(function () {
  "use strict";

  const CONFIG = {
    text: "Kiln",
    fontFamily: "UnifrakturMaguntia",
    fontFallback: "serif",
    /* UnifrakturMaguntia subset to CONFIG.text's glyphs (K i l n),
       a ~1.8 KB woff2 embedded so the face loads with zero network
       round trips — the render happens within frames of first paint
       instead of after a two-hop CDN fetch. SIL OFL; the copyright and
       license name records are retained inside the file. Regenerate
       whenever CONFIG.text gains a new character or the font changes:
         pyftsubset UnifrakturMaguntia.ttf --text="Kiln" --flavor=woff2 \
           --name-IDs="0,1,2,3,4,5,6,7,13,14" --output-file=kiln.woff2
         base64 -w0 kiln.woff2 */
    fontDataUrl:
      "data:font/woff2;base64,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",
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
       dense. */
    coverageFloor: 0.1,
    coverageCeil: 0.82,
    staticJitter: 0.14,          /* per-cell ramp offset, as a ramp fraction */
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

  /* Loads and registers the embedded logo font (memoized). The face is
     added to document.fonts through the FontFace API, so there is no
     <link> for navigation.instant's head reconciliation to strip —
     once added, the face stays for the life of the document, and the
     stylesheet-eviction serif-logo bug this replaced cannot recur. A
     data: URI cannot fail transiently, so a failure here (no FontFace
     API, malformed data) is deterministic and memoizing it is safe;
     the text fallback then simply stays. */
  let fontFacePromise = null;
  function loadFontFace() {
    if (!fontFacePromise) {
      fontFacePromise =
        typeof FontFace === "undefined" || !document.fonts
          ? Promise.resolve(false)
          : new FontFace(CONFIG.fontFamily, 'url("' + CONFIG.fontDataUrl + '")')
              .load()
              .then(function (face) {
                document.fonts.add(face);
                return true;
              })
              .catch(function () {
                return false;
              });
    }
    return fontFacePromise;
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

  /* Resolves true once the logo font is verifiably usable: the
     embedded face is loaded AND the canvas really shapes text with it
     (logoFontRendered). Success is remembered; a failed render check
     is re-run on any later trigger (a page revisit, a fonts
     "loadingdone" event), which costs only a canvas measurement. */
  let fontReady = false;
  function ensureLogoFont() {
    if (fontReady) return Promise.resolve(true);
    return loadFontFace().then(function (loaded) {
      fontReady = loaded && logoFontRendered();
      return fontReady;
    });
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
       fallback stays up until the real font has been verified. The
       JS-registered face persists for the document's life (see
       loadFontFace), so a past verification stays valid. */
    if (!fontReady) return;

    /* A pre still in fallback dress has never shown a generated frame;
       its first frame below settles in from glitch noise. Captured
       before the class flip, which is what marks the pre generated. */
    const firstBuild = !pre.classList.contains(CONFIG.generatedClass);

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

    /* A page's first generated frame materializes instead of snapping
       in: it starts at full shimmer envelope and animationTick's
       release path decays it into the static frame, so the fallback →
       grid handoff reads as terminal noise resolving rather than a
       font swap. Resize and self-heal rebuilds repaint statically. */
    if (firstBuild && !reducedMotion.matches) {
      state.envelope = 1;
      state.lastMoveAt = 0;
      state.lastTickAt = 0;
      pre.textContent = buildFrame(performance.now());
      if (!state.rafId) state.rafId = requestAnimationFrame(animationTick);
    } else {
      pre.textContent = state.staticFrame;
    }
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
     re-runs a failed verification: ensureLogoFont re-checks the canvas
     render when its last round said no, so an environment that starts
     shaping the font late still replaces the text fallback with the
     generated grid. */
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
