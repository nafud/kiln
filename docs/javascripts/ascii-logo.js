/* Generative dot-matrix homepage logo.

   Renders KILN from a hand-drawn 5x7 dot-matrix bitmap (CONFIG.glyphs)
   into <pre class="kiln-ascii">, in the pixel-dissolve style: the
   wordmark stands solid on the left and erodes toward the upper right
   through checkerboard dither into sparse surviving dots, with stray
   dots scattered around the eroding edge and a few lone 0/1 glyphs in
   the open field — terminal noise chewing on a bitmap.

   The grid is pure arithmetic — no webfont, no canvas sampling. Each
   logical bitmap pixel becomes a k x k block of dots, and each dot is
   half a character cell: a character renders its upper/lower dot pair
   as one of " ", "▀", "▄", "█", which doubles the vertical resolution
   and makes the dots nearly square in the monospace cell. k is chosen
   so the grid fits the container width and the height budget (the
   viewport ratio cap tightened by the attribution's column slack, as
   before). Until the first build the pre keeps its plain-text KILN
   fallback, styled as a title by extra.css but kept invisible for JS
   visitors (the kiln-js rule there); a pure-CSS delayed reveal shows
   it anyway if generation never comes. CONFIG.generatedClass switches
   the pre to grid sizing.

   The logo is static by itself; pointer movement drives a shimmer
   whose intensity envelope eases in and out: the dissolve boundary
   crawls, dither flickers, scatter twinkles. A page's first generated
   frame enters through the same machinery at full envelope, so the
   logo materializes out of noise instead of snapping in. Idempotent
   and safe to re-run on navigation.instant page changes, same as
   page-chrome.js. */

