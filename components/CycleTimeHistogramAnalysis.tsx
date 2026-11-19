'use client'

import { useMemo, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { detectColumns, toWorkItems, type CsvRow } from '@/lib/csv'
import { PERCENTILE_LINES, SHEET_INK } from '@/lib/colours'
import { cycleTimeHistogram, type CycleTimeBin } from '@/lib/cycleTimeHistogram'
import Reading from './Reading'
import ExportPngButton from './ExportPngButton'
import ChartViewToggle, { ChartView, useEscapeToRestore } from './ChartViewToggle'
import { useIsClient } from './useIsClient'

const PS = PERCENTILE_LINES.map(line => line.p)

/** Day ticks on round numbers: every day for short histories, then every 5 or 10. */
function dayTicks(maxDays: number): number[] {
  const step = maxDays <= 15 ? 1 : maxDays <= 50 ? 5 : 10
  const ticks = step === 1 ? [] : [1]
  for (let d = step; d <= maxDays; d += step) ticks.push(d)
  return ticks
}

function HistogramTooltip({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload: CycleTimeBin }> }) {
  if (!active || !payload || payload.length === 0) return null
  const bin = payload[0].payload
  return (
    <div className="bg-white p-4 border-2 border-gray-300 rounded shadow-lg">
      <p className="font-bold text-blue-600">{bin.days} {bin.days === 1 ? 'day' : 'days'}</p>
      <p className="text-sm">
        <strong>{bin.frequency}</strong> {bin.frequency === 1 ? 'item' : 'items'}
      </p>
      <p className="text-xs text-gray-500 mt-1">{Math.round(bin.cumulative * 100)}% of items finished within {bin.days} {bin.days === 1 ? 'day' : 'days'}</p>
    </div>
  )
}

export default function CycleTimeHistogramAnalysis({ data }: { data: CsvRow[] }) {
  const isMounted = useIsClient()
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set())
  const [view, setView] = useState<ChartView>('normal')
  const maximised = view === 'maximised'
  const chartRef = useRef<HTMLDivElement>(null)

  useEscapeToRestore(view, () => setView('normal'))

  const histogram = useMemo(
    () => cycleTimeHistogram(toWorkItems(data, detectColumns(data)).map(item => item.cycleTime), PS),
    [data]
  )

  const toggle = (p: number) => setHidden(prev => {
    const next = new Set(prev)
    if (next.has(p)) next.delete(p)
    else next.add(p)
    return next
  })

  const maxDays = histogram ? histogram.bins.length : 1

  return (
    <div className={maximised
      ? 'fixed inset-0 z-40 flex flex-col overflow-auto bg-gray-50 p-6 pt-20'
      : 'sheet-panel p-6'}>
      <h2 className="text-2xl font-bold tracking-[0.08em] mb-4 text-gray-900">Cycle Time Histogram</h2>
      {!maximised && (
        <p className="text-gray-600 mb-6">
          How many items took each number of days, with the percentiles a service level expectation is built from. A long tail to the right is the case for smaller work.
        </p>
      )}

      <div className={maximised ? 'flex-1 flex flex-col min-h-0' : 'mb-6'}>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <h3 className="text-sm font-bold tracking-[0.14em] text-gray-700">Items by cycle time</h3>
          <div className="flex items-center gap-2">
            {isMounted && histogram && (
              <ExportPngButton targetRef={chartRef} filename="cycle-time-histogram.png" />
            )}
            <ChartViewToggle view={view} onChange={setView} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-3 text-sm text-gray-700">
          <span>Percentiles</span>
          {PERCENTILE_LINES.map(line => (
            <label key={line.name} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!hidden.has(line.p)}
                onChange={() => toggle(line.p)}
                className="h-4 w-4"
                style={{ accentColor: line.stroke }}
              />
              <svg width="20" height="4" aria-hidden="true">
                <line x1="0" y1="2" x2="20" y2="2" stroke={line.stroke} strokeWidth={2} strokeDasharray={line.dash} />
              </svg>
              {line.name}
            </label>
          ))}
        </div>
        <div ref={chartRef} className={maximised ? 'sheet-plot flex-1 min-h-[16rem] w-full' : 'sheet-plot h-80 w-full'}>
          {isMounted && histogram ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram.bins} margin={{ top: 46, right: 30, left: 20, bottom: 20 }} barCategoryGap={1}>
                <CartesianGrid strokeDasharray="3 3" stroke={SHEET_INK.rule} />
                <XAxis
                  dataKey="days"
                  type="number"
                  // Half a day either side so the first and last bars sit whole inside the plot.
                  domain={[0.5, maxDays + 0.5]}
                  ticks={dayTicks(maxDays)}
                  label={{ value: 'Cycle time (days)', position: 'insideBottom', offset: -10, fill: SHEET_INK.inkSoft }}
                  tick={{ fontSize: 12, fill: SHEET_INK.inkSoft }}
                />
                <YAxis
                  allowDecimals={false}
                  label={{ value: 'Items', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: SHEET_INK.inkSoft } }}
                  tick={{ fill: SHEET_INK.inkSoft }}
                />
                <Tooltip content={<HistogramTooltip />} cursor={{ fill: SHEET_INK.rule, fillOpacity: 0.3 }} />
                <Bar dataKey="frequency" fill={SHEET_INK.blue} stroke={SHEET_INK.ink} strokeWidth={1} isAnimationActive={false} />
                {/* Labels alternate between two heights so neighbouring percentiles, often a day or two apart, stay legible. */}
                {PERCENTILE_LINES.filter(line => !hidden.has(line.p)).map((line, i) => (
                  <ReferenceLine
                    key={line.name}
                    x={histogram.percentiles[line.p]}
                    stroke={line.stroke}
                    strokeWidth={2}
                    strokeDasharray={line.dash}
                    label={{ value: `${line.name} ${histogram.percentiles[line.p].toFixed(1)}d`, position: 'top', offset: i % 2 === 0 ? 4 : 20, fill: line.stroke, fontSize: 12 }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-gray-500">{!isMounted ? 'Loading chart...' : 'No completed items to display'}</p>
            </div>
          )}
        </div>
      </div>

      {!maximised && histogram && (
        <dl className="mt-6 grid grid-cols-2 border-l border-t border-gray-300 md:grid-cols-5">
          <Reading label="Items" value={String(histogram.itemCount)} />
          <Reading label="Mean" value={`${histogram.mean.toFixed(1)} d`} />
          <Reading label="50th" value={`${histogram.percentiles[0.5].toFixed(1)} d`} note="half finish within" />
          <Reading label="85th" value={`${histogram.percentiles[0.85].toFixed(1)} d`} note="usual SLE basis" ink="text-blue-700" />
          <Reading label="95th" value={`${histogram.percentiles[0.95].toFixed(1)} d`} ink="text-red-700" />
        </dl>
      )}

      {!maximised && (
        <div className="mt-6 text-sm text-gray-600 space-y-2">
          <p>
            <strong>Reading it:</strong> each bar counts the items that took exactly that many days, counted inclusively, so an item started and finished on the same day is 1 day. Cycle time is almost always skewed right: most items finish quickly and a few take much longer. The gap between the 50th and 95th lines is how unpredictable delivery is.
          </p>
          <p>
            <strong>Percentiles:</strong> the same interpolated values as the Cycle Time scatterplot. The 85th is the usual basis for a service level expectation: 85% of items finished in that many days or fewer.
          </p>
        </div>
      )}
    </div>
  )
}
