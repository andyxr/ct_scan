'use client'

/**
 * One boxed reading in a results row.
 *
 * A log sheet records its results in ruled boxes rather than in tinted tiles:
 * hairline rules, a small caps label, and the figure set in mono so a row of
 * them reads as a column of figures. The ink is passed in by the caller so it
 * keeps the sheet's meaning — red is deviation, green is the process, blue is
 * the operator's hand — rather than being decorative.
 *
 * Wrap a row of these in a container that carries the opening rules, so the
 * boxes share their edges:
 *
 *   <dl className="grid grid-cols-2 border-l border-t border-gray-300 md:grid-cols-4">
 */
export default function Reading({
  label,
  value,
  note,
  ink,
}: {
  label: string
  value: string
  /** Optional qualifier under the figure, e.g. what a confidence level means. */
  note?: string
  /** Tailwind text colour class. Defaults to ink. */
  ink?: string
}) {
  return (
    <div className="border-b border-r border-gray-300 px-3 py-2">
      <dt className="text-[0.6875rem] font-bold uppercase tracking-[0.1em] text-gray-500">
        {label}
      </dt>
      <dd className={`sheet-figure text-lg font-bold ${ink ?? 'text-gray-900'}`}>{value}</dd>
      {note && (
        <dd className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.06em] text-gray-500">
          {note}
        </dd>
      )}
    </div>
  )
}
