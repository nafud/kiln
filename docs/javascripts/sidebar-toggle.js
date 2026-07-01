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

/* Gradient fade below sticky sidebar title.
   Idempotent and safe to re-run: navigation.instant reconciles the DOM
   against freshly fetched page content, which doesn't include this
   injected element, so it must be re-created after every navigation. */
function initSidebarFade() {
  const primaryNav = document.querySelector('.md-sidebar--primary .md-nav--primary');
  const navTitle = primaryNav && primaryNav.querySelector('.md-nav__title');
  if (!navTitle) return;

  let fade = navTitle.parentNode.querySelector('.sidebar-title-fade');
  if (!fade) {
    fade = document.createElement('div');
    fade.className = 'sidebar-title-fade';
    navTitle.parentNode.insertBefore(fade, navTitle.nextSibling);
  }
  fade.style.top = navTitle.offsetHeight + 'px';
}

/* Scroll-to-top/bottom buttons.
   Idempotent and safe to re-run, for the same reason as initSidebarFade. */
function initScrollButtons() {
  if (document.querySelector('.scroll-buttons')) return;

  const scrollButtons = document.createElement("div");
  scrollButtons.className = "scroll-buttons scroll-hidden";

  const upArrowSvg = '<svg viewBox="0 0 24 24"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>';
  const downArrowSvg = '<svg viewBox="0 0 24 24"><path d="M12 16l6-6-1.41-1.41L12 13.17l-4.59-4.58L6 10z"/></svg>';

  const topBtn = document.createElement("button");
  topBtn.className = "scroll-btn";
  topBtn.setAttribute("aria-label", "Scroll to top");
  topBtn.title = "Scroll to top";
  topBtn.innerHTML = upArrowSvg;

  const bottomBtn = document.createElement("button");
  bottomBtn.className = "scroll-btn";
  bottomBtn.setAttribute("aria-label", "Scroll to bottom");
  bottomBtn.title = "Scroll to bottom";
  bottomBtn.innerHTML = downArrowSvg;

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
}

function init() {
  fitKilnAscii();
  initSidebarFade();
  initScrollButtons();
}

document.addEventListener("DOMContentLoaded", function () {
  init();
  window.addEventListener("resize", debounce(function () {
    fitKilnAscii();
    initSidebarFade();
  }, 100));
});

/* Re-run on instant-navigation page changes: fitKilnAscii recalculates for
   the new page's content, and initSidebarFade/initScrollButtons recreate
   elements that navigation.instant's DOM reconciliation may have removed. */
if (typeof document$ !== 'undefined') {
  document$.subscribe(init);
}
