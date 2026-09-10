'use client'

import { useMemo } from 'react'
import { AnalysisAction } from '@/app/page'
import { ANALYSES, ESTIMATE_REQUIRED_REASON } from '@/lib/analyses'
import { detectColumns } from '@/lib/csv'

interface ActionSelectorProps {
  onActionSelect: (action: AnalysisAction) => void
  data: any[]
}

export default function ActionSelector({ onActionSelect, data }: ActionSelectorProps) {
  const columns = useMemo(() => detectColumns(data), [data])
  const hasEstimate = Boolean(columns.estimate)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {ANALYSES.map((action) => {
        const available = !action.requiresEstimate || hasEstimate
        return (
        <button
          key={action.id}
          onClick={() => available && onActionSelect(action.id)}
          disabled={!available}
          className={`group p-6 rounded-lg shadow-md transition-all ${
            available
              ? 'bg-white dark:bg-gray-900 hover:shadow-lg hover:scale-105 cursor-pointer border border-gray-200 dark:border-gray-700'
              : 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60 border border-gray-200 dark:border-gray-600'
          }`}
        >
          <action.Icon
            className={`h-10 w-10 mb-4 text-blue-600 dark:text-blue-400 ${available ? action.hoverClass : ''}`}
            aria-hidden="true"
          />
          <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">{action.title}</h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm">{action.description}</p>
          {!available && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">{ESTIMATE_REQUIRED_REASON}</p>
          )}
        </button>
        )
      })}
    </div>
  )
}