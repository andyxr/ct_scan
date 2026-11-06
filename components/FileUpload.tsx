'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { FileSpreadsheet, BarChart3, Sparkles } from 'lucide-react'
import { DEMO_DATA } from '@/lib/demoData'
import { validationError, type CsvRow } from '@/lib/csv'

/** Example files, shown as tables. The first row is the header; '' is a blank cell. */
const DATES_EXAMPLE = [
  ['item_type', 'end_date', 'estimate', 'item_id', 'start_date'],
  ['Story', '15/03/2025', '5', 'DF-73', '01/03/2025'],
  ['Bug', '11/03/2025', '3', 'DF-74', '04/03/2025'],
  ['Task', '', '2', 'DF-75', '10/03/2025'],
]

const STATES_EXAMPLE = [
  ['item_id', 'item_type', 'backlog', 'in_progress', 'review', 'done'],
  ['DF-73', 'Story', '24/02/2025', '01/03/2025', '12/03/2025', '15/03/2025'],
  ['DF-74', 'Bug', '03/03/2025', '04/03/2025', '10/03/2025', '11/03/2025'],
  ['DF-75', 'Task', '05/03/2025', '10/03/2025', '', ''],
]

function ExampleCsv({ caption, rows }: { caption: string; rows: string[][] }) {
  const [header, ...body] = rows
  return (
    <div className="overflow-x-auto">
      <table className="sheet-figure border-collapse text-xs text-gray-700">
        <caption className="mb-1 text-left [font-family:var(--font-ui)] text-xs font-bold text-gray-700">{caption}</caption>
        <thead>
          <tr>
            {header.map((cell) => (
              <th key={cell} scope="col" className="border border-gray-200 bg-gray-100 px-2 py-1 text-left font-bold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-gray-50">
          {body.map((row) => (
            <tr key={row[header.indexOf('item_id')]}>
              {row.map((cell, i) => (
                <td key={header[i]} className="whitespace-nowrap border border-gray-200 px-2 py-1">
                  {cell || <span className="text-gray-400">blank</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface FileUploadProps {
  onUpload: (data: CsvRow[]) => void
}

export default function FileUpload({ onUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    Papa.parse<CsvRow>(file, {
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
      <div className="flex w-full max-w-4xl flex-col gap-6 mb-8">
        <div className="flex gap-3">
          <FileSpreadsheet className="h-6 w-6 shrink-0 text-blue-600" aria-hidden="true" />
          <div>
            <h2 className="font-bold tracking-[0.1em] text-gray-900">1. Bring your CSV</h2>
            <p className="text-sm text-gray-600 mt-1">
              One row per work item, with a header row. Columns can be in any
              order. Required: <code>item_id</code>, <code>start_date</code>{' '}
              (when work started) and <code>end_date</code> (when it finished).
              Optional: <code>estimate</code> and <code>item_type</code>.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              An item&apos;s state comes from its <code>end_date</code>. With a
              date, the item is done and feeds cycle times, process behaviour,
              correlation and forecasts. Left blank, the item is still in
              progress and shows on Aging Work In Progress, measured against
              the cycle times of finished work.
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <ExampleCsv caption="Start and end dates" rows={DATES_EXAMPLE} />
              <ExampleCsv caption="One column per workflow state" rows={STATES_EXAMPLE} />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Your export can carry a date column for every state in your
              workflow. Cycle time runs from the state where work starts to the
              state where it finishes, so in the second example{' '}
              <code>in_progress</code> is the start, <code>done</code> is the end,
              and <code>backlog</code> and <code>review</code> are ignored. An
              item with no <code>done</code> date is still in progress.
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Header matching ignores case, spaces, underscores and hyphens.
              The start can be headed <code>start_date</code>,{' '}
              <code>started</code>, <code>in_progress</code> or{' '}
              <code>commitment_date</code>; the end <code>end_date</code>,{' '}
              <code>done</code>, <code>completed</code>, <code>resolved</code>{' '}
              or <code>closed</code>. Other state columns are ignored. Date formats are detected per value, so DD/MM/YYYY
              and ISO timestamps such as <code>2026-01-27T15:42:43Z</code> both
              parse. Cycle time is worked out from the two dates; a{' '}
              <code>cycle_time</code> column is ignored. An estimate unlocks
              correlation analysis, and an item type lets you filter every chart
              by one or more types.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <BarChart3 className="h-6 w-6 shrink-0 text-blue-600" aria-hidden="true" />
          <div>
            <h2 className="font-bold tracking-[0.1em] text-gray-900">2. Pick an analysis</h2>
            <p className="text-sm text-gray-600 mt-1">
              Plot cycle times against percentile lines, see how long each
              in-progress item has been running, chart process behaviour to see
              whether delivery is stable, compare estimates with actual cycle
              times, or forecast delivery with a Monte Carlo simulation.
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