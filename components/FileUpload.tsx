'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { FileSpreadsheet, BarChart3, Sparkles } from 'lucide-react'
import { DEMO_DATA } from '@/lib/demoData'

interface FileUploadProps {
  onUpload: (data: any[]) => void
}

export default function FileUpload({ onUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    Papa.parse(file, {
      header: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setError('Error parsing CSV file')
          console.error(result.errors)
        } else {
          setError(null)
          onUpload(result.data)
        }
      },
      error: (error) => {
        setError('Error reading file')
        console.error(error)
      }
    })
  }, [onUpload])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mb-8">
        <div className="flex gap-3">
          <FileSpreadsheet className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">1. Bring your CSV</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              One row per completed work item, with an ID, a start date and an end date:
            </p>
            <pre className="mt-2 overflow-x-auto rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2 text-xs text-gray-700 dark:text-gray-300">
              <code>{`ID,Start,End
DF-73,01/03/2025,15/03/2025
DF-74,04/03/2025,11/03/2025`}</code>
            </pre>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              Headers and date formats are detected automatically, so{' '}
              <code>Story ID</code>, <code>Start Date (In Progress)</code> and ISO dates
              work just as well. If your export already has a cycle time column, that is
              used instead of the start date. Add an estimate column to unlock
              correlation analysis.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <BarChart3 className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">2. Pick an analysis</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Plot cycle times against an 85th percentile line, chart process
              behaviour to see whether delivery is stable, compare estimates with
              actual cycle times, or forecast delivery dates with a Monte Carlo
              simulation.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-stretch">
      <div
        className={`w-80 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <svg
          className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500 mb-3"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <label htmlFor="file-upload" className="cursor-pointer">
          <span className="text-base font-medium text-gray-900 dark:text-gray-100">
            Drop CSV file here
          </span>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">or click to browse</p>
          <input
            id="file-upload"
            name="file-upload"
            type="file"
            className="sr-only"
            accept=".csv"
            onChange={handleFileInput}
          />
        </label>

        {error && (
          <div className="mt-4 text-red-600 dark:text-red-400 text-sm">{error}</div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setError(null)
          onUpload(DEMO_DATA)
        }}
        className="w-80 border-2 border-dashed rounded-lg p-6 text-center transition-colors border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-800"
      >
        <Sparkles
          className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500 mb-3"
          aria-hidden="true"
        />
        <span className="text-base font-medium text-gray-900 dark:text-gray-100">
          Use demo data
        </span>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          30 sample items with estimates, spanning three months
        </p>
      </button>
      </div>
    </div>
  )
}