import { describe, expect, it } from 'vitest'
import { capBatchCloses, scanBatchCloses } from './batchCloses'
import { throughputFrom } from './monteCarlo'
import { formatDate, type CsvRow } from './csv'
import { DEMO_DATA } from './demoData'

/** One row per completion, day i of `counts` falling i days after `first`. */
function rowsFromDailyCounts(counts: number[], first: Date): CsvRow[] {
  const rows: CsvRow[] = []
  counts.forEach((count, i) => {
    const day = formatDate(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i))
    for (let n = 0; n < count; n++) {
      rows.push({ item_id: `D${i}-${n}`, start_date: day, end_date: day })
    }
  })
  return rows
}

// Daily completions from 11/09/2026 to 29/10/2026 in a real team's export.
const SEP_OCT_COUNTS = [10, 0, 0, 2, 2, 2, 5, 1, 0, 0, 1, 1, 2, 0, 3, 0, 0, 3, 4, 9, 3, 0, 0, 0, 2, 3, 1, 3, 5, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 5]
const SEP_OCT = rowsFromDailyCounts(SEP_OCT_COUNTS, new Date(2026, 8, 11))

describe('scanBatchCloses', () => {
  it('flags the days above the upper natural process limit', () => {
    const scan = scanBatchCloses(SEP_OCT)
    expect(scan.limit).toBeCloseTo(5.474, 3)
    expect(scan.cap).toBe(5)
    expect(scan.closes.map(c => [c.date, c.count])).toEqual([
      ['11/09/2026', 10],
      ['30/09/2026', 9],
    ])
  })

  it('lists the items closed on each flagged day', () => {
    const [first] = scanBatchCloses(SEP_OCT).closes
    expect(first.itemIds).toEqual(['D0-0', 'D0-1', 'D0-2', 'D0-3', 'D0-4', 'D0-5', 'D0-6', 'D0-7', 'D0-8', 'D0-9'])
  })

  it('flags nothing with fewer than 10 days of history', () => {
    const rows = rowsFromDailyCounts([1, 1, 1, 1, 1, 1, 1, 1, 30], new Date(2026, 0, 5))
    expect(scanBatchCloses(rows).closes).toEqual([])
  })

  it('flags nothing when every day is the same', () => {
    const rows = rowsFromDailyCounts(Array(12).fill(2), new Date(2026, 0, 5))
    expect(scanBatchCloses(rows).closes).toEqual([])
  })

  it('flags nothing in the demo data', () => {
    expect(scanBatchCloses(DEMO_DATA).closes).toEqual([])
  })
})

describe('capBatchCloses', () => {
  it('caps the flagged days at the limit and leaves the rest alone', () => {
    const scan = scanBatchCloses(SEP_OCT)
    const expected = [...SEP_OCT_COUNTS]
    expected[0] = 5
    expected[19] = 5
    expect(capBatchCloses(throughputFrom(SEP_OCT).dailyThroughput, scan)).toEqual(expected)
  })

  it('passes through a flagged day whose filtered count is under the cap', () => {
    const scan = scanBatchCloses(SEP_OCT)
    // Keep 3 of the 10 items closed on 11/09 and everything after it.
    const filtered = SEP_OCT.filter(row => !String(row.item_id).startsWith('D0-') || Number(String(row.item_id).slice(3)) < 3)
    const capped = capBatchCloses(throughputFrom(filtered).dailyThroughput, scan)
    expect(capped[0]).toBe(3)
    expect(capped[19]).toBe(5)
  })
})
