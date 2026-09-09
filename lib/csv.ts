/**
 * Shared CSV column detection and date parsing.
 *
 * Every analysis component used to re-implement this inline, which meant a new
 * CSV shape broke each of them in a slightly different way. Detection lives
 * here now so all four analyses agree on what a column means.
 */

export interface ColumnMap {
  endDate?: string
  startDate?: string
  cycleTime?: string
  id?: string
  estimate?: string
}

/** Normalise a header for matching: lowercase, strip punctuation and bracketed qualifiers. */
function normalise(header: string): string {
  return header
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // drop "(In Progress)", "(Days)", "(Done)"
    .replace(/[_\-]/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Match a header by exact normalised name first, then by whole-word containment.
 * Exact wins so that "End Date" beats "Start Date (In Progress)" for `end`.
 */
function findColumn(columns: string[], exact: string[], contains: string[][]): string | undefined {
  const normalised = columns.map(col => ({ col, norm: normalise(col) }))

  for (const want of exact) {
    const hit = normalised.find(c => c.norm === want)
    if (hit) return hit.col
  }

  for (const words of contains) {
    const hit = normalised.find(c => {
      const tokens = c.norm.split(' ')
      return words.every(w => tokens.includes(w))
    })
    if (hit) return hit.col
  }

  return undefined
}

/**
 * Parse a date cell. Handles ISO 8601 (with or without a time component) and
 * DD/MM/YYYY, the two formats this app's exports actually produce.
 * Returns null rather than an Invalid Date so callers can filter cleanly.
 */
export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  const str = value.toString().trim()
  if (!str) return null

  // ISO 8601: 2026-09-03T08:16:30Z, or a bare 2026-09-03
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (iso) {
    const [, y, m, d, hh, mm, ss] = iso
    const date = new Date(
      Number(y), Number(m) - 1, Number(d),
      Number(hh ?? 0), Number(mm ?? 0), Number(ss ?? 0)
    )
    return isNaN(date.getTime()) ? null : date
  }

  // DD/MM/YYYY or DD-MM-YYYY, optionally followed by a time we ignore
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    let year = Number(dmy[3])
    if (year < 100) year += 2000
    if (day < 1 || day > 31 || month < 1 || month > 12) return null
    const date = new Date(year, month - 1, day)
    return isNaN(date.getTime()) ? null : date
  }

  return null
}

/** True if a column's sample values parse as dates. */
function looksLikeDates(values: unknown[]): boolean {
  const parsed = values.map(parseDate).filter(Boolean)
  return values.length > 0 && parsed.length >= values.length * 0.8
}

/** True if a column's sample values are all non-negative numbers. */
function looksNumeric(values: unknown[]): boolean {
  if (values.length === 0) return false
  return values.every(val => {
    const num = parseFloat(String(val))
    return !isNaN(num) && num >= 0
  })
}

function sample(data: any[], column: string, size = 20): unknown[] {
  return data.slice(0, size).map(row => row[column]).filter(v => v !== null && v !== undefined && v !== '')
}

/**
 * Work out which column is which. Named headers take priority; content-based
 * detection is a fallback for files whose headers we don't recognise.
 */
export function detectColumns(data: any[]): ColumnMap {
  const columns = Object.keys(data[0] || {})

  const map: ColumnMap = {
    endDate: findColumn(columns, ['end', 'end date', 'done', 'completed', 'resolved'],
      [['end'], ['done'], ['completed'], ['resolved'], ['closed']]),
    startDate: findColumn(columns, ['start', 'start date', 'started'],
      [['start'], ['started'], ['began']]),
    cycleTime: findColumn(columns, ['ct', 'cycle time', 'cycletime', 'lead time', 'age'],
      [['cycle', 'time'], ['lead', 'time'], ['ct']]),
    id: findColumn(columns, ['id', 'key', 'story id', 'issue key', 'ticket'],
      [['id'], ['key'], ['ticket']]),
    estimate: findColumn(columns, ['estimate', 'est', 'story points', 'points', 'size'],
      [['estimate'], ['points'], ['size']]),
  }

  // A start column must not double as the end column.
  if (map.startDate && map.startDate === map.endDate) map.startDate = undefined

  // Content-based fallbacks, skipping any column already claimed.
  const claimed = new Set(Object.values(map).filter(Boolean) as string[])

  if (!map.endDate) {
    // Prefer the latest-dated column: that is the completion date.
    const dateCols = columns.filter(col => !claimed.has(col) && looksLikeDates(sample(data, col)))
    let best: { col: string; max: number } | undefined
    for (const col of dateCols) {
      const max = Math.max(...data.map(r => parseDate(r[col])?.getTime() ?? -Infinity))
      if (!best || max > best.max) best = { col, max }
    }
    if (best) {
      map.endDate = best.col
      claimed.add(best.col)
    }
  }

  if (!map.cycleTime) {
    const col = columns.find(c => !claimed.has(c) && looksNumeric(sample(data, c)))
    if (col) {
      map.cycleTime = col
      claimed.add(col)
    }
  }

  if (!map.id) {
    const col = columns.find(c => !claimed.has(c))
    if (col) map.id = col
  }

  return map
}

export interface WorkItem {
  id: string
  endDate: number
  cycleTime: number
  originalEndDate: string
}

/**
 * Cycle time for a row, in whole days, counted inclusively: an item started and
 * finished on the same day is 1 day, so every value is elapsed days plus one.
 * Uses the CSV's own cycle time column when present, otherwise derives it from
 * the start and end calendar dates.
 */
export function cycleTimeFor(row: any, columns: ColumnMap): number | null {
  if (columns.cycleTime) {
    const raw = parseFloat(String(row[columns.cycleTime]))
    if (!isNaN(raw) && raw >= 0) return Math.round(raw) + 1
  }

  if (columns.startDate && columns.endDate) {
    const start = parseDate(row[columns.startDate])
    const end = parseDate(row[columns.endDate])
    if (start && end) {
      const days = Math.round((startOfDay(end) - startOfDay(start)) / 86400000)
      if (days >= 0) return days + 1
    }
  }

  return null
}

/** Local midnight for a date, so day arithmetic ignores time of day. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * Turn raw CSV rows into the shape every analysis needs: an id, a completion
 * timestamp and a cycle time in days, sorted oldest first.
 */
export function toWorkItems(data: any[], columns: ColumnMap): WorkItem[] {
  if (!columns.endDate) return []

  return data
    .map((row): WorkItem | null => {
      const endDate = parseDate(row[columns.endDate!])
      if (!endDate) return null

      const cycleTime = cycleTimeFor(row, columns)
      if (cycleTime === null) return null

      return {
        id: columns.id ? String(row[columns.id] ?? 'Unknown') : 'Unknown',
        endDate: endDate.getTime(),
        cycleTime,
        originalEndDate: formatDate(endDate),
      }
    })
    .filter((item): item is WorkItem => item !== null)
    .sort((a, b) => a.endDate - b.endDate)
}

/** DD/MM/YYYY, the display format used throughout the app. */
export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Linear-interpolated percentile over an unsorted numeric array. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (sorted.length - 1) * p
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  const weight = index % 1
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}
