(function () {
  function render(canvas) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    const off = document.createElement("canvas");
    off.width = W;
    off.height = H;
    const oc = off.getContext("2d");

    // Auto-size font so text fills ~88% of canvas width
    let fontSize = H * 0.7;
    oc.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
    const measured = oc.measureText("KILN").width;
    fontSize = fontSize * ((W * 0.88) / measured);

    oc.fillStyle = "#000";
    oc.fillRect(0, 0, W, H);
    oc.fillStyle = "#fff";
    oc.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
    oc.textAlign = "center";
    oc.textBaseline = "middle";
    oc.fillText("KILN", W / 2, H / 2);

    const data = oc.getImageData(0, 0, W, H).data;

    const step = 5;
    const maxR = 2.3;
    ctx.fillStyle = "#111";

    for (let y = step / 2; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        const px = Math.min(Math.round(x), W - 1);
        const py = Math.min(Math.round(y), H - 1);
        const b = data[(py * W + px) * 4] / 255;
        if (b > 0.08) {
          ctx.beginPath();
          ctx.arc(x, y, b * maxR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function init() {
    const canvas = document.getElementById("kiln-logo");
    if (!canvas || canvas.dataset.rendered) return;
    canvas.dataset.rendered = "1";

    // Remove the auto-generated page title since the canvas is the title
    const h1 = document.querySelector(".md-content__inner > h1");
    if (h1) h1.style.display = "none";

    document.fonts.ready.then(function () {
      render(canvas);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    init();

    // Handle Material instant navigation re-entering the home page
    const mo = new MutationObserver(function () {
      init();
    });
    mo.observe(document.body, { childList: true, subtree: true });
  });
})();
