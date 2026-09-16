'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import FileUpload from '@/components/FileUpload'
import ActionSelector from '@/components/ActionSelector'
import AnalysisNav from '@/components/AnalysisNav'
import ItemTypeControl from '@/components/ItemTypeControl'
import DateRangeControl from '@/components/DateRangeControl'
import {
  ALL_ITEM_TYPES,
  OPEN_DATE_RANGE,
  detectColumns,
  endDateSpan,
  filterByDateRange,
  filterByItemType,
  itemTypesIn,
  toInProgressItems,
  toWorkItems,
  type DateRange,
} from '@/lib/csv'
import { colourForIndex } from '@/lib/colours'
import type { AnalysisId } from '@/lib/analyses'
import AboutLink from '@/components/AboutLink'
import SplashScreen from '@/components/SplashScreen'

const CycleTimeAnalysis = dynamic(
  () => import('@/components/CycleTimeAnalysis'),
  { ssr: false }
)

const CorrelationAnalysis = dynamic(
  () => import('@/components/CorrelationAnalysis'),
  { ssr: false }
)

const ProcessBehaviourAnalysis = dynamic(
  () => import('@/components/ProcessBehaviourAnalysis'),
  { ssr: false }
)

const AgingWipAnalysis = dynamic(
  () => import('@/components/AgingWipAnalysis'),
  { ssr: false }
)

const CfdAnalysis = dynamic(
  () => import('@/components/CfdAnalysis'),
  { ssr: false }
)

const MonteCarloAnalysis = dynamic(
  () => import('@/components/MonteCarloAnalysis'),
  { ssr: false }
)

export type AnalysisAction = AnalysisId | null

