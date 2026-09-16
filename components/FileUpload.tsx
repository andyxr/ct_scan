'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { FileSpreadsheet, BarChart3, Sparkles } from 'lucide-react'
import { DEMO_DATA } from '@/lib/demoData'
import { validationError } from '@/lib/csv'

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
      skipEmptyLines: true,
      complete: (result) => {
        // A ragged row (a trailing comma, say) reports TooManyFields but still
        // parses every column we need, so only fatal errors reject the file.
        const fatal = result.errors.filter(e => e.type === 'Delimiter' || e.type === 'Quotes')
        if (fatal.length > 0) {
          setError('Could not read that CSV file.')
          console.error(result.errors)
          return
        }

        const problem = validationError(result.data)
        if (problem) {
          setError(problem)
          return
        }

        setError(null)
        onUpload(result.data)
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
          <FileSpreadsheet className="h-6 w-6 shrink-0 text-blue-600" aria-hidden="true" />
          <div>
            <h2 className="font-bold tracking-[0.1em] text-gray-900">1. Bring your CSV</h2>
            <p className="text-sm text-gray-600 mt-1">
              One row per work item, with a header row. Columns can be
              in any order. Required: <code>item_id</code>, <code>start_date</code>,{' '}
              <code>end_date</code>. Optional: <code>estimate</code> and{' '}
              <code>item_type</code>. Leave <code>end_date</code> blank for an
              item that is still in progress; those rows are counted but only
              completed items are charted.
            </p>
            <pre className="mt-2 overflow-x-auto rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-700">
              <code>{`item_type,end_date,estimate,item_id,start_date
Story,15/03/2025,5,DF-73,01/03/2025
Bug,11/03/2025,3,DF-74,04/03/2025`}</code>
            </pre>
            <p className="text-sm text-gray-600 mt-2">
              Header matching ignores case, spaces, underscores and hyphens, and
              common alternatives such as <code>key</code>, <code>started</code>{' '}
              and <code>completed</code> work too. Date formats are detected per
              value, so DD/MM/YYYY and ISO timestamps such as{' '}
              <code>2026-01-27T15:42:43Z</code> both parse. Cycle time is worked
              out from the two dates; a <code>cycle_time</code> column is ignored.
              An estimate unlocks correlation analysis, and an item type adds a
              filter to every chart.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <BarChart3 className="h-6 w-6 shrink-0 text-blue-600" aria-hidden="true" />
          <div>
            <h2 className="font-bold tracking-[0.1em] text-gray-900">2. Pick an analysis</h2>
            <p className="text-sm text-gray-600 mt-1">
              Plot cycle times against percentile lines, chart process
              behaviour to see whether delivery is stable, compare estimates with
              actual cycle times, or forecast delivery dates with a Monte Carlo
              simulation.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-stretch">
      {/* The sheet's entry fields: ruled boxes waiting to be filled in, not
          dashed cards floating on the stock. */}
      <div
        className={`w-80 border p-6 text-center transition-colors ${
          isDragging
            ? 'border-blue-600 bg-blue-50'
            : 'border-gray-900 bg-gray-100/50 hover:bg-gray-100'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <svg
          className="mx-auto h-8 w-8 text-gray-400 mb-3"
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
          <span className="text-base font-bold tracking-[0.08em] text-gray-900">
            Drop CSV file here
          </span>
          <p className="text-sm text-gray-600 mt-1">or click to browse</p>
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
          <div className="mt-4 text-red-600 text-sm">{error}</div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          const problem = validationError(DEMO_DATA)
          setError(problem)
          if (!problem) onUpload(DEMO_DATA)
        }}
        className="w-80 border border-gray-900 bg-gray-100/50 p-6 text-center transition-colors hover:bg-gray-100"
      >
        <Sparkles
          className="mx-auto h-8 w-8 text-gray-400 mb-3"
          aria-hidden="true"
        />
        <span className="text-base font-bold tracking-[0.08em] text-gray-900">
          Use demo data
        </span>
        <p className="text-sm text-gray-600 mt-1">
          37 sample items with estimates and types, spanning three months: 30 completed and 7 still in progress
        </p>
      </button>
      </div>
    </div>
  )
}