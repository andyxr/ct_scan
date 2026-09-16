import { describe, expect, it } from 'vitest'
import { cfdSeries, clipToRange, firstCompletion, flowMetrics } from './cfd'
import { detectColumns, toFlowItems } from './csv'

const jan = (day: number, hour = 0) => new Date(2025, 0, day, hour).getTime()

function itemsFrom(rows: Record<string, string>[]) {
  return toFlowItems(rows, detectColumns(rows))
}

describe('cfdSeries', () => {
  const rows = [
    { item_id: 'A', start_date: '01/01/2025', end_date: '03/01/2025' },
    { item_id: 'B', start_date: '02/01/2025', end_date: '04/01/2025' },
    { item_id: 'C', start_date: '02/01/2025', end_date: '' },
  ]

  it('steps a cumulative staircase day by day', () => {
    expect(cfdSeries(itemsFrom(rows), jan(5))).toEqual([
      { timestamp: jan(1), started: 1, done: 0, wip: 1 },
      { timestamp: jan(2), started: 3, done: 0, wip: 3 },
      { timestamp: jan(3), started: 3, done: 1, wip: 2 },
      { timestamp: jan(4), started: 3, done: 2, wip: 1 },
      { timestamp: jan(5), started: 3, done: 2, wip: 1 },
    ])
  })

  it('keeps the open item in WIP through the as-of day', () => {
    const points = cfdSeries(itemsFrom(rows), jan(9))
    expect(points[points.length - 1]).toEqual({ timestamp: jan(9), started: 3, done: 2, wip: 1 })
  })

  it('counts an item started and finished the same day as done that day', () => {
    const sameDay = [{ item_id: 'A', start_date: '02/01/2025', end_date: '02/01/2025' }]
    expect(cfdSeries(itemsFrom(sameDay), jan(2))).toEqual([
      { timestamp: jan(2), started: 1, done: 1, wip: 0 },
    ])
  })

  it('ignores the time of day on either date', () => {
    const timed = [{ item_id: 'A', start_date: '01/01/2025 23:30', end_date: '02/01/2025 00:10' }]
    expect(cfdSeries(itemsFrom(timed), jan(2))).toEqual([
      { timestamp: jan(1), started: 1, done: 0, wip: 1 },
      { timestamp: jan(2), started: 1, done: 1, wip: 0 },
    ])
  })

  it('runs past the as-of day when something finished later', () => {
    const points = cfdSeries(itemsFrom(rows), jan(1))
    expect(points.map(point => point.timestamp)).toEqual([jan(1), jan(2), jan(3), jan(4)])
  })

  it('counts an item started after the as-of day from its own start day', () => {
    const late = [{ item_id: 'A', start_date: '08/01/2025', end_date: '' }]
    expect(cfdSeries(itemsFrom(late), jan(5))).toEqual([
      { timestamp: jan(8), started: 1, done: 0, wip: 1 },
    ])
  })

  it('gives one point per calendar day across a clock change', () => {
    // British Summer Time begins on 30 March 2025, so that day is 23 hours long.
    const dst = [{ item_id: 'A', start_date: '28/03/2025', end_date: '01/04/2025' }]
    const points = cfdSeries(itemsFrom(dst), new Date(2025, 2, 28).getTime())
    expect(points.map(point => new Date(point.timestamp).getDate())).toEqual([28, 29, 30, 31, 1])
  })

  it('has no points with no items', () => {
    expect(cfdSeries([], jan(5))).toEqual([])
  })
})

describe('firstCompletion', () => {
  it('is the earliest completion day at local midnight', () => {
    const rows = [
      { item_id: 'A', start_date: '01/01/2025', end_date: '06/01/2025 14:00' },
      { item_id: 'B', start_date: '01/01/2025', end_date: '03/01/2025' },
    ]
    expect(firstCompletion(itemsFrom(rows))).toBe(jan(3))
  })

  it('is null when nothing has completed', () => {
    const rows = [{ item_id: 'A', start_date: '01/01/2025', end_date: '' }]
    expect(firstCompletion(itemsFrom(rows))).toBeNull()
  })
})

describe('clipToRange', () => {
  const points = [1, 2, 3, 4].map(day => ({ timestamp: jan(day), started: day, done: 0, wip: day }))

  it('keeps the points inside the window, both ends included', () => {
    const clipped = clipToRange(points, { from: jan(2), to: jan(3) })
    expect(clipped.map(point => point.timestamp)).toEqual([jan(2), jan(3)])
  })

  it('leaves the counts at a day unchanged', () => {
    expect(clipToRange(points, { from: jan(3), to: null })[0]).toEqual(points[2])
  })

  it('keeps everything for an open or inverted window', () => {
    expect(clipToRange(points, { from: null, to: null })).toEqual(points)
    expect(clipToRange(points, { from: jan(4), to: jan(1) })).toEqual(points)
  })
})

describe('flowMetrics', () => {
  it('reads WIP, arrivals and departures off the visible points', () => {
    const rows = [
      { item_id: 'A', start_date: '01/01/2025', end_date: '03/01/2025' },
      { item_id: 'B', start_date: '02/01/2025', end_date: '04/01/2025' },
      { item_id: 'C', start_date: '02/01/2025', end_date: '' },
    ]
    const metrics = flowMetrics(cfdSeries(itemsFrom(rows), jan(5)))
    expect(metrics.wip).toBe(1)
    // Two started and two finished over the four days after the first point.
    expect(metrics.arrivalsPerWeek).toBe(3.5)
    expect(metrics.departuresPerWeek).toBe(3.5)
    // Average WIP 1.6 over five points, against 0.5 finished per day.
    expect(metrics.littlesLawDays).toBeCloseTo(3.2, 10)
  })

  it('has no Little\'s Law figure when nothing finished in the window', () => {
    const rows = [{ item_id: 'A', start_date: '01/01/2025', end_date: '' }]
    const metrics = flowMetrics(cfdSeries(itemsFrom(rows), jan(3)))
    expect(metrics).toEqual({ wip: 1, arrivalsPerWeek: 0, departuresPerWeek: 0, littlesLawDays: null })
  })

  it('reports WIP but no rates for a single visible day', () => {
    const rows = [{ item_id: 'A', start_date: '01/01/2025', end_date: '' }]
    const points = clipToRange(cfdSeries(itemsFrom(rows), jan(3)), { from: jan(2), to: jan(2) })
    expect(flowMetrics(points)).toEqual({ wip: 1, arrivalsPerWeek: 0, departuresPerWeek: 0, littlesLawDays: null })
  })

  it('is all zero with no points', () => {
    expect(flowMetrics([])).toEqual({ wip: 0, arrivalsPerWeek: 0, departuresPerWeek: 0, littlesLawDays: null })
  })
})
