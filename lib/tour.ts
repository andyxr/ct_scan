import type { AnalysisId } from './analyses'

/**
 * Which screen a tour step needs on show. The page owns the app state, so it
 * turns a scene into data and a selected analysis; any scene past the upload
 * screen runs on the demo file.
 */
export type TourScene =
  | { screen: 'upload' }
  | { screen: 'analyses' }
  | { screen: 'analysis'; id: AnalysisId }

/**
 * A control the step sets before it shows, by clicking it until its
 * `data-tour-state` reads `state`. Clicking the real control, rather than
 * reaching into component state, means the tour shows exactly what a user's
 * own click would.
 */
export interface TourEnsure {
  target: string
  state: string
}

export interface TourStep {
  id: string
  title: string
  body: string
  scene: TourScene
  /** `data-tour` value of the element to spotlight. None centres the toast on nothing in particular. */
  target?: string
  ensure?: TourEnsure
}

export const TOUR_OFFERED_KEY = 'flowgauge-tour-offered'

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Flowgauge',
    body: 'This tour covers loading data, each chart, and the controls you’ll use most. It runs on demo data and puts back whatever you had open when it ends. Use the buttons or arrow keys; Esc leaves at any time.',
    scene: { screen: 'upload' },
  },
  {
    id: 'byo-csv',
    title: 'Bring your own CSV',
    body: 'Drop an export from your tracker here, or click to browse. It needs item_id, start_date and end_date; estimate and item_type unlock more. The notes above show the shapes it accepts. Your file is read in the browser and never uploaded.',
    scene: { screen: 'upload' },
    target: 'byo-csv',
  },
  {
    id: 'demo-data',
    title: 'Or use demo data',
    body: 'No export to hand? Demo data loads 37 sample items across three months: 30 finished and 7 still in progress. The tour loads it next.',
    scene: { screen: 'upload' },
    target: 'demo-data',
  },
  {
    id: 'analyses',
    title: 'Pick an analysis',
    body: 'Each row opens a chart. If your file can’t support one, such as Correlation without an estimate column, the row says why.',
    scene: { screen: 'analyses' },
    target: 'analysis-list',
  },
  {
    id: 'cycle-time',
    title: 'Cycle Time Analysis',
    body: 'Each dot is a finished item: when it ended and how many days it took. The percentile lines show how long most work takes. The 85th is the usual basis for a service level expectation.',
    scene: { screen: 'analysis', id: 'cycle-time' },
    target: 'analysis-panel',
  },
  {
    id: 'item-types',
    title: 'Filter by item type',
    body: 'Tick one or more types to narrow every chart to them; All clears the filter. Each checkbox takes its type’s colour, so the row doubles as the chart key. Try it now.',
    scene: { screen: 'analysis', id: 'cycle-time' },
    target: 'item-types',
  },
  {
    id: 'aging-wip',
    title: 'Aging Work In Progress',
    body: 'Each dot is an item still open, placed by how long it has been running, against the percentiles of finished work. An item climbing past the 85th line needs a conversation.',
    scene: { screen: 'analysis', id: 'aging-wip' },
    target: 'analysis-panel',
  },
  {
    id: 'process-behaviour',
    title: 'Process Behaviour Chart',
    body: 'Cycle times in the order items finished, with a central line and natural process limits. A point outside the limits is a signal worth investigating; points inside are routine variation.',
    scene: { screen: 'analysis', id: 'process-behaviour' },
    target: 'analysis-panel',
  },
  {
    id: 'sprint-length',
    title: 'Show sprint length',
    body: 'Show sprint length draws your sprint as a line across the chart and counts the items that finished within it. Set the length in days alongside; Explainer covers how to read it. The tour has ticked it for you.',
    scene: { screen: 'analysis', id: 'process-behaviour' },
    target: 'sprint-length',
    ensure: { target: 'sprint-toggle', state: 'on' },
  },
  {
    id: 'correlation',
    title: 'Correlation Analysis',
    body: 'Each marker spans the shortest to longest cycle time for one estimate value. When the spans overlap heavily, estimates aren’t predicting how long work takes.',
    scene: { screen: 'analysis', id: 'correlation' },
    target: 'analysis-panel',
  },
  {
    id: 'monte-carlo-how-many',
    title: 'Monte Carlo: How many?',
    body: 'Pick a date and the simulation replays your daily throughput thousands of times to forecast how many items you’ll finish by then, at 50%, 85% and 95% confidence.',
    scene: { screen: 'analysis', id: 'monte-carlo' },
    target: 'analysis-panel',
    ensure: { target: 'mc-mode', state: 'how-many' },
  },
  {
    id: 'monte-carlo-when',
    title: 'Monte Carlo: When?',
    body: 'This switch asks the opposite question: enter how many items you want, and the forecast gives the dates you’re likely to have them by. Calendar lays those odds out day by day.',
    scene: { screen: 'analysis', id: 'monte-carlo' },
    target: 'mc-mode',
    ensure: { target: 'mc-mode', state: 'when' },
  },
  {
    id: 'done',
    title: 'That’s the tour',
    body: 'Finish puts back whatever you had open. Take the tour again any time from Tour in the header.',
    scene: { screen: 'analysis', id: 'monte-carlo' },
  },
]
