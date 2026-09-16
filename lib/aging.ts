/**
 * Aging work in progress: how long each open item has been running, read
 * against the cycle times of the items that have finished.
 *
 * Age is counted the way cycle time is (see cycleTimeFor): inclusive whole
 * days, so an item started today is 1 day old. The two scales have to agree or
 * an open item could sit below a percentile line it has already passed.
 */

import { percentile, type InProgressItem, type WorkItem } from './csv'

export interface AgingItem {
  id: string
  itemType: string
  startDate: number
  /** Inclusive whole days from start to the as-of date. */
  ageDays: number
}

/** The cycle-time percentiles an open item's age is read against. */
export interface AgingBands {
  p50: number
  p75: number
  p85: number
  p95: number
}

const DAY_MS = 86400000

function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Inclusive days from start to asOf, never below 1. A start after asOf still counts as day 1. */
export function ageInDays(startDate: number, asOf: number): number {
  const days = Math.round((startOfDay(asOf) - startOfDay(startDate)) / DAY_MS)
  return Math.max(days, 0) + 1
}

/** Open items with their age as of a date, oldest first. */
export function agingItems(items: readonly InProgressItem[], asOf: number): AgingItem[] {
  return items
    .map(item => ({
      id: item.id,
      itemType: item.itemType,
      startDate: item.startDate,
      ageDays: ageInDays(item.startDate, asOf),
    }))
    .sort((a, b) => b.ageDays - a.ageDays)
}

/** Percentiles of completed cycle times. All zero when nothing has completed. */
export function agingBands(completed: readonly WorkItem[]): AgingBands {
  const cycleTimes = completed.map(item => item.cycleTime)
  return {
    p50: percentile(cycleTimes, 0.5),
    p75: percentile(cycleTimes, 0.75),
    p85: percentile(cycleTimes, 0.85),
    p95: percentile(cycleTimes, 0.95),
  }
}

/** Open items whose age has passed a band, strictly. */
export function olderThan(items: readonly AgingItem[], days: number): AgingItem[] {
  return items.filter(item => item.ageDays > days)
}
