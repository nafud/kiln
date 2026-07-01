/* ASCII art auto-fit */

function fitKilnAscii() {
  const pre = document.querySelector("pre.kiln-ascii");
  if (!pre) return;

  pre.style.fontSize = "1rem";

  const container = pre.parentElement;
  if (!container) return;

  const available = container.clientWidth;
  const scrollW = pre.scrollWidth;

  if (scrollW > 0 && scrollW > available) {
    const current = parseFloat(getComputedStyle(pre).fontSize);
    pre.style.fontSize = (current * (available / scrollW) * 0.98) + "px";
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
  fitKilnAscii();
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
