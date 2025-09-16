'use client'

import { useMemo, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ErrorBar } from 'recharts'

interface CorrelationAnalysisProps {
  data: any[]
}

interface CorrelationDataPoint {
  estimate: number
  minCT: number
  maxCT: number
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

export default function CorrelationAnalysis({ data }: CorrelationAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const { processedData, stats } = useMemo((): { processedData: CorrelationDataPoint[], stats: CorrelationStats } => {
    const allColumns = Object.keys(data[0] || {})
    console.log('All available columns:', allColumns)

    // Find estimate column
    let estimateColumn = allColumns.find(key =>
      key.toLowerCase() === 'estimate' || key.toLowerCase() === 'est'
    )

    // Find cycle time column
    let cycleTimeColumn = allColumns.find(key =>
      key.toLowerCase() === 'ct' || key.toLowerCase() === 'cycle time'
    )

    // Find ID column
    let idColumn = allColumns.find(key =>
      key.toLowerCase() === 'id' || key.toLowerCase() === 'key'
    )

    console.log('Column mapping:', {
      estimateColumn,
      cycleTimeColumn,
      idColumn
    })

    if (!estimateColumn || !cycleTimeColumn) {
      console.warn('Missing required columns for correlation analysis')
      return {
        processedData: [],
        stats: {
          totalItems: 0,
          uniqueEstimates: 0,
          estimateRange: 'N/A'
        }
      }
    }

    // Group data by estimate value
    const groupedByEstimate = new Map<number, Array<{id: string, cycleTime: number}>>()

    data.forEach(row => {
      const estimate = parseInt(row[estimateColumn])
      const cycleTime = parseFloat(row[cycleTimeColumn])
      const id = idColumn ? row[idColumn] : 'Unknown'

      if (!isNaN(estimate) && !isNaN(cycleTime) && cycleTime > 0) {
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
          avgCT,
          count: items.length,
          items
        }
      })
      .sort((a, b) => a.estimate - b.estimate)

    // Calculate correlation stats
    const totalItems = estimateColumn && cycleTimeColumn ? data.filter(row =>
      !isNaN(parseInt(row[estimateColumn])) &&
      !isNaN(parseFloat(row[cycleTimeColumn])) &&
      parseFloat(row[cycleTimeColumn]) > 0
    ).length : 0

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

  const BarWithErrorBars = (props: any) => {
    const { payload } = props
    if (!payload) return null

    const range = payload.maxCT - payload.minCT
    return (
      <Bar
        {...props}
        fill="#3b82f6"
        stroke="#1e40af"
        strokeWidth={1}
      />
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-4">Correlation Analysis</h2>
      <p className="text-gray-600 mb-6">
        Shows the range of cycle times (CT) for each estimate value. Each bar represents the minimum to maximum cycle time range for that estimate.
      </p>

      <div className="h-96 w-full">
        {isMounted && processedData.length > 0 ? (
          <ResponsiveContainer width="100%" height={384}>
            <BarChart
              width={800}
              height={384}
              data={processedData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="estimate"
                label={{ value: 'Estimate', position: 'insideBottom', offset: -10 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                label={{ value: 'Cycle Time (days)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="maxCT"
                fill="#3b82f6"
                stroke="#1e40af"
                strokeWidth={1}
              />
              <ErrorBar
                dataKey="minCT"
                width={4}
                stroke="#1e40af"
                strokeWidth={2}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-500">
              {!isMounted ? 'Loading chart...' : 'No data to display'}
            </p>
            {!isMounted && processedData.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                Chart data: {stats.uniqueEstimates} estimate values
              </p>
            )}
          </div>
        )}
      </div>

      {stats.totalItems > 0 && (
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

      <div className="mt-4 text-sm text-gray-600">
        <p>Each bar shows the full range of cycle times for items with that estimate value. Hover over bars for detailed breakdown.</p>
      </div>
    </div>
  )
}