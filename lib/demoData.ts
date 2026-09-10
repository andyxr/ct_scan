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
 *
 * Dates are DD/MM/YYYY and headers are plain, matching the worked example shown
 * on the upload screen.
 */
export interface DemoRow {
  ID: string
  Start: string
  End: string
  Estimate: string
}

export const DEMO_DATA: DemoRow[] = [
  { ID: 'DEMO-1', Start: '02/01/2025', End: '06/01/2025', Estimate: '2' },
  { ID: 'DEMO-2', Start: '02/01/2025', End: '09/01/2025', Estimate: '3' },
  { ID: 'DEMO-3', Start: '03/01/2025', End: '07/01/2025', Estimate: '1' },
  { ID: 'DEMO-4', Start: '06/01/2025', End: '17/01/2025', Estimate: '5' },
  { ID: 'DEMO-5', Start: '08/01/2025', End: '13/01/2025', Estimate: '2' },
  { ID: 'DEMO-6', Start: '09/01/2025', End: '14/01/2025', Estimate: '3' },
  { ID: 'DEMO-7', Start: '13/01/2025', End: '15/01/2025', Estimate: '1' },
  { ID: 'DEMO-8', Start: '13/01/2025', End: '24/01/2025', Estimate: '5' },
  { ID: 'DEMO-9', Start: '15/01/2025', End: '22/01/2025', Estimate: '3' },
  { ID: 'DEMO-10', Start: '16/01/2025', End: '20/01/2025', Estimate: '2' },
  { ID: 'DEMO-11', Start: '20/01/2025', End: '31/01/2025', Estimate: '8' },
  { ID: 'DEMO-12', Start: '22/01/2025', End: '27/01/2025', Estimate: '2' },
  { ID: 'DEMO-13', Start: '23/01/2025', End: '29/01/2025', Estimate: '3' },
  { ID: 'DEMO-14', Start: '24/01/2025', End: '26/02/2025', Estimate: '5' },
  { ID: 'DEMO-15', Start: '29/01/2025', End: '03/02/2025', Estimate: '2' },
  { ID: 'DEMO-16', Start: '30/01/2025', End: '05/02/2025', Estimate: '3' },
  { ID: 'DEMO-17', Start: '03/02/2025', End: '06/02/2025', Estimate: '1' },
  { ID: 'DEMO-18', Start: '04/02/2025', End: '18/02/2025', Estimate: '8' },
  { ID: 'DEMO-19', Start: '06/02/2025', End: '12/02/2025', Estimate: '3' },
  { ID: 'DEMO-20', Start: '10/02/2025', End: '14/02/2025', Estimate: '2' },
  { ID: 'DEMO-21', Start: '12/02/2025', End: '21/02/2025', Estimate: '5' },
  { ID: 'DEMO-22', Start: '13/02/2025', End: '17/02/2025', Estimate: '1' },
  { ID: 'DEMO-23', Start: '17/02/2025', End: '17/03/2025', Estimate: '8' },
  { ID: 'DEMO-24', Start: '19/02/2025', End: '25/02/2025', Estimate: '3' },
  { ID: 'DEMO-25', Start: '24/02/2025', End: '28/02/2025', Estimate: '2' },
  { ID: 'DEMO-26', Start: '25/02/2025', End: '07/03/2025', Estimate: '5' },
  { ID: 'DEMO-27', Start: '03/03/2025', End: '06/03/2025', Estimate: '1' },
  { ID: 'DEMO-28', Start: '05/03/2025', End: '14/03/2025', Estimate: '5' },
  { ID: 'DEMO-29', Start: '10/03/2025', End: '18/03/2025', Estimate: '3' },
  { ID: 'DEMO-30', Start: '12/03/2025', End: '19/03/2025', Estimate: '2' },
]
