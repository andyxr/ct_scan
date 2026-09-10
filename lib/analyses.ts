import { ChartScatter, Activity, ChartColumn, Dices, type LucideIcon } from 'lucide-react'

export type AnalysisId = 'cycle-time' | 'process-behaviour' | 'correlation' | 'monte-carlo'

export interface Analysis {
  id: AnalysisId
  title: string
  description: string
  Icon: LucideIcon
  // Hover motion that echoes the chart: points scatter, a trace pulses, bars
  // grow, dice shake.
  hoverClass: string
  requiresEstimate: boolean
}

export const ANALYSES: readonly Analysis[] = [
  {
    id: 'cycle-time',
    title: 'Cycle Time Analysis',
    description: 'Analyse cycle times with 85th percentile visualization',
    Icon: ChartScatter,
    hoverClass: 'group-hover:animate-bounce',
    requiresEstimate: false,
  },
  {
    id: 'process-behaviour',
    title: 'Process Behaviour Chart',
    description: 'Visualise process stability and predictability',
    Icon: Activity,
    hoverClass: 'group-hover:animate-pulse',
    requiresEstimate: false,
  },
  {
    id: 'correlation',
    title: 'Correlation Analysis',
    description: 'Analyse correlation between estimates and cycle time ranges',
    Icon: ChartColumn,
    hoverClass: 'transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6',
    requiresEstimate: true,
  },
  {
    id: 'monte-carlo',
    title: 'Monte Carlo Simulation',
    description: 'Forecast delivery probabilities',
    Icon: Dices,
    hoverClass: 'group-hover:animate-wiggle',
    requiresEstimate: false,
  },
]

export const ESTIMATE_REQUIRED_REASON = 'Needs an estimate column'
