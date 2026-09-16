'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { detectColumns, formatDate, toFlowItems, type DateRange } from '@/lib/csv'
import { cfdSeries, clipToRange, firstCompletion, flowMetrics, type CfdPoint } from '@/lib/cfd'
import { fromInputValue, toInputValue, todayMs } from '@/lib/dates'
import { SHEET_INK } from '@/lib/colours'
import Reading from './Reading'
import ExportPngButton from './ExportPngButton'
import ChartViewToggle, { ChartView, useEscapeToRestore } from './ChartViewToggle'

interface CfdAnalysisProps {
  /** Type-filtered but not date-filtered: the date range is a viewport, not an item filter. */
  data: any[]
  dateRange: DateRange
}

const CHART_MARGIN = { top: 20, right: 40, bottom: 20, left: 60 }

function CfdTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: CfdPoint }>
}) {
  if (!active || !payload?.[0]?.payload) return null
  const point = payload[0].payload
  return (
    <div className="bg-white p-3 border-2 border-gray-300 rounded shadow-lg">
      <p className="font-bold text-blue-600">{formatDate(point.timestamp)}</p>
      <p className="text-sm mt-1"><strong>Started:</strong> {point.started}</p>
      <p className="text-sm"><strong>Finished:</strong> {point.done}</p>
      <p className="text-sm"><strong>In progress:</strong> {point.wip}</p>
    </div>
  )
}

function cfdSummary(points: readonly CfdPoint[]): string {
  const first = points[0]
  const last = points[points.length - 1]
  const arrivals = last.started - first.started
  const departures = last.done - first.done
  const span = `${formatDate(first.timestamp)} to ${formatDate(last.timestamp)}`

  if (arrivals > departures) {
    return `Work is arriving faster than it finishes: ${arrivals} started against ${departures} finished over ${span}, and WIP grew from ${first.wip} to ${last.wip}.`
  }
  if (departures > arrivals) {
    return `Work is finishing faster than it arrives: ${departures} finished against ${arrivals} started over ${span}, and WIP fell from ${first.wip} to ${last.wip}.`
  }
  return `Arrivals and departures are level over ${span}: ${arrivals} started, ${departures} finished, and WIP held at ${last.wip}.`
}

export default function CfdAnalysis({ data, dateRange }: CfdAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [asOf, setAsOf] = useState<number>(() => todayMs())
  const [view, setView] = useState<ChartView>('normal')
  const maximised = view === 'maximised'
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEscapeToRestore(view, () => setView('normal'))

  const { points, censoredFrom } = useMemo(() => {
    const items = toFlowItems(data, detectColumns(data))
    const series = cfdSeries(items, asOf)
    // The file holds no work that finished before its first completion, so WIP
    // to the left of that day is understated. Default the viewport to start there.
    const censoredFrom = firstCompletion(items)
    const viewport: DateRange = {
      from: dateRange.from ?? censoredFrom,
      to: dateRange.to ?? asOf,
    }
    return { points: clipToRange(series, viewport), censoredFrom }
  }, [data, asOf, dateRange])

  const metrics = useMemo(() => flowMetrics(points), [points])

  const lastVisible = points[points.length - 1]?.timestamp
  const showAsOfLine = lastVisible !== undefined && asOf < lastVisible

  return (
    <div className={maximised
      ? 'fixed inset-0 z-40 flex flex-col overflow-auto bg-gray-50 p-6 pt-20'
      : 'sheet-panel p-6'}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold tracking-[0.08em] text-gray-900">Cumulative Flow</h2>
        <div className="flex items-center gap-2">
          {isMounted && points.length > 0 && (
            <ExportPngButton targetRef={chartRef} filename="cumulative-flow.png" />
          )}
          <ChartViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* The control block: a ruled strip of the operator's settings, seated
          under the field's heading the way a form groups its entry boxes. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 border-y border-gray-300 bg-gray-100/60 px-3 pt-3">
        {/* Open items have no end date, so their WIP runs to whatever day the
            chart is read as of. A file exported last week reads truer against
            its export date than against today. */}
        <label className="flex items-center gap-2 mb-4 text-sm text-gray-700">
          <span>Flow as of</span>
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
        <span className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          {points.length} {points.length === 1 ? 'day' : 'days'} charted
        </span>
      </div>

      <div ref={chartRef} className={maximised ? 'sheet-plot flex-1 min-h-[16rem] w-full select-none' : 'sheet-plot h-[40rem] w-full select-none'}>
        {isMounted && points.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points as CfdPoint[]} margin={CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke={SHEET_INK.rule} vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(tick: number) => formatDate(tick)}
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12, fill: SHEET_INK.inkSoft }}
              />
              <YAxis
                label={{ value: 'Items', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: SHEET_INK.inkSoft } }}
                tick={{ fill: SHEET_INK.inkSoft }}
              />
              <Tooltip content={<CfdTooltip />} />
              {/* Finished work sits on the floor and WIP stacks on top, so the
                  band between the two lines is the work in progress itself and
                  its horizontal width approximates cycle time. */}
              <Area
                type="stepAfter"
                dataKey="done"
                stackId="flow"
                name="Finished"
                stroke={SHEET_INK.green}
                fill={SHEET_INK.green}
                fillOpacity={0.35}
                isAnimationActive={false}
              />
              <Area
                type="stepAfter"
                dataKey="wip"
                stackId="flow"
                name="In progress"
                stroke={SHEET_INK.blue}
                fill={SHEET_INK.blue}
                fillOpacity={0.14}
                isAnimationActive={false}
              />
              {showAsOfLine && (
                <ReferenceLine
                  x={asOf}
                  stroke={SHEET_INK.blue}
                  strokeDasharray="6 3"
                  label={{ value: 'As of', position: 'insideTopRight', fill: SHEET_INK.blue }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-500">
              {!isMounted ? 'Loading chart...' : 'No items match the current filter'}
            </p>
          </div>
        )}
      </div>

      {censoredFrom !== null && (
        <p className="mt-2 text-xs text-gray-500">
          Items finished before the file&apos;s first completion are absent, so WIP before {formatDate(censoredFrom)} is understated.
        </p>
      )}

      {!maximised && points.length > 0 && (
        /* The reading recorded at the foot of the field, the way a form states
           its finding under the entry it was read from. */
        <div className="mt-4 border-t border-gray-300 pt-3 text-sm text-gray-700">
          <span className="sheet-figure mr-2 text-xs uppercase tracking-[0.12em] text-gray-400">
            Reading
          </span>
          <dl className="mt-2 grid grid-cols-2 border-l border-t border-gray-300 md:grid-cols-4">
            <Reading label="WIP now" value={String(metrics.wip)} ink="text-blue-800" />
            <Reading label="Started/wk" value={metrics.arrivalsPerWeek.toFixed(1)} />
            <Reading label="Finished/wk" value={metrics.departuresPerWeek.toFixed(1)} ink="text-green-700" />
            <Reading
              label="Approx cycle time"
              value={metrics.littlesLawDays === null ? '—' : `${metrics.littlesLawDays.toFixed(1)} days`}
              note="avg WIP ÷ finished/day"
            />
          </dl>
          <p className="mt-3">{cfdSummary(points)}</p>
        </div>
      )}
    </div>
  )
}
