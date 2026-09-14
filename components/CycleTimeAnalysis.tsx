'use client'

import { useMemo, useRef, useState, useEffect, type SyntheticEvent } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts'
import { detectColumns, toWorkItems, percentile, formatDate } from '@/lib/csv'
import TypeColourControl from './TypeColourControl'
import SprintLengthControl, { DEFAULT_SPRINT_DAYS } from './SprintLengthControl'
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

const DEFAULT_POINT_COLOUR = '#22c55e'
/** Stacked items of more than one type, so no swatch colour would be honest. */
const MIXED_TYPE_COLOUR = '#374151'

function startOfDayMs(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
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

function ScatterDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: PlotPoint }) {
  if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) return null
  return (
    <circle
      cx={cx}
      cy={cy}
      r={radiusForCount(payload.itemIds.length)}
      fill={payload.fill}
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

  const { processedData, percentileLines, stats, dataExtent } = useMemo(() => {
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

  const withinSprint = processedData.filter(item => item.cycleTime <= sprintDays).length
  const daysAt = (p: number) =>
    (percentileLines.find(line => line.p === p)?.value ?? 0).toFixed(1)
  const xDomain = zoom
    ? paddedDomain(zoom.left, zoom.right)
    : paddedDomain(dataExtent.min, dataExtent.max)

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
                tickFormatter={formatXAxis}
                label={{ value: 'End Date', position: 'insideBottom', offset: -10 }}
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                dataKey="cycleTime"
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.08)]}
                label={{ value: 'Cycle Time (days)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280' } }}
                tick={{ fill: '#6b7280' }}
              />
              <Tooltip content={<CycleTimeTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              {percentileLines.map(line => (
                <ReferenceLine
                  key={line.name}
                  y={line.value}
                  stroke={line.stroke}
                  strokeWidth={2}
                  strokeDasharray={line.dash}
                  ifOverflow="visible"
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
                shape={ScatterDot}
                isAnimationActive={false}
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
          <p>
            50% of items finish within {daysAt(0.5)} days, 75% within {daysAt(0.75)}, 85% within {daysAt(0.85)}, and 95% within {daysAt(0.95)}.
          </p>
          {showAverage && (
            <p>The average cycle time is {stats.average.toFixed(1)} days, which sits at the {ordinal(stats.averagePercentile)} percentile. A forecast based on the average would be right for only {stats.averagePercentile}% of items.</p>
          )}
        </div>
      )}
    </div>
  )
}