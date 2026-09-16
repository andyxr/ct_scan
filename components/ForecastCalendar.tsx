'use client'

import { useMemo } from 'react'
import {
  CONFIDENCE_BANDS,
  bandFor,
  completionByDay,
  firstDayAtOrAbove,
  type ConfidenceBand,
  type HistogramBin,
} from '@/lib/monteCarlo'
import { formatDate } from '@/lib/csv'

interface ForecastCalendarProps {
  histogram: HistogramBin[]
  totalSimulations: number
  /** Last month shown is the month of this many days from start. */
  horizonDays: number
  start?: Date
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const BAND_LABEL: Record<ConfidenceBand, string> = {
  p95: '95%',
  p85: '85%',
  p70: '70%',
  p50: '50%',
  below50: '<50%',
}

const MS_PER_DAY = 86_400_000

function midnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Whole calendar days from `from` to `to`; DST shifts round away. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((midnight(to).getTime() - midnight(from).getTime()) / MS_PER_DAY)
}

function addDays(date: Date, days: number): Date {
  const result = midnight(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Monday-first index of a date's weekday. */
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

interface MonthGrid {
  key: string
  title: string
  leadingBlanks: number
  days: Date[]
}

function monthsCovering(start: Date, end: Date): MonthGrid[] {
  const months: MonthGrid[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cursor <= last) {
    const days: Date[] = []
    const day = new Date(cursor)
    while (day.getMonth() === cursor.getMonth()) {
      days.push(new Date(day))
      day.setDate(day.getDate() + 1)
    }
    months.push({
      key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
      title: cursor.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
      leadingBlanks: weekdayIndex(cursor),
      days,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

export default function ForecastCalendar({
  histogram,
  totalSimulations,
  horizonDays,
  start = new Date(),
}: ForecastCalendarProps) {
  const startDay = useMemo(() => midnight(start), [start])
  const byDay = useMemo(() => completionByDay(histogram, totalSimulations), [histogram, totalSimulations])
  const months = useMemo(() => {
    return monthsCovering(startDay, addDays(startDay, horizonDays))
  }, [startDay, horizonDays])

  if (byDay.length === 0) return null

  const legend = [...CONFIDENCE_BANDS].reverse().map(({ band, floor }) => ({
    band,
    date: addDays(startDay, band === 'below50' ? 0 : firstDayAtOrAbove(byDay, floor)),
  }))

  const probabilityOn = (date: Date): number | null => {
    const offset = daysBetween(startDay, date)
    if (offset < 0) return null
    return offset < byDay.length ? byDay[offset] : 1
  }

  return (
    <div className="sheet-plot p-4 flex flex-col gap-4 lg:flex-row lg:gap-6">
      <dl className="shrink-0 lg:w-56 lg:border-r lg:border-gray-300 lg:pr-6">
        <dt className="text-sm font-bold text-gray-700 mb-3">Chance of completion on or before:</dt>
        {legend.map(({ band, date }) => (
          <dd key={band} className="flex items-center gap-2 text-sm text-gray-700 mb-2">
            <span
              className="inline-block w-5 h-5 shrink-0"
              style={{ borderRadius: '9999px', backgroundColor: `var(--cal-${band})` }}
              aria-hidden
            />
            <span className="sheet-figure">
              {BAND_LABEL[band]} → {formatDate(date)}
            </span>
          </dd>
        ))}
      </dl>

      <div className="flex flex-wrap gap-x-8 gap-y-6">
        {months.map((month) => (
          <div key={month.key}>
            <h4 className="text-sm text-gray-700 text-center mb-2">{month.title}</h4>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((label, i) => (
                <div key={i} className="w-7 text-center text-xs text-gray-500">
                  {label}
                </div>
              ))}
              {Array.from({ length: month.leadingBlanks }, (_, i) => (
                <div key={`blank-${i}`} className="w-7 h-7" />
              ))}
              {month.days.map((date) => {
                const probability = probabilityOn(date)
                const isStart = probability !== null && daysBetween(startDay, date) === 0
                const band = probability === null ? null : bandFor(probability)
                return (
                  <div
                    key={date.getDate()}
                    title={probability === null ? undefined : `${formatDate(date)}: ${Math.round(probability * 100)}%`}
                    className={`w-7 h-7 flex items-center justify-center text-xs sheet-figure ${
                      band ? 'text-gray-900' : 'text-gray-400'
                    }`}
                    style={{
                      borderRadius: '9999px',
                      backgroundColor: band ? `var(--cal-${band})` : undefined,
                      outline: isStart ? '1.5px solid var(--sheet-ink)' : undefined,
                      outlineOffset: isStart ? '1px' : undefined,
                    }}
                  >
                    {date.getDate()}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
