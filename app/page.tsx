'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import FileUpload from '@/components/FileUpload'
import ActionSelector from '@/components/ActionSelector'
import DarkModeToggle from '@/components/DarkModeToggle'
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

export type AnalysisAction = 'cycle-time' | 'process-behaviour' | 'correlation' | 'monte-carlo' | null

export default function Home() {
  const [csvData, setCsvData] = useState<any[]>([])
  const [selectedAction, setSelectedAction] = useState<AnalysisAction>(null)

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
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <DarkModeToggle />
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-8">Cycle Time Analyzer</h1>

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
            <ActionSelector onActionSelect={handleActionSelect} />
          </div>
        ) : (
          <div>
            <div className="mb-4">
              <button
                onClick={() => setSelectedAction(null)}
                className="text-sm text-gray-600 hover:text-gray-900 underline mr-4"
              >
                ← Back to action selection
              </button>
              <button
                onClick={handleReset}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline"
              >
                Upload different file
              </button>
            </div>

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
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-semibold mb-4">Monte Carlo Simulation</h2>
                <p className="text-gray-600">Coming soon...</p>
              </div>
            )}
          </div>
        )}
        </div>
      </main>
    </ThemeProvider>
  )
}