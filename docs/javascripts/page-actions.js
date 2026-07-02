/* Per-page actions menu: View as Markdown, Export as PDF, Open in ChatGPT,
   Open in Claude. Injected top-right on every content page except the
   homepage (which shows the ASCII logo instead of a title).

   Relies on hooks/export_markdown.py publishing each page's Markdown
   source at <page-url>index.md inside the built site. Idempotent and safe
   to re-run on navigation.instant page changes. */

(function () {
  "use strict";

  const CONFIG = {
    containerClass: "page-actions",
    openClass: "page-actions--open",
    toggleLabel: "Page ▾",
    markdownFileName: "index.md",
    promptTemplate: "Read {url} so I can ask questions about it.",
    chatgptUrl: "https://chatgpt.com/?q={prompt}",
    claudeUrl: "https://claude.ai/new?q={prompt}",
  };

  /* The raw Markdown sibling of the current page (see export_markdown.py).
     With use_directory_urls every page path ends in a slash. */
  function markdownUrl() {
    const path = location.pathname.endsWith("/")
      ? location.pathname
      : location.pathname + "/";
    return location.origin + path + CONFIG.markdownFileName;
  }

  function assistantUrl(template) {
    const prompt = CONFIG.promptTemplate.replace("{url}", markdownUrl());
    return template.replace("{prompt}", encodeURIComponent(prompt));
  }

  /* Opens the tab synchronously (inside the click gesture, so popup
     blockers allow it) and streams the Markdown into it as plain text —
     linking to the .md directly would download rather than display in
     browsers that don't render text/markdown inline. */
  function viewMarkdown() {
    const tab = window.open("", "_blank");
    if (!tab) return;
    fetch(markdownUrl())
      .then(function (response) {
        return response.ok ? response.text() : Promise.reject();
      })
      .then(function (text) {
        tab.document.title = document.title;
        const pre = tab.document.createElement("pre");
        pre.style.cssText =
          "white-space:pre-wrap; word-break:break-word; " +
          "font-family:monospace; margin:2rem auto; max-width:52rem;";
        pre.textContent = text;
        tab.document.body.appendChild(pre);
      })
      .catch(function () {
        tab.location = markdownUrl(); /* let the browser handle it */
      });
  }

  const ACTIONS = [
    {
      title: "View as Markdown",
      description: "View this page as plain text",
      onClick: viewMarkdown,
    },
    {
      title: "Export as PDF",
      description: "Print or save this page as a PDF",
      onClick: function () { window.print(); },
    },
    {
      title: "Open in ChatGPT",
      description: "Ask ChatGPT about this page",
      href: function () { return assistantUrl(CONFIG.chatgptUrl); },
    },
    {
      title: "Open in Claude",
      description: "Ask Claude about this page",
      href: function () { return assistantUrl(CONFIG.claudeUrl); },
    },
  ];

  function buildItem(action) {
    let item;
    if (action.href) {
      item = document.createElement("a");
      item.href = action.href();
      item.target = "_blank";
      item.rel = "noopener";
    } else {
      item = document.createElement("button");
      item.type = "button";
      item.addEventListener("click", action.onClick);
    }
    item.className = "page-actions-item";

    const title = document.createElement("span");
    title.className = "page-actions-item-title";
    title.textContent = action.title;
    const description = document.createElement("span");
    description.className = "page-actions-item-desc";
    description.textContent = action.description;
    item.appendChild(title);
    item.appendChild(description);
    return item;
  }

  function buildContainer() {
    const container = document.createElement("div");
    container.className = CONFIG.containerClass;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "page-actions-toggle";
    toggle.textContent = CONFIG.toggleLabel;
    toggle.setAttribute("aria-haspopup", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", function () {
      const open = container.classList.toggle(CONFIG.openClass);
      toggle.setAttribute("aria-expanded", String(open));
    });

    const menu = document.createElement("div");
    menu.className = "page-actions-menu";
    ACTIONS.forEach(function (action) {
      menu.appendChild(buildItem(action));
    });

    container.appendChild(toggle);
    container.appendChild(menu);
    return container;
  }

  function closeMenu() {
    const container = document.querySelector("." + CONFIG.containerClass);
    if (container && container.classList.contains(CONFIG.openClass)) {
      container.classList.remove(CONFIG.openClass);
      const toggle = container.querySelector(".page-actions-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    }
  }

  /* Close on click outside the menu and on Escape. Attached once; they
     look the container up fresh because navigation.instant replaces it. */
  document.addEventListener("click", function (event) {
    const container = document.querySelector("." + CONFIG.containerClass);
    if (container && !container.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });

  /* Idempotent entry point, re-run after every instant navigation. */
  function init() {
    const article = document.querySelector("article.md-content__inner");
    if (!article) return;
    if (document.querySelector("pre.kiln-ascii")) return; /* homepage */
    if (article.querySelector("." + CONFIG.containerClass)) return;
    article.insertBefore(buildContainer(), article.firstChild);
  }

  KilnUtils.onPageChange(init);
})();
