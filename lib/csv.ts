/**
 * Shared CSV column reading and date parsing.
 *
 * Columns are identified by HEADER NAME, matched against COLUMN_ALIASES below.
 * Order does not matter. Required: item_id, start_date, end_date. Optional:
 * estimate (Correlation only), item_type (adds the type filter), cycle_time
 * (recognised so it does not trip the contract, but never read). A blank
 * end_date means the item is still in progress; it is parsed and counted, but
 * only completed items are charted.
 *
 * Name matching used to live here once before, alongside content sniffing, and
 * both guessed wrong on real files: parseFloat("2026-01-27T15:42:43Z") returns
 * 2026, so an ISO date column passed a "looks numeric" test, was claimed as
 * cycle time, and every item came out with a ~2027-day cycle time. That version
 * guessed at headers it had never published and let content break ties.
 *
 * This version is different in two ways. The names are a contract the user is
 * told to meet, not a guess at an unknown header. And a header that matches
 * nothing is a visible rejection at upload, never a silent wrong claim. Content
 * checks (mostlyDates, mostlyNumeric) only ever validate a column already
 * claimed by name; they never choose one.
 *
 * Cycle time is always derived from the two dates, so there is one source of
 * truth for it.
 */

export interface ColumnMap {
  id?: string
  startDate?: string
  endDate?: string
  cycleTime?: string
  estimate?: string
  itemType?: string
}

type ColumnKey = keyof ColumnMap

/** Lowercase with every non-alphanumeric stripped: "Item ID" and "item_id" both fold to "itemid". */
export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Canonical name first, then accepted aliases, all in normalised form. Lists must be disjoint. */
export const COLUMN_ALIASES: Record<ColumnKey, readonly string[]> = {
  id: ['itemid', 'id', 'key', 'issuekey', 'issueid', 'ticket', 'ticketid', 'itemkey', 'reference', 'ref'],
  startDate: ['startdate', 'start', 'started', 'startedat', 'inprogress', 'inprogressdate', 'begin', 'commitmentdate'],
  endDate: ['enddate', 'end', 'ended', 'endedat', 'done', 'donedate', 'completed', 'completeddate', 'completiondate', 'resolved', 'resolutiondate', 'closed', 'closeddate', 'finish', 'finished'],
  cycleTime: ['cycletime', 'cycletimedays', 'elapsed', 'elapseddays', 'duration'],
  estimate: ['estimate', 'estimated', 'storypoints', 'storypoint', 'points', 'effort', 'estimatepoints'],
  itemType: ['itemtype', 'type', 'issuetype', 'worktype', 'kind'],
}

const COLUMN_KEYS = Object.keys(COLUMN_ALIASES) as ColumnKey[]

/** The header a user is told to add, per required column. */
export const CANONICAL_HEADER: Record<ColumnKey, string> = {
  id: 'item_id',
  startDate: 'start_date',
  endDate: 'end_date',
  cycleTime: 'cycle_time',
  estimate: 'estimate',
  itemType: 'item_type',
}

const REQUIRED_KEYS: readonly ColumnKey[] = ['id', 'startDate', 'endDate']

if (process.env.NODE_ENV !== 'production') {
  const seen = new Map<string, ColumnKey>()
  for (const key of COLUMN_KEYS) {
    for (const alias of COLUMN_ALIASES[key]) {
      const owner = seen.get(alias)
      if (owner) throw new Error(`COLUMN_ALIASES: "${alias}" is claimed by both ${owner} and ${key}`)
      seen.set(alias, key)
    }
  }
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

/**
 * An empty cell, in the one sense both validation and parsing must agree on:
 * a whitespace-only end_date marks an item in progress just as an empty one does.
 */
function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === ''
}

/**
 * Blanks are filtered before the sample is taken, not after, so a file whose
 * first 20 rows are all in progress still has its end column validated on the
 * completed rows further down. Newest first is a common export order.
 */
function sampleValues(data: any[], column: string): unknown[] {
  const values: unknown[] = []
  for (const row of data) {
    const value = row[column]
    if (isBlank(value)) continue
    values.push(value)
    if (values.length === 20) break
  }
  return values
}

/** True if enough of a claimed column's values parse as dates. Validates, never chooses. */
function mostlyDates(data: any[], column: string): boolean {
  const values = sampleValues(data, column)
  // An all-blank column contradicts nothing; the emptiness messages below cover it.
  if (values.length === 0) return true
  return values.filter(v => parseDate(v) !== null).length >= values.length * 0.8
}

