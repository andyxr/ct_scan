'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import FileUpload from '@/components/FileUpload'
import ActionSelector from '@/components/ActionSelector'
import AnalysisNav from '@/components/AnalysisNav'
import ItemTypeControl from '@/components/ItemTypeControl'
import { ALL_ITEM_TYPES, detectColumns, filterByItemType, itemTypesIn } from '@/lib/csv'
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

const MonteCarloAnalysis = dynamic(
  () => import('@/components/MonteCarloAnalysis'),
  { ssr: false }
)

export type AnalysisAction = AnalysisId | null

export default function Home() {
  const [csvData, setCsvData] = useState<any[]>([])
  const [selectedAction, setSelectedAction] = useState<AnalysisAction>(null)
  const [itemType, setItemType] = useState<string>(ALL_ITEM_TYPES)

  const columns = useMemo(() => detectColumns(csvData), [csvData])
  const itemTypes = useMemo(() => itemTypesIn(csvData, columns), [csvData, columns])
  const filteredData = useMemo(() => filterByItemType(csvData, columns, itemType), [csvData, columns, itemType])

  const [showSplash, setShowSplash] = useState(true)

  const handleFileUpload = (data: any[]) => {
    setCsvData(data)
    setSelectedAction(null)
    setItemType(ALL_ITEM_TYPES)
  }

  const handleActionSelect = (action: AnalysisAction) => {
    setSelectedAction(action)
  }

  const handleReset = () => {
    setCsvData([])
    setSelectedAction(null)
    setItemType(ALL_ITEM_TYPES)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <AboutLink />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Flowgauge</h1>

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
            matchedCount={filteredData.length}
            totalCount={csvData.length}
          />

          {selectedAction === 'cycle-time' && (
            <CycleTimeAnalysis data={filteredData} />
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
    </main>
  )
}