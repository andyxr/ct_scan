'use client'

import { ALL_ITEM_TYPES } from '@/lib/csv'

interface ItemTypeControlProps {
  types: string[]
  value: string
  onChange: (type: string) => void
  matchedCount: number
  totalCount: number
}

/**
 * Global item type filter, shown once above whichever analysis is open.
 * Rendered even for a single type, so the user can see the column was read.
 */
export default function ItemTypeControl({ types, value, onChange, matchedCount, totalCount }: ItemTypeControlProps) {
  if (types.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-700">
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
      {value !== ALL_ITEM_TYPES && (
        <span className="text-gray-500">{matchedCount} of {totalCount} items</span>
      )}
    </div>
  )
}
