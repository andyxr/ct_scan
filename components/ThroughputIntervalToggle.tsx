'use client'

import type { ThroughputInterval } from '@/lib/throughputRun'

const INTERVALS: readonly { id: ThroughputInterval; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'fortnight', label: 'Fortnight' },
]

const SEGMENT = 'px-3 py-1.5 text-sm border-gray-300 first:rounded-l last:rounded-r border-y border-l last:border-r'

/** Day / Week / Fortnight segmented control shared by the throughput charts. */
export default function ThroughputIntervalToggle({ value, onChange }: { value: ThroughputInterval; onChange: (interval: ThroughputInterval) => void }) {
  return (
    <div role="group" aria-label="Interval" className="flex">
      {INTERVALS.map(option => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={value === option.id}
          className={`${SEGMENT} ${value === option.id ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
