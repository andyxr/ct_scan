'use client'

import { useMemo, useRef, useState, useEffect, type SyntheticEvent } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts'
import { detectColumns, toWorkItems, percentile, formatDate, type WorkItem } from '@/lib/csv'
import {
  DEFAULT_SLE_DAYS,
  DEFAULT_SLE_PERCENTILE,
  MIN_ITEMS_FOR_ASSESSMENT,
  SLE_STATUS,
  assessSle,
  percentileName,
  tailContribution,
  typeBreakdown,
  type SleAssessment,
  type SlePercentile,
  type TailContribution,
  type TypeBreakdown,
} from '@/lib/sle'
import { TREND_WINDOW_SIZE, TREND_WINDOW_STEP, sleTrend, type SleTrend } from '@/lib/sleTrend'
import TypeColourControl from './TypeColourControl'
import SprintLengthControl, { DEFAULT_SPRINT_DAYS } from './SprintLengthControl'
import SleControl from './SleControl'
import ExportPngButton from './ExportPngButton'
import ChartViewToggle, { ChartView, useEscapeToRestore } from './ChartViewToggle'

interface CycleTimeAnalysisProps {
  data: any[]
  /** Colour per item type, keyed by the file's full type list. Absent for files with no item_type column. */
  typeColours?: Record<string, string>
  onTypeColourChange?: (type: string, colour: string) => void
  onResetTypeColours?: () => void
}

interface ProcessedDataPoint {
  key: string
  endDate: number
  cycleTime: number
  itemName: string
  itemId: string
  originalEndDate: string
  itemType: string
}

/** One mark on the scatterplot. Several items can share a date and cycle time. */
interface PlotPoint {
  key: string
  endDate: number
  cycleTime: number
  originalEndDate: string
  itemIds: string[]
  fill: string
}

/** A committed zoom window on the X axis, as epoch ms. */
interface ZoomRange {
  left: number
  right: number
}

/**
 * Below this span a drag counts as a click, not a selection.
 *
 * Measured in milliseconds of the date axis rather than screen pixels, because
 * the drag handlers only ever see axis values. Half a day is small enough that
 * no deliberate selection lands under it, and large enough to absorb the jitter
 * of a click that moves a pixel or two.
 */
const CLICK_SPAN_MS = 12 * 60 * 60 * 1000

/** Shared by the chart and the pixel-to-date mapping, which must agree on the plot area. */
const CHART_MARGIN = { top: 20, right: 136, bottom: 60, left: 60 }

/** Keep points and percentile labels off the plot edge, where Recharts clips them. */
function paddedDomain(left: number, right: number): [number, number] {
  const span = Math.max(right - left, 1)
  const pad = span * 0.05
  return [left - pad, right + pad]
}

/**
 * Horizontal percentile lines drawn on the scatterplot.
 *
 * 85th stays the original blue dashed line. The others use different hues and
 * dash patterns so they remain separable from each other and from the optional
 * sprint (amber) and average (purple) overlays.
 */
const PERCENTILE_LINES = [
  { p: 0.50, name: '50th', stroke: '#4b5563', dash: '2 4' },
  { p: 0.75, name: '75th', stroke: '#0d9488', dash: '8 3' },
  { p: 0.85, name: '85th', stroke: '#2563eb', dash: '5 5' },
  { p: 0.95, name: '95th', stroke: '#be123c', dash: '12 4' },
] as const

/** Resting thickness of a percentile line, in px. The throb keyframes scale off this. */
const PERCENTILE_STROKE = 2
/**
 * Invisible hover target laid over each percentile line.
 *
 * A 2px line is far too thin to hit with a mouse, so the shape draws a wide
 * transparent companion along the same geometry and hangs the pointer handlers
 * off that instead.
 */
const PERCENTILE_HIT_STROKE = 14

