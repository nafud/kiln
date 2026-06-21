/* Hide/Show sidebar */

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

/* Scroll buttons */

const buttons = document.createElement("div");
buttons.className = "scroll-buttons scroll-hidden";

buttons.innerHTML = `
  <button class="scroll-btn" id="scroll-top">↑</button>
  <button class="scroll-btn" id="scroll-bottom">↓</button>
`;

document.body.appendChild(buttons);

document.getElementById("scroll-top").onclick = () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
};

document.getElementById("scroll-bottom").onclick = () => {
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth"
  });
};

function updateScrollButtons() {
  if (window.scrollY > 200) {
    buttons.classList.remove("scroll-hidden");
  } else {
    buttons.classList.add("scroll-hidden");
  }
}

window.addEventListener("scroll", updateScrollButtons);
updateScrollButtons();