/* Page chrome: gradient fade below the sticky sidebar title and
   scroll-to-top/bottom buttons. */

(function () {
  "use strict";

  /* Gradient fade below the sticky sidebar title.
     Idempotent and safe to re-run: navigation.instant reconciles the DOM
     against freshly fetched page content, which doesn't include this
     injected element, so it must be re-created after every navigation. */
  function initSidebarFade() {
    const primaryNav = document.querySelector(
      ".md-sidebar--primary .md-nav--primary"
    );
    const navTitle = primaryNav && primaryNav.querySelector(".md-nav__title");
    if (!navTitle) return;

    let fade = navTitle.parentNode.querySelector(".sidebar-title-fade");
    if (!fade) {
      fade = document.createElement("div");
      fade.className = "sidebar-title-fade";
      navTitle.parentNode.insertBefore(fade, navTitle.nextSibling);
    }
    fade.style.top = navTitle.offsetHeight + "px";
  }

  /* Looks up the (possibly just-recreated) .scroll-buttons element fresh on
     every call, since navigation.instant may have removed/replaced it since
     the scroll listener was registered. */
  function updateScrollButtons() {
    const scrollButtons = document.querySelector(".scroll-buttons");
    if (!scrollButtons) return;

    scrollButtons.classList.toggle("scroll-hidden", window.scrollY <= 200);
  }

  function makeScrollButton(label, iconSvg, onClick) {
    const button = document.createElement("button");
    button.className = "scroll-btn";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = iconSvg;
    button.addEventListener("click", onClick);
    return button;
  }

  /* Scroll-to-top/bottom buttons.
     Idempotent and safe to re-run, for the same reason as initSidebarFade. */
  function initScrollButtons() {
    if (!document.querySelector(".scroll-buttons")) {
      const container = document.createElement("div");
      container.className = "scroll-buttons scroll-hidden";
      container.appendChild(
        makeScrollButton(
          "Scroll to top",
          '<svg viewBox="0 0 24 24"><path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/></svg>',
          function () {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        )
      );
      container.appendChild(
        makeScrollButton(
          "Scroll to bottom",
          '<svg viewBox="0 0 24 24"><path d="M12 16l6-6-1.41-1.41L12 13.17l-4.59-4.58L6 10z"/></svg>',
          function () {
            window.scrollTo({
              top: document.documentElement.scrollHeight,
              behavior: "smooth",
            });
          }
        )
      );
      document.body.appendChild(container);
    }
    updateScrollButtons();
  }

  function init() {
    initSidebarFade();
    initScrollButtons();
  }

  /* These handlers look their elements up fresh on every call, so they are
     attached once here rather than re-attached per navigation. */
  window.addEventListener("scroll", updateScrollButtons);
  window.addEventListener("resize", KilnUtils.debounce(initSidebarFade, 100));

  /* Re-runs on instant-navigation page changes: initSidebarFade and
     initScrollButtons recreate elements that navigation.instant's DOM
     reconciliation may have removed. */
  KilnUtils.onPageChange(init);
})();
