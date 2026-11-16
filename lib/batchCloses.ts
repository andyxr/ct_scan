/**
 * Batch closes: days where far more items were closed than the process
 * normally finishes, usually because the work was recorded late in one sweep.
 *
 * Read with an XmR chart over daily completion counts. A day above the upper
 * natural process limit is not routine variation, and in throughput data the
 * likeliest cause is bookkeeping rather than a burst of delivery. Left in, such
 * a day gets sampled by the Monte Carlo forecast as if the team could repeat it.
 *
 * Discounting caps each flagged day at the limit instead of dropping it: the
 * items were really finished, just not all on that day, so their volume still
 * counts up to what a normal day can carry.
 */

import { detectColumns, toWorkItems, type CsvRow } from './csv'
import { throughputFrom, type DailyThroughput } from './monteCarlo'

export interface BatchClose {
  /** Local midnight, matching DailyThroughput.timestamp. */
  timestamp: number
  /** DD/MM/YYYY for display. */
  date: string
  count: number
  itemIds: string[]
}

export interface BatchCloseScan {
  /** Upper natural process limit for daily completions. */
  limit: number
  /** The most items a discounted day keeps: the limit rounded down to whole items. */
  cap: number
  closes: BatchClose[]
}

/** Fewer days than this gives limits too loose to call anything a signal. */
export const MIN_DAYS_FOR_LIMITS = 10

const XMR_SCALING = 2.66

const NO_CLOSES: BatchCloseScan = { limit: 0, cap: 0, closes: [] }

export function scanBatchCloses(data: CsvRow[]): BatchCloseScan {
  const { dailyThroughput } = throughputFrom(data)
  if (dailyThroughput.length < MIN_DAYS_FOR_LIMITS) return NO_CLOSES

  const counts = dailyThroughput.map(day => day.count)
  const mean = counts.reduce((sum, n) => sum + n, 0) / counts.length
  const movingRanges = counts.slice(1).map((n, i) => Math.abs(n - counts[i]))
  const averageMovingRange = movingRanges.reduce((sum, n) => sum + n, 0) / movingRanges.length
  // A flat history has no variation to judge against, so nothing stands out.
  if (averageMovingRange === 0) return NO_CLOSES

  const limit = mean + XMR_SCALING * averageMovingRange
  const flagged = dailyThroughput.filter(day => day.count > limit)
  if (flagged.length === 0) return { limit, cap: Math.floor(limit), closes: [] }

  const idsByDay = new Map<number, string[]>()
  for (const item of toWorkItems(data, detectColumns(data))) {
    const end = new Date(item.endDate)
    const day = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
    idsByDay.set(day, [...(idsByDay.get(day) ?? []), item.id])
  }

  return {
    limit,
    cap: Math.floor(limit),
    closes: flagged.map(day => ({
      timestamp: day.timestamp,
      date: day.date,
      count: day.count,
      itemIds: idsByDay.get(day.timestamp) ?? [],
    })),
  }
}

/**
 * The throughput sample space with every flagged day capped. Matched by
 * timestamp, so it works on a filtered history too: a flagged day whose
 * filtered count is already under the cap passes through unchanged.
 */
export function capBatchCloses(daily: DailyThroughput[], scan: BatchCloseScan): number[] {
  const flagged = new Set(scan.closes.map(close => close.timestamp))
  return daily.map(day => (flagged.has(day.timestamp) ? Math.min(day.count, scan.cap) : day.count))
}
