import { describe, expect, it } from 'vitest'
import { throughputRun } from './throughputRun'

/** One completed row per entry, finished on the given YYYY-MM-DD. */
function rows(endDates: string[]) {
  return endDates.map((end, i) => ({ item_id: String(i), start_date: '2025-01-01', end_date: end }))
}

/** n completions on each listed day. */
function days(spec: Record<string, number>): string[] {
  return Object.entries(spec).flatMap(([day, n]) => Array(n).fill(day))
}

describe('throughputRun', () => {
  it('returns nothing for no completions', () => {
    expect(throughputRun([], 'week')).toEqual({ buckets: [], median: null, fullBucketCount: 0, rules: 'too-few-points' })
  })

  it('counts every calendar day, zero days included', () => {
    const run = throughputRun(rows(days({ '2025-03-03': 2, '2025-03-05': 1 })), 'day')
    expect(run.buckets.map(b => [b.label, b.count, b.partial])).toEqual([
      ['03/03/2025', 2, false],
      ['04/03/2025', 0, false],
      ['05/03/2025', 1, false],
    ])
    expect(run.median).toBe(1)
  })

  it('groups weeks from Monday and marks edge weeks the history only part covers', () => {
    // Wed 5 Mar to Tue 18 Mar 2025: the first and last weeks are partial, the middle one full.
    const run = throughputRun(rows(days({ '2025-03-05': 1, '2025-03-10': 2, '2025-03-16': 1, '2025-03-18': 3 })), 'week')
    expect(run.buckets.map(b => [b.label, b.count, b.partial])).toEqual([
      ['03/03/2025', 1, true],
      ['10/03/2025', 3, false],
      ['17/03/2025', 3, true],
    ])
    expect(run.median).toBe(3)
    expect(run.fullBucketCount).toBe(1)
  })

  it('keeps a week full when the history spans it exactly', () => {
    const run = throughputRun(rows(days({ '2025-03-03': 1, '2025-03-09': 1 })), 'week')
    expect(run.buckets.map(b => [b.count, b.partial])).toEqual([[2, false]])
  })

  it('flags a shift of six days above the median', () => {
    // Six days of 1, then six of 3: median 2, every point part of a run of six.
    const spec: Record<string, number> = {}
    for (let d = 1; d <= 12; d++) spec[`2025-03-${String(d).padStart(2, '0')}`] = d <= 6 ? 1 : 3
    const run = throughputRun(rows(days(spec)), 'day')
    expect(run.median).toBe(2)
    expect(run.rules).toBe('all')
    expect(run.buckets.map(b => b.signals.includes('shift'))).toEqual(Array(12).fill(true))
  })

  it('skips the shift rule when nothing falls below the median', () => {
    // Mostly quiet days: the median is 0, so every busy day sits above it.
    const counts = [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1]
    const spec: Record<string, number> = {}
    counts.forEach((n, i) => { spec[`2025-03-${String(i + 1).padStart(2, '0')}`] = n })
    const run = throughputRun(rows(days(spec)), 'day')
    expect(run.median).toBe(0)
    expect(run.rules).toBe('median-crowded')
    expect(run.buckets.filter(b => b.signals.length > 0)).toEqual([])
  })

  it('flags five rising points as a trend, ignoring repeats', () => {
    const counts = [1, 2, 2, 3, 4, 5, 1, 1, 1, 1]
    const spec: Record<string, number> = {}
    counts.forEach((n, i) => { spec[`2025-03-${String(i + 1).padStart(2, '0')}`] = n })
    const run = throughputRun(rows(days(spec)), 'day')
    expect(run.buckets.map(b => b.signals.includes('trend'))).toEqual([true, true, true, true, true, true, false, false, false, false])
  })

  it('applies no rules below ten full points', () => {
    const spec: Record<string, number> = {}
    for (let d = 1; d <= 9; d++) spec[`2025-03-0${d}`] = d
    const run = throughputRun(rows(days(spec)), 'day')
    expect(run.rules).toBe('too-few-points')
    expect(run.buckets.every(b => b.signals.length === 0)).toBe(true)
  })
})
