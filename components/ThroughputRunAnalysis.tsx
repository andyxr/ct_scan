'use client'

import { useMemo, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { CsvRow } from '@/lib/csv'
import type { BatchCloseScan } from '@/lib/batchCloses'
import BatchCloseDiscountControl from './BatchCloseDiscountControl'
import ThroughputIntervalToggle from './ThroughputIntervalToggle'
import { SHEET_INK } from '@/lib/colours'
import {
  MIN_POINTS_FOR_RULES,
  SHIFT_LENGTH,
  TREND_LENGTH,
  throughputRun,
  type RunSignal,
  type ThroughputBucket,
  type ThroughputInterval,
} from '@/lib/throughputRun'
import Reading from './Reading'
import ExportPngButton from './ExportPngButton'
import ChartViewToggle, { ChartView, useEscapeToRestore } from './ChartViewToggle'
import { useIsClient } from './useIsClient'

interface ThroughputRunAnalysisProps {
  data: CsvRow[]
  /** Scanned over the unfiltered file, so a day's flag does not change with the filter. */
  batchCloses: BatchCloseScan
  discountBatchCloses: boolean
  onDiscountBatchClosesChange: (discount: boolean) => void
}

/** Only day buckets can be batch closes: the scan works on calendar days. */
type RunPoint = ThroughputBucket & { batchClose: boolean }

const SIGNAL_TEXT: Record<RunSignal, string> = {
  shift: `Shift: ${SHIFT_LENGTH}+ in a row on one side of the median`,
  trend: `Trend: ${TREND_LENGTH}+ in a row rising or falling`,
}

function RunDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: RunPoint }) {
  if (cx === undefined || cy === undefined || !payload) return null
  if (payload.batchClose) {
    return (
      <g>
        <rect x={cx - 6} y={cy - 6} width={12} height={12} transform={`rotate(45 ${cx} ${cy})`} fill={SHEET_INK.amber} stroke={SHEET_INK.ink} strokeWidth={2} />
      </g>
    )
  }
  if (payload.partial) {
    return <circle cx={cx} cy={cy} r={4} fill={SHEET_INK.stock} stroke={SHEET_INK.inkFaint} strokeWidth={2} />
  }
  const signal = payload.signals.length > 0
  return (
    <g>
      {signal && <circle cx={cx} cy={cy} r={5} fill={SHEET_INK.red} className="signal-halo" />}
      <circle
        cx={cx}
        cy={cy}
        r={signal ? 5 : 4}
        fill={signal ? SHEET_INK.red : SHEET_INK.blue}
        stroke={signal ? SHEET_INK.redDeep : SHEET_INK.ink}
        strokeWidth={2}
      />
    </g>
  )
}

function RunTooltip({
  active,
  payload,
  noun,
  limit,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload: RunPoint }>
  noun: string
  limit: number
}) {
  if (!active || !payload || payload.length === 0) return null
  const bucket = payload[0].payload
  return (
    <div className="bg-white p-4 border-2 border-gray-300 rounded shadow-lg">
      <p className="font-bold text-blue-600">{noun === 'day' ? bucket.label : `${noun[0].toUpperCase()}${noun.slice(1)} from ${bucket.label}`}</p>
      <p className="text-sm">
        <strong>Completed:</strong> {bucket.count} {bucket.count === 1 ? 'item' : 'items'}
        {bucket.recorded !== bucket.count && ` (recorded ${bucket.recorded}, batch closes discounted)`}
      </p>
      {bucket.partial && (
        <p className="text-xs text-gray-500 mt-1">Partial {noun}: the data starts or ends inside it, so it is left out of the median.</p>
      )}
      {bucket.batchClose && (
        <p className="text-xs font-semibold mt-1" style={{ color: SHEET_INK.amber }}>
          ◆ Batch close: above the file&apos;s daily limit of {limit.toFixed(1)}, likely closed in one sweep
        </p>
      )}
      {bucket.signals.map(signal => (
        <p key={signal} className="text-xs text-red-600 font-semibold mt-1">
          ⚠ {SIGNAL_TEXT[signal]}
        </p>
      ))}
    </div>
  )
}

