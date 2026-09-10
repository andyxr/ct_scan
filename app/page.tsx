'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import FileUpload from '@/components/FileUpload'
import ActionSelector from '@/components/ActionSelector'
import AnalysisNav from '@/components/AnalysisNav'
import type { AnalysisId } from '@/lib/analyses'
import ThemeControls from '@/components/ThemeControls'
import SplashScreen from '@/components/SplashScreen'
import { ThemeProvider } from '@/contexts/ThemeContext'

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

  const [showSplash, setShowSplash] = useState(true)

  const handleFileUpload = (data: any[]) => {
    setCsvData(data)
    setSelectedAction(null)
  }

  const handleActionSelect = (action: AnalysisAction) => {
    setSelectedAction(action)
  }

  const handleReset = () => {
    setCsvData([])
    setSelectedAction(null)
  }

  return (
    <ThemeProvider>
      <main className="min-h-screen bg-gray-50 dark:bg-black transition-colors duration-200">
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
        <ThemeControls />
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8">Flowgauge</h1>

        {csvData.length === 0 ? (
          <FileUpload onUpload={handleFileUpload} />
        ) : selectedAction === null ? (
          <div>
            <div className="mb-4">
              <button
                onClick={handleReset}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
              >
                Upload different file
              </button>
            </div>
            <ActionSelector onActionSelect={handleActionSelect} data={csvData} />
          </div>
        ) : (
          <div>
            <AnalysisNav
              current={selectedAction}
              onSelect={handleActionSelect}
              onReset={handleReset}
              data={csvData}
            />

            {selectedAction === 'cycle-time' && (
              <CycleTimeAnalysis data={csvData} />
            )}

            {selectedAction === 'process-behaviour' && (
              <ProcessBehaviourAnalysis data={csvData} />
            )}

            {selectedAction === 'correlation' && (
              <CorrelationAnalysis data={csvData} />
            )}

            {selectedAction === 'monte-carlo' && (
              <MonteCarloAnalysis data={csvData} />
            )}
          </div>
        )}
        </div>
      </main>
    </ThemeProvider>
  )
}