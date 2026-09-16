'use client'

import { OPEN_DATE_RANGE, type DateRange } from '@/lib/csv'

interface DateRangeControlProps {
  value: DateRange
  span: { min: number; max: number } | null
  onChange: (range: DateRange) => void
  matchedCount: number
  totalCount: number
}

/** YYYY-MM-DD from local date parts. toISOString would shift the day by the timezone offset. */
function toInputValue(epoch: number | null): string {
  if (epoch === null) return ''
  const date = new Date(epoch)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local midnight for a YYYY-MM-DD input. new Date(str) would read it as UTC. */
function fromInputValue(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
}

/**
 * Global completion-date filter, shown once above whichever analysis is open,
 * alongside the item type filter.
 */
export default function DateRangeControl({ value, span, onChange, matchedCount, totalCount }: DateRangeControlProps) {
  if (!span) return null

  const min = toInputValue(span.min)
  const max = toInputValue(span.max)
  const isFiltered = value.from !== null || value.to !== null

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-700">
      <label className="flex items-center gap-2">
        <span>Completed from</span>
        <input
          type="date"
          value={toInputValue(value.from)}
          min={min}
          max={max}
          onChange={e => onChange({ ...value, from: fromInputValue(e.target.value) })}
          className="px-2 py-1 border border-gray-300 rounded bg-white"
        />
      </label>
      <label className="flex items-center gap-2">
        <span>to</span>
        <input
          type="date"
          value={toInputValue(value.to)}
          min={min}
          max={max}
          onChange={e => onChange({ ...value, to: fromInputValue(e.target.value) })}
          className="px-2 py-1 border border-gray-300 rounded bg-white"
        />
      </label>
      {isFiltered && (
        <>
          <button
            onClick={() => onChange(OPEN_DATE_RANGE)}
            className="text-blue-600 underline hover:text-blue-800"
          >
            Clear
          </button>
          <span className="text-gray-500">{matchedCount} of {totalCount} items</span>
        </>
      )}
    </div>
  )
}