/** True if enough of a claimed column's values are numbers to group by. Validates, never chooses. */
function mostlyNumeric(data: any[], column: string): boolean {
  const values = sampleValues(data, column)
  if (values.length === 0) return false
  // Whole string must be numeric: parseFloat alone accepts "2026-01-27T15:42:43Z".
  return values.filter(v => /^-?\d+(\.\d+)?$/.test(String(v).trim())).length >= values.length * 0.8
}

/**
 * Map this file's header names onto column roles by name.
 *
 * Each role takes the first unclaimed header matching its alias list, in alias
 * priority order, so one header can never satisfy two roles. Content is not
 * consulted here; a claimed estimate column is checked separately by
 * hasUsableEstimate.
 */
export function detectColumns(data: any[]): ColumnMap {
  const headers = Object.keys(data[0] || {})
  const byNormalised = new Map<string, string>()
  for (const header of headers) {
    const key = normaliseHeader(header)
    if (!byNormalised.has(key)) byNormalised.set(key, header)
  }

  const claimed = new Set<string>()
  const columns: ColumnMap = {}
  for (const key of COLUMN_KEYS) {
    for (const alias of COLUMN_ALIASES[key]) {
      const header = byNormalised.get(alias)
      if (header !== undefined && !claimed.has(header)) {
        columns[key] = header
        claimed.add(header)
        break
      }
    }
  }
  return columns
}

/** An estimate column was named and holds numbers Correlation can group by. */
export function hasUsableEstimate(data: any[], columns: ColumnMap): boolean {
  return Boolean(columns.estimate) && mostlyNumeric(data, columns.estimate!)
}

/**
 * Why a CSV can't be analysed, or null when it is usable.
 *
 * Names are checked first, so a file that breaks the contract is told which
 * headers to add rather than being drawn as an empty chart.
 */
export function validationError(data: any[]): string | null {
  if (data.length === 0) return 'That file has no rows.'

  const columns = detectColumns(data)
  const missing = REQUIRED_KEYS.filter(key => !columns[key]).map(key => CANONICAL_HEADER[key])
  if (missing.length === 1) {
    return `That file has no ${missing[0]} column. Add a column headed "${missing[0]}" and upload it again.`
  }
  if (missing.length > 1) {
    return `That file is missing these columns: ${missing.join(', ')}. Add them and upload it again.`
  }

  if (!mostlyDates(data, columns.startDate!)) {
    return `The "${columns.startDate}" column should hold start dates, but its values aren't dates.`
  }
  if (!mostlyDates(data, columns.endDate!)) {
    return `The "${columns.endDate}" column should hold end dates, but its values aren't dates.`
  }

  if (toFlowItems(data, columns).length === 0) {
    return 'No rows had a usable start and end date.'
  }
  if (toWorkItems(data, columns).length === 0) {
    return 'Every row is still in progress. Nothing has completed yet, so there is nothing to chart.'
  }

  return null
}

/** Dropdown sentinel: no type filter applied. */
export const ALL_ITEM_TYPES = 'All'
/** Dropdown sentinel: rows whose item_type cell is blank. */
export const UNTYPED_ITEM_TYPE = '(Untyped)'

export function itemTypeOf(row: any, column: string): string {
  return String(row[column] ?? '').trim()
}

/**
 * Distinct item types in the data, sorted, with "(Untyped)" appended last when
 * any row has a blank cell. Case-sensitive on purpose: folding "Story" and
 * "story" would force a choice of which spelling to display.
 */
export function itemTypesIn(data: any[], columns: ColumnMap): string[] {
  const column = columns.itemType
  if (!column) return []

  const types = new Set<string>()
  let hasUntyped = false
  for (const row of data) {
    const type = itemTypeOf(row, column)
    if (type) types.add(type)
    else hasUntyped = true
  }
  const sorted = Array.from(types).sort((a, b) => a.localeCompare(b))
  if (hasUntyped) sorted.push(UNTYPED_ITEM_TYPE)
  return sorted
}

/**
 * Rows matching the selected type. "All", a file with no item_type column, and
 * a selection that matches nothing in the file all return the data unchanged,
 * so a stale selection degrades to "no filter" rather than a blank chart.
 */
export function filterByItemType(data: any[], columns: ColumnMap, selected: string): any[] {
  const column = columns.itemType
  if (selected === ALL_ITEM_TYPES || !column) return data
  if (!itemTypesIn(data, columns).includes(selected)) return data

  const wanted = selected === UNTYPED_ITEM_TYPE ? '' : selected
  return data.filter(row => itemTypeOf(row, column) === wanted)
}

/** Completion-date window. Epoch ms at local midnight, null = open end. */
export interface DateRange {
  from: number | null
  to: number | null
}

