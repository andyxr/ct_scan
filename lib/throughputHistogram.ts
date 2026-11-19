/**
 * Throughput histogram: how often each per-interval completion count happens.
 *
 * Built from the full buckets of the run chart, so both charts read the same
 * counts, the same partial-interval exclusion and the same batch-close discount.
 * This is the distribution the Monte Carlo forecast samples from, shown whole.
 */

import type { ThroughputBucket } from './throughputRun'

export interface ThroughputBin {
  /** Items completed in an interval. */
  value: number
  /** Intervals that completed exactly that many. */
  frequency: number
}

export interface ThroughputHistogram {
  /** Every value from 0 to the highest count, zero-frequency values included, so gaps show. */
  bins: ThroughputBin[]
  intervals: number
  mean: number
  median: number
  /**
   * The count 85% of intervals reached or beat: the 15th percentile, read
   * nearest-rank so it is a count some interval actually produced. The
   * pessimistic tail of throughput is the low end, as in CONFIDENCE_TO_PERCENTILE.
   */
  atLeast85: number
}

function nearestRank(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)))]
}

export function throughputHistogram(buckets: readonly ThroughputBucket[]): ThroughputHistogram | null {
  const counts = buckets.filter(b => !b.partial).map(b => b.count)
  if (counts.length === 0) return null

  const sorted = [...counts].sort((a, b) => a - b)
  const frequency = new Map<number, number>()
  for (const n of counts) frequency.set(n, (frequency.get(n) ?? 0) + 1)
  const max = sorted[sorted.length - 1]

  return {
    bins: Array.from({ length: max + 1 }, (_, value) => ({ value, frequency: frequency.get(value) ?? 0 })),
    intervals: counts.length,
    mean: counts.reduce((sum, n) => sum + n, 0) / counts.length,
    median: nearestRank(sorted, 0.5),
    atLeast85: nearestRank(sorted, 0.15),
  }
}
