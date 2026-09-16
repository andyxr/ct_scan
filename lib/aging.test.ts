import { describe, expect, it } from 'vitest'
import { ageInDays, agingBands, agingItems, olderThan } from './aging'
import { detectColumns, toInProgressItems, toWorkItems } from './csv'

const jan = (day: number, hour = 0) => new Date(2025, 0, day, hour).getTime()

describe('ageInDays', () => {
  it('counts inclusively, so a start today is one day old', () => {
    expect(ageInDays(jan(10), jan(10))).toBe(1)
    expect(ageInDays(jan(6), jan(10))).toBe(5)
  })

  it('ignores time of day', () => {
    expect(ageInDays(jan(6, 23), jan(10, 1))).toBe(5)
  })

  it('never goes below one day for a start after the as-of date', () => {
    expect(ageInDays(jan(12), jan(10))).toBe(1)
  })
})

describe('agingItems', () => {
  const rows = [
    { item_id: 'W-1', start_date: '02/01/2025', end_date: '', item_type: 'Story' },
    { item_id: 'W-2', start_date: '08/01/2025', end_date: '', item_type: 'Bug' },
    { item_id: 'D-1', start_date: '01/01/2025', end_date: '05/01/2025', item_type: 'Story' },
  ]
  const columns = detectColumns(rows)

  it('ages only the open items, oldest first', () => {
    const items = agingItems(toInProgressItems(rows, columns), jan(10))
    expect(items).toEqual([
      { id: 'W-1', itemType: 'Story', startDate: jan(2), ageDays: 9 },
      { id: 'W-2', itemType: 'Bug', startDate: jan(8), ageDays: 3 },
    ])
  })

  it('returns nothing when every row has completed', () => {
    expect(agingItems(toInProgressItems([rows[2]], columns), jan(10))).toEqual([])
  })
})

describe('agingBands', () => {
  it('reads the percentiles off completed cycle times', () => {
    const rows = [2, 4, 6, 8, 10].map((days, i) => ({
      item_id: `D-${i}`, start_date: '01/01/2025', end_date: `${String(days).padStart(2, '0')}/01/2025`,
    }))
    const bands = agingBands(toWorkItems(rows, detectColumns(rows)))
    expect(bands).toEqual({ p50: 6, p75: 8, p85: 8.8, p95: 9.6 })
  })

  it('is all zero with no completed items', () => {
    expect(agingBands([])).toEqual({ p50: 0, p75: 0, p85: 0, p95: 0 })
  })
})

describe('olderThan', () => {
  it('keeps items strictly past the band', () => {
    const items = [
      { id: 'a', itemType: 'x', startDate: 0, ageDays: 9 },
      { id: 'b', itemType: 'x', startDate: 0, ageDays: 8 },
      { id: 'c', itemType: 'x', startDate: 0, ageDays: 7 },
    ]
    expect(olderThan(items, 8).map(i => i.id)).toEqual(['a'])
  })
})
