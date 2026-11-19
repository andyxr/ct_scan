import { describe, expect, it } from 'vitest'
import { throughputHistogram } from './throughputHistogram'
import type { ThroughputBucket } from './throughputRun'

function bucket(count: number, partial = false): ThroughputBucket {
  return { start: 0, label: '', count, recorded: count, partial, signals: [] }
}

describe('throughputHistogram', () => {
  it('returns null when there are no full intervals', () => {
    expect(throughputHistogram([])).toBeNull()
    expect(throughputHistogram([bucket(3, true)])).toBeNull()
  })

  it('counts each value from zero to the max, gaps included, ignoring partial intervals', () => {
    const h = throughputHistogram([bucket(0), bucket(3), bucket(3), bucket(1), bucket(9, true)])!
    expect(h.bins).toEqual([
      { value: 0, frequency: 1 },
      { value: 1, frequency: 1 },
      { value: 2, frequency: 0 },
      { value: 3, frequency: 2 },
    ])
    expect(h.intervals).toBe(4)
    expect(h.mean).toBe(1.75)
  })

  it('reads the median and the 85% floor nearest-rank', () => {
    // Sorted: 1 2 3 4 5 6 7 8 9 10 -> index 5 is 6, index floor(1.5) = 1 is 2.
    const h = throughputHistogram([5, 1, 9, 3, 7, 2, 10, 4, 8, 6].map(n => bucket(n)))!
    expect(h.median).toBe(6)
    expect(h.atLeast85).toBe(2)
  })
})
