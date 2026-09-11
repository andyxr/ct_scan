'use client'

import { useEffect } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'

export type ChartView = 'normal' | 'maximised'

interface ChartViewToggleProps {
  view: ChartView
  onChange: (view: ChartView) => void
}

/** Maximise / Restore button shared by the chart pages. */
export default function ChartViewToggle({ view, onChange }: ChartViewToggleProps) {
  const maximised = view === 'maximised'
  const label = maximised ? 'Restore normal view' : 'Maximise chart'
  return (
    <button
      type="button"
      onClick={() => onChange(maximised ? 'normal' : 'maximised')}
      aria-label={label}
      title={label}
      className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
    >
      {maximised ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      {maximised ? 'Restore' : 'Maximise'}
    </button>
  )
}

/**
 * Escape restores the normal view while maximised. `suspended` lets a page
 * hand Escape to an open modal instead.
 */
export function useEscapeToRestore(view: ChartView, onRestore: () => void, suspended = false) {
  useEffect(() => {
    if (view !== 'maximised' || suspended) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRestore()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, suspended, onRestore])
}
