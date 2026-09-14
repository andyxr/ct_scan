'use client'

interface TypeColourControlProps {
  types: string[]
  colours: Record<string, string>
  onChange: (type: string, colour: string) => void
  onReset: () => void
}

/**
 * Per-item-type colour swatches for the scatterplot.
 *
 * Hidden below two types: colouring by type says nothing when there is only one.
 * The types listed are the file's, not the current filter's, so colours can be
 * set before narrowing the filter to a type.
 *
 * The native colour input is overlaid on the swatch rather than shown: its
 * default chrome is at odds with this app's square, hard-shadowed styling. It
 * keeps its own focus ring and keyboard behaviour by staying a real focusable
 * input rather than being replaced by a click handler.
 */
export default function TypeColourControl({ types, colours, onChange, onReset }: TypeColourControlProps) {
  if (types.length < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-700">
      <span>Colours</span>
      {types.map(type => (
        <label key={type} className="relative flex items-center gap-2 cursor-pointer">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 border border-gray-300"
            style={{ backgroundColor: colours[type] }}
          />
          <input
            type="color"
            value={colours[type]}
            onChange={e => onChange(type, e.target.value)}
            aria-label={`Colour for ${type}`}
            className="absolute left-0 top-0 h-4 w-4 opacity-0 cursor-pointer"
          />
          {type}
        </label>
      ))}
      <button
        onClick={onReset}
        className="text-gray-600 hover:text-gray-900 underline"
      >
        Reset colours
      </button>
    </div>
  )
}
