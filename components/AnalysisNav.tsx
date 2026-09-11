'use client'

import { useMemo } from 'react'
import { ANALYSES, ESTIMATE_REQUIRED_REASON, type AnalysisId } from '@/lib/analyses'
import { detectColumns } from '@/lib/csv'

interface AnalysisNavProps {
  current: AnalysisId
  onSelect: (id: AnalysisId) => void
  onReset: () => void
  data: any[]
}

export default function AnalysisNav({ current, onSelect, onReset, data }: AnalysisNavProps) {
  const columns = useMemo(() => detectColumns(data), [data])
  const hasEstimate = Boolean(columns.estimate)

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-2" aria-label="Analyses">
      {ANALYSES.map(analysis => {
        const available = !analysis.requiresEstimate || hasEstimate
        const active = analysis.id === current
        return (
          <button
            key={analysis.id}
            type="button"
            onClick={() => available && onSelect(analysis.id)}
            disabled={!available}
            aria-current={active ? 'page' : undefined}
            title={available ? undefined : ESTIMATE_REQUIRED_REASON}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border transition-colors ${
              active
                ? 'bg-blue-600 text-white border-blue-600'
                : available
                  ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            }`}
          >
            <analysis.Icon className="w-4 h-4" aria-hidden="true" />
            {analysis.title}
          </button>
        )
      })}
      <button
        type="button"
        onClick={onReset}
        className="ml-auto text-sm text-gray-600 hover:text-gray-900 underline"
      >
        Upload different file
      </button>
    </nav>
  )
}
