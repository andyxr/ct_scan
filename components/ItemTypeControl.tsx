'use client'

import { ALL_ITEM_TYPES } from '@/lib/csv'
import { SHEET_INK } from '@/lib/colours'

interface ItemTypeControlProps {
  types: string[]
  /** Selected types. Empty means All. */
  value: string[]
  onChange: (types: string[]) => void
  /** Each type's chart colour, so a checkbox reads as the key to its points. */
  typeColours: Record<string, string>
  /** Counts over the rows the current filters admit. */
  completedCount: number
  inProgressCount: number
  /** True on the one analysis that draws in-progress items, so the count stops saying otherwise. */
  inProgressCharted?: boolean
}

/**
 * Global item type filter, shown once above whichever analysis is open, with
 * the completed and in-progress counts of whatever the filters admit. "All" is
 * the empty selection; ticking types narrows to their union. Unticking the last
 * type, or ticking every type, returns to All. The checkboxes need an
 * item_type column; the counts do not, so the row always renders.
 */
export default function ItemTypeControl({ types, value, onChange, typeColours, completedCount, inProgressCount, inProgressCharted = false }: ItemTypeControlProps) {
  const selected = new Set(value)

  const toggle = (type: string) => {
    const next = selected.has(type) ? value.filter(t => t !== type) : [...value, type]
    onChange(next.length === types.length ? [] : next)
  }

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-700">
      {types.length > 0 && (
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <legend className="sr-only">Item types</legend>
          <span aria-hidden="true">Item type</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value.length === 0}
              onChange={() => onChange([])}
              className="h-4 w-4"
              style={{ accentColor: SHEET_INK.ink }}
            />
            {ALL_ITEM_TYPES}
          </label>
          {types.map(type => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.has(type)}
                onChange={() => toggle(type)}
                className="h-4 w-4"
                style={{ accentColor: typeColours[type] }}
              />
              {type}
            </label>
          ))}
        </fieldset>
      )}
      <span className="text-gray-500">
        {completedCount} completed
        {inProgressCount > 0 && <> · {inProgressCount} in progress{!inProgressCharted && ' (not shown)'}</>}
      </span>
    </div>
  )
}
