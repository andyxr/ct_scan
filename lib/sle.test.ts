import { describe, expect, it } from 'vitest'
import type { WorkItem } from './csv'
import { assessSle, tailContribution, typeBreakdown, wilsonInterval } from './sle'

function item(cycleTime: number, itemType = 'Story'): WorkItem {
  return { id: `X-${cycleTime}`, endDate: 0, cycleTime, originalEndDate: '', itemType }
}

function items(cycleTimes: number[], itemType?: string): WorkItem[] {
  return cycleTimes.map(t => item(t, itemType))
}

describe('wilsonInterval', () => {
  it('keeps a real width at p = 1 instead of claiming certainty', () => {
    const { low, high } = wilsonInterval(30, 30)
    expect(high).toBe(1)
    expect(low).toBeCloseTo(0.887, 2)
  })

  it('matches the textbook interval at p = 0.5, n = 30', () => {
    const { low, high } = wilsonInterval(15, 30)
    expect(low).toBeCloseTo(0.332, 2)
    expect(high).toBeCloseTo(0.668, 2)
  })

  it('returns an empty interval for no items', () => {
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 0 })
  })
})

describe('assessSle', () => {
  it('withholds the verdict under 10 items but still reports the numbers', () => {
    const result = assessSle(items([1, 2, 3, 4, 5]), 3, 0.85)
    expect(result.status).toBe('insufficient')
    expect(result.itemCount).toBe(5)
    expect(result.actualDays).toBeCloseTo(4.4)
    expect(result.gapDays).toBeCloseTo(1.4)
    expect(result.hitCount).toBe(3)
    expect(result.breachCount).toBe(2)
    expect(result.hitRate).toBeCloseTo(0.6)
  })

  it('fails when the hit-rate interval sits wholly below the target percentile', () => {
    const result = assessSle(items(Array(30).fill(20)), 10, 0.85)
    expect(result.status).toBe('fail')
    expect(result.gapDays).toBe(10)
    expect(result.hitRate).toBe(0)
    expect(result.significantlyBelow).toBe(true)
    expect(result.significantlyAbove).toBe(false)
  })

  it('passes when the interval sits wholly above the target percentile', () => {
    const result = assessSle(items(Array(30).fill(5)), 10, 0.85)
    expect(result.status).toBe('pass')
    expect(result.gapDays).toBe(-5)
    expect(result.hitCount).toBe(30)
    expect(result.significantlyAbove).toBe(true)
  })

  it('is marginal when the interval straddles the target percentile', () => {
    const result = assessSle(items([...Array(25).fill(5), ...Array(5).fill(20)]), 10, 0.85)
    expect(result.status).toBe('marginal')
    expect(result.hitRate).toBeCloseTo(0.833, 2)
    expect(result.hitRateInterval.low).toBeLessThan(0.85)
    expect(result.hitRateInterval.high).toBeGreaterThan(0.85)
  })

  it('counts an item finishing exactly on the target as a hit', () => {
    const result = assessSle(items([10, 10, 11]), 10, 0.5)
    expect(result.hitCount).toBe(2)
    expect(result.breachCount).toBe(1)
  })
})

describe('tailContribution', () => {
  it('reports a single outlier carrying half the excess as concentrated', () => {
    const result = tailContribution(items([5, 5, 5, 5, 5, 5, 40, 12, 11, 11]), 10)
    expect(result).toEqual({ breachCount: 4, excessDays: 34, worstK: 1, concentrated: true })
  })

  it('reports a uniformly shifted distribution as spread', () => {
    const result = tailContribution(items(Array(10).fill(15)), 10)
    expect(result).toEqual({ breachCount: 10, excessDays: 50, worstK: 5, concentrated: false })
  })

  it('reports nothing to attribute when no item breaches', () => {
    expect(tailContribution(items([1, 2, 3]), 10)).toEqual({
      breachCount: 0, excessDays: 0, worstK: 0, concentrated: false,
    })
  })
})

describe('typeBreakdown', () => {
  it('ranks qualifying types worst first and drops small groups', () => {
    const data = [
      ...items(Array(8).fill(5), 'Story'),
      ...items(Array(8).fill(20), 'Bug'),
      ...items(Array(3).fill(1), 'Task'),
    ]
    expect(typeBreakdown(data, 10, 0.85)).toEqual([
      { itemType: 'Bug', itemCount: 8, percentileDays: 20, hitRate: 0 },
      { itemType: 'Story', itemCount: 8, percentileDays: 5, hitRate: 1 },
    ])
  })

  it('returns nothing when fewer than two types qualify', () => {
    const data = [...items(Array(8).fill(5), 'Story'), ...items(Array(7).fill(20), 'Bug')]
    expect(typeBreakdown(data, 10, 0.85)).toEqual([])
  })
})
