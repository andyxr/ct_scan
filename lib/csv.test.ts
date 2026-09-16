import { describe, expect, it } from 'vitest'
import {
  ALL_ITEM_TYPES,
  COLUMN_ALIASES,
  OPEN_DATE_RANGE,
  UNTYPED_ITEM_TYPE,
  cycleTimeFor,
  detectColumns,
  endDateSpan,
  filterByDateRange,
  filterByItemType,
  hasUsableEstimate,
  itemTypesIn,
  toFlowItems,
  toInProgressItems,
  toWorkItems,
  validationError,
} from './csv'
import { DEMO_DATA } from './demoData'

const minimal = [
  { item_id: 'A-1', start_date: '02/01/2025', end_date: '06/01/2025' },
  { item_id: 'A-2', start_date: '03/01/2025', end_date: '03/01/2025' },
]

describe('detectColumns', () => {
  it('maps columns by name in any order', () => {
    const row = { 'Item Type': 'Story', 'End Date': '15/03/2025', Estimate: '5', 'Item ID': 'DF-73', 'Start Date': '01/03/2025' }
    expect(detectColumns([row])).toEqual({
      id: 'Item ID', startDate: 'Start Date', endDate: 'End Date', estimate: 'Estimate', itemType: 'Item Type',
    })
  })

  it('accepts aliases and case, underscore and hyphen variants', () => {
    const row = { KEY: 'X', started_at: '01/01/2025', 'Completed-Date': '02/01/2025', 'Story Points': '3', 'issue-type': 'Bug', Cycle_Time: '9' }
    expect(detectColumns([row])).toEqual({
      id: 'KEY', startDate: 'started_at', endDate: 'Completed-Date', estimate: 'Story Points', itemType: 'issue-type', cycleTime: 'Cycle_Time',
    })
  })

  it('ignores a header that matches nothing', () => {
    expect(detectColumns([{ item_id: 'X', Kickoff: '01/01/2025', end_date: '02/01/2025' }])).toEqual({ id: 'item_id', endDate: 'end_date' })
  })

  it('never lets one header claim two roles', () => {
    const columns = detectColumns([{ id: 'X', item_id: 'Y', start_date: '', end_date: '' }])
    expect(columns.id).toBe('item_id')
    expect(Object.values(columns).filter(h => h === 'item_id')).toHaveLength(1)
  })

  it('has disjoint alias lists', () => {
    const all = Object.values(COLUMN_ALIASES).flat()
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('validationError', () => {
  it('names a single missing column', () => {
    expect(validationError([{ item_id: 'X', start_date: '01/01/2025' }]))
      .toBe('That file has no end_date column. Add a column headed "end_date" and upload it again.')
  })

  it('lists several missing columns', () => {
    expect(validationError([{ Ticket: 'L-1', Kickoff: '02/01/2025', Shipped: '06/01/2025', Points: '2' }]))
      .toBe('That file is missing these columns: start_date, end_date. Add them and upload it again.')
  })

  it('rejects the legacy parenthesised headers', () => {
    expect(validationError([{ 'Story ID': 'S-1', 'Start Date (In Progress)': '01/01/2025', 'End Date (Done)': '02/01/2025', Estimate: '5' }]))
      .toBe('That file is missing these columns: item_id, start_date, end_date. Add them and upload it again.')
  })

  it('quotes the source header when start dates are not dates', () => {
    expect(validationError([{ item_id: 'X', Start: 'soon', end_date: '02/01/2025' }]))
      .toBe('The "Start" column should hold start dates, but its values aren\'t dates.')
  })

  it('quotes the source header when end dates are not dates', () => {
    expect(validationError([{ item_id: 'X', start_date: '01/01/2025', Done: 'yes' }]))
      .toBe('The "Done" column should hold end dates, but its values aren\'t dates.')
  })

  it('accepts a file whose first 25 rows are all in progress', () => {
    const rows = Array.from({ length: 25 }, (_, i) => (
      { item_id: `P-${i}`, start_date: '02/01/2025', end_date: '' }
    ))
    rows.push({ item_id: 'P-25', start_date: '02/01/2025', end_date: '06/01/2025' })
    expect(validationError(rows)).toBeNull()
  })

  it('does not count whitespace-only end dates against the end column', () => {
    const rows = [
      { item_id: 'P-1', start_date: '01/01/2025', end_date: '   ' },
      { item_id: 'P-2', start_date: '02/01/2025', end_date: '   ' },
      { item_id: 'P-3', start_date: '03/01/2025', end_date: '   ' },
      { item_id: 'P-4', start_date: '04/01/2025', end_date: '   ' },
      { item_id: 'P-5', start_date: '01/01/2025', end_date: '05/01/2025' },
    ]
    expect(validationError(rows)).toBeNull()
  })

  it('still rejects an end column that is mostly not dates', () => {
    const rows = [
      { item_id: 'G-1', start_date: '01/01/2025', end_date: 'tomorrow' },
      { item_id: 'G-2', start_date: '02/01/2025', end_date: 'soon' },
      { item_id: 'G-3', start_date: '03/01/2025', end_date: 'later' },
      { item_id: 'G-4', start_date: '04/01/2025', end_date: '05/01/2025' },
    ]
    expect(validationError(rows))
      .toBe('The "end_date" column should hold end dates, but its values aren\'t dates.')
  })

  it('says so when every row is still in progress', () => {
    const rows = [
      { item_id: 'P-1', start_date: '02/01/2025', end_date: '' },
      { item_id: 'P-2', start_date: '03/01/2025', end_date: '' },
    ]
    expect(validationError(rows))
      .toBe('Every row is still in progress. Nothing has completed yet, so there is nothing to chart.')
  })

  it('accepts a minimal file, a text estimate, and the demo data', () => {
    expect(validationError(minimal)).toBeNull()
    expect(validationError([{ item_id: 'E-1', start_date: '02/01/2025', end_date: '06/01/2025', estimate: 'Small' }])).toBeNull()
    expect(validationError(DEMO_DATA)).toBeNull()
  })
})

describe('cycleTimeFor', () => {
  it('counts days inclusively', () => {
    const columns = detectColumns(minimal)
    expect(cycleTimeFor(minimal[0], columns)).toBe(5)
    expect(cycleTimeFor(minimal[1], columns)).toBe(1)
  })

  it('ignores a cycle_time column in the row', () => {
    const row = { item_id: 'T-1', start_date: '2025-01-02T09:00:00Z', end_date: '2025-01-06T17:00:00Z', cycle_time: '99' }
    expect(cycleTimeFor(row, detectColumns([row]))).toBe(5)
  })
})

const mixed = [
  { item_id: 'M-1', start_date: '02/01/2025', end_date: '06/01/2025' },
  { item_id: 'M-2', start_date: '03/01/2025', end_date: '' },
  { item_id: 'M-3', start_date: '04/01/2025', end_date: '   ' },
]
const mixedColumns = detectColumns(mixed)

describe('toFlowItems', () => {
  it('reads a blank or whitespace end date as still in progress', () => {
    const items = toFlowItems(mixed, mixedColumns)
    expect(items.map(i => i.status)).toEqual(['completed', 'in-progress', 'in-progress'])
    expect(items.map(i => i.id)).toEqual(['M-1', 'M-2', 'M-3'])
  })

  it('gives the completed item its inclusive cycle time', () => {
    const [completed] = toFlowItems(mixed, mixedColumns)
    expect(completed).toMatchObject({ id: 'M-1', status: 'completed', cycleTime: 5, originalEndDate: '06/01/2025' })
  })

  it('drops a row whose non-blank end date does not parse', () => {
    const rows = [
      { item_id: 'D-1', start_date: '02/01/2025', end_date: 'not a date' },
      { item_id: 'D-2', start_date: '02/01/2025', end_date: '06/01/2025' },
    ]
    const columns = detectColumns(rows)
    expect(toFlowItems(rows, columns).map(i => i.id)).toEqual(['D-2'])
    expect(toWorkItems(rows, columns).map(i => i.id)).toEqual(['D-2'])
    expect(toInProgressItems(rows, columns)).toEqual([])
  })

  it('drops a row whose start date does not parse', () => {
    const rows = [{ item_id: 'D-3', start_date: 'soon', end_date: '' }]
    expect(toFlowItems(rows, detectColumns(rows))).toEqual([])
  })
})

describe('toInProgressItems and toWorkItems', () => {
  it('split the file between unfinished and completed items', () => {
    expect(toInProgressItems(mixed, mixedColumns).map(i => i.id)).toEqual(['M-2', 'M-3'])
    expect(toWorkItems(mixed, mixedColumns).map(i => i.id)).toEqual(['M-1'])
  })
})

const typed = [
  { item_id: 'T-1', start_date: '02/01/2025', end_date: '06/01/2025', item_type: 'Story' },
  { item_id: 'T-2', start_date: '02/01/2025', end_date: '09/01/2025', item_type: 'Epic' },
  { item_id: 'T-3', start_date: '03/01/2025', end_date: '07/01/2025', item_type: ' Story ' },
  { item_id: 'T-4', start_date: '06/01/2025', end_date: '17/01/2025', item_type: '  ' },
]
const typedColumns = detectColumns(typed)

describe('itemTypesIn', () => {
  it('returns distinct sorted values with (Untyped) last', () => {
    expect(itemTypesIn(typed, typedColumns)).toEqual(['Epic', 'Story', UNTYPED_ITEM_TYPE])
  })

  it('returns nothing without an item_type column', () => {
    expect(itemTypesIn(minimal, detectColumns(minimal))).toEqual([])
  })
})

describe('filterByItemType', () => {
  it('passes everything through for All', () => {
    expect(filterByItemType(typed, typedColumns, ALL_ITEM_TYPES)).toBe(typed)
  })

  it('matches a type after trimming', () => {
    expect(filterByItemType(typed, typedColumns, 'Story').map(r => r.item_id)).toEqual(['T-1', 'T-3'])
  })

  it('selects blank cells for (Untyped)', () => {
    expect(filterByItemType(typed, typedColumns, UNTYPED_ITEM_TYPE).map(r => r.item_id)).toEqual(['T-4'])
  })

  it('returns all rows for an unknown selection', () => {
    expect(filterByItemType(typed, typedColumns, 'Spike')).toBe(typed)
  })
})

/** Local midnight, so an expectation never depends on the runner's timezone. */
const day = (year: number, month: number, date: number) => new Date(year, month - 1, date).getTime()

describe('filterByDateRange', () => {
  // End dates are 06, 09, 07 and 17 January 2025, for T-1 to T-4 in order.
  it('keeps rows completed on or after from', () => {
    const range = { from: day(2025, 1, 7), to: null }
    expect(filterByDateRange(typed, typedColumns, range).map(r => r.item_id)).toEqual(['T-2', 'T-3', 'T-4'])
  })

  it('keeps rows completed on or before to', () => {
    const range = { from: null, to: day(2025, 1, 7) }
    expect(filterByDateRange(typed, typedColumns, range).map(r => r.item_id)).toEqual(['T-1', 'T-3'])
  })

  it('keeps rows inside both bounds', () => {
    const range = { from: day(2025, 1, 7), to: day(2025, 1, 9) }
    expect(filterByDateRange(typed, typedColumns, range).map(r => r.item_id)).toEqual(['T-2', 'T-3'])
  })

  it('includes a row completed exactly on either bound', () => {
    const range = { from: day(2025, 1, 6), to: day(2025, 1, 17) }
    expect(filterByDateRange(typed, typedColumns, range).map(r => r.item_id)).toEqual(['T-1', 'T-2', 'T-3', 'T-4'])
  })

  it('returns all rows for an inverted range', () => {
    const range = { from: day(2025, 1, 17), to: day(2025, 1, 6) }
    expect(filterByDateRange(typed, typedColumns, range)).toBe(typed)
  })

  it('returns the same array when both bounds are open', () => {
    expect(filterByDateRange(typed, typedColumns, OPEN_DATE_RANGE)).toBe(typed)
  })

  it('keeps a row whose end date does not parse', () => {
    const rows = [
      { item_id: 'U-1', start_date: '02/01/2025', end_date: 'not a date' },
      { item_id: 'U-2', start_date: '02/01/2025', end_date: '20/01/2025' },
    ]
    const range = { from: day(2025, 1, 1), to: day(2025, 1, 5) }
    expect(filterByDateRange(rows, detectColumns(rows), range).map(r => r.item_id)).toEqual(['U-1'])
  })
})

describe('endDateSpan', () => {
  it('spans the earliest and latest parsed end date', () => {
    expect(endDateSpan(typed, typedColumns)).toEqual({ min: day(2025, 1, 6), max: day(2025, 1, 17) })
  })

  it('is null when no end date parses', () => {
    const rows = [{ item_id: 'U-1', start_date: '02/01/2025', end_date: 'not a date' }]
    expect(endDateSpan(rows, detectColumns(rows))).toBeNull()
  })
})

describe('hasUsableEstimate', () => {
  it('is true for numbers, false for text, false when absent', () => {
    const numeric = [{ item_id: 'X', start_date: '', end_date: '', estimate: '3' }]
    const text = [{ item_id: 'X', start_date: '', end_date: '', estimate: 'Small' }]
    expect(hasUsableEstimate(numeric, detectColumns(numeric))).toBe(true)
    expect(hasUsableEstimate(text, detectColumns(text))).toBe(false)
    expect(hasUsableEstimate(minimal, detectColumns(minimal))).toBe(false)
  })
})
