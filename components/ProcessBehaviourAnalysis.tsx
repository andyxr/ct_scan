'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'
import { detectColumns, toWorkItems } from '@/lib/csv'
import SprintLengthControl, { DEFAULT_SPRINT_DAYS } from './SprintLengthControl'
import ExportPngButton from './ExportPngButton'

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
  signals: string[]
}

interface ProcessStats {
  centralLine: number
  upperProcessLimit: number
  lowerProcessLimit: number
  averageMovingRange: number
  medianMovingRange: number
  upperRangeLimit: number
  limitMethod: 'median' | 'average'
  totalItems: number
  specialCauseCount: number
}

const RUN_LENGTH = 8

/**
 * Wheeler's rule 2: a run of RUN_LENGTH successive points all on one side of
 * the centre line. Returns the index of every point that belongs to such a run.
 */
function runSignalIndices(values: number[], centralLine: number): Set<number> {
  const flagged = new Set<number>()
  let runStart = 0
  const side = (v: number) => Math.sign(v - centralLine)
  for (let i = 1; i <= values.length; i++) {
    if (i === values.length || side(values[i]) !== side(values[runStart]) || side(values[i]) === 0) {
      if (i - runStart >= RUN_LENGTH && side(values[runStart]) !== 0) {
        for (let j = runStart; j < i; j++) flagged.add(j)
      }
      runStart = i
    }
  }
  return flagged
}

