'use client'

import { useMemo, useRef, useState } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { CsvRow } from '@/lib/csv'
import { SHEET_INK, colourForIndex } from '@/lib/colours'
import type { ThroughputInterval } from '@/lib/throughputRun'
import { throughputByType, type TypedBucket } from '@/lib/throughputByType'
import Reading from './Reading'
import ExportPngButton from './ExportPngButton'
import ChartViewToggle, { ChartView, useEscapeToRestore } from './ChartViewToggle'
import ThroughputIntervalToggle from './ThroughputIntervalToggle'
import { useIsClient } from './useIsClient'

interface ThroughputByTypeAnalysisProps {
  data: CsvRow[]
  /** Colour per item type, keyed by the file's full type list, in the file's order. */
  typeColours: Record<string, string>
}

type Scale = 'count' | 'share'

/**
 * A bucket as the chart draws it. Per-type values sit under prefixed keys, as
 * counts or percentages, so a type named "label" cannot collide with a field.
 */
type ChartRow = { bucket: TypedBucket; label: string } & Record<`type:${string}`, number>

/** Spelled out so Tailwind finds the class names in source. */
const MD_COLS: Record<number, string> = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }

const keyFor = (type: string) => `type:${type}` as const

const SEGMENT = 'px-3 py-1.5 text-sm border-gray-300 first:rounded-l last:rounded-r border-y border-l last:border-r'

function TypeTooltip({
  active,
  payload,
  types,
  colours,
  noun,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload: ChartRow }>
  types: string[]
  colours: Record<string, string>
  noun: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const { bucket } = payload[0].payload
  return (
    <div className="bg-white p-4 border-2 border-gray-300 rounded shadow-lg">
      <p className="font-bold text-blue-600">{noun === 'day' ? bucket.label : `${noun[0].toUpperCase()}${noun.slice(1)} from ${bucket.label}`}</p>
      {[...types].reverse().map(type => (
        <p key={type} className="text-sm flex items-center gap-2">
          <span className="inline-block h-3 w-3" style={{ backgroundColor: colours[type] }} aria-hidden="true" />
          {type}: <strong>{bucket.counts[type]}</strong>
          {bucket.total > 0 && <span className="text-gray-500">({Math.round((bucket.counts[type] / bucket.total) * 100)}%)</span>}
        </p>
      ))}
      <p className="text-sm mt-1"><strong>Total:</strong> {bucket.total}</p>
      {bucket.partial && <p className="text-xs text-gray-500 mt-1">Partial {noun}: the data starts or ends inside it.</p>}
    </div>
  )
}

