'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { ArrowLeftRight } from 'lucide-react'
import {
  EMPTY_SIMULATION,
  dateAfterDays,
  simulateDaysToTarget,
  simulateItemCount,
  throughputFrom,
  type HistogramBin,
} from '@/lib/monteCarlo'
import ExportPngButton from './ExportPngButton'
import ChartViewToggle, { ChartView, useEscapeToRestore } from './ChartViewToggle'

interface MonteCarloAnalysisProps {
  data: any[]
}

/** "how-many" fixes the days and forecasts items; "when" fixes the items and forecasts days. */
type ForecastMode = 'how-many' | 'when'

const TOOLBAR_BUTTON = 'flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700'

export default function MonteCarloAnalysis({ data }: MonteCarloAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [numSimulations, setNumSimulations] = useState(10000)
  const [forecastHorizon, setForecastHorizon] = useState(14)
  const [targetItems, setTargetItems] = useState(25)
  const [mode, setMode] = useState<ForecastMode>('how-many')
  const [isRunning, setIsRunning] = useState(false)
  const [runId, setRunId] = useState(0)
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
      ? 'fixed inset-0 z-40 overflow-auto bg-white p-6 pt-20 flex flex-col'
      : 'bg-white rounded-lg shadow p-6'}>
      <h2 className="text-2xl font-semibold mb-4 text-gray-900">Monte Carlo Simulation</h2>
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
            <h3 className="text-lg font-medium mb-3 text-gray-900">Historical Daily Throughput</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-semibold text-gray-700">Total Days</div>
                <div className="text-lg font-bold text-blue-600">{dailyThroughput.length}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-semibold text-gray-700">Avg Daily</div>
                <div className="text-lg font-bold text-green-600">
                  {(throughputArray.reduce((a, b) => a + b, 0) / throughputArray.length).toFixed(1)}
                </div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-semibold text-gray-700">Min Daily</div>
                <div className="text-lg font-bold text-orange-600">{Math.min(...throughputArray)}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-semibold text-gray-700">Max Daily</div>
                <div className="text-lg font-bold text-purple-600">{Math.max(...throughputArray)}</div>
              </div>
            </div>
          </div>

          {/* Simulation Parameters */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3 text-gray-900">Simulation Parameters</h3>
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
                <h3 className="text-lg font-medium mb-3 text-gray-900">Forecast Results</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-blue-50 p-4 rounded border border-blue-200">
                    <div className="font-semibold text-blue-700">50% Confidence</div>
                    <div className="text-2xl font-bold text-blue-800">
                      {forecastingDays ? `${stats.p50} days` : stats.p50}
                    </div>
                    <div className="text-xs text-blue-600">
                      {forecastingDays ? `by ${dateAfterDays(stats.p50)} (median)` : 'items or more (median)'}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded border border-green-200">
                    <div className="font-semibold text-green-700">85% Confidence</div>
                    <div className="text-2xl font-bold text-green-800">
                      {forecastingDays ? `${stats.p85} days` : stats.p85}
                    </div>
                    <div className="text-xs text-green-600">
                      {forecastingDays ? `by ${dateAfterDays(stats.p85)} (conservative)` : 'items or more (conservative)'}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded border border-purple-200">
                    <div className="font-semibold text-purple-700">95% Confidence</div>
                    <div className="text-2xl font-bold text-purple-800">
                      {forecastingDays ? `${stats.p95} days` : stats.p95}
                    </div>
                    <div className="text-xs text-purple-600">
                      {forecastingDays ? `by ${dateAfterDays(stats.p95)} (highly confident)` : 'items or more (highly confident)'}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="font-semibold text-gray-700">Average</div>
                    <div className="text-lg font-bold text-gray-800">{stats.mean.toFixed(1)}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="font-semibold text-gray-700">Range</div>
                    <div className="text-lg font-bold text-gray-800">{stats.min} - {stats.max}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="font-semibold text-gray-700">Simulations</div>
                    <div className="text-lg font-bold text-gray-800">{stats.totalSimulations.toLocaleString()}</div>
                  </div>
                </div>
              </div>
              )}

              {/* Histogram */}
              <div className={maximised ? 'flex-1 flex flex-col min-h-0' : 'mb-6'}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-medium text-gray-900">Probability Distribution</h3>
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
                      {forecastingDays ? 'When?' : 'How many?'}
                    </button>
                    {isMounted && histogram.length > 0 && (
                      <ExportPngButton targetRef={chartRef} filename="monte-carlo-forecast.png" />
                    )}
                    <ChartViewToggle view={view} onChange={setView} />
                  </div>
                </div>
                <div ref={chartRef} className={maximised ? 'flex-1 min-h-[16rem] w-full' : 'h-80 w-full'}>
                  {isMounted && histogram.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={histogram}
                        margin={{ top: 40, right: 30, left: 20, bottom: 20 }}
                        key={`histogram-${mode}-${stats.totalSimulations}-${forecastHorizon}-${targetItems}`}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="value"
                          label={{
                            value: forecastingDays ? `Days to Complete ${targetItems} Items` : 'Number of Items Completed',
                            position: 'insideBottom',
                            offset: -10,
                          }}
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                        />
                        <YAxis
                          label={{ value: 'Frequency', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280' } }}
                          tick={{ fill: '#6b7280' }}
                        />
                        <Tooltip content={<CustomTooltip />} />

                        {/* Percentile lines - now correctly showing confidence levels */}
                        <ReferenceLine
                          x={stats.p95}
                          stroke="#7c3aed"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          label={{ value: "95% confident", position: "top", offset: 10 }}
                        />
                        <ReferenceLine
                          x={stats.p85}
                          stroke="#059669"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          label={{ value: "85% confident", position: "top", offset: 10 }}
                        />
                        <ReferenceLine
                          x={stats.p50}
                          stroke="#2563eb"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          label={{ value: "50% confident", position: "top", offset: 10 }}
                        />

                        <Bar
                          dataKey="frequency"
                          fill="#60a5fa"
                          stroke="#2563eb"
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
