/**
 * Cycle time histogram: how many completed items took each whole number of days.
 *
 * Cycle time is counted inclusively in whole days (see cycleTimeFor), so each
 * day is its own bin and the smallest is 1. Percentiles use the same
 * interpolated percentile() as the scatterplot, so the lines land on the same
 * values in both charts.
 */

import { percentile } from './csv'

export interface CycleTimeBin {
  days: number
  frequency: number
  /** Share of items that finished in this many days or fewer, 0..1. */
  cumulative: number
}

export interface CycleTimeHistogram {
  /** One bin per day from 1 to the longest cycle time, empty days included. */
  bins: CycleTimeBin[]
  itemCount: number
  mean: number
  /** Keyed by percentile, e.g. 0.85. */
  percentiles: Record<number, number>
}

export function cycleTimeHistogram(cycleTimes: readonly number[], ps: readonly number[]): CycleTimeHistogram | null {
  if (cycleTimes.length === 0) return null

  const frequency = new Map<number, number>()
  for (const days of cycleTimes) frequency.set(days, (frequency.get(days) ?? 0) + 1)
  const max = Math.max(...cycleTimes)

  let running = 0
  const bins = Array.from({ length: max }, (_, i) => {
    const days = i + 1
    const n = frequency.get(days) ?? 0
    running += n
    return { days, frequency: n, cumulative: running / cycleTimes.length }
  })

  return {
    bins,
    itemCount: cycleTimes.length,
    mean: cycleTimes.reduce((sum, n) => sum + n, 0) / cycleTimes.length,
    percentiles: Object.fromEntries(ps.map(p => [p, percentile([...cycleTimes], p)])),
  }
}
