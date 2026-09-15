import { percentile, type WorkItem } from './csv'
import type { SlePercentile } from './sle'

export const TREND_WINDOW_SIZE = 20
export const TREND_WINDOW_STEP = 5
export const MIN_TREND_WINDOWS = 3
export const MIN_TREND_ITEMS = TREND_WINDOW_SIZE + TREND_WINDOW_STEP * (MIN_TREND_WINDOWS - 1)
/**
 * Effect-size floor, not a significance test. Overlapping windows share items,
 * so their percentiles are correlated and a p-value would be anti-conservative.
 */
export const FLAT_SLOPE_DAYS = 0.25

export type TrendDirection = 'improving' | 'worsening' | 'flat' | 'not-enough-data'

export interface TrendWindow {
  endDate: number
  value: number
}

export interface SleTrend {
  direction: TrendDirection
  windows: TrendWindow[]
  /** Days of percentile change per window step. */
  slope: number
  reason?: string
}

function leastSquaresSlope(values: number[]): number {
  const n = values.length
  const meanX = (n - 1) / 2
  const meanY = values.reduce((sum, v) => sum + v, 0) / n
  let numerator = 0
  let denominator = 0
  values.forEach((y, x) => {
    numerator += (x - meanX) * (y - meanY)
    denominator += (x - meanX) ** 2
  })
  return denominator === 0 ? 0 : numerator / denominator
}

/**
 * Direction of the target percentile across overlapping item-count windows of
 * oldest-first items. Item-count windows keep every point on the same sample
 * size; date windows would put a 3-item percentile next to a 20-item one.
 */
export function sleTrend(items: WorkItem[], targetPercentile: SlePercentile): SleTrend {
  const windows: TrendWindow[] = []
  for (let start = 0; start + TREND_WINDOW_SIZE <= items.length; start += TREND_WINDOW_STEP) {
    const window = items.slice(start, start + TREND_WINDOW_SIZE)
    windows.push({
      endDate: window[window.length - 1].endDate,
      value: percentile(window.map(item => item.cycleTime), targetPercentile),
    })
  }

  if (windows.length < MIN_TREND_WINDOWS) {
    return {
      direction: 'not-enough-data',
      windows,
      slope: 0,
      reason: `Needs at least ${MIN_TREND_ITEMS} completed items; this data has ${items.length}.`,
    }
  }

  const slope = leastSquaresSlope(windows.map(w => w.value))
  const direction: TrendDirection = Math.abs(slope) < FLAT_SLOPE_DAYS ? 'flat'
    : slope < 0 ? 'improving'
    : 'worsening'
  return { direction, windows, slope }
}