(function () {
  "use strict";

  const CONFIG = {
    /* 5x7 dot-matrix glyphs (3 wide for I), the wordmark's source of
       truth. To change the word: swap rows here and update the pre's
       fallback text in docs/index.md. */
    glyphs: [
      ["10001",
       "10010",
       "10100",
       "11000",
       "10100",
       "10010",
       "10001"],
      ["111",
       "010",
       "010",
       "010",
       "010",
       "010",
       "111"],
      ["10000",
       "10000",
       "10000",
       "10000",
       "10000",
       "10000",
       "11111"],
      ["10001",
       "11001",
       "11001",
       "10101",
       "10011",
       "10011",
       "10001"],
    ],
    letterGap: 2,               /* bitmap columns between glyphs */
    generatedClass: "kiln-ascii--generated",
    minScale: 2,                /* below this many dots per pixel, keep the title */
    maxViewportHeightRatio: 0.42, /* height budget so the page never scrolls */
    /* Halo around the wordmark, in dots per unit of scale: room for
       edge scatter and the stray digits. */
    haloXPerScale: 2,
    haloYPerScale: 1,
    /* Dissolve field: 0 left/solid .. 1 right/eroded. The drive ramps
       up after dissolveStart of the width, leans toward the top, and
       carries per-dot noise so the boundary is ragged. */
    dissolveStart: 0.4,
    dissolveUpwardBias: 0.18,
    dissolveNoise: 0.3,
    /* Ink-dot state thresholds over the effective dissolve value:
       solid, then progressive dropout, then checker dither, then
       sparse survivors. */
    solidBelow: 0.25,
    checkerBelow: 0.5,
    sparseBelow: 0.78,
    dropoutMax: 0.35,           /* dropout probability at the checker edge */
    checkerKeep: 0.12,          /* off-parity dots kept inside the dither */
    sparseKeep: 0.3,            /* survivors past the dither */
    haloScatter: 0.1,           /* stray-dot probability along the eroding edge */
    haloReach: 2,               /* Chebyshev distance a stray dot may sit from ink */
    digitChance: 0.005,         /* lone 0/1 glyphs in the open field */
    /* Shimmer: wave-driven jitter added to each dot's dissolve value,
       scaled by the eased envelope. */
    animAmplitude: 0.45,
    animSpeedRadPerMs: 0.006,
    waveDetune: 1.7,
    twinkleStepMs: 160,         /* scatter/digit re-roll cadence while animated */
    idleDelayMs: 150,           /* movement gap treated as "cursor stopped" */
    attackMs: 120,              /* shimmer fade-in time */
    releaseMs: 1400,            /* long tail: the noise thins out dot by dot */
    resizeDebounceMs: 150,
    probeColumns: 40,           /* sample size for character cell measuring */
  };

  /* The four dot-pair states of one character cell. */
  const PAIR_CHARS = [" ", "▀", "▄", "█"]; /* none, upper, lower, both */

  const state = {
    pre: null,
    cols: 0,        /* grid width in dots (= characters) */
    rows: 0,        /* grid height in dots (= 2 per character row) */
    ink: null,      /* Uint8Array: 1 where the bitmap has ink */
    near: null,     /* Uint8Array: 1 within haloReach of ink */
    deff: null,     /* Float32Array: static dissolve value per dot */
    gate: null,     /* Float32Array: per-dot state-threshold random */
    phases: null,   /* Float32Array: per-dot animation phase */
    digits: null,   /* per-character-cell lone digit, "" when none */
    staticFrame: "",
    buildSignature: "",
    rafId: 0,
    lastMoveAt: 0,
    lastTickAt: 0,
    envelope: 0,    /* current shimmer intensity, 0 (static) .. 1 (full) */
  };

  /* MediaQueryList objects are live, so one instance stays correct even
     if the user toggles the OS setting. */
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Perceptual easing for the envelope: smoothstep flattens the curve
     at both ends, so the shimmer swells in and dies away. */
  function smoothstep(x) {
    return x * x * (3 - 2 * x);
  }

  /* Deterministic per-dot pseudo-random value in [0, 1). Stable across
     frames so the static logo doesn't flicker between rebuilds; the
     salt separates independent channels. */
  function cellHash(x, y, salt) {
    const s =
      Math.sin(x * 127.1 + y * 311.7 + (salt || 0) * 74.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  function clamp01(v) {
    return Math.min(1, Math.max(0, v));
  }

  /* The wordmark bitmap: glyph rows joined with letterGap columns. */
  function buildBitmap() {
    const rows = CONFIG.glyphs[0].length;
    const lines = [];
    for (let y = 0; y < rows; y++) {
      lines.push(
        CONFIG.glyphs
          .map(function (glyph) {
            return glyph[y];
          })
          .join("0".repeat(CONFIG.letterGap))
      );
    }
    return lines;
  }

  /* Measures the rendered size of one monospace character cell inside
     the pre, so grid math follows whatever font/line-height the CSS
     defines. */
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
     pre may grow into that slack 1:1. Without the pinned attribution
     to read the slack from, the ratio cap stands alone. */
  function heightBudget(pre, container) {
    const ratioCap = window.innerHeight * CONFIG.maxViewportHeightRatio;
    const pinned = container.querySelector(".home-attribution");
    if (!pinned) return ratioCap;
    const slack = parseFloat(getComputedStyle(pinned).marginTop) || 0;
    const free = pre.getBoundingClientRect().height + slack;
    return Math.min(ratioCap, free);
  }

  /* The largest pixel scale k whose grid (bitmap * k plus the halo)
     fits both the width and the height budget. */
  function computeScale(pre, cell, bitmap) {
    const container = pre.parentElement;
    if (!container) return 0;
    const bitmapCols = bitmap[0].length;
    const bitmapRows = bitmap.length;
    const maxDotsX = Math.floor(availableWidth(container) / cell.width);
    const maxDotsY =
      Math.floor(heightBudget(pre, container) / cell.height) * 2;
    const k = Math.floor(
      Math.min(
        maxDotsX / (bitmapCols + 2 * CONFIG.haloXPerScale),
        maxDotsY / (bitmapRows + 2 * CONFIG.haloYPerScale)
      )
    );
    return k >= CONFIG.minScale ? k : 0;
  }

  /* Expands the bitmap into the dot-grid state arrays. */
  function buildDots(bitmap, k) {
    const haloX = CONFIG.haloXPerScale * k;
    const haloY = CONFIG.haloYPerScale * k;
    const cols = bitmap[0].length * k + 2 * haloX;
    let rows = bitmap.length * k + 2 * haloY;
    if (rows % 2) rows += 1; /* whole character rows */

    const count = cols * rows;
    state.cols = cols;
    state.rows = rows;
    state.ink = new Uint8Array(count);
    state.near = new Uint8Array(count);
    state.deff = new Float32Array(count);
    state.gate = new Float32Array(count);
    state.phases = new Float32Array(count);

    for (let y = 0; y < rows; y++) {
      const by = Math.floor((y - haloY) / k);
      for (let x = 0; x < cols; x++) {
        const bx = Math.floor((x - haloX) / k);
        const i = y * cols + x;
        state.ink[i] =
          by >= 0 &&
          by < bitmap.length &&
          bx >= 0 &&
          bx < bitmap[0].length &&
          bitmap[by][bx] === "1"
            ? 1
            : 0;
        /* Dissolve drive: a ramp across the width past dissolveStart,
           leaning toward the top, plus per-dot noise for the ragged
           boundary. */
        const nx = x / (cols - 1);
        const ny = y / (rows - 1);
        const drive =
          clamp01((nx - CONFIG.dissolveStart) / (1 - CONFIG.dissolveStart)) +
          (1 - ny) * CONFIG.dissolveUpwardBias +
          (cellHash(x, y, 1) - 0.5) * CONFIG.dissolveNoise;
        state.deff[i] = clamp01(drive);
        state.gate[i] = cellHash(x, y, 2);
        state.phases[i] = cellHash(x, y, 3) * Math.PI * 2;
      }
    }

    /* Dilate the ink by haloReach (Chebyshev), marking where edge
       scatter may live. */
    const reach = CONFIG.haloReach;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!state.ink[y * cols + x]) continue;
        for (let dy = -reach; dy <= reach; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= rows) continue;
          for (let dx = -reach; dx <= reach; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < cols) state.near[ny * cols + nx] = 1;
          }
        }
      }
    }

    /* Lone 0/1 glyphs, placed per character cell in the open field
       (no ink in either dot of the cell). */
    state.digits = new Array(cols * (rows / 2)).fill("");
    for (let cy = 0; cy < rows / 2; cy++) {
      for (let x = 0; x < cols; x++) {
        const top = 2 * cy * cols + x;
        const bottom = top + cols;
        if (state.ink[top] || state.ink[bottom]) continue;
        if (cellHash(x, cy, 4) < CONFIG.digitChance) {
          state.digits[cy * cols + x] = cellHash(x, cy, 5) < 0.5 ? "0" : "1";
        }
      }
    }
  }

  /* One dot's on/off for an effective dissolve value: solid, then
     progressive dropout, then checker dither (parity), then sparse
     survivors; non-ink dots only ever carry edge scatter. */
  function dotOn(i, x, y, deff, gate) {
    if (state.ink[i]) {
      if (deff < CONFIG.solidBelow) return true;
      if (deff < CONFIG.checkerBelow) {
        const band =
          (deff - CONFIG.solidBelow) / (CONFIG.checkerBelow - CONFIG.solidBelow);
        return gate > band * CONFIG.dropoutMax;
      }
      if (deff < CONFIG.sparseBelow) {
        return ((x + y) & 1) === 0 || gate < CONFIG.checkerKeep;
      }
      return gate < CONFIG.sparseKeep;
    }
    if (!state.near[i]) return false;
    if (deff < CONFIG.solidBelow) return false;
    return gate < CONFIG.haloScatter;
  }

  /* Builds one text frame. Pass null for the static frame; pass a
     timestamp to animate: two detuned sine waves jitter each dot's
     dissolve value (the boundary crawls, dither flickers), the
     scatter/digit gates re-roll on a coarse time step (twinkle), and
     the whole swing is scaled by the eased envelope, so the frame
     converges on the static one as the envelope dies and the handoff
     is seamless. */
  function buildFrame(nowMs) {
    const cols = state.cols;
    const swing =
      nowMs === null
        ? 0
        : CONFIG.animAmplitude * smoothstep(state.envelope);
    const angle = nowMs === null ? 0 : nowMs * CONFIG.animSpeedRadPerMs;
    const twinkle =
      nowMs === null ? 0 : Math.floor(nowMs / CONFIG.twinkleStepMs);
    const lines = [];
    for (let cy = 0; cy < state.rows / 2; cy++) {
      let line = "";
      for (let x = 0; x < cols; x++) {
        let pair = 0;
        for (let half = 0; half < 2; half++) {
          const y = 2 * cy + half;
          const i = y * cols + x;
          let deff = state.deff[i];
          let gate = state.gate[i];
          if (swing > 0) {
            const wave =
              0.7 * Math.sin(angle + state.phases[i]) +
              0.3 *
                Math.sin(angle * CONFIG.waveDetune + state.phases[i] * 2);
            deff = clamp01(deff + wave * swing);
            if (!state.ink[i]) {
              /* Scatter twinkles on the coarse step instead of
                 smearing with the wave. */
              const salted = gate + twinkle * 0.618 + state.phases[i];
              gate = salted - Math.floor(salted);
            }
          }
          if (dotOn(i, x, y, deff, gate)) pair |= half ? 2 : 1;
        }
        if (pair === 0) {
          line += state.digits[cy * cols + x] || " ";
        } else {
          line += PAIR_CHARS[pair];
        }
      }
      lines.push(line);
    }
    return lines.join("\n");
  }

  /* Recomputes the grid for the current layout and repaints the static
     frame. Called on init, on (debounced) resize, and on container
     resizes; the signature guard makes redundant calls cheap. */
  function rebuild() {
    const pre = state.pre;
    if (!pre || !pre.isConnected) return;

    /* A pre still in fallback dress has never shown a generated frame;
       its first frame below settles in from noise. Captured before the
       class flip, which is what marks the pre generated. */
    const firstBuild = !pre.classList.contains(CONFIG.generatedClass);

    /* Grid sizing must be measured at the generated font size, not the
       larger text-fallback size, so the class flips before probing. */
    pre.classList.add(CONFIG.generatedClass);

    const bitmap = buildBitmap();
    const cell = measureCharCell(pre);
    const k =
      cell.width > 0 && cell.height > 0 ? computeScale(pre, cell, bitmap) : 0;

    if (!k) {
      /* Cannot generate (degenerate metrics, tiny layout): restore the
         readable title-sized text fallback, and drop any stale frame
         so the shimmer loop cannot paint it over the fallback text. */
      pre.classList.remove(CONFIG.generatedClass);
      state.staticFrame = "";
      state.buildSignature = "";
      return;
    }

    /* An identical scale produces an identical frame — skip the grid
       work (e.g. a resize that didn't change the layout), but still
       repaint when the pre is a fresh element from an instant
       navigation and doesn't show the frame yet. */
    const signature = k + "|" + cell.width.toFixed(2) + "|" + cell.height.toFixed(2);
    if (
      signature === state.buildSignature &&
      pre.textContent === state.staticFrame
    ) {
      return;
    }
    state.buildSignature = signature;

    buildDots(bitmap, k);
    state.staticFrame = buildFrame(null);

    /* A page's first generated frame materializes instead of snapping
       in: it starts at full shimmer envelope and animationTick's
       release path decays it into the static frame. Resize and
       self-heal rebuilds repaint statically. */
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

  /* Runs while the cursor moves and through the fade-out after it
     stops: the envelope ramps toward 1 during movement (attack) and
     toward 0 once movement pauses longer than idleDelayMs (release).
     The loop ends only when the envelope has fully released, settling
     on the static frame. */
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

  /* Idempotent entry point: re-queries the pre because
     navigation.instant replaces page content, and no-ops on pages
     without the logo. */
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
    /* Wait for the page fonts to settle — measureCharCell depends on
       the pre's rendered font (JetBrains Mono), and building against
       fallback metrics would produce a grid that clips or under-fills
       once the real font swaps in. */
    Promise.resolve(document.fonts && document.fonts.ready).then(function () {
      if (state.pre === pre && pre.isConnected) rebuild();
    });
  }

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener(
    "resize",
    KilnUtils.debounce(rebuild, CONFIG.resizeDebounceMs)
  );

  /* The grid is sized from the container width, which can change with
     no window resize: rebuild when the container itself resizes, once
     a frame exists to correct. The signature guard makes redundant
     fires cheap. */
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

  /* Fonts that finish after the first build change cell metrics;
     rebuilding self-heals, and the signature guard makes it free when
     nothing changed. */
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener("loadingdone", function () {
      if (state.pre && state.pre.isConnected) rebuild();
    });
  }

  KilnUtils.onPageChange(init);
})();