export default function ProcessBehaviourAnalysis({ data }: ProcessBehaviourAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [showSprint, setShowSprint] = useState(false)
  const [sprintDays, setSprintDays] = useState(DEFAULT_SPRINT_DAYS)
  const { theme } = useTheme()
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const { processedData, movingRangeData, stats } = useMemo(() => {
    const columns = detectColumns(data)
    const chronologicalData = toWorkItems(data, columns).map(item => ({
      endDate: item.endDate,
      cycleTime: item.cycleTime,
      itemId: item.id,
      itemName: item.id,
      originalEndDate: item.originalEndDate,
    }))

    if (chronologicalData.length === 0) {
      return {
        processedData: [],
        movingRangeData: [],
        stats: {
          centralLine: 0,
          upperProcessLimit: 0,
          lowerProcessLimit: 0,
          averageMovingRange: 0,
          medianMovingRange: 0,
          upperRangeLimit: 0,
          limitMethod: 'median' as const,
          totalItems: 0,
          specialCauseCount: 0
        }
      }
    }

    const cycleTimes = chronologicalData.map(item => item.cycleTime)
    const centralLine = cycleTimes.reduce((sum, ct) => sum + ct, 0) / cycleTimes.length

    const movingRanges: number[] = []
    for (let i = 1; i < cycleTimes.length; i++) {
      movingRanges.push(Math.abs(cycleTimes[i] - cycleTimes[i - 1]))
    }

    const averageMovingRange = movingRanges.length > 0
      ? movingRanges.reduce((sum, mr) => sum + mr, 0) / movingRanges.length
      : 0
    const sortedRanges = [...movingRanges].sort((a, b) => a - b)
    const medianMovingRange = sortedRanges.length > 0
      ? sortedRanges.length % 2 === 1
        ? sortedRanges[(sortedRanges.length - 1) / 2]
        : (sortedRanges[sortedRanges.length / 2 - 1] + sortedRanges[sortedRanges.length / 2]) / 2
      : 0

    // Cycle time is right-skewed, and one extreme item inflates the average
    // moving range enough to hide everything else. Wheeler's median moving range
    // method (3.145 and 3.865 in place of 2.66 and 3.27) resists that. When more
    // than half the moving ranges are zero the median collapses, so fall back.
    const limitMethod: ProcessStats['limitMethod'] = medianMovingRange > 0 ? 'median' : 'average'
    const sigmaSpan = limitMethod === 'median' ? 3.145 * medianMovingRange : 2.66 * averageMovingRange
    const upperRangeLimit = limitMethod === 'median' ? 3.865 * medianMovingRange : 3.27 * averageMovingRange

    const upperProcessLimit = centralLine + sigmaSpan
    const lowerProcessLimit = Math.max(0, centralLine - sigmaSpan)

    const runFlags = runSignalIndices(cycleTimes, centralLine)

    const processedDataPoints: ProcessDataPoint[] = chronologicalData.map((item, index) => {
      const signals: string[] = []
      if (item.cycleTime > upperProcessLimit || item.cycleTime < lowerProcessLimit) signals.push('Outside process limits')
      if (runFlags.has(index)) signals.push(`Run of ${RUN_LENGTH}+ on one side of the centre line`)

      return {
        key: `${item.itemId}-${index}`,
        sequence: index + 1,
        cycleTime: item.cycleTime,
        movingRange: index > 0 ? movingRanges[index - 1] : null,
        itemName: item.itemName,
        itemId: item.itemId,
        originalEndDate: item.originalEndDate,
        isSpecialCause: signals.length > 0,
        signals,
      }
    })

    // Create moving range chart data
    const movingRangePoints = movingRanges.map((mr, index) => ({
      key: `mr-${index}`,
      sequence: index + 2, // Moving range starts from 2nd point
      movingRange: mr,
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
        medianMovingRange,
        upperRangeLimit,
        limitMethod,
        totalItems: processedDataPoints.length,
        specialCauseCount
      }
    }
  }, [data])

  const withinSprint = processedData.filter(point => point.cycleTime <= sprintDays).length

  const SpecialCauseDot = ({ cx, cy, payload }: any) => {
    if (cx === undefined || cy === undefined) return null
    const special = (payload as ProcessDataPoint).isSpecialCause
    return (
      <circle
        cx={cx}
        cy={cy}
        r={special ? 5 : 4}
        fill={special ? '#dc2626' : '#3b82f6'}
        stroke={special ? '#991b1b' : '#1e40af'}
        strokeWidth={2}
      />
    )
  }

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
          {data.signals.map(signal => (
            <p key={signal} className="text-xs text-red-600 font-semibold mt-1">
              ⚠ {signal}
            </p>
          ))}
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
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Individual Values (Cycle Times)</h3>
          {isMounted && processedData.length > 0 && (
            <ExportPngButton targetRef={chartRef} filename="process-behaviour-chart.png" />
          )}
        </div>
        <SprintLengthControl
          enabled={showSprint}
          days={sprintDays}
          withinCount={withinSprint}
          totalCount={processedData.length}
          onToggle={setShowSprint}
          onDaysChange={setSprintDays}
        />
        <div ref={chartRef} className="h-80 w-full">
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
                {showSprint && (
                  <ReferenceLine
                    y={sprintDays}
                    stroke="#d97706"
                    strokeWidth={2}
                    strokeDasharray="8 4"
                    label={{ value: `Sprint (${sprintDays}d)`, position: "insideTopLeft", fill: '#d97706' }}
                  />
                )}

                {/* Main process line */}
                <Line
                  type="monotone"
                  dataKey="cycleTime"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={<SpecialCauseDot />}
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
                  y={stats.upperRangeLimit}
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{ value: "URL", position: "top", offset: 5 }}
                />
                <ReferenceLine
                  y={stats.limitMethod === 'median' ? stats.medianMovingRange : stats.averageMovingRange}
                  stroke="#059669"
                  strokeWidth={2}
                  label={{ value: stats.limitMethod === 'median' ? "Median mR" : "Average mR", position: "top", offset: 5 }}
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
        <div className="space-y-4">
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
          <div className="grid grid-cols-1 gap-4 text-sm">
            <div className="bg-gray-50 p-3 rounded">
              <div className="font-semibold text-gray-700">Upper Range Limit (URL)</div>
              <div className="text-lg font-bold text-purple-600">
                {stats.upperRangeLimit.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-600 space-y-2">
        <p>
          <strong>Limits:</strong> the centre line is the mean cycle time. The process limits sit 3.145 times
          the {stats.limitMethod === 'median' ? 'median' : 'average'} moving range either side of it, and the moving
          range limit is 3.865 times the median (Wheeler&apos;s median moving range method, which resists the
          inflation a single extreme item causes in right-skewed cycle time data).
          {stats.limitMethod === 'average' && ' More than half the moving ranges are zero, so the average moving range with the 2.66 and 3.27 constants is used instead.'}
        </p>
        <p>
          <strong>Signals:</strong> a point is marked red when it falls outside the process limits (Wheeler rule 1)
          or belongs to a run of {RUN_LENGTH} or more successive points on one side of the centre line (rule 2).
          Rules 3 and 4 (clusters near the limits) are not checked, so a chart with no red points is evidence of
          stability, not proof.
        </p>
        <p>
          <strong>Abbreviations:</strong> UPL = Upper Process Limit, CL = Central Line, LPL = Lower Process Limit, URL = Upper Range Limit
        </p>
      </div>
    </div>
  )
}