// The shoot+ mark: a glass camera with a white glass plus cut into its lower right, each with a soft
// drop shadow. Same build as the lifestyle+ heart, so the two icons sit together on the Home Screen.
// One drawing feeds the header logo, the loading screen, the app icons in public/icons and the icon
// that's redrawn in the browser when you pick a new logo color.

export const LOGO_COLORS = [
  { id: 'glass', name: 'Glass', hex: '#c8c8cc' },
  { id: 'sunflower', name: 'Sunflower', hex: '#ffcf5c' },
  { id: 'tangerine', name: 'Tangerine', hex: '#ff9f4a' },
  { id: 'coral', name: 'Coral', hex: '#ff6f61' },
  { id: 'rose', name: 'Rose', hex: '#ff86b8' },
  { id: 'lilac', name: 'Lilac', hex: '#bba9ff' },
  { id: 'sky', name: 'Sky', hex: '#7cc4ff' },
  { id: 'mint', name: 'Mint', hex: '#7fdca0' },
];
export const DEFAULT_LOGO = LOGO_COLORS[0].hex;

const valid = (hex) => (/^#[0-9a-f]{6}$/i.test(hex || '') ? hex : DEFAULT_LOGO);

// Shapes in a 1024 box. The body has a raised viewfinder hump; the lens is a ring cut through it.
export const BODY =
  'M262 332H372L414 262C422 249 434 242 449 242H575C590 242 602 249 610 262L652 332H762C824 332 864 372 864 434V700C864 762 824 802 762 802H262C200 802 160 762 160 700V434C160 372 200 332 262 332Z';
const LENS = { cx: 452, cy: 556, r: 156 };
const RING = (r) => `M${LENS.cx - r} ${LENS.cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
// The plus is a thin cross with a round stroke, which rounds its outer corners.
const PLUS = 'M722 552h36v102h102v36h-102v102h-36v-102h-102v-36h102z';

/**
 * SVG markup for the mark.
 *   color:     camera color (any color; the glass shading is laid over it)
 *   bg:        true for app icons (full square near-black tile); false for the in-app logo
 *   id:        prefix so several marks on one page don't share ids
 *   fill:      optional raw fill for the camera (the loading screen passes a CSS variable)
 */
export function logoSVG(color, { bg = false, id = 'sp', fill } = {}) {
  const c = fill || valid(color);
  const view = bg ? '0 0 1024 1024' : '130 150 790 790';
  const body = (attrs) => `<path d="${BODY}" ${attrs}/>`;
  const plus = (width, attrs) => `<path d="${PLUS}" stroke-width="${width}" stroke-linejoin="round" ${attrs}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="100%" height="100%">
  <defs>
    <linearGradient id="${id}-tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b0c"/><stop offset="1" stop-color="#000"/></linearGradient>
    <linearGradient id="${id}-tileRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".25" stop-color="#fff" stop-opacity=".04"/><stop offset=".8" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient>
    <linearGradient id="${id}-shade" x1=".15" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".45" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></linearGradient>
    <linearGradient id="${id}-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}-rim" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".5" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity=".5"/></linearGradient>
    <linearGradient id="${id}-plus" x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="#f6f6f8"/><stop offset="1" stop-color="#cdcdd2"/></linearGradient>
    <radialGradient id="${id}-glass" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".25" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <mask id="${id}-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">
      <rect width="1024" height="1024" fill="#fff"/>
      <path d="${RING(118)}" fill="#000"/>
      ${plus(120, 'fill="#000" stroke="#000"')}
    </mask>
    <clipPath id="${id}-bc">${body('')}</clipPath>
    <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="170%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="18"/><feOffset dy="16" result="b"/>
      <feFlood flood-color="#000" flood-opacity=".6"/><feComposite in2="b" operator="in" result="s"/>
      <feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  ${bg ? `<rect width="1024" height="1024" fill="url(#${id}-tile)"/><rect x="6" y="6" width="1012" height="1012" rx="226" fill="none" stroke="url(#${id}-tileRim)" stroke-width="12"/>` : ''}
  <g filter="url(#${id}-shadow)"><g mask="url(#${id}-cut)">
    ${body(`style="fill:${c}" opacity=".85"`)}
    <g clip-path="url(#${id}-bc)">
      ${body(`fill="url(#${id}-shade)"`)}
      ${body(`fill="url(#${id}-sheen)"`)}
      ${body(`fill="none" stroke="#000" stroke-opacity=".3" stroke-width="44" transform="translate(0 20)" filter="url(#${id}-soft)"`)}
      ${body(`fill="none" stroke="url(#${id}-rim)" stroke-width="12"`)}
      <path d="${RING(118)}" fill="none" stroke="url(#${id}-rim)" stroke-width="10"/>
    </g>
  </g></g>
  <g filter="url(#${id}-shadow)">
    <circle cx="${LENS.cx}" cy="${LENS.cy}" r="78" style="fill:${c}" opacity=".55"/>
    <circle cx="${LENS.cx}" cy="${LENS.cy}" r="78" fill="url(#${id}-glass)"/>
    <circle cx="${LENS.cx}" cy="${LENS.cy}" r="78" fill="none" stroke="url(#${id}-rim)" stroke-width="8"/>
    <circle cx="764" cy="420" r="22" fill="url(#${id}-plus)"/>
  </g>
  <g filter="url(#${id}-shadow)">
    ${plus(60, 'fill="#fff" stroke="#fff"')}
    ${plus(46, `fill="url(#${id}-plus)" stroke="url(#${id}-plus)" transform="translate(0 4)"`)}
  </g>
</svg>`;
}

/** Draws the app icon to a PNG data URL in the browser (for the live home-screen icon and tab icon). */
export function logoIconPNG(color, size = 180) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSVG(color, { bg: true, id: 'ico' }))}`;
  });
}
