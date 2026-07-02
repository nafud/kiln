/* Generative ASCII homepage logo.

   Renders CONFIG.text with the CONFIG.fontFamily webfont onto an offscreen
   canvas, samples glyph coverage per character cell, and maps it onto an
   ASCII density ramp inside <pre class="kiln-ascii">. The grid is derived
   from the measured character cell and the available container width plus a
   viewport-height budget, so the logo always fits without scrollbars.

   The logo is static by itself; pointer movement drives a shimmer animation
   that settles back to the static frame CONFIG.idleDelayMs after the last
   movement. Idempotent and safe to re-run on navigation.instant page
   changes, same as sidebar-toggle.js. */

(function () {
  "use strict";

  const CONFIG = {
    text: "Kiln",
    fontFamily: "UnifrakturMaguntia",
    fontFallback: "serif",
    /* Density ramp: darkest ink first, background (space) last. */
    charRamp: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
    referenceFontPx: 200,        /* offscreen measuring/drawing font size */
    supersample: 3,              /* canvas pixels sampled per cell axis */
    inkPadding: 0.94,            /* fraction of the grid the glyphs may fill */
    maxViewportHeightRatio: 0.42,/* height budget so the page never scrolls */
    inkThreshold: 0.04,          /* min coverage for a cell to count as ink */
    staticJitter: 0.14,          /* per-cell ramp offset, as a ramp fraction */
    animAmplitude: 0.2,          /* shimmer swing, as a ramp fraction */
    animSpeedRadPerMs: 0.006,
    /* Pointermove events stream continuously (~every frame) while the cursor
       is in motion, so anything longer than a couple of frames here reads as
       the logo "still animating" after the cursor stops. */
    idleDelayMs: 50,
    resizeDebounceMs: 150,
    probeColumns: 40,            /* sample size for character cell measuring */
  };

  const state = {
    pre: null,
    cols: 0,
    rows: 0,
    baseIndices: null, /* Int16Array: jittered static ramp index per cell */
    phases: null,      /* Float32Array: per-cell animation phase */
    ink: null,         /* Uint8Array: 1 where the cell contains glyph ink */
    staticFrame: "",
    rafId: 0,
    lastMoveAt: 0,
    fontLoaded: false,
  };

  function debounce(fn, delay) {
    let timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  function clampIndex(index) {
    return Math.min(CONFIG.charRamp.length - 1, Math.max(0, index));
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

  /* Resolves once the webfont is usable by canvas (or immediately when the
     Font Loading API is unavailable / the font fails — the serif fallback
     still produces a legible logo). */
  function loadWebFont() {
    if (state.fontLoaded || !document.fonts || !document.fonts.load) {
      return Promise.resolve();
    }
    return document.fonts
      .load(cssFont(CONFIG.referenceFontPx), CONFIG.text)
      .then(function () { state.fontLoaded = true; })
      .catch(function () { /* keep the fallback font */ });
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

  /* Grid dimensions that preserve the glyph aspect ratio while fitting both
     the container width and the viewport-height budget. */
  function computeGrid(pre, cell, inkBox) {
    const container = pre.parentElement;
    if (!container) return null;

    const maxHeight = window.innerHeight * CONFIG.maxViewportHeightRatio;
    const cellAspect = cell.height / cell.width;
    const inkAspect = inkBox.height / inkBox.width;
    const rowsForCols = function (cols) {
      return Math.max(1, Math.round((cols * inkAspect) / cellAspect));
    };

    let cols = Math.floor(availableWidth(container) / cell.width);
    let rows = rowsForCols(cols);
    if (rows * cell.height > maxHeight) {
      cols = Math.floor((cols * maxHeight) / (rows * cell.height));
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
    const scaleX = (canvas.width * CONFIG.inkPadding) / inkBox.width;
    const scaleY = (canvas.height * CONFIG.inkPadding) / inkBox.height;
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
    state.cols = grid.cols;
    state.rows = grid.rows;
    state.baseIndices = new Int16Array(count);
    state.phases = new Float32Array(count);
    state.ink = new Uint8Array(count);

    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const i = y * grid.cols + x;
        const hash = cellHash(x, y);
        const isInk = coverage[i] > CONFIG.inkThreshold;
        const jitter = isInk
          ? (hash - 0.5) * CONFIG.staticJitter * maxIndex
          : 0;
        state.baseIndices[i] = clampIndex(
          Math.round((1 - coverage[i]) * maxIndex + jitter)
        );
        state.phases[i] = hash * Math.PI * 2;
        state.ink[i] = isInk ? 1 : 0;
      }
    }
  }

  /* Builds one text frame. Pass null for the static frame; pass a timestamp
     to shimmer the ink cells around their static ramp index. */
  function buildFrame(nowMs) {
    const maxIndex = CONFIG.charRamp.length - 1;
    const swing = CONFIG.animAmplitude * maxIndex;
    const lines = [];
    for (let y = 0; y < state.rows; y++) {
      let line = "";
      for (let x = 0; x < state.cols; x++) {
        const i = y * state.cols + x;
        let index = state.baseIndices[i];
        if (nowMs !== null && state.ink[i]) {
          const wave = Math.sin(
            nowMs * CONFIG.animSpeedRadPerMs + state.phases[i]
          );
          index = clampIndex(Math.round(index + wave * swing));
        }
        line += CONFIG.charRamp[index];
      }
      lines.push(line);
    }
    return lines.join("\n");
  }

  /* Recomputes the whole grid for the current layout and repaints the
     static frame. Called on init and (debounced) on resize. */
  function rebuild() {
    const pre = state.pre;
    if (!pre || !pre.isConnected) return;

    const cell = measureCharCell(pre);
    if (!cell.width || !cell.height) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const inkBox = measureInkBox(ctx);
    if (!inkBox.width || !inkBox.height) return;

    const grid = computeGrid(pre, cell, inkBox);
    if (!grid) return;

    buildCells(grid, sampleCoverage(canvas, ctx, grid, inkBox));
    state.staticFrame = buildFrame(null);
    pre.textContent = state.staticFrame;
  }

  function stopAnimation() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  function animationTick(now) {
    state.rafId = 0;
    if (!state.pre || !state.pre.isConnected || !state.staticFrame) return;

    if (now - state.lastMoveAt >= CONFIG.idleDelayMs) {
      state.pre.textContent = state.staticFrame; /* settle back to static */
      return;
    }
    state.pre.textContent = buildFrame(now);
    state.rafId = requestAnimationFrame(animationTick);
  }

  function onPointerMove() {
    if (!state.pre || !state.pre.isConnected || !state.staticFrame) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
    if (!pre) {
      stopAnimation();
      return;
    }
    loadWebFont().then(function () {
      if (state.pre === pre && pre.isConnected) rebuild();
    });
  }

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener(
    "resize",
    debounce(rebuild, CONFIG.resizeDebounceMs)
  );

  document.addEventListener("DOMContentLoaded", init);
  if (typeof document$ !== "undefined") {
    document$.subscribe(init);
  }
})();
