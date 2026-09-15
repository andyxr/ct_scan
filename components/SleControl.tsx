'use client'

import { DEFAULT_SLE_DAYS, SLE_PERCENTILES, SLE_STATUS, percentileName, type SlePercentile, type SleStatus } from '@/lib/sle'

interface SleControlProps {
  enabled: boolean
  days: number
  percentile: SlePercentile
  status: SleStatus
  onToggle: (enabled: boolean) => void
  onDaysChange: (days: number) => void
  onPercentileChange: (percentile: SlePercentile) => void
}

/** Toggle, target days, confidence percentile and verdict badge for the SLE line on the cycle time scatterplot. */
export default function SleControl({ enabled, days, percentile, status, onToggle, onDaysChange, onPercentileChange }: SleControlProps) {
  const badge = SLE_STATUS[status]

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4 text-sm text-gray-700">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => onToggle(e.target.checked)}
          className="h-4 w-4 accent-green-600"
        />
        Show SLE
      </label>
      <label className="flex items-center gap-2">
        <span>SLE (days)</span>
        <input
          type="number"
          min="1"
          max="365"
          value={days}
          onChange={e => onDaysChange(Math.max(1, Math.min(365, parseInt(e.target.value) || DEFAULT_SLE_DAYS)))}
          className="w-20 px-2 py-1 border border-gray-300 rounded"
        />
      </label>
      <label className="flex items-center gap-2">
        <span>at the</span>
        <select
          value={String(percentile)}
          onChange={e => {
            const chosen = SLE_PERCENTILES.find(p => p === Number(e.target.value))
            if (chosen !== undefined) onPercentileChange(chosen)
          }}
          className="px-2 py-1 border border-gray-300 rounded bg-white"
        >
          {SLE_PERCENTILES.map(p => (
            <option key={p} value={String(p)}>{percentileName(p)}</option>
          ))}
        </select>
        <span>percentile</span>
      </label>
      {enabled && (
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badge.badgeClass}`}>
          {badge.label}
        </span>
      )}
    </div>
  )
}