export default function ThroughputRunAnalysis({ data, batchCloses, discountBatchCloses, onDiscountBatchClosesChange }: ThroughputRunAnalysisProps) {
  const isMounted = useIsClient()
  const [interval, setBucketInterval] = useState<ThroughputInterval>('week')
  const [view, setView] = useState<ChartView>('normal')
  const maximised = view === 'maximised'
  const chartRef = useRef<HTMLDivElement>(null)

  useEscapeToRestore(view, () => setView('normal'))

  const run = useMemo(
    () => throughputRun(data, interval, discountBatchCloses ? batchCloses : null),
    [data, interval, discountBatchCloses, batchCloses]
  )
  const noun = interval
  const points: RunPoint[] = useMemo(() => {
    const flagged = new Set(interval === 'day' ? batchCloses.closes.map(close => close.timestamp) : [])
    return run.buckets.map(bucket => ({ ...bucket, batchClose: flagged.has(bucket.start) }))
  }, [run, interval, batchCloses])
  const batchCloseCount = points.filter(p => p.batchClose).length

  const full = run.buckets.filter(b => !b.partial)
  const counts = full.map(b => b.count)
  const signalled = full.filter(b => b.signals.length > 0).length
  const signalsNote = {
    'all': `${noun}s in a shift or trend`,
    'too-few-points': `needs ${MIN_POINTS_FOR_RULES}+ full ${noun}s`,
    'median-crowded': `trends only: most ${noun}s sit on the median`,
  }[run.rules]

  return (
    <div className={maximised
      ? 'fixed inset-0 z-40 flex flex-col overflow-auto bg-gray-50 p-6 pt-20'
      : 'sheet-panel p-6'}>
      <h2 className="text-2xl font-bold tracking-[0.08em] mb-4 text-gray-900">Throughput Run Chart</h2>
      {!maximised && (
        <p className="text-gray-600 mb-6">
          Items completed per {noun}, in time order, against the median. Look for shifts and trends rather than reacting to any single {noun}.
        </p>
      )}

      <div className={maximised ? 'flex-1 flex flex-col min-h-0' : 'mb-6'}>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <h3 className="text-sm font-bold tracking-[0.14em] text-gray-700">Completed per {noun}</h3>
          <div className="flex items-center gap-2">
            <ThroughputIntervalToggle value={interval} onChange={setBucketInterval} />
            {isMounted && run.buckets.length > 0 && (
              <ExportPngButton targetRef={chartRef} filename={`throughput-run-chart-${interval}.png`} />
            )}
            <ChartViewToggle view={view} onChange={setView} />
          </div>
        </div>
        <BatchCloseDiscountControl
          scan={batchCloses}
          discount={discountBatchCloses}
          onChange={onDiscountBatchClosesChange}
          className="mb-3"
        />
        <div ref={chartRef} className={maximised ? 'sheet-plot flex-1 min-h-[16rem] w-full' : 'sheet-plot h-80 w-full'}>
          {isMounted && run.buckets.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 20, right: 70, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={SHEET_INK.rule} />
                <XAxis
                  dataKey="label"
                  label={{ value: interval === 'day' ? 'Day' : `${noun[0].toUpperCase()}${noun.slice(1)} starting`, position: 'insideBottom', offset: -10, fill: SHEET_INK.inkSoft }}
                  tick={{ fontSize: 12, fill: SHEET_INK.inkSoft }}
                  // DD/MM is enough on the axis; the tooltip carries the year.
                  tickFormatter={(label: string) => label.slice(0, 5)}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  label={{ value: 'Items completed', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: SHEET_INK.inkSoft } }}
                  tick={{ fill: SHEET_INK.inkSoft }}
                />
                <Tooltip content={<RunTooltip noun={noun} limit={batchCloses.limit} />} />
                {run.median !== null && (
                  <ReferenceLine
                    y={run.median}
                    stroke={SHEET_INK.green}
                    strokeWidth={2}
                    label={{ value: 'Median', position: 'right', fill: SHEET_INK.green }}
                  />
                )}
                <Line
                  type="linear"
                  dataKey="count"
                  stroke={SHEET_INK.blue}
                  strokeWidth={2}
                  dot={<RunDot />}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-gray-500">{!isMounted ? 'Loading chart...' : 'No data to display'}</p>
            </div>
          )}
        </div>
      </div>

      {!maximised && counts.length > 0 && (
        <dl className="mt-6 grid grid-cols-2 border-l border-t border-gray-300 md:grid-cols-4">
          <Reading label={`Full ${noun}s`} value={String(run.fullBucketCount)} />
          <Reading label="Median" value={`${run.median} / ${noun}`} ink="text-green-700" />
          <Reading label="Range" value={`${Math.min(...counts)} – ${Math.max(...counts)}`} />
          <Reading
            label="Signals"
            value={run.rules === 'too-few-points' ? '—' : String(signalled)}
            note={signalsNote}
            ink={signalled > 0 ? 'text-red-700' : undefined}
          />
        </dl>
      )}

      {!maximised && (
        <div className="mt-6 text-sm text-gray-600 space-y-2">
          <p>
            <strong>Median:</strong> the centre line is the median of the full {noun}s. Days with no completions count as zero, so quiet spells pull it down as they should.
          </p>
          {interval !== 'day' && <p>
            <strong>Partial {noun}s:</strong> when the data starts or ends part-way through a {noun}, that {noun} is drawn hollow and left out of the median and the rules. Its count is low for want of days, not of delivery.
          </p>}
          <p>
            <strong>Signals:</strong> a point is marked red when it belongs to a shift ({SHIFT_LENGTH} or more in a row above or below the median; points on the median are skipped) or a trend ({TREND_LENGTH} or more in a row each higher, or each lower, than the last; repeats are skipped). The rules need at least {MIN_POINTS_FOR_RULES} full {noun}s. When nothing falls below the median, as with daily counts that are mostly zero, the shift rule is skipped because it would call every busy {noun} one long run; a longer interval reads better.
          </p>
          {batchCloseCount > 0 && (
            <p>
              <strong>Batch closes:</strong> the {batchCloseCount === 1 ? 'amber diamond marks a day' : `${batchCloseCount} amber diamonds mark days`} where more items closed than the file&apos;s daily limit of {batchCloses.limit.toFixed(1)}. That is usually bookkeeping, work recorded late in one sweep, rather than a real burst of delivery. {discountBatchCloses ? `Discounted: each counts as ${batchCloses.cap}, in the median and the rules too.` : 'Drawn as recorded; tick Discount batch closes to count each as a normal day’s most.'}
            </p>
          )}
          <p>
            <strong>Reading it:</strong> throughput is the team&apos;s output, so a change in team size, WIP limits or how work is split will move it. A signal is a prompt to ask what changed, not a verdict.
          </p>
        </div>
      )}
    </div>
  )
}
