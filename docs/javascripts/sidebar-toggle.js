document.addEventListener("DOMContentLoaded", function () {
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