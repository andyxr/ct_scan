'use client'

import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import { AnalysisAction } from '@/app/page'
import { ANALYSES, ESTIMATE_REQUIRED_REASON, ESTIMATE_NOT_NUMERIC_REASON } from '@/lib/analyses'
import { detectColumns, hasUsableEstimate } from '@/lib/csv'

interface ActionSelectorProps {
  onActionSelect: (action: AnalysisAction) => void
  data: any[]
}

/**
 * The sheet's index of analyses, set as ruled entries rather than as cards.
 *
 * A log sheet lists what can be recorded on it in numbered rows against a rule;
 * it does not float tiles above itself. Each row carries its reference number,
 * the analysis, what it shows, and — when the file cannot support it — the
 * reason, stated on the row rather than hidden in a tooltip.
 */
export default function ActionSelector({ onActionSelect, data }: ActionSelectorProps) {
  const columns = useMemo(() => detectColumns(data), [data])
  const estimateUsable = hasUsableEstimate(data, columns)
  const estimateReason = columns.estimate ? ESTIMATE_NOT_NUMERIC_REASON : ESTIMATE_REQUIRED_REASON

  return (
    <section>
      <h2 className="sheet-heading mb-1 text-sm font-bold tracking-[0.16em] text-gray-700">
        Available analyses
      </h2>

      <ul className="border-t border-gray-900">
        {ANALYSES.map((action, index) => {
          const available = !action.requiresEstimate || estimateUsable
          return (
            <li key={action.id} className="border-b border-gray-300">
              <button
                type="button"
                onClick={() => available && onActionSelect(action.id)}
                disabled={!available}
                className={`group flex w-full items-baseline gap-4 px-2 py-4 text-left transition-colors ${
                  available
                    ? 'cursor-pointer hover:bg-gray-100'
                    : 'cursor-not-allowed opacity-55'
                }`}
              >
                <span className="sheet-figure w-8 shrink-0 text-sm text-gray-400">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <action.Icon
                  className={`h-5 w-5 shrink-0 translate-y-1 text-blue-600 ${available ? action.hoverClass : ''}`}
                  aria-hidden="true"
                />

                <span className="flex-1">
                  <span className="block text-lg font-bold tracking-[0.06em] text-gray-900">
                    {action.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-gray-600">
                    {action.description}
                  </span>
                  {!available && (
                    <span className="sheet-figure mt-1 block text-xs uppercase tracking-[0.08em] text-red-700">
                      Unavailable — {estimateReason}
                    </span>
                  )}
                </span>

                {available && (
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 translate-y-1 text-gray-400 transition-transform group-hover:translate-x-1 group-hover:text-gray-900"
                  />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
