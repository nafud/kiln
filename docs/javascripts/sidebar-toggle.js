/* ASCII art auto-fit */

function fitKilnAscii() {
  const pre = document.querySelector("pre.kiln-ascii");
  if (!pre) return;

  const container = pre.parentElement;
  if (!container) return;

  /* Reset font size, then measure container width before the pre can expand it */
  pre.style.fontSize = "1rem";
  pre.style.visibility = "hidden";

  const available = container.clientWidth;

  /* Measure natural content width at 1rem */
  pre.style.whiteSpace = "pre";
  const naturalWidth = pre.scrollWidth;

  pre.style.visibility = "";

  if (naturalWidth > 0 && naturalWidth > available) {
    const scale = (available / naturalWidth) * 0.97;
    pre.style.fontSize = scale + "rem";
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
