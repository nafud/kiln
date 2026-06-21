document.addEventListener("DOMContentLoaded", function () {
  const button = document.createElement("button");
  button.textContent = "Hide sidebar";
  button.className = "sidebar-toggle";

  button.addEventListener("click", function () {
    document.body.classList.toggle("sidebar-hidden");

    if (document.body.classList.contains("sidebar-hidden")) {
      button.textContent = "Show sidebar";
    } else {
      button.textContent = "Hide sidebar";
    }
  });

  document.body.appendChild(button);
});