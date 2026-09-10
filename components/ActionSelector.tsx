'use client'

import { useMemo } from 'react'
import { ChartScatter, Activity, ChartColumn, Dices } from 'lucide-react'
import { AnalysisAction } from '@/app/page'
import { detectColumns } from '@/lib/csv'

interface ActionSelectorProps {
  onActionSelect: (action: AnalysisAction) => void
  data: any[]
}

export default function ActionSelector({ onActionSelect, data }: ActionSelectorProps) {
  const columns = useMemo(() => detectColumns(data), [data])
  const hasEstimate = Boolean(columns.estimate)

  // Each icon gets a hover motion that echoes its chart: points scatter, a
  // trace pulses, bars grow, dice shake. Only applied when the panel is enabled.
  const actions = [
    {
      id: 'cycle-time' as AnalysisAction,
      title: 'Cycle Time Analysis',
      description: 'Analyse cycle times with 85th percentile visualization',
      Icon: ChartScatter,
      hoverClass: 'group-hover:animate-bounce',
      available: true,
      unavailableReason: ''
    },
    {
      id: 'process-behaviour' as AnalysisAction,
      title: 'Process Behaviour Chart',
      description: 'Visualise process stability and predictability',
      Icon: Activity,
      hoverClass: 'group-hover:animate-pulse',
      available: true,
      unavailableReason: ''
    },
    {
      id: 'correlation' as AnalysisAction,
      title: 'Correlation Analysis',
      description: 'Analyse correlation between estimates and cycle time ranges',
      Icon: ChartColumn,
      hoverClass: 'transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6',
      available: hasEstimate,
      unavailableReason: 'Needs an estimate column'
    },
    {
      id: 'monte-carlo' as AnalysisAction,
      title: 'Monte Carlo Simulation',
      description: 'Forecast delivery probabilities',
      Icon: Dices,
      hoverClass: 'group-hover:animate-wiggle',
      available: true,
      unavailableReason: ''
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => action.available && onActionSelect(action.id)}
          disabled={!action.available}
          className={`group p-6 rounded-lg shadow-md transition-all ${
            action.available
              ? 'bg-white dark:bg-gray-900 hover:shadow-lg hover:scale-105 cursor-pointer border border-gray-200 dark:border-gray-700'
              : 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-60 border border-gray-200 dark:border-gray-600'
          }`}
        >
          <action.Icon
            className={`h-10 w-10 mb-4 text-blue-600 dark:text-blue-400 ${action.available ? action.hoverClass : ''}`}
            aria-hidden="true"
          />
          <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">{action.title}</h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm">{action.description}</p>
          {!action.available && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">{action.unavailableReason}</p>
          )}
        </button>
      ))}
    </div>
  )
}