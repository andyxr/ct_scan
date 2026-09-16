import { describe, expect, it } from 'vitest'
import {
  MAX_SIMULATED_DAYS,
  bandFor,
  completionByDay,
  firstDayAtOrAbove,
  dateAfterDays,
  simulateDaysToTarget,
  simulateItemCount,
  throughputFrom,
} from './monteCarlo'
import { DEMO_DATA } from './demoData'

/** Cycles through the sample space in order, so a trial's draws are fully determined. */
function cyclingRng(length: number) {
  let i = 0
  return () => ((i++ % length) / length)
}

describe('throughputFrom', () => {
  it('fills quiet days between completions with zeros', () => {
    const { throughputArray } = throughputFrom([
      { item_id: 'A-1', start_date: '01/01/2025', end_date: '01/01/2025' },
      { item_id: 'A-2', start_date: '01/01/2025', end_date: '04/01/2025' },
    ])
    expect(throughputArray).toEqual([1, 0, 0, 1])
  })

  it('counts same-day completions together', () => {
    const { throughputArray } = throughputFrom([
      { item_id: 'A-1', start_date: '01/01/2025', end_date: '02/01/2025' },
      { item_id: 'A-2', start_date: '01/01/2025', end_date: '02/01/2025' },
    ])
    expect(throughputArray).toEqual([2])
  })

  it('returns nothing for rows with no usable dates', () => {
    expect(throughputFrom([{ item_id: 'A-1' }]).throughputArray).toEqual([])
  })
})

describe('simulateDaysToTarget', () => {
  it('is deterministic when every day delivers the same amount', () => {
    // Every draw returns 2, so 10 items always takes exactly 5 days.
    const result = simulateDaysToTarget([2, 2, 2], 10, 100)
    expect(result.stats.p50).toBe(5)
    expect(result.stats.p85).toBe(5)
    expect(result.stats.p95).toBe(5)
    expect(result.stats.min).toBe(5)
    expect(result.stats.max).toBe(5)
    expect(result.unreachable).toBe(false)
  })

  it('counts a partial final day as a whole day', () => {
    // 3 items at 2/day needs two days: the second overshoots to 4.
    expect(simulateDaysToTarget([2], 3, 10).stats.p50).toBe(2)
  })

  it('reports unreachable rather than hanging on an all-zero history', () => {
    const result = simulateDaysToTarget([0, 0, 0], 5, 10)
    expect(result.unreachable).toBe(true)
    expect(result.stats.max).toBe(MAX_SIMULATED_DAYS)
  })

  it('orders confidence levels so more confidence means more days', () => {
    const { throughputArray } = throughputFrom(DEMO_DATA)
    const { stats } = simulateDaysToTarget(throughputArray, 20, 5000)
    expect(stats.p50).toBeLessThanOrEqual(stats.p85)
    expect(stats.p85).toBeLessThanOrEqual(stats.p95)
  })

  it('returns an empty simulation for a non-positive target', () => {
    expect(simulateDaysToTarget([1, 2], 0, 10).stats.totalSimulations).toBe(0)
  })
})

describe('simulateItemCount', () => {
  it('is deterministic when every day delivers the same amount', () => {
    expect(simulateItemCount([3, 3], 7, 50).stats.p50).toBe(21)
  })

  it('orders confidence levels so more confidence means fewer items', () => {
    const { throughputArray } = throughputFrom(DEMO_DATA)
    const { stats } = simulateItemCount(throughputArray, 30, 5000)
    expect(stats.p95).toBeLessThanOrEqual(stats.p85)
    expect(stats.p85).toBeLessThanOrEqual(stats.p50)
  })

  it('draws from the sample space it is given', () => {
    // One draw per day over [0,1,2,3]: the cycling rng walks the whole space.
    const result = simulateItemCount([0, 1, 2, 3], 4, 1, cyclingRng(4))
    expect(result.stats.p50).toBe(6)
  })
})

describe('the two modes agree', () => {
  // The property that proves the inversion: if 85% of trials complete at least
  // k items in 30 days, then 85% of trials reach k items within about 30 days.
  it('rounds back to the horizon it started from', () => {
    const { throughputArray } = throughputFrom(DEMO_DATA)
    const horizon = 30
    const items = simulateItemCount(throughputArray, horizon, 20000).stats.p85
    const days = simulateDaysToTarget(throughputArray, items, 20000).stats.p85
    expect(Math.abs(days - horizon)).toBeLessThanOrEqual(3)
  })
})

describe('dateAfterDays', () => {
  it('adds elapsed days to today', () => {
    expect(dateAfterDays(5, new Date(2025, 0, 1))).toBe('06/01/2025')
  })

  it('rolls over a month boundary', () => {
    expect(dateAfterDays(3, new Date(2025, 0, 30))).toBe('02/02/2025')
  })

  it('ignores the time of day on the starting date', () => {
    expect(dateAfterDays(1, new Date(2025, 5, 10, 23, 59))).toBe('11/06/2025')
  })
})

describe('completionByDay', () => {
  it('accumulates frequencies and fills days no trial produced', () => {
    const byDay = completionByDay(
      [
        { value: 1, frequency: 2 },
        { value: 3, frequency: 6 },
        { value: 4, frequency: 2 },
      ],
      10
    )
    expect(byDay).toEqual([0, 0.2, 0.2, 0.8, 1])
  })

  it('is empty for an empty simulation', () => {
    expect(completionByDay([], 0)).toEqual([])
  })
})

describe('bandFor', () => {
  it('assigns the highest band whose floor is met', () => {
    expect(bandFor(0.49)).toBe('below50')
    expect(bandFor(0.5)).toBe('p50')
    expect(bandFor(0.7)).toBe('p70')
    expect(bandFor(0.85)).toBe('p85')
    expect(bandFor(0.95)).toBe('p95')
    expect(bandFor(1)).toBe('p95')
  })
})

describe('firstDayAtOrAbove', () => {
  it('returns the first index reaching the threshold', () => {
    expect(firstDayAtOrAbove([0, 0.2, 0.2, 0.8, 1], 0.7)).toBe(3)
  })

  it('falls back to the last day when never reached', () => {
    expect(firstDayAtOrAbove([0, 0.2], 0.7)).toBe(1)
  })
})
