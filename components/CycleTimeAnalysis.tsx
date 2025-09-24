'use client'

import { useMemo, useState, useEffect } from 'react'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'

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

export default function CycleTimeAnalysis({ data }: CycleTimeAnalysisProps) {
  const [isMounted, setIsMounted] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const { processedData, percentile85, stats } = useMemo(() => {
    // First, let's see what columns we have
    const allColumns = Object.keys(data[0] || {})
    console.log('All available columns:', allColumns)

    // PRIORITY 1: Specific column mapping for this CSV structure
    // Columns: ID (string), Start (date), End (date), CT (int), Estimate (int)

    let endDateColumn = allColumns.find(key =>
      key.toLowerCase() === 'end' || key.toLowerCase() === 'end date'
    )

    let cycleTimeColumn = allColumns.find(key =>
      key.toLowerCase() === 'ct' || key.toLowerCase() === 'cycle time'
    )

    let idColumn = allColumns.find(key =>
      key.toLowerCase() === 'id' || key.toLowerCase() === 'key'
    )

    console.log('PRIORITY 1 - Specific column mapping:', {
      endDateColumn,
      cycleTimeColumn,
      idColumn
    })

    // PRIORITY 2: Fallback to automatic detection ONLY if specific columns not found
    if (!endDateColumn || !cycleTimeColumn) {
      console.log('Running fallback automatic detection...')

      for (const col of allColumns) {
        const sampleValues = data.slice(0, 5).map(row => row[col]).filter(Boolean)
        console.log(`Column "${col}" sample values:`, sampleValues)

        // Check if this looks like a date column
        if (!endDateColumn) {
          const isDateColumn = sampleValues.some(val => {
            const str = val.toString().trim()
            const datePattern = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/
            return datePattern.test(str)
          })

          if (isDateColumn) {
            endDateColumn = col
            console.log(`AUTO-DETECTED date column: ${col}`)
          }
        }

        // Check if this looks like a cycle time column
        if (!cycleTimeColumn) {
          const isCycleTimeColumn = sampleValues.every(val => {
            const num = parseFloat(val)
            return !isNaN(num) && num >= 0 && num <= 100 // stricter range to avoid "Estimate"
          })

          if (isCycleTimeColumn) {
            cycleTimeColumn = col
            console.log(`AUTO-DETECTED cycle time column: ${col}`)
          }
        }
      }
    }

    // Use ID as name column
    const nameColumn = idColumn

    console.log('FINAL Column mapping results:', {
      endDateColumn,
      cycleTimeColumn,
      idColumn,
      nameColumn,
      allColumns
    })

    // Validate we got the right columns and show sample data
    if (cycleTimeColumn) {
      const sampleCTs = data.slice(0, 5).map(row => ({
        id: idColumn ? row[idColumn] : 'Unknown',
        ct: row[cycleTimeColumn]
      }))
      console.log('Sample cycle time data:', sampleCTs)
    }

    // Process the data
    const processed: ProcessedDataPoint[] = data
      .filter(row => endDateColumn && cycleTimeColumn && row[endDateColumn] && row[cycleTimeColumn])
      .map((row, index): ProcessedDataPoint | null => {
        const dateString = row[endDateColumn!].toString().trim()
        const itemId = idColumn ? row[idColumn] : 'Unknown'

        let dateValue: Date

        // Parse DD/MM/YYYY format carefully
        const parts = dateString.split(/[-/]/)
        if (parts.length === 3) {
          const day = parseInt(parts[0].trim(), 10)
          const month = parseInt(parts[1].trim(), 10)
          const year = parseInt(parts[2].trim(), 10)

          // Validate parts are reasonable
          if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= 2030) {
            // Create date with month-1 (0-indexed)
            dateValue = new Date(year, month - 1, day)

            // Debug specific problematic dates
            if (itemId === 'DF-73') {
              console.log(`DF-73 DEBUG:`)
              console.log(`  Original dateString: "${dateString}"`)
              console.log(`  Parsed: day=${day}, month=${month}, year=${year}`)
              console.log(`  Created date: ${dateValue.toISOString()}`)
              console.log(`  Timestamp: ${dateValue.getTime()}`)
              console.log(`  Formatted back: ${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`)
            }
          } else {
            console.warn(`Invalid date parts for ${itemId}: ${day}/${month}/${year}`)
            return null
          }
        } else {
          console.warn(`Unexpected date format for ${itemId}: ${dateString}`)
          return null
        }

        // Final validation
        if (isNaN(dateValue.getTime())) {
          console.warn(`Final validation failed for ${itemId}: ${dateString}`)
          return null
        }

        return {
          key: `${itemId}-${index}`,
          endDate: dateValue.getTime(),
          cycleTime: parseFloat(row[cycleTimeColumn!]) || 0,
          itemName: nameColumn ? row[nameColumn] || 'Unknown' : 'Unknown',
          itemId: idColumn ? row[idColumn] : (nameColumn ? row[nameColumn] || 'Unknown' : 'Unknown'),
          originalEndDate: dateString
        }
      })
      .filter((item): item is ProcessedDataPoint => item !== null && !isNaN(item.endDate) && item.cycleTime > 0)
      .sort((a, b) => a.endDate - b.endDate)

    // Debug the date range
    if (processed.length > 0) {
      const minDate = Math.min(...processed.map(d => d.endDate))
      const maxDate = Math.max(...processed.map(d => d.endDate))

      console.log('Processed date range:',
        new Date(processed[0].endDate).toLocaleDateString('en-GB'),
        'to',
        new Date(processed[processed.length - 1].endDate).toLocaleDateString('en-GB')
      )
      console.log('Domain values:', {
        min: minDate,
        max: maxDate,
        minDate: new Date(minDate).toLocaleDateString('en-GB'),
        maxDate: new Date(maxDate).toLocaleDateString('en-GB')
      })
      console.log('First few timestamps:', processed.slice(0, 3).map(p => ({
        id: p.itemId,
        date: new Date(p.endDate).toLocaleDateString('en-GB'),
        timestamp: p.endDate
      })))
    }

    // Calculate 85th percentile with proper interpolation
    const cycleTimes = processed.map(item => item.cycleTime).sort((a, b) => a - b)
    let p85 = 0
    if (cycleTimes.length > 0) {
      const index = (cycleTimes.length - 1) * 0.85
      const lower = Math.floor(index)
      const upper = Math.ceil(index)
      const weight = index % 1

      p85 = lower === upper
        ? cycleTimes[lower]
        : cycleTimes[lower] * (1 - weight) + cycleTimes[upper] * weight

      console.log('85th percentile calculation:', {
        totalItems: cycleTimes.length,
        rawIndex: index,
        lowerIndex: lower,
        upperIndex: upper,
        lowerValue: cycleTimes[lower],
        upperValue: cycleTimes[upper],
        interpolationWeight: weight,
        result: p85,
        oldMethod: cycleTimes[Math.floor(cycleTimes.length * 0.85)] || 0
      })
    }

    // Calculate additional stats
    const avgCycleTime = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length || 0
    const minCycleTime = Math.min(...cycleTimes)
    const maxCycleTime = Math.max(...cycleTimes)

    return {
      processedData: processed,
      percentile85: p85,
      stats: {
        count: processed.length,
        average: avgCycleTime,
        min: minCycleTime,
        max: maxCycleTime,
        p85: p85
      }
    }
  }, [data])

  const formatXAxis = (tickItem: number) => {
    const date = new Date(tickItem)
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border-2 border-gray-300 dark:border-gray-600 rounded shadow-lg">
          <p className="font-bold text-blue-600 dark:text-blue-400">ID: {data.itemId}</p>
          <p className="font-semibold text-lg text-gray-900 dark:text-gray-100">{data.cycleTime} days</p>
          {data.itemName !== data.itemId && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{data.itemName}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Completed: {data.originalEndDate}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Cycle Time Analysis</h2>

      <div className="h-96 w-full">
        {isMounted && processedData.length > 0 ? (
          <ResponsiveContainer width="100%" height={384}>
            <ScatterChart
              width={800}
              height={384}
              data={processedData}
              margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
              key={`chart-${processedData.length}`}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
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
                tick={{ fontSize: 12, fill: theme === 'dark' ? '#d1d5db' : '#6b7280' }}
              />
              <YAxis
                dataKey="cycleTime"
                label={{ value: 'Cycle Time (days)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: theme === 'dark' ? '#d1d5db' : '#6b7280' } }}
                tick={{ fill: theme === 'dark' ? '#d1d5db' : '#6b7280' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <ReferenceLine
                y={percentile85}
                stroke={theme === 'dark' ? '#60a5fa' : '#2563eb'}
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: `85th Percentile`, position: "top", offset: 10 }}
              />
              <Scatter
                data={processedData}
                fill={theme === 'dark' ? '#34d399' : '#22c55e'}
              />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400">
              {!isMounted ? 'Loading chart...' : 'No data to display'}
            </p>
            {!isMounted && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Chart data: {processedData.length} items</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
        <p>The 85th percentile line indicates that 85% of items complete within {percentile85.toFixed(1)} days or less.</p>
      </div>
    </div>
  )
}