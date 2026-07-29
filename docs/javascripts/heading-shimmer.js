/* Hover shimmer for page h1 headings.

   Ports the homepage logo's shimmer (see ascii-logo.js) onto heading
   text: while the pointer rests on an h1, each character wobbles along
   a glyph ramp around its own position, driven by the same two
   detuned sine waves, and the intensity envelope eases in on hover
   and releases after the pointer leaves, settling back on the exact
   original text. Unlike the logo, the trigger is hovering the heading
   text itself (an injected inline wrapper, so the block's empty width
   doesn't count), not general pointer movement, and the shimmer
   sustains while the pointer stays on the text.

   Idempotent and safe to re-run on navigation.instant page changes. */

(function () {
  "use strict";

  const CONFIG = {
    selector: ".md-content h1",
    /* Substitution alphabet: a density-ordered glyph ramp (the old
       logo alphabet) restricted to letters and digits, wobbled by the
       same motion constants as the logo's shimmer. Punctuation is excluded
       because glyphs like "-" and "/" are soft-wrap opportunities, so
       a substitution that adds or removes one rewraps a multi-line
       heading mid-shimmer and reflows the whole page. Alphanumerics
       never break inside a word, and every non-alphanumeric character
       of the heading stays untouched, so the line layout is frozen.
       Motion constants match the logo; only the fade-in is a touch
       longer, so the scramble doesn't snap onto readable text. */
    charRamp: "B8WMoahkbdpqwmZO0QLCJUYXzcvunxrjft1ilI",
    animAmplitude: 0.2,          /* shimmer swing, as a ramp fraction */
    animSpeedRadPerMs: 0.006,
    waveDetune: 1.7,             /* frequency ratio of the secondary wave */
    attackMs: 200,               /* shimmer fade-in time on hover */
    /* Fade-out after the pointer leaves, matching the logo's long
       release (ascii-logo.js): the envelope thins the scramble out
       character by character instead of cutting off abruptly. */
    releaseMs: 1400,
  };

  const maxIndex = CONFIG.charRamp.length - 1;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handled = new WeakSet(); /* h1s already wrapped and wired */
  const states = new WeakMap();  /* wrapper span -> shimmer state */
  const active = new Set();      /* states currently animating */
  let rafId = 0;
  let lastTickAt = 0;

  function clampIndex(index) {
    return Math.min(maxIndex, Math.max(0, index));
  }

  /* Perceptual easing for the envelope, same rationale as the logo. */
  function smoothstep(x) {
    return x * x * (3 - 2 * x);
  }

  /* Deterministic per-character pseudo-random value in [0, 1), stable
     across frames so a heading shimmers the same way on every hover. */
  function charHash(i) {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  }

  /* Collects the heading's text nodes (skipping Material's permalink
     anchor, if present) and precomputes per-character render data: the
     character's own ramp position where it has one, a hashed mid-ramp
     density otherwise, and an animation phase. */
  function createState(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    let g = 0; /* global character position across all text nodes */
    while ((node = walker.nextNode())) {
      if (!node.nodeValue) continue;
      if (node.parentElement && node.parentElement.closest(".headerlink")) {
        continue;
      }
      const original = node.nodeValue;
      const base = new Int16Array(original.length);
      const phase = new Float32Array(original.length);
      for (let i = 0; i < original.length; i++, g++) {
        const hash = charHash(g);
        /* Only letters and digits shimmer; everything else (spaces,
           punctuation) is a fixed point, so the heading's soft-wrap
           opportunities never change (see the charRamp note). */
        if (!/[0-9A-Za-z]/.test(original[i])) {
          base[i] = -1;
        } else {
          const rampIndex = CONFIG.charRamp.indexOf(original[i]);
          base[i] =
            rampIndex >= 0
              ? rampIndex
              : clampIndex(Math.round((0.25 + 0.5 * hash) * maxIndex));
        }
        phase[i] = hash * Math.PI * 2;
      }
      nodes.push({ node: node, original: original, base: base, phase: phase });
    }
    return { el: el, nodes: nodes, envelope: 0, hovered: false };
  }

  /* One shimmer frame. A character keeps its original glyph until the
     wave displaces it by at least one ramp step, so the heading degrades
     progressively as the envelope swells and settles back as it dies. */
  function renderFrame(state, nowMs) {
    const swing =
      CONFIG.animAmplitude * maxIndex * smoothstep(state.envelope);
    const angle = nowMs * CONFIG.animSpeedRadPerMs;
    for (let n = 0; n < state.nodes.length; n++) {
      const entry = state.nodes[n];
      let out = "";
      for (let i = 0; i < entry.original.length; i++) {
        const c = entry.original[i];
        if (entry.base[i] < 0) {
          out += c; /* non-alphanumeric fixed point */
          continue;
        }
        const wave =
          0.7 * Math.sin(angle + entry.phase[i]) +
          0.3 * Math.sin(angle * CONFIG.waveDetune + entry.phase[i] * 2);
        const displacement = wave * swing;
        out +=
          Math.abs(displacement) < 0.5
            ? c
            : CONFIG.charRamp[
                clampIndex(entry.base[i] + Math.round(displacement))
              ];
      }
      entry.node.nodeValue = out;
    }
  }

  function restore(state) {
    for (let n = 0; n < state.nodes.length; n++) {
      state.nodes[n].node.nodeValue = state.nodes[n].original;
    }
  }

  /* Single animation loop over every active heading: the envelope ramps
     toward 1 while hovered (attack) and toward 0 after leaving
     (release); a fully released heading is restored verbatim and
     dropped from the loop. */
  function tick(now) {
    rafId = 0;
    const dt = lastTickAt ? now - lastTickAt : 0;
    lastTickAt = now;

    active.forEach(function (state) {
      if (!state.el.isConnected) {
        active.delete(state);
        return;
      }
      const step = state.hovered
        ? dt / CONFIG.attackMs
        : -dt / CONFIG.releaseMs;
      state.envelope = Math.min(1, Math.max(0, state.envelope + step));
      if (!state.hovered && state.envelope === 0) {
        restore(state); /* fully settled */
        active.delete(state);
        return;
      }
      renderFrame(state, now);
    });

    if (active.size) {
      rafId = requestAnimationFrame(tick);
    } else {
      lastTickAt = 0;
    }
  }

  function onEnter(event) {
    if (reducedMotion.matches) return;
    const el = event.currentTarget;
    let state = states.get(el);
    if (!state) {
      state = createState(el);
      states.set(el, state);
    }
    state.hovered = true;
    active.add(state);
    if (!rafId) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function onLeave(event) {
    const state = states.get(event.currentTarget);
    if (state) state.hovered = false; /* the tick loop runs the release */
  }

  /* Idempotent entry point: navigation.instant replaces page content,
     so fresh h1s get wrapped while old ones fall out via the WeakSet. */
  function init() {
    const headings = document.querySelectorAll(CONFIG.selector);
    for (let i = 0; i < headings.length; i++) {
      const h1 = headings[i];
      if (handled.has(h1)) continue;
      handled.add(h1);
      /* The h1 is a full-width block, so listening on it would trigger
         over the empty space right of the title. An inline wrapper
         around the heading content scopes the hover to the rendered
         text (inline hit-testing follows the actual line boxes). */
      const target = document.createElement("span");
      target.className = "kiln-shimmer-target";
      while (h1.firstChild) {
        target.appendChild(h1.firstChild);
      }
      h1.appendChild(target);
      target.addEventListener("pointerenter", onEnter);
      target.addEventListener("pointerleave", onLeave);
    }
  }

  KilnUtils.onPageChange(init);
})();
