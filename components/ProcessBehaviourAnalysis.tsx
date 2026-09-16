'use client'

import { useMemo, useRef, useState, useEffect, type SyntheticEvent } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts'
import { detectColumns, toWorkItems, percentile } from '@/lib/csv'
import { SHEET_INK } from '@/lib/colours'
import Reading from './Reading'
import SprintLengthControl, { DEFAULT_SPRINT_DAYS } from './SprintLengthControl'
import SprintExplainerModal from './SprintExplainerModal'
import ExportPngButton from './ExportPngButton'
import ChartViewToggle, { ChartView, useEscapeToRestore } from './ChartViewToggle'

interface ProcessBehaviourAnalysisProps {
  data: any[]
}

interface ProcessDataPoint {
  key: string
  sequence: number
  cycleTime: number
  movingRange: number | null
  itemName: string
  itemId: string
  originalEndDate: string
  isSpecialCause: boolean
  signals: string[]
}

interface ProcessStats {
  centralLine: number
  upperProcessLimit: number
  lowerProcessLimit: number
  averageMovingRange: number
  medianMovingRange: number
  upperRangeLimit: number
  limitMethod: 'median' | 'average'
  totalItems: number
  specialCauseCount: number
  p85: number
  outsideLimitsCount: number
  runSignalCount: number
}

const RUN_LENGTH = 8

/** A committed zoom window on the sequence axis, as inclusive item numbers. */
interface ZoomRange {
  from: number
  to: number
}

/**
 * Below this span a drag counts as a click, not a selection.
 *
 * Measured in sequence positions: a selection has to cover at least a couple of
 * items to be worth zooming to, and anything narrower is a stray click.
 */
const CLICK_SPAN_ITEMS = 2

/** Shared by both charts and the pixel-to-sequence mapping, which must agree on the plot area. */
const CHART_MARGIN = { top: 20, right: 30, left: 20, bottom: 20 }

/**
 * Wheeler's rule 2: a run of RUN_LENGTH successive points all on one side of
 * the centre line. Returns the index of every point that belongs to such a run.
 */
function runSignalIndices(values: number[], centralLine: number): Set<number> {
  const flagged = new Set<number>()
  let runStart = 0
  const side = (v: number) => Math.sign(v - centralLine)
  for (let i = 1; i <= values.length; i++) {
    if (i === values.length || side(values[i]) !== side(values[runStart]) || side(values[i]) === 0) {
      if (i - runStart >= RUN_LENGTH && side(values[runStart]) !== 0) {
        for (let j = runStart; j < i; j++) flagged.add(j)
      }
      runStart = i
    }
  }
  return flagged
}

