(function () {
  const CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ><\/|[]{}#@%&';
  const FONT_SIZE = 14;
  const OPACITY = 0.045;
  const SPEED = 33; // ms per frame

  const canvas = document.createElement('canvas');
  canvas.id = 'ascii-rain';
  canvas.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:100%',
    'height:100%',
    'pointer-events:none',
    'z-index:0',
  ].join(';');
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let cols, drops;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    cols  = Math.floor(canvas.width / FONT_SIZE);
    drops = Array.from({ length: cols }, () => Math.random() * -100);
  }

  function getColor() {
    const scheme = document.documentElement.getAttribute('data-md-color-scheme');
    return scheme === 'slate' ? `rgba(255,255,255,${OPACITY})` : `rgba(0,0,0,${OPACITY})`;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${FONT_SIZE}px "JetBrains Mono", monospace`;
    ctx.fillStyle = getColor();

    for (let i = 0; i < drops.length; i++) {
      const char = CHARS[Math.floor(Math.random() * CHARS.length)];
      ctx.fillText(char, i * FONT_SIZE, drops[i] * FONT_SIZE);
      if (drops[i] * FONT_SIZE > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  resize();
  window.addEventListener('resize', resize);
  setInterval(draw, SPEED);

  // Re-init on MkDocs instant navigation
  if (typeof document$ !== 'undefined') {
    document$.subscribe(() => { resize(); });
  }
})();
