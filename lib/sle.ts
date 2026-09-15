import { percentile, type WorkItem } from './csv'

export const SLE_PERCENTILES = [0.5, 0.7, 0.85, 0.95] as const
export type SlePercentile = typeof SLE_PERCENTILES[number]
export const DEFAULT_SLE_PERCENTILE: SlePercentile = 0.85
export const DEFAULT_SLE_DAYS = 14
export const MIN_ITEMS_FOR_ASSESSMENT = 10
export const MIN_TYPE_ITEMS = 8
/** Breaches count as "a few outliers" only when this share of items or fewer carries half the excess. */
const OUTLIER_SHARE = 0.1

/** "85th" for 0.85. Every SLE percentile takes the -th suffix. */
export function percentileName(p: SlePercentile): string {
  return `${Math.round(p * 100)}th`
}

export type SleStatus = 'insufficient' | 'pass' | 'marginal' | 'fail'

export const SLE_STATUS: Record<SleStatus, { label: string; stroke: string; badgeClass: string }> = {
  pass: { label: 'Meets SLE', stroke: '#16a34a', badgeClass: 'bg-green-100 text-green-800' },
  marginal: { label: 'Marginal', stroke: '#d97706', badgeClass: 'bg-amber-100 text-amber-800' },
  fail: { label: 'Misses SLE', stroke: '#dc2626', badgeClass: 'bg-red-100 text-red-800' },
  insufficient: { label: 'Too few items', stroke: '#6b7280', badgeClass: 'bg-gray-100 text-gray-700' },
}

export interface Interval {
  low: number
  high: number
}

export interface SleAssessment {
  status: SleStatus
  targetDays: number
  targetPercentile: SlePercentile
  itemCount: number
  /** Interpolated percentile of the data at targetPercentile. */
  actualDays: number
  /** actualDays - targetDays; positive means the target is missed. */
  gapDays: number
  hitCount: number
  breachCount: number
  /** 0..1 */
  hitRate: number
  hitRateInterval: Interval
  significantlyAbove: boolean
  significantlyBelow: boolean
}

export interface TailContribution {
  breachCount: number
  /** Total days over the target across every breaching item. */
  excessDays: number
  /** How many of the worst breaches account for half of excessDays. */
  worstK: number
  concentrated: boolean
}

export interface TypeBreakdown {
  itemType: string
  itemCount: number
  percentileDays: number
  hitRate: number
}

/**
 * Wilson score interval on a proportion. Unlike the normal approximation it
 * stays inside [0, 1] and keeps a real width at p = 0 or 1, so a perfect run
 * of 30 items is not reported as certainty.
 */
export function wilsonInterval(successes: number, n: number, z = 1.96): Interval {
  if (n === 0) return { low: 0, high: 0 }
  const p = successes / n
  const z2 = z * z
  const denom = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denom
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
  return { low: Math.max(0, centre - margin), high: Math.min(1, centre + margin) }
}

export function assessSle(items: WorkItem[], targetDays: number, targetPercentile: SlePercentile): SleAssessment {
  const times = items.map(item => item.cycleTime)
  const itemCount = times.length
  const actualDays = percentile(times, targetPercentile)
  const hitCount = times.filter(t => t <= targetDays).length
  const hitRate = itemCount ? hitCount / itemCount : 0
  const hitRateInterval = wilsonInterval(hitCount, itemCount)
  const significantlyAbove = hitRateInterval.low > targetPercentile
  const significantlyBelow = hitRateInterval.high < targetPercentile

  const status: SleStatus = itemCount < MIN_ITEMS_FOR_ASSESSMENT ? 'insufficient'
    : significantlyBelow ? 'fail'
    : significantlyAbove ? 'pass'
    : 'marginal'

  return {
    status,
    targetDays,
    targetPercentile,
    itemCount,
    actualDays,
    gapDays: actualDays - targetDays,
    hitCount,
    breachCount: itemCount - hitCount,
    hitRate,
    hitRateInterval,
    significantlyAbove,
    significantlyBelow,
  }
}

export function tailContribution(items: WorkItem[], targetDays: number): TailContribution {
  const excesses = items
    .map(item => item.cycleTime - targetDays)
    .filter(excess => excess > 0)
    .sort((a, b) => b - a)
  const excessDays = excesses.reduce((sum, excess) => sum + excess, 0)

  let running = 0
  let worstK = 0
  while (running < excessDays / 2 && worstK < excesses.length) {
    running += excesses[worstK]
    worstK += 1
  }

  return {
    breachCount: excesses.length,
    excessDays,
    worstK,
    concentrated: excesses.length > 0 && worstK <= items.length * OUTLIER_SHARE,
  }
}

/** Per-type percentile and hit rate, worst first. Empty unless at least two types have enough items. */
export function typeBreakdown(items: WorkItem[], targetDays: number, targetPercentile: SlePercentile): TypeBreakdown[] {
  const byType = new Map<string, number[]>()
  for (const item of items) {
    const times = byType.get(item.itemType)
    if (times) times.push(item.cycleTime)
    else byType.set(item.itemType, [item.cycleTime])
  }

  const groups = [...byType.entries()]
    .filter(([, times]) => times.length >= MIN_TYPE_ITEMS)
    .map(([itemType, times]) => ({
      itemType,
      itemCount: times.length,
      percentileDays: percentile(times, targetPercentile),
      hitRate: times.filter(t => t <= targetDays).length / times.length,
    }))
    .sort((a, b) => b.percentileDays - a.percentileDays)

  return groups.length >= 2 ? groups : []
}
