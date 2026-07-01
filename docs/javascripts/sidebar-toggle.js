/* ASCII art auto-fit */

function fitKilnAscii() {
  const pre = document.querySelector("pre.kiln-ascii");
  if (!pre) return;

  const container = pre.closest(".md-content__inner") || pre.parentElement;
  if (!container) return;

  /* Reset any previous scaling */
  pre.style.fontSize = "";

  const available = container.getBoundingClientRect().width;
  if (!available) return;

  /* Measure natural width using an off-screen clone so the container
     width cannot be affected by the pre's own overflow */
  const clone = pre.cloneNode(true);
  clone.style.cssText =
    "position:absolute;top:-9999px;left:-9999px;" +
    "font-size:1rem;white-space:pre;visibility:hidden;max-width:none;overflow:visible;";
  document.body.appendChild(clone);
  const naturalWidth = clone.scrollWidth;
  document.body.removeChild(clone);

  if (naturalWidth > available) {
    pre.style.fontSize = ((available / naturalWidth) * 0.97) + "rem";
  }
}

/* Debounce resize handler to avoid layout thrashing */
function debounce(fn, delay) {
  let timer;
  return function () {
    clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

document.addEventListener("DOMContentLoaded", function () {
  /* Wait for fonts so monospace character widths are accurate */
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fitKilnAscii);
  window.addEventListener("resize", debounce(fitKilnAscii, 100));

  /* Gradient fade below sticky sidebar title */
  const primaryNav = document.querySelector('.md-sidebar--primary .md-nav--primary');
  const navTitle = primaryNav && primaryNav.querySelector('.md-nav__title');
  if (navTitle) {
    const fade = document.createElement('div');
    fade.className = 'sidebar-title-fade';
    fade.style.top = navTitle.offsetHeight + 'px';
    navTitle.parentNode.insertBefore(fade, navTitle.nextSibling);
  }

  /* Scroll buttons */
  const scrollButtons = document.createElement("div");
  scrollButtons.className = "scroll-buttons scroll-hidden";

  const topBtn = document.createElement("button");
  topBtn.className = "scroll-btn";
  topBtn.title = "Go to top";
  topBtn.textContent = "↑";

  const bottomBtn = document.createElement("button");
  bottomBtn.className = "scroll-btn";
  bottomBtn.title = "Go to bottom";
  bottomBtn.textContent = "↓";

  scrollButtons.appendChild(topBtn);
  scrollButtons.appendChild(bottomBtn);
  document.body.appendChild(scrollButtons);

  topBtn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  bottomBtn.addEventListener("click", function () {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  });

  function updateScrollButtons() {
    if (window.scrollY > 200) {
      scrollButtons.classList.remove("scroll-hidden");
    } else {
      scrollButtons.classList.add("scroll-hidden");
    }
  }

  window.addEventListener("scroll", updateScrollButtons);
  updateScrollButtons();
});

/* Re-fit ASCII art on instant navigation page changes */
if (typeof document$ !== 'undefined') {
  document$.subscribe(fitKilnAscii);
}
