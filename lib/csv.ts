/**
 * Shared CSV column reading and date parsing.
 *
 * Columns are identified by POSITION, not by header name:
 *
 *   0: item ID   1: start date   2: end date   3: estimate (optional)
 *
 * Header names and date formats vary between exports, so neither is reliable;
 * the column order is the contract. Name-based matching and content sniffing
 * both used to live here, and both guessed wrong on real files — an ISO
 * timestamp parses as the number 2026 under parseFloat, so a date column could
 * be claimed as cycle time and every item came out with a ~2027-day cycle time.
 * Position removes the guess entirely.
 *
 * Cycle time is always derived from the start and end dates. A cycle time
 * column in the source is not read, because position 3 is the estimate.
 */

export interface ColumnMap {
  endDate?: string
  startDate?: string
  id?: string
  estimate?: string
}

/** Column positions, fixed by the CSV contract above. */
const ID = 0
const START = 1
const END = 2
const ESTIMATE = 3

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

/** True if enough of a column's values parse as dates to call it a date column. */
function mostlyDates(data: any[], column: string): boolean {
  const values = data
    .slice(0, 20)
    .map(row => row[column])
    .filter(v => v !== null && v !== undefined && v !== '')
  if (values.length === 0) return false
  return values.filter(v => parseDate(v) !== null).length >= values.length * 0.8
}

/** True if enough of a column's values are numbers to group by. */
function mostlyNumeric(data: any[], column: string): boolean {
  const values = data
    .slice(0, 20)
    .map(row => row[column])
    .filter(v => v !== null && v !== undefined && v !== '')
  if (values.length === 0) return false
  // Whole string must be numeric: parseFloat alone accepts "2026-01-27T15:42:43Z".
  return values.filter(v => /^-?\d+(\.\d+)?$/.test(String(v).trim())).length >= values.length * 0.8
}

/**
 * Map the fixed column positions onto this file's header names.
 *
 * Papaparse runs with `header: true` and preserves source column order, so the
 * Nth key of a row is the Nth column of the file.
 */
export function detectColumns(data: any[]): ColumnMap {
  const columns = Object.keys(data[0] || {})

  return {
    id: columns[ID],
    startDate: columns[START],
    endDate: columns[END],
    // Only offer an estimate when column 3 holds numbers to group by; a
    // non-numeric 4th column would otherwise enable Correlation on empty data.
    estimate: columns[ESTIMATE] && mostlyNumeric(data, columns[ESTIMATE])
      ? columns[ESTIMATE]
      : undefined,
  }
}

/**
 * Why a CSV can't be analysed, or null when it is usable.
 *
 * The column contract is positional, so a file in the wrong shape can't be
 * salvaged by guessing — say so at upload instead of drawing an empty chart.
 */
export function validationError(data: any[]): string | null {
  if (data.length === 0) return 'That file has no rows.'

  const columns = Object.keys(data[0] || {})
  if (columns.length < 3) {
    return 'Expected at least 3 columns: item ID, start date, end date.'
  }

  if (!mostlyDates(data, columns[START])) {
    return `Column 2 ("${columns[START]}") should be the start date, but its values aren't dates.`
  }
  if (!mostlyDates(data, columns[END])) {
    return `Column 3 ("${columns[END]}") should be the end date, but its values aren't dates.`
  }

  if (toWorkItems(data, detectColumns(data)).length === 0) {
    return 'No rows had a usable start and end date.'
  }

  return null
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
 * This matches the Vacanti and ActionableAgile convention.
 *
 * Always derived from the start and end calendar dates. A cycle time column in
 * the source is not read: position 3 is the estimate, and an export's own
 * "active" cycle time measures something different from elapsed calendar days.
 */
export function cycleTimeFor(row: any, columns: ColumnMap): number | null {
  if (!columns.startDate || !columns.endDate) return null

  const start = parseDate(row[columns.startDate])
  const end = parseDate(row[columns.endDate])
  if (!start || !end) return null

  const days = Math.round((startOfDay(end) - startOfDay(start)) / 86400000)
  return days >= 0 ? days + 1 : null
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
