'use client'

interface SprintLengthControlProps {
  enabled: boolean
  days: number
  withinCount: number
  totalCount: number
  onToggle: (enabled: boolean) => void
  onDaysChange: (days: number) => void
}

export const DEFAULT_SPRINT_DAYS = 14

/** Toggle and length input for the sprint reference line shared by the cycle time charts. */
export default function SprintLengthControl({ enabled, days, withinCount, totalCount, onToggle, onDaysChange }: SprintLengthControlProps) {
  const percent = totalCount > 0 ? Math.round((withinCount / totalCount) * 100) : 0

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-700 dark:text-gray-300">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onToggle(e.target.checked)}
          className="h-4 w-4 accent-amber-500"
        />
        Show sprint length
      </label>
      <label className="flex items-center gap-2">
        <span>Sprint length (days)</span>
        <input
          type="number"
          min="1"
          max="365"
          value={days}
          onChange={e => onDaysChange(Math.max(1, Math.min(365, parseInt(e.target.value) || DEFAULT_SPRINT_DAYS)))}
          className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-800 dark:text-gray-100"
        />
      </label>
      {enabled && (
        <span className="text-amber-700 dark:text-amber-400">
          {withinCount} of {totalCount} items ({percent}%) finished within {days} days
        </span>
      )}
    </div>
  )
}
