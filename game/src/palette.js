// Arctic Relay — the look plan, in one place. One cold palette for the whole game:
// snow and ice blues, steel structures, warm hab lights, and one aurora accent.
// The same names are the CSS custom properties in index.html.
export const PALETTE = {
  sky: '#0a1626',
  snow: '#dfe9f2',
  snowShadow: '#aebfd4',
  ice: '#7fb3d9',
  deepIce: '#2e5f86',
  steel: '#3a4756',
  steelDark: '#232c38',
  hab: '#c8a06a',
  habGlow: '#ffb85c',
  ink: '#eef4fa',
  muted: '#8fa5b8',
  accent: '#46e0b6',
  danger: '#ff5d47',
  tracer: '#ffd27a',
};

export function shade(name) {
  return PALETTE[name];
}