export default function ThroughputByTypeAnalysis({ data, typeColours }: ThroughputByTypeAnalysisProps) {
  const isMounted = useIsClient()
  const [interval, setBucketInterval] = useState<ThroughputInterval>('week')
  const [scale, setScale] = useState<Scale>('count')
  const [view, setView] = useState<ChartView>('normal')
  const maximised = view === 'maximised'
  const chartRef = useRef<HTMLDivElement>(null)

  useEscapeToRestore(view, () => setView('normal'))

  const result = useMemo(
    () => throughputByType(data, interval, Object.keys(typeColours)),
    [data, interval, typeColours]
  )
  const colours = useMemo(
    () => Object.fromEntries(result.types.map((type, i) => [type, typeColours[type] ?? colourForIndex(i)])),
    [result.types, typeColours]
  )
  const rows: ChartRow[] = useMemo(() => result.buckets.map(bucket => ({
    bucket,
    label: bucket.label,
    ...Object.fromEntries(result.types.map(type => [
      keyFor(type),
      scale === 'share' ? (bucket.total === 0 ? 0 : (bucket.counts[type] / bucket.total) * 100) : bucket.counts[type],
    ])),
  })), [result, scale])

  const noun = interval
  const fullTotal = Object.values(result.totals).reduce((sum, n) => sum + n, 0)

  return (
    <div className={maximised
      ? 'fixed inset-0 z-40 flex flex-col overflow-auto bg-gray-50 p-6 pt-20'
      : 'sheet-panel p-6'}>
      <h2 className="text-2xl font-bold tracking-[0.08em] mb-4 text-gray-900">Throughput by Item Type</h2>
      {!maximised && (
        <p className="text-gray-600 mb-6">
          Items completed per {noun}, split by type. It shows where capacity actually goes, such as bugs crowding out stories, and whether that mix is shifting.
        </p>
      )}

      <div className={maximised ? 'flex-1 flex flex-col min-h-0' : 'mb-6'}>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <h3 className="text-sm font-bold tracking-[0.14em] text-gray-700">Completed per {noun} by type</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Scale" className="flex">
              {(['count', 'share'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setScale(option)}
                  aria-pressed={scale === option}
                  className={`${SEGMENT} ${scale === option ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {option === 'count' ? 'Count' : 'Share %'}
                </button>
              ))}
            </div>
            <ThroughputIntervalToggle value={interval} onChange={setBucketInterval} />
            {isMounted && rows.length > 0 && (
              <ExportPngButton targetRef={chartRef} filename={`throughput-by-type-${interval}.png`} />
            )}
            <ChartViewToggle view={view} onChange={setView} />
          </div>
        </div>
        <div ref={chartRef} className={maximised ? 'sheet-plot flex-1 min-h-[16rem] w-full' : 'sheet-plot h-80 w-full'}>
          {isMounted && rows.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={SHEET_INK.rule} />
                <XAxis
                  dataKey="label"
                  label={{ value: interval === 'day' ? 'Day' : `${noun[0].toUpperCase()}${noun.slice(1)} starting`, position: 'insideBottom', offset: -10, fill: SHEET_INK.inkSoft }}
                  tick={{ fontSize: 12, fill: SHEET_INK.inkSoft }}
                  tickFormatter={(label: string) => label.slice(0, 5)}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  domain={scale === 'share' ? [0, 100] : [0, 'auto']}
                  tickFormatter={(v: number) => (scale === 'share' ? `${v}%` : String(v))}
                  label={{ value: scale === 'share' ? 'Share of completions' : 'Items completed', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: SHEET_INK.inkSoft } }}
                  tick={{ fill: SHEET_INK.inkSoft }}
                />
                <Tooltip content={<TypeTooltip types={result.types} colours={colours} noun={noun} />} cursor={{ fill: SHEET_INK.rule, fillOpacity: 0.3 }} />
                <Legend verticalAlign="top" align="right" iconType="square" wrapperStyle={{ paddingBottom: 8, color: SHEET_INK.inkSoft }} />
                {result.types.map(type => (
                  <Bar key={type} dataKey={keyFor(type)} name={type} stackId="types" fill={colours[type]} isAnimationActive={false}>
                    {/* Partial intervals are faded: their totals are low for want of days. */}
                    {rows.map(row => (
                      <Cell key={row.bucket.start} fillOpacity={row.bucket.partial ? 0.35 : 1} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-gray-500">{!isMounted ? 'Loading chart...' : 'No data to display'}</p>
            </div>
          )}
        </div>
      </div>

      {!maximised && fullTotal > 0 && (
        <dl className={`mt-6 grid grid-cols-2 border-l border-t border-gray-300 ${MD_COLS[Math.min(4, result.types.length + 1)]}`}>
          <Reading label={`Items in full ${noun}s`} value={String(fullTotal)} />
          {result.types.map(type => (
            <Reading
              key={type}
              label={type}
              value={`${Math.round((result.totals[type] / fullTotal) * 100)}%`}
              note={`${result.totals[type]} ${result.totals[type] === 1 ? 'item' : 'items'}`}
            />
          ))}
        </dl>
      )}

      {!maximised && (
        <div className="mt-6 text-sm text-gray-600 space-y-2">
          <p>
            <strong>Reading it:</strong> each bar is one {noun}, stacked by item type in the colours set on the Cycle Time chart. Share % scales every bar to 100% so the mix is easy to compare when volume varies. The bar totals match the Throughput Run Chart.
          </p>
          <p>
            <strong>Mix:</strong> the shares below the chart cover full {noun}s only{interval === 'day' ? '' : `; faded bars are partial ${noun}s at the edges of the data`}. Use the item type filter above to narrow the types shown.
          </p>
        </div>
      )}
    </div>
  )
}
