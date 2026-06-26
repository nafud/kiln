/* ASCII art auto-fit */

function fitKilnAscii() {
  const pre = document.querySelector("pre.kiln-ascii");
  if (!pre) return;

  pre.style.fontSize = "1rem";

  const container = pre.parentElement;
  const available = container.clientWidth;
  const scrollW = pre.scrollWidth;

  if (scrollW > 0 && scrollW > available) {
    const current = parseFloat(getComputedStyle(pre).fontSize);
    pre.style.fontSize = (current * (available / scrollW) * 0.98) + "px";
  }
}

/* Page export actions (View as Markdown / Export as PDF) */

function initPageActions() {
  // Remove any previously injected instance (instant navigation re-runs this)
  const existing = document.querySelector('.page-actions');
  if (existing) existing.remove();

  // Skip on home page
  if (document.querySelector('.kiln-ascii')) return;

  const contentInner = document.querySelector('.md-content__inner');
  if (!contentInner) return;

  // Derive raw GitHub URL for the current page
  const path = window.location.pathname; // e.g. /kiln/re/crackmes/
  const prefix = '/kiln/';
  let docPath = path.startsWith(prefix) ? path.slice(prefix.length) : path.slice(1);
  if (!docPath || docPath.endsWith('/')) {
    docPath = docPath + 'index.md';
  } else if (!docPath.endsWith('.md')) {
    docPath = docPath + '.md';
  }
  const rawUrl = `https://raw.githubusercontent.com/skllcrshrs/kiln/main/docs/${docPath}`;

  const wrapper = document.createElement('div');
  wrapper.className = 'page-actions';
  wrapper.innerHTML = `
    <button class="page-actions-btn" aria-haspopup="true" aria-expanded="false">
      Export <span aria-hidden="true">▾</span>
    </button>
    <div class="page-actions-menu" hidden>
      <a class="page-actions-item" href="${rawUrl}" target="_blank" rel="noopener">View as Markdown</a>
      <a class="page-actions-item" id="pa-pdf" href="#">Export as PDF</a>
    </div>
  `;

  wrapper.querySelector('#pa-pdf').addEventListener('click', function (e) {
    e.preventDefault();
    window.print();
  });

  const btn = wrapper.querySelector('.page-actions-btn');
  const menu = wrapper.querySelector('.page-actions-menu');

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    const isOpen = !menu.hidden;
    menu.hidden = isOpen;
    btn.setAttribute('aria-expanded', String(!isOpen));
  });

  document.addEventListener('click', function () {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  });

  contentInner.insertBefore(wrapper, contentInner.firstChild);
}

document.addEventListener("DOMContentLoaded", function () {
  fitKilnAscii();
  initPageActions();
  window.addEventListener("resize", fitKilnAscii);

  /* Gradient fade below sticky sidebar title */

  const primaryNav = document.querySelector('.md-sidebar--primary .md-nav--primary');
  const navTitle = primaryNav && primaryNav.querySelector('.md-nav__title');
  if (navTitle) {
    const fade = document.createElement('div');
    fade.className = 'sidebar-title-fade';
    fade.style.top = navTitle.offsetHeight + 'px';
    navTitle.parentNode.insertBefore(fade, navTitle.nextSibling);
  }

  /* Hide / show sidebar */

  const sidebarButton = document.createElement("button");
  sidebarButton.textContent = "Hide sidebar";
  sidebarButton.className = "sidebar-toggle";

  sidebarButton.addEventListener("click", function () {
    document.body.classList.toggle("sidebar-hidden");

    sidebarButton.textContent = document.body.classList.contains("sidebar-hidden")
      ? "Show sidebar"
      : "Hide sidebar";
  });

  document.body.appendChild(sidebarButton);

  /* Scroll buttons */

  const scrollButtons = document.createElement("div");
  scrollButtons.className = "scroll-buttons scroll-hidden";

  scrollButtons.innerHTML = `
    <button class="scroll-btn" id="scroll-top" title="Go to top">↑</button>
    <button class="scroll-btn" id="scroll-bottom" title="Go to bottom">↓</button>
  `;

  document.body.appendChild(scrollButtons);

  document.getElementById("scroll-top").addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  document.getElementById("scroll-bottom").addEventListener("click", function () {
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

/* Re-run on instant navigation page changes */
if (typeof document$ !== 'undefined') {
  document$.subscribe(function () {
    fitKilnAscii();
    initPageActions();
  });
}
