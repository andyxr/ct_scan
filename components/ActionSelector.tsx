'use client'

import { AnalysisAction } from '@/app/page'

interface ActionSelectorProps {
  onActionSelect: (action: AnalysisAction) => void
}

export default function ActionSelector({ onActionSelect }: ActionSelectorProps) {
  const actions = [
    {
      id: 'cycle-time' as AnalysisAction,
      title: 'Cycle Time Analysis',
      description: 'Analyze cycle times with 85th percentile visualization',
      icon: '📊',
      available: true
    },
    {
      id: 'process-behaviour' as AnalysisAction,
      title: 'Process Behaviour Chart',
      description: 'Visualize process stability and predictability',
      icon: '📈',
      available: true
    },
    {
      id: 'correlation' as AnalysisAction,
      title: 'Correlation Analysis',
      description: 'Analyze correlation between estimates and cycle time ranges',
      icon: '📊',
      available: true
    },
    {
      id: 'monte-carlo' as AnalysisAction,
      title: 'Monte Carlo Simulation',
      description: 'Forecast delivery probabilities',
      icon: '🎲',
      available: false
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => action.available && onActionSelect(action.id)}
          disabled={!action.available}
          className={`p-6 rounded-lg shadow-md transition-all ${
            action.available
              ? 'bg-white dark:bg-gray-800 hover:shadow-lg hover:scale-105 cursor-pointer border border-gray-200 dark:border-gray-700'
              : 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60 border border-gray-200 dark:border-gray-600'
          }`}
        >
          <div className="text-4xl mb-4">{action.icon}</div>
          <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">{action.title}</h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm">{action.description}</p>
          {!action.available && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">Coming soon</p>
          )}
        </button>
      ))}
    </div>
  )
}