export default function ProcessBehaviourAnalysis({ data }: ProcessBehaviourAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [showSprint, setShowSprint] = useState(false)
  const [sprintDays, setSprintDays] = useState(DEFAULT_SPRINT_DAYS)
  const [explainerOpen, setExplainerOpen] = useState(false)
  const [view, setView] = useState<ChartView>('normal')
  const [zoom, setZoom] = useState<ZoomRange | null>(null)
  /**
   * The two edges of an in-progress drag, as sequence positions. Null when no
   * drag is under way.
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

  // Sequence numbers are positions in the current dataset, so a zoom held across
  // a change of data can point past the end of it and leave both charts blank.
  useEffect(() => {
    setZoom(null)
  }, [data])

  useEscapeToRestore(view, () => setView('normal'), explainerOpen)

  const { processedData, movingRangeData, stats } = useMemo(() => {
    const columns = detectColumns(data)
    const chronologicalData = toWorkItems(data, columns).map(item => ({
      endDate: item.endDate,
      cycleTime: item.cycleTime,
      itemId: item.id,
      itemName: item.id,
      originalEndDate: item.originalEndDate,
    }))

    if (chronologicalData.length === 0) {
      return {
        processedData: [],
        movingRangeData: [],
        stats: {
          centralLine: 0,
          upperProcessLimit: 0,
          lowerProcessLimit: 0,
          averageMovingRange: 0,
          medianMovingRange: 0,
          upperRangeLimit: 0,
          limitMethod: 'median' as const,
          totalItems: 0,
          specialCauseCount: 0,
          p85: 0,
          outsideLimitsCount: 0,
          runSignalCount: 0
        }
      }
    }

    const cycleTimes = chronologicalData.map(item => item.cycleTime)
    const centralLine = cycleTimes.reduce((sum, ct) => sum + ct, 0) / cycleTimes.length

    const movingRanges: number[] = []
    for (let i = 1; i < cycleTimes.length; i++) {
      movingRanges.push(Math.abs(cycleTimes[i] - cycleTimes[i - 1]))
    }

    const averageMovingRange = movingRanges.length > 0
      ? movingRanges.reduce((sum, mr) => sum + mr, 0) / movingRanges.length
      : 0
    const sortedRanges = [...movingRanges].sort((a, b) => a - b)
    const medianMovingRange = sortedRanges.length > 0
      ? sortedRanges.length % 2 === 1
        ? sortedRanges[(sortedRanges.length - 1) / 2]
        : (sortedRanges[sortedRanges.length / 2 - 1] + sortedRanges[sortedRanges.length / 2]) / 2
      : 0

    // Cycle time is right-skewed, and one extreme item inflates the average
    // moving range enough to hide everything else. Wheeler's median moving range
    // method (3.145 and 3.865 in place of 2.66 and 3.27) resists that. When more
    // than half the moving ranges are zero the median collapses, so fall back.
    const limitMethod: ProcessStats['limitMethod'] = medianMovingRange > 0 ? 'median' : 'average'
    const sigmaSpan = limitMethod === 'median' ? 3.145 * medianMovingRange : 2.66 * averageMovingRange
    const upperRangeLimit = limitMethod === 'median' ? 3.865 * medianMovingRange : 3.27 * averageMovingRange

    const upperProcessLimit = centralLine + sigmaSpan
    const lowerProcessLimit = Math.max(0, centralLine - sigmaSpan)

    const runFlags = runSignalIndices(cycleTimes, centralLine)

    const processedDataPoints: ProcessDataPoint[] = chronologicalData.map((item, index) => {
      const signals: string[] = []
      if (item.cycleTime > upperProcessLimit || item.cycleTime < lowerProcessLimit) signals.push('Outside process limits')
      if (runFlags.has(index)) signals.push(`Run of ${RUN_LENGTH}+ on one side of the centre line`)

      return {
        key: `${item.itemId}-${index}`,
        sequence: index + 1,
        cycleTime: item.cycleTime,
        movingRange: index > 0 ? movingRanges[index - 1] : null,
        itemName: item.itemName,
        itemId: item.itemId,
        originalEndDate: item.originalEndDate,
        isSpecialCause: signals.length > 0,
        signals,
      }
    })

    // Create moving range chart data
    const movingRangePoints = movingRanges.map((mr, index) => ({
      key: `mr-${index}`,
      sequence: index + 2, // Moving range starts from 2nd point
      movingRange: mr,
    }))

    const specialCauseCount = processedDataPoints.filter(point => point.isSpecialCause).length

    return {
      processedData: processedDataPoints,
      movingRangeData: movingRangePoints,
      stats: {
        centralLine,
        upperProcessLimit,
        lowerProcessLimit,
        averageMovingRange,
        medianMovingRange,
        upperRangeLimit,
        limitMethod,
        totalItems: processedDataPoints.length,
        specialCauseCount,
        p85: percentile(cycleTimes, 0.85),
        outsideLimitsCount: cycleTimes.filter(ct => ct > upperProcessLimit || ct < lowerProcessLimit).length,
        runSignalCount: runFlags.size
      }
    }
  }, [data])

  const withinSprint = processedData.filter(point => point.cycleTime <= sprintDays).length

  /**
   * The points each chart draws. Filtering the arrays rather than setting an axis
   * domain, because the sequence axis is a category axis and ignores a numeric
   * domain. The limits in `stats` are computed over the whole dataset in the memo
   * above, so narrowing these arrays never moves CL, UPL, LPL or the signal counts.
   */
  const visibleData = useMemo(
    () => (zoom ? processedData.filter(p => p.sequence >= zoom.from && p.sequence <= zoom.to) : processedData),
    [processedData, zoom]
  )
  const visibleMovingRangeData = useMemo(
    () => (zoom ? movingRangeData.filter(p => p.sequence >= zoom.from && p.sequence <= zoom.to) : movingRangeData),
    [movingRangeData, zoom]
  )

  /**
   * Turn a chart mouse event into a sequence position.
   *
   * Recharts derives the first argument's `activeLabel` from its tooltip
   * selectors, so it is unreliable mid-drag. The second argument is the real DOM
   * event, so we take its clientX and map it across the plot area ourselves.
   */
  const sequenceAtCursor = (mouseEvent: SyntheticEvent | undefined): number | null => {
    const clientX = (mouseEvent as MouseEvent | undefined)?.clientX
    if (typeof clientX !== 'number' || !chartRef.current) return null

    // Measured from the rendered grid, which Recharts draws exactly on the plot
    // area. The chart margin alone is not the plot origin: the Y axis and its
    // rotated label sit inside the margin box, so assuming it puts every reading
    // about a pixel-per-item too far left, and the axis ticks drift by 1-2.
    const grid = chartRef.current.querySelector('.recharts-cartesian-grid')
    if (!grid) return null

    const plot = grid.getBoundingClientRect()
    if (plot.width <= 0) return null

    const [first, last] = zoom
      ? [zoom.from, zoom.to]
      : [1, processedData.length]
    if (last <= first) return null

    const ratio = (clientX - plot.left) / plot.width
    const clamped = Math.min(1, Math.max(0, ratio))
    return Math.round(first + clamped * (last - first))
  }

  /**
   * Drag across either chart to zoom both to that span of items; click to restore.
   *
   * Both gestures resolve in onMouseUp rather than splitting the click across
   * Recharts' onClick, which also fires at the end of a drag and would throw
   * away the selection the user just made.
   */
  const handleMouseDown = (_state: unknown, event: SyntheticEvent) => {
    const value = sequenceAtCursor(event)
    if (value === null) return
    dragEdges.current = { start: value, end: value }
    setDragStart(value)
    setDragEnd(value)
  }

  const handleMouseMove = (_state: unknown, event: SyntheticEvent) => {
    if (dragEdges.current === null) return
    const value = sequenceAtCursor(event)
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

    // Normalised so a right-to-left drag selects the same span as left-to-right.
    const from = Math.min(edges.start, edges.end)
    const to = Math.max(edges.start, edges.end)

    setDragStart(null)
    setDragEnd(null)
    setZoom(to - from < CLICK_SPAN_ITEMS ? null : { from, to })
  }

  const dragHandlers = {
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
  }

  const SpecialCauseDot = ({ cx, cy, payload }: any) => {
    if (cx === undefined || cy === undefined) return null
    const special = (payload as ProcessDataPoint).isSpecialCause
    return (
      <g>
        {special && <circle cx={cx} cy={cy} r={5} fill={SHEET_INK.red} className="signal-halo" />}
        <circle
          cx={cx}
          cy={cy}
          r={special ? 5 : 4}
          fill={special ? SHEET_INK.red : SHEET_INK.blue}
          stroke={special ? SHEET_INK.redDeep : SHEET_INK.ink}
          strokeWidth={2}
        />
      </g>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ProcessDataPoint
      return (
        <div className="bg-white p-4 border-2 border-gray-300 rounded shadow-lg">
          <p className="font-bold text-blue-600">ID: {data.itemId}</p>
          <p className="text-sm">
            <strong>Sequence:</strong> {data.sequence}
          </p>
          <p className="text-sm">
            <strong>Cycle Time:</strong> {data.cycleTime} days
          </p>
          {data.movingRange !== null && (
            <p className="text-sm">
              <strong>Moving Range:</strong> {data.movingRange.toFixed(1)}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Completed: {data.originalEndDate}
          </p>
          {data.signals.map(signal => (
            <p key={signal} className="text-xs text-red-600 font-semibold mt-1">
              ⚠ {signal}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const MovingRangeTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border-2 border-gray-300 rounded shadow-lg">
          <p className="text-sm">
            <strong>Sequence:</strong> {data.sequence}
          </p>
          <p className="text-sm">
            <strong>Moving Range:</strong> {data.movingRange.toFixed(2)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className={maximised
      ? 'fixed inset-0 z-40 flex flex-col overflow-auto bg-gray-50 p-6 pt-20'
      : 'sheet-panel p-6'}>
      <h2 className="text-2xl font-bold tracking-[0.08em] mb-4 text-gray-900">Process Behaviour Chart</h2>
      {!maximised && (
        <p className="text-gray-600 mb-6">
          Shows cycle times in chronological order with Shewhart control limits to identify common cause vs. special cause variation.
        </p>
      )}

      {/* Individual Values Chart */}
      <div className={maximised ? 'flex-1 flex flex-col min-h-0' : 'mb-8'}>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-gray-700">Individual Values (Cycle Times)</h3>
          <div className="flex items-center gap-2">
            {isMounted && processedData.length > 0 && (
              <ExportPngButton targetRef={chartRef} filename="process-behaviour-chart.png" />
            )}
            <ChartViewToggle view={view} onChange={setView} />
          </div>
        </div>
        <SprintLengthControl
          enabled={showSprint}
          days={sprintDays}
          withinCount={withinSprint}
          totalCount={processedData.length}
          onToggle={setShowSprint}
          onDaysChange={setSprintDays}
          onExplain={() => setExplainerOpen(true)}
        />
        {zoom && (
          <span className="flex items-center gap-2 mb-4 text-sm text-gray-700">
            Zoomed: items {zoom.from}–{zoom.to}
            <button
              onClick={() => setZoom(null)}
              className="text-gray-600 hover:text-gray-900 underline"
            >
              Reset zoom
            </button>
          </span>
        )}
        {explainerOpen && (
          <SprintExplainerModal
            facts={{
              sprintDays,
              centralLine: stats.centralLine,
              p85: stats.p85,
              upperProcessLimit: stats.upperProcessLimit,
              withinCount: withinSprint,
              totalCount: processedData.length,
              outsideLimitsCount: stats.outsideLimitsCount,
              runSignalCount: stats.runSignalCount,
            }}
            onClose={() => setExplainerOpen(false)}
          />
        )}
        <div ref={chartRef} className={maximised ? 'sheet-plot flex-1 min-h-[16rem] w-full select-none' : 'sheet-plot h-80 w-full select-none'}>
          {isMounted && processedData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={visibleData}
                margin={CHART_MARGIN}
                {...dragHandlers}>
                <CartesianGrid strokeDasharray="3 3" stroke={SHEET_INK.rule} />
                <XAxis
                  dataKey="sequence"
                  label={{ value: 'Sequence (Chronological Order)', position: 'insideBottom', offset: -10, fill: SHEET_INK.inkSoft }}
                  tick={{ fontSize: 12, fill: SHEET_INK.inkSoft }}
                />
                <YAxis
                  label={{ value: 'Cycle Time (days)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: SHEET_INK.inkSoft } }}
                  tick={{ fill: SHEET_INK.inkSoft }}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Control Lines */}
                <ReferenceLine
                  y={stats.upperProcessLimit}
                  stroke={SHEET_INK.red}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: "UPL", position: "top", offset: 5, fill: SHEET_INK.red }}
                />
                <ReferenceLine
                  y={stats.centralLine}
                  stroke={SHEET_INK.green}
                  strokeWidth={2}
                  label={{ value: "CL", position: "top", offset: 5, fill: SHEET_INK.green }}
                />
                <ReferenceLine
                  y={stats.lowerProcessLimit}
                  stroke={SHEET_INK.red}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  // Labelled above the line rather than below it: a lower limit of
                  // zero sits on the axis, and a `bottom` label there lands in the
                  // middle of the sequence ticks.
                  label={{ value: "LPL", position: "insideBottomLeft", offset: 6, fill: SHEET_INK.red }}
                />
                {showSprint && (
                  <ReferenceLine
                    y={sprintDays}
                    stroke={SHEET_INK.amber}
                    strokeWidth={2}
                    strokeDasharray="8 4"
                    label={{ value: `Sprint (${sprintDays}d)`, position: "insideTopLeft", fill: SHEET_INK.amber }}
                  />
                )}

                {dragStart !== null && dragEnd !== null && dragStart !== dragEnd && (
                  <ReferenceArea
                    x1={dragStart}
                    x2={dragEnd}
                    fill={SHEET_INK.blue}
                    fillOpacity={0.12}
                    strokeOpacity={0}
                  />
                )}

                {/* Main process line */}
                <Line
                  type="monotone"
                  dataKey="cycleTime"
                  stroke={SHEET_INK.blue}
                  strokeWidth={2}
                  dot={<SpecialCauseDot />}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-gray-500">
                {!isMounted ? 'Loading chart...' : 'No data to display'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Moving Range Chart */}
      {!maximised && (
      <div className="mb-6">
        <h3 className="sheet-heading text-sm font-bold uppercase tracking-[0.14em] mb-3 text-gray-700">Moving Range</h3>
        <div className="sheet-plot h-64 w-full select-none">
          {isMounted && movingRangeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={256}>
              <LineChart
                width={800}
                height={256}
                data={visibleMovingRangeData}
                margin={CHART_MARGIN}
                {...dragHandlers}>
                <CartesianGrid strokeDasharray="3 3" stroke={SHEET_INK.rule} />
                <XAxis
                  dataKey="sequence"
                  label={{ value: 'Sequence', position: 'insideBottom', offset: -10, fill: SHEET_INK.inkSoft }}
                  tick={{ fontSize: 12, fill: SHEET_INK.inkSoft }}
                />
                <YAxis
                  label={{ value: 'Moving Range', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: SHEET_INK.inkSoft } }}
                  tick={{ fill: SHEET_INK.inkSoft }}
                />
                <Tooltip content={<MovingRangeTooltip />} />

                <ReferenceLine
                  y={stats.upperRangeLimit}
                  stroke={SHEET_INK.red}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: "URL", position: "top", offset: 5, fill: SHEET_INK.red }}
                />
                <ReferenceLine
                  y={stats.limitMethod === 'median' ? stats.medianMovingRange : stats.averageMovingRange}
                  stroke={SHEET_INK.green}
                  strokeWidth={2}
                  label={{ value: stats.limitMethod === 'median' ? "Median mR" : "Average mR", position: "top", offset: 5, fill: SHEET_INK.green }}
                />

                <Line
                  type="monotone"
                  dataKey="movingRange"
                  stroke={SHEET_INK.amber}
                  strokeWidth={2}
                  dot={{ fill: SHEET_INK.amber, stroke: SHEET_INK.ink, strokeWidth: 1, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-gray-500">No moving range data available</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Statistics Summary */}
      {!maximised && stats.totalItems > 0 && (
        /* The readings taken off the chart, boxed as a form's result fields:
           hairline rules, mono figures, each ink meaning what it means
           everywhere else on the sheet. */
        <dl className="mt-6 grid grid-cols-2 border-l border-t border-gray-300 md:grid-cols-5">
          <Reading label="Total Items" value={String(stats.totalItems)} />
          <Reading label="Central Line" value={`${stats.centralLine.toFixed(1)} d`} ink="text-green-700" />
          <Reading
            label="Control Limits"
            value={`${stats.lowerProcessLimit.toFixed(1)} – ${stats.upperProcessLimit.toFixed(1)}`}
            ink="text-red-700"
          />
          <Reading
            label="Special Causes"
            value={String(stats.specialCauseCount)}
            ink={stats.specialCauseCount > 0 ? 'text-red-700' : undefined}
          />
          <Reading label="Upper Range Limit" value={stats.upperRangeLimit.toFixed(1)} />
        </dl>
      )}

      {!maximised && (
      <div className="mt-6 text-sm text-gray-600 space-y-2">
        <p>
          <strong>Limits:</strong> the centre line is the mean cycle time. The process limits sit 3.145 times
          the {stats.limitMethod === 'median' ? 'median' : 'average'} moving range either side of it, and the moving
          range limit is 3.865 times the median (Wheeler&apos;s median moving range method, which resists the
          inflation a single extreme item causes in right-skewed cycle time data).
          {stats.limitMethod === 'average' && ' More than half the moving ranges are zero, so the average moving range with the 2.66 and 3.27 constants is used instead.'}
        </p>
        <p>
          <strong>Signals:</strong> a point is marked red when it falls outside the process limits (Wheeler rule 1)
          or belongs to a run of {RUN_LENGTH} or more successive points on one side of the centre line (rule 2).
          Rules 3 and 4 (clusters near the limits) are not checked, so a chart with no red points is evidence of
          stability, not proof.
        </p>
        <p>
          <strong>Abbreviations:</strong> UPL = Upper Process Limit, CL = Central Line, LPL = Lower Process Limit, URL = Upper Range Limit
        </p>
      </div>
      )}
    </div>
  )
}