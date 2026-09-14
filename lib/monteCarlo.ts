/**
 * Monte Carlo forecasting over historical daily throughput.
 *
 * One sample space serves two questions. `throughputFrom` builds it: the number
 * of items completed on each calendar day between the first and last completion,
 * zero days included. Zero days are the point — dropping them would forecast a
 * team that never has a quiet day.
 *
 * The two questions are the same sampling process read in opposite directions:
 *
 *   "how many?"  fix the days, accumulate items  -> simulateItemCount
 *   "when?"      fix the items, accumulate days  -> simulateDaysToTarget
 *
 * That inversion also flips how a confidence level maps onto a percentile, which
 * is the one thing in here easy to get backwards. See CONFIDENCE_TO_PERCENTILE.
 */

import { detectColumns, toWorkItems, formatDate } from './csv'

export interface DailyThroughput {
  date: string
  count: number
  timestamp: number
}

export interface HistogramBin {
  /** The simulated outcome: items completed in forward mode, days taken in backward mode. */
  value: number
  frequency: number
}

export interface SimulationStats {
  totalSimulations: number
  p50: number
  p85: number
  p95: number
  mean: number
  min: number
  max: number
}

export interface Simulation {
  histogram: HistogramBin[]
  stats: SimulationStats
  /**
   * True when the target could not be reached within MAX_SIMULATED_DAYS. Only
   * backward mode can set it; forward mode always terminates.
   */
  unreachable: boolean
}

/** Injectable for tests; production passes nothing and gets Math.random. */
export type Rng = () => number

/**
 * A backward trial that never draws a non-zero sample would loop forever, and a
 * history of all-zero days guarantees exactly that. Ten years of simulated days
 * is far past any useful forecast, so hitting this cap means "your history can't
 * reach this target", not "try more days".
 */
export const MAX_SIMULATED_DAYS = 3650

/**
 * Confidence level -> the percentile of the sorted results to read.
 *
 * Forward: the pessimistic tail is FEWER items, so 85% confidence reads the 15th
 * percentile — 85% of trials did at least this well.
 *
 * Backward: the pessimistic tail is MORE days, so 85% confidence reads the 85th
 * percentile — 85% of trials finished by this day.
 */
export const CONFIDENCE_TO_PERCENTILE = {
  fewerIsWorse: (confidence: number) => 1 - confidence,
  moreIsWorse: (confidence: number) => confidence,
} as const

type PercentileFor = (confidence: number) => number

/**
 * Nearest-rank, matching what this simulation has always used. Deliberately not
 * lib/csv.ts's interpolated percentile(): these outcomes are whole items and
 * whole days, and interpolating would invent a fractional day that no trial ever
 * produced. The two methods disagreeing across the app predates this and is not
 * resolved here.
 */
function nearestRank(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)))
  return sorted[index]
}

/**
 * Completions per calendar day, from the first completion to the last, with
 * quiet days present as zeros.
 */
export function throughputFrom(data: any[]): { dailyThroughput: DailyThroughput[]; throughputArray: number[] } {
  const empty = { dailyThroughput: [], throughputArray: [] }

  const columns = detectColumns(data)
  const items = toWorkItems(data, columns)
  if (items.length === 0) return empty

  const dateGroups: { [key: string]: number } = {}
  items.forEach(item => {
    const d = new Date(item.endDate)
    const dateKey = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
    dateGroups[dateKey] = (dateGroups[dateKey] || 0) + 1
  })

  const dateKeys = Object.keys(dateGroups)
  if (dateKeys.length === 0) return empty

  const timestamps = dateKeys.map(dateKey => {
    const [year, month, day] = dateKey.split('-').map(Number)
    return new Date(year, month - 1, day).getTime()
  })

  const minTimestamp = Math.min(...timestamps)
  const maxTimestamp = Math.max(...timestamps)

  // Step by calendar day rather than by 24 hours: across a clock change a
  // 24-hour step lands on the wrong day, double-counting one and dropping the last.
  const dailyThroughput: DailyThroughput[] = []
  for (const currentDate = new Date(minTimestamp); currentDate.getTime() <= maxTimestamp; currentDate.setDate(currentDate.getDate() + 1)) {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const day = currentDate.getDate()
    const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

    dailyThroughput.push({
      date: formatDate(currentDate),
      count: dateGroups[dateKey] || 0,
      timestamp: currentDate.getTime(),
    })
  }

  return {
    dailyThroughput,
    throughputArray: dailyThroughput.map(d => d.count),
  }
}

/** Histogram and percentile triple over one batch of trial outcomes. */
function summarise(results: number[], percentileFor: PercentileFor, unreachable: boolean): Simulation {
  const sorted = [...results].sort((a, b) => a - b)

  const stats: SimulationStats = {
    totalSimulations: sorted.length,
    p50: nearestRank(sorted, percentileFor(0.5)),
    p85: nearestRank(sorted, percentileFor(0.85)),
    p95: nearestRank(sorted, percentileFor(0.95)),
    mean: sorted.length === 0 ? 0 : sorted.reduce((sum, val) => sum + val, 0) / sorted.length,
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
  }

  const counts: { [key: number]: number } = {}
  sorted.forEach(result => {
    counts[result] = (counts[result] || 0) + 1
  })

  const histogram: HistogramBin[] = Object.entries(counts)
    .map(([value, frequency]) => ({ value: parseInt(value), frequency }))
    .sort((a, b) => a.value - b.value)

  return { histogram, stats, unreachable }
}

export const EMPTY_SIMULATION: Simulation = {
  histogram: [],
  stats: { totalSimulations: 0, p50: 0, p85: 0, p95: 0, mean: 0, min: 0, max: 0 },
  unreachable: false,
}

/** "How many items will be done in `days` days?" */
export function simulateItemCount(
  throughput: number[],
  days: number,
  trials: number,
  rng: Rng = Math.random
): Simulation {
  if (throughput.length === 0) return EMPTY_SIMULATION

  const results: number[] = []
  for (let trial = 0; trial < trials; trial++) {
    let items = 0
    for (let day = 0; day < days; day++) {
      items += throughput[Math.floor(rng() * throughput.length)]
    }
    results.push(items)
  }

  return summarise(results, CONFIDENCE_TO_PERCENTILE.fewerIsWorse, false)
}

/** "When will `targetItems` items be done?", answered in elapsed days. */
export function simulateDaysToTarget(
  throughput: number[],
  targetItems: number,
  trials: number,
  rng: Rng = Math.random
): Simulation {
  if (throughput.length === 0 || targetItems <= 0) return EMPTY_SIMULATION

  const results: number[] = []
  let unreachable = false

  for (let trial = 0; trial < trials; trial++) {
    let items = 0
    let days = 0
    while (items < targetItems && days < MAX_SIMULATED_DAYS) {
      items += throughput[Math.floor(rng() * throughput.length)]
      days++
    }
    if (items < targetItems) unreachable = true
    results.push(days)
  }

  return summarise(results, CONFIDENCE_TO_PERCENTILE.moreIsWorse, unreachable)
}

/** The calendar date `days` from today, in the app's display format. */
export function dateAfterDays(days: number, from: Date = new Date()): string {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  date.setDate(date.getDate() + days)
  return formatDate(date)
}
