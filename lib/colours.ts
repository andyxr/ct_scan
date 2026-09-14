/**
 * Chart colours for item types.
 *
 * The app's chrome is deliberately near-monochrome (see app/globals.css, which
 * remaps the Tailwind greys to black and white), so the scatterplot carries
 * almost all of the saturated colour on screen. These are picked to stay
 * distinguishable against that chrome and from each other: hue and lightness
 * both vary, so the series remain separable for the common colour-vision
 * deficiencies rather than relying on a red/green split.
 *
 * Green leads so a file with a single item type looks exactly as it did before
 * per-type colouring existed.
 */
export const DEFAULT_TYPE_COLOURS: readonly string[] = [
  '#22c55e', // green
  '#2563eb', // blue
  '#d97706', // amber
  '#9333ea', // purple
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
  '#e11d48', // rose
]

/** Palette colour for the nth item type, cycling so any number of types is covered. */
export function colourForIndex(index: number): string {
  return DEFAULT_TYPE_COLOURS[index % DEFAULT_TYPE_COLOURS.length]
}
