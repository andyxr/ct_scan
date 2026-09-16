'use client'

import { ALL_ITEM_TYPES } from '@/lib/csv'

interface ItemTypeControlProps {
  types: string[]
  value: string
  onChange: (type: string) => void
  /** Counts over the rows the current filters admit. */
  completedCount: number
  inProgressCount: number
}

/**
 * Global item type filter, shown once above whichever analysis is open, with
 * the completed and in-progress counts of whatever the filters admit. The
 * dropdown needs an item_type column; the counts do not, so the row always
 * renders.
 */
export default function ItemTypeControl({ types, value, onChange, completedCount, inProgressCount }: ItemTypeControlProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-700">
      {types.length > 0 && (
        <label className="flex items-center gap-2">
          <span>Item type</span>
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded bg-white"
          >
            <option value={ALL_ITEM_TYPES}>{ALL_ITEM_TYPES}</option>
            {types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
      )}
      <span className="text-gray-500">
        {completedCount} completed
        {inProgressCount > 0 && <> · {inProgressCount} in progress (not shown)</>}
      </span>
    </div>
  )
}
