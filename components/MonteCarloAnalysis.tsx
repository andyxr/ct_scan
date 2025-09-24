'use client'

import { useMemo, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'

interface MonteCarloAnalysisProps {
  data: any[]
}

interface DailyThroughput {
  date: string
  count: number
  timestamp: number
}

interface SimulationResult {
  totalItems: number
  frequency: number
}

interface SimulationStats {
  totalSimulations: number
  p50: number
  p85: number
  p95: number
  mean: number
  min: number
  max: number
}

export default function MonteCarloAnalysis({ data }: MonteCarloAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [numSimulations, setNumSimulations] = useState(10000)
  const [forecastHorizon, setForecastHorizon] = useState(14)
  const [isRunning, setIsRunning] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const { dailyThroughput, throughputArray } = useMemo(() => {
    const allColumns = Object.keys(data[0] || {})

    // Find the end date column using the same logic as other components
    let endDateColumn = allColumns.find(key =>
      key.toLowerCase() === 'end' || key.toLowerCase() === 'end date'
    )

    let idColumn = allColumns.find(key =>
      key.toLowerCase() === 'id' || key.toLowerCase() === 'key'
    )

    // Fallback detection
    if (!endDateColumn) {
      for (const col of allColumns) {
        const sampleValues = data.slice(0, 5).map(row => row[col]).filter(Boolean)
        const isDateColumn = sampleValues.some(val => {
          const str = val.toString().trim()
          const datePattern = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/
          return datePattern.test(str)
        })

        if (isDateColumn) {
          endDateColumn = col
          break
        }
      }
    }

    if (!endDateColumn) {
      return { dailyThroughput: [], throughputArray: [] }
    }

    // Parse all end dates and group by day
    const dateGroups: { [key: string]: number } = {}

    data.forEach((row, index) => {
      if (!row[endDateColumn!]) return

      const dateString = row[endDateColumn!].toString().trim()
      const itemId = idColumn ? row[idColumn] : `Item-${index}`

      // Parse DD/MM/YYYY format
      const parts = dateString.split(/[-/]/)
      if (parts.length === 3) {
        const day = parseInt(parts[0].trim(), 10)
        const month = parseInt(parts[1].trim(), 10)
        const year = parseInt(parts[2].trim(), 10)

        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
          const dateValue = new Date(year, month - 1, day)
          if (!isNaN(dateValue.getTime())) {
            const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
            dateGroups[dateKey] = (dateGroups[dateKey] || 0) + 1
          }
        }
      }
    })

    // Find the complete date range (min to max) and fill in all days including zeros
    const dateKeys = Object.keys(dateGroups)
    if (dateKeys.length === 0) {
      return { dailyThroughput: [], throughputArray: [] }
    }

    // Find min and max dates
    const timestamps = dateKeys.map(dateKey => {
      const [year, month, day] = dateKey.split('-').map(Number)
      return new Date(year, month - 1, day).getTime()
    })

    if (timestamps.length === 0) {
      return { dailyThroughput: [], throughputArray: [] }
    }

    const minTimestamp = Math.min(...timestamps)
    const maxTimestamp = Math.max(...timestamps)

    // Generate all days between min and max (inclusive)
    const dailyThroughputData: DailyThroughput[] = []
    const oneDayMs = 24 * 60 * 60 * 1000

    for (let currentTimestamp = minTimestamp; currentTimestamp <= maxTimestamp; currentTimestamp += oneDayMs) {
      const currentDate = new Date(currentTimestamp)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() + 1
      const day = currentDate.getDate()

      // Create the date key in YYYY-MM-DD format to match our dateGroups
      const dateKey = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

      // Get count from dateGroups or default to 0
      const count = dateGroups[dateKey] || 0

      dailyThroughputData.push({
        date: `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`,
        count,
        timestamp: currentTimestamp
      })
    }

    // Already sorted by construction, but ensure chronological order
    dailyThroughputData.sort((a, b) => a.timestamp - b.timestamp)

    // Create throughput array for simulation (includes zero days)
    const throughputValues = dailyThroughputData.map(d => d.count)

    return {
      dailyThroughput: dailyThroughputData,
      throughputArray: throughputValues
    }
  }, [data])

  const { simulationResults, stats } = useMemo(() => {
    if (throughputArray.length === 0) {
      return {
        simulationResults: [],
        stats: {
          totalSimulations: 0,
          p50: 0,
          p85: 0,
          p95: 0,
          mean: 0,
          min: 0,
          max: 0
        }
      }
    }

    // Run Monte Carlo simulation
    const results: number[] = []

    for (let sim = 0; sim < numSimulations; sim++) {
      let totalItems = 0

      // For each day in the forecast horizon, randomly sample from historical throughput
      for (let day = 0; day < forecastHorizon; day++) {
        const randomIndex = Math.floor(Math.random() * throughputArray.length)
        totalItems += throughputArray[randomIndex]
      }

      results.push(totalItems)
    }

    // Sort results for percentile calculation
    results.sort((a, b) => a - b)

    // Calculate statistics (percentiles represent "at least this many items")
    // For confidence levels, we want the lower percentiles of the distribution
    const p50Index = Math.floor(results.length * 0.50)  // 50% of runs exceeded this
    const p15Index = Math.floor(results.length * 0.15)  // 85% of runs exceeded this (100-85=15)
    const p5Index = Math.floor(results.length * 0.05)   // 95% of runs exceeded this (100-95=5)

    const simulationStats: SimulationStats = {
      totalSimulations: numSimulations,
      p50: results[p50Index] || 0,
      p85: results[p15Index] || 0,  // 85% confidence means 15th percentile
      p95: results[p5Index] || 0,   // 95% confidence means 5th percentile
      mean: results.reduce((sum, val) => sum + val, 0) / results.length,
      min: results[0] || 0,
      max: results[results.length - 1] || 0
    }

    // Create histogram data
    const histogram: { [key: number]: number } = {}
    results.forEach(result => {
      histogram[result] = (histogram[result] || 0) + 1
    })

    const histogramData: SimulationResult[] = Object.entries(histogram)
      .map(([totalItems, frequency]) => ({
        totalItems: parseInt(totalItems),
        frequency
      }))
      .sort((a, b) => a.totalItems - b.totalItems)

    return {
      simulationResults: histogramData,
      stats: simulationStats
    }
  }, [throughputArray, numSimulations, forecastHorizon])

  const runSimulation = () => {
    setIsRunning(true)
    // Simulate a brief delay to show the running state
    setTimeout(() => setIsRunning(false), 100)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as SimulationResult
      const probability = ((data.frequency / stats.totalSimulations) * 100).toFixed(2)
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border-2 border-gray-300 dark:border-gray-600 rounded shadow-lg">
          <p className="font-bold text-blue-600 dark:text-blue-400">{data.totalItems} items</p>
          <p className="text-sm text-gray-900 dark:text-gray-100">Frequency: {data.frequency}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Probability: {probability}%</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Monte Carlo Simulation</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Forecast delivery probabilities based on historical throughput data using Monte Carlo simulation.
      </p>

      {throughputArray.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No throughput data available. Please ensure your CSV has valid end dates.</p>
        </div>
      ) : (
        <>
          {/* Small Dataset Warning */}
          {dailyThroughput.length < 10 && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start">
                <div className="text-yellow-600 dark:text-yellow-400 mr-3">⚠️</div>
                <div>
                  <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                    Limited Historical Data
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
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
            <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">Historical Daily Throughput</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <div className="font-semibold text-gray-700 dark:text-gray-300">Total Days</div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{dailyThroughput.length}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <div className="font-semibold text-gray-700 dark:text-gray-300">Avg Daily</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {(throughputArray.reduce((a, b) => a + b, 0) / throughputArray.length).toFixed(1)}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <div className="font-semibold text-gray-700 dark:text-gray-300">Min Daily</div>
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{Math.min(...throughputArray)}</div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                <div className="font-semibold text-gray-700 dark:text-gray-300">Max Daily</div>
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{Math.max(...throughputArray)}</div>
              </div>
            </div>
          </div>

          {/* Simulation Parameters */}
          <div className="mb-6">
            <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">Simulation Parameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Number of Simulations
                </label>
                <input
                  type="number"
                  value={numSimulations}
                  onChange={(e) => setNumSimulations(Math.max(1000, Math.min(100000, parseInt(e.target.value) || 10000)))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  min="1000"
                  max="100000"
                  step="1000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Forecast Horizon (days)
                </label>
                <input
                  type="number"
                  value={forecastHorizon}
                  onChange={(e) => setForecastHorizon(Math.max(1, Math.min(365, parseInt(e.target.value) || 14)))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  min="1"
                  max="365"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={runSimulation}
                  disabled={isRunning}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {isRunning ? 'Running...' : 'Run Simulation'}
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          {stats.totalSimulations > 0 && (
            <>
              {/* Statistics */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">Forecast Results</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-800">
                    <div className="font-semibold text-blue-700 dark:text-blue-300">50% Confidence</div>
                    <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">{stats.p50}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">items or more (median)</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded border border-green-200 dark:border-green-800">
                    <div className="font-semibold text-green-700 dark:text-green-300">85% Confidence</div>
                    <div className="text-2xl font-bold text-green-800 dark:text-green-200">{stats.p85}</div>
                    <div className="text-xs text-green-600 dark:text-green-400">items or more (conservative)</div>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded border border-purple-200 dark:border-purple-800">
                    <div className="font-semibold text-purple-700 dark:text-purple-300">95% Confidence</div>
                    <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">{stats.p95}</div>
                    <div className="text-xs text-purple-600 dark:text-purple-400">items or more (highly confident)</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                    <div className="font-semibold text-gray-700 dark:text-gray-300">Average</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{stats.mean.toFixed(1)}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                    <div className="font-semibold text-gray-700 dark:text-gray-300">Range</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{stats.min} - {stats.max}</div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                    <div className="font-semibold text-gray-700 dark:text-gray-300">Simulations</div>
                    <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{stats.totalSimulations.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Histogram */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">Probability Distribution</h3>
                <div className="h-80 w-full">
                  {isMounted && simulationResults.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        width={800}
                        height={320}
                        data={simulationResults}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                        key={`histogram-${stats.totalSimulations}-${forecastHorizon}`}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                        <XAxis
                          dataKey="totalItems"
                          label={{ value: 'Number of Items Completed', position: 'insideBottom', offset: -10 }}
                          tick={{ fontSize: 12, fill: theme === 'dark' ? '#d1d5db' : '#6b7280' }}
                        />
                        <YAxis
                          label={{ value: 'Frequency', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: theme === 'dark' ? '#d1d5db' : '#6b7280' } }}
                          tick={{ fill: theme === 'dark' ? '#d1d5db' : '#6b7280' }}
                        />
                        <Tooltip content={<CustomTooltip />} />

                        {/* Percentile lines - now correctly showing confidence levels */}
                        <ReferenceLine
                          x={stats.p95}
                          stroke={theme === 'dark' ? '#a78bfa' : '#7c3aed'}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          label={{ value: "95% confident", position: "top", offset: 10 }}
                        />
                        <ReferenceLine
                          x={stats.p85}
                          stroke={theme === 'dark' ? '#34d399' : '#059669'}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          label={{ value: "85% confident", position: "top", offset: 10 }}
                        />
                        <ReferenceLine
                          x={stats.p50}
                          stroke={theme === 'dark' ? '#60a5fa' : '#2563eb'}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          label={{ value: "50% confident", position: "top", offset: 10 }}
                        />

                        <Bar
                          dataKey="frequency"
                          fill={theme === 'dark' ? '#3b82f6' : '#60a5fa'}
                          stroke={theme === 'dark' ? '#1e40af' : '#2563eb'}
                          strokeWidth={1}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                      <p className="text-gray-500 dark:text-gray-400">
                        {!isMounted ? 'Loading chart...' : 'No simulation data available'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Interpretation */}
              <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                <p>
                  <strong>Interpretation:</strong> Based on {stats.totalSimulations.toLocaleString()} simulations over {forecastHorizon} days,
                  there is an 85% probability of completing {stats.p85} or more items, and a 50% probability of completing {stats.p50} or more items.
                </p>
                <p>
                  <strong>Methodology:</strong> This Monte Carlo simulation randomly samples from your historical daily throughput data
                  to model future performance variability and generate probabilistic forecasts.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}