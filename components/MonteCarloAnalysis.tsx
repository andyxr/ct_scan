'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ArrowLeftRight, CalendarDays } from 'lucide-react'
import {
  EMPTY_SIMULATION,
  dateAfterDays,
  simulateDaysToTarget,
  simulateItemCount,
  throughputFrom,
  type HistogramBin,
} from '@/lib/monteCarlo'
import { SHEET_INK } from '@/lib/colours'
import Reading from './Reading'
import ExportPngButton from './ExportPngButton'
import ForecastCalendar from './ForecastCalendar'
import ChartViewToggle, { ChartView, useEscapeToRestore } from './ChartViewToggle'

interface MonteCarloAnalysisProps {
  data: any[]
}

/** "how-many" fixes the days and forecasts items; "when" fixes the items and forecasts days. */
type ForecastMode = 'how-many' | 'when'

const TOOLBAR_BUTTON = 'flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700'
const TOOLBAR_BUTTON_ON = 'flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-900 rounded bg-gray-900 text-white hover:bg-gray-800'

export default function MonteCarloAnalysis({ data }: MonteCarloAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [numSimulations, setNumSimulations] = useState(10000)
  const [forecastHorizon, setForecastHorizon] = useState(14)
  const [targetItems, setTargetItems] = useState(25)
  const [mode, setMode] = useState<ForecastMode>('how-many')
  const [isRunning, setIsRunning] = useState(false)
  const [runId, setRunId] = useState(0)
  const [showCalendar, setShowCalendar] = useState(true)
  const [view, setView] = useState<ChartView>('normal')
  const maximised = view === 'maximised'
  const chartRef = useRef<HTMLDivElement>(null)
  const forecastingDays = mode === 'when'

  useEscapeToRestore(view, () => setView('normal'))

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const { dailyThroughput, throughputArray } = useMemo(() => throughputFrom(data), [data])

  const { histogram, stats, unreachable } = useMemo(() => {
    if (throughputArray.length === 0) return EMPTY_SIMULATION

    return forecastingDays
      ? simulateDaysToTarget(throughputArray, targetItems, numSimulations)
      : simulateItemCount(throughputArray, forecastHorizon, numSimulations)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [throughputArray, numSimulations, forecastHorizon, targetItems, forecastingDays, runId])

  /**
   * Top of the frequency axis: the tallest bin plus a little headroom, rounded
   * to a readable step. Derived here rather than left to the chart, so the bars
   * fill the plot whatever shape the forecast takes.
   */
  const frequencyCeiling = useMemo(() => {
    const tallest = histogram.reduce((max, bin) => Math.max(max, bin.frequency), 0)
    if (tallest === 0) return 10
    const step = Math.max(10, Math.pow(10, Math.floor(Math.log10(tallest))) / 2)
    return Math.ceil((tallest * 1.1) / step) * step
  }, [histogram])

  const runSimulation = () => {
    setIsRunning(true)
    setRunId(id => id + 1)
    setTimeout(() => setIsRunning(false), 100)
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const bin = payload[0].payload as HistogramBin
      const probability = ((bin.frequency / stats.totalSimulations) * 100).toFixed(2)
      return (
        <div className="bg-white p-3 border-2 border-gray-300 rounded shadow-lg">
          <p className="font-bold text-blue-600">
            {forecastingDays ? `${bin.value} days` : `${bin.value} items`}
          </p>
          {forecastingDays && (
            <p className="text-sm text-gray-900">by {dateAfterDays(bin.value)}</p>
          )}
          <p className="text-sm text-gray-900">Frequency: {bin.frequency}</p>
          <p className="text-sm text-gray-600">Probability: {probability}%</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className={maximised
      ? 'fixed inset-0 z-40 flex flex-col overflow-auto bg-gray-50 p-6 pt-20'
      : 'sheet-panel p-6'}>
      <h2 className="text-2xl font-bold tracking-[0.08em] mb-4 text-gray-900">Monte Carlo Simulation – {forecastingDays ? 'When?' : 'How many?'}</h2>
      {!maximised && (
        <p className="text-gray-600 mb-6">
          Forecast delivery probabilities based on historical throughput data using Monte Carlo simulation.
        </p>
      )}

      {throughputArray.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No throughput data available. Please ensure your CSV has valid end dates.</p>
        </div>
      ) : (
        <>
          {!maximised && (
          <>
          {/* Small Dataset Warning */}
          {dailyThroughput.length < 10 && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start">
                <div className="text-yellow-600 mr-3">⚠️</div>
                <div>
                  <h4 className="text-sm font-semibold text-yellow-800 mb-1">
                    Limited Historical Data
                  </h4>
                  <p className="text-sm text-yellow-700">
                    Only {dailyThroughput.length} days of historical data available. For more accurate forecasts,
                    consider using at least 2-4 weeks of data. Current results may show unrealistic high values
                    due to small sample size.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Historical Throughput Summary */}
          <div className="mb-6">
            <h3 className="sheet-heading text-sm font-bold tracking-[0.14em] mb-3 text-gray-700">Historical Daily Throughput</h3>
            <dl className="grid grid-cols-2 border-l border-t border-gray-300 md:grid-cols-4">
              <Reading label="Total Days" value={String(dailyThroughput.length)} />
              <Reading
                label="Avg Daily"
                value={(throughputArray.reduce((a, b) => a + b, 0) / throughputArray.length).toFixed(1)}
                ink="text-green-700"
              />
              <Reading label="Min Daily" value={String(Math.min(...throughputArray))} />
              <Reading label="Max Daily" value={String(Math.max(...throughputArray))} />
            </dl>
          </div>

          {/* Simulation Parameters */}
          <div className="mb-6">
            <h3 className="sheet-heading text-sm font-bold tracking-[0.14em] mb-3 text-gray-700">Simulation Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Simulations
                </label>
                <input
                  type="number"
                  value={numSimulations}
                  onChange={(e) => setNumSimulations(Math.max(1000, Math.min(100000, parseInt(e.target.value) || 10000)))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1000"
                  max="100000"
                  step="1000"
                />
              </div>
              {forecastingDays ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Items wanted
                  </label>
                  <input
                    type="number"
                    value={targetItems}
                    onChange={(e) => setTargetItems(Math.max(1, Math.min(1000, parseInt(e.target.value) || 25)))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="1000"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Forecast Horizon (days)
                  </label>
                  <input
                    type="number"
                    value={forecastHorizon}
                    onChange={(e) => setForecastHorizon(Math.max(1, Math.min(365, parseInt(e.target.value) || 14)))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="365"
                  />
                </div>
              )}
              <div className="flex items-end">
                <button
                  onClick={runSimulation}
                  disabled={isRunning}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isRunning ? 'Running...' : 'Run Simulation'}
                </button>
              </div>
            </div>
          </div>
          </>
          )}

          {/* Results */}
          {stats.totalSimulations > 0 && (
            <>
              {/* A target the history can never reach: every confidence level would
                  otherwise read as the iteration cap and look like a real forecast. */}
              {unreachable && !maximised && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-red-800 mb-1">Target out of reach</h4>
                  <p className="text-sm text-red-700">
                    Some simulations never completed {targetItems} items. Your historical throughput
                    is too low to forecast this target — try a smaller number of items.
                  </p>
                </div>
              )}

              {/* Statistics */}
              {!maximised && (
              <div className="mb-6">
                <h3 className="sheet-heading text-sm font-bold tracking-[0.14em] mb-3 text-gray-700">Forecast Results</h3>
                {/* The three confidence levels are the sheet's headline reading,
                    so they take the wider boxes and the working inks. */}
                <dl className="grid grid-cols-1 border-l border-t border-gray-300 md:grid-cols-3">
                  <Reading
                    label="50% Confidence"
                    value={forecastingDays ? `${stats.p50} days` : String(stats.p50)}
                    note={forecastingDays ? `by ${dateAfterDays(stats.p50)} (median)` : 'items or more (median)'}
                    ink="text-blue-700"
                  />
                  <Reading
                    label="85% Confidence"
                    value={forecastingDays ? `${stats.p85} days` : String(stats.p85)}
                    note={forecastingDays ? `by ${dateAfterDays(stats.p85)} (conservative)` : 'items or more (conservative)'}
                    ink="text-green-700"
                  />
                  <Reading
                    label="95% Confidence"
                    value={forecastingDays ? `${stats.p95} days` : String(stats.p95)}
                    note={forecastingDays ? `by ${dateAfterDays(stats.p95)} (highly confident)` : 'items or more (highly confident)'}
                    ink="text-red-700"
                  />
                </dl>
              </div>
              )}

              {/* Histogram */}
              <div className={maximised ? 'flex-1 flex flex-col min-h-0' : 'mb-6'}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold tracking-[0.14em] text-gray-700">Probability Distribution</h3>
                  <div className="flex items-center gap-2">
                    {/* Lives here rather than in the parameters card: that card is
                        hidden while maximised, and the question must stay switchable. */}
                    <button
                      type="button"
                      onClick={() => setMode(forecastingDays ? 'how-many' : 'when')}
                      title={forecastingDays ? 'Switch to forecasting items' : 'Switch to forecasting dates'}
                      className={TOOLBAR_BUTTON}
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                      {forecastingDays ? 'How many?' : 'When?'}
                    </button>
                    {forecastingDays && !maximised && (
                      <button
                        type="button"
                        onClick={() => setShowCalendar((shown) => !shown)}
                        aria-pressed={showCalendar}
                        title={showCalendar ? 'Hide calendar' : 'Show calendar'}
                        className={showCalendar ? TOOLBAR_BUTTON_ON : TOOLBAR_BUTTON}
                      >
                        <CalendarDays className="w-4 h-4" />
                        Calendar
                      </button>
                    )}
                    {isMounted && histogram.length > 0 && (
                      <ExportPngButton targetRef={chartRef} filename="monte-carlo-forecast.png" />
                    )}
                    <ChartViewToggle view={view} onChange={setView} />
                  </div>
                </div>
                <div ref={chartRef} className={maximised ? 'sheet-plot flex-1 min-h-[16rem] w-full' : 'sheet-plot h-80 w-full'}>
                  {isMounted && histogram.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={histogram}
                        margin={{ top: 40, right: 30, left: 20, bottom: 20 }}
                        key={`histogram-${mode}-${stats.totalSimulations}-${forecastHorizon}-${targetItems}`}>
                        <CartesianGrid strokeDasharray="3 3" stroke={SHEET_INK.rule} />
                        <XAxis
                          dataKey="value"
                          label={{
                            value: forecastingDays ? `Days to Complete ${targetItems} Items` : 'Number of Items Completed',
                            position: 'insideBottom',
                            offset: -10,
                            fill: SHEET_INK.inkSoft,
                          }}
                          tick={{ fontSize: 12, fill: SHEET_INK.inkSoft }}
                        />
                        <YAxis
                          // Scaled from the tallest bin we hold, not from Recharts'
                          // own dataMax: on a spread-out forecast its default domain
                          // reaches far above every bar and leaves them as a stripe
                          // along the axis with the plot empty above.
                          domain={[0, frequencyCeiling]}
                          label={{ value: 'Frequency', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: SHEET_INK.inkSoft } }}
                          tick={{ fill: SHEET_INK.inkSoft }}
                        />
                        <Tooltip content={<CustomTooltip />} />

                        {/* Percentile lines - now correctly showing confidence levels */}
                        {/* Labelled down the line rather than along the top: the
                            three confidence marks can sit one item apart, and
                            horizontal labels there overlap into each other. */}
                        <ReferenceLine
                          x={stats.p95}
                          stroke={SHEET_INK.red}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          label={{ value: "95%", position: "insideTopLeft", offset: 8, fill: SHEET_INK.red }}
                        />
                        <ReferenceLine
                          x={stats.p85}
                          stroke={SHEET_INK.green}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          label={{ value: "85%", position: "insideTopLeft", offset: 8, fill: SHEET_INK.green }}
                        />
                        <ReferenceLine
                          x={stats.p50}
                          stroke={SHEET_INK.blue}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          label={{ value: "50%", position: "insideTopLeft", offset: 8, fill: SHEET_INK.blue }}
                        />

                        <Bar
                          dataKey="frequency"
                          fill={SHEET_INK.blue}
                          fillOpacity={0.35}
                          stroke={SHEET_INK.blue}
                          strokeWidth={1}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <p className="text-gray-500">
                        {!isMounted ? 'Loading chart...' : 'No simulation data available'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar: the same forecast read as dates. Hidden while maximised
                  so the histogram keeps the full height. */}
              {forecastingDays && showCalendar && !maximised && !unreachable && (
                <div className="mb-6">
                  <h3 className="sheet-heading text-sm font-bold tracking-[0.14em] mb-3 text-gray-700">Completion Calendar</h3>
                  <ForecastCalendar
                    histogram={histogram}
                    totalSimulations={stats.totalSimulations}
                    horizonDays={stats.p95}
                  />
                </div>
              )}

              {/* Interpretation */}
              {!maximised && (
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  <strong>Interpretation:</strong>{' '}
                  {forecastingDays ? (
                    <>
                      Based on {stats.totalSimulations.toLocaleString()} simulations, 85% finished {targetItems} items
                      within {stats.p85} days (by {dateAfterDays(stats.p85)}), and 50% finished
                      within {stats.p50} days (by {dateAfterDays(stats.p50)}).
                    </>
                  ) : (
                    <>
                      Based on {stats.totalSimulations.toLocaleString()} simulations over {forecastHorizon} days,
                      there is an 85% probability of completing {stats.p85} or more items, and a 50% probability of completing {stats.p50} or more items.
                    </>
                  )}
                </p>
                <p>
                  <strong>Methodology:</strong> This Monte Carlo simulation randomly samples from your historical daily throughput data
                  to model future performance variability and generate probabilistic forecasts.
                </p>
              </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
