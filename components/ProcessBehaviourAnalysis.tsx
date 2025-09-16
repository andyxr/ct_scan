'use client'

import { useMemo, useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'

interface ProcessBehaviourAnalysisProps {
  data: any[]
}

interface ProcessDataPoint {
  key: string
  sequence: number
  cycleTime: number
  movingRange: number | null
  itemName: string
  itemId: string
  originalEndDate: string
  isSpecialCause: boolean
}

interface ProcessStats {
  centralLine: number
  upperProcessLimit: number
  lowerProcessLimit: number
  averageMovingRange: number
  totalItems: number
  specialCauseCount: number
}

export default function ProcessBehaviourAnalysis({ data }: ProcessBehaviourAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const { processedData, movingRangeData, stats } = useMemo(() => {
    const allColumns = Object.keys(data[0] || {})
    console.log('All available columns:', allColumns)

    // Find required columns (reuse logic from CycleTimeAnalysis)
    let endDateColumn = allColumns.find(key =>
      key.toLowerCase() === 'end' || key.toLowerCase() === 'end date'
    )

    let cycleTimeColumn = allColumns.find(key =>
      key.toLowerCase() === 'ct' || key.toLowerCase() === 'cycle time'
    )

    let idColumn = allColumns.find(key =>
      key.toLowerCase() === 'id' || key.toLowerCase() === 'key'
    )

    // Fallback detection if specific columns not found
    if (!endDateColumn || !cycleTimeColumn) {
      for (const col of allColumns) {
        const sampleValues = data.slice(0, 5).map(row => row[col]).filter(Boolean)

        if (!endDateColumn) {
          const isDateColumn = sampleValues.some(val => {
            const str = val.toString().trim()
            const datePattern = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/
            return datePattern.test(str)
          })

          if (isDateColumn) {
            endDateColumn = col
          }
        }

        if (!cycleTimeColumn) {
          const isCycleTimeColumn = sampleValues.every(val => {
            const num = parseFloat(val)
            return !isNaN(num) && num >= 0 && num <= 100
          })

          if (isCycleTimeColumn) {
            cycleTimeColumn = col
          }
        }
      }
    }

    if (!endDateColumn || !cycleTimeColumn) {
      console.warn('Missing required columns for process behaviour analysis')
      return {
        processedData: [],
        movingRangeData: [],
        stats: {
          centralLine: 0,
          upperProcessLimit: 0,
          lowerProcessLimit: 0,
          averageMovingRange: 0,
          totalItems: 0,
          specialCauseCount: 0
        }
      }
    }

    // Process and sort data chronologically by end date
    const chronologicalData = data
      .filter(row => endDateColumn && cycleTimeColumn && row[endDateColumn] && row[cycleTimeColumn])
      .map((row, index) => {
        const dateString = row[endDateColumn!].toString().trim()
        const itemId = idColumn ? row[idColumn] : 'Unknown'

        // Parse date (reuse logic from CycleTimeAnalysis)
        let dateValue: Date
        const parts = dateString.split(/[-/]/)
        if (parts.length === 3) {
          const day = parseInt(parts[0].trim(), 10)
          const month = parseInt(parts[1].trim(), 10)
          const year = parseInt(parts[2].trim(), 10)

          if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
            dateValue = new Date(year, month - 1, day)
          } else {
            return null
          }
        } else {
          return null
        }

        if (isNaN(dateValue.getTime())) {
          return null
        }

        return {
          endDate: dateValue.getTime(),
          cycleTime: parseFloat(row[cycleTimeColumn!]) || 0,
          itemId,
          itemName: idColumn ? row[idColumn] || 'Unknown' : 'Unknown',
          originalEndDate: dateString
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && item.cycleTime > 0)
      .sort((a, b) => a.endDate - b.endDate)

    if (chronologicalData.length === 0) {
      return {
        processedData: [],
        movingRangeData: [],
        stats: {
          centralLine: 0,
          upperProcessLimit: 0,
          lowerProcessLimit: 0,
          averageMovingRange: 0,
          totalItems: 0,
          specialCauseCount: 0
        }
      }
    }

    // Calculate process statistics using Shewhart method
    const cycleTimes = chronologicalData.map(item => item.cycleTime)
    const centralLine = cycleTimes.reduce((sum, ct) => sum + ct, 0) / cycleTimes.length

    // Calculate moving ranges
    const movingRanges: number[] = []
    for (let i = 1; i < cycleTimes.length; i++) {
      movingRanges.push(Math.abs(cycleTimes[i] - cycleTimes[i - 1]))
    }

    const averageMovingRange = movingRanges.length > 0
      ? movingRanges.reduce((sum, mr) => sum + mr, 0) / movingRanges.length
      : 0

    // Shewhart control limits using 2.66 multiplier for individuals chart
    const upperProcessLimit = centralLine + (2.66 * averageMovingRange)
    const lowerProcessLimit = Math.max(0, centralLine - (2.66 * averageMovingRange)) // Can't have negative cycle time

    // Create processed data points with special cause identification
    const processedDataPoints: ProcessDataPoint[] = chronologicalData.map((item, index) => {
      const isSpecialCause = item.cycleTime > upperProcessLimit || item.cycleTime < lowerProcessLimit

      return {
        key: `${item.itemId}-${index}`,
        sequence: index + 1,
        cycleTime: item.cycleTime,
        movingRange: index > 0 ? movingRanges[index - 1] : null,
        itemName: item.itemName,
        itemId: item.itemId,
        originalEndDate: item.originalEndDate,
        isSpecialCause
      }
    })

    // Create moving range chart data
    const movingRangePoints = movingRanges.map((mr, index) => ({
      key: `mr-${index}`,
      sequence: index + 2, // Moving range starts from 2nd point
      movingRange: mr,
      upperRangeLimit: averageMovingRange * 3.27, // Upper control limit for moving range
      centralMovingRange: averageMovingRange
    }))

    const specialCauseCount = processedDataPoints.filter(point => point.isSpecialCause).length

    return {
      processedData: processedDataPoints,
      movingRangeData: movingRangePoints,
      stats: {
        centralLine,
        upperProcessLimit,
        lowerProcessLimit,
        averageMovingRange,
        totalItems: processedDataPoints.length,
        specialCauseCount
      }
    }
  }, [data])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ProcessDataPoint
      return (
        <div className="bg-white p-4 border-2 border-gray-300 rounded shadow-lg">
          <p className="font-bold text-blue-600">ID: {data.itemId}</p>
          <p className="text-sm">
            <strong>Sequence:</strong> {data.sequence}
          </p>
          <p className="text-sm">
            <strong>Cycle Time:</strong> {data.cycleTime} days
          </p>
          {data.movingRange !== null && (
            <p className="text-sm">
              <strong>Moving Range:</strong> {data.movingRange.toFixed(1)}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Completed: {data.originalEndDate}
          </p>
          {data.isSpecialCause && (
            <p className="text-xs text-red-600 font-semibold mt-1">
              ⚠ Special Cause Variation
            </p>
          )}
        </div>
      )
    }
    return null
  }

  const MovingRangeTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border-2 border-gray-300 rounded shadow-lg">
          <p className="text-sm">
            <strong>Sequence:</strong> {data.sequence}
          </p>
          <p className="text-sm">
            <strong>Moving Range:</strong> {data.movingRange.toFixed(2)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Process Behaviour Chart</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Shows cycle times in chronological order with Shewhart control limits to identify common cause vs. special cause variation.
      </p>

      {/* Individual Values Chart */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">Individual Values (Cycle Times)</h3>
        <div className="h-80 w-full">
          {isMounted && processedData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                width={800}
                height={320}
                data={processedData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                key={`process-chart-${processedData.length}`}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="sequence"
                  label={{ value: 'Sequence (Chronological Order)', position: 'insideBottom', offset: -10 }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  label={{ value: 'Cycle Time (days)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Control Lines */}
                <ReferenceLine
                  y={stats.upperProcessLimit}
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: "UPL", position: "top", offset: 5 }}
                />
                <ReferenceLine
                  y={stats.centralLine}
                  stroke="#059669"
                  strokeWidth={2}
                  label={{ value: "CL", position: "top", offset: 5 }}
                />
                <ReferenceLine
                  y={stats.lowerProcessLimit}
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: "LPL", position: "bottom", offset: 5 }}
                />

                {/* Main process line */}
                <Line
                  type="monotone"
                  dataKey="cycleTime"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#3b82f6', stroke: '#1e40af', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-gray-500">
                {!isMounted ? 'Loading chart...' : 'No data to display'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Moving Range Chart */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">Moving Range</h3>
        <div className="h-64 w-full">
          {isMounted && movingRangeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={256}>
              <LineChart
                width={800}
                height={256}
                data={movingRangeData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="sequence"
                  label={{ value: 'Sequence', position: 'insideBottom', offset: -10 }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  label={{ value: 'Moving Range', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<MovingRangeTooltip />} />

                <ReferenceLine
                  y={movingRangeData[0]?.upperRangeLimit || 0}
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: "URL", position: "top", offset: 5 }}
                />
                <ReferenceLine
                  y={stats.averageMovingRange}
                  stroke="#059669"
                  strokeWidth={2}
                  label={{ value: "AMR", position: "top", offset: 5 }}
                />

                <Line
                  type="monotone"
                  dataKey="movingRange"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', stroke: '#d97706', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-gray-500">No moving range data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Statistics Summary */}
      {stats.totalItems > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-semibold text-gray-700">Total Items</div>
            <div className="text-lg font-bold text-blue-600">{stats.totalItems}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-semibold text-gray-700">Central Line</div>
            <div className="text-lg font-bold text-green-600">{stats.centralLine.toFixed(1)} days</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-semibold text-gray-700">Control Limits</div>
            <div className="text-sm font-bold text-red-600">
              {stats.lowerProcessLimit.toFixed(1)} - {stats.upperProcessLimit.toFixed(1)}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-semibold text-gray-700">Special Causes</div>
            <div className="text-lg font-bold text-orange-600">{stats.specialCauseCount}</div>
          </div>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-600 space-y-2">
        <p>
          <strong>Interpretation:</strong> Points within control limits indicate common cause variation (predictable).
          Points outside limits (shown in red) indicate special cause variation requiring investigation.
        </p>
        <p>
          <strong>Control Limits:</strong> UPL = Upper Process Limit, CL = Central Line, LPL = Lower Process Limit
        </p>
      </div>
    </div>
  )
}