/** No window applied. */
export const OPEN_DATE_RANGE: DateRange = { from: null, to: null }

/**
 * Rows completed within the window, inclusive at both ends and compared at local
 * midnight. Every analysis keys on completion, so "within" means the end date.
 * A row whose end date does not parse is kept, leaving toWorkItems to drop it and
 * validationError to keep telling the same story. An in-progress row has no end
 * date to compare, so it survives every window rather than vanishing from the
 * in-progress count when the user narrows one. Two open ends, and a from later
 * than its to, both return the data unchanged, so an inverted or stale window
 * degrades to "no filter" rather than a blank chart.
 */
export function filterByDateRange(data: any[], columns: ColumnMap, range: DateRange): any[] {
  const column = columns.endDate
  const { from, to } = range
  if (!column || (from === null && to === null)) return data
  if (from !== null && to !== null && from > to) return data

  return data.filter(row => {
    const end = parseDate(row[column])
    if (!end) return true

    const day = startOfDay(end)
    return (from === null || day >= from) && (to === null || day <= to)
  })
}

/** Earliest and latest parsed end date, at local midnight, or null when none parses. */
export function endDateSpan(data: any[], columns: ColumnMap): { min: number; max: number } | null {
  const column = columns.endDate
  if (!column) return null

  let min = Infinity
  let max = -Infinity
  for (const row of data) {
    const end = parseDate(row[column])
    if (!end) continue

    const day = startOfDay(end)
    if (day < min) min = day
    if (day > max) max = day
  }
  return min === Infinity ? null : { min, max }
}

interface ItemBase {
  id: string
  /** Epoch ms of the parsed start date. */
  startDate: number
  /** Always set: UNTYPED_ITEM_TYPE when the cell is blank or the file has no item_type column. */
  itemType: string
}

export interface CompletedItem extends ItemBase {
  status: 'completed'
  endDate: number
  cycleTime: number
  originalEndDate: string
}

/** A row whose end_date cell is blank: started, not yet finished. */
export interface InProgressItem extends ItemBase {
  status: 'in-progress'
}

export type FlowItem = CompletedItem | InProgressItem

/** The completed half of FlowItem, and the shape every analysis works from. */
export type WorkItem = CompletedItem

/**
 * Cycle time for a row, in whole days, counted inclusively: an item started and
 * finished on the same day is 1 day, so every value is elapsed days plus one.
 * This matches the Vacanti and ActionableAgile convention.
 *
 * Always derived from the start and end calendar dates. A cycle_time column in
 * the source is not read: an export's own "active" cycle time measures
 * something different from elapsed calendar days.
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
 * Parse every row into a completed or in-progress item, in file order.
 *
 * A row is dropped when its start date does not parse, when a non-blank end
 * cell does not parse, or when the end date precedes the start. Only a blank
 * end cell means in progress, so garbage never masquerades as unfinished work.
 */
export function toFlowItems(data: any[], columns: ColumnMap): FlowItem[] {
  if (!columns.startDate || !columns.endDate) return []

  return data
    .map((row): FlowItem | null => {
      const startDate = parseDate(row[columns.startDate!])
      if (!startDate) return null

      const base: ItemBase = {
        id: columns.id ? String(row[columns.id] ?? 'Unknown') : 'Unknown',
        startDate: startDate.getTime(),
        itemType: (columns.itemType && itemTypeOf(row, columns.itemType)) || UNTYPED_ITEM_TYPE,
      }

      if (isBlank(row[columns.endDate!])) return { ...base, status: 'in-progress' }

      const endDate = parseDate(row[columns.endDate!])
      if (!endDate) return null

      const cycleTime = cycleTimeFor(row, columns)
      if (cycleTime === null) return null

      return {
        ...base,
        status: 'completed',
        endDate: endDate.getTime(),
        cycleTime,
        originalEndDate: formatDate(endDate),
      }
    })
    .filter((item): item is FlowItem => item !== null)
}

/**
 * Turn raw CSV rows into the shape every analysis needs: an id, a completion
 * timestamp and a cycle time in days, sorted oldest first.
 */
export function toWorkItems(data: any[], columns: ColumnMap): WorkItem[] {
  return toFlowItems(data, columns)
    .filter((item): item is CompletedItem => item.status === 'completed')
    .sort((a, b) => a.endDate - b.endDate)
}

/** Started but not finished, in file order. */
export function toInProgressItems(data: any[], columns: ColumnMap): InProgressItem[] {
  return toFlowItems(data, columns).filter(
    (item): item is InProgressItem => item.status === 'in-progress'
  )
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
