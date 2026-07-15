/**
 * Tableau 10 — perceptually optimized categorical palette.
 * Ordered to maximize perceptual distance between adjacent indices.
 *
 * Reference: Tableau Research (2016)
 * https://www.tableau.com/blog/colors-upgrade-tableau-10-56782
 *
 * For joints beyond index 9 the palette wraps and each additional
 * pass shifts lightness down by 15% so repeated hues remain distinct.
 */
const TABLEAU_10 = [
  '#4E79A7', // blue
  '#F28E2B', // orange
  '#E15759', // red
  '#76B7B2', // teal
  '#59A14F', // green
  '#EDC948', // yellow
  '#B07AA1', // purple
  '#FF9DA7', // pink
  '#9C755F', // brown
  '#BAB0AC', // gray
] as const

/**
 * Shift the HSL lightness of a hex color by `delta` (range -1 to 1).
 *
 * Uses HSL rather than a perceptually-uniform space (e.g. OKLCH) to stay
 * dependency-free. Acceptable for small shifts (±0.15); larger shifts will
 * produce uneven perceived brightness across hues.
 */
function shiftLightness(hex: string, delta: number): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  const l = (max + min) / 2

  let h = 0
  let s = 0
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }

  const nl = Math.max(0, Math.min(1, l + delta))

  if (s === 0) {
    const v = Math.round(nl * 255).toString(16).padStart(2, '0')
    return `#${v}${v}${v}`
  }

  const q = nl < 0.5 ? nl * (1 + s) : nl + s - nl * s
  const p = 2 * nl - q
  const hue2rgb = (t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  return '#' + [h + 1 / 3, h, h - 1 / 3]
    .map((t) => Math.round(hue2rgb(t) * 255).toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Returns the display color for a joint at the given index.
 *
 * - Indices 0–9   → Tableau 10 base colors
 * - Indices 10–19 → same hues, lightness −15%
 * - Indices 20–29 → same hues, lightness −30%
 * - …and so on
 */
export function jointColor(index: number): string {
  const base = TABLEAU_10[index % 10]
  const pass = Math.floor(index / 10)
  return pass === 0 ? base : shiftLightness(base, -0.15 * pass)
}
