document.addEventListener("DOMContentLoaded", function () {
  /* Suppress clipboard copy notification */

  const clipboardObserver = new MutationObserver(function (mutations) {
    for (const mutation of mutations) {
      const el = mutation.target;
      if (el.classList && el.classList.contains("md-tooltip--active")) {
        const inner = el.querySelector(".md-tooltip__inner");
        if (inner && inner.textContent.includes("Copied")) {
          el.style.display = "none";
        }
      }
    }
  });

  clipboardObserver.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });

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
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  document.getElementById("scroll-bottom").addEventListener("click", function () {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth"
    });
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