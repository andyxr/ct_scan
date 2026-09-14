import { describe, expect, it } from 'vitest'
import {
  ALL_ITEM_TYPES,
  COLUMN_ALIASES,
  UNTYPED_ITEM_TYPE,
  cycleTimeFor,
  detectColumns,
  filterByItemType,
  hasUsableEstimate,
  itemTypesIn,
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

describe('hasUsableEstimate', () => {
  it('is true for numbers, false for text, false when absent', () => {
    const numeric = [{ item_id: 'X', start_date: '', end_date: '', estimate: '3' }]
    const text = [{ item_id: 'X', start_date: '', end_date: '', estimate: 'Small' }]
    expect(hasUsableEstimate(numeric, detectColumns(numeric))).toBe(true)
    expect(hasUsableEstimate(text, detectColumns(text))).toBe(false)
    expect(hasUsableEstimate(minimal, detectColumns(minimal))).toBe(false)
  })
})
