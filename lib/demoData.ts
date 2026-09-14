/**
 * Synthetic sample data, so a first-time user can see every analysis working
 * before they have a CSV of their own.
 *
 * Shaped deliberately rather than randomly, because the demo has to teach:
 *
 * - 30 items completed across three months (Jan-Mar 2025), so the process
 *   behaviour chart and the Monte Carlo throughput window both have enough
 *   history to say something.
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
 *   trigger Monte Carlo's limited-history warning, which is worth seeing.
 *
 * Dates are DD/MM/YYYY and headers are the canonical contract names, matching
 * the worked example shown on the upload screen. The demo is routed through
 * validationError like any upload, so it cannot drift from the contract.
 */
export interface DemoRow {
  item_id: string
  start_date: string
  end_date: string
  estimate: string
  item_type: string
}

export const DEMO_DATA: DemoRow[] = [
  { item_id: 'DEMO-1', start_date: '02/01/2025', end_date: '06/01/2025', estimate: '2', item_type: 'Story' },
  { item_id: 'DEMO-2', start_date: '02/01/2025', end_date: '09/01/2025', estimate: '3', item_type: 'Story' },
  { item_id: 'DEMO-3', start_date: '03/01/2025', end_date: '07/01/2025', estimate: '1', item_type: 'Bug' },
  { item_id: 'DEMO-4', start_date: '06/01/2025', end_date: '17/01/2025', estimate: '5', item_type: 'Story' },
  { item_id: 'DEMO-5', start_date: '08/01/2025', end_date: '13/01/2025', estimate: '2', item_type: 'Story' },
  { item_id: 'DEMO-6', start_date: '09/01/2025', end_date: '14/01/2025', estimate: '3', item_type: 'Story' },
  { item_id: 'DEMO-7', start_date: '13/01/2025', end_date: '15/01/2025', estimate: '1', item_type: 'Bug' },
  { item_id: 'DEMO-8', start_date: '13/01/2025', end_date: '24/01/2025', estimate: '5', item_type: 'Story' },
  { item_id: 'DEMO-9', start_date: '15/01/2025', end_date: '22/01/2025', estimate: '3', item_type: 'Story' },
  { item_id: 'DEMO-10', start_date: '16/01/2025', end_date: '20/01/2025', estimate: '2', item_type: 'Bug' },
  { item_id: 'DEMO-11', start_date: '20/01/2025', end_date: '31/01/2025', estimate: '8', item_type: 'Task' },
  { item_id: 'DEMO-12', start_date: '22/01/2025', end_date: '27/01/2025', estimate: '2', item_type: 'Bug' },
  { item_id: 'DEMO-13', start_date: '23/01/2025', end_date: '29/01/2025', estimate: '3', item_type: 'Story' },
  { item_id: 'DEMO-14', start_date: '24/01/2025', end_date: '26/02/2025', estimate: '5', item_type: 'Story' },
  { item_id: 'DEMO-15', start_date: '29/01/2025', end_date: '03/02/2025', estimate: '2', item_type: 'Story' },
  { item_id: 'DEMO-16', start_date: '30/01/2025', end_date: '05/02/2025', estimate: '3', item_type: 'Story' },
  { item_id: 'DEMO-17', start_date: '03/02/2025', end_date: '06/02/2025', estimate: '1', item_type: 'Bug' },
  { item_id: 'DEMO-18', start_date: '04/02/2025', end_date: '18/02/2025', estimate: '8', item_type: 'Story' },
  { item_id: 'DEMO-19', start_date: '06/02/2025', end_date: '12/02/2025', estimate: '3', item_type: 'Story' },
  { item_id: 'DEMO-20', start_date: '10/02/2025', end_date: '14/02/2025', estimate: '2', item_type: 'Bug' },
  { item_id: 'DEMO-21', start_date: '12/02/2025', end_date: '21/02/2025', estimate: '5', item_type: 'Task' },
  { item_id: 'DEMO-22', start_date: '13/02/2025', end_date: '17/02/2025', estimate: '1', item_type: 'Story' },
  { item_id: 'DEMO-23', start_date: '17/02/2025', end_date: '17/03/2025', estimate: '8', item_type: 'Task' },
  { item_id: 'DEMO-24', start_date: '19/02/2025', end_date: '25/02/2025', estimate: '3', item_type: 'Story' },
  { item_id: 'DEMO-25', start_date: '24/02/2025', end_date: '28/02/2025', estimate: '2', item_type: 'Bug' },
  { item_id: 'DEMO-26', start_date: '25/02/2025', end_date: '07/03/2025', estimate: '5', item_type: 'Story' },
  { item_id: 'DEMO-27', start_date: '03/03/2025', end_date: '06/03/2025', estimate: '1', item_type: 'Bug' },
  { item_id: 'DEMO-28', start_date: '05/03/2025', end_date: '14/03/2025', estimate: '5', item_type: 'Task' },
  { item_id: 'DEMO-29', start_date: '10/03/2025', end_date: '18/03/2025', estimate: '3', item_type: 'Story' },
  { item_id: 'DEMO-30', start_date: '12/03/2025', end_date: '19/03/2025', estimate: '2', item_type: 'Story' },
]
