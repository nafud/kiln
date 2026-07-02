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

/* Looks up the (possibly just-recreated) .scroll-buttons element fresh on
   every call, since navigation.instant may have removed/replaced it since
   the scroll listener was registered. */
function updateScrollButtons() {
  const scrollButtons = document.querySelector('.scroll-buttons');
  if (!scrollButtons) return;

  if (window.scrollY > 200) {
    scrollButtons.classList.remove("scroll-hidden");
  } else {
    scrollButtons.classList.add("scroll-hidden");
  }
}

/* Whether the window "scroll" listener has already been attached. It must
   only ever be attached once, since it is decoupled from per-navigation
   element (re)creation below. */
let scrollListenerAttached = false;

/* Scroll-to-top/bottom buttons.
   Idempotent and safe to re-run, for the same reason as initSidebarFade. */
function initScrollButtons() {
  if (!document.querySelector('.scroll-buttons')) {
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
  }

  if (!scrollListenerAttached) {
    window.addEventListener("scroll", updateScrollButtons);
    scrollListenerAttached = true;
  }

  updateScrollButtons();
}

function init() {
  initSidebarFade();
  initScrollButtons();
}

window.addEventListener("resize", KilnUtils.debounce(initSidebarFade, 100));

/* Re-runs on instant-navigation page changes: initSidebarFade and
   initScrollButtons recreate elements that navigation.instant's DOM
   reconciliation may have removed. */
KilnUtils.onPageChange(init);
