import { describe, expect, it } from 'vitest'
import { throughputByType } from './throughputByType'
import { throughputRun } from './throughputRun'

function row(id: number, end: string, type: string) {
  return { item_id: String(id), start_date: '2025-01-01', end_date: end, item_type: type }
}

const data = [
  row(1, '2025-03-05', 'Bug'),
  row(2, '2025-03-10', 'Story'),
  row(3, '2025-03-11', 'Bug'),
  row(4, '2025-03-12', 'Story'),
  row(5, '2025-03-18', 'Task'),
]

describe('throughputByType', () => {
  it('returns nothing for no completions', () => {
    expect(throughputByType([], 'week')).toEqual({ buckets: [], types: [], totals: {} })
  })

  it('splits each week by type, in the given type order', () => {
    const result = throughputByType(data, 'week', ['Story', 'Bug', 'Task'])
    expect(result.types).toEqual(['Story', 'Bug', 'Task'])
    expect(result.buckets.map(b => [b.label, b.counts, b.total, b.partial])).toEqual([
      ['03/03/2025', { Story: 0, Bug: 1, Task: 0 }, 1, true],
      ['10/03/2025', { Story: 2, Bug: 1, Task: 0 }, 3, false],
      ['17/03/2025', { Story: 0, Bug: 0, Task: 1 }, 1, true],
    ])
    expect(result.totals).toEqual({ Story: 2, Bug: 1, Task: 0 })
  })

  it('sorts types missing from the order after the known ones, by name', () => {
    expect(throughputByType(data, 'week', ['Task']).types).toEqual(['Task', 'Bug', 'Story'])
  })

  it('matches the run chart total for every bucket', () => {
    const byType = throughputByType(data, 'day')
    const run = throughputRun(data, 'day')
    expect(byType.buckets.map(b => [b.start, b.total])).toEqual(run.buckets.map(b => [b.start, b.count]))
  })
})
