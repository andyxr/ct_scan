import { ChartScatter, Hourglass, Activity, ChartColumn, Dices, type LucideIcon } from 'lucide-react'
import { hasUsableEstimate, toInProgressItems, type ColumnMap } from './csv'

export type AnalysisId = 'cycle-time' | 'aging-wip' | 'process-behaviour' | 'correlation' | 'monte-carlo'

export interface Analysis {
  id: AnalysisId
  title: string
  description: string
  Icon: LucideIcon
  // Hover motion that echoes the chart: points scatter, sand runs, a trace
  // pulses, bars grow, dice shake.
  hoverClass: string
  /**
   * Why the whole file cannot support this analysis, or null when it can.
   * Judged on the unfiltered file: availability is a property of the upload,
   * not of the current type or date filter.
   */
  unavailableReason: (data: any[], columns: ColumnMap) => string | null
}

const ESTIMATE_REQUIRED_REASON = 'Needs an estimate column'
const ESTIMATE_NOT_NUMERIC_REASON = 'The estimate column has values that are not numbers'
const IN_PROGRESS_REQUIRED_REASON = 'Needs at least one in-progress item: a row with a blank end_date'

const always = () => null

function estimateReason(data: any[], columns: ColumnMap): string | null {
  if (hasUsableEstimate(data, columns)) return null
  return columns.estimate ? ESTIMATE_NOT_NUMERIC_REASON : ESTIMATE_REQUIRED_REASON
}

function inProgressReason(data: any[], columns: ColumnMap): string | null {
  return toInProgressItems(data, columns).length > 0 ? null : IN_PROGRESS_REQUIRED_REASON
}

export const ANALYSES: readonly Analysis[] = [
  {
    id: 'cycle-time',
    title: 'Cycle Time Analysis',
    description: 'Analyse cycle times with 85th percentile visualization',
    Icon: ChartScatter,
    hoverClass: 'group-hover:animate-bounce',
    unavailableReason: always,
  },
  {
    id: 'aging-wip',
    title: 'Aging Work In Progress',
    description: 'See how long each open item has been running against completed cycle times',
    Icon: Hourglass,
    hoverClass: 'transition-transform duration-500 group-hover:rotate-180',
    unavailableReason: inProgressReason,
  },
  {
    id: 'process-behaviour',
    title: 'Process Behaviour Chart',
    description: 'Visualise process stability and predictability',
    Icon: Activity,
    hoverClass: 'group-hover:animate-pulse',
    unavailableReason: always,
  },
  {
    id: 'correlation',
    title: 'Correlation Analysis',
    description: 'Analyse correlation between estimates and cycle time ranges',
    Icon: ChartColumn,
    hoverClass: 'transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6',
    unavailableReason: estimateReason,
  },
  {
    id: 'monte-carlo',
    title: 'Monte Carlo Simulation',
    description: 'Forecast delivery probabilities',
    Icon: Dices,
    hoverClass: 'group-hover:animate-wiggle',
    unavailableReason: always,
  },
]
