'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'
import { detectColumns, cycleTimeFor } from '@/lib/csv'
import ExportPngButton from './ExportPngButton'
import ChartViewToggle, { ChartView, useEscapeToRestore } from './ChartViewToggle'

interface CorrelationAnalysisProps {
  data: any[]
}

interface CorrelationDataPoint {
  estimate: number
  minCT: number
  maxCT: number
  range: number
  avgCT: number
  count: number
  items: Array<{
    id: string
    cycleTime: number
  }>
}

interface CorrelationStats {
  totalItems: number
  uniqueEstimates: number
  estimateRange: string
}

// Draws the min-to-max span as a vertical line with horizontal caps at each end.
// Recharts passes the bar's box; a zero-height box (single value) still gets a cap.
function RangeMarker({ x = 0, y = 0, width = 0, height = 0, color }: {
  x?: number; y?: number; width?: number; height?: number; color: string
}) {
  const cx = x + width / 2
  const capHalf = Math.min(width / 2, 10)
  const top = y
  const bottom = y + height
  return (
    <g stroke={color} strokeWidth={2} strokeLinecap="round">
      <line x1={cx} y1={top} x2={cx} y2={bottom} />
      <line x1={cx - capHalf} y1={top} x2={cx + capHalf} y2={top} />
      <line x1={cx - capHalf} y1={bottom} x2={cx + capHalf} y2={bottom} />
    </g>
  )
}

export default function CorrelationAnalysis({ data }: CorrelationAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [view, setView] = useState<ChartView>('normal')
  const maximised = view === 'maximised'
  const { theme } = useTheme()
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEscapeToRestore(view, () => setView('normal'))

  const { processedData, stats } = useMemo((): { processedData: CorrelationDataPoint[], stats: CorrelationStats } => {
    const columns = detectColumns(data)
    const estimateColumn = columns.estimate
    const idColumn = columns.id

    if (!estimateColumn) {
      return {
        processedData: [],
        stats: { totalItems: 0, uniqueEstimates: 0, estimateRange: 'N/A' }
      }
    }

    // Group data by estimate value
    const groupedByEstimate = new Map<number, Array<{id: string, cycleTime: number}>>()

    data.forEach(row => {
      const estimate = parseInt(row[estimateColumn])
      const cycleTime = cycleTimeFor(row, columns)
      const id = idColumn ? String(row[idColumn] ?? 'Unknown') : 'Unknown'

      if (!isNaN(estimate) && cycleTime !== null) {
        if (!groupedByEstimate.has(estimate)) {
          groupedByEstimate.set(estimate, [])
        }
        groupedByEstimate.get(estimate)!.push({ id, cycleTime })
      }
    })

    // Convert to chart data format
    const chartData: CorrelationDataPoint[] = Array.from(groupedByEstimate.entries())
      .map(([estimate, items]) => {
        const cycleTimes = items.map(item => item.cycleTime)
        const minCT = Math.min(...cycleTimes)
        const maxCT = Math.max(...cycleTimes)
        const avgCT = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length

        return {
          estimate,
          minCT,
          maxCT,
          range: maxCT - minCT,
          avgCT,
          count: items.length,
          items
        }
      })
      .sort((a, b) => a.estimate - b.estimate)

    // Calculate correlation stats
    const totalItems = Array.from(groupedByEstimate.values())
      .reduce((sum, items) => sum + items.length, 0)

    return {
      processedData: chartData,
      stats: {
        totalItems: totalItems || 0,
        uniqueEstimates: chartData.length,
        estimateRange: chartData.length > 0 ?
          `${chartData[0].estimate} - ${chartData[chartData.length - 1].estimate}` : 'N/A'
      }
    }
  }, [data])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as CorrelationDataPoint
      return (
        <div className="bg-white p-4 border-2 border-gray-300 rounded shadow-lg">
          <p className="font-bold text-blue-600">Estimate: {label}</p>
          <p className="text-sm mt-2">
            <strong>Range:</strong> {data.minCT} - {data.maxCT} days
          </p>
          <p className="text-sm">
            <strong>Average:</strong> {data.avgCT.toFixed(1)} days
          </p>
          <p className="text-sm">
            <strong>Items:</strong> {data.count}
          </p>
          <div className="mt-2 text-xs text-gray-600 max-h-20 overflow-y-auto">
            {data.items.slice(0, 5).map((item, index) => (
              <div key={index}>
                {item.id}: {item.cycleTime} days
              </div>
            ))}
            {data.items.length > 5 && (
              <div>... and {data.items.length - 5} more</div>
            )}
          </div>
        </div>
      )
    }
    return null
  }


  return (
    <div className={maximised
      ? 'fixed inset-0 z-40 overflow-auto bg-white dark:bg-gray-900 p-6 pt-20 flex flex-col'
      : 'bg-white dark:bg-gray-900 rounded-lg shadow p-6'}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Correlation Analysis</h2>
        <div className="flex items-center gap-2">
          {isMounted && processedData.length > 0 && (
            <ExportPngButton targetRef={chartRef} filename="correlation-analysis.png" />
          )}
          <ChartViewToggle view={view} onChange={setView} />
        </div>
      </div>
      {!maximised && (
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Shows the range of cycle times (CT) for each estimate value. Each marker spans the minimum to maximum cycle time for that estimate.
        </p>
      )}

      <div ref={chartRef} className={maximised ? 'flex-1 min-h-[16rem] w-full' : 'h-96 w-full'}>
        {isMounted && processedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={processedData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
              <XAxis
                dataKey="estimate"
                label={{ value: 'Estimate', position: 'insideBottom', offset: -10 }}
                tick={{ fontSize: 12, fill: theme === 'dark' ? '#d1d5db' : '#6b7280' }}
              />
              <YAxis
                label={{ value: 'Cycle Time (days)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Invisible bar to position the baseline at minCT */}
              <Bar
                dataKey="minCT"
                fill="transparent"
                stroke="transparent"
                stackId="range"
              />
              {/* Range drawn as a vertical line with caps, like an error bar */}
              <Bar
                dataKey="range"
                stackId="range"
                shape={<RangeMarker color={theme === 'dark' ? '#60a5fa' : '#3b82f6'} />}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400">
              {!isMounted
                ? 'Loading chart...'
                : 'No estimate column found in this CSV, so estimate-to-cycle-time correlation cannot be calculated.'}
            </p>
            {!isMounted && processedData.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                Chart data: {stats.uniqueEstimates} estimate values
              </p>
            )}
          </div>
        )}
      </div>

      {!maximised && stats.totalItems > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-semibold text-gray-700">Total Items</div>
            <div className="text-lg font-bold text-blue-600">{stats.totalItems}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-semibold text-gray-700">Unique Estimates</div>
            <div className="text-lg font-bold text-green-600">{stats.uniqueEstimates}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-semibold text-gray-700">Estimate Range</div>
            <div className="text-lg font-bold text-purple-600">{stats.estimateRange}</div>
          </div>
        </div>
      )}

      {!maximised && (
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
          <p>Each marker shows the full range of cycle times for items with that estimate value. Hover over a marker for a detailed breakdown.</p>
        </div>
      )}
    </div>
  )
}