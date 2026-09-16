/**
 * Cumulative flow: two cumulative counts per day, started and done, and the
 * work in progress between them.
 *
 * Two states rather than workflow stages, because the contract carries a start
 * and an end date and nothing in between. That is enough to read WIP over time,
 * arrivals against departures, and batchy delivery, but not where work piles up.
 *
 * Every point sits at local midnight and counts a whole calendar day, so the
 * series lines up with cycle time and aging, which are both counted in whole
 * local days.
 */

import type { DateRange, FlowItem } from './csv'

/** Cumulative counts at the end of one calendar day. */
export interface CfdPoint {
  /** Local midnight of the day. */
  timestamp: number
  started: number
  done: number
  /** started - done: items begun and not yet finished on that day. */
  wip: number
}

export interface FlowMetrics {
  wip: number
  arrivalsPerWeek: number
  departuresPerWeek: number
  /** Average WIP divided by items finished per day, or null when nothing finished. */
  littlesLawDays: number | null
}

const WEEK_DAYS = 7

function startOfDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * A daily cumulative point per calendar day, from the first start date to the
 * later of asOf and the last completion.
 *
 * An open item never enters `done`, so it holds its place in WIP to the right
 * edge. asOf bounds that edge only: an item started after it still counts from
 * its own start day, because hiding it would understate a WIP the team has.
 */
export function cfdSeries(items: readonly FlowItem[], asOf: number): CfdPoint[] {
  if (items.length === 0) return []

  const startDays = items.map(item => startOfDay(item.startDate))
  const endDays = items
    .filter(item => item.status === 'completed')
    .map(item => startOfDay(item.endDate))

  const firstDay = Math.min(...startDays)
  const lastDay = Math.max(startOfDay(asOf), ...endDays, firstDay)

  const points: CfdPoint[] = []
  // Step by calendar day rather than by 24 hours: across a clock change a
  // 24-hour step lands on the wrong day, double-counting one and dropping the last.
  for (const day = new Date(firstDay); day.getTime() <= lastDay; day.setDate(day.getDate() + 1)) {
    const timestamp = day.getTime()
    const started = startDays.filter(start => start <= timestamp).length
    const done = endDays.filter(end => end <= timestamp).length
    points.push({ timestamp, started, done, wip: started - done })
  }
  return points
}

/**
 * The first day anything completed, or null when nothing has.
 *
 * The chart's default left edge: before it the file holds no finished work, so
 * WIP there is understated by every item that finished before the export began.
 */
export function firstCompletion(items: readonly FlowItem[]): number | null {
  const endDays = items
    .filter(item => item.status === 'completed')
    .map(item => startOfDay(item.endDate))
  return endDays.length === 0 ? null : Math.min(...endDays)
}

/**
 * Points inside the window, inclusive at both ends.
 *
 * The range is an x-axis viewport, not an item filter: the counts at a given
 * day are the same clipped or not, so narrowing the window cannot rewrite history.
 */
export function clipToRange(points: readonly CfdPoint[], range: DateRange): CfdPoint[] {
  const { from, to } = range
  if (from === null && to === null) return [...points]
  if (from !== null && to !== null && from > to) return [...points]

  return points.filter(
    point => (from === null || point.timestamp >= from) && (to === null || point.timestamp <= to)
  )
}

/** Flow read off the visible points: WIP now, arrivals and departures per week, Little's Law. */
export function flowMetrics(points: readonly CfdPoint[]): FlowMetrics {
  const empty = { wip: 0, arrivalsPerWeek: 0, departuresPerWeek: 0, littlesLawDays: null }
  if (points.length === 0) return empty

  const first = points[0]
  const last = points[points.length - 1]
  // The first point already carries its own day's counts, so the window is the
  // days after it: two points span one day of flow, not two.
  const windowDays = points.length - 1
  if (windowDays === 0) return { ...empty, wip: last.wip }

  const departures = last.done - first.done
  const departuresPerDay = departures / windowDays
  const averageWip = points.reduce((total, point) => total + point.wip, 0) / points.length

  return {
    wip: last.wip,
    arrivalsPerWeek: ((last.started - first.started) / windowDays) * WEEK_DAYS,
    departuresPerWeek: departuresPerDay * WEEK_DAYS,
    littlesLawDays: departuresPerDay === 0 ? null : averageWip / departuresPerDay,
  }
}
