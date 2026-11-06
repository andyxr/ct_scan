'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import FileUpload from '@/components/FileUpload'
import ActionSelector from '@/components/ActionSelector'
import AnalysisNav from '@/components/AnalysisNav'
import ItemTypeControl from '@/components/ItemTypeControl'
import DateRangeControl from '@/components/DateRangeControl'
import {
  OPEN_DATE_RANGE,
  detectColumns,
  endDateSpan,
  filterByDateRange,
  filterByItemType,
  itemTypesIn,
  toInProgressItems,
  toWorkItems,
  type DateRange,
  type CsvRow,
} from '@/lib/csv'
import { colourForIndex } from '@/lib/colours'
import type { AnalysisId } from '@/lib/analyses'
import AboutLink from '@/components/AboutLink'
import ThemeSelect from '@/components/ThemeSelect'
import SplashScreen from '@/components/SplashScreen'
import GuidedTour, { TourOffer } from '@/components/GuidedTour'
import { DEMO_DATA } from '@/lib/demoData'
import { TOUR_OFFERED_KEY, TOUR_STEPS, type TourScene } from '@/lib/tour'

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

const MonteCarloAnalysis = dynamic(
  () => import('@/components/MonteCarloAnalysis'),
  { ssr: false }
)

export type AnalysisAction = AnalysisId | null

export default function Home() {
  const [csvData, setCsvData] = useState<CsvRow[]>([])
  const [selectedAction, setSelectedAction] = useState<AnalysisAction>(null)
  /** Empty means All. */
  const [itemTypeSelection, setItemTypeSelection] = useState<string[]>([])
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
  const filteredData = useMemo(
    () => filterByDateRange(filterByItemType(csvData, columns, itemTypeSelection), columns, dateRange),
    [csvData, columns, itemTypeSelection, dateRange]
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
  /** Index into TOUR_STEPS while the tour runs. */
  const [tourStep, setTourStep] = useState<number | null>(null)
  const [tourOffered, setTourOffered] = useState(false)
  /** What the user had open when the tour started, put back when it ends. */
  const beforeTour = useRef<{
    csvData: CsvRow[]
    selectedAction: AnalysisAction
    itemTypeSelection: string[]
    dateRange: DateRange
    colourOverrides: Record<string, string>
  } | null>(null)

  // The tour is offered once the splash clears, to a browser that has never seen the offer.
  // Stable, because SplashScreen restarts its timers whenever onDone changes.
  const handleSplashDone = useCallback(() => {
    setShowSplash(false)
    try {
      if (!localStorage.getItem(TOUR_OFFERED_KEY)) setTourOffered(true)
    } catch {
      // Storage unavailable: no record of the offer, so no offer.
    }
  }, [])

  const handleFileUpload = (data: CsvRow[]) => {
    setCsvData(data)
    setSelectedAction(null)
    setItemTypeSelection([])
    setDateRange(OPEN_DATE_RANGE)
    setColourOverrides({})
  }

  const handleActionSelect = (action: AnalysisAction) => {
    setSelectedAction(action)
  }

  const handleReset = () => {
    setCsvData([])
    setSelectedAction(null)
    setItemTypeSelection([])
    setDateRange(OPEN_DATE_RANGE)
    setColourOverrides({})
  }

  const markTourOffered = () => {
    setTourOffered(false)
    try {
      localStorage.setItem(TOUR_OFFERED_KEY, '1')
    } catch {
      // Storage unavailable; the offer just comes back next visit.
    }
  }

  const showTourScene = (scene: TourScene) => {
    if (scene.screen === 'upload') return handleReset()
    // Reloading demo data only when it is not already open keeps a filter the user tried mid-tour.
    if (csvData !== DEMO_DATA) handleFileUpload(DEMO_DATA)
    setSelectedAction(scene.screen === 'analysis' ? scene.id : null)
  }

  const goToTourStep = (index: number) => {
    setTourStep(index)
    showTourScene(TOUR_STEPS[index].scene)
  }

  const startTour = () => {
    markTourOffered()
    if (tourStep !== null) return
    beforeTour.current = { csvData, selectedAction, itemTypeSelection, dateRange, colourOverrides }
    goToTourStep(0)
  }

  const endTour = () => {
    setTourStep(null)
    const before = beforeTour.current
    if (!before) return
    setCsvData(before.csvData)
    setSelectedAction(before.selectedAction)
    setItemTypeSelection(before.itemTypeSelection)
    setDateRange(before.dateRange)
    setColourOverrides(before.colourOverrides)
    beforeTour.current = null
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
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      {tourStep !== null && <GuidedTour index={tourStep} onNavigate={goToTourStep} onEnd={endTour} />}
      {tourOffered && tourStep === null && <TourOffer onStart={startTour} onDismiss={markTourOffered} />}

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
            <button
              type="button"
              onClick={startTour}
              className="sheet-field px-2 py-1 underline decoration-1 underline-offset-2 hover:opacity-75"
            >
              Tour
            </button>
            <AboutLink />
            <ThemeSelect />
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
            value={itemTypeSelection}
            onChange={setItemTypeSelection}
            typeColours={typeColours}
            completedCount={filteredCounts.completed}
            inProgressCount={filteredCounts.inProgress}
            inProgressCharted={selectedAction === 'aging-wip'}
          />

          <DateRangeControl
            value={dateRange}
            span={endSpan}
            onChange={setDateRange}
            matchedCount={filteredData.length}
            totalCount={csvData.length}
          />

          <div data-tour="analysis-panel">
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