'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { detectColumns, toWorkItems, percentile, formatDate } from '@/lib/csv'
import SprintLengthControl, { DEFAULT_SPRINT_DAYS } from './SprintLengthControl'
import ExportPngButton from './ExportPngButton'
import ChartViewToggle, { ChartView, useEscapeToRestore } from './ChartViewToggle'

interface CycleTimeAnalysisProps {
  data: any[]
}

interface ProcessedDataPoint {
  key: string
  endDate: number
  cycleTime: number
  itemName: string
  itemId: string
  originalEndDate: string
}

function ordinal(n: number) {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'
  return `${n}${suffix}`
}

export default function CycleTimeAnalysis({ data }: CycleTimeAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [showSprint, setShowSprint] = useState(false)
  const [showAverage, setShowAverage] = useState(false)
  const [sprintDays, setSprintDays] = useState(DEFAULT_SPRINT_DAYS)
  const [view, setView] = useState<ChartView>('normal')
  const maximised = view === 'maximised'
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEscapeToRestore(view, () => setView('normal'))

  const { processedData, percentile85, stats } = useMemo(() => {
    const columns = detectColumns(data)
    const items = toWorkItems(data, columns)

    const processed: ProcessedDataPoint[] = items.map((item, index) => ({
      key: `${item.id}-${index}`,
      endDate: item.endDate,
      cycleTime: item.cycleTime,
      itemName: item.id,
      itemId: item.id,
      originalEndDate: item.originalEndDate,
    }))

    const cycleTimes = processed.map(item => item.cycleTime)
    const p85 = percentile(cycleTimes, 0.85)
    const average = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length || 0
    const averagePercentile = cycleTimes.length
      ? Math.round((cycleTimes.filter(ct => ct <= average).length / cycleTimes.length) * 100)
      : 0

    return {
      processedData: processed,
      percentile85: p85,
      stats: {
        count: processed.length,
        average,
        averagePercentile,
        min: cycleTimes.length ? Math.min(...cycleTimes) : 0,
        max: cycleTimes.length ? Math.max(...cycleTimes) : 0,
        p85: p85,
      },
    }
  }, [data])

  const withinSprint = processedData.filter(item => item.cycleTime <= sprintDays).length

  const formatXAxis = (tickItem: number) => formatDate(tickItem)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border-2 border-gray-300 rounded shadow-lg">
          <p className="font-bold text-blue-600">ID: {data.itemId}</p>
          <p className="font-semibold text-lg text-gray-900">{data.cycleTime} days</p>
          {data.itemName !== data.itemId && (
            <p className="text-sm text-gray-600 mt-1">{data.itemName}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">Completed: {data.originalEndDate}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className={maximised
      ? 'fixed inset-0 z-40 overflow-auto bg-white p-6 pt-20 flex flex-col'
      : 'bg-white rounded-lg shadow p-6'}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-gray-900">Cycle Time Analysis</h2>
        <div className="flex items-center gap-2">
          {isMounted && processedData.length > 0 && (
            <ExportPngButton targetRef={chartRef} filename="cycle-time-analysis.png" />
          )}
          <ChartViewToggle view={view} onChange={setView} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6">
        <SprintLengthControl
          enabled={showSprint}
          days={sprintDays}
          withinCount={withinSprint}
          totalCount={processedData.length}
          onToggle={setShowSprint}
          onDaysChange={setSprintDays}
        />
        <label className="flex items-center gap-2 mb-4 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={showAverage}
            onChange={e => setShowAverage(e.target.checked)}
            className="h-4 w-4 accent-purple-500"
          />
          Show average
        </label>
      </div>

      <div ref={chartRef} className={maximised ? 'flex-1 min-h-[16rem] w-full' : 'h-96 w-full'}>
        {isMounted && processedData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
              key={`chart-${processedData.length}`}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="endDate"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatXAxis}
                label={{ value: 'End Date', position: 'insideBottom', offset: -10 }}
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                dataKey="cycleTime"
                label={{ value: 'Cycle Time (days)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#6b7280' } }}
                tick={{ fill: '#6b7280' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <ReferenceLine
                y={percentile85}
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: `85th Percentile`, position: "top", offset: 10 }}
              />
              {showAverage && (
                <ReferenceLine
                  y={stats.average}
                  stroke="#9333ea"
                  strokeWidth={2}
                  strokeDasharray="2 4"
                  label={{ value: `Average (${stats.average.toFixed(1)}d) = ${ordinal(stats.averagePercentile)} percentile`, position: "insideTopRight", fill: '#9333ea' }}
                />
              )}
              {showSprint && (
                <ReferenceLine
                  y={sprintDays}
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  label={{ value: `Sprint (${sprintDays}d)`, position: "insideTopLeft", fill: '#d97706' }}
                />
              )}
              <Scatter
                name="Cycle time"
                data={processedData}
                dataKey="cycleTime"
                fill="#22c55e"
                isAnimationActive={false}
              />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-500">
              {!isMounted ? 'Loading chart...' : 'No data to display'}
            </p>
            {!isMounted && (
              <p className="text-xs text-gray-400 mt-2">Chart data: {processedData.length} items</p>
            )}
          </div>
        )}
      </div>

      {!maximised && (
        <div className="mt-4 text-sm text-gray-600">
          <p>The 85th percentile line indicates that 85% of items complete within {percentile85.toFixed(1)} days or less.</p>
          {showAverage && (
            <p>The average cycle time is {stats.average.toFixed(1)} days, which sits at the {ordinal(stats.averagePercentile)} percentile. A forecast based on the average would be right for only {stats.averagePercentile}% of items.</p>
          )}
        </div>
      )}
    </div>
  )
}