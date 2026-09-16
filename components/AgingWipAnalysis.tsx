'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine } from 'recharts'
import { detectColumns, formatDate, toInProgressItems, toWorkItems } from '@/lib/csv'
import { agingBands, agingItems, olderThan, type AgingBands, type AgingItem } from '@/lib/aging'
import { SHEET_INK } from '@/lib/colours'
import { DEFAULT_SLE_DAYS } from '@/lib/sle'
import TypeColourControl from './TypeColourControl'
import ExportPngButton from './ExportPngButton'
import ChartViewToggle, { ChartView, useEscapeToRestore } from './ChartViewToggle'

interface AgingWipAnalysisProps {
  data: any[]
  /** Colour per item type, keyed by the file's full type list. Absent for files with no item_type column. */
  typeColours?: Record<string, string>
  onTypeColourChange?: (type: string, colour: string) => void
  onResetTypeColours?: () => void
}

/** One mark on the chart. Several open items can share a type and an age. */
interface PlotPoint {
  key: string
  column: string
  ageDays: number
  items: AgingItem[]
  fill: string
}

/** Column label for a file with no item_type column, in place of the (Untyped) sentinel. */
const SINGLE_COLUMN = 'Work in progress'

const CHART_MARGIN = { top: 20, right: 136, bottom: 20, left: 60 }

const DEFAULT_POINT_COLOUR = SHEET_INK.green

/**
 * The bands an open item's age is read against, bottom to top. Ink deepens as
 * an item ages past more of the finished work: below the median is the process
 * ink, past the 85th is a caution, past the 95th is a deviation.
 */
const BAND_LINES = [
  { key: 'p50', name: '50th', stroke: SHEET_INK.inkSoft, dash: '2 4' },
  { key: 'p75', name: '75th', stroke: SHEET_INK.green, dash: '8 3' },
  { key: 'p85', name: '85th', stroke: SHEET_INK.blue, dash: '5 5' },
  { key: 'p95', name: '95th', stroke: SHEET_INK.red, dash: '12 4' },
] as const satisfies readonly { key: keyof AgingBands; name: string; stroke: string; dash: string }[]

const BAND_FILLS = [
  { from: null, to: 'p50', fill: SHEET_INK.green, opacity: 0.06 },
  { from: 'p50', to: 'p75', fill: SHEET_INK.green, opacity: 0.12 },
  { from: 'p75', to: 'p85', fill: SHEET_INK.amber, opacity: 0.12 },
  { from: 'p85', to: 'p95', fill: SHEET_INK.amber, opacity: 0.22 },
  { from: 'p95', to: null, fill: SHEET_INK.red, opacity: 0.14 },
] as const satisfies readonly { from: keyof AgingBands | null; to: keyof AgingBands | null; fill: string; opacity: number }[]

/**
 * With an SLE set, the target is the one line that matters, so the percentile
 * bands give way to two: inside the target and past it. The percentile lines
 * stay as thin references to where finished work landed.
 */
const SLE_FILLS = [
  { below: true, fill: SHEET_INK.green, opacity: 0.08 },
  { below: false, fill: SHEET_INK.red, opacity: 0.14 },
] as const

/** YYYY-MM-DD from local date parts. toISOString would shift the day by the timezone offset. */
function toInputValue(epoch: number): string {
  const date = new Date(epoch)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local midnight for a YYYY-MM-DD input. new Date(str) would read it as UTC. */
function fromInputValue(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
}

function todayMs(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

function radiusForCount(count: number): number {
  if (count <= 1) return 6
  return 6 + 3 * Math.sqrt(count)
}

function groupPlotPoints(items: AgingItem[], columnOf: (type: string) => string, typeColours?: Record<string, string>): PlotPoint[] {
  const groups = new Map<string, AgingItem[]>()
  for (const item of items) {
    const key = `${item.itemType}|${item.ageDays}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(item)
    else groups.set(key, [item])
  }

  return [...groups.values()]
    .map(bucket => {
      const first = bucket[0]
      return {
        key: `${first.itemType}-${first.ageDays}`,
        column: columnOf(first.itemType),
        ageDays: first.ageDays,
        items: bucket,
        fill: typeColours?.[first.itemType] ?? DEFAULT_POINT_COLOUR,
      }
    })
    .sort((a, b) => a.items.length - b.items.length)
}

/**
 * Recharts hands `shape` a props bag it types as `unknown`, so the positioning
 * fields are narrowed here rather than declared. Must always return an element.
 */
function AgingDot({ activeKey, ...props }: { activeKey?: string | null; [key: string]: unknown }) {
  const { cx, cy, payload } = props as { cx?: number; cy?: number; payload?: PlotPoint }
  if (typeof cx !== 'number' || typeof cy !== 'number' || !payload) return <g />
  return (
    <circle
      cx={cx}
      cy={cy}
      r={radiusForCount(payload.items.length)}
      fill={payload.fill}
      className={`scatter-dot${activeKey === payload.key ? ' scatter-dot--active' : ''}`}
    />
  )
}

function AgingTooltip({
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
      {point.items.map(item => (
        <p key={item.id} className="font-bold text-blue-600">{item.id}</p>
      ))}
      <p className="font-semibold text-lg text-gray-900 mt-1">{point.ageDays} days old</p>
      <p className="text-xs text-gray-500 mt-1">Started: {formatDate(point.items[0].startDate)}</p>
    </div>
  )
}

function itemNoun(count: number): string {
  return count === 1 ? 'item is' : 'items are'
}

function agingSummary(items: AgingItem[], bands: AgingBands, completedCount: number): string {
  const count = items.length
  const noun = itemNoun(count)
  if (completedCount === 0) {
    return `${count} ${noun} in progress. Nothing has completed in the selected window, so there are no cycle times to read the ages against.`
  }
  const past85 = olderThan(items, bands.p85).length
  const past95 = olderThan(items, bands.p95).length
  const oldest = items[0]
  const against = `85% of completed items finished within ${bands.p85.toFixed(1)} days.`
  if (past85 === 0) {
    return `${count} ${noun} in progress and none has yet reached the 85th percentile. ${against} The oldest, ${oldest.id}, is ${oldest.ageDays} days old.`
  }
  const tail = past95 > 0 ? ` ${past95} ${past95 === 1 ? 'is' : 'are'} past the 95th.` : ''
  return `${count} ${noun} in progress. ${past85} ${past85 === 1 ? 'has' : 'have'} already run longer than the 85th percentile.${tail} ${against} The oldest, ${oldest.id}, is ${oldest.ageDays} days old.`
}

/** Age is inclusive and the SLE is a ceiling, so an item on the target day is still inside it. */
function sleSummary(items: AgingItem[], sleDays: number): string {
  const count = items.length
  const past = olderThan(items, sleDays)
  const oldest = items[0]
  if (past.length === 0) {
    return `${count} ${itemNoun(count)} in progress and all are inside the ${sleDays}-day SLE. The oldest, ${oldest.id}, is ${oldest.ageDays} days old.`
  }
  const over = past[0].ageDays - sleDays
  return `${count} ${itemNoun(count)} in progress. ${past.length} ${past.length === 1 ? 'has' : 'have'} already run past the ${sleDays}-day SLE. The oldest, ${oldest.id}, is ${oldest.ageDays} days old, ${over} ${over === 1 ? 'day' : 'days'} over it.`
}

export default function AgingWipAnalysis({
  data,
  typeColours,
  onTypeColourChange,
  onResetTypeColours,
}: AgingWipAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [asOf, setAsOf] = useState<number>(() => todayMs())
  const [showSle, setShowSle] = useState(false)
  const [sleDays, setSleDays] = useState(DEFAULT_SLE_DAYS)
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null)
  const [view, setView] = useState<ChartView>('normal')
  const maximised = view === 'maximised'
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEscapeToRestore(view, () => setView('normal'))

  const { items, bands, completedCount, columns, plotPoints } = useMemo(() => {
    const columnMap = detectColumns(data)
    const completed = toWorkItems(data, columnMap)
    const items = agingItems(toInProgressItems(data, columnMap), asOf)
    // One column per type with open work, in the file's type order so columns
    // do not shuffle as the filter changes. A file with no types gets one column.
    const typeOrder = Object.keys(typeColours ?? {})
    const typed = typeOrder.length > 0 && Boolean(columnMap.itemType)
    const open = new Set(items.map(item => item.itemType))
    const columns = typed ? typeOrder.filter(type => open.has(type)) : [SINGLE_COLUMN]
    const columnOf = (type: string) => (typed ? type : SINGLE_COLUMN)
    return {
      items,
      bands: agingBands(completed),
      completedCount: completed.length,
      columns,
      plotPoints: groupPlotPoints(items, columnOf, typed ? typeColours : undefined),
    }
  }, [data, asOf, typeColours])

  const yMax = useMemo(() => {
    const oldest = items[0]?.ageDays ?? 0
    // The SLE is a target, not data, so it has to be pulled into the range or it draws off the chart.
    return Math.ceil(Math.max(oldest, bands.p95, showSle ? sleDays : 0, 1) * 1.1)
  }, [items, bands.p95, showSle, sleDays])

  const bandEdge = (key: keyof AgingBands | null, fallback: number) => (key === null ? fallback : bands[key])

  return (
    <div className={maximised
      ? 'fixed inset-0 z-40 flex flex-col overflow-auto bg-gray-50 p-6 pt-20'
      : 'sheet-panel p-6'}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold tracking-[0.08em] text-gray-900">Aging Work In Progress</h2>
        <div className="flex items-center gap-2">
          {isMounted && items.length > 0 && (
            <ExportPngButton targetRef={chartRef} filename="aging-work-in-progress.png" />
          )}
          <ChartViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* The control block: a ruled strip of the operator's settings, seated
          under the field's heading the way a form groups its entry boxes. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 border-y border-gray-300 bg-gray-100/60 px-3 pt-3">
        {/* Age depends on the day it is read. A file exported last week reads
            truer against its export date than against today. */}
        <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
          <span>Age as of</span>
          <input
            type="date"
            value={toInputValue(asOf)}
            onChange={e => {
              const next = fromInputValue(e.target.value)
              if (next !== null) setAsOf(next)
            }}
            className="px-2 py-1 border border-gray-300 rounded bg-white"
          />
          {asOf !== todayMs() && (
            <button
              type="button"
              onClick={() => setAsOf(todayMs())}
              className="text-blue-600 underline hover:text-blue-800"
            >
              Today
            </button>
          )}
        </label>
        <label className="flex items-center gap-2 mb-4 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showSle}
            onChange={e => setShowSle(e.target.checked)}
            className="h-4 w-4 accent-green-600"
          />
          Show SLE
        </label>
        <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
          <span>SLE (days)</span>
          <input
            type="number"
            min="1"
            max="365"
            value={sleDays}
            onChange={e => setSleDays(Math.max(1, Math.min(365, parseInt(e.target.value) || DEFAULT_SLE_DAYS)))}
            className="w-20 px-2 py-1 border border-gray-300 rounded"
          />
        </label>
        <span className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          Percentiles from {completedCount} completed {completedCount === 1 ? 'item' : 'items'}
        </span>
      </div>

      {typeColours && onTypeColourChange && onResetTypeColours && (
        <TypeColourControl
          types={Object.keys(typeColours)}
          colours={typeColours}
          onChange={onTypeColourChange}
          onReset={onResetTypeColours}
        />
      )}

      <div ref={chartRef} className={maximised ? 'sheet-plot flex-1 min-h-[16rem] w-full select-none' : 'sheet-plot h-[40rem] w-full select-none'}>
        {isMounted && items.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={SHEET_INK.rule} vertical={false} />
              <XAxis
                dataKey="column"
                type="category"
                allowDuplicatedCategory={false}
                // Every column is named up front so an empty type still holds its place.
                domain={columns}
                ticks={columns}
                interval={0}
                tick={{ fontSize: 12, fill: SHEET_INK.inkSoft }}
              />
              <YAxis
                dataKey="ageDays"
                type="number"
                domain={[0, yMax]}
                label={{ value: 'Age (days)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: SHEET_INK.inkSoft } }}
                tick={{ fill: SHEET_INK.inkSoft }}
              />
              <Tooltip content={<AgingTooltip />} cursor={false} />
              {showSle && SLE_FILLS.map(band => (
                <ReferenceArea
                  key={String(band.below)}
                  y1={band.below ? 0 : sleDays}
                  y2={band.below ? sleDays : yMax}
                  fill={band.fill}
                  fillOpacity={band.opacity}
                  strokeOpacity={0}
                  ifOverflow="hidden"
                />
              ))}
              {!showSle && completedCount > 0 && BAND_FILLS.map(band => (
                <ReferenceArea
                  key={`${band.from}-${band.to}`}
                  y1={bandEdge(band.from, 0)}
                  y2={bandEdge(band.to, yMax)}
                  fill={band.fill}
                  fillOpacity={band.opacity}
                  strokeOpacity={0}
                  ifOverflow="hidden"
                />
              ))}
              {completedCount > 0 && BAND_LINES.map(line => (
                <ReferenceLine
                  key={line.key}
                  y={bands[line.key]}
                  stroke={line.stroke}
                  strokeWidth={showSle ? 1 : 2}
                  strokeDasharray={line.dash}
                  ifOverflow="visible"
                  label={{
                    value: `${line.name} (${bands[line.key].toFixed(1)}d)`,
                    position: 'right',
                    fill: line.stroke,
                  }}
                />
              ))}
              {showSle && (
                <ReferenceLine
                  y={sleDays}
                  stroke={SHEET_INK.blue}
                  strokeWidth={3}
                  strokeDasharray="6 3"
                  ifOverflow="visible"
                  label={{ value: `SLE ${sleDays}d`, position: 'insideTopLeft', fill: SHEET_INK.blue }}
                />
              )}
              <Scatter
                name="Age"
                data={plotPoints}
                dataKey="ageDays"
                shape={(props: unknown) => <AgingDot {...(props as object)} activeKey={hoveredPoint} />}
                isAnimationActive={false}
                onMouseEnter={(point: unknown) => setHoveredPoint((point as PlotPoint)?.key ?? null)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-500">
              {!isMounted ? 'Loading chart...' : 'No items in progress match the current filter'}
            </p>
          </div>
        )}
      </div>

      {!maximised && items.length > 0 && (
        /* The reading recorded at the foot of the field, the way a form states
           its finding under the entry it was read from. */
        <div className="mt-4 border-t border-gray-300 pt-3 text-sm text-gray-700">
          <span className="sheet-figure mr-2 text-xs uppercase tracking-[0.12em] text-gray-400">
            Reading
          </span>
          <p className="mt-1">{showSle ? sleSummary(items, sleDays) : agingSummary(items, bands, completedCount)}</p>
        </div>
      )}
    </div>
  )
}
