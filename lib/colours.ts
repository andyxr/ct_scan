/**
 * Chart colours for item types.
 *
 * The app is drawn as a quality office's log sheet (see app/globals.css), so the
 * chrome is ledger stock, hairline rules and near-black ink. These series colours
 * are the inks a sheet like that would actually be marked up in: they sit on warm
 * stock rather than on white, and they stay separable from the sheet's three
 * working inks (process red, ledger green, operator blue).
 *
 * As before, hue *and* lightness both vary across the ramp, so the series remain
 * distinguishable for the common colour-vision deficiencies rather than relying on
 * a red/green split. Checked as greyscale: the lightness steps are monotonic
 * enough that no two adjacent entries collapse.
 *
 * Ledger green leads, so a file with a single item type is drawn in the same ink
 * the sheet uses for the process itself.
 */
export const DEFAULT_TYPE_COLOURS: readonly string[] = [
  '#2f6b4f', // ledger green
  '#24527a', // operator blue
  '#9a6a15', // pencil amber
  '#6b3f6e', // aniline violet
  '#1f6f74', // verdigris
  '#a8321f', // process red
  '#4f6b23', // olive
  '#8a4b2a', // sienna
]

/** Palette colour for the nth item type, cycling so any number of types is covered. */
export function colourForIndex(index: number): string {
  return DEFAULT_TYPE_COLOURS[index % DEFAULT_TYPE_COLOURS.length]
}

/**
 * The sheet's fixed inks, for chart furniture that means something specific.
 *
 * Kept here rather than inline in each analysis so the four charts cannot drift
 * apart: red always means deviation, green always means the process, blue always
 * means a value the operator set, amber always means a pencil annotation.
 */
export const SHEET_INK = {
  stock: '#f2efe4',
  stockRaised: '#faf8f1',
  rule: '#c9c3ad',
  ruleStrong: '#a8a08a',
  ink: '#191813',
  inkSoft: '#55513f',
  inkFaint: '#7d7863',
  /** Deviation: signals, breaches, process limits. */
  red: '#a8321f',
  redDeep: '#7d2416',
  /** The process itself: central lines, averages the process produced. */
  green: '#2f6b4f',
  /** The operator's hand: values they set, lines they asked for. */
  blue: '#24527a',
  /** Pencil annotation: the sprint line, cautions. */
  amber: '#9a6a15',
} as const
