/**
 * Throughput split by item type, per day, week or fortnight.
 *
 * Bucketed exactly as the throughput run chart buckets the same data, so the
 * stacked totals here match the run chart's counts interval for interval.
 */

import { detectColumns, formatDate, toWorkItems, type CsvRow } from './csv'
import { throughputFrom } from './monteCarlo'
import { INTERVAL_DAYS, bucketStartFor, type ThroughputInterval } from './throughputRun'

export interface TypedBucket {
  /** Local midnight of the bucket's first day. */
  start: number
  label: string
  /** Completions per item type. Every type in `types` has an entry, zero included. */
  counts: Record<string, number>
  total: number
  /** The history starts or ends inside this bucket. See ThroughputBucket.partial. */
  partial: boolean
}

export interface ThroughputByType {
  buckets: TypedBucket[]
  /** Types with at least one completion, ordered by `typeOrder` then name. */
  types: string[]
  /** Completions per type across full buckets, for the mix readings. */
  totals: Record<string, number>
}

function localMidnight(timestamp: number): number {
  const d = new Date(timestamp)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** `typeOrder` is the file's type list, so stacks keep one order whatever the filter shows. */
export function throughputByType(data: CsvRow[], interval: ThroughputInterval, typeOrder: readonly string[] = []): ThroughputByType {
  const { dailyThroughput } = throughputFrom(data)
  if (dailyThroughput.length === 0) return { buckets: [], types: [], totals: {} }

  const items = toWorkItems(data, detectColumns(data))
  const rank = (type: string) => {
    const i = typeOrder.indexOf(type)
    return i === -1 ? typeOrder.length : i
  }
  const types = [...new Set(items.map(item => item.itemType))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))

  const bucketStart = bucketStartFor(interval, dailyThroughput[0].timestamp)
  const byStart = new Map<number, TypedBucket & { days: number }>()
  const bucketAt = (start: number) => {
    let bucket = byStart.get(start)
    if (!bucket) {
      bucket = { start, label: formatDate(start), counts: Object.fromEntries(types.map(t => [t, 0])), total: 0, partial: false, days: 0 }
      byStart.set(start, bucket)
    }
    return bucket
  }
  // Days first, in order, so buckets come out in time order and know how many days they hold.
  for (const day of dailyThroughput) bucketAt(bucketStart(day.timestamp)).days += 1
  for (const item of items) {
    const bucket = bucketAt(bucketStart(localMidnight(item.endDate)))
    bucket.counts[item.itemType] += 1
    bucket.total += 1
  }

  const length = INTERVAL_DAYS[interval]
  const buckets = [...byStart.values()].map(({ days, ...bucket }) => ({ ...bucket, partial: days < length }))
  const totals = Object.fromEntries(types.map(t => [t, 0]))
  for (const bucket of buckets) {
    if (bucket.partial) continue
    for (const t of types) totals[t] += bucket.counts[t]
  }
  return { buckets, types, totals }
}