/**
 * Custom shape for a percentile ReferenceLine: the visible dashed line plus a
 * fat transparent one that catches the pointer.
 *
 * Recharts hands the shape its resolved endpoints, so both lines share exactly
 * the geometry the chart already computed. The dash pattern is dropped from the
 * hit line: a dashed stroke only registers hits on its dashes, leaving gaps the
 * pointer falls through.
 */
function PercentileLineShape({
  x1,
  y1,
  x2,
  y2,
  stroke,
  dash,
  active,
  onEnter,
  onLeave,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  stroke: string
  dash: string
  active: boolean
  onEnter: () => void
  onLeave: () => void
}) {
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={stroke}
        strokeDasharray={dash}
        strokeWidth={PERCENTILE_STROKE}
        className={`percentile-line${active ? ' percentile-line--active' : ''}`}
        style={{ ['--throb-base' as string]: PERCENTILE_STROKE }}
      />
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={PERCENTILE_HIT_STROKE}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      />
    </g>
  )
}

const DEFAULT_POINT_COLOUR = '#22c55e'
/** Stacked items of more than one type, so no swatch colour would be honest. */
const MIXED_TYPE_COLOUR = '#374151'

function startOfDayMs(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Calendar-day arithmetic, so a step never drifts an hour across a DST boundary. */
function addDays(ms: number, days: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
}

const DAY_MS = 24 * 60 * 60 * 1000
const TICK_TARGET = 8
/** Day steps a reader can hold in their head: days, then part-weeks, weeks, months, quarters. */
const TICK_STEPS_DAYS = [1, 2, 3, 7, 14, 28, 56, 91, 182, 364]

/**
 * Evenly spaced, day-aligned ticks across the visible date span.
 *
 * Recharts will not produce these on its own. On a horizontal chart the X axis
 * is the categorical one, and a categorical axis carrying a dataKey takes its
 * ticks straight from the data values, whatever its type and scale. So the
 * labels landed on completion dates rather than on regular intervals, and once
 * the collision filter had thinned a clustered set of them, long stretches of
 * the axis carried no label at all.
 */
function dateTicks([min, max]: [number, number]): number[] {
  const span = max - min
  if (span <= 0) return [startOfDayMs(min)]

  const stepDays = TICK_STEPS_DAYS.find(days => span / (days * DAY_MS) <= TICK_TARGET)
    ?? Math.ceil(span / DAY_MS / TICK_TARGET)

  const first = startOfDayMs(min) >= min ? startOfDayMs(min) : addDays(startOfDayMs(min), 1)
  const ticks: number[] = []
  for (let tick = first; tick <= max; tick = addDays(tick, stepDays)) ticks.push(tick)

  // A span too short to contain two day boundaries still needs its ends labelled.
  return ticks.length >= 2 ? ticks : [min, max]
}

function radiusForCount(count: number): number {
  if (count <= 1) return 5
  return 5 + 3 * Math.sqrt(count)
}

function colourForItems(items: ProcessedDataPoint[], typeColours?: Record<string, string>): string {
  if (!typeColours || Object.keys(typeColours).length < 2) return DEFAULT_POINT_COLOUR
  const type = items[0].itemType
  if (items.some(item => item.itemType !== type)) return MIXED_TYPE_COLOUR
  return typeColours[type] ?? DEFAULT_POINT_COLOUR
}

function groupPlotPoints(items: ProcessedDataPoint[], typeColours?: Record<string, string>): PlotPoint[] {
  const groups = new Map<string, ProcessedDataPoint[]>()
  for (const item of items) {
    const key = `${item.endDate}|${item.cycleTime}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(item)
    else groups.set(key, [item])
  }

  return [...groups.values()]
    .map(bucket => {
      const first = bucket[0]
      return {
        key: `${first.endDate}-${first.cycleTime}`,
        endDate: first.endDate,
        cycleTime: first.cycleTime,
        originalEndDate: first.originalEndDate,
        itemIds: bucket.map(item => item.itemId),
        fill: colourForItems(bucket, typeColours),
      }
    })
    .sort((a, b) => a.itemIds.length - b.itemIds.length)
}

/**
 * Recharts hands `shape` a props bag it types as `unknown`, so the positioning
 * fields are narrowed here rather than declared. `activeKey` is ours, passed by
 * the caller, so it is declared normally.
 *
 * Must always return an element: `null` is not an Element, hence the empty
 * `<g />` for a point Recharts has not finished positioning.
 */
function ScatterDot({ activeKey, ...props }: { activeKey?: string | null; [key: string]: unknown }) {
  const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: PlotPoint }
  if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) return <g />
  return (
    <circle
      cx={cx}
      cy={cy}
      r={radiusForCount(payload.itemIds.length)}
      fill={payload.fill}
      className={`scatter-dot${activeKey === payload.key ? ' scatter-dot--active' : ''}`}
    />
  )
}

function CycleTimeTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: PlotPoint }>
}) {
  if (!active || !payload?.[0]?.payload) return null
  const point = payload[0].payload
  return (
    <div className="bg-white p-3 border-2 border-gray-300 rounded shadow-lg max-h-64 overflow-y-auto">
      {point.itemIds.map((id, index) => (
        <p key={`${id}-${index}`} className="font-bold text-blue-600">{id}</p>
      ))}
      <p className="font-semibold text-lg text-gray-900 mt-1">{point.cycleTime} days</p>
      <p className="text-xs text-gray-500 mt-1">Completed: {point.originalEndDate}</p>
    </div>
  )
}

interface SleReport {
  assessment: SleAssessment
  tail: TailContribution
  types: TypeBreakdown[]
  trend: SleTrend
  medianDays: number
}

function buildSleReport(items: WorkItem[], targetDays: number, targetPercentile: SlePercentile): SleReport {
  return {
    assessment: assessSle(items, targetDays, targetPercentile),
    tail: tailContribution(items, targetDays),
    types: typeBreakdown(items, targetDays, targetPercentile),
    trend: sleTrend(items, targetPercentile),
    medianDays: percentile(items.map(item => item.cycleTime), 0.5),
  }
}

function trendFinding(trend: SleTrend, name: string): string {
  const windows = trend.windows.length
  switch (trend.direction) {
    case 'improving':
      return `The ${name} percentile is falling by ${Math.abs(trend.slope).toFixed(1)} days per ${TREND_WINDOW_STEP} completions across the last ${windows} windows of ${TREND_WINDOW_SIZE} items.`
    case 'worsening':
      return `The ${name} percentile is rising by ${trend.slope.toFixed(1)} days per ${TREND_WINDOW_STEP} completions across the last ${windows} windows of ${TREND_WINDOW_SIZE} items.`
    case 'flat':
      return `The ${name} percentile has been flat across the last ${windows} windows of ${TREND_WINDOW_SIZE} items.`
    case 'not-enough-data':
      return `No trend yet. ${trend.reason}`
  }
}

function sleFindings({ assessment, tail, types, trend, medianDays }: SleReport): string[] {
  const { status, targetDays, gapDays, itemCount } = assessment
  const name = percentileName(assessment.targetPercentile)
  const findings: string[] = []

  if (status === 'insufficient') {
    findings.push(`Only ${itemCount} items. At least ${MIN_ITEMS_FOR_ASSESSMENT} are needed before the data can say anything about this SLE.`)
  }

  if (status === 'marginal' && gapDays <= 0) {
    const { low, high } = assessment.hitRateInterval
    findings.push(`The ${name} percentile is inside the target, but with ${itemCount} items the true hit rate could be anywhere from ${Math.round(low * 100)}% to ${Math.round(high * 100)}%, so this is not yet a confirmed pass.`)
  }

  if (status === 'marginal' || status === 'fail') {
    if (gapDays > 0) {
      findings.push(`Trim ${gapDays.toFixed(1)} days off the ${name} percentile to meet the SLE.`)
    }
    if (tail.breachCount > 0) {
      findings.push(tail.concentrated
        ? `${tail.worstK} of the ${tail.breachCount} items over target account for half the total overrun past the SLE. A few outliers drive the miss.`
        : `The overrun past the SLE is spread across all ${tail.breachCount} breaching items. No small group of outliers explains it.`)
    }
    if (types.length >= 2) {
      const worst = types[0]
      const best = types[types.length - 1]
      if (worst.percentileDays - best.percentileDays >= 2) {
        findings.push(`${worst.itemType} items reach ${worst.percentileDays.toFixed(1)} days at the ${name} percentile, against ${best.percentileDays.toFixed(1)} for ${best.itemType}.`)
      }
    }
    if (medianDays > targetDays) {
      findings.push('The whole distribution sits above the target, not just the tail.')
    } else if (gapDays > 0 && targetDays - medianDays > gapDays / 2) {
      findings.push('Most items are well inside the target; the miss comes from a long tail.')
    }
  }

  findings.push(trendFinding(trend, name))
  return findings
}

function sleSummary({ status, targetDays, targetPercentile, actualDays, gapDays, hitCount, itemCount, hitRate }: SleAssessment): string {
  const finished = `${hitCount} of ${itemCount} (${Math.round(hitRate * 100)}%) finished within ${targetDays} days.`
  if (status === 'insufficient') {
    return `Only ${itemCount} items, so the SLE cannot be assessed; at least ${MIN_ITEMS_FOR_ASSESSMENT} are needed. ${finished}`
  }
  const percent = Math.round(targetPercentile * 100)
  const gap = gapDays > 0
    ? `${gapDays.toFixed(1)} days over it`
    : `${Math.abs(gapDays).toFixed(1)} days inside it`
  return `${percent}% of items finish within ${actualDays.toFixed(1)} days. Your SLE asks for ${targetDays}, so you are ${gap}. ${finished}`
}

const GENERAL_GUIDANCE = [
  'Limit work in progress so items finish before new ones start.',
  'Split large items before starting them.',
  'Look at where items wait rather than where they are worked.',
]

function ordinal(n: number) {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${suffix}`
}

export default function CycleTimeAnalysis({
  data,
  typeColours,
  onTypeColourChange,
  onResetTypeColours,
}: CycleTimeAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [showSprint, setShowSprint] = useState(false)
  const [showAverage, setShowAverage] = useState(false)
  const [sprintDays, setSprintDays] = useState(DEFAULT_SPRINT_DAYS)
  const [showSle, setShowSle] = useState(false)
  const [sleDays, setSleDays] = useState(DEFAULT_SLE_DAYS)
  const [slePercentile, setSlePercentile] = useState<SlePercentile>(DEFAULT_SLE_PERCENTILE)
  const [hoveredPercentile, setHoveredPercentile] = useState<string | null>(null)
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null)
  const [view, setView] = useState<ChartView>('normal')
  const [zoom, setZoom] = useState<ZoomRange | null>(null)
  /**
   * The two edges of an in-progress drag. Null when no drag is under way.
   *
   * Held in a ref as well as state: the handlers fire faster than React commits,
   * so a quick flick of the mouse would see a stale `dragStart` of null, drop
   * every move, and the gesture would be mistaken for a click. The ref is the
   * source of truth for the handlers; the state only drives the selection rectangle.
   */
  const dragEdges = useRef<{ start: number; end: number } | null>(null)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)
  const maximised = view === 'maximised'
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // A zoom held across a change of data can frame a window with nothing in it,
  // so drop it and show the new file or filter in full.
  useEffect(() => {
    setZoom(null)
  }, [data])

  useEscapeToRestore(view, () => setView('normal'))

  const { items, processedData, percentileLines, stats, dataExtent } = useMemo(() => {
    const columns = detectColumns(data)
    const items = toWorkItems(data, columns)

    const processed: ProcessedDataPoint[] = items.map((item, index) => ({
      key: `${item.id}-${index}`,
      endDate: startOfDayMs(item.endDate),
      cycleTime: item.cycleTime,
      itemName: item.id,
      itemId: item.id,
      originalEndDate: item.originalEndDate,
      itemType: item.itemType,
    }))

    const cycleTimes = processed.map(item => item.cycleTime)
    const percentileLines = PERCENTILE_LINES.map(line => ({
      ...line,
      value: percentile(cycleTimes, line.p),
    }))
    const p85 = percentileLines.find(line => line.p === 0.85)?.value ?? 0
    const average = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length || 0
    const averagePercentile = cycleTimes.length
      ? Math.round((cycleTimes.filter(ct => ct <= average).length / cycleTimes.length) * 100)
      : 0

    // toWorkItems returns items oldest-first, so the extent is just the ends.
    const dates = processed.map(item => item.endDate)

    return {
      items,
      processedData: processed,
      percentileLines,
      dataExtent: {
        min: dates.length ? Math.min(...dates) : 0,
        max: dates.length ? Math.max(...dates) : 0,
      },
      stats: {
        count: processed.length,
        average,
        averagePercentile,
        min: cycleTimes.length ? Math.min(...cycleTimes) : 0,
        max: cycleTimes.length ? Math.max(...cycleTimes) : 0,
        p85,
      },
    }
  }, [data])

  const plotPoints = useMemo(
    () => groupPlotPoints(processedData, typeColours),
    [processedData, typeColours],
  )

  const sle = useMemo(
    () => buildSleReport(items, sleDays, slePercentile),
    [items, sleDays, slePercentile],
  )
  const sleStatus = SLE_STATUS[sle.assessment.status]
  const sleName = percentileName(slePercentile)

  const withinSprint = processedData.filter(item => item.cycleTime <= sprintDays).length
  const daysAt = (p: number) =>
    (percentileLines.find(line => line.p === p)?.value ?? 0).toFixed(1)
  const xDomain = useMemo(
    () => zoom
      ? paddedDomain(zoom.left, zoom.right)
      : paddedDomain(dataExtent.min, dataExtent.max),
    [zoom, dataExtent.min, dataExtent.max],
  )
  const xTicks = useMemo(() => dateTicks(xDomain), [xDomain])

  const formatXAxis = (tickItem: number) => formatDate(tickItem)

  /**
   * Turn a chart mouse event into a date on the X axis.
   *
   * Recharts derives the first argument's `activeLabel` and `activeCoordinate`
   * from its tooltip selectors, so on a scatter chart with no active tooltip
   * both are undefined — useless for a free drag. The second argument is the
   * real DOM event, so we take its clientX and map it across the plot area
   * ourselves using the axis extent and the chart margins.
   */
  const dateAtCursor = (mouseEvent: SyntheticEvent | undefined): number | null => {
    const clientX = (mouseEvent as MouseEvent | undefined)?.clientX
    if (typeof clientX !== 'number' || !chartRef.current) return null

    // Measured from the rendered grid, which Recharts draws exactly on the plot
    // area. The chart margin alone is not the plot origin: the Y axis and its
    // rotated label sit inside the margin box, so assuming it shifts every
    // reading left and the selected dates drift off the cursor.
    const grid = chartRef.current.querySelector('.recharts-cartesian-grid')
    if (!grid) return null

    const plot = grid.getBoundingClientRect()
    if (plot.width <= 0) return null

    const [min, max] = xDomain
    if (max <= min) return null

    const ratio = (clientX - plot.left) / plot.width
    const clamped = Math.min(1, Math.max(0, ratio))
    return min + clamped * (max - min)
  }

  /**
   * Drag across the plot to zoom the date axis; click to restore the full span.
   *
   * Both gestures resolve in onMouseUp rather than splitting the click across
   * Recharts' onClick, which also fires at the end of a drag and would throw
   * away the selection the user just made.
   */
  const handleMouseDown = (_state: unknown, event: SyntheticEvent) => {
    const value = dateAtCursor(event)
    if (value === null) return
    dragEdges.current = { start: value, end: value }
    setDragStart(value)
    setDragEnd(value)
  }

  const handleMouseMove = (_state: unknown, event: SyntheticEvent) => {
    if (dragEdges.current === null) return
    const value = dateAtCursor(event)
    if (value === null) return
    dragEdges.current.end = value
    setDragEnd(value)
  }

  const handleMouseUp = () => {
    const edges = dragEdges.current
    dragEdges.current = null

    if (edges === null) {
      setDragStart(null)
      setDragEnd(null)
      return
    }

    // Normalised so a right-to-left drag selects the same window as left-to-right.
    const left = Math.min(edges.start, edges.end)
    const right = Math.max(edges.start, edges.end)

    setDragStart(null)
    setDragEnd(null)
    setZoom(right - left < CLICK_SPAN_MS ? null : { left, right })
  }

  return (
    <div className={maximised
      ? 'fixed inset-0 z-40 overflow-auto bg-white p-6 pt-20 flex flex-col'
      : 'bg-white rounded-lg shadow p-6'}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Cycle Time Analysis</h2>
        <div className="flex items-center gap-2">
          {isMounted && processedData.length > 0 && (
            <ExportPngButton targetRef={chartRef} filename="cycle-time-analysis.png" />
          )}
          <ChartViewToggle view={view} onChange={setView} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6">
        <SprintLengthControl
          enabled={showSprint}
          days={sprintDays}
          withinCount={withinSprint}
          totalCount={processedData.length}
          onToggle={setShowSprint}
          onDaysChange={setSprintDays}
        />
        <SleControl
          enabled={showSle}
          days={sleDays}
          percentile={slePercentile}
          status={sle.assessment.status}
          onToggle={setShowSle}
          onDaysChange={setSleDays}
          onPercentileChange={setSlePercentile}
        />
        <label className="flex items-center gap-2 mb-4 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showAverage}
            onChange={e => setShowAverage(e.target.checked)}
            className="h-4 w-4 accent-purple-500"
          />
          Show average
        </label>
        {zoom && (
          <span className="flex items-center gap-2 mb-4 text-sm text-gray-700">
            Zoomed: {formatDate(zoom.left)} – {formatDate(zoom.right)}
            <button
              onClick={() => setZoom(null)}
              className="text-gray-600 hover:text-gray-900 underline"
            >
              Reset zoom
            </button>
          </span>
        )}
      </div>

      {typeColours && onTypeColourChange && onResetTypeColours && (
        <TypeColourControl
          types={Object.keys(typeColours)}
          colours={typeColours}
          onChange={onTypeColourChange}
          onReset={onResetTypeColours}
        />
      )}

      <div ref={chartRef} className={maximised ? 'flex-1 min-h-[16rem] w-full select-none' : 'h-[48rem] w-full select-none'}>
        {isMounted && processedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={CHART_MARGIN}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="endDate"
                type="number"
                scale="time"
                // allowDataOverflow is what makes the zoom stick: without it the
                // domain is widened back out to fit every point.
                allowDataOverflow
                domain={xDomain}
                ticks={xTicks}
                tickFormatter={formatXAxis}
                label={{ value: 'End Date', position: 'insideBottom', offset: -10 }}
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                dataKey="cycleTime"
                // The SLE is a target, not data, so it has to be pulled into the range or it draws off the chart.
                domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, showSle ? sleDays : 0) * 1.08)]}
                label={{ value: 'Cycle Time (days)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280' } }}
                tick={{ fill: '#6b7280' }}
              />
              <Tooltip content={<CycleTimeTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              {percentileLines.map(line => (
                <ReferenceLine
                  key={line.name}
                  y={line.value}
                  stroke={line.stroke}
                  strokeWidth={PERCENTILE_STROKE}
                  strokeDasharray={line.dash}
                  ifOverflow="visible"
                  shape={(props: any) => (
                    <PercentileLineShape
                      {...props}
                      stroke={line.stroke}
                      dash={line.dash}
                      active={hoveredPercentile === line.name}
                      onEnter={() => setHoveredPercentile(line.name)}
                      onLeave={() => setHoveredPercentile(null)}
                    />
                  )}
                  label={{
                    value: `${line.name} (${line.value.toFixed(1)}d)`,
                    position: 'right',
                    fill: line.stroke,
                  }}
                />
              ))}
              {showAverage && (
                <ReferenceLine
                  y={stats.average}
                  stroke="#9333ea"
                  strokeWidth={2}
                  strokeDasharray="2 4"
                  label={{ value: `Average (${stats.average.toFixed(1)}d) = ${ordinal(stats.averagePercentile)} percentile`, position: "insideTopRight", fill: '#9333ea' }}
                />
              )}
              {showSprint && (
                <ReferenceLine
                  y={sprintDays}
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  label={{ value: `Sprint (${sprintDays}d)`, position: "insideTopLeft", fill: '#d97706' }}
                />
              )}
              {showSle && (
                <ReferenceLine
                  y={sleDays}
                  stroke={sleStatus.stroke}
                  strokeWidth={3}
                  strokeDasharray="6 3"
                  ifOverflow="visible"
                  label={{ value: `SLE ${sleDays}d @ ${sleName}`, position: 'insideBottomRight', fill: sleStatus.stroke }}
                />
              )}
              {dragStart !== null && dragEnd !== null && dragStart !== dragEnd && (
                <ReferenceArea
                  x1={dragStart}
                  x2={dragEnd}
                  fill="#2563eb"
                  fillOpacity={0.1}
                  strokeOpacity={0}
                />
              )}
              <Scatter
                name="Cycle time"
                data={plotPoints}
                dataKey="cycleTime"
                shape={(props: unknown) => <ScatterDot {...(props as object)} activeKey={hoveredPoint} />}
                isAnimationActive={false}
                onMouseEnter={(point: unknown) => setHoveredPoint((point as PlotPoint)?.key ?? null)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-500">
              {!isMounted ? 'Loading chart...' : 'No data to display'}
            </p>
            {!isMounted && (
              <p className="text-xs text-gray-400 mt-2">Chart data: {processedData.length} items</p>
            )}
          </div>
        )}
      </div>

      {!maximised && (
        <div className="mt-4 text-sm text-gray-600">
          {showSle ? (
            <p>{sleSummary(sle.assessment)}</p>
          ) : (
            <p>
              50% of items finish within {daysAt(0.5)} days, 75% within {daysAt(0.75)}, 85% within {daysAt(0.85)}, and 95% within {daysAt(0.95)}.
            </p>
          )}
          {showAverage && (
            <p>The average cycle time is {stats.average.toFixed(1)} days, which sits at the {ordinal(stats.averagePercentile)} percentile. A forecast based on the average would be right for only {stats.averagePercentile}% of items.</p>
          )}
        </div>
      )}

      {!maximised && showSle && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-gray-700">
          <h3 className="font-semibold text-gray-900 mb-2">What the data says</h3>
          <ul className="list-disc pl-5 space-y-1">
            {sleFindings(sle).map(finding => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
          <div className="mt-3 p-4 bg-white border border-gray-300 rounded-lg">
            <h4 className="font-semibold text-gray-900">General guidance</h4>
            <p className="text-xs text-gray-500 mb-2">Not derived from your data.</p>
            <ul className="list-disc pl-5 space-y-1">
              {GENERAL_GUIDANCE.map(line => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}