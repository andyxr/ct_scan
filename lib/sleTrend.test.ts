import { describe, expect, it } from 'vitest'
import type { WorkItem } from './csv'
import { MIN_TREND_ITEMS, sleTrend } from './sleTrend'

const DAY_MS = 24 * 60 * 60 * 1000

/** One completion per day, oldest first, with the given cycle times. */
function series(cycleTimes: number[]): WorkItem[] {
  return cycleTimes.map((cycleTime, i) => ({
    id: `X-${i}`,
    status: 'completed',
    startDate: 0,
    endDate: i * DAY_MS,
    cycleTime,
    originalEndDate: '',
    itemType: 'Story',
  }))
}

describe('sleTrend', () => {
  it('needs 30 items for three windows and says so in items', () => {
    const result = sleTrend(series(Array(29).fill(7)), 0.85)
    expect(result.direction).toBe('not-enough-data')
    expect(result.reason).toBe('Needs at least 30 completed items; this data has 29.')
    expect(MIN_TREND_ITEMS).toBe(30)
  })

  it('labels each window by its last item and reads a falling series as improving', () => {
    const falling = Array.from({ length: 30 }, (_, i) => 30 - i)
    const result = sleTrend(series(falling), 0.5)
    expect(result.direction).toBe('improving')
    expect(result.windows).toEqual([
      { endDate: 19 * DAY_MS, value: 20.5 },
      { endDate: 24 * DAY_MS, value: 15.5 },
      { endDate: 29 * DAY_MS, value: 10.5 },
    ])
    expect(result.slope).toBe(-5)
  })

  it('reads a rising series as worsening', () => {
    const rising = Array.from({ length: 35 }, (_, i) => i + 1)
    const result = sleTrend(series(rising), 0.85)
    expect(result.direction).toBe('worsening')
    expect(result.windows).toHaveLength(4)
  })

  it('reads movement under a quarter day per window as flat', () => {
    // Window medians 7, 7, 7.2: a slope of 0.1 days per window.
    const drifting = [
      ...Array(20).fill(7),
      ...Array(5).fill(7.4),
      ...Array(5).fill(7.6),
    ]
    const result = sleTrend(series(drifting), 0.5)
    expect(result.direction).toBe('flat')
    expect(Math.abs(result.slope)).toBeLessThan(0.25)
  })
})
