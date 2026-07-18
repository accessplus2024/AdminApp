// Inline-SVG Lucide renderer — returns real React <svg> elements so icons
// survive React re-renders (no DOM replacement) and screenshot cleanly.
(function () {
  const SIZES = { 'ico': 19, 'ico-sm': 16, 'ico-xs': 14, 'ico-star': 15, 'nav-ico': 19, 'nav-ico-sm': 15 };
  function pascal(n) {
    return n.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  }
  function sizeFor(cls) {
    if (cls) { const parts = cls.split(' '); for (const k in SIZES) { if (parts.indexOf(k) !== -1) return SIZES[k]; } }
    return 18;
  }
  window.Ic = function (name, cls) {
    const L = window.lucide;
    const node = L && L[pascal(name)];
    if (!node || !node[2]) return null;
    const size = sizeFor(cls);
    const children = node[2].map((c, i) => React.createElement(c[0], Object.assign({ key: i }, c[1])));
    return React.createElement('svg', {
      className: cls, width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', strokeWidth: 2,
      strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
    }, children);
  };
})();