export default function Home() {
  const [csvData, setCsvData] = useState<any[]>([])
  const [selectedAction, setSelectedAction] = useState<AnalysisAction>(null)
  const [itemType, setItemType] = useState<string>(ALL_ITEM_TYPES)
  const [dateRange, setDateRange] = useState<DateRange>(OPEN_DATE_RANGE)
  /** User overrides only. Types without one fall back to the palette, so a new file leaves no stale keys. */
  const [colourOverrides, setColourOverrides] = useState<Record<string, string>>({})

  const columns = useMemo(() => detectColumns(csvData), [csvData])
  const itemTypes = useMemo(() => itemTypesIn(csvData, columns), [csvData, columns])
  const endSpan = useMemo(() => endDateSpan(csvData, columns), [csvData, columns])
  const inProgressCount = useMemo(
    () => toInProgressItems(csvData, columns).length,
    [csvData, columns]
  )
  // Kept apart from filteredData because the cumulative flow chart treats the
  // date range as an x-axis viewport: filtering on completion date would drop
  // items that were in progress during the window and understate historical WIP.
  const typeFilteredData = useMemo(
    () => filterByItemType(csvData, columns, itemType),
    [csvData, columns, itemType]
  )
  const filteredData = useMemo(
    () => filterByDateRange(typeFilteredData, columns, dateRange),
    [typeFilteredData, columns, dateRange]
  )
  const filteredCounts = useMemo(() => ({
    completed: toWorkItems(filteredData, columns).length,
    inProgress: toInProgressItems(filteredData, columns).length,
  }), [filteredData, columns])
  // Keyed off the unfiltered type list on purpose: a type keeps its colour whatever the filter shows.
  const typeColours = useMemo(() => Object.fromEntries(
    itemTypes.map((type, index) => [type, colourOverrides[type] ?? colourForIndex(index)])
  ), [itemTypes, colourOverrides])

  const [showSplash, setShowSplash] = useState(true)

  const handleFileUpload = (data: any[]) => {
    setCsvData(data)
    setSelectedAction(null)
    setItemType(ALL_ITEM_TYPES)
    setDateRange(OPEN_DATE_RANGE)
    setColourOverrides({})
  }

  const handleActionSelect = (action: AnalysisAction) => {
    setSelectedAction(action)
  }

  const handleReset = () => {
    setCsvData([])
    setSelectedAction(null)
    setItemType(ALL_ITEM_TYPES)
    setDateRange(OPEN_DATE_RANGE)
    setColourOverrides({})
  }

  const fileSpan = useMemo(() => {
    const items = toWorkItems(csvData, columns)
    if (items.length === 0) return null
    // toWorkItems returns items oldest-first by end date, so the ends are the span.
    return `${items[0].originalEndDate} – ${items[items.length - 1].originalEndDate}`
  }, [csvData, columns])

  return (
    // Column layout so the footer rule closes the sheet at the foot of the
    // viewport rather than floating directly under short content.
    <main className="flex min-h-screen flex-col">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      {/* The sheet's printed banner. A form states what it is and what was
          entered on it before any of the entries. */}
      <header className="sheet-banner">
        <div className="container mx-auto flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <h1 className="text-2xl font-bold uppercase tracking-[0.2em]">Flowgauge</h1>
          <p className="text-xs tracking-[0.14em] opacity-75">
            Delivery flow record
          </p>
          {/* The stamped fields record what was entered on the sheet, so they
              appear once there is an entry rather than standing empty. */}
          <div className="ml-auto flex flex-wrap items-center gap-2 text-[0.6875rem]">
            {csvData.length > 0 && (
              <>
                <SheetField label="Items" value={String(csvData.length)} />
                {inProgressCount > 0 && (
                  <SheetField label="In progress" value={String(inProgressCount)} />
                )}
                {fileSpan && <SheetField label="Span" value={fileSpan} />}
                {itemTypes.length > 0 && (
                  <SheetField label="Types" value={String(itemTypes.length)} />
                )}
              </>
            )}
            <AboutLink />
          </div>
        </div>
      </header>

      <div className="container mx-auto flex-1 px-4 py-8">

      {csvData.length === 0 ? (
        <FileUpload onUpload={handleFileUpload} />
      ) : selectedAction === null ? (
        <div>
          <div className="mb-4">
            <button
              onClick={handleReset}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              Upload different file
            </button>
          </div>
          {/* Unfiltered on purpose: availability is a property of the file, not the current filter. */}
          <ActionSelector onActionSelect={handleActionSelect} data={csvData} />
        </div>
      ) : (
        <div>
          <AnalysisNav
            current={selectedAction}
            onSelect={handleActionSelect}
            onReset={handleReset}
            // Unfiltered on purpose: a type selection must never disable the tab the user is on.
            data={csvData}
          />

          <ItemTypeControl
            types={itemTypes}
            value={itemType}
            onChange={setItemType}
            completedCount={filteredCounts.completed}
            inProgressCount={filteredCounts.inProgress}
            inProgressCharted={selectedAction === 'aging-wip' || selectedAction === 'cumulative-flow'}
          />

          <DateRangeControl
            value={dateRange}
            span={endSpan}
            onChange={setDateRange}
            matchedCount={filteredData.length}
            totalCount={csvData.length}
          />

          {selectedAction === 'cycle-time' && (
            <CycleTimeAnalysis
              data={filteredData}
              typeColours={typeColours}
              onTypeColourChange={(type, colour) => setColourOverrides(prev => ({ ...prev, [type]: colour }))}
              onResetTypeColours={() => setColourOverrides({})}
            />
          )}

          {selectedAction === 'aging-wip' && (
            <AgingWipAnalysis
              data={filteredData}
              typeColours={typeColours}
              onTypeColourChange={(type, colour) => setColourOverrides(prev => ({ ...prev, [type]: colour }))}
              onResetTypeColours={() => setColourOverrides({})}
            />
          )}

          {selectedAction === 'cumulative-flow' && (
            <CfdAnalysis data={typeFilteredData} dateRange={dateRange} />
          )}

          {selectedAction === 'process-behaviour' && (
            <ProcessBehaviourAnalysis data={filteredData} />
          )}

          {selectedAction === 'correlation' && (
            <CorrelationAnalysis data={filteredData} />
          )}

          {selectedAction === 'monte-carlo' && (
            <MonteCarloAnalysis data={filteredData} />
          )}
        </div>
      )}
      </div>

      {/* The footer rule closes the sheet, the way a printed form states its own
          provenance at the bottom of the page. */}
      <footer className="container mx-auto px-4 pb-8">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t-2 border-gray-900 pt-2 text-[0.6875rem] uppercase tracking-[0.12em] text-gray-600">
          <span>Flowgauge</span>
          <span className="sheet-figure">Ljomi Systems</span>
          <span className="ml-auto">Read for deviation, not for comfort</span>
        </div>
      </footer>
    </main>
  )
}

/** A stamped field on the sheet's banner: boxed label, value set in mono. */
function SheetField({ label, value }: { label: string; value: string }) {
  return (
    <span className="sheet-field flex items-baseline gap-1.5 px-2 py-1">
      <span className="opacity-70">{label}</span>
      <span className="font-bold">{value}</span>
    </span>
  )
}