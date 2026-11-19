import { describe, expect, it } from 'vitest'
import { cycleTimeHistogram } from './cycleTimeHistogram'

describe('cycleTimeHistogram', () => {
  it('returns null for no items', () => {
    expect(cycleTimeHistogram([], [0.5])).toBeNull()
  })

  it('bins every day from 1 to the max, with a running share', () => {
    const h = cycleTimeHistogram([1, 3, 3, 4], [0.5, 0.85])!
    expect(h.bins).toEqual([
      { days: 1, frequency: 1, cumulative: 0.25 },
      { days: 2, frequency: 0, cumulative: 0.25 },
      { days: 3, frequency: 2, cumulative: 0.75 },
      { days: 4, frequency: 1, cumulative: 1 },
    ])
    expect(h.itemCount).toBe(4)
    expect(h.mean).toBe(2.75)
  })

  it('interpolates percentiles as the scatterplot does', () => {
    // Sorted 1 3 3 4: p50 sits between index 1 and 2 -> 3; p85 at index 2.55 -> 3 + 0.55 * 1.
    const h = cycleTimeHistogram([4, 1, 3, 3], [0.5, 0.85])!
    expect(h.percentiles[0.5]).toBe(3)
    expect(h.percentiles[0.85]).toBeCloseTo(3.55)
  })
})
