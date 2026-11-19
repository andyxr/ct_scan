'use client'

import { useMemo, useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { CsvRow } from '@/lib/csv'
import type { BatchCloseScan } from '@/lib/batchCloses'
import { SHEET_INK } from '@/lib/colours'
import { throughputRun, type ThroughputInterval } from '@/lib/throughputRun'
import { throughputHistogram, type ThroughputBin } from '@/lib/throughputHistogram'
import Reading from './Reading'
import ExportPngButton from './ExportPngButton'
import ChartViewToggle, { ChartView, useEscapeToRestore } from './ChartViewToggle'
import BatchCloseDiscountControl from './BatchCloseDiscountControl'
import ThroughputIntervalToggle from './ThroughputIntervalToggle'
import { useIsClient } from './useIsClient'

interface ThroughputHistogramAnalysisProps {
  data: CsvRow[]
  /** Scanned over the unfiltered file, so a day's flag does not change with the filter. */
  batchCloses: BatchCloseScan
  discountBatchCloses: boolean
  onDiscountBatchClosesChange: (discount: boolean) => void
}

function HistogramTooltip({
  active,
  payload,
  noun,
  total,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload: ThroughputBin }>
  noun: string
  total: number
}) {
  if (!active || !payload || payload.length === 0) return null
  const bin = payload[0].payload
  return (
    <div className="bg-white p-4 border-2 border-gray-300 rounded shadow-lg">
      <p className="font-bold text-blue-600">{bin.value} {bin.value === 1 ? 'item' : 'items'} per {noun}</p>
      <p className="text-sm">
        <strong>{bin.frequency}</strong> {bin.frequency === 1 ? noun : `${noun}s`} ({((bin.frequency / total) * 100).toFixed(0)}%)
      </p>
    </div>
  )
}

export default function ThroughputHistogramAnalysis({ data, batchCloses, discountBatchCloses, onDiscountBatchClosesChange }: ThroughputHistogramAnalysisProps) {
  const isMounted = useIsClient()
  const [interval, setBucketInterval] = useState<ThroughputInterval>('week')
  const [view, setView] = useState<ChartView>('normal')
  const maximised = view === 'maximised'
  const chartRef = useRef<HTMLDivElement>(null)

  useEscapeToRestore(view, () => setView('normal'))

  const histogram = useMemo(
    () => throughputHistogram(throughputRun(data, interval, discountBatchCloses ? batchCloses : null).buckets),
    [data, interval, discountBatchCloses, batchCloses]
  )
  const noun = interval

  return (
    <div className={maximised
      ? 'fixed inset-0 z-40 flex flex-col overflow-auto bg-gray-50 p-6 pt-20'
      : 'sheet-panel p-6'}>
      <h2 className="text-2xl font-bold tracking-[0.08em] mb-4 text-gray-900">Throughput Histogram</h2>
      {!maximised && (
        <p className="text-gray-600 mb-6">
          How often each {noun} finished a given number of items. This is the spread the Monte Carlo forecast samples from.
        </p>
      )}

      <div className={maximised ? 'flex-1 flex flex-col min-h-0' : 'mb-6'}>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <h3 className="text-sm font-bold tracking-[0.14em] text-gray-700">{noun[0].toUpperCase()}{noun.slice(1)}s by items completed</h3>
          <div className="flex items-center gap-2">
            <ThroughputIntervalToggle value={interval} onChange={setBucketInterval} />
            {isMounted && histogram && (
              <ExportPngButton targetRef={chartRef} filename={`throughput-histogram-${interval}.png`} />
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
          {isMounted && histogram ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram.bins} margin={{ top: 30, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={SHEET_INK.rule} />
                <XAxis
                  dataKey="value"
                  label={{ value: `Items completed per ${noun}`, position: 'insideBottom', offset: -10, fill: SHEET_INK.inkSoft }}
                  tick={{ fontSize: 12, fill: SHEET_INK.inkSoft }}
                />
                <YAxis
                  allowDecimals={false}
                  label={{ value: `Number of ${noun}s`, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: SHEET_INK.inkSoft } }}
                  tick={{ fill: SHEET_INK.inkSoft }}
                />
                <Tooltip content={<HistogramTooltip noun={noun} total={histogram.intervals} />} cursor={{ fill: SHEET_INK.rule, fillOpacity: 0.3 }} />
                <Bar dataKey="frequency" fill={SHEET_INK.blue} stroke={SHEET_INK.ink} strokeWidth={1} isAnimationActive={false} />
                {histogram.atLeast85 !== histogram.median && (
                  <ReferenceLine
                    x={histogram.atLeast85}
                    stroke={SHEET_INK.amber}
                    strokeWidth={2}
                    strokeDasharray="8 4"
                    label={{ value: '85% ≥', position: 'top', fill: SHEET_INK.amber }}
                  />
                )}
                <ReferenceLine
                  x={histogram.median}
                  stroke={SHEET_INK.green}
                  strokeWidth={2}
                  label={{
                    value: histogram.atLeast85 === histogram.median ? 'Median and 85% ≥' : 'Median',
                    position: 'top',
                    fill: SHEET_INK.green,
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-gray-500">{!isMounted ? 'Loading chart...' : `No full ${noun}s to display`}</p>
            </div>
          )}
        </div>
      </div>

      {!maximised && histogram && (
        <dl className="mt-6 grid grid-cols-2 border-l border-t border-gray-300 md:grid-cols-4">
          <Reading label={`Full ${noun}s`} value={String(histogram.intervals)} />
          <Reading label="Median" value={`${histogram.median} / ${noun}`} ink="text-green-700" />
          <Reading label="85% of the time" value={`≥ ${histogram.atLeast85} / ${noun}`} note={`${noun}s that finished at least this many`} ink="text-amber-700" />
          <Reading label="Mean" value={`${histogram.mean.toFixed(1)} / ${noun}`} />
        </dl>
      )}

      {!maximised && (
        <div className="mt-6 text-sm text-gray-600 space-y-2">
          <p>
            <strong>Reading it:</strong> each bar counts the {noun}s that finished exactly that many items. Days with no completions count as zero{interval === 'day' ? '' : `, and ${noun}s the data only part covers are left out`}. A wide spread or a tall bar at zero means forecasts carry more uncertainty.
          </p>
          <p>
            <strong>Lines:</strong> the median is the middle {noun}. The 85% line is the count 85% of {noun}s reached or beat, read from the low end because a slow {noun} is the risk to a plan.
          </p>
          {batchCloses.closes.length > 0 && (
            <p>
              <strong>Batch closes:</strong> {discountBatchCloses
                ? `discounted: each batch-close day counts as ${batchCloses.cap}, the most a normal day reaches.`
                : 'drawn as recorded, so days of work recorded late in bulk sit in the long tail. Tick Discount batch closes to cap them.'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
