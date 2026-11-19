/**
 * Throughput run chart: items completed per interval, in time order, read
 * against the median.
 *
 * A run chart rather than an XmR chart: the centre line is the median and the
 * signals are run rules, which make no assumption about the distribution.
 * Throughput counts are small whole numbers with a floor at zero, so that suits
 * them better than limits built on a mean.
 *
 * Built from the daily sample space the Monte Carlo forecast uses, so zero days
 * are present and both charts read the same history.
 */

import { formatDate, type CsvRow } from './csv'
import { throughputFrom } from './monteCarlo'

export type ThroughputInterval = 'day' | 'week' | 'fortnight'

export const INTERVAL_DAYS: Record<ThroughputInterval, number> = { day: 1, week: 7, fortnight: 14 }

export interface ThroughputBucket {
  /** Local midnight of the bucket's first calendar day. Weeks start on Monday. */
  start: number
  /** DD/MM/YYYY of start, for the axis and tooltip. */
  label: string
  count: number
  /**
   * The history starts or ends inside this bucket, so some of its days are not
   * in the data. Its count is low for want of days, not of delivery, so it is
   * drawn but left out of the median and the run rules.
   */
  partial: boolean
  /** Run rules this bucket belongs to. Empty for a partial bucket. */
  signals: RunSignal[]
}

export type RunSignal = 'shift' | 'trend'

/**
 * Which run rules were checked.
 *
 * median-crowded: no full bucket falls on one side of the median, which happens
 * when most buckets share the lowest count (daily throughput full of zeros). The
 * shift rule then calls every non-zero bucket one long run, so only the trend
 * rule is checked.
 */
export type RuleCoverage = 'all' | 'too-few-points' | 'median-crowded'

export interface ThroughputRun {
  buckets: ThroughputBucket[]
  /** Median of the full buckets; null when there are none. */
  median: number | null
  fullBucketCount: number
  rules: RuleCoverage
}

/** IHI run chart rules: six or more on one side of the median, five or more rising or falling. */
export const SHIFT_LENGTH = 6
export const TREND_LENGTH = 5
/** Below this many full buckets the run rules have too little to go on. */
export const MIN_POINTS_FOR_RULES = 10

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Local midnight of the Monday on or before the given day. */
function mondayOf(timestamp: number): number {
  const d = new Date(timestamp)
  const back = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime()
}

/** Whole calendar days from a to b, immune to clock changes. */
function daysBetween(a: number, b: number): number {
  return Math.round((b - a) / 86400000)
}

/** Points on the median neither count towards a shift nor break one. */
function shiftIndices(values: number[], centre: number): Set<number> {
  const flagged = new Set<number>()
  let run: number[] = []
  let side = 0
  const close = () => {
    if (run.length >= SHIFT_LENGTH) run.forEach(i => flagged.add(i))
  }
  values.forEach((value, i) => {
    const s = Math.sign(value - centre)
    if (s === 0) return
    if (s !== side) {
      close()
      run = []
      side = s
    }
    run.push(i)
  })
  close()
  return flagged
}

/**
 * A trend counts points, not steps: five rising points is four rises. Repeated
 * values neither extend a trend nor break it, per the IHI convention.
 */
function trendIndices(values: number[]): Set<number> {
  const flagged = new Set<number>()
  let run: number[] = []
  let direction = 0
  // The repeats inside a trend are drawn as part of it, so the whole span is flagged.
  const close = () => {
    if (run.length < TREND_LENGTH) return
    for (let i = run[0]; i <= run[run.length - 1]; i++) flagged.add(i)
  }
  values.forEach((value, i) => {
    if (run.length === 0) {
      run = [i]
      return
    }
    const step = Math.sign(value - values[run[run.length - 1]])
    if (step === 0) return
    if (direction === 0 || step === direction) {
      direction = step
      run.push(i)
      return
    }
    close()
    run = [run[run.length - 1], i]
    direction = step
  })
  close()
  return flagged
}

export function throughputRun(data: CsvRow[], interval: ThroughputInterval): ThroughputRun {
  const { dailyThroughput } = throughputFrom(data)
  if (dailyThroughput.length === 0) return { buckets: [], median: null, fullBucketCount: 0, rules: 'too-few-points' }

  const length = INTERVAL_DAYS[interval]
  const first = dailyThroughput[0].timestamp
  const anchor = interval === 'day' ? first : mondayOf(first)

  const byStart = new Map<number, { count: number; days: number }>()
  for (const day of dailyThroughput) {
    const index = Math.floor(daysBetween(anchor, day.timestamp) / length)
    const start = new Date(anchor)
    start.setDate(start.getDate() + index * length)
    const key = start.getTime()
    const bucket = byStart.get(key) ?? { count: 0, days: 0 }
    bucket.count += day.count
    bucket.days += 1
    byStart.set(key, bucket)
  }

  const buckets: ThroughputBucket[] = [...byStart.entries()].map(([start, { count, days }]) => ({
    start,
    label: formatDate(start),
    count,
    // The daily history has no gaps, so only an edge bucket can be short of days.
    partial: days < length,
    signals: [],
  }))

  const full = buckets.filter(b => !b.partial)
  if (full.length === 0) return { buckets, median: null, fullBucketCount: 0, rules: 'too-few-points' }

  const counts = full.map(b => b.count)
  const centre = median(counts)
  if (full.length < MIN_POINTS_FOR_RULES) {
    return { buckets, median: centre, fullBucketCount: full.length, rules: 'too-few-points' }
  }

  const twoSided = counts.some(n => n > centre) && counts.some(n => n < centre)
  const shifts = twoSided ? shiftIndices(counts, centre) : new Set<number>()
  const trends = trendIndices(counts)
  full.forEach((bucket, i) => {
    if (shifts.has(i)) bucket.signals.push('shift')
    if (trends.has(i)) bucket.signals.push('trend')
  })

  return { buckets, median: centre, fullBucketCount: full.length, rules: twoSided ? 'all' : 'median-crowded' }
}
