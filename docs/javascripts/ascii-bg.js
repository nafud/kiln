(function () {
  const CHARS = '01#@><[]{}|\\/+-=~`';
  const COLS = 80;
  const ROWS = 25;

  function buildTile() {
    let rows = [];
    for (let r = 0; r < ROWS; r++) {
      let row = '';
      for (let c = 0; c < COLS; c++) {
        row += Math.random() > 0.85
          ? CHARS[Math.floor(Math.random() * CHARS.length)]
          : ' ';
      }
      rows.push(row);
    }
    return rows.join('\n');
  }

  function apply() {
    const scheme = document.documentElement.getAttribute('data-md-color-scheme');
    const color  = scheme === 'slate' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';

    const tile = buildTile();
    const svg  = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="350">
      <style>text{font-family:"JetBrains Mono",monospace;font-size:11px;fill:${color};white-space:pre;}</style>
      <text x="0" y="12">${tile.split('\n').map((l, i) =>
        `<tspan x="0" dy="${i === 0 ? 0 : 14}">${l.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</tspan>`
      ).join('')}</text>
    </svg>`;

    const encoded = 'data:image/svg+xml,' + encodeURIComponent(svg);
    document.body.style.backgroundImage = `url("${encoded}")`;
    document.body.style.backgroundRepeat = 'repeat';
    document.body.style.backgroundSize = '700px 350px';
  }

  apply();

  // Re-apply on theme switch
  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-md-color-scheme'] });

  if (typeof document$ !== 'undefined') {
    document$.subscribe(apply);
  }
})();
