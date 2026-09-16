/**
 * Synthetic sample data, so a first-time user can see every analysis working
 * before they have a CSV of their own.
 *
 * Shaped deliberately rather than randomly, because the demo has to teach:
 *
 * - 30 items completed across roughly three months, so the process behaviour
 *   chart and the Monte Carlo throughput window both have enough history to say
 *   something.
 * - 7 items still in progress, with a blank end_date, so Aging Work In Progress
 *   has something to plot and the item sheet shows an in-progress count. Their
 *   ages spread across the percentile bands the completed items produce: three
 *   sit below the 50th, two between the 75th and 85th, and two above the 95th,
 *   so every band on the aging chart has a dot to explain.
 * - Estimates on every row, as integers, since CorrelationAnalysis parses them
 *   with parseInt and groups by exact value. Fibonacci points (1,2,3,5,8) give
 *   the correlation chart five distinct groups.
 * - Cycle time broadly rises with estimate but the ranges overlap heavily, which
 *   is the honest real-world picture: estimates correlate weakly with elapsed
 *   time. A demo where estimate perfectly predicted cycle time would be a lie.
 * - Two deliberate outliers (DEMO-14 at 34 days, DEMO-23 at 29) so the 85th
 *   percentile line sits somewhere interesting and the process behaviour chart
 *   has a genuine special-cause signal to detect.
 * - Throughput varies week to week rather than being flat, so the Monte Carlo
 *   forecast produces a spread of outcomes instead of a single spike.
 * - Three item types, so the type filter has something to show: 18 Stories
 *   (all five estimate values, the full date range, outlier DEMO-14), 8 Bugs
 *   (estimates 1-2, short cycle times) and 4 Tasks (mid estimates, outlier
 *   DEMO-23). The outliers sit in different types on purpose, so switching type
 *   visibly moves the 85th percentile line. Bug and Task are small enough to
 *   trigger Monte Carlo's limited-history warning, which is worth seeing. The
 *   open items split 4 Story, 2 Bug, 1 Task, so the aging chart keeps a column
 *   per type whichever way the filter is set.
 *
 * Dates are generated as day offsets from an anchor rather than written out, so
 * the window always ends on the day the demo is opened. Aging Work In Progress
 * reads age against today by default; fixed calendar dates would have made every
 * open item hundreds of days old and the chart meaningless. The offsets are the
 * real content here and they are stable, so the shape of the data never changes
 * — only where it sits on the calendar.
 *
 * Headers are the canonical contract names, matching the worked example shown on
 * the upload screen. The demo is routed through validationError like any upload,
 * so it cannot drift from the contract.
 */
export interface DemoRow {
  item_id: string
  start_date: string
  end_date: string
  estimate: string
  item_type: string
}

/**
 * One row as day offsets from the start of the window. `end` is null for an item
 * still in progress. The last completion lands on WINDOW_DAYS, which is anchored
 * to today, so offsets read as "days before now" once shifted.
 */
interface DemoSpec {
  start: number
  end: number | null
  estimate: string
  itemType: string
}

/** Day offset of the newest completion; the anchor puts it on today. */
const WINDOW_DAYS = 76

const DEMO_SPECS: DemoSpec[] = [
  { start: 0, end: 4, estimate: '2', itemType: 'Story' },
  { start: 0, end: 7, estimate: '3', itemType: 'Story' },
  { start: 1, end: 5, estimate: '1', itemType: 'Bug' },
  { start: 4, end: 15, estimate: '5', itemType: 'Story' },
  { start: 6, end: 11, estimate: '2', itemType: 'Story' },
  { start: 7, end: 12, estimate: '3', itemType: 'Story' },
  { start: 11, end: 13, estimate: '1', itemType: 'Bug' },
  { start: 11, end: 22, estimate: '5', itemType: 'Story' },
  { start: 13, end: 20, estimate: '3', itemType: 'Story' },
  { start: 14, end: 18, estimate: '2', itemType: 'Bug' },
  { start: 18, end: 29, estimate: '8', itemType: 'Task' },
  { start: 20, end: 25, estimate: '2', itemType: 'Bug' },
  { start: 21, end: 27, estimate: '3', itemType: 'Story' },
  { start: 22, end: 55, estimate: '5', itemType: 'Story' },
  { start: 27, end: 32, estimate: '2', itemType: 'Story' },
  { start: 28, end: 34, estimate: '3', itemType: 'Story' },
  { start: 32, end: 35, estimate: '1', itemType: 'Bug' },
  { start: 33, end: 47, estimate: '8', itemType: 'Story' },
  { start: 35, end: 41, estimate: '3', itemType: 'Story' },
  { start: 39, end: 43, estimate: '2', itemType: 'Bug' },
  { start: 41, end: 50, estimate: '5', itemType: 'Task' },
  { start: 42, end: 46, estimate: '1', itemType: 'Story' },
  { start: 46, end: 74, estimate: '8', itemType: 'Task' },
  { start: 48, end: 54, estimate: '3', itemType: 'Story' },
  { start: 53, end: 57, estimate: '2', itemType: 'Bug' },
  { start: 54, end: 64, estimate: '5', itemType: 'Story' },
  { start: 60, end: 63, estimate: '1', itemType: 'Bug' },
  { start: 62, end: 71, estimate: '5', itemType: 'Task' },
  { start: 67, end: 75, estimate: '3', itemType: 'Story' },
  { start: 69, end: WINDOW_DAYS, estimate: '2', itemType: 'Story' },

  // Still in progress. Ages below are as of the newest completion, which the
  // anchor puts on today: WINDOW_DAYS - start + 1, counted inclusively the way
  // ageInDays does. Completed cycle times give p50 7, p75 10, p85 12, p95 ~23.
  { start: 74, end: null, estimate: '2', itemType: 'Story' }, //  3 days, under p50
  { start: 73, end: null, estimate: '1', itemType: 'Bug' },   //  4 days, under p50
  { start: 72, end: null, estimate: '3', itemType: 'Story' }, //  5 days, under p50
  { start: 66, end: null, estimate: '5', itemType: 'Story' }, // 11 days, past p75
  { start: 65, end: null, estimate: '3', itemType: 'Task' },  // 12 days, past p75
  { start: 41, end: null, estimate: '8', itemType: 'Story' }, // 36 days, past p95
  { start: 32, end: null, estimate: '5', itemType: 'Bug' },   // 45 days, past p95
]

function formatDemoDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}

/**
 * Build the demo rows against an anchor date, defaulting to today. Offset 0 is
 * WINDOW_DAYS before the anchor, so the newest completion lands on the anchor
 * itself and open items read as a handful of days old.
 */
export function buildDemoData(anchor: Date = new Date()): DemoRow[] {
  const origin = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - WINDOW_DAYS)
  const dateAt = (offset: number) =>
    formatDemoDate(new Date(origin.getFullYear(), origin.getMonth(), origin.getDate() + offset))

  return DEMO_SPECS.map((spec, index) => ({
    item_id: `DEMO-${index + 1}`,
    start_date: dateAt(spec.start),
    end_date: spec.end === null ? '' : dateAt(spec.end),
    estimate: spec.estimate,
    item_type: spec.itemType,
  }))
}

/**
 * The demo dataset as of module load. Fine for a session that lasts minutes;
 * call buildDemoData() directly if a later anchor matters.
 */
export const DEMO_DATA: DemoRow[] = buildDemoData